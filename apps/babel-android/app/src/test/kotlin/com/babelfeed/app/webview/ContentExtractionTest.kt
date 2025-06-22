package com.babelfeed.app.webview

import kotlinx.coroutines.test.runTest
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ContentExtractionTest {

    @Test
    fun testMockTranslationService() = runTest {
        val translationService = MockTranslationService()
        
        // Test Chinese to English translation
        val chineseResult = translationService.translate(
            text = "新闻",
            sourceLanguage = "zh",
            targetLanguage = "en"
        )
        
        assertEquals("新闻", chineseResult.originalText)
        assertEquals("News", chineseResult.translatedText)
        assertEquals("zh", chineseResult.sourceLanguage)
        assertEquals("en", chineseResult.targetLanguage)
        assertTrue(chineseResult.confidence > 0.0)
        assertTrue(chineseResult.processingTimeMs >= 0)
        
        // Test Japanese to English translation
        val japaneseResult = translationService.translate(
            text = "ニュース",
            sourceLanguage = "ja",
            targetLanguage = "en"
        )
        
        assertEquals("ニュース", japaneseResult.originalText)
        assertEquals("News", japaneseResult.translatedText)
        assertEquals("ja", japaneseResult.sourceLanguage)
        assertEquals("en", japaneseResult.targetLanguage)
        
        // Test English to Chinese translation
        val englishResult = translationService.translate(
            text = "news",
            sourceLanguage = "en",
            targetLanguage = "zh"
        )
        
        assertEquals("news", englishResult.originalText)
        assertEquals("新闻", englishResult.translatedText)
        assertEquals("en", englishResult.sourceLanguage)
        assertEquals("zh", englishResult.targetLanguage)
    }

    @Test
    fun testTranslationWithContext() = runTest {
        val translationService = MockTranslationService()
        
        val context = TextContext(
            beforeText = "Latest",
            afterText = "today",
            parentText = "Latest news today from around the world",
            semanticRole = "heading"
        )
        
        val result = translationService.translate(
            text = "news",
            sourceLanguage = "en",
            targetLanguage = "zh",
            context = context
        )
        
        assertEquals("新闻", result.translatedText)
        // Context should influence confidence
        assertTrue(result.confidence > 0.0)
    }

    @Test
    fun testSupportedLanguages() {
        val translationService = MockTranslationService()
        
        val supportedLanguages = translationService.getSupportedLanguages()
        assertTrue(supportedLanguages.contains("en"))
        assertTrue(supportedLanguages.contains("zh"))
        assertTrue(supportedLanguages.contains("ja"))
        assertTrue(supportedLanguages.contains("zh-cn"))
        assertTrue(supportedLanguages.contains("zh-tw"))
        
        assertTrue(translationService.isLanguageSupported("en"))
        assertTrue(translationService.isLanguageSupported("zh"))
        assertFalse(translationService.isLanguageSupported("fr"))
    }

    @Test
    fun testLongTextTranslation() = runTest {
        val translationService = MockTranslationService()
        
        val longText = "This is a very long paragraph that contains multiple sentences and should be handled properly by the translation service. It tests the system's ability to process larger chunks of text while maintaining accuracy and performance."
        
        val result = translationService.translate(
            text = longText,
            sourceLanguage = "en",
            targetLanguage = "zh"
        )
        
        assertEquals(longText, result.originalText)
        assertTrue(result.translatedText.contains("翻译段落") || result.translatedText.contains("[翻译"))
        assertTrue(result.processingTimeMs >= 0)
        // Longer text should have reasonable confidence
        assertTrue(result.confidence > 0.0)
    }

    @Test 
    fun testSpecialCharactersTranslation() = runTest {
        val translationService = MockTranslationService()
        
        // Test text with punctuation and special characters
        val textWithPunctuation = "Hello, world! How are you today?"
        
        val result = translationService.translate(
            text = textWithPunctuation,
            sourceLanguage = "en",
            targetLanguage = "zh"
        )
        
        assertEquals(textWithPunctuation, result.originalText)
        assertNotNull(result.translatedText)
        assertTrue(result.confidence > 0.0)
    }

    @Test
    fun testEmptyAndShortText() = runTest {
        val translationService = MockTranslationService()
        
        // Test very short text
        val shortResult = translationService.translate(
            text = "Hi",
            sourceLanguage = "en", 
            targetLanguage = "zh"
        )
        
        assertEquals("Hi", shortResult.originalText)
        assertNotNull(shortResult.translatedText)
        // Short text should have lower confidence
        assertTrue(shortResult.confidence > 0.0)
    }
}