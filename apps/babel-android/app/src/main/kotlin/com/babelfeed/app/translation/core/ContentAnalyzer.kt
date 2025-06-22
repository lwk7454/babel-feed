package com.babelfeed.app.translation.core

/**
 * Interface for analyzing and segmenting content for optimal translation
 */
interface ContentAnalyzer {
    /**
     * Analyze HTML content and provide overall analysis
     * @param html The HTML content to analyze
     * @return ContentAnalysis with segments and metadata
     */
    fun analyzeContent(html: String): ContentAnalysis
    
    /**
     * Segment content into logical pieces for translation
     * @param html The HTML content to segment
     * @return List of content segments ready for translation
     */
    fun segmentContent(html: String): List<ContentSegment>
    
    /**
     * Extract context information from content
     * @param html The HTML content to analyze
     * @return TranslationContext with extracted information
     */
    fun extractContext(html: String): TranslationContext
    
    /**
     * Estimate the complexity of content
     * @param content The content to analyze
     * @return Complexity level assessment
     */
    fun assessComplexity(content: String): ComplexityLevel
    
    /**
     * Detect the primary language of content
     * @param content The content to analyze
     * @return Detected language code
     */
    fun detectLanguage(content: String): String
}

/**
 * Result of content analysis
 */
data class ContentAnalysis(
    val segments: List<ContentSegment>,
    val overallComplexity: ComplexityLevel,
    val estimatedTokens: Int,
    val detectedLanguage: String,
    val context: TranslationContext,
    val metadata: ContentAnalysisMetadata
)

/**
 * A segment of content ready for translation
 */
data class ContentSegment(
    val id: String,
    val html: String,
    val extractedText: String,
    val type: ContentType,
    val complexity: ComplexityLevel,
    val priority: TranslationPriority,
    val selector: String? = null, // CSS selector for re-injection
    val parentContext: String? = null,
    val estimatedTokens: Int = 0
) {
    /**
     * Convert this segment to a translation request
     */
    fun toTranslationRequest(
        fromLanguage: String,
        toLanguage: String,
        context: TranslationContext? = null
    ): TranslationRequest {
        return TranslationRequest(
            content = extractedText,
            fromLanguage = fromLanguage,
            toLanguage = toLanguage,
            contentType = type,
            complexity = complexity,
            priority = priority,
            context = context,
            requestId = "seg_${id}_${System.currentTimeMillis()}"
        )
    }
}

/**
 * Metadata about the content analysis process
 */
data class ContentAnalysisMetadata(
    val processingTimeMs: Long = 0,
    val totalElements: Int = 0,
    val textElements: Int = 0,
    val skippedElements: Int = 0,
    val confidence: Float = 1.0f,
    val additionalInfo: Map<String, Any> = emptyMap()
)

/**
 * Content element types for HTML analysis
 */
enum class HtmlElementType {
    HEADER,
    NAVIGATION,
    FOOTER,
    ARTICLE,
    PARAGRAPH,
    LIST_ITEM,
    BUTTON,
    LINK,
    CAPTION,
    FORM_ELEMENT,
    UNKNOWN
}

/**
 * Configuration for content analysis behavior
 */
data class ContentAnalysisConfig(
    val skipElementSelectors: List<String> = DEFAULT_SKIP_SELECTORS,
    val templateElementSelectors: List<String> = DEFAULT_TEMPLATE_SELECTORS,
    val articleElementSelectors: List<String> = DEFAULT_ARTICLE_SELECTORS,
    val minTextLength: Int = 3,
    val maxSegmentSize: Int = 1000,
    val preserveHtmlStructure: Boolean = true
) {
    companion object {
        val DEFAULT_SKIP_SELECTORS = listOf(
            "script", "style", "noscript", "meta", "link",
            ".skip-translation", "[data-no-translate]",
            ".advertisement", ".ads", ".social-share"
        )
        
        val DEFAULT_TEMPLATE_SELECTORS = listOf(
            "header", "nav", "footer", ".menu", ".breadcrumb",
            "[role='navigation']", ".btn", ".button", 
            ".navbar", ".sidebar", ".header", ".footer"
        )
        
        val DEFAULT_ARTICLE_SELECTORS = listOf(
            "article", ".content", ".post-content", ".article-body",
            "main p", ".text-content", "[role='main']",
            ".entry-content", ".post-body", ".article-text"
        )
    }
}

/**
 * Result of HTML element analysis
 */
data class HtmlElement(
    val tag: String,
    val text: String,
    val html: String,
    val selector: String,
    val type: HtmlElementType,
    val attributes: Map<String, String> = emptyMap(),
    val children: List<HtmlElement> = emptyList()
)