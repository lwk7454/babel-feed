package com.babelfeed.app.translation.core

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.delay
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import javax.inject.Inject
import javax.inject.Singleton
import java.io.IOException

/**
 * Translation strategy that uses the backend ElysiaJS API for assisted translation
 * The backend handles model selection based on complexity parameter
 */
@Singleton
class AssistedTranslationStrategy @Inject constructor(
    private val httpClient: OkHttpClient,
    private val backendConfig: BackendConfig
) : TranslationStrategy {

    companion object {
        private const val TAG = "AssistedTranslation"
        private const val CONTENT_TYPE_JSON = "application/json"
        private const val REQUEST_TIMEOUT_MS = 30000L
    }

    override val priority: Int = 50 // Lower priority than local models
    override val modelType: ModelType = ModelType.ASSISTED_TRANSLATION_BACKEND
    override val name: String = "Assisted Translation (Backend)"

    override fun canHandle(request: TranslationRequest): Boolean {
        // Can handle any request if backend is available
        return isBackendReachable()
    }

    override suspend fun isAvailable(): Boolean {
        return isBackendReachable()
    }

    override suspend fun translate(request: TranslationRequest): Flow<TranslationResult> = flow {
        Log.d(TAG, "Starting assisted translation: ${request.fromLanguage} -> ${request.toLanguage}")
        
        val startTime = System.currentTimeMillis()
        
        try {
            // Create backend translation request
            val backendRequest = BackendTranslationRequest(
                content = request.content,
                fromLanguage = request.fromLanguage,
                toLanguage = request.toLanguage,
                complexity = request.complexity.name.lowercase(),
                contentType = request.contentType.name.lowercase(),
                priority = request.priority.name.lowercase(),
                context = request.context?.let { context ->
                    BackendTranslationContext(
                        sourceUrl = context.sourceUrl,
                        pageTitle = context.pageTitle,
                        articleTopic = context.articleTopic,
                        culturalContext = context.culturalContext,
                        domainSpecific = context.domainSpecific
                    )
                },
                streaming = false, // Simple HTTP request for now
                requestId = request.requestId
            )

            // Make HTTP request to backend
            val result = makeBackendRequest(backendRequest)
            val processingTime = System.currentTimeMillis() - startTime
            
            val translationResult = TranslationResult(
                requestId = request.requestId,
                originalContent = request.content,
                translatedContent = result.translatedContent,
                fromLanguage = request.fromLanguage,
                toLanguage = request.toLanguage,
                confidence = result.confidence,
                modelUsed = ModelType.ASSISTED_TRANSLATION_BACKEND,
                processingTimeMs = processingTime,
                isComplete = true,
                isPartial = false,
                metadata = TranslationMetadata(
                    tokensUsed = result.tokensUsed,
                    cacheHit = result.cacheHit,
                    fallbackUsed = false,
                    qualityScore = result.qualityScore,
                    additionalInfo = mapOf(
                        "backend_model" to result.modelUsed,
                        "backend_version" to result.backendVersion,
                        "processing_time_backend" to result.backendProcessingTime.toString()
                    )
                )
            )
            
            emit(translationResult)
            
        } catch (e: Exception) {
            Log.e(TAG, "Assisted translation failed", e)
            
            // Emit error result
            emit(TranslationResult(
                requestId = request.requestId,
                originalContent = request.content,
                translatedContent = request.content, // Fallback to original
                fromLanguage = request.fromLanguage,
                toLanguage = request.toLanguage,
                confidence = 0.0f,
                modelUsed = ModelType.ASSISTED_TRANSLATION_BACKEND,
                processingTimeMs = System.currentTimeMillis() - startTime,
                isComplete = true,
                isPartial = false,
                metadata = TranslationMetadata(
                    fallbackUsed = true,
                    additionalInfo = mapOf(
                        "error" to (e.message ?: "Unknown error"),
                        "error_type" to e.javaClass.simpleName
                    )
                )
            ))
        }
    }.catch { e ->
        Log.e(TAG, "Flow error in assisted translation", e)
    }

    private suspend fun makeBackendRequest(request: BackendTranslationRequest): BackendTranslationResponse {
        val json = Json { ignoreUnknownKeys = true }
        val requestBody = json.encodeToString(request).toRequestBody(CONTENT_TYPE_JSON.toMediaType())
        
        val httpRequest = Request.Builder()
            .url("${backendConfig.baseUrl}/api/translation")
            .post(requestBody)
            .addHeader("Content-Type", CONTENT_TYPE_JSON)
            .build()

        val response = httpClient.newCall(httpRequest).execute()
        
        if (!response.isSuccessful) {
            throw IOException("Backend request failed: ${response.code}")
        }
        
        val responseBody = response.body?.string() ?: throw IOException("Empty response body")
        return json.decodeFromString<BackendTranslationResponse>(responseBody)
    }

    private fun isBackendReachable(): Boolean {
        // TODO: Implement actual health check
        // For now, assume backend is reachable if config is valid
        return backendConfig.baseUrl.isNotBlank()
    }

    override suspend fun cleanup() {
        // Nothing to cleanup for HTTP client
        Log.d(TAG, "Cleaned up assisted translation strategy")
    }
}

/**
 * Backend configuration for assisted translation
 */
@Serializable
data class BackendConfig(
    val baseUrl: String,
    val apiKey: String? = null,
    val timeout: Long = 30000L,
    val retryAttempts: Int = 3
) {
    companion object {
        fun development(): BackendConfig {
            return BackendConfig(
                baseUrl = "http://localhost:3000", // ElysiaJS default port
                timeout = 30000L
            )
        }
        
        fun production(): BackendConfig {
            return BackendConfig(
                baseUrl = "https://api.babelfeed.com", // Replace with actual production URL
                timeout = 15000L
            )
        }
    }
}

/**
 * Request format for backend translation API
 */
@Serializable
data class BackendTranslationRequest(
    val content: String,
    val fromLanguage: String,
    val toLanguage: String,
    val complexity: String, // "simple", "contextual", "creative", "technical"
    val contentType: String, // "template_element", "article_content", etc.
    val priority: String, // "urgent", "high", "normal", "low", "background"
    val context: BackendTranslationContext? = null,
    val streaming: Boolean = false,
    val requestId: String
)

/**
 * Context information for backend translation
 */
@Serializable
data class BackendTranslationContext(
    val sourceUrl: String? = null,
    val pageTitle: String? = null,
    val articleTopic: String? = null,
    val culturalContext: String? = null,
    val domainSpecific: String? = null
)

/**
 * Response from backend translation API
 */
@Serializable
data class BackendTranslationResponse(
    val requestId: String,
    val translatedContent: String,
    val confidence: Float,
    val tokensUsed: Int = 0,
    val cacheHit: Boolean = false,
    val qualityScore: Float = 0.0f,
    val modelUsed: String = "unknown",
    val backendVersion: String = "1.0.0",
    val backendProcessingTime: Long = 0L
)

/**
 * Factory for creating assisted translation strategy
 */
object AssistedTranslationFactory {
    fun create(
        httpClient: OkHttpClient = createDefaultHttpClient(),
        isDevelopment: Boolean = true
    ): AssistedTranslationStrategy {
        val config = if (isDevelopment) {
            BackendConfig.development()
        } else {
            BackendConfig.production()
        }
        
        return AssistedTranslationStrategy(httpClient, config)
    }
    
    private fun createDefaultHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .writeTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .build()
    }
}