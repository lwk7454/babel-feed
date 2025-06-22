package com.babelfeed.app.data.models

data class ArticlesResponse(
    val success: Boolean,
    val data: List<Article>,
    val pagination: Pagination? = null
)

data class ArticleResponse(
    val success: Boolean,
    val data: Article? = null,
    val error: String? = null
)

data class Pagination(
    val total: Int,
    val limit: Int,
    val offset: Int,
    val hasMore: Boolean
)