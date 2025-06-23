package com.babelfeed.app

import android.app.Application
import android.content.Context
import com.babelfeed.app.utils.LocaleManager
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class BabelFeedApplication : Application() {
    
    @Inject
    lateinit var localeManager: LocaleManager
    
    override fun onCreate() {
        super.onCreate()
        // Initialize locale from saved preferences
        val currentLocale = localeManager.getCurrentLocale(this)
        localeManager.setLocale(this, currentLocale)
    }
    
    override fun attachBaseContext(base: Context) {
        // This ensures locale is applied before any UI is created
        val localeManager = LocaleManager()
        val currentLocale = localeManager.getCurrentLocale(base)
        val localizedContext = localeManager.setLocale(base, currentLocale)
        super.attachBaseContext(localizedContext)
    }
}