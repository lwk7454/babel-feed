package com.babelfeed.app.data.models

import com.google.gson.annotations.SerializedName

/**
 * User data model representing a user profile
 */
data class User(
    @SerializedName("id")
    val id: String,
    
    @SerializedName("email")
    val email: String? = null,
    
    @SerializedName("guestId")
    val guestId: String? = null,
    
    @SerializedName("emailVerified")
    val emailVerified: Boolean = false,
    
    @SerializedName("userStatus")
    val userStatus: String = "guest", // guest, verified, vip
    
    @SerializedName("createdAt")
    val createdAt: String,
    
    @SerializedName("updatedAt")
    val updatedAt: String
)

/**
 * Authentication tokens
 */
data class AuthTokens(
    @SerializedName("accessToken")
    val accessToken: String,
    
    @SerializedName("refreshToken")
    val refreshToken: String
)

/**
 * User preferences data model
 */
data class UserPreferences(
    @SerializedName("userId")
    val userId: String,
    
    @SerializedName("preferredLanguages")
    val preferredLanguages: List<String> = listOf("en"),
    
    @SerializedName("feedCategories")
    val feedCategories: List<String> = emptyList(),
    
    @SerializedName("translationSettings")
    val translationSettings: TranslationSettings = TranslationSettings(),
    
    @SerializedName("themePreference")
    val themePreference: String = "system",
    
    @SerializedName("notificationSettings")
    val notificationSettings: NotificationSettings = NotificationSettings(),
    
    @SerializedName("privacySettings")
    val privacySettings: PrivacySettings = PrivacySettings(),
    
    @SerializedName("updatedAt")
    val updatedAt: String
)

/**
 * Translation settings
 */
data class TranslationSettings(
    @SerializedName("autoTranslate")
    val autoTranslate: Boolean = true,
    
    @SerializedName("defaultTargetLanguage")
    val defaultTargetLanguage: String = "en"
)

/**
 * Notification settings
 */
data class NotificationSettings(
    @SerializedName("emailNotifications")
    val emailNotifications: Boolean = false,
    
    @SerializedName("pushNotifications")
    val pushNotifications: Boolean = false
)

/**
 * Privacy settings
 */
data class PrivacySettings(
    @SerializedName("analytics")
    val analytics: Boolean = false,
    
    @SerializedName("personalization")
    val personalization: Boolean = true
)