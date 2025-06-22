package com.babelfeed.app.data.repository

import com.babelfeed.app.data.api.BabelApiService
import com.babelfeed.app.data.models.Article
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ArticleRepository @Inject constructor(
    private val apiService: BabelApiService
) {
    suspend fun getArticles(
        limit: Int = 20,
        offset: Int = 0,
        language: String? = null,
        search: String? = null
    ): List<Article> {
        return try {
            val response = apiService.getArticles(limit, offset, language, search)
            if (response.success) {
                response.data
            } else {
                emptyList()
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getArticle(id: String): Article? {
        return try {
            val response = apiService.getArticle(id)
            if (response.success) {
                response.data
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

}