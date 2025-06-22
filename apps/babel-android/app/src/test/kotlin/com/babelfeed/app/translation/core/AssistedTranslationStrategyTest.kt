package com.babelfeed.app.translation.core

import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before
import okhttp3.OkHttpClient
import kotlinx.serialization.json.Json
import java.util.concurrent.TimeUnit

/**
 * Unit tests for AssistedTranslationStrategy (simplified without MockWebServer)
 */
class AssistedTranslationStrategyTest {

    private lateinit var httpClient: OkHttpClient
    private lateinit var backendConfig: BackendConfig
    private lateinit var assistedTranslationStrategy: AssistedTranslationStrategy

    @Before
    fun setup() {
        httpClient = OkHttpClient.Builder()
            .connectTimeout(1, TimeUnit.SECONDS)
            .readTimeout(1, TimeUnit.SECONDS)
            .writeTimeout(1, TimeUnit.SECONDS)
            .build()
            
        backendConfig = BackendConfig(
            baseUrl = "http://localhost:3000",
            timeout = 1000L
        )
        
        assistedTranslationStrategy = AssistedTranslationStrategy(httpClient, backendConfig)
    }

    @Test
    fun modelType_isCorrect() {
        assertEquals(ModelType.ASSISTED_TRANSLATION_BACKEND, assistedTranslationStrategy.modelType)
    }

    @Test
    fun name_isCorrect() {
        assertEquals("Assisted Translation (Backend)", assistedTranslationStrategy.name)
    }

    @Test
    fun priority_isLowerThanLocal() {
        assertEquals(50, assistedTranslationStrategy.priority)
        // Ensure it's lower priority than typical local models (which would be 100+)
        assertTrue(assistedTranslationStrategy.priority < 100)
    }

    @Test
    fun canHandle_withValidConfig_returnsTrue() {
        val request = createSampleTranslationRequest()
        assertTrue(assistedTranslationStrategy.canHandle(request))
    }

    @Test
    fun canHandle_withEmptyConfig_returnsFalse() {
        val emptyConfig = BackendConfig(baseUrl = "")
        val strategy = AssistedTranslationStrategy(httpClient, emptyConfig)
        val request = createSampleTranslationRequest()
        
        assertFalse(strategy.canHandle(request))
    }

    @Test
    fun isAvailable_withValidConfig_returnsTrue() = runTest {
        assertTrue(assistedTranslationStrategy.isAvailable())
    }

    @Test
    fun translate_withUnreachableBackend_returnsErrorResult() = runTest {
        // Use an unreachable URL to simulate network error
        val unreachableConfig = BackendConfig(baseUrl = "http://localhost:9999")
        val strategy = AssistedTranslationStrategy(httpClient, unreachableConfig)
        
        val request = createSampleTranslationRequest()
        val results = strategy.translate(request).toList()

        assertEquals(1, results.size)
        val result = results[0]
        assertEquals(request.content, result.translatedContent) // Fallback to original
        assertEquals(0.0f, result.confidence, 0.01f)
        assertTrue(result.metadata.fallbackUsed)
        assertTrue(result.metadata.additionalInfo.containsKey("error"))
    }

    @Test
    fun cleanup_executesWithoutError() = runTest {
        // Should not throw any exceptions
        assistedTranslationStrategy.cleanup()
    }

    @Test
    fun backendConfig_development_hasCorrectDefaults() {
        val config = BackendConfig.development()
        assertEquals("http://localhost:3000", config.baseUrl)
        assertEquals(30000L, config.timeout)
        assertNull(config.apiKey)
    }

    @Test
    fun backendConfig_production_hasCorrectDefaults() {
        val config = BackendConfig.production()
        assertEquals("https://api.babelfeed.com", config.baseUrl)
        assertEquals(15000L, config.timeout)
        assertNull(config.apiKey)
    }

    @Test
    fun assistedTranslationFactory_development_createsCorrectStrategy() {
        val strategy = AssistedTranslationFactory.create(isDevelopment = true)
        assertNotNull(strategy)
        assertEquals(ModelType.ASSISTED_TRANSLATION_BACKEND, strategy.modelType)
    }

    @Test
    fun assistedTranslationFactory_production_createsCorrectStrategy() {
        val strategy = AssistedTranslationFactory.create(isDevelopment = false)
        assertNotNull(strategy)
        assertEquals(ModelType.ASSISTED_TRANSLATION_BACKEND, strategy.modelType)
    }

    @Test
    fun backendTranslationRequest_serializationWorks() {
        val request = BackendTranslationRequest(
            content = "Hello world",
            fromLanguage = "en",
            toLanguage = "zh-CN",
            complexity = "simple",
            contentType = "raw_text",
            priority = "normal",
            context = BackendTranslationContext(
                sourceUrl = "https://example.com",
                pageTitle = "Test Page"
            ),
            streaming = false,
            requestId = "test_123"
        )

        val json = Json { ignoreUnknownKeys = true }
        val serialized = json.encodeToString(BackendTranslationRequest.serializer(), request)
        val deserialized = json.decodeFromString(BackendTranslationRequest.serializer(), serialized)

        assertEquals(request.content, deserialized.content)
        assertEquals(request.complexity, deserialized.complexity)
        assertEquals(request.context?.sourceUrl, deserialized.context?.sourceUrl)
    }

    @Test
    fun backendTranslationResponse_serializationWorks() {
        val response = BackendTranslationResponse(
            requestId = "test_123",
            translatedContent = "测试内容",
            confidence = 0.95f,
            tokensUsed = 15,
            cacheHit = false,
            qualityScore = 0.9f,
            modelUsed = "WizardLM-2-7B",
            backendVersion = "1.0.0",
            backendProcessingTime = 250L
        )

        val json = Json { ignoreUnknownKeys = true }
        val serialized = json.encodeToString(BackendTranslationResponse.serializer(), response)
        val deserialized = json.decodeFromString(BackendTranslationResponse.serializer(), serialized)

        assertEquals(response.requestId, deserialized.requestId)
        assertEquals(response.translatedContent, deserialized.translatedContent)
        assertEquals(response.confidence, deserialized.confidence, 0.01f)
        assertEquals(response.modelUsed, deserialized.modelUsed)
    }

    @Test
    fun translationRequest_copyExtension_works() {
        val original = createSampleTranslationRequest()
        val copied = original.copy(complexity = ComplexityLevel.TECHNICAL)
        
        assertEquals(ComplexityLevel.TECHNICAL, copied.complexity)
        assertEquals(original.content, copied.content)
        assertEquals(original.fromLanguage, copied.fromLanguage)
    }

    private fun createSampleTranslationRequest(): TranslationRequest {
        return TranslationRequest(
            content = "Hello, world!",
            fromLanguage = "en",
            toLanguage = "zh-CN",
            contentType = ContentType.RAW_TEXT,
            complexity = ComplexityLevel.SIMPLE,
            priority = TranslationPriority.NORMAL,
            context = TranslationContext(
                sourceUrl = "https://example.com",
                pageTitle = "Test Page"
            ),
            requestId = "test_123"
        )
    }

    private fun TranslationRequest.copy(
        content: String = this.content,
        fromLanguage: String = this.fromLanguage,
        toLanguage: String = this.toLanguage,
        contentType: ContentType = this.contentType,
        complexity: ComplexityLevel = this.complexity,
        priority: TranslationPriority = this.priority,
        context: TranslationContext? = this.context,
        requestId: String = this.requestId
    ): TranslationRequest {
        return TranslationRequest(
            content = content,
            fromLanguage = fromLanguage,
            toLanguage = toLanguage,
            contentType = contentType,
            complexity = complexity,
            priority = priority,
            context = context,
            requestId = requestId
        )
    }
}