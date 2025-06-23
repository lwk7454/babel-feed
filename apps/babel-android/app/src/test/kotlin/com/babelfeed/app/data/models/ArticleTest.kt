package com.babelfeed.app.data.models

import org.junit.Test
import org.junit.Assert.*

class ArticleTest {
    
    private val sampleArticle = Article(
        id = "test-id",
        title = "Test Article",
        titleTranslations = mapOf(
            "zh-CN" to "测试文章",
            "zh-TW" to "測試文章",
            "ja" to "テスト記事"
        ),
        summary = "Test summary",
        summaryTranslations = mapOf(
            "zh-CN" to "测试摘要",
            "zh-TW" to "測試摘要",
            "ja" to "テスト要約"
        ),
        url = "https://example.com/article",
        source = "Test Source",
        sourceLanguage = "en",
        availableLanguages = listOf("en", "zh-CN", "zh-TW", "ja"),
        publishedAt = "2024-01-01T00:00:00Z",
        imageUrl = "https://example.com/image.jpg"
    )
    
    @Test
    fun `getLocalizedTitle should return translated title when available`() {
        assertEquals("测试文章", sampleArticle.getLocalizedTitle("zh-CN"))
        assertEquals("測試文章", sampleArticle.getLocalizedTitle("zh-TW"))
        assertEquals("テスト記事", sampleArticle.getLocalizedTitle("ja"))
    }
    
    @Test
    fun `getLocalizedTitle should return original title when translation not available`() {
        assertEquals("Test Article", sampleArticle.getLocalizedTitle("fr"))
        assertEquals("Test Article", sampleArticle.getLocalizedTitle("es"))
        assertEquals("Test Article", sampleArticle.getLocalizedTitle("en"))
    }
    
    @Test
    fun `getLocalizedSummary should return translated summary when available`() {
        assertEquals("测试摘要", sampleArticle.getLocalizedSummary("zh-CN"))
        assertEquals("測試摘要", sampleArticle.getLocalizedSummary("zh-TW"))
        assertEquals("テスト要約", sampleArticle.getLocalizedSummary("ja"))
    }
    
    @Test
    fun `getLocalizedSummary should return original summary when translation not available`() {
        assertEquals("Test summary", sampleArticle.getLocalizedSummary("fr"))
        assertEquals("Test summary", sampleArticle.getLocalizedSummary("es"))
        assertEquals("Test summary", sampleArticle.getLocalizedSummary("en"))
    }
    
    @Test
    fun `getLocalizedSummary should return null when original summary is null`() {
        val articleWithoutSummary = sampleArticle.copy(summary = null, summaryTranslations = emptyMap())
        assertNull(articleWithoutSummary.getLocalizedSummary("zh-CN"))
        assertNull(articleWithoutSummary.getLocalizedSummary("en"))
    }
    
    @Test
    fun `hasTranslation should return true for available languages`() {
        assertTrue(sampleArticle.hasTranslation("en"))
        assertTrue(sampleArticle.hasTranslation("zh-CN"))
        assertTrue(sampleArticle.hasTranslation("zh-TW"))
        assertTrue(sampleArticle.hasTranslation("ja"))
    }
    
    @Test
    fun `hasTranslation should return false for unavailable languages`() {
        assertFalse(sampleArticle.hasTranslation("fr"))
        assertFalse(sampleArticle.hasTranslation("es"))
        assertFalse(sampleArticle.hasTranslation("de"))
    }
    
    @Test
    fun `getSourceLanguageCode should return correct codes for supported languages`() {
        assertEquals("EN", sampleArticle.copy(sourceLanguage = "en").getSourceLanguageCode())
        assertEquals("ZH", sampleArticle.copy(sourceLanguage = "zh-cn").getSourceLanguageCode())
        assertEquals("ZH", sampleArticle.copy(sourceLanguage = "zh-tw").getSourceLanguageCode())
        assertEquals("JA", sampleArticle.copy(sourceLanguage = "ja").getSourceLanguageCode())
        assertEquals("ES", sampleArticle.copy(sourceLanguage = "es").getSourceLanguageCode())
        assertEquals("FR", sampleArticle.copy(sourceLanguage = "fr").getSourceLanguageCode())
        assertEquals("DE", sampleArticle.copy(sourceLanguage = "de").getSourceLanguageCode())
        assertEquals("IT", sampleArticle.copy(sourceLanguage = "it").getSourceLanguageCode())
        assertEquals("PT", sampleArticle.copy(sourceLanguage = "pt").getSourceLanguageCode())
        assertEquals("KO", sampleArticle.copy(sourceLanguage = "ko").getSourceLanguageCode())
    }
    
    @Test
    fun `getSourceLanguageCode should return uppercase first two characters for unknown languages`() {
        assertEquals("RU", sampleArticle.copy(sourceLanguage = "ru").getSourceLanguageCode())
        assertEquals("AR", sampleArticle.copy(sourceLanguage = "ar").getSourceLanguageCode())
        assertEquals("HI", sampleArticle.copy(sourceLanguage = "hindi").getSourceLanguageCode())
    }
    
    @Test
    fun `article should handle empty translations gracefully`() {
        val articleWithoutTranslations = Article(
            id = "test-id",
            title = "Test Title",
            url = "https://example.com",
            source = "Test Source",
            publishedAt = "2024-01-01T00:00:00Z"
        )
        
        assertEquals("Test Title", articleWithoutTranslations.getLocalizedTitle("zh-CN"))
        assertNull(articleWithoutTranslations.getLocalizedSummary("zh-CN"))
        assertFalse(articleWithoutTranslations.hasTranslation("zh-CN"))
        assertTrue(articleWithoutTranslations.hasTranslation("en")) // Default source language
        assertEquals("EN", articleWithoutTranslations.getSourceLanguageCode())
    }
    
    @Test
    fun `article should handle null summary translations`() {
        val articleWithNullSummary = sampleArticle.copy(
            summary = null,
            summaryTranslations = mapOf("zh-CN" to "翻译摘要")
        )
        
        assertEquals("翻译摘要", articleWithNullSummary.getLocalizedSummary("zh-CN"))
        assertNull(articleWithNullSummary.getLocalizedSummary("en"))
    }
}