package com.babelfeed.app.testutils

import com.babelfeed.app.data.models.*

/**
 * Mock API responses for instrumented tests.
 * These responses mirror the actual backend API schemas to ensure accurate testing.
 */
object MockApiResponses {
    
    // Sample test data
    val testUser = User(
        id = "test_user_id",
        email = "test@example.com",
        guestId = "test_guest_id",
        userStatus = "verified",
        emailVerified = true,
        createdAt = "2024-01-01T00:00:00Z",
        updatedAt = "2024-01-01T00:00:00Z"
    )
    
    val testUserPreferences = UserPreferences(
        userId = "test_user_id",
        preferredLanguages = listOf("en"),
        feedCategories = emptyList(),
        translationSettings = TranslationSettings(
            autoTranslate = true,
            defaultTargetLanguage = "en"
        ),
        themePreference = "system",
        notificationSettings = NotificationSettings(
            emailNotifications = true,
            pushNotifications = false
        ),
        privacySettings = PrivacySettings(
            analytics = true,
            personalization = true
        ),
        updatedAt = "2024-01-01T00:00:00Z"
    )
    
    val testArticles = listOf(
        Article(
            id = "article_1",
            title = "Test Article 1",
            titleTranslations = mapOf(
                "en" to "Test Article 1",
                "zh-CN" to "测试文章1",
                "ja" to "テスト記事1"
            ),
            summary = "Test summary 1",
            summaryTranslations = mapOf(
                "en" to "Test summary 1",
                "zh-CN" to "测试摘要1"
            ),
            url = "https://example.com/article1",
            source = "Test Source",
            sourceLanguage = "en",
            publishedAt = "2024-01-01T00:00:00Z"
        ),
        Article(
            id = "article_2",
            title = "Japanese Article",
            titleTranslations = mapOf(
                "ja" to "Japanese Article",
                "en" to "Japanese Article Translated"
            ),
            summary = "Japanese summary",
            url = "https://example.com/article2",
            source = "Japanese Source",
            sourceLanguage = "ja",
            publishedAt = "2024-01-02T00:00:00Z"
        )
    )
    
    // Mock API Response Objects
    
    // Guest creation
    fun createGuestResponse() = CreateGuestResponse(
        success = true,
        data = GuestData(
            guestId = "test_guest_id",
            userId = "test_user_id",
            createdAt = "2024-01-01T00:00:00Z"
        ),
        message = "Guest profile created successfully"
    )
    
    // Start verification
    fun startVerificationResponse(isExistingUser: Boolean = false) = StartVerificationResponse(
        success = true,
        data = StartVerificationData(
            userId = "test_user_id",
            email = "test@example.com",
            verificationSent = true,
            isExistingUser = isExistingUser
        ),
        message = if (isExistingUser) {
            "Verification code sent to your email address."
        } else {
            "Account created successfully. Please check your email for verification."
        }
    )
    
    // Email verification success
    fun verifyEmailResponse(includePreferences: Boolean = false) = VerifyEmailResponse(
        success = true,
        data = VerificationData(
            user = testUser,
            accessToken = "mock_access_token",
            refreshToken = "mock_refresh_token",
            preferences = if (includePreferences) testUserPreferences else null
        ),
        message = "Email verified successfully"
    )
    
    // Email verification failure
    fun verifyEmailErrorResponse() = VerifyEmailResponse(
        success = false,
        data = null,
        message = null,
        error = ApiError(
            code = "INVALID_VERIFICATION_TOKEN",
            message = "Invalid or expired verification token",
            details = "Please request a new verification code."
        )
    )
    
    // Resend verification success
    fun resendVerificationResponse() = ApiResponse<Unit>(
        success = true,
        data = null,
        message = "Verification code sent successfully"
    )
    
    // Resend verification failure
    fun resendVerificationErrorResponse() = ApiResponse<Unit>(
        success = false,
        data = null,
        message = null,
        error = ApiError(
            code = "USER_NOT_FOUND",
            message = "User not found",
            details = "No account found with this email address."
        )
    )
    
    // Token refresh
    fun refreshTokenResponse() = RefreshTokenResponse(
        success = true,
        data = AuthTokens(
            accessToken = "new_access_token",
            refreshToken = "new_refresh_token"
        ),
        message = "Tokens refreshed successfully"
    )
    
    // Profile response
    fun profileResponse() = ProfileResponse(
        success = true,
        data = testUser
    )
    
    // User preferences response
    fun preferencesResponse() = PreferencesResponse(
        success = true,
        data = testUserPreferences,
        message = null
    )
    
    // User preferences empty response
    fun emptyPreferencesResponse() = PreferencesResponse(
        success = true,
        data = null,
        message = null
    )
    
    // Auth status response
    fun authStatusResponse(authenticated: Boolean = true) = AuthStatusResponse(
        success = true,
        data = AuthStatus(
            authenticated = authenticated,
            emailVerified = authenticated,
            userId = if (authenticated) "test_user_id" else null
        )
    )
    
    // Articles response
    fun articlesResponse() = ArticlesResponse(
        success = true,
        data = testArticles,
        pagination = Pagination(
            total = testArticles.size,
            limit = 20,
            offset = 0,
            hasMore = false
        )
    )
    
    // Empty articles response
    fun emptyArticlesResponse() = ArticlesResponse(
        success = true,
        data = emptyList(),
        pagination = Pagination(
            total = 0,
            limit = 20,
            offset = 0,
            hasMore = false
        )
    )
    
    // Single article response
    fun articleResponse(articleId: String = "article_1") = ArticleResponse(
        success = true,
        data = testArticles.find { it.id == articleId },
        error = null
    )
    
    // Article not found response
    fun articleNotFoundResponse() = ArticleResponse(
        success = false,
        data = null,
        error = "Article not found"
    )
    
    // Logout response
    fun logoutResponse() = ApiResponse<Unit>(
        success = true,
        data = null,
        message = "Logged out successfully"
    )
}