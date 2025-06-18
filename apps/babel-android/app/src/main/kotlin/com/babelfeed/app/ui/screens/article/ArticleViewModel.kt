package com.babelfeed.app.ui.screens.article

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.babelfeed.app.data.models.Article
import com.babelfeed.app.data.repository.ArticleRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ArticleViewModel @Inject constructor(
    private val articleRepository: ArticleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ArticleUiState>(ArticleUiState.Loading)
    val uiState: StateFlow<ArticleUiState> = _uiState.asStateFlow()

    fun loadArticle(articleId: String) {
        viewModelScope.launch {
            try {
                _uiState.value = ArticleUiState.Loading
                val article = articleRepository.getArticle(articleId)
                if (article != null) {
                    _uiState.value = ArticleUiState.Success(article)
                } else {
                    _uiState.value = ArticleUiState.Error("Article not found")
                }
            } catch (e: Exception) {
                _uiState.value = ArticleUiState.Error(e.message ?: "Unknown error occurred")
            }
        }
    }
}

sealed class ArticleUiState {
    object Loading : ArticleUiState()
    data class Success(val article: Article) : ArticleUiState()
    data class Error(val message: String) : ArticleUiState()
}