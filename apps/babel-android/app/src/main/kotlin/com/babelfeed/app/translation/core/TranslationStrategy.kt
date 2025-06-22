package com.babelfeed.app.translation.core

import kotlinx.coroutines.flow.Flow

/**
 * Base interface for all translation strategies
 * Represents a specific translation approach (on-device, cloud, etc.)
 */
interface TranslationStrategy {
    /**
     * Translate content using this strategy
     * @param request The translation request containing content and parameters
     * @return Flow of translation results (supports streaming)
     */
    suspend fun translate(request: TranslationRequest): Flow<TranslationResult>
    
    /**
     * Check if this strategy can handle the given request
     * @param request The translation request to evaluate
     * @return true if this strategy can process the request
     */
    fun canHandle(request: TranslationRequest): Boolean
    
    /**
     * Priority of this strategy (lower number = higher priority)
     * Used for strategy selection when multiple strategies can handle a request
     */
    val priority: Int
    
    /**
     * The type of model this strategy uses
     */
    val modelType: ModelType
    
    /**
     * Human-readable name for this strategy
     */
    val name: String
    
    /**
     * Check if the strategy is currently available
     * (e.g., model downloaded, network available, etc.)
     */
    suspend fun isAvailable(): Boolean
    
    /**
     * Cleanup resources when strategy is no longer needed
     */
    suspend fun cleanup()
}

/**
 * Types of translation models and channels
 */
enum class ModelType {
    ML_KIT_ON_DEVICE,
    GEMINI_NANO,
    ASSISTED_TRANSLATION_BACKEND,
    CUSTOM_ON_DEVICE,
    MOCK_FOR_TESTING
}

/**
 * Translation request containing all parameters needed for translation
 */
data class TranslationRequest(
    val content: String,
    val fromLanguage: String,
    val toLanguage: String,
    val contentType: ContentType,
    val complexity: ComplexityLevel,
    val priority: TranslationPriority,
    val context: TranslationContext? = null,
    val requestId: String = generateRequestId()
)

/**
 * Result of a translation operation
 */
data class TranslationResult(
    val requestId: String,
    val originalContent: String,
    val translatedContent: String,
    val fromLanguage: String,
    val toLanguage: String,
    val confidence: Float,
    val modelUsed: ModelType,
    val processingTimeMs: Long,
    val isComplete: Boolean,
    val isPartial: Boolean = !isComplete,
    val metadata: TranslationMetadata = TranslationMetadata()
)

/**
 * Types of content being translated
 */
enum class ContentType {
    TEMPLATE_ELEMENT,    // Headers, nav, footer, buttons
    ARTICLE_CONTENT,     // Main text content requiring context
    MIXED_CONTENT,       // Lists, cards with mixed elements
    MEDIA_CAPTIONS,      // Image captions, video descriptions
    INTERACTIVE_ELEMENT, // Forms, dynamic content
    RAW_TEXT            // Simple text without HTML structure
}

/**
 * Complexity levels for translation content
 */
enum class ComplexityLevel {
    SIMPLE,       // Direct word-to-word translation
    CONTEXTUAL,   // Requires understanding context
    CREATIVE,     // Requires cultural adaptation
    TECHNICAL     // Domain-specific terminology
}

/**
 * Priority levels for translation requests
 */
enum class TranslationPriority {
    URGENT,    // Real-time requirements (video dubbing)
    HIGH,      // User-visible content (articles)
    NORMAL,    // Standard content (mixed elements)
    LOW,       // Background content (templates)
    BACKGROUND // Preemptive translation
}

/**
 * Additional context for translation
 */
data class TranslationContext(
    val sourceUrl: String? = null,
    val pageTitle: String? = null,
    val articleTopic: String? = null,
    val culturalContext: String? = null,
    val domainSpecific: String? = null,
    val userPreferences: UserTranslationPreferences? = null
)

/**
 * User preferences for translation
 */
data class UserTranslationPreferences(
    val preferredStyle: TranslationStyle = TranslationStyle.NATURAL,
    val culturalAdaptation: Boolean = true,
    val preserveTechnicalTerms: Boolean = true
)

/**
 * Translation style preferences
 */
enum class TranslationStyle {
    LITERAL,    // Word-for-word translation
    NATURAL,    // Natural, fluent translation
    FORMAL,     // Formal tone
    CASUAL      // Casual tone
}

/**
 * Additional metadata about the translation
 */
data class TranslationMetadata(
    val tokensUsed: Int = 0,
    val cacheHit: Boolean = false,
    val fallbackUsed: Boolean = false,
    val qualityScore: Float = 0f,
    val additionalInfo: Map<String, Any> = emptyMap()
)

/**
 * Generate a unique request ID
 */
private fun generateRequestId(): String {
    return "tr_${System.currentTimeMillis()}_${(Math.random() * 10000).toInt()}"
}