package com.babelfeed.app.data.api

import com.babelfeed.app.data.models.*
import retrofit2.http.*

interface BabelApiService {
    // Articles endpoints
    @GET("articles")
    suspend fun getArticles(): List<Article>

    @GET("articles/{id}")
    suspend fun getArticle(@Path("id") id: String): Article
    
    // Authentication endpoints
    @POST("auth/guest")
    suspend fun createGuest(@Body request: CreateGuestRequest): CreateGuestResponse
    
    @POST("auth/create-account")
    suspend fun createAccount(@Body request: CreateAccountRequest): CreateAccountResponse
    
    @POST("auth/verify")
    suspend fun verifyEmail(@Body request: VerifyEmailRequest): VerifyEmailResponse
    
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
    
    @GET("auth/status")
    suspend fun getAuthStatus(): AuthStatusResponse
}