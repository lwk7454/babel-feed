package com.babelfeed.app.ui.screens.feed

import android.util.Log
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
class FeedViewModel @Inject constructor(
    private val articleRepository: ArticleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<FeedUiState>(FeedUiState.Loading)
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()

    init {
        loadArticles()
    }

    private fun loadArticles() {
        viewModelScope.launch {
            try {
                Log.d("FeedViewModel", "Starting to load articles...")
                _uiState.value = FeedUiState.Loading
                val articles = articleRepository.getArticles()
                Log.d("FeedViewModel", "Loaded ${articles.size} articles from repository")
                _uiState.value = FeedUiState.Success(articles)
            } catch (e: Exception) {
                Log.e("FeedViewModel", "Error loading articles", e)
                _uiState.value = FeedUiState.Error("Failed to load articles: ${e.message}")
            }
        }
    }

    fun refreshArticles() {
        loadArticles()
    }
}

sealed class FeedUiState {
    object Loading : FeedUiState()
    data class Success(val articles: List<Article>) : FeedUiState()
    data class Error(val message: String) : FeedUiState()
}