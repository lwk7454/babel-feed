package com.babelfeed.app.utils

import android.content.Context
import com.babelfeed.app.data.models.UserPreferences
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PreferencesManager @Inject constructor(
    private val localeManager: LocaleManager
) {
    
    companion object {
        private const val PREF_APP_LANGUAGE = "app_language"
        private const val PREF_TRANSLATION_AUTO = "translation_auto_enabled"
        private const val PREF_TRANSLATION_TARGET = "translation_target_language"
    }
    
    fun applyPreferences(context: Context, preferences: UserPreferences) {
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        
        // Apply app language
        val appLanguage = preferences.preferredLanguages.firstOrNull() ?: "en"
        if (localeManager.isLanguageSupported(appLanguage)) {
            localeManager.saveLocale(context, appLanguage)
            // Store separately for quick access
            sharedPreferences.edit().putString(PREF_APP_LANGUAGE, appLanguage).apply()
        }
        
        // Store translation settings
        sharedPreferences.edit()
            .putBoolean(PREF_TRANSLATION_AUTO, preferences.translationSettings.autoTranslate)
            .putString(PREF_TRANSLATION_TARGET, preferences.translationSettings.defaultTargetLanguage)
            .apply()
    }
    
    fun getAppLanguage(context: Context): String {
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        return sharedPreferences.getString(PREF_APP_LANGUAGE, localeManager.getCurrentLocale(context)) ?: "en"
    }
    
    fun isAutoTranslationEnabled(context: Context): Boolean {
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        return sharedPreferences.getBoolean(PREF_TRANSLATION_AUTO, true)
    }
    
    fun getTranslationTargetLanguage(context: Context): String {
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        return sharedPreferences.getString(PREF_TRANSLATION_TARGET, getAppLanguage(context)) ?: "en"
    }
    
    fun changeAppLanguage(context: Context, languageCode: String): Boolean {
        if (!localeManager.isLanguageSupported(languageCode)) {
            return false
        }
        
        localeManager.saveLocale(context, languageCode)
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        sharedPreferences.edit().putString(PREF_APP_LANGUAGE, languageCode).apply()
        
        return true
    }
}