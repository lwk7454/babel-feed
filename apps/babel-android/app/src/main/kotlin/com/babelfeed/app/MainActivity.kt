package com.babelfeed.app

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import com.babelfeed.app.ui.navigation.BabelFeedNavigation
import com.babelfeed.app.ui.theme.BabelFeedTheme
import com.babelfeed.app.utils.LocaleManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    
    @Inject
    lateinit var localeManager: LocaleManager
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Configure system bars for dark mode
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(
                scrim = android.graphics.Color.TRANSPARENT
            ),
            navigationBarStyle = SystemBarStyle.dark(
                scrim = android.graphics.Color.TRANSPARENT
            )
        )
        
        setContent {
            BabelFeedTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    Scaffold(
                        modifier = Modifier.fillMaxSize()
                    ) { innerPadding ->
                        BabelFeedNavigation(
                            modifier = Modifier.padding(innerPadding)
                        )
                    }
                }
            }
        }
    }
    
    override fun attachBaseContext(newBase: Context) {
        val localeManager = LocaleManager()
        val currentLocale = localeManager.getCurrentLocale(newBase)
        val localizedContext = localeManager.setLocale(newBase, currentLocale)
        super.attachBaseContext(localizedContext)
    }
}