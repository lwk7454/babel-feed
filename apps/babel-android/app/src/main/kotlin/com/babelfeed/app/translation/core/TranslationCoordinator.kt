package com.babelfeed.app.translation.core

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.onCompletion
import android.util.Log
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Main coordinator for translation operations
 * Orchestrates content analysis, model selection, and translation execution
 */
interface TranslationCoordinator {
    /**
     * Translate HTML content using the optimal strategy
     * @param html The HTML content to translate
     * @param fromLanguage Source language code
     * @param toLanguage Target language code
     * @param options Additional translation options
     * @return Flow of translation results
     */
    suspend fun translateHtml(
        html: String,
        fromLanguage: String,
        toLanguage: String,
        options: TranslationOptions = TranslationOptions()
    ): Flow<HtmlTranslationResult>
    
    /**
     * Translate simple text content
     * @param text The text to translate
     * @param fromLanguage Source language code
     * @param toLanguage Target language code
     * @param options Additional translation options
     * @return Flow of translation results
     */
    suspend fun translateText(
        text: String,
        fromLanguage: String,
        toLanguage: String,
        options: TranslationOptions = TranslationOptions()
    ): Flow<TranslationResult>
    
    /**
     * Get available language pairs for translation
     * @return Set of supported language pairs
     */
    suspend fun getSupportedLanguagePairs(): Set<Pair<String, String>>
    
    /**
     * Check if a language pair is supported
     * @param fromLanguage Source language
     * @param toLanguage Target language
     * @return true if the pair is supported
     */
    suspend fun isLanguagePairSupported(fromLanguage: String, toLanguage: String): Boolean
    
    /**
     * Get translation statistics and performance metrics
     * @return Current translation statistics
     */
    fun getTranslationStatistics(): TranslationStatistics
    
    /**
     * Cancel an ongoing translation
     * @param requestId The ID of the translation to cancel
     * @return true if successfully cancelled
     */
    suspend fun cancelTranslation(requestId: String): Boolean
    
    /**
     * Cleanup resources and shutdown coordinator
     */
    suspend fun shutdown()
}

/**
 * Default implementation of TranslationCoordinator
 */
@Singleton
class DefaultTranslationCoordinator @Inject constructor(
    private val modelRegistry: ModelRegistry,
    private val contentAnalyzer: ContentAnalyzer,
    private val modelSelector: ModelSelector,
    private val channelSelector: ChannelSelector,
    private val featureFlags: FeatureFlags
) : TranslationCoordinator {
    
    companion object {
        private const val TAG = "TranslationCoordinator"
    }
    
    private val activeTranslations = mutableMapOf<String, TranslationRequest>()
    private val statistics = DefaultTranslationStatistics()
    
    override suspend fun translateHtml(
        html: String,
        fromLanguage: String,
        toLanguage: String,
        options: TranslationOptions
    ): Flow<HtmlTranslationResult> = flow {
        if (featureFlags.isDebugLoggingEnabled()) {
            Log.d(TAG, "Starting HTML translation: $fromLanguage -> $toLanguage")
        }
        
        // Analyze content
        val analysis = contentAnalyzer.analyzeContent(html)
        
        emit(HtmlTranslationResult.Progress(
            requestId = "html_${System.currentTimeMillis()}",
            progress = 0.1f,
            message = "Content analyzed: ${analysis.segments.size} segments"
        ))
        
        // Translate each segment
        val translatedSegments = mutableListOf<TranslatedSegment>()
        val totalSegments = analysis.segments.size
        
        analysis.segments.forEachIndexed { index, segment ->
            try {
                val request = segment.toTranslationRequest(
                    fromLanguage = analysis.detectedLanguage.takeIf { it.isNotBlank() } ?: fromLanguage,
                    toLanguage = toLanguage,
                    context = analysis.context
                )
                
                // Select translation channel based on priority and device capabilities
                val deviceCapability = modelSelector.assessDeviceCapabilities()
                val systemLoad = getCurrentSystemLoad()
                val selectedChannel = channelSelector.selectChannel(
                    priority = segment.priority,
                    deviceCapability = deviceCapability,
                    systemLoad = systemLoad
                )
                
                // Get best strategy for this segment within the selected channel
                val strategy = modelSelector.selectStrategyByChannel(
                    channel = selectedChannel,
                    complexity = segment.complexity,
                    availableStrategies = modelRegistry.getAllStrategies()
                ) ?: modelSelector.selectOptimalStrategy(
                    segment = segment,
                    availableStrategies = modelRegistry.getAllStrategies()
                )
                
                if (strategy == null) {
                    Log.w(TAG, "No strategy available for segment ${segment.id}")
                    emit(HtmlTranslationResult.Error(
                        requestId = request.requestId,
                        error = TranslationError.NoStrategyAvailable,
                        message = "No translation strategy available for segment"
                    ))
                    return@forEachIndexed
                }
                
                // Track active translation
                activeTranslations[request.requestId] = request
                
                // Execute translation
                strategy.translate(request).collect { result ->
                    if (result.isComplete) {
                        translatedSegments.add(TranslatedSegment(
                            segmentId = segment.id,
                            originalHtml = segment.html,
                            translatedHtml = reconstructHtml(segment, result.translatedContent),
                            selector = segment.selector,
                            result = result
                        ))
                        
                        activeTranslations.remove(request.requestId)
                        statistics.recordTranslation(result)
                        
                        val progress = (index + 1).toFloat() / totalSegments
                        emit(HtmlTranslationResult.Progress(
                            requestId = request.requestId,
                            progress = progress,
                            message = "Translated segment ${index + 1}/$totalSegments"
                        ))
                    }
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error translating segment ${segment.id}", e)
                emit(HtmlTranslationResult.Error(
                    requestId = segment.id,
                    error = TranslationError.TranslationFailed,
                    message = e.message ?: "Unknown error"
                ))
            }
        }
        
        // Emit final result
        if (translatedSegments.size == totalSegments) {
            val finalHtml = reconstructFullHtml(html, translatedSegments)
            emit(HtmlTranslationResult.Success(
                requestId = "html_final",
                originalHtml = html,
                translatedHtml = finalHtml,
                segments = translatedSegments,
                metadata = HtmlTranslationMetadata(
                    segmentsTranslated = translatedSegments.size,
                    totalProcessingTimeMs = translatedSegments.sumOf { it.result.processingTimeMs },
                    modelsUsed = translatedSegments.map { it.result.modelUsed }.toSet()
                )
            ))
        }
        
    }.catch { exception ->
        Log.e(TAG, "HTML translation failed", exception)
        emit(HtmlTranslationResult.Error(
            requestId = "html_error",
            error = TranslationError.TranslationFailed,
            message = exception.message ?: "Translation failed"
        ))
    }
    
    override suspend fun translateText(
        text: String,
        fromLanguage: String,
        toLanguage: String,
        options: TranslationOptions
    ): Flow<TranslationResult> = flow {
        val request = TranslationRequest(
            content = text,
            fromLanguage = fromLanguage,
            toLanguage = toLanguage,
            contentType = ContentType.RAW_TEXT,
            complexity = contentAnalyzer.assessComplexity(text),
            priority = options.priority,
            context = options.context
        )
        
        val compatibleStrategies = modelRegistry.getCompatibleStrategies(request)
        val strategy = compatibleStrategies.firstOrNull()
        
        if (strategy == null) {
            Log.w(TAG, "No strategy available for text translation")
            return@flow
        }
        
        activeTranslations[request.requestId] = request
        
        strategy.translate(request).collect { result ->
            emit(result)
            if (result.isComplete) {
                activeTranslations.remove(request.requestId)
                statistics.recordTranslation(result)
            }
        }
    }.catch { exception ->
        Log.e(TAG, "Text translation failed", exception)
    }
    
    override suspend fun getSupportedLanguagePairs(): Set<Pair<String, String>> {
        val allPairs = mutableSetOf<Pair<String, String>>()
        modelRegistry.getAllStrategies().forEach { strategy ->
            val capabilities = modelSelector.getModelCapabilities(strategy)
            allPairs.addAll(capabilities.supportedLanguagePairs)
        }
        return allPairs
    }
    
    override suspend fun isLanguagePairSupported(fromLanguage: String, toLanguage: String): Boolean {
        return getSupportedLanguagePairs().contains(fromLanguage to toLanguage)
    }
    
    override fun getTranslationStatistics(): TranslationStatistics {
        return statistics
    }
    
    override suspend fun cancelTranslation(requestId: String): Boolean {
        return activeTranslations.remove(requestId) != null
    }
    
    override suspend fun shutdown() {
        activeTranslations.clear()
        modelRegistry.getAllStrategies().forEach { strategy ->
            try {
                strategy.cleanup()
            } catch (e: Exception) {
                Log.e(TAG, "Error cleaning up strategy ${strategy.name}", e)
            }
        }
    }
    
    private fun reconstructHtml(segment: ContentSegment, translatedText: String): String {
        // Replace the text content in the original HTML while preserving structure
        return segment.html.replace(segment.extractedText, translatedText)
    }
    
    private fun reconstructFullHtml(originalHtml: String, segments: List<TranslatedSegment>): String {
        var result = originalHtml
        segments.forEach { segment ->
            result = result.replace(segment.originalHtml, segment.translatedHtml)
        }
        return result
    }
    
    private fun getCurrentSystemLoad(): SystemLoad {
        return SystemLoad(
            activeTranslations = activeTranslations.size,
            pendingRequests = 0, // TODO: Track pending requests
            cpuUsage = 0.5f, // TODO: Get actual CPU usage
            memoryUsage = 0.6f, // TODO: Get actual memory usage
            thermalPressure = 0.3f // TODO: Get actual thermal pressure
        )
    }
}

/**
 * Options for customizing translation behavior
 */
data class TranslationOptions(
    val priority: TranslationPriority = TranslationPriority.NORMAL,
    val maxLatencyMs: Long = 5000,
    val minQualityScore: Float = 0.7f,
    val preferOnDevice: Boolean = true,
    val preserveFormatting: Boolean = true,
    val context: TranslationContext? = null,
    val customSelectionCriteria: SelectionCriteria? = null
)

/**
 * Results for HTML translation operations
 */
sealed class HtmlTranslationResult {
    data class Progress(
        val requestId: String,
        val progress: Float, // 0.0 to 1.0
        val message: String
    ) : HtmlTranslationResult()
    
    data class Success(
        val requestId: String,
        val originalHtml: String,
        val translatedHtml: String,
        val segments: List<TranslatedSegment>,
        val metadata: HtmlTranslationMetadata
    ) : HtmlTranslationResult()
    
    data class Error(
        val requestId: String,
        val error: TranslationError,
        val message: String
    ) : HtmlTranslationResult()
}

/**
 * A translated segment of HTML content
 */
data class TranslatedSegment(
    val segmentId: String,
    val originalHtml: String,
    val translatedHtml: String,
    val selector: String?,
    val result: TranslationResult
)

/**
 * Metadata for HTML translation results
 */
data class HtmlTranslationMetadata(
    val segmentsTranslated: Int,
    val totalProcessingTimeMs: Long,
    val modelsUsed: Set<ModelType>,
    val cacheHits: Int = 0,
    val fallbacksUsed: Int = 0
)

/**
 * Translation error types
 */
enum class TranslationError {
    NoStrategyAvailable,
    UnsupportedLanguagePair,
    ContentTooLarge,
    NetworkError,
    RateLimitExceeded,
    TranslationFailed,
    QualityTooLow,
    Cancelled
}

/**
 * Translation statistics tracking
 */
interface TranslationStatistics {
    val totalTranslations: Long
    val successfulTranslations: Long
    val failedTranslations: Long
    val averageLatencyMs: Double
    val modelUsageStats: Map<ModelType, Long>
    val languagePairStats: Map<Pair<String, String>, Long>
    
    fun recordTranslation(result: TranslationResult)
    fun reset()
}

/**
 * Default implementation of TranslationStatistics
 */
class DefaultTranslationStatistics : TranslationStatistics {
    private var _totalTranslations = 0L
    private var _successfulTranslations = 0L
    private var _failedTranslations = 0L
    private var _totalLatencyMs = 0L
    private val _modelUsageStats = mutableMapOf<ModelType, Long>()
    private val _languagePairStats = mutableMapOf<Pair<String, String>, Long>()
    
    override val totalTranslations: Long get() = _totalTranslations
    override val successfulTranslations: Long get() = _successfulTranslations
    override val failedTranslations: Long get() = _failedTranslations
    override val averageLatencyMs: Double get() = 
        if (_successfulTranslations > 0) _totalLatencyMs.toDouble() / _successfulTranslations else 0.0
    override val modelUsageStats: Map<ModelType, Long> get() = _modelUsageStats.toMap()
    override val languagePairStats: Map<Pair<String, String>, Long> get() = _languagePairStats.toMap()
    
    override fun recordTranslation(result: TranslationResult) {
        _totalTranslations++
        if (result.confidence > 0.5f) { // Consider successful if confidence > 50%
            _successfulTranslations++
            _totalLatencyMs += result.processingTimeMs
        } else {
            _failedTranslations++
        }
        
        _modelUsageStats[result.modelUsed] = _modelUsageStats.getOrDefault(result.modelUsed, 0) + 1
        val languagePair = result.fromLanguage to result.toLanguage
        _languagePairStats[languagePair] = _languagePairStats.getOrDefault(languagePair, 0) + 1
    }
    
    override fun reset() {
        _totalTranslations = 0
        _successfulTranslations = 0
        _failedTranslations = 0
        _totalLatencyMs = 0
        _modelUsageStats.clear()
        _languagePairStats.clear()
    }
}