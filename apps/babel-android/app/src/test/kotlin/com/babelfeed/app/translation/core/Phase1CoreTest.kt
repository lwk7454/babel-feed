package com.babelfeed.app.translation.core

import org.junit.Test
import org.junit.Assert.*

/**
 * Phase 1.1 Core Translation Architecture Tests
 * Basic tests to verify all interfaces and data classes work correctly
 */
class Phase1CoreTest {

    @Test
    fun translationRequest_canBeCreated() {
        val request = TranslationRequest(
            content = "Hello world",
            fromLanguage = "en",
            toLanguage = "zh-CN",
            contentType = ContentType.RAW_TEXT,
            complexity = ComplexityLevel.SIMPLE,
            priority = TranslationPriority.NORMAL,
            context = TranslationContext(pageTitle = "Test Page")
        )

        assertEquals("Hello world", request.content)
        assertEquals("en", request.fromLanguage)
        assertEquals("zh-CN", request.toLanguage)
        assertEquals(ContentType.RAW_TEXT, request.contentType)
        assertEquals(ComplexityLevel.SIMPLE, request.complexity)
        assertEquals(TranslationPriority.NORMAL, request.priority)
        assertEquals("Test Page", request.context?.pageTitle)
        assertNotNull(request.requestId)
    }

    @Test
    fun translationResult_canBeCreated() {
        val result = TranslationResult(
            requestId = "test_123",
            originalContent = "Hello",
            translatedContent = "你好",
            fromLanguage = "en",
            toLanguage = "zh-CN",
            confidence = 0.95f,
            modelUsed = ModelType.ML_KIT_ON_DEVICE,
            processingTimeMs = 150L,
            isComplete = true
        )

        assertEquals("test_123", result.requestId)
        assertEquals("Hello", result.originalContent)
        assertEquals("你好", result.translatedContent)
        assertEquals("en", result.fromLanguage)
        assertEquals("zh-CN", result.toLanguage)
        assertEquals(0.95f, result.confidence, 0.01f)
        assertEquals(ModelType.ML_KIT_ON_DEVICE, result.modelUsed)
        assertEquals(150L, result.processingTimeMs)
        assertTrue(result.isComplete)
        assertTrue(result.isPartial != result.isComplete)
    }

    @Test
    fun contentSegment_canBeCreated() {
        val segment = ContentSegment(
            id = "seg_1",
            html = "<p>Test content</p>",
            extractedText = "Test content",
            type = ContentType.ARTICLE_CONTENT,
            complexity = ComplexityLevel.SIMPLE,
            priority = TranslationPriority.NORMAL,
            selector = "p",
            estimatedTokens = 2
        )

        assertEquals("seg_1", segment.id)
        assertEquals("<p>Test content</p>", segment.html)
        assertEquals("Test content", segment.extractedText)
        assertEquals(ContentType.ARTICLE_CONTENT, segment.type)
        assertEquals(ComplexityLevel.SIMPLE, segment.complexity)
        assertEquals(TranslationPriority.NORMAL, segment.priority)
        assertEquals("p", segment.selector)
        assertEquals(2, segment.estimatedTokens)
    }

    @Test
    fun contentSegment_toTranslationRequest_works() {
        val segment = ContentSegment(
            id = "seg_1",
            html = "<h1>Title</h1>",
            extractedText = "Title",
            type = ContentType.ARTICLE_CONTENT,
            complexity = ComplexityLevel.SIMPLE,
            priority = TranslationPriority.HIGH,
            selector = "h1",
            estimatedTokens = 1
        )

        val request = segment.toTranslationRequest("en", "zh-CN")

        assertEquals("Title", request.content)
        assertEquals("en", request.fromLanguage)
        assertEquals("zh-CN", request.toLanguage)
        assertEquals(ContentType.ARTICLE_CONTENT, request.contentType)
        assertEquals(ComplexityLevel.SIMPLE, request.complexity)
        assertEquals(TranslationPriority.HIGH, request.priority)
        assertTrue(request.requestId.contains("seg_1"))
    }

    @Test
    fun contentAnalysis_canBeCreated() {
        val segments = listOf(
            ContentSegment(
                id = "seg_1",
                html = "<p>Test</p>",
                extractedText = "Test",
                type = ContentType.ARTICLE_CONTENT,
                complexity = ComplexityLevel.SIMPLE,
                priority = TranslationPriority.NORMAL,
                estimatedTokens = 1
            )
        )

        val analysis = ContentAnalysis(
            segments = segments,
            overallComplexity = ComplexityLevel.SIMPLE,
            estimatedTokens = 1,
            detectedLanguage = "en",
            context = TranslationContext(pageTitle = "Test"),
            metadata = ContentAnalysisMetadata(
                processingTimeMs = 100,
                totalElements = 1,
                textElements = 1
            )
        )

        assertEquals(1, analysis.segments.size)
        assertEquals(ComplexityLevel.SIMPLE, analysis.overallComplexity)
        assertEquals(1, analysis.estimatedTokens)
        assertEquals("en", analysis.detectedLanguage)
        assertEquals("Test", analysis.context.pageTitle)
        assertEquals(100L, analysis.metadata.processingTimeMs)
    }

    @Test
    fun modelTypes_allExist() {
        val types = ModelType.values()
        assertTrue(types.contains(ModelType.ML_KIT_ON_DEVICE))
        assertTrue(types.contains(ModelType.GEMINI_NANO))
        assertTrue(types.contains(ModelType.ASSISTED_TRANSLATION_BACKEND))
        assertTrue(types.contains(ModelType.CUSTOM_ON_DEVICE))
        assertTrue(types.contains(ModelType.MOCK_FOR_TESTING))
    }

    @Test
    fun contentTypes_allExist() {
        val types = ContentType.values()
        assertTrue(types.contains(ContentType.TEMPLATE_ELEMENT))
        assertTrue(types.contains(ContentType.ARTICLE_CONTENT))
        assertTrue(types.contains(ContentType.MIXED_CONTENT))
        assertTrue(types.contains(ContentType.MEDIA_CAPTIONS))
        assertTrue(types.contains(ContentType.INTERACTIVE_ELEMENT))
        assertTrue(types.contains(ContentType.RAW_TEXT))
    }

    @Test
    fun complexityLevels_allExist() {
        val levels = ComplexityLevel.values()
        assertTrue(levels.contains(ComplexityLevel.SIMPLE))
        assertTrue(levels.contains(ComplexityLevel.CONTEXTUAL))
        assertTrue(levels.contains(ComplexityLevel.CREATIVE))
        assertTrue(levels.contains(ComplexityLevel.TECHNICAL))
    }

    @Test
    fun translationPriorities_allExist() {
        val priorities = TranslationPriority.values()
        assertTrue(priorities.contains(TranslationPriority.URGENT))
        assertTrue(priorities.contains(TranslationPriority.HIGH))
        assertTrue(priorities.contains(TranslationPriority.NORMAL))
        assertTrue(priorities.contains(TranslationPriority.LOW))
        assertTrue(priorities.contains(TranslationPriority.BACKGROUND))
    }

    @Test
    fun translationContext_canBeCreated() {
        val context = TranslationContext(
            sourceUrl = "https://example.com",
            pageTitle = "Test Page",
            articleTopic = "Technology",
            culturalContext = "Western",
            domainSpecific = "Software"
        )

        assertEquals("https://example.com", context.sourceUrl)
        assertEquals("Test Page", context.pageTitle)
        assertEquals("Technology", context.articleTopic)
        assertEquals("Western", context.culturalContext)
        assertEquals("Software", context.domainSpecific)
    }

    @Test
    fun userTranslationPreferences_hasDefaults() {
        val preferences = UserTranslationPreferences()

        assertEquals(TranslationStyle.NATURAL, preferences.preferredStyle)
        assertTrue(preferences.culturalAdaptation)
        assertTrue(preferences.preserveTechnicalTerms)
    }

    @Test
    fun translationStyles_allExist() {
        val styles = TranslationStyle.values()
        assertTrue(styles.contains(TranslationStyle.LITERAL))
        assertTrue(styles.contains(TranslationStyle.NATURAL))
        assertTrue(styles.contains(TranslationStyle.FORMAL))
        assertTrue(styles.contains(TranslationStyle.CASUAL))
    }

    @Test
    fun translationMetadata_hasDefaults() {
        val metadata = TranslationMetadata()

        assertEquals(0, metadata.tokensUsed)
        assertFalse(metadata.cacheHit)
        assertFalse(metadata.fallbackUsed)
        assertEquals(0f, metadata.qualityScore, 0.01f)
        assertTrue(metadata.additionalInfo.isEmpty())
    }

    @Test
    fun deviceCapability_canBeCreated() {
        val capability = DeviceCapability(
            availableMemoryMB = 4096,
            cpuCores = 8,
            hasNPU = true,
            thermalState = ThermalState.OPTIMAL,
            batteryLevel = 0.85f,
            isCharging = false,
            networkQuality = NetworkQuality.EXCELLENT,
            mlKitSupported = true,
            geminiNanoSupported = true,
            deviceScore = 0.9f
        )

        assertEquals(4096L, capability.availableMemoryMB)
        assertEquals(8, capability.cpuCores)
        assertTrue(capability.hasNPU)
        assertEquals(ThermalState.OPTIMAL, capability.thermalState)
        assertEquals(0.85f, capability.batteryLevel, 0.01f)
        assertFalse(capability.isCharging)
        assertEquals(NetworkQuality.EXCELLENT, capability.networkQuality)
        assertTrue(capability.mlKitSupported)
        assertTrue(capability.geminiNanoSupported)
        assertEquals(0.9f, capability.deviceScore, 0.01f)
    }

    @Test
    fun thermalStates_allExist() {
        val states = ThermalState.values()
        assertTrue(states.contains(ThermalState.OPTIMAL))
        assertTrue(states.contains(ThermalState.MODERATE))
        assertTrue(states.contains(ThermalState.THROTTLED))
        assertTrue(states.contains(ThermalState.SEVERE))
    }

    @Test
    fun networkQualities_allExist() {
        val qualities = NetworkQuality.values()
        assertTrue(qualities.contains(NetworkQuality.EXCELLENT))
        assertTrue(qualities.contains(NetworkQuality.GOOD))
        assertTrue(qualities.contains(NetworkQuality.POOR))
        assertTrue(qualities.contains(NetworkQuality.OFFLINE))
    }

    @Test
    fun translationOptions_hasDefaults() {
        val options = TranslationOptions()

        assertEquals(TranslationPriority.NORMAL, options.priority)
        assertEquals(5000L, options.maxLatencyMs)
        assertEquals(0.7f, options.minQualityScore, 0.01f)
        assertTrue(options.preferOnDevice)
        assertTrue(options.preserveFormatting)
        assertNull(options.context)
        assertNull(options.customSelectionCriteria)
    }

    @Test
    fun translationErrors_allExist() {
        val errors = TranslationError.values()
        assertTrue(errors.contains(TranslationError.NoStrategyAvailable))
        assertTrue(errors.contains(TranslationError.UnsupportedLanguagePair))
        assertTrue(errors.contains(TranslationError.ContentTooLarge))
        assertTrue(errors.contains(TranslationError.NetworkError))
        assertTrue(errors.contains(TranslationError.RateLimitExceeded))
        assertTrue(errors.contains(TranslationError.TranslationFailed))
        assertTrue(errors.contains(TranslationError.QualityTooLow))
        assertTrue(errors.contains(TranslationError.Cancelled))
    }

    @Test
    fun htmlTranslationMetadata_canBeCreated() {
        val metadata = HtmlTranslationMetadata(
            segmentsTranslated = 5,
            totalProcessingTimeMs = 1000L,
            modelsUsed = setOf(ModelType.ML_KIT_ON_DEVICE, ModelType.GEMINI_NANO),
            cacheHits = 2,
            fallbacksUsed = 1
        )

        assertEquals(5, metadata.segmentsTranslated)
        assertEquals(1000L, metadata.totalProcessingTimeMs)
        assertEquals(2, metadata.modelsUsed.size)
        assertTrue(metadata.modelsUsed.contains(ModelType.ML_KIT_ON_DEVICE))
        assertTrue(metadata.modelsUsed.contains(ModelType.GEMINI_NANO))
        assertEquals(2, metadata.cacheHits)
        assertEquals(1, metadata.fallbacksUsed)
    }

    @Test
    fun translatedSegment_canBeCreated() {
        val translationResult = TranslationResult(
            requestId = "req_1",
            originalContent = "Hello",
            translatedContent = "你好",
            fromLanguage = "en",
            toLanguage = "zh-CN",
            confidence = 0.9f,
            modelUsed = ModelType.ML_KIT_ON_DEVICE,
            processingTimeMs = 100L,
            isComplete = true
        )

        val segment = TranslatedSegment(
            segmentId = "seg_1",
            originalHtml = "<p>Hello</p>",
            translatedHtml = "<p>你好</p>",
            selector = "p",
            result = translationResult
        )

        assertEquals("seg_1", segment.segmentId)
        assertEquals("<p>Hello</p>", segment.originalHtml)
        assertEquals("<p>你好</p>", segment.translatedHtml)
        assertEquals("p", segment.selector)
        assertEquals("req_1", segment.result.requestId)
        assertEquals("你好", segment.result.translatedContent)
    }
}