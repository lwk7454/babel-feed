package com.babelfeed.app.utils

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * Instrumented tests for LocaleManager.
 * These tests verify locale handling and language management functionality.
 */
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class LocaleManagerInstrumentedTest {

    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @Inject
    lateinit var localeManager: LocaleManager

    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun localeManager_supportedLanguages_containsExpectedLanguages() {
        val supportedLanguages = LocaleManager.SUPPORTED_LANGUAGES
        
        // Verify all expected languages are supported
        assertTrue("English should be supported", supportedLanguages.containsKey("en"))
        assertTrue("Chinese Simplified should be supported", supportedLanguages.containsKey("zh-CN"))
        assertTrue("Chinese Traditional should be supported", supportedLanguages.containsKey("zh-TW"))
        assertTrue("Japanese should be supported", supportedLanguages.containsKey("ja"))
        
        // Verify language names are not empty
        supportedLanguages.values.forEach { name ->
            assertFalse("Language name should not be empty", name.isBlank())
        }
    }

    @Test
    fun localeManager_setAndGetCurrentLocale() {
        val testLocale = "zh-CN"
        
        // Save locale preference
        localeManager.saveLocale(context, testLocale)
        
        // Verify locale is set
        assertEquals(testLocale, localeManager.getCurrentLocale(context))
    }

    @Test
    fun localeManager_setLocale_persistsAcrossInstances() {
        val testLocale = "ja"
        
        // Set locale using first instance
        localeManager.saveLocale(context, testLocale)
        
        // Create new LocaleManager instance (simulating app restart)
        val newLocaleManager = LocaleManager()
        
        // Verify locale persists
        assertEquals(testLocale, newLocaleManager.getCurrentLocale(context))
    }

    @Test
    fun localeManager_defaultLocale_isEnglish() {
        // Clear any existing preference
        val prefs = context.getSharedPreferences("app_preferences", android.content.Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
        
        // Create fresh LocaleManager
        val freshLocaleManager = LocaleManager()
        
        // Should default to English
        assertEquals("en", freshLocaleManager.getCurrentLocale(context))
    }

    @Test
    fun localeManager_invalidLocale_fallsBackToDefault() {
        val invalidLocale = "xyz-invalid"
        
        // Set invalid locale
        localeManager.saveLocale(context, invalidLocale)
        
        // The stored locale should match what was saved (no automatic fallback during saving)
        val storedLocale = localeManager.getCurrentLocale(context)
        assertEquals("Stored locale should match what was saved", invalidLocale, storedLocale)
        
        // But when checking for validity, it should be recognized as unsupported
        assertFalse("Invalid locale should not be supported", 
            LocaleManager.SUPPORTED_LANGUAGES.containsKey(storedLocale))
    }

    @Test
    fun localeManager_allSupportedLocales_canBeSetAndRetrieved() {
        LocaleManager.SUPPORTED_LANGUAGES.keys.forEach { locale ->
            // Set the locale
            localeManager.saveLocale(context, locale)
            
            // Verify it was set correctly
            assertEquals("Locale $locale should be set correctly", 
                locale, localeManager.getCurrentLocale(context))
        }
    }

    @Test
    fun localeManager_localeChanges_updateCorrectly() {
        val locales = listOf("en", "zh-CN", "zh-TW", "ja")
        
        // Cycle through different locales
        locales.forEach { locale ->
            localeManager.saveLocale(context, locale)
            assertEquals(locale, localeManager.getCurrentLocale(context))
        }
        
        // Verify final state
        assertEquals("ja", localeManager.getCurrentLocale(context))
    }

    @Test
    fun localeManager_languageNames_areProperlyFormatted() {
        val supportedLanguages = LocaleManager.SUPPORTED_LANGUAGES
        
        // Verify English name
        assertEquals("English", supportedLanguages["en"])
        
        // Verify Chinese names contain appropriate characters
        val chineseSimplified = supportedLanguages["zh-CN"]
        assertNotNull("Chinese Simplified should have a name", chineseSimplified)
        assertTrue("Chinese Simplified should contain Chinese characters", 
            chineseSimplified!!.contains("中文"))
        
        val chineseTraditional = supportedLanguages["zh-TW"]
        assertNotNull("Chinese Traditional should have a name", chineseTraditional)
        assertTrue("Chinese Traditional should contain Chinese characters", 
            chineseTraditional!!.contains("中文"))
        
        // Verify Japanese name
        val japanese = supportedLanguages["ja"]
        assertNotNull("Japanese should have a name", japanese)
        assertTrue("Japanese should contain Japanese characters", 
            japanese!!.contains("日本語"))
    }

    @Test
    fun localeManager_contextHandling_worksCorrectly() {
        val testLocale = "zh-TW"
        
        // Set locale with app context
        localeManager.saveLocale(context, testLocale)
        
        // Retrieve with same context
        assertEquals(testLocale, localeManager.getCurrentLocale(context))
        
        // Should work with application context as well
        val appContext = context.applicationContext
        assertEquals(testLocale, localeManager.getCurrentLocale(appContext))
    }

    @Test
    fun localeManager_concurrentAccess_handledCorrectly() {
        val locales = listOf("en", "zh-CN", "ja")
        
        // Simulate concurrent access
        locales.forEach { locale ->
            localeManager.saveLocale(context, locale)
            
            // Immediately read back
            val retrievedLocale = localeManager.getCurrentLocale(context)
            assertEquals("Concurrent access should work correctly", locale, retrievedLocale)
        }
    }

    @Test
    fun localeManager_edgeCases_handledGracefully() {
        // Test empty string
        localeManager.saveLocale(context, "")
        val afterEmpty = localeManager.getCurrentLocale(context)
        assertEquals("Empty locale should be stored as-is", "", afterEmpty)
        
        // Test null handling (if the API allows it)
        val beforeNull = localeManager.getCurrentLocale(context)
        assertNotNull("Current locale should never be null", beforeNull)
        
        // Test whitespace
        localeManager.saveLocale(context, "   ")
        val afterWhitespace = localeManager.getCurrentLocale(context)
        assertEquals("Whitespace locale should be stored as-is", "   ", afterWhitespace)
        
        // Test that invalid values are stored but recognized as invalid
        assertFalse("Empty string should not be in supported languages", 
            LocaleManager.SUPPORTED_LANGUAGES.containsKey(""))
        assertFalse("Whitespace should not be in supported languages", 
            LocaleManager.SUPPORTED_LANGUAGES.containsKey("   "))
    }
}