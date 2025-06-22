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
                    
                    if (typeof window.BabelContentExtractor === 'undefined') {
                        throw new Error('BabelContentExtractor is undefined');
                    }
                    
                    if (typeof window.BabelContentExtractor.extractContent !== 'function') {
                        throw new Error('BabelContentExtractor.extractContent is not a function, it is: ' + typeof window.BabelContentExtractor.extractContent);
                    }
                    
                    console.log('BabelContentExtractor is ready, calling extractContent...');
                    const result = window.BabelContentExtractor.extractContent();
                    console.log('Content extraction completed, result length:', result ? result.length : 'null');
                    
                    if (!result) {
                        throw new Error('extractContent returned null or undefined');
                    }
                    
                    window.BabelBridge.onContentExtracted(result);
                } catch (error) {
                    console.error('Content extraction error (attempt ${attempt + 1}):', error);
                    
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
        try {
            Log.d(TAG, "Starting translation of ${content.textNodes.size} text nodes from '${content.metadata.language}' to 'zh-cn'")
            val translations = mutableListOf<TranslationResult>()
            
            // Process text nodes in batches for better performance
            content.textNodes.chunked(10).forEachIndexed { batchIndex, batch ->
                Log.d(TAG, "Processing translation batch $batchIndex with ${batch.size} items")
                val batchTranslations = withContext(Dispatchers.IO) {
                    batch.mapIndexed { itemIndex, textNode ->
                        Log.d(TAG, "Translating item ${batchIndex * 10 + itemIndex}: '${textNode.text.take(50)}...'")
                        
                        val request = StreamingTranslationRequest(
                            id = textNode.id,
                            text = textNode.text,
                            sourceLanguage = content.metadata.language,
                            targetLanguage = "zh-cn", // Default to simplified Chinese
                            priority = TranslationPriority.NORMAL,
                            context = textNode.context
                        )
                        
                        try {
                            // Get translation result from streaming service
                            val result = translationService.translateText(request)
                            Log.d(TAG, "Translation result: '${textNode.text.take(30)}...' -> '${result.translatedText.take(30)}...'")
                            TranslationResult(
                                id = textNode.id,
                                originalText = textNode.text,
                                translatedText = result.translatedText,
                                confidence = result.confidence,
                                language = result.targetLanguage
                            )
                        } catch (e: Exception) {
                            Log.e(TAG, "Translation failed for text node ${textNode.id}: ${e.message}")
                            TranslationResult(
                                id = textNode.id,
                                originalText = textNode.text,
                                translatedText = textNode.text, // Fallback to original text
                                confidence = 0.0,
                                language = content.metadata.language
                            )
                        }
                    }
                }
                translations.addAll(batchTranslations)
            }

            val translationBatch = TranslationBatch(
                textNodes = translations,
                timestamp = System.currentTimeMillis(),
                totalProcessed = translations.size
            )

            Log.d(TAG, "Translation processing complete: ${translations.size} items translated")
            onTranslationComplete(translationBatch)
            injectTranslations(translationBatch)

        } catch (e: Exception) {
            Log.e(TAG, "Translation processing failed", e)
            val errorMsg = "Translation failed: ${e.message}"
            onError(errorMsg)
        }
    }

    private fun injectTranslations(translationBatch: TranslationBatch) {
        val translationsJson = json.encodeToString(translationBatch)
        
        val jsCode = """
            (function() {
                try {
                    const result = window.BabelContentInjector.injectTranslations('${translationsJson.replace("'", "\\'")}');
                    window.BabelBridge.onTranslationInjected(JSON.stringify(result));
                } catch (error) {
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

    fun cleanup() {
        webView.removeJavascriptInterface(BRIDGE_NAME)
    }
}