package com.babelfeed.app.data.repository

import com.babelfeed.app.data.api.BabelApiService
import com.babelfeed.app.data.models.Article
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ArticleRepository @Inject constructor(
    private val apiService: BabelApiService
) {
    suspend fun getArticles(): List<Article> {
        return try {
            apiService.getArticles()
        } catch (e: Exception) {
            // Return mock data for now
            getMockArticles()
        }
    }

    suspend fun getArticle(id: String): Article? {
        return try {
            apiService.getArticle(id)
        } catch (e: Exception) {
            // Return mock data for now
            getMockArticles().find { it.id == id }
        }
    }

    private fun getMockArticles(): List<Article> {
        return listOf(
            Article(
                id = "1",
                title = "Global Climate Summit Reaches Historic Agreement",
                summary = "World leaders agree on ambitious climate action plan with binding commitments for carbon reduction by 2030.",
                url = "file:///android_asset/test-page.html",
                source = "Global News Network",
                publishedAt = "2024-06-18T10:30:00Z"
            ),
            Article(
                id = "2", 
                title = "Test Translation Error Handling",
                summary = "This page will trigger translation errors to test the error banner functionality.",
                url = "file:///android_asset/test-error-page.html",
                source = "Test Source",
                publishedAt = "2024-06-18T09:15:00Z"
            ),
            Article(
                id = "3",
                title = "New Archaeological Discovery Rewrites Ancient History",
                summary = "Recent excavations uncover evidence of advanced civilization dating back 10,000 years earlier than previously thought.",
                url = "https://www.nationalgeographic.com/science/article/archaeology",
                source = "Science Weekly",
                publishedAt = "2024-06-18T08:00:00Z"
            )
        )
    }
}