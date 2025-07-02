package com.babelfeed.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.babelfeed.app.ui.screens.feed.FeedScreen
import com.babelfeed.app.ui.screens.article.ArticleScreen
import com.babelfeed.app.ui.screens.webview.WebViewScreen
import com.babelfeed.app.ui.screens.profile.ProfileScreen
import com.babelfeed.app.ui.screens.welcome.WelcomeScreen
import com.babelfeed.app.ui.screens.verify.VerificationScreen
import com.babelfeed.app.ui.screens.welcome.WelcomeViewModel
import androidx.hilt.navigation.compose.hiltViewModel
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.components.ActivityComponent
import androidx.compose.ui.platform.LocalContext
import com.babelfeed.app.webview.StreamingTranslationService
import com.babelfeed.app.utils.LocaleManager
import com.babelfeed.app.auth.AuthenticationManager
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn

@EntryPoint
@InstallIn(ActivityComponent::class)
interface TranslationServiceEntryPoint {
    fun translationService(): StreamingTranslationService
}

@EntryPoint
@InstallIn(ActivityComponent::class)
interface AuthenticationEntryPoint {
    fun authenticationManager(): AuthenticationManager
}

@Composable
fun BabelFeedNavigation(
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController()
) {
    val context = LocalContext.current
    val welcomeViewModel: WelcomeViewModel = hiltViewModel()
    var isWelcomeCompleted by remember { mutableStateOf(false) }
    var isCheckingWelcome by remember { mutableStateOf(true) }
    
    LaunchedEffect(Unit) {
        // Initialize AuthenticationManager early to ensure proper token state
        val authManager = EntryPointAccessors
            .fromActivity(context as android.app.Activity, AuthenticationEntryPoint::class.java)
            .authenticationManager()
        
        // Trigger initialization by accessing the auth state
        authManager.authState.value
        
        isWelcomeCompleted = welcomeViewModel.isWelcomeCompleted(context)
        isCheckingWelcome = false
    }
    
    if (isCheckingWelcome) {
        // Show loading or empty state while checking
        return
    }
    
    NavHost(
        navController = navController,
        startDestination = if (isWelcomeCompleted) "feed" else "welcome",
        modifier = modifier
    ) {
        composable("welcome") {
            WelcomeScreen(
                onLanguageSelected = { languageCode ->
                    // Apply locale immediately
                    val localeManager = LocaleManager()
                    localeManager.setLocale(context, languageCode)
                    
                    // Navigate to feed
                    navController.navigate("feed") {
                        popUpTo("welcome") { inclusive = true }
                    }
                }
            )
        }
        composable("feed") {
            FeedScreen(
                onArticleClick = { articleId ->
                    navController.navigate("article/$articleId")
                },
                onReadFullArticle = { url ->
                    android.util.Log.d("Navigation", "FeedScreen - Navigating to webview with URL: '$url'")
                    val encodedUrl = java.net.URLEncoder.encode(url, "UTF-8")
                    android.util.Log.d("Navigation", "FeedScreen - URL encoded for navigation: 'webview?url=$encodedUrl'")
                    navController.navigate("webview?url=$encodedUrl")
                },
                onProfileClick = {
                    navController.navigate("profile")
                }
            )
        }
        
        composable("article/{articleId}") { backStackEntry ->
            val articleId = backStackEntry.arguments?.getString("articleId") ?: ""
            ArticleScreen(
                articleId = articleId,
                onBackClick = { navController.popBackStack() },
                onReadFullArticle = { url ->
                    android.util.Log.d("Navigation", "ArticleScreen - Navigating to webview with URL: '$url'")
                    val encodedUrl = java.net.URLEncoder.encode(url, "UTF-8")
                    android.util.Log.d("Navigation", "URL encoded for navigation: 'webview?url=$encodedUrl'")
                    navController.navigate("webview?url=$encodedUrl")
                }
            )
        }
        
        composable("webview?url={url}") { backStackEntry ->
            val encodedUrl = backStackEntry.arguments?.getString("url") ?: ""
            val url = java.net.URLDecoder.decode(encodedUrl, "UTF-8")
            android.util.Log.d("Navigation", "WebViewScreen - Received encoded URL parameter: '$encodedUrl'")
            android.util.Log.d("Navigation", "WebViewScreen - Decoded URL: '$url'")
            android.util.Log.d("Navigation", "URL length: ${url.length}")
            val webViewContext = LocalContext.current
            val translationService = EntryPointAccessors
                .fromActivity(webViewContext as android.app.Activity, TranslationServiceEntryPoint::class.java)
                .translationService()
            WebViewScreen(
                url = url,
                onBackClick = { navController.popBackStack() },
                translationService = translationService
            )
        }
        
        composable("profile") {
            ProfileScreen(
                onBackClick = { navController.popBackStack() },
                onNavigateToVerification = { email ->
                    val encodedEmail = java.net.URLEncoder.encode(email, "UTF-8")
                    navController.navigate("verification/$encodedEmail")
                },
                onNavigateToWelcome = {
                    navController.navigate("welcome") {
                        popUpTo("feed") { inclusive = true }
                    }
                }
            )
        }
        
        composable("verification/{email}") { backStackEntry ->
            val encodedEmail = backStackEntry.arguments?.getString("email") ?: ""
            val email = java.net.URLDecoder.decode(encodedEmail, "UTF-8")
            VerificationScreen(
                email = email,
                onBackClick = { navController.popBackStack() },
                onVerificationSuccess = {
                    navController.popBackStack()
                }
            )
        }
    }
}