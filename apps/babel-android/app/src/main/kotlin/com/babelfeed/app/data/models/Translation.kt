package com.babelfeed.app.data.models

data class BackendTranslationRequest(
    val content: String,
    val fromLanguage: String,
    val toLanguage: String,
    val complexity: String = "contextual",
    val contentType: String = "mixed_content",
    val priority: String = "normal",
    val streaming: Boolean = false,
    val requestId: String,
    val context: TranslationContext? = null
)

data class BackendTranslationResponse(
    val requestId: String,
    val translatedContent: String,
    val isComplete: Boolean,
    val confidence: Double,
    val tokensUsed: Int = 0,
    val modelUsed: String = "unknown",
    val backendProcessingTime: Long = 0,
    val error: TranslationError? = null
)

data class TranslationContext(
    val sourceUrl: String? = null,
    val pageTitle: String? = null,
    val articleTopic: String? = null,
    val culturalContext: String? = null,
    val domainSpecific: String? = null
)

data class TranslationError(
    val code: String,
    val message: String,
    val details: Map<String, Any>? = null
)

data class SupportedLanguagesResponse(
    val languages: List<Language>,
    val supportedPairs: String,
    val timestamp: String
)

data class Language(
    val code: String,
    val name: String
)

data class TranslationModelsResponse(
    val models: Map<String, List<String>>,
    val defaultSelection: String,
    val timestamp: String
)