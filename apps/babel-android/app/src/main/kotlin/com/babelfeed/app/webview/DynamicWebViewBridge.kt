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
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

@Serializable
data class DynamicContentUpdate(
    val type: String, // "initial_scan" or "incremental_update"
    val timestamp: Long,
    val url: String,
    val title: String,
    val textNodes: List<TextNode>,
    val totalNodes: Int,
    val extractionType: String
)

@Serializable
data class StreamingProgressUpdate(
    val requestId: String,
    val progress: Float,
    val isPartial: Boolean,
    val partialText: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

class DynamicWebViewBridge(
    private val webView: WebView,
    private val streamingTranslationService: StreamingTranslationService,
    private val stateManager: TranslationStateManager? = null,
    private val onDynamicContentExtracted: (DynamicContentUpdate) -> Unit = {},
    private val onStreamingTranslationUpdate: (StreamingTranslationResult) -> Unit = {},
    private val onTranslationBatchUpdate: (TranslationBatchUpdate) -> Unit = {},
    private val onTranslationError: (String) -> Unit = {}
) {
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    private val json = Json { ignoreUnknownKeys = true }
    
    // State management
    private val isDynamicModeActive = AtomicBoolean(false)
    private val activeTranslations = ConcurrentHashMap<String, String>() // nodeId -> requestId
    private val contentHistory = ConcurrentHashMap<String, String>() // nodeId -> last translated text
    private var currentUrl: String? = null
    
    companion object {
        private const val TAG = "DynamicWebViewBridge"
        private const val BRIDGE_NAME = "BabelDynamicBridge"
    }

    fun initialize() {
        try {
            webView.addJavascriptInterface(this, BRIDGE_NAME)
            Log.d(TAG, "JavaScript interface '$BRIDGE_NAME' added successfully")
            injectDynamicScripts()
            Log.d(TAG, "Dynamic WebView bridge initialized")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize dynamic bridge", e)
        }
    }

    private fun injectDynamicScripts() {
        Log.d(TAG, "Starting to inject dynamic JavaScript modules...")
        
        val jsModules = listOf(
            "dynamic-content-extractor.js" to "BabelDynamicExtractor",
            "content-injector.js" to "BabelContentInjector", 
            "ad-blocker.js" to "BabelAdBlocker"
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
            console.log('=== Dynamic Module Verification ===');
            console.log('BabelDynamicExtractor:', typeof window.BabelDynamicExtractor);
            console.log('BabelContentInjector:', typeof window.BabelContentInjector);
            console.log('BabelAdBlocker:', typeof window.BabelAdBlocker);
            console.log('====================================');
        """.trimIndent()
        
        val fullJsCode = jsCode + "\n" + verificationCode
        
        webView.evaluateJavascript(fullJsCode) { result ->
            Log.d(TAG, "Dynamic scripts injection completed: $result")
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

    /**
     * Start dynamic content monitoring
     */
    @JavascriptInterface
    fun startDynamicMode() {
        if (isDynamicModeActive.get()) {
            Log.d(TAG, "Dynamic mode already active")
            return
        }
        
        Log.d(TAG, "Starting dynamic content monitoring")
        isDynamicModeActive.set(true)
        
        // Save dynamic mode state
        currentUrl?.let { url ->
            stateManager?.let { manager ->
                val currentState = manager.restoreTranslationState(url)
                manager.saveTranslationState(url, currentState.copy(isDynamicModeEnabled = true))
            }
        }
        
        val jsCode = """
            (function() {
                try {
                    const result = window.BabelDynamicExtractor.startMonitoring();
                    window.BabelDynamicBridge.onDynamicModeStarted(JSON.stringify(result));
                } catch (error) {
                    window.BabelDynamicBridge.onError('Dynamic mode start failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    /**
     * Stop dynamic content monitoring
     */
    @JavascriptInterface
    fun stopDynamicMode() {
        if (!isDynamicModeActive.get()) {
            Log.d(TAG, "Dynamic mode not active")
            return
        }
        
        Log.d(TAG, "Stopping dynamic content monitoring")
        isDynamicModeActive.set(false)
        
        // Cancel all active translations
        activeTranslations.values.forEach { requestId ->
            streamingTranslationService.cancelTranslation(requestId)
        }
        activeTranslations.clear()
        
        // Save dynamic mode state as disabled
        currentUrl?.let { url ->
            stateManager?.let { manager ->
                val currentState = manager.restoreTranslationState(url)
                manager.saveTranslationState(url, currentState.copy(isDynamicModeEnabled = false))
            }
        }
        
        val jsCode = """
            (function() {
                try {
                    const result = window.BabelDynamicExtractor.stopMonitoring();
                    window.BabelDynamicBridge.onDynamicModeStopped(JSON.stringify(result));
                } catch (error) {
                    window.BabelDynamicBridge.onError('Dynamic mode stop failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    /**
     * Handle dynamic content extraction from JavaScript
     */
    @JavascriptInterface
    fun onDynamicContentExtracted(contentJson: String) {
        Log.d(TAG, "Dynamic content extracted")
        
        coroutineScope.launch {
            try {
                val dynamicUpdate = json.decodeFromString<DynamicContentUpdate>(contentJson)
                Log.d(TAG, "Extracted ${dynamicUpdate.textNodes.size} nodes (${dynamicUpdate.type})")
                
                onDynamicContentExtracted(dynamicUpdate)
                
                // Process translations if in dynamic mode
                if (isDynamicModeActive.get() && dynamicUpdate.textNodes.isNotEmpty()) {
                    processStreamingTranslations(dynamicUpdate)
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Failed to process dynamic content", e)
                val errorMsg = "Dynamic content processing failed: ${e.message}"
                onError(errorMsg)
            }
        }
    }

    /**
     * Process streaming translations for dynamic content
     */
    private suspend fun processStreamingTranslations(update: DynamicContentUpdate) {
        val requests = mutableListOf<StreamingTranslationRequest>()
        
        update.textNodes.forEach { textNode ->
            // Check if this content has changed or is new
            val lastTranslated = contentHistory[textNode.id]
            if (lastTranslated != textNode.text) {
                // Cancel existing translation for this node
                activeTranslations[textNode.id]?.let { requestId ->
                    streamingTranslationService.cancelTranslation(requestId)
                }
                
                // Create new translation request
                val request = StreamingTranslationRequest(
                    id = textNode.id,
                    text = textNode.text,
                    sourceLanguage = detectSourceLanguage(textNode.text),
                    targetLanguage = "zh-cn", // Default to simplified Chinese
                    priority = if (update.type == "initial_scan") TranslationPriority.NORMAL else TranslationPriority.HIGH,
                    context = textNode.context
                )
                
                requests.add(request)
                contentHistory[textNode.id] = textNode.text
            }
        }
        
        if (requests.isNotEmpty()) {
            Log.d(TAG, "Processing ${requests.size} translation requests")
            
            // Submit batch for streaming translation
            val batchId = streamingTranslationService.translateBatchAsync(requests)
            
            // Track active translations
            requests.forEach { request ->
                activeTranslations[request.id] = request.id
            }
            
            // Set up result listeners (simplified for demo)
            coroutineScope.launch {
                handleStreamingResults(requests)
            }
        }
    }

    /**
     * Handle streaming translation results
     */
    private suspend fun handleStreamingResults(requests: List<StreamingTranslationRequest>) {
        // In a real implementation, this would listen to the streaming service
        // For demo purposes, we'll simulate streaming updates
        
        requests.forEach { request ->
            try {
                // Simulate translation with progress updates
                for (progress in listOf(0.3f, 0.6f, 1.0f)) {
                    delay(100) // Simulate processing time
                    
                    val isComplete = progress >= 1.0f
                    val result = if (isComplete) {
                        // Final result - use the injected streaming translation service
                        try {
                            streamingTranslationService.translateText(request)
                        } catch (e: Exception) {
                            Log.e(TAG, "Translation failed: ${e.message}")
                            StreamingTranslationResult(
                                id = request.id,
                                originalText = request.text,
                                translatedText = request.text, // Fallback to original text
                                confidence = 0.0,
                                sourceLanguage = request.sourceLanguage,
                                targetLanguage = request.targetLanguage,
                                processingTimeMs = 0,
                                isPartial = false,
                                progress = 1.0f
                            )
                        }
                    } else {
                        // Partial result
                        StreamingTranslationResult(
                            id = request.id,
                            originalText = request.text,
                            translatedText = "[Translating... ${(progress * 100).toInt()}%]",
                            confidence = 0.5,
                            sourceLanguage = request.sourceLanguage,
                            targetLanguage = request.targetLanguage,
                            processingTimeMs = 0,
                            isPartial = true,
                            progress = progress
                        )
                    }
                    
                    // Emit result
                    onStreamingTranslationUpdate(result)
                    
                    // Inject into WebView
                    if (isComplete) {
                        injectStreamingTranslation(result)
                        activeTranslations.remove(request.id)
                    } else {
                        injectPartialTranslation(result)
                    }
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Streaming translation failed for ${request.id}", e)
                activeTranslations.remove(request.id)
            }
        }
    }

    /**
     * Inject completed streaming translation into WebView
     */
    private fun injectStreamingTranslation(result: StreamingTranslationResult) {
        val jsCode = """
            (function() {
                try {
                    const element = document.querySelector('[data-babel-id="${result.id}"]');
                    if (element) {
                        // Store original content
                        if (!element.getAttribute('data-babel-original')) {
                            element.setAttribute('data-babel-original', element.textContent);
                        }
                        
                        // Apply translation with visual feedback
                        element.textContent = '${result.translatedText.replace("'", "\\'")}';
                        element.setAttribute('data-babel-translated', 'true');
                        element.style.transition = 'background-color 0.3s ease';
                        element.style.backgroundColor = 'rgba(144, 238, 144, 0.3)';
                        
                        // Remove highlight after delay
                        setTimeout(() => {
                            element.style.backgroundColor = '';
                        }, 1000);
                        
                        window.BabelDynamicBridge.onTranslationApplied('${result.id}');
                    }
                } catch (error) {
                    window.BabelDynamicBridge.onError('Translation injection failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    /**
     * Inject partial translation for visual feedback
     */
    private fun injectPartialTranslation(result: StreamingTranslationResult) {
        val jsCode = """
            (function() {
                try {
                    const element = document.querySelector('[data-babel-id="${result.id}"]');
                    if (element && !element.getAttribute('data-babel-translated')) {
                        // Show loading indicator
                        element.style.opacity = '0.6';
                        element.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
                    }
                } catch (error) {
                    // Ignore partial injection errors
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    /**
     * Force immediate content scan
     */
    @JavascriptInterface
    fun forceScan() {
        if (!isDynamicModeActive.get()) {
            Log.d(TAG, "Dynamic mode not active, cannot force scan")
            return
        }
        
        val jsCode = """
            (function() {
                try {
                    const result = window.BabelDynamicExtractor.forceScan();
                    window.BabelDynamicBridge.onDynamicContentExtracted(JSON.stringify({
                        type: 'force_scan',
                        ...result
                    }));
                } catch (error) {
                    window.BabelDynamicBridge.onError('Force scan failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    /**
     * Toggle translation for all content
     */
    @JavascriptInterface
    fun toggleAllTranslations() {
        val jsCode = """
            (function() {
                try {
                    const result = window.BabelContentInjector.toggleTranslation();
                    window.BabelDynamicBridge.onTranslationToggled(JSON.stringify(result));
                } catch (error) {
                    window.BabelDynamicBridge.onError('Translation toggle failed: ' + error.message);
                }
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    // JavaScript callback handlers
    @JavascriptInterface
    fun onDynamicModeStarted(resultJson: String) {
        Log.d(TAG, "Dynamic mode started: $resultJson")
    }

    @JavascriptInterface
    fun onDynamicModeStopped(resultJson: String) {
        Log.d(TAG, "Dynamic mode stopped: $resultJson")
    }

    @JavascriptInterface
    fun onTranslationApplied(nodeId: String) {
        Log.d(TAG, "Translation applied to node: $nodeId")
    }

    @JavascriptInterface
    fun onTranslationToggled(resultJson: String) {
        Log.d(TAG, "Translation toggled: $resultJson")
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
            "translation not supported",
            "dynamic content processing failed"
        )
        return translationErrorPatterns.any { pattern ->
            errorMessage.lowercase().contains(pattern)
        }
    }

    // Helper functions
    private fun detectSourceLanguage(text: String): String {
        // Simple language detection
        return when {
            text.any { it in '\u4e00'..'\u9fff' } -> "zh"
            text.any { it in '\u3040'..'\u309f' || it in '\u30a0'..'\u30ff' } -> "ja"
            text.any { it in '\uac00'..'\ud7af' } -> "ko"
            else -> "auto"
        }
    }

    suspend fun delay(ms: Long) {
        withContext(Dispatchers.IO) {
            Thread.sleep(ms)
        }
    }

    /**
     * Set current URL for state management
     */
    fun setCurrentUrl(url: String) {
        currentUrl = url
        Log.d(TAG, "Current URL set to: $url")
    }
    
    /**
     * Cancel all ongoing translations
     */
    fun cancelAllTranslations() {
        Log.d(TAG, "Cancelling all dynamic translations")
        
        // Cancel all active translation requests
        activeTranslations.values.forEach { requestId ->
            streamingTranslationService.cancelTranslation(requestId)
        }
        activeTranslations.clear()
        
        // Clear content history
        contentHistory.clear()
        
        Log.d(TAG, "All dynamic translations cancelled")
    }

    /**
     * Handle URL navigation - clear cache and restore state
     */
    fun onUrlChanged(newUrl: String) {
        Log.d(TAG, "URL changed to: $newUrl")
        
        // Cancel all ongoing translations from previous page
        cancelAllTranslations()
        
        // Update current URL
        currentUrl = newUrl
        
        // Restore dynamic mode state for new URL
        stateManager?.let { manager ->
            val state = manager.restoreTranslationState(newUrl)
            if (state.isDynamicModeEnabled && !isDynamicModeActive.get()) {
                Log.d(TAG, "Auto-starting dynamic mode for restored state")
                startDynamicMode()
            } else if (!state.isDynamicModeEnabled && isDynamicModeActive.get()) {
                Log.d(TAG, "Auto-stopping dynamic mode for restored state")
                stopDynamicMode()
            }
        }
    }
    
    /**
     * Get dynamic mode status
     */
    fun getStatus(): Map<String, Any> {
        return mapOf(
            "isDynamicActive" to isDynamicModeActive.get(),
            "activeTranslations" to activeTranslations.size,
            "contentHistory" to contentHistory.size,
            "currentUrl" to (currentUrl ?: "unknown"),
            "streamingStats" to streamingTranslationService.getCacheStats()
        )
    }

    /**
     * Cleanup resources
     */
    fun cleanup() {
        // Save final state before cleanup
        currentUrl?.let { url ->
            stateManager?.let { manager ->
                val currentState = manager.restoreTranslationState(url)
                manager.saveTranslationState(url, currentState.copy(
                    isDynamicModeEnabled = isDynamicModeActive.get(),
                    lastTranslatedAt = System.currentTimeMillis()
                ))
            }
        }
        
        stopDynamicMode()
        // Don't call streamingTranslationService.cleanup() here as it's a singleton
        // Just cancel this bridge's translations
        cancelAllTranslations()
        webView.removeJavascriptInterface(BRIDGE_NAME)
        currentUrl = null
        Log.d(TAG, "Dynamic WebView bridge cleaned up")
    }
}