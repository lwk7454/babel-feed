package com.babelfeed.app.data.api

import com.babelfeed.app.data.models.Article
import retrofit2.http.GET
import retrofit2.http.Path

interface BabelApiService {
    @GET("articles")
    suspend fun getArticles(): List<Article>

    @GET("articles/{id}")
    suspend fun getArticle(@Path("id") id: String): Article
}