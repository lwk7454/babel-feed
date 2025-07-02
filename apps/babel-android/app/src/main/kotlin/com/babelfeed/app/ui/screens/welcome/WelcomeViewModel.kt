package com.babelfeed.app.ui.screens.welcome

import android.content.Context
import androidx.lifecycle.ViewModel
import com.babelfeed.app.utils.LocaleManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class WelcomeViewModel @Inject constructor(
    val localeManager: LocaleManager
) : ViewModel() {
    
    companion object {
        private const val PREF_WELCOME_COMPLETED = "welcome_completed"
    }
    
    private val _shouldRecreateActivity = MutableStateFlow(false)
    val shouldRecreateActivity: StateFlow<Boolean> = _shouldRecreateActivity.asStateFlow()
    
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
    
    fun previewLanguageChange(context: Context, languageCode: String) {
        // Save language preference immediately for UI reflection
        localeManager.saveLocale(context, languageCode)
        // Trigger activity recreation to apply language change
        _shouldRecreateActivity.value = true
    }
    
    fun onActivityRecreated() {
        _shouldRecreateActivity.value = false
    }
}