package com.babelfeed.app.data.models

data class Article(
    val id: String,
    val title: String,
    val summary: String,
    val url: String,
    val source: String,
    val publishedAt: String,
    val imageUrl: String? = null
)