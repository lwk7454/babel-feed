package com.babelfeed.app.ui.screens.article

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.babelfeed.app.R
import com.babelfeed.app.ui.components.LanguageBadge
import com.babelfeed.app.utils.LocaleManager
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleScreen(
    articleId: String,
    onBackClick: () -> Unit,
    onReadFullArticle: (String) -> Unit,
    viewModel: ArticleViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    // Load article when screen is first displayed
    LaunchedEffect(articleId) {
        viewModel.loadArticle(articleId)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { 
                Text(
                    text = stringResource(R.string.article_summary),
                    modifier = Modifier.semantics { contentDescription = "Article Summary Screen" }
                )
            },
            navigationIcon = {
                IconButton(
                    onClick = onBackClick,
                    modifier = Modifier.semantics { contentDescription = "Back" }
                ) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                }
            },
            windowInsets = WindowInsets(0)
        )

        when (uiState) {
            is ArticleUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.semantics { contentDescription = "Loading Article" }
                    )
                }
            }
            is ArticleUiState.Success -> {
                val article = (uiState as ArticleUiState.Success).article
                val context = LocalContext.current
                val localeManager = EntryPointAccessors.fromApplication(
                    context.applicationContext,
                    ArticleLocaleManagerEntryPoint::class.java
                ).localeManager()
                val currentLocale = localeManager.getCurrentLocale(context)
                
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Text(
                            text = article.getLocalizedTitle(currentLocale),
                            style = MaterialTheme.typography.headlineMedium,
                            modifier = Modifier
                                .weight(1f)
                                .padding(bottom = 16.dp)
                                .semantics { contentDescription = "Article Title" }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        LanguageBadge(
                            languageCode = article.getSourceLanguageCode()
                        )
                    }
                    
                    article.getLocalizedSummary(currentLocale)?.let { summary ->
                        Text(
                            text = summary,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(bottom = 16.dp).semantics { contentDescription = "Article Summary" }
                        )
                    }
                    
                    Text(
                        text = stringResource(R.string.source, article.source),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(bottom = 16.dp).semantics { contentDescription = "Article Source" }
                    )
                    
                    Button(
                        onClick = { 
                            android.util.Log.d("ArticleScreen", "Read Full Article clicked - URL: '${article.url}'")
                            android.util.Log.d("ArticleScreen", "URL length: ${article.url.length}")
                            android.util.Log.d("ArticleScreen", "URL encoded: ${java.net.URLEncoder.encode(article.url, "UTF-8")}")
                            onReadFullArticle(article.url) 
                        },
                        modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Read Full Article" }
                    ) {
                        Text(stringResource(R.string.read_full_article))
                    }
                }
            }
            is ArticleUiState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (uiState as ArticleUiState.Error).message,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.semantics { contentDescription = "Error Message" }
                    )
                }
            }
        }
    }
}

@EntryPoint
@InstallIn(SingletonComponent::class)
interface ArticleLocaleManagerEntryPoint {
    fun localeManager(): LocaleManager
}