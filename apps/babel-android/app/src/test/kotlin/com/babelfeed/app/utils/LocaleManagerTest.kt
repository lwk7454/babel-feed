package com.babelfeed.app.utils

import org.junit.Test
import org.junit.Assert.*

class LocaleManagerTest {
    
    private val localeManager = LocaleManager()
    
    @Test
    fun `getLanguageName should return correct display names`() {
        assertEquals("English", localeManager.getLanguageName("en"))
        assertEquals("中文（简体）", localeManager.getLanguageName("zh-CN"))
        assertEquals("中文（繁體）", localeManager.getLanguageName("zh-TW"))
        assertEquals("日本語", localeManager.getLanguageName("ja"))
        assertEquals("English", localeManager.getLanguageName("unknown"))
    }
    
    @Test
    fun `isLanguageSupported should return correct values`() {
        assertTrue(localeManager.isLanguageSupported("en"))
        assertTrue(localeManager.isLanguageSupported("zh-CN"))
        assertTrue(localeManager.isLanguageSupported("zh-TW"))
        assertTrue(localeManager.isLanguageSupported("ja"))
        assertFalse(localeManager.isLanguageSupported("fr"))
        assertFalse(localeManager.isLanguageSupported("unknown"))
    }
    
    @Test
    fun `getLanguageCodeForDisplay should return correct codes`() {
        assertEquals("EN", localeManager.getLanguageCodeForDisplay("en"))
        assertEquals("ZH", localeManager.getLanguageCodeForDisplay("zh-CN"))
        assertEquals("ZH", localeManager.getLanguageCodeForDisplay("zh-TW"))
        assertEquals("JA", localeManager.getLanguageCodeForDisplay("ja"))
        assertEquals("ES", localeManager.getLanguageCodeForDisplay("es"))
        assertEquals("FR", localeManager.getLanguageCodeForDisplay("fr"))
        assertEquals("DE", localeManager.getLanguageCodeForDisplay("de"))
        assertEquals("IT", localeManager.getLanguageCodeForDisplay("it"))
        assertEquals("PT", localeManager.getLanguageCodeForDisplay("pt"))
        assertEquals("KO", localeManager.getLanguageCodeForDisplay("ko"))
        assertEquals("UN", localeManager.getLanguageCodeForDisplay("unknown"))
    }
    
    @Test
    fun `SUPPORTED_LANGUAGES should contain expected languages`() {
        val supportedLanguages = LocaleManager.SUPPORTED_LANGUAGES
        
        assertTrue(supportedLanguages.containsKey("en"))
        assertTrue(supportedLanguages.containsKey("zh-CN"))
        assertTrue(supportedLanguages.containsKey("zh-TW"))
        assertTrue(supportedLanguages.containsKey("ja"))
        
        assertEquals("English", supportedLanguages["en"])
        assertEquals("中文（简体）", supportedLanguages["zh-CN"])
        assertEquals("中文（繁體）", supportedLanguages["zh-TW"])
        assertEquals("日本語", supportedLanguages["ja"])
    }
}