package com.babelfeed.app.ui.screens.welcome

import android.content.Context
import androidx.lifecycle.ViewModel
import com.babelfeed.app.utils.LocaleManager
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class WelcomeViewModel @Inject constructor(
    private val localeManager: LocaleManager
) : ViewModel() {
    
    companion object {
        private const val PREF_WELCOME_COMPLETED = "welcome_completed"
    }
    
    fun saveLanguagePreference(context: Context, languageCode: String) {
        // Save language preference
        localeManager.saveLocale(context, languageCode)
        
        // Mark welcome screen as completed
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        sharedPreferences.edit().putBoolean(PREF_WELCOME_COMPLETED, true).apply()
    }
    
    fun isWelcomeCompleted(context: Context): Boolean {
        val sharedPreferences = context.getSharedPreferences("app_preferences", Context.MODE_PRIVATE)
        return sharedPreferences.getBoolean(PREF_WELCOME_COMPLETED, false)
    }
    
    fun getSystemLanguage(): String {
        return localeManager.getCurrentLocale(android.app.Application())
    }
}