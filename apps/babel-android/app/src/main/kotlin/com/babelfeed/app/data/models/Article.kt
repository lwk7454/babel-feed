package com.babelfeed.app.data.models

import com.google.gson.annotations.SerializedName

data class Article(
    @SerializedName("id")
    val id: String,
    
    @SerializedName("title")
    val title: String,
    
    @SerializedName("titleTranslations")
    val titleTranslations: Map<String, String> = emptyMap(),
    
    @SerializedName("summary")
    val summary: String? = null,
    
    @SerializedName("summaryTranslations") 
    val summaryTranslations: Map<String, String> = emptyMap(),
    
    @SerializedName("url")
    val url: String,
    
    @SerializedName("source")
    val source: String,
    
    @SerializedName("language")
    val sourceLanguage: String = "en",
    
    @SerializedName("availableLanguages")
    val availableLanguages: List<String> = listOf("en"),
    
    @SerializedName("publishedAt")
    val publishedAt: String,
    
    @SerializedName("createdAt")
    val createdAt: String? = null,
    
    @SerializedName("updatedAt")
    val updatedAt: String? = null,
    
    @SerializedName("imageUrl")
    val imageUrl: String? = null
) {
    /**
     * Get localized title based on preferred language
     */
    fun getLocalizedTitle(preferredLanguage: String): String {
        return titleTranslations[preferredLanguage] ?: title
    }
    
    /**
     * Get localized summary based on preferred language
     */
    fun getLocalizedSummary(preferredLanguage: String): String? {
        return summaryTranslations[preferredLanguage] ?: summary
    }
    
    /**
     * Check if translation is available for given language
     */
    fun hasTranslation(languageCode: String): Boolean {
        return availableLanguages.contains(languageCode)
    }
    
    /**
     * Get display language code for badges (e.g., "EN", "ZH", "JA")  
     */
    fun getSourceLanguageCode(): String {
        return when (sourceLanguage.lowercase()) {
            "en" -> "EN"
            "zh-cn", "zh-tw" -> "ZH"
            "ja" -> "JA"
            "es" -> "ES"
            "fr" -> "FR"
            "de" -> "DE"
            "it" -> "IT"
            "pt" -> "PT"
            "ko" -> "KO"
            else -> sourceLanguage.take(2).uppercase()
        }
    }
}