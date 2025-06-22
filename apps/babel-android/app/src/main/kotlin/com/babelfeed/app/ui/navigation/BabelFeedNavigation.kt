package com.babelfeed.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.babelfeed.app.ui.screens.feed.FeedScreen
import com.babelfeed.app.ui.screens.article.ArticleScreen
import com.babelfeed.app.ui.screens.webview.WebViewScreen
import com.babelfeed.app.ui.screens.profile.ProfileScreen

@Composable
fun BabelFeedNavigation(
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController()
) {
    NavHost(
        navController = navController,
        startDestination = "feed",
        modifier = modifier
    ) {
        composable("feed") {
            FeedScreen(
                onArticleClick = { articleId ->
                    navController.navigate("article/$articleId")
                },
                onReadFullArticle = { url ->
                    navController.navigate("webview?url=$url")
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
                    navController.navigate("webview?url=$url")
                }
            )
        }
        
        composable("webview?url={url}") { backStackEntry ->
            val url = backStackEntry.arguments?.getString("url") ?: ""
            WebViewScreen(
                url = url,
                onBackClick = { navController.popBackStack() }
            )
        }
        
        composable("profile") {
            ProfileScreen()
        }
    }
}