package com.babelfeed.app.data.api

import com.babelfeed.app.data.models.*
import retrofit2.http.*

interface BabelApiService {
    // Articles endpoints
    @GET("articles")
    suspend fun getArticles(
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null,
        @Query("language") language: String? = null,
        @Query("search") search: String? = null
    ): ArticlesResponse

    @GET("articles/{id}")
    suspend fun getArticle(@Path("id") id: String): ArticleResponse
    
    // Translation endpoints
    @POST("translation/stream")
    suspend fun translateStream(@Body request: BackendTranslationRequest): BackendTranslationResponse
    
    @POST("translation/translate")
    suspend fun translate(@Body request: BackendTranslationRequest): BackendTranslationResponse
    
    @POST("translation/batch")
    @Streaming
    suspend fun translateBatched(@Body request: BatchedTranslationRequest): okhttp3.ResponseBody
    
    @GET("translation/languages")
    suspend fun getSupportedLanguages(): SupportedLanguagesResponse
    
    @GET("translation/models")
    suspend fun getTranslationModels(): TranslationModelsResponse
    
    // Authentication endpoints
    @POST("auth/guest")
    suspend fun createGuest(@Body request: CreateGuestRequest): CreateGuestResponse
    
    @POST("auth/start-verification")
    suspend fun startVerification(@Body request: StartVerificationRequest): retrofit2.Response<StartVerificationResponse>
    
    @POST("auth/verify")
    suspend fun verifyEmail(@Body request: VerifyEmailRequest): retrofit2.Response<VerifyEmailResponse>
    
    @POST("auth/resend-verification")
    suspend fun resendVerificationCode(@Body request: ResendVerificationRequest): ApiResponse<Unit>
    
    @POST("auth/refresh")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): RefreshTokenResponse
    
    @POST("auth/logout")
    suspend fun logout(): ApiResponse<Unit>
    
    @GET("auth/profile")
    suspend fun getProfile(): ProfileResponse
    
    @GET("auth/preferences")
    suspend fun getPreferences(): PreferencesResponse
    
    @PUT("auth/preferences")
    suspend fun updatePreferences(@Body preferences: UserPreferences): PreferencesResponse
    
    @POST("auth/save-settings")
    suspend fun saveSettings(@Body preferences: UserPreferences): PreferencesResponse
    
    @GET("auth/status")
    suspend fun getAuthStatus(): AuthStatusResponse
}