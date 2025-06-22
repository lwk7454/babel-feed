package com.babelfeed.app.translation.core

import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before

/**
 * Unit tests for core translation data classes and enums
 */
class TranslationCoreTest {

    @Test
    fun translationRequest_creation_hasValidDefaults() {
        val request = TranslationRequest(
            content = "Hello world",
            fromLanguage = "en",
            toLanguage = "zh-CN",
            contentType = ContentType.RAW_TEXT,
            complexity = ComplexityLevel.SIMPLE,
            priority = TranslationPriority.NORMAL
        )
        
        assertNotNull(request.requestId)
        assertTrue(request.requestId.startsWith("tr_"))
        assertEquals("Hello world", request.content)
        assertEquals("en", request.fromLanguage)
        assertEquals("zh-CN", request.toLanguage)
        assertEquals(ContentType.RAW_TEXT, request.contentType)
        assertEquals(ComplexityLevel.SIMPLE, request.complexity)
        assertEquals(TranslationPriority.NORMAL, request.priority)
        assertNull(request.context)
    }

    @Test
    fun translationResult_creation_isValid() {
        val result = TranslationResult(
            requestId = "test_123",
            originalContent = "Hello",
            translatedContent = "你好",
            fromLanguage = "en",
            toLanguage = "zh-CN",
            confidence = 0.95f,
            modelUsed = ModelType.ML_KIT_ON_DEVICE,
            processingTimeMs = 150,
            isComplete = true
        )
        
        assertEquals("test_123", result.requestId)
        assertEquals("Hello", result.originalContent)
        assertEquals("你好", result.translatedContent)
        assertEquals("en", result.fromLanguage)
        assertEquals("zh-CN", result.toLanguage)
        assertEquals(0.95f, result.confidence, 0.001f)
        assertEquals(ModelType.ML_KIT_ON_DEVICE, result.modelUsed)
        assertEquals(150, result.processingTimeMs)
        assertTrue(result.isComplete)
        assertFalse(result.isPartial)
    }

    @Test
    fun contentSegment_toTranslationRequest_createsValidRequest() {
        val segment = ContentSegment(
            id = "seg_1",
            html = "<p>Hello world</p>",
            extractedText = "Hello world",
            type = ContentType.ARTICLE_CONTENT,
            complexity = ComplexityLevel.CONTEXTUAL,
            priority = TranslationPriority.HIGH,
            selector = "p",
            estimatedTokens = 2
        )
        
        val context = TranslationContext(sourceUrl = "https://example.com")
        val request = segment.toTranslationRequest("en", "zh-CN", context)
        
        assertEquals("Hello world", request.content)
        assertEquals("en", request.fromLanguage)
        assertEquals("zh-CN", request.toLanguage)
        assertEquals(ContentType.ARTICLE_CONTENT, request.contentType)
        assertEquals(ComplexityLevel.CONTEXTUAL, request.complexity)
        assertEquals(TranslationPriority.HIGH, request.priority)
        assertEquals(context, request.context)
        assertTrue(request.requestId.startsWith("seg_${segment.id}"))
    }

    @Test
    fun selectionCriteria_weights_mustSumToOne() {
        // Valid criteria (sums to 1.0)
        val validCriteria = SelectionCriteria(
            prioritizeSpeed = 0.25f,
            prioritizeQuality = 0.4f,
            prioritizePrivacy = 0.25f,
            prioritizeCost = 0.1f
        )
        // Should not throw exception
        assertNotNull(validCriteria)
        
        // Test boundary (sums to 0.9, should be valid)
        val boundaryCriteria = SelectionCriteria(
            prioritizeSpeed = 0.2f,
            prioritizeQuality = 0.3f,
            prioritizePrivacy = 0.2f,
            prioritizeCost = 0.2f
        )
        assertNotNull(boundaryCriteria)
    }

    @Test(expected = IllegalArgumentException::class)
    fun selectionCriteria_invalidWeights_throwsException() {
        // Invalid criteria (sums to more than 1.1)
        SelectionCriteria(
            prioritizeSpeed = 0.5f,
            prioritizeQuality = 0.5f,
            prioritizePrivacy = 0.5f,
            prioritizeCost = 0.5f
        )
    }

    @Test
    fun translationMetadata_defaultValues_areCorrect() {
        val metadata = TranslationMetadata()
        
        assertEquals(0, metadata.tokensUsed)
        assertFalse(metadata.cacheHit)
        assertFalse(metadata.fallbackUsed)
        assertEquals(0f, metadata.qualityScore, 0.001f)
        assertTrue(metadata.additionalInfo.isEmpty())
    }

    @Test
    fun contentAnalysisConfig_defaultSelectors_areNotEmpty() {
        val config = ContentAnalysisConfig()
        
        assertTrue(config.skipElementSelectors.isNotEmpty())
        assertTrue(config.templateElementSelectors.isNotEmpty())
        assertTrue(config.articleElementSelectors.isNotEmpty())
        assertTrue(config.skipElementSelectors.contains("script"))
        assertTrue(config.templateElementSelectors.contains("nav"))
        assertTrue(config.articleElementSelectors.contains("article"))
    }

    @Test
    fun deviceCapability_scores_areWithinValidRange() {
        val capability = DeviceCapability(
            availableMemoryMB = 2048,
            cpuCores = 4,
            hasNPU = true,
            thermalState = ThermalState.OPTIMAL,
            batteryLevel = 0.8f,
            isCharging = false,
            networkQuality = NetworkQuality.GOOD,
            mlKitSupported = true,
            geminiNanoSupported = false,
            deviceScore = 0.85f
        )
        
        assertTrue(capability.deviceScore >= 0f)
        assertTrue(capability.deviceScore <= 1f)
        assertTrue(capability.batteryLevel >= 0f)
        assertTrue(capability.batteryLevel <= 1f)
    }

    @Test
    fun modelCapability_resourceRequirements_areValid() {
        val requirements = ResourceRequirements(
            minMemoryMB = 512,
            diskSpaceMB = 100,
            networkRequired = true,
            apiKeyRequired = true,
            batteryImpact = BatteryImpact.MODERATE
        )
        
        assertTrue(requirements.minMemoryMB > 0)
        assertTrue(requirements.diskSpaceMB >= 0)
        assertEquals(BatteryImpact.MODERATE, requirements.batteryImpact)
    }

    @Test
    fun translationPriority_ordering_isCorrect() {
        val priorities = TranslationPriority.values().toList()
        
        // URGENT should be first (highest priority)
        assertEquals(TranslationPriority.URGENT, priorities[0])
        
        // BACKGROUND should be last (lowest priority)
        assertEquals(TranslationPriority.BACKGROUND, priorities.last())
        
        // Verify ordering
        val expectedOrder = listOf(
            TranslationPriority.URGENT,
            TranslationPriority.HIGH,
            TranslationPriority.NORMAL,
            TranslationPriority.LOW,
            TranslationPriority.BACKGROUND
        )
        assertEquals(expectedOrder, priorities)
    }

    @Test
    fun modelType_values_coverExpectedTypes() {
        val types = ModelType.values().toSet()
        
        assertTrue(types.contains(ModelType.ML_KIT_ON_DEVICE))
        assertTrue(types.contains(ModelType.GEMINI_NANO))
        assertTrue(types.contains(ModelType.ASSISTED_TRANSLATION_BACKEND))
        assertTrue(types.contains(ModelType.CUSTOM_ON_DEVICE))
        assertTrue(types.contains(ModelType.MOCK_FOR_TESTING))
    }

    @Test
    fun contentType_values_coverExpectedTypes() {
        val types = ContentType.values().toSet()
        
        assertTrue(types.contains(ContentType.TEMPLATE_ELEMENT))
        assertTrue(types.contains(ContentType.ARTICLE_CONTENT))
        assertTrue(types.contains(ContentType.MIXED_CONTENT))
        assertTrue(types.contains(ContentType.MEDIA_CAPTIONS))
        assertTrue(types.contains(ContentType.INTERACTIVE_ELEMENT))
        assertTrue(types.contains(ContentType.RAW_TEXT))
    }

    @Test
    fun complexityLevel_progression_isLogical() {
        val levels = ComplexityLevel.values().toList()
        
        assertEquals(ComplexityLevel.SIMPLE, levels[0])
        assertEquals(ComplexityLevel.CONTEXTUAL, levels[1])
        assertEquals(ComplexityLevel.CREATIVE, levels[2])
        assertEquals(ComplexityLevel.TECHNICAL, levels[3])
    }
}