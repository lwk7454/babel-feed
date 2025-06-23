package com.babelfeed.app.utils

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages app locale and language switching functionality
 */
@Singleton
class LocaleManager @Inject constructor() {
    
    companion object {
        private const val PREFERENCE_LOCALE = "locale_preference"
        
        /**
         * Supported language codes mapped to their display names
         */
        val SUPPORTED_LANGUAGES = mapOf(
            "en" to "English",
            "zh-CN" to "中文（简体）",
            "zh-TW" to "中文（繁體）",
            "ja" to "日本語"
        )
        
        /**
         * Language code to locale mapping
         */
        private val LANGUAGE_LOCALE_MAP = mapOf(
            "en" to Locale.ENGLISH,
            "zh-CN" to Locale.SIMPLIFIED_CHINESE,
            "zh-TW" to Locale.TRADITIONAL_CHINESE,
            "ja" to Locale.JAPANESE
        )
    }
    
    /**
     * Set the app locale based on language code
     */
    fun setLocale(context: Context, languageCode: String): Context {
        val locale = getLocaleFromLanguageCode(languageCode)
        return updateResources(context, locale)
    }
    
    /**
     * Get the current app locale
     */
    fun getCurrentLocale(context: Context): String {
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        return sharedPreferences.getString(PREFERENCE_LOCALE, getSystemLocale()) ?: "en"
    }
    
    /**
     * Save the selected locale to preferences
     */
    fun saveLocale(context: Context, languageCode: String) {
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        sharedPreferences.edit().putString(PREFERENCE_LOCALE, languageCode).apply()
    }
    
    /**
     * Get system locale language code
     */
    private fun getSystemLocale(): String {
        val systemLocale = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            Locale.getDefault()
        } else {
            @Suppress("DEPRECATION")
            Locale.getDefault()
        }
        
        return when {
            systemLocale.language == "zh" && systemLocale.country == "CN" -> "zh-CN"
            systemLocale.language == "zh" && systemLocale.country == "TW" -> "zh-TW"
            systemLocale.language == "ja" -> "ja"
            else -> "en"
        }
    }
    
    /**
     * Convert language code to Locale object
     */
    private fun getLocaleFromLanguageCode(languageCode: String): Locale {
        return LANGUAGE_LOCALE_MAP[languageCode] ?: Locale.ENGLISH
    }
    
    /**
     * Update the app's resources with new locale
     */
    private fun updateResources(context: Context, locale: Locale): Context {
        Locale.setDefault(locale)
        
        val configuration = Configuration(context.resources.configuration)
        configuration.setLocale(locale)
        
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            context.createConfigurationContext(configuration)
        } else {
            @Suppress("DEPRECATION")
            context.resources.updateConfiguration(configuration, context.resources.displayMetrics)
            context
        }
    }
    
    /**
     * Get localized language name
     */
    fun getLanguageName(languageCode: String): String {
        return SUPPORTED_LANGUAGES[languageCode] ?: "English"
    }
    
    /**
     * Check if language code is supported
     */
    fun isLanguageSupported(languageCode: String): Boolean {
        return SUPPORTED_LANGUAGES.containsKey(languageCode)
    }
    
    /**
     * Get language code for display (e.g., "EN", "ZH", "JA")
     */
    fun getLanguageCodeForDisplay(languageCode: String): String {
        return when (languageCode) {
            "en" -> "EN"
            "zh-CN", "zh-TW" -> "ZH"
            "ja" -> "JA"
            "es" -> "ES"
            "fr" -> "FR"
            "de" -> "DE"
            "it" -> "IT"
            "pt" -> "PT"
            "ko" -> "KO"
            else -> languageCode.take(2).uppercase()
        }
    }
}