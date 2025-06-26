package com.babelfeed.app.ui.screens.feed

import android.util.Log
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.babelfeed.app.R
import com.babelfeed.app.utils.localizedStringResource
import com.babelfeed.app.data.models.Article
import com.babelfeed.app.ui.components.LanguageBadge
import com.babelfeed.app.utils.LocaleManager
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    onArticleClick: (String) -> Unit,
    onReadFullArticle: (String) -> Unit,
    onProfileClick: () -> Unit,
    viewModel: FeedViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(localizedStringResource(R.string.app_name)) },
            actions = {
                IconButton(onClick = onProfileClick) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = localizedStringResource(R.string.profile)
                    )
                }
            },
            windowInsets = WindowInsets(0)
        )

        when (uiState) {
            is FeedUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is FeedUiState.Success -> {
                val articles = (uiState as FeedUiState.Success).articles
                Log.d("FeedScreen", "Rendering Success state with ${articles.size} articles")
                if (articles.isEmpty()) {
                    Log.d("FeedScreen", "Articles list is empty, showing 'No articles available'")
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = localizedStringResource(R.string.no_articles_available),
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                } else {
                    Log.d("FeedScreen", "Rendering LazyColumn with ${articles.size} articles")
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(articles) { article ->
                            Log.d("FeedScreen", "Rendering article: ${article.title}")
                            ArticleCard(
                                article = article,
                                onClick = { onArticleClick(article.id) },
                                onReadFullArticle = { onReadFullArticle(article.url) }
                            )
                        }
                    }
                }
            }
            is FeedUiState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (uiState as FeedUiState.Error).message,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleCard(
    article: Article,
    onClick: () -> Unit,
    onReadFullArticle: () -> Unit
) {
    val context = LocalContext.current
    val localeManager = EntryPointAccessors.fromApplication(
        context.applicationContext,
        LocaleManagerEntryPoint::class.java
    ).localeManager()
    val currentLocale = localeManager.getCurrentLocale(context)
    
    Log.d("ArticleCard", "Rendering article card for: ${article.title} with locale: $currentLocale")
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = article.getLocalizedTitle(currentLocale),
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                LanguageBadge(
                    languageCode = article.getSourceLanguageCode()
                )
            }
            article.getLocalizedSummary(currentLocale)?.let { summary ->
                Text(
                    text = summary,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            Text(
                text = localizedStringResource(R.string.source, article.source),
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

@EntryPoint
@InstallIn(SingletonComponent::class)
interface LocaleManagerEntryPoint {
    fun localeManager(): LocaleManager
}