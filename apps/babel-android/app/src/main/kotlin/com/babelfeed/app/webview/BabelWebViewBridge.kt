package com.babelfeed.app.webview

import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import com.babelfeed.app.utils.PreferencesManager
import com.babelfeed.app.data.models.BatchedTranslationRequest
import com.babelfeed.app.data.models.BatchedTranslationElement
import com.babelfeed.app.data.models.BatchedTranslationResult
import com.babelfeed.app.data.models.BatchedStreamingResult
import com.babelfeed.app.data.models.ElementContext
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Serializable
data class TextNode(
    val id: String,
    val text: String,
    val path: List<Int>,
    val parentTag: String,
    val parentId: String?,
    val parentClass: String?,
    val boundingRect: BoundingRect?,
    val context: TextContext?
)

@Serializable
data class BoundingRect(
    val top: Double,
    val left: Double,
    val width: Double,
    val height: Double
)

@Serializable
data class TextContext(
    val beforeText: String,
    val afterText: String,
    val parentText: String,
    val semanticRole: String
)

@Serializable
data class PageMetadata(
    val language: String,
    val charset: String,
    val viewport: ViewportInfo,
    val wordCount: Int
)

@Serializable
data class ViewportInfo(
    val width: Int,
    val height: Int,
    val scrollTop: Int,
    val scrollLeft: Int
)

@Serializable
data class ExtractedContent(
    val timestamp: Long,
    val url: String,
    val title: String,
    val textNodes: List<TextNode>,
    val structure: List<DOMNode>,
    val metadata: PageMetadata
)

@Serializable
data class DOMNode(
    val tagName: String,
    val id: String?,
    val className: String?,
    val attributes: Map<String, String>,
    val path: List<Int>,
    val hasText: Boolean,
    val textNodeId: String?
)

@Serializable
data class TranslationResult(
    val id: String,
    val originalText: String,
    val translatedText: String,
    val confidence: Double,
    val language: String
)

@Serializable
data class TranslationBatch(
    val textNodes: List<TranslationResult>,
    val timestamp: Long,
    val totalProcessed: Int
)

class BabelWebViewBridge(
    private val webView: WebView,
    private val translationService: StreamingTranslationService,
    private val onContentExtracted: (ExtractedContent) -> Unit = {},
    private val onTranslationComplete: (TranslationBatch) -> Unit = {},
    private val onTranslationError: (String) -> Unit = {}
) {
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    private val json = Json { ignoreUnknownKeys = true }
    private var isTranslationInProgress = false
    
    private fun getTargetLanguage(): String {
        return try {
            val entryPoint = EntryPointAccessors.fromApplication(
                webView.context.applicationContext,
                BabelWebViewBridgeEntryPoint::class.java
            )
            val preferencesManager = entryPoint.preferencesManager()
            val targetLanguage = preferencesManager.getTranslationTargetLanguage(webView.context)
            Log.d(TAG, "Using target language from preferences: $targetLanguage")
            targetLanguage
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get target language from preferences, using default: zh-cn", e)
            "zh-cn" // Fallback to default
        }
    }
    
    companion object {
        private const val TAG = "BabelWebViewBridge"
        private const val BRIDGE_NAME = "BabelBridge"
    }

    fun initialize() {
        try {
            webView.addJavascriptInterface(this, BRIDGE_NAME)
            Log.d(TAG, "JavaScript interface '$BRIDGE_NAME' added successfully")
            
            // Wait a bit for the page to be ready before injecting scripts
            webView.postDelayed({
                injectContentExtractor()
            }, 500) // 500ms delay
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize bridge", e)
        }
    }

    private fun injectContentExtractor() {
        Log.d(TAG, "Starting to inject JavaScript modules...")
        
        val jsModules = listOf(
            "content-extractor.js" to "BabelContentExtractor",
            "content-injector.js" to "BabelContentInjector", 
            "ad-blocker.js" to "BabelAdBlocker",
            "dynamic-content-extractor.js" to "BabelDynamicExtractor"
        )
        
        val jsCode = jsModules.joinToString("\n") { (fileName, windowObject) ->
            val jsContent = loadJavaScriptFromAssets(fileName)
            if (jsContent.isNotEmpty()) {
                """
                if (typeof window.$windowObject === 'undefined') {
                    console.log('Loading $fileName...');
                    $jsContent
                    console.log('$windowObject loaded:', typeof window.$windowObject !== 'undefined');
                } else {
                    console.log('$windowObject already exists');
                }
                """.trimIndent()
            } else {
                "console.error('Failed to load $fileName - content is empty');"
            }
        }
        
        // Add final verification
        val verificationCode = """
            console.log('=== JavaScript Module Verification ===');
            console.log('BabelContentExtractor:', typeof window.BabelContentExtractor);
            console.log('BabelContentInjector:', typeof window.BabelContentInjector);
            console.log('BabelAdBlocker:', typeof window.BabelAdBlocker);
            console.log('BabelDynamicExtractor:', typeof window.BabelDynamicExtractor);
            console.log('=====================================');
        """.trimIndent()
        
        val fullJsCode = jsCode + "\n" + verificationCode
        
        webView.evaluateJavascript(fullJsCode) { result ->
            Log.d(TAG, "JavaScript modules injection completed: $result")
        }
    }

    private fun loadJavaScriptFromAssets(fileName: String): String {
        return try {
            Log.d(TAG, "Attempting to load $fileName from assets")
            
            // First check if the file exists
            val assetsList = webView.context.assets.list("")
            Log.d(TAG, "Available assets: ${assetsList?.joinToString(", ")}")
            
            if (assetsList?.contains(fileName) != true) {
                Log.e(TAG, "Asset $fileName not found in assets folder")
                return ""
            }
            
            val inputStream = webView.context.assets.open(fileName)
            val content = inputStream.bufferedReader().use { it.readText() }
            Log.d(TAG, "Successfully loaded $fileName (${content.length} chars)")
            
            // Validate the content is not empty
            if (content.isBlank()) {
                Log.w(TAG, "Warning: $fileName is empty")
            }
            
            content
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load $fileName from assets: ${e.message}", e)
            // List all available assets for debugging
            try {
                val allAssets = webView.context.assets.list("")
                Log.d(TAG, "All available assets: ${allAssets?.joinToString(", ")}")
            } catch (listException: Exception) {
                Log.e(TAG, "Could not list assets", listException)
            }
            ""
        }
    }

    @JavascriptInterface
    fun extractContent() {
        Log.d(TAG, "Starting content extraction...")
        extractContentWithRetry(0)
    }
    
    private fun extractContentWithRetry(attempt: Int) {
        val maxAttempts = 3
        val delay = 1000L * (attempt + 1) // 1s, 2s, 3s
        
        val jsCode = """
            (function() {
                try {
                    // Add comprehensive checks for BabelContentExtractor
                    console.log('Attempt ${attempt + 1}: Checking BabelContentExtractor availability...');
                    console.log('window.BabelContentExtractor:', typeof window.BabelContentExtractor);
                    console.log('Document ready state:', document.readyState);
                    console.log('Document body exists:', !!document.body);
                    console.log('Page text content preview:', document.body ? document.body.textContent.substring(0, 200) : 'no body');
                    
                    if (typeof window.BabelContentExtractor === 'undefined') {
                        throw new Error('BabelContentExtractor is undefined');
                    }
                    
                    if (typeof window.BabelContentExtractor.extractContent !== 'function') {
                        throw new Error('BabelContentExtractor.extractContent is not a function, it is: ' + typeof window.BabelContentExtractor.extractContent);
                    }
                    
                    console.log('BabelContentExtractor is ready, calling extractContent...');
                    const result = window.BabelContentExtractor.extractContent();
                    console.log('Content extraction completed, result type:', typeof result);
                    console.log('Content extraction result preview:', result ? result.substring(0, 500) : 'null');
                    
                    if (!result) {
                        throw new Error('extractContent returned null or undefined');
                    }
                    
                    // Validate that the result is valid JSON
                    try {
                        const parsed = JSON.parse(result);
                        console.log('Extracted content parsed successfully, text nodes count:', parsed.textNodes ? parsed.textNodes.length : 'no textNodes');
                    } catch (parseError) {
                        throw new Error('extractContent returned invalid JSON: ' + parseError.message);
                    }
                    
                    window.BabelBridge.onContentExtracted(result);
                } catch (error) {
                    console.error('Content extraction error (attempt ${attempt + 1}):', error);
                    console.error('Error stack:', error.stack);
                    
                    // If this is not the last attempt, signal for retry
                    if (${attempt + 1} < $maxAttempts) {
                        window.BabelBridge.onExtractionRetry('${attempt + 1}');
                    } else {
                        window.BabelBridge.onError('Content extraction failed after $maxAttempts attempts: ' + error.message);
                    }
                }
            })();
        """.trimIndent()

        if (attempt < maxAttempts) {
            webView.postDelayed({
                webView.evaluateJavascript(jsCode, null)
            }, if (attempt == 0) 0 else delay)
        }
    }
    
    @JavascriptInterface
    fun onExtractionRetry(attemptStr: String) {
        val attempt = attemptStr.toIntOrNull() ?: 0
        Log.d(TAG, "Retrying content extraction, attempt: ${attempt + 1}")
        extractContentWithRetry(attempt)
    }

    @JavascriptInterface
    fun onContentExtracted(contentJson: String) {
        Log.d(TAG, "Content extracted, processing...")
        
        coroutineScope.launch {
            try {
                val extractedContent = json.decodeFromString<ExtractedContent>(contentJson)
                Log.d(TAG, "Extracted ${extractedContent.textNodes.size} text nodes")
                
                onContentExtracted(extractedContent)
                
                // Process translation
                processTranslation(extractedContent)
                
            } catch (e: Exception) {
                Log.e(TAG, "Failed to process extracted content", e)
                val errorMsg = "Content processing failed: ${e.message}"
                onError(errorMsg)
            }
        }
    }

    private suspend fun processTranslation(content: ExtractedContent) {
        if (isTranslationInProgress) {
            Log.d(TAG, "Translation already in progress, skipping duplicate request")
            return
        }
        
        isTranslationInProgress = true
        try {
            val targetLanguage = getTargetLanguage()
            Log.d(TAG, "Starting batched translation of ${content.textNodes.size} text nodes from '${content.metadata.language}' to '$targetLanguage'")
            
            // Convert text nodes to batched translation elements
            val batchElements = content.textNodes.map { textNode ->
                // Generate locator for DOM element mapping
                val locator = generateElementLocator(textNode)
                
                // Register locator in JavaScript for later use
                registerElementLocator(textNode.id, locator)
                
                BatchedTranslationElement(
                    id = textNode.id,
                    locator = locator,
                    text = textNode.text,
                    context = textNode.context?.let { ctx ->
                        ElementContext(
                            beforeText = ctx.beforeText,
                            afterText = ctx.afterText,
                            parentText = ctx.parentText,
                            semanticRole = ctx.semanticRole
                        )
                    }
                )
            }
            
            // Create batched translation request
            val batchId = "batch_${System.currentTimeMillis()}"
            val batchRequest = BatchedTranslationRequest(
                batchId = batchId,
                elements = batchElements,
                fromLanguage = content.metadata.language,
                toLanguage = targetLanguage,
                complexity = "contextual",
                contentType = "article_content",
                priority = "normal",
                context = null,
                requestId = "req_${System.currentTimeMillis()}"
            )
            
            // Send ALL content in one batched API call, receive streaming response
            val translations = mutableListOf<TranslationResult>()
            
            withContext(Dispatchers.IO) {
                try {
                    Log.d(TAG, "Making single batched API call for ${batchElements.size} elements")
                    val apiService = translationService.getApiService()
                    val responseBody = apiService.translateBatched(batchRequest)
                    
                    // Process streaming NDJSON response line by line  
                    responseBody.byteStream().bufferedReader().use { reader ->
                        var line: String?
                        while (reader.readLine().also { line = it } != null) {
                            line?.let { ndjsonLine ->
                                if (ndjsonLine.trim().isNotEmpty()) {
                                    try {
                                        // Handle Server-Sent Events (SSE) format properly
                                        val cleanedLine = when {
                                            ndjsonLine.startsWith("data: ") -> ndjsonLine.removePrefix("data: ").trim()
                                            ndjsonLine.startsWith("id: ") -> {
                                                // Skip SSE id lines as they're not JSON data
                                                Log.d(TAG, "Skipping SSE id line: $ndjsonLine")
                                                return@let
                                            }
                                            ndjsonLine.trim().isEmpty() -> {
                                                // Skip empty lines (SSE heartbeat)
                                                return@let
                                            }
                                            else -> ndjsonLine.trim()
                                        }
                                        
                                        if (cleanedLine.isNotEmpty() && cleanedLine.startsWith("{")) {
                                            // Try to parse as BatchedTranslationResult first (individual translation)
                                            try {
                                                val result = json.decodeFromString<BatchedTranslationResult>(cleanedLine)
                                                
                                                // Convert to TranslationResult and store
                                                val originalElement = batchElements.find { it.id == result.id }
                                                originalElement?.let { element ->
                                                    val translationResult = TranslationResult(
                                                        id = result.id,
                                                        originalText = element.text,
                                                        translatedText = result.translatedText,
                                                        confidence = result.confidence,
                                                        language = targetLanguage
                                                    )
                                                    translations.add(translationResult)
                                                    
                                                    Log.d(TAG, "Streaming translation: '${element.text.take(20)}...' -> '${result.translatedText.take(20)}...'")
                                                    
                                                    // Inject each translation as it arrives
                                                    withContext(Dispatchers.Main) {
                                                        injectSingleTranslation(result)
                                                    }
                                                }
                                            } catch (translationParseError: Exception) {
                                                // Try to parse as BatchedStreamingResult (batch completion status)
                                                try {
                                                    val batchResult = json.decodeFromString<BatchedStreamingResult>(cleanedLine)
                                                    Log.d(TAG, "Batch completion: ${batchResult.processedElements}/${batchResult.totalElements} elements processed")
                                                } catch (batchParseError: Exception) {
                                                    Log.w(TAG, "Failed to parse NDJSON line as either type: $cleanedLine", translationParseError)
                                                }
                                            }
                                        }
                                    } catch (e: Exception) {
                                        Log.w(TAG, "Failed to process NDJSON line: $ndjsonLine", e)
                                    }
                                }
                            }
                        }
                    }
                    
                    Log.d(TAG, "Completed streaming translation: ${translations.size} elements processed")
                } catch (e: Exception) {
                    Log.e(TAG, "Batched translation API call failed, falling back to individual requests", e)
                    // Fallback to original individual translation approach
                    translations.addAll(processIndividualTranslations(content, targetLanguage))
                }
            }

            val translationBatch = TranslationBatch(
                textNodes = translations,
                timestamp = System.currentTimeMillis(),
                totalProcessed = translations.size
            )

            Log.d(TAG, "Batched translation processing complete: ${translations.size} items translated")
            onTranslationComplete(translationBatch)
            injectTranslations(translationBatch)

        } catch (e: Exception) {
            Log.e(TAG, "Translation processing failed", e)
            val errorMsg = "Translation failed: ${e.message}"
            onError(errorMsg)
        } finally {
            isTranslationInProgress = false
        }
    }

    /**
     * Generate CSS selector or XPath locator for DOM element identification
     */
    private fun generateElementLocator(textNode: TextNode): String {
        // Generate CSS selector based on node path and parent information
        val pathSelector = textNode.path.joinToString(" > ") { ":nth-child($it)" }
        
        return when {
            textNode.parentId != null -> "#${textNode.parentId} $pathSelector"
            textNode.parentClass != null -> ".${textNode.parentClass} $pathSelector"
            else -> "${textNode.parentTag} $pathSelector"
        }
    }

    /**
     * Inject partial translations for real-time updates
     */
    private fun injectPartialTranslations(translationBatch: TranslationBatch) {
        val translationsJson = json.encodeToString(translationBatch)
        
        val escapedJson = translationsJson
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
        
        val jsCode = """
            (function() {
                try {
                    const translationData = "$escapedJson";
                    if (window.BabelContentInjector && window.BabelContentInjector.injectPartialTranslations) {
                        window.BabelContentInjector.injectPartialTranslations(translationData);
                    }
                } catch (error) {
                    console.error('Partial translation injection error:', error);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    /**
     * Fallback method for individual translations when batch API fails
     */
    private suspend fun processIndividualTranslations(content: ExtractedContent, targetLanguage: String): List<TranslationResult> {
        val translations = mutableListOf<TranslationResult>()
        
        content.textNodes.chunked(10).forEach { batch ->
            val batchTranslations = batch.map { textNode ->
                val request = StreamingTranslationRequest(
                    id = textNode.id,
                    text = textNode.text,
                    sourceLanguage = content.metadata.language,
                    targetLanguage = targetLanguage,
                    priority = TranslationPriority.NORMAL,
                    context = textNode.context
                )
                
                try {
                    val result = translationService.translateText(request)
                    TranslationResult(
                        id = textNode.id,
                        originalText = textNode.text,
                        translatedText = result.translatedText,
                        confidence = result.confidence,
                        language = result.targetLanguage
                    )
                } catch (e: Exception) {
                    Log.e(TAG, "Individual translation failed for ${textNode.id}: ${e.message}")
                    TranslationResult(
                        id = textNode.id,
                        originalText = textNode.text,
                        translatedText = textNode.text,
                        confidence = 0.0,
                        language = content.metadata.language
                    )
                }
            }
            translations.addAll(batchTranslations)
        }
        
        return translations
    }

    /**
     * Register element locator in JavaScript for NDJSON mapping
     */
    private fun registerElementLocator(elementId: String, locator: String) {
        val jsCode = """
            (function() {
                if (window.BabelContentInjector && window.BabelContentInjector.registerElementLocator) {
                    window.BabelContentInjector.registerElementLocator('$elementId', '$locator');
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    /**
     * Inject a single translation result as it arrives from streaming response
     */
    private fun injectSingleTranslation(result: BatchedTranslationResult) {
        // Validate translation result before injection
        if (result.id.isBlank()) {
            Log.w(TAG, "Skipping translation injection - empty ID")
            return
        }
        
        if (result.translatedText.isBlank()) {
            Log.w(TAG, "Skipping translation injection for ${result.id} - empty translated text")
            return
        }
        
        val escapedTranslation = result.translatedText.trim()
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
        
        val jsCode = """
            (function() {
                try {
                    const translationResult = {
                        id: "${result.id}",
                        translatedText: "$escapedTranslation",
                        confidence: ${result.confidence},
                        progress: ${result.progress}
                    };
                    
                    if (window.BabelContentInjector && window.BabelContentInjector.injectSingleTranslation) {
                        const success = window.BabelContentInjector.injectSingleTranslation(translationResult);
                        console.log('Injected single translation for ${result.id}:', success);
                    } else {
                        console.warn('BabelContentInjector.injectSingleTranslation not available');
                    }
                } catch (error) {
                    console.error('Single translation injection error for ${result.id}:', error);
                }
            })();
        """.trimIndent()

        webView.evaluateJavascript(jsCode, null)
    }

    private fun injectNDJSONTranslations(ndjsonContent: String) {
        // Escape the NDJSON content for JavaScript injection
        val escapedNdjson = ndjsonContent
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
        
        val jsCode = """
            (function() {
                try {
                    const ndjsonResults = "$escapedNdjson";
                    console.log('Injecting NDJSON translations, content length:', ndjsonResults.length);
                    const result = window.BabelContentInjector.injectTranslationsByLocator(ndjsonResults);
                    console.log('NDJSON injection result:', result);
                    window.BabelBridge.onTranslationInjected(JSON.stringify(result));
                } catch (error) {
                    console.error('NDJSON translation injection error:', error);
                    window.BabelBridge.onError('NDJSON translation injection failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    private fun injectTranslations(translationBatch: TranslationBatch) {
        val translationsJson = json.encodeToString(translationBatch)
        
        // Properly escape JSON for JavaScript injection
        val escapedJson = translationsJson
            .replace("\\", "\\\\")  // Escape backslashes first
            .replace("\"", "\\\"")  // Escape quotes
            .replace("\n", "\\n")   // Escape newlines
            .replace("\r", "\\r")   // Escape carriage returns
            .replace("\t", "\\t")   // Escape tabs
        
        val jsCode = """
            (function() {
                try {
                    const translationData = "$escapedJson";
                    console.log('Injecting translations, data length:', translationData.length);
                    const result = window.BabelContentInjector.injectTranslations(translationData);
                    console.log('Injection result:', result);
                    window.BabelBridge.onTranslationInjected(JSON.stringify(result));
                } catch (error) {
                    console.error('Translation injection error:', error);
                    window.BabelBridge.onError('Translation injection failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    @JavascriptInterface
    fun onTranslationInjected(resultJson: String) {
        Log.d(TAG, "Translation injection result: $resultJson")
    }

    @JavascriptInterface
    fun blockAds() {
        Log.d(TAG, "Starting ad blocking...")
        
        val jsCode = """
            (function() {
                try {
                    const result = window.BabelAdBlocker.blockAds();
                    window.BabelBridge.onAdsBlocked(JSON.stringify(result));
                } catch (error) {
                    window.BabelBridge.onError('Ad blocking failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    @JavascriptInterface
    fun onAdsBlocked(resultJson: String) {
        Log.d(TAG, "Ad blocking result: $resultJson")
    }

    @JavascriptInterface
    fun disableAds() {
        Log.d(TAG, "Disabling ad blocking...")
        
        val jsCode = """
            (function() {
                try {
                    if (window.BabelAdBlocker && window.BabelAdBlocker.disableAds) {
                        const result = window.BabelAdBlocker.disableAds();
                        window.BabelBridge.onAdsDisabled(JSON.stringify(result));
                    } else {
                        window.BabelBridge.onAdsDisabled('{"success": false, "message": "Disable ads not supported"}');
                    }
                } catch (error) {
                    window.BabelBridge.onError('Ad blocking disable failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    @JavascriptInterface
    fun onAdsDisabled(resultJson: String) {
        Log.d(TAG, "Ad blocking disabled: $resultJson")
    }

    @JavascriptInterface
    fun toggleTranslation() {
        val jsCode = """
            (function() {
                try {
                    window.BabelContentInjector.toggleTranslation();
                    window.BabelBridge.onTranslationToggled('success');
                } catch (error) {
                    window.BabelBridge.onError('Translation toggle failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    @JavascriptInterface
    fun onTranslationToggled(result: String) {
        Log.d(TAG, "Translation toggled: $result")
    }

    @JavascriptInterface
    fun removeTranslations() {
        val jsCode = """
            (function() {
                try {
                    window.BabelContentInjector.removeAllTranslations();
                    window.BabelBridge.onTranslationsRemoved('success');
                } catch (error) {
                    window.BabelBridge.onError('Translation removal failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    @JavascriptInterface
    fun onTranslationsRemoved(result: String) {
        Log.d(TAG, "Translations removed: $result")
    }

    @JavascriptInterface
    fun onError(errorMessage: String) {
        Log.e(TAG, "JavaScript error: $errorMessage")
        
        // Only show UI error banner for actual translation failures, not all JS errors
        if (isTranslationError(errorMessage)) {
            onTranslationError(errorMessage)
        }
    }
    
    private fun isTranslationError(errorMessage: String): Boolean {
        val translationErrorPatterns = listOf(
            "translation failed",
            "content processing failed", 
            "translation injection failed",
            "translation service",
            "translation timeout",
            "translation not supported"
        )
        return translationErrorPatterns.any { pattern ->
            errorMessage.lowercase().contains(pattern)
        }
    }

    /**
     * Cancel current translation processing
     */
    fun cancelCurrentTranslation() {
        isTranslationInProgress = false
        Log.d(TAG, "Cancelled current translation processing")
    }

    fun cleanup() {
        // Cancel any ongoing translation
        cancelCurrentTranslation()
        webView.removeJavascriptInterface(BRIDGE_NAME)
        Log.d(TAG, "BabelWebViewBridge cleaned up")
    }
}

@EntryPoint
@InstallIn(SingletonComponent::class)
interface BabelWebViewBridgeEntryPoint {
    fun preferencesManager(): PreferencesManager
}