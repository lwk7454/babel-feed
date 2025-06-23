package com.babelfeed.app.data.repository

import android.util.Log
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
            Log.d("ArticleRepository", "Calling API for articles with limit=$limit, offset=$offset")
            val response = apiService.getArticles(limit, offset, language, search)
            Log.d("ArticleRepository", "API response: success=${response.success}, articles count=${response.data.size}")
            if (response.success) {
                response.data
            } else {
                Log.w("ArticleRepository", "API response was not successful")
                emptyList()
            }
        } catch (e: Exception) {
            Log.e("ArticleRepository", "Exception calling articles API", e)
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