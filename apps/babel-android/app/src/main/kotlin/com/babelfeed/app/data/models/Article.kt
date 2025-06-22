package com.babelfeed.app.data.models

data class Article(
    val id: String,
    val title: String,
    val summary: String? = null,
    val url: String,
    val source: String,
    val language: String = "en",
    val publishedAt: String,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val imageUrl: String? = null
)