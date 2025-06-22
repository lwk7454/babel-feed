package com.babelfeed.app.webview

import android.util.Log
import kotlinx.coroutines.delay
import kotlinx.serialization.Serializable

@Serializable
data class TranslationRequest(
    val text: String,
    val sourceLanguage: String,
    val targetLanguage: String,
    val context: TextContext?
)

@Serializable
data class MockTranslationResponse(
    val originalText: String,
    val translatedText: String,
    val sourceLanguage: String,
    val targetLanguage: String,
    val confidence: Double,
    val processingTimeMs: Long
)


class MockTranslationService {
    
    companion object {
        private const val TAG = "MockTranslationService"
    }

    suspend fun translate(
        text: String,
        sourceLanguage: String,
        targetLanguage: String,
        context: TextContext? = null
    ): MockTranslationResponse {
        val startTime = System.currentTimeMillis()
        
        // Simulate occasional failures for testing error handling (1% chance)
        if (kotlin.random.Random.nextFloat() < 0.01) {
            throw Exception("Translation service temporarily unavailable")
        }
        
        // Simulate unsupported language combinations
        if (sourceLanguage == "fr" || targetLanguage == "fr") {
            throw Exception("Translation not supported for language: fr")
        }
        
        // Simulate network timeout for very long texts (for testing)
        if (text.length > 1000) {
            throw Exception("Translation timeout: text too long")
        }
        
        // Simulate processing delay based on text length
        val processingDelay = minOf(text.length * 2L, 500L)
        delay(processingDelay)
        
        val translatedText = mockTranslate(text, sourceLanguage, targetLanguage, context)
        val confidence = calculateMockConfidence(text, context)
        
        val processingTime = System.currentTimeMillis() - startTime
        
        Log.d(TAG, "Translated '${text.take(50)}...' from $sourceLanguage to $targetLanguage")
        
        return MockTranslationResponse(
            originalText = text,
            translatedText = translatedText,
            sourceLanguage = sourceLanguage,
            targetLanguage = targetLanguage,
            confidence = confidence,
            processingTimeMs = processingTime
        )
    }

    private fun mockTranslate(
        text: String,
        sourceLanguage: String,
        targetLanguage: String,
        context: TextContext?
    ): String {
        // Mock translation logic - in production this would call actual LLM
        return when (sourceLanguage.lowercase()) {
            "zh", "zh-cn", "zh-tw" -> translateFromChinese(text, context)
            "ja" -> translateFromJapanese(text, context)
            "en" -> when (targetLanguage.lowercase()) {
                "zh", "zh-cn" -> translateToChineseSimplified(text, context)
                "zh-tw" -> translateToChineseTraditional(text, context)
                "ja" -> translateToJapanese(text, context)
                else -> text
            }
            else -> "[TRANSLATED: $text]"
        }
    }

    private fun translateFromChinese(text: String, context: TextContext?): String {
        // Mock Chinese to English translation with context awareness
        val contextualPrefix = when (context?.semanticRole) {
            "heading" -> ""
            "paragraph" -> ""
            "link" -> ""
            "emphasis" -> ""
            else -> ""
        }
        
        return when {
            text.contains("新闻") -> "${contextualPrefix}News"
            text.contains("文章") -> "${contextualPrefix}Article"
            text.contains("阅读更多") -> "${contextualPrefix}Read More"
            text.contains("评论") -> "${contextualPrefix}Comments"
            text.contains("分享") -> "${contextualPrefix}Share"
            text.contains("时间") -> "${contextualPrefix}Time"
            text.contains("作者") -> "${contextualPrefix}Author"
            text.contains("标题") -> "${contextualPrefix}Title"
            text.contains("内容") -> "${contextualPrefix}Content"
            text.contains("搜索") -> "${contextualPrefix}Search"
            text.length > 50 -> "${contextualPrefix}[TRANSLATED PARAGRAPH: ${text.take(20)}...]"
            else -> "${contextualPrefix}[TRANSLATED: $text]"
        }
    }

    private fun translateFromJapanese(text: String, context: TextContext?): String {
        // Mock Japanese to English translation
        val contextualPrefix = when (context?.semanticRole) {
            "heading" -> ""
            "paragraph" -> ""
            "link" -> ""
            else -> ""
        }
        
        return when {
            text.contains("ニュース") -> "${contextualPrefix}News"
            text.contains("記事") -> "${contextualPrefix}Article"
            text.contains("もっと読む") -> "${contextualPrefix}Read More"
            text.contains("コメント") -> "${contextualPrefix}Comments"
            text.contains("共有") -> "${contextualPrefix}Share"
            text.contains("時間") -> "${contextualPrefix}Time"
            text.contains("著者") -> "${contextualPrefix}Author"
            text.length > 50 -> "${contextualPrefix}[TRANSLATED PARAGRAPH: ${text.take(20)}...]"
            else -> "${contextualPrefix}[TRANSLATED: $text]"
        }
    }

    private fun translateToChineseSimplified(text: String, context: TextContext?): String {
        // Mock English to Chinese Simplified translation
        return when {
            text.lowercase().contains("news") -> "新闻"
            text.lowercase().contains("article") -> "文章"
            text.lowercase().contains("read more") -> "阅读更多"
            text.lowercase().contains("comments") -> "评论"
            text.lowercase().contains("share") -> "分享"
            text.lowercase().contains("time") -> "时间"
            text.lowercase().contains("author") -> "作者"
            text.length > 50 -> "[翻译段落: ${text.take(20)}...]"
            else -> "[翻译: $text]"
        }
    }

    private fun translateToChineseTraditional(text: String, context: TextContext?): String {
        // Mock English to Chinese Traditional translation
        return when {
            text.lowercase().contains("news") -> "新聞"
            text.lowercase().contains("article") -> "文章"
            text.lowercase().contains("read more") -> "閱讀更多"
            text.lowercase().contains("comments") -> "評論"
            text.lowercase().contains("share") -> "分享"
            text.lowercase().contains("time") -> "時間"
            text.lowercase().contains("author") -> "作者"
            text.length > 50 -> "[翻譯段落: ${text.take(20)}...]"
            else -> "[翻譯: $text]"
        }
    }

    private fun translateToJapanese(text: String, context: TextContext?): String {
        // Mock English to Japanese translation
        return when {
            text.lowercase().contains("news") -> "ニュース"
            text.lowercase().contains("article") -> "記事"
            text.lowercase().contains("read more") -> "もっと読む"
            text.lowercase().contains("comments") -> "コメント"
            text.lowercase().contains("share") -> "共有"
            text.lowercase().contains("time") -> "時間"
            text.lowercase().contains("author") -> "著者"
            text.length > 50 -> "[翻訳段落: ${text.take(20)}...]"
            else -> "[翻訳: $text]"
        }
    }

    private fun calculateMockConfidence(text: String, context: TextContext?): Double {
        // Mock confidence calculation based on various factors
        var confidence = 0.8 // Base confidence
        
        // Adjust based on text length
        when {
            text.length < 5 -> confidence -= 0.2
            text.length > 100 -> confidence += 0.1
        }
        
        // Adjust based on context
        context?.let {
            when (it.semanticRole) {
                "heading" -> confidence += 0.1
                "paragraph" -> confidence += 0.05
                "link" -> confidence -= 0.1
                else -> confidence += 0.0
            }
        }
        
        // Add some randomness to simulate real-world variance
        val randomFactor = try {
            (Math.random() - 0.5) * 0.2
        } catch (e: Exception) {
            0.0 // Fallback for unit tests
        }
        confidence += randomFactor
        
        return confidence.coerceIn(0.1, 1.0)
    }

    fun getSupportedLanguages(): List<String> {
        return listOf("en", "zh", "zh-cn", "zh-tw", "ja")
    }

    fun isLanguageSupported(languageCode: String): Boolean {
        return getSupportedLanguages().contains(languageCode.lowercase())
    }
}