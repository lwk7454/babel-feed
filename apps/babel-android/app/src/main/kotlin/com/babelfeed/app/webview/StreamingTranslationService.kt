package com.babelfeed.app.webview

import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.selects.select
import kotlinx.serialization.Serializable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong
import com.babelfeed.app.data.api.BabelApiService
import com.babelfeed.app.data.models.BackendTranslationRequest
import com.babelfeed.app.data.models.TranslationContext
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class StreamingTranslationRequest(
    val id: String,
    val text: String,
    val sourceLanguage: String,
    val targetLanguage: String,
    val priority: TranslationPriority = TranslationPriority.NORMAL,
    val context: TextContext? = null,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
data class StreamingTranslationResult(
    val id: String,
    val originalText: String,
    val translatedText: String,
    val confidence: Double,
    val sourceLanguage: String,
    val targetLanguage: String,
    val processingTimeMs: Long,
    val isPartial: Boolean = false,
    val progress: Float = 1.0f,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
data class TranslationBatchUpdate(
    val batchId: String,
    val results: List<StreamingTranslationResult>,
    val completed: Int,
    val total: Int,
    val isComplete: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)

enum class TranslationPriority {
    LOW, NORMAL, HIGH, URGENT
}

@Singleton  
class StreamingTranslationService @Inject constructor(
    private val apiService: BabelApiService
) {
    
    /**
     * Provide access to the API service for direct batched calls
     */
    fun getApiService(): BabelApiService = apiService
    
    companion object {
        private const val TAG = "StreamingTranslationService"
        private const val MAX_CONCURRENT_TRANSLATIONS = 10 // Increased for faster processing
        private const val BATCH_SIZE = 20 // Increased batch size
        private const val CACHE_SIZE = 1000
        private const val DEBOUNCE_DELAY_MS = 0L // Removed delay for immediate processing
    }
    
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    // Translation cache for performance
    private val translationCache = ConcurrentHashMap<String, StreamingTranslationResult>()
    
    // Request queue (simplified)
    private val requestQueue = Channel<StreamingTranslationRequest>(Channel.UNLIMITED)
    
    // Processing state
    private val batchCounter = AtomicLong(0)
    private val activeTranslations = ConcurrentHashMap<String, Job>()
    private val pendingRequests = ConcurrentHashMap<String, StreamingTranslationRequest>()
    
    
    
    /**
     * Call backend translation API with fallback - DEBUG MODE: Skip API for faster testing
     */
    private suspend fun translateWithBackendAPI(
        request: StreamingTranslationRequest,
        startTime: Long
    ): StreamingTranslationResult {
        // DEBUG: Skip API calls and go directly to mock for faster testing
        Log.d(TAG, "DEBUG MODE: Skipping backend API, using mock translation for: ${request.id}")
        return createMockTranslation(request, startTime)
        
        /* ORIGINAL CODE - Commented out for debugging
        return try {
            Log.d(TAG, "Using backend API for translation: ${request.id}")
            
            val backendRequest = BackendTranslationRequest(
                content = request.text,
                fromLanguage = request.sourceLanguage,
                toLanguage = request.targetLanguage,
                complexity = "contextual",
                contentType = "mixed_content", 
                priority = request.priority.name.lowercase(),
                streaming = false,
                requestId = request.id,
                context = null // TextContext from WebView is different from API TranslationContext
            )
            
            val response = apiService.translate(backendRequest)
            
            if (response.error != null) {
                Log.w(TAG, "Translation API error: ${response.error.message}, using mock translation")
                return createMockTranslation(request, startTime)
            }
            
            Log.d(TAG, "Backend API translation completed for: ${request.id}")
            
            StreamingTranslationResult(
                id = request.id,
                originalText = request.text,
                translatedText = response.translatedContent,
                confidence = response.confidence,
                sourceLanguage = request.sourceLanguage,
                targetLanguage = request.targetLanguage,
                processingTimeMs = System.currentTimeMillis() - startTime,
                isPartial = false,
                progress = 1.0f
            )
        } catch (e: Exception) {
            Log.w(TAG, "Backend API translation failed for ${request.id}: ${e.message}, using mock translation")
            return createMockTranslation(request, startTime)
        }
        */
    }
    
    /**
     * Create mock translation for testing when API fails
     */
    private fun createMockTranslation(
        request: StreamingTranslationRequest,
        startTime: Long
    ): StreamingTranslationResult {
        // Simple mock translation logic based on target language
        val mockTranslation = when (request.targetLanguage.lowercase()) {
            "zh-cn", "zh" -> "【译】${request.text}"
            "ja" -> "【翻訳】${request.text}"
            "ko" -> "【번역】${request.text}"
            "fr" -> "[TRAD] ${request.text}"
            "de" -> "[ÜBER] ${request.text}"
            "es" -> "[TRAD] ${request.text}"
            "ru" -> "[ПЕРЕ] ${request.text}"
            else -> "[MOCK] ${request.text}"
        }
        
        Log.d(TAG, "Using mock translation for ${request.id}: '${request.text}' -> '$mockTranslation'")
        
        return StreamingTranslationResult(
            id = request.id,
            originalText = request.text,
            translatedText = mockTranslation,
            confidence = 0.95, // High confidence for testing
            sourceLanguage = request.sourceLanguage,
            targetLanguage = request.targetLanguage,
            processingTimeMs = System.currentTimeMillis() - startTime,
            isPartial = false,
            progress = 1.0f
        )
    }
    
    
    init {
        startProcessingLoop()
    }
    
    /**
     * Start the continuous processing loop for translation requests
     */
    private fun startProcessingLoop() {
        // Start multiple workers for concurrent processing
        repeat(MAX_CONCURRENT_TRANSLATIONS) { workerId ->
            coroutineScope.launch {
                processTranslationQueue(workerId)
            }
        }
    }
    
    /**
     * Main processing loop that handles requests
     */
    private suspend fun processTranslationQueue(workerId: Int) {
        Log.d(TAG, "Translation worker $workerId started")
        
        while (coroutineScope.isActive) {
            try {
                // Get next request from queue
                val request = requestQueue.tryReceive().getOrNull()
                
                if (request != null) {
                    processTranslationRequest(request, workerId)
                } else {
                    delay(10) // Minimal pause if no requests
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error in translation worker $workerId", e)
                delay(100) // Reduced pause on error
            }
        }
    }
    
    /**
     * Process a single translation request
     */
    private suspend fun processTranslationRequest(request: StreamingTranslationRequest, workerId: Int) {
        val startTime = System.currentTimeMillis()
        Log.d(TAG, "Worker $workerId processing translation: ${request.id}")
        
        try {
            // Check cache first
            val cacheKey = generateCacheKey(request.text, request.sourceLanguage, request.targetLanguage)
            val cached = translationCache[cacheKey]
            
            if (cached != null) {
                Log.d(TAG, "Using cached translation for: ${request.id}")
                emitTranslationResult(cached.copy(
                    id = request.id,
                    processingTimeMs = System.currentTimeMillis() - startTime
                ))
                return
            }
            
            // Perform actual translation
            val result = translateWithStreaming(request, startTime)
            
            // Cache the result
            if (translationCache.size < CACHE_SIZE) {
                translationCache[cacheKey] = result
            }
            
            // Emit final result
            emitTranslationResult(result)
            
        } catch (e: Exception) {
            Log.e(TAG, "Translation failed for ${request.id}", e)
            emitTranslationError(request.id, e.message ?: "Unknown error")
        } finally {
            pendingRequests.remove(request.id)
            activeTranslations.remove(request.id)
        }
    }
    
    /**
     * Perform translation with streaming updates for long text
     */
    private suspend fun translateWithStreaming(
        request: StreamingTranslationRequest,
        startTime: Long
    ): StreamingTranslationResult {
        
        val text = request.text
        val textLength = text.length
        
        // For short text, translate immediately
        if (textLength < 100) {
            return translateWithBackendAPI(request, startTime)
        }
        
        // For longer text, provide streaming updates
        val chunks = splitTextIntoChunks(text, 50) // 50 character chunks
        val translatedChunks = mutableListOf<String>()
        
        chunks.forEachIndexed { index, chunk ->
            // Emit partial progress
            val progress = (index.toFloat() + 1) / chunks.size
            
            if (index > 0) { // Don't emit for first chunk to avoid too many updates
                emitTranslationResult(StreamingTranslationResult(
                    id = request.id,
                    originalText = text,
                    translatedText = translatedChunks.joinToString(""),
                    confidence = 0.8, // Lower confidence for partial
                    sourceLanguage = request.sourceLanguage,
                    targetLanguage = request.targetLanguage,
                    processingTimeMs = System.currentTimeMillis() - startTime,
                    isPartial = true,
                    progress = progress
                ))
            }
            
            // Translate chunk using backend API
            val chunkRequest = request.copy(
                id = "${request.id}_chunk_${index}",
                text = chunk
            )
            val chunkResult = try {
                val translationResult = translateWithBackendAPI(chunkRequest, System.currentTimeMillis())
                translationResult.translatedText
            } catch (e: Exception) {
                Log.w(TAG, "Chunk translation failed, using original text: ${e.message}")
                chunk // Fallback to original text if translation fails
            }
            
            translatedChunks.add(chunkResult)
            
            // Removed delay for immediate processing
        }
        
        return StreamingTranslationResult(
            id = request.id,
            originalText = text,
            translatedText = translatedChunks.joinToString(""),
            confidence = 0.95, // High confidence for complete translation
            sourceLanguage = request.sourceLanguage,
            targetLanguage = request.targetLanguage,
            processingTimeMs = System.currentTimeMillis() - startTime,
            isPartial = false,
            progress = 1.0f
        )
    }
    
    /**
     * Split text into manageable chunks for streaming
     */
    private fun splitTextIntoChunks(text: String, chunkSize: Int): List<String> {
        val chunks = mutableListOf<String>()
        var start = 0
        
        while (start < text.length) {
            val end = minOf(start + chunkSize, text.length)
            
            // Try to break at word boundaries
            var actualEnd = end
            if (end < text.length) {
                val spaceIndex = text.lastIndexOf(' ', end)
                if (spaceIndex > start) {
                    actualEnd = spaceIndex
                }
            }
            
            chunks.add(text.substring(start, actualEnd))
            start = actualEnd
            
            // Skip whitespace
            while (start < text.length && text[start].isWhitespace()) {
                start++
            }
        }
        
        return chunks
    }
    
    /**
     * Submit a single translation request
     */
    suspend fun translateAsync(
        text: String,
        sourceLanguage: String,
        targetLanguage: String,
        priority: TranslationPriority = TranslationPriority.NORMAL,
        context: TextContext? = null
    ): String {
        val requestId = generateRequestId()
        val request = StreamingTranslationRequest(
            id = requestId,
            text = text,
            sourceLanguage = sourceLanguage,
            targetLanguage = targetLanguage,
            priority = priority,
            context = context
        )
        
        return submitTranslationRequest(request)
    }
    
    /**
     * Submit a batch of translation requests
     */
    suspend fun translateBatchAsync(
        requests: List<StreamingTranslationRequest>
    ): String {
        val batchId = generateBatchId()
        
        coroutineScope.launch {
            processBatch(batchId, requests)
        }
        
        return batchId
    }
    
    /**
     * Process a batch of translation requests with progress updates
     */
    private suspend fun processBatch(batchId: String, requests: List<StreamingTranslationRequest>) {
        val results = mutableListOf<StreamingTranslationResult>()
        var completed = 0
        
        // Submit all requests
        requests.forEach { request ->
            submitTranslationRequest(request)
        }
        
        // Collect results as they complete
        // In a real implementation, this would use proper flow collection
        // For now, we'll simulate batch completion
        val batchJob = coroutineScope.launch {
            requests.forEach { request ->
                delay(100) // Simulate processing time
                completed++
                
                // Emit batch progress update
                emitBatchUpdate(TranslationBatchUpdate(
                    batchId = batchId,
                    results = results,
                    completed = completed,
                    total = requests.size,
                    isComplete = completed == requests.size
                ))
            }
        }
        
        batchJob.join()
    }
    
    /**
     * Submit a translation request to queue
     */
    private suspend fun submitTranslationRequest(request: StreamingTranslationRequest): String {
        pendingRequests[request.id] = request
        requestQueue.send(request)
        Log.d(TAG, "Submitted translation request: ${request.id} (priority: ${request.priority})")
        return request.id
    }
    
    /**
     * Cancel a translation request
     */
    fun cancelTranslation(requestId: String): Boolean {
        pendingRequests.remove(requestId)
        val job = activeTranslations.remove(requestId)
        job?.cancel()
        return job != null
    }
    
    /**
     * Get translation status
     */
    fun getTranslationStatus(requestId: String): String? {
        return when {
            activeTranslations.containsKey(requestId) -> "processing"
            pendingRequests.containsKey(requestId) -> "pending"
            else -> null
        }
    }
    
    /**
     * Clear translation cache
     */
    fun clearCache() {
        translationCache.clear()
        Log.d(TAG, "Translation cache cleared")
    }
    
    /**
     * Get cache statistics
     */
    fun getCacheStats(): Map<String, Any> {
        return mapOf(
            "cacheSize" to translationCache.size,
            "maxCacheSize" to CACHE_SIZE,
            "pendingRequests" to pendingRequests.size,
            "activeTranslations" to activeTranslations.size
        )
    }
    
    // Helper functions
    private fun generateRequestId(): String {
        return "req_${System.currentTimeMillis()}_${(1000..9999).random()}"
    }
    
    private fun generateBatchId(): String {
        return "batch_${batchCounter.incrementAndGet()}_${System.currentTimeMillis()}"
    }
    
    private fun generateCacheKey(text: String, sourceLanguage: String, targetLanguage: String): String {
        return "${sourceLanguage}_${targetLanguage}_${text.hashCode()}"
    }
    
    // Event emission (to be connected to bridge)
    private suspend fun emitTranslationResult(result: StreamingTranslationResult) {
        // This would emit to the bridge in a real implementation
        Log.d(TAG, "Translation result: ${result.id} (${result.translatedText.take(30)}...) partial: ${result.isPartial}, progress: ${result.progress}")
    }
    
    private suspend fun emitTranslationError(requestId: String, error: String) {
        Log.e(TAG, "Translation error for $requestId: $error")
    }
    
    private suspend fun emitBatchUpdate(update: TranslationBatchUpdate) {
        Log.d(TAG, "Batch update: ${update.batchId} (${update.completed}/${update.total})")
    }
    
    /**
     * Synchronous translation method for simple use cases
     */
    suspend fun translateText(request: StreamingTranslationRequest): StreamingTranslationResult {
        val startTime = System.currentTimeMillis()
        
        // Check cache first
        val cacheKey = generateCacheKey(request.text, request.sourceLanguage, request.targetLanguage)
        val cached = translationCache[cacheKey]
        
        if (cached != null) {
            Log.d(TAG, "Using cached translation for: ${request.id}")
            return cached.copy(
                id = request.id,
                processingTimeMs = System.currentTimeMillis() - startTime
            )
        }
        
        // Perform translation
        val result = translateWithBackendAPI(request, startTime)
        
        // Cache the result
        if (translationCache.size < CACHE_SIZE) {
            translationCache[cacheKey] = result
        }
        
        return result
    }
    
    /**
     * Cleanup resources
     */
    fun cleanup() {
        coroutineScope.cancel()
        translationCache.clear()
        pendingRequests.clear()
        activeTranslations.values.forEach { it.cancel() }
        activeTranslations.clear()
        
        Log.d(TAG, "StreamingTranslationService cleaned up")
    }
}