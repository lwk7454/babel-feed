package com.babelfeed.app.utils

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.babelfeed.app.ui.theme.LocalLocaleContext
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Composable function to get localized string resources using app's locale setting
 */
@Composable
fun localizedStringResource(@StringRes id: Int, vararg formatArgs: Any): String {
    val localeContext = LocalLocaleContext.current
    val result = localeContext.getString(id, *formatArgs)
    
    // Debug logging - remove after testing
    android.util.Log.d("LocaleManager", "Getting string resource $id with locale: ${localeContext.resources.configuration.locales[0]} -> $result")
    
    return result
}

/**
 * Manages app locale and language switching functionality
 */
@Singleton
class LocaleManager @Inject constructor() {
    
    companion object {
        private const val PREFERENCE_LOCALE = "locale_preference"
        
        /**
         * Default app language when no user preference is set
         */
        const val DEFAULT_LANGUAGE = "en"
        
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
     * Get the current app locale (user's selected language or default)
     */
    fun getCurrentLocale(context: Context): String {
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        return sharedPreferences.getString(PREFERENCE_LOCALE, null) ?: DEFAULT_LANGUAGE
    }
    
    /**
     * Save the selected locale to preferences
     */
    fun saveLocale(context: Context, languageCode: String) {
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        sharedPreferences.edit().putString(PREFERENCE_LOCALE, languageCode).apply()
    }
    
    /**
     * Check if user has explicitly set a language preference
     */
    fun hasUserSelectedLanguage(context: Context): Boolean {
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        return sharedPreferences.contains(PREFERENCE_LOCALE)
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