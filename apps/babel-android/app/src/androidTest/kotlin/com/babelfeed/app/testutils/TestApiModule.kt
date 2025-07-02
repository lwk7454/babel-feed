package com.babelfeed.app.testutils

import com.babelfeed.app.data.api.BabelApiService
import com.babelfeed.app.data.models.*
import dagger.Module
import dagger.Provides
import dagger.hilt.components.SingletonComponent
import dagger.hilt.testing.TestInstallIn
import javax.inject.Singleton
import kotlinx.coroutines.delay
import retrofit2.Response
import com.babelfeed.app.di.NetworkModule

/**
 * Test module that replaces the NetworkModule for instrumented tests.
 * Provides mocked API implementations to avoid real network calls.
 */
@Module
@TestInstallIn(
    components = [SingletonComponent::class],
    replaces = [NetworkModule::class]
)
object TestApiModule {

    @Provides
    @Singleton
    fun provideBabelApiService(): BabelApiService = object : BabelApiService {
        
        // Articles endpoints
        override suspend fun getArticles(
            limit: Int?,
            offset: Int?,
            language: String?,
            search: String?
        ): ArticlesResponse {
            // Log that mock is being used
            println("TestApiModule: getArticles called with limit=$limit, offset=$offset, language=$language, search=$search")
            
            // Simulate network delay
            delay(100)
            
            return when {
                search == "empty" -> MockApiResponses.emptyArticlesResponse()
                search == "error" -> throw Exception("Network error")
                else -> MockApiResponses.articlesResponse()
            }
        }

        override suspend fun getArticle(id: String): ArticleResponse {
            delay(50)
            
            return when (id) {
                "not_found" -> MockApiResponses.articleNotFoundResponse()
                "error" -> throw Exception("Network error")
                else -> MockApiResponses.articleResponse(id)
            }
        }
        
        // Translation endpoints (not used in current tests but needed for interface)
        override suspend fun translateStream(request: BackendTranslationRequest): BackendTranslationResponse {
            TODO("Not implemented in mock")
        }
        
        override suspend fun translate(request: BackendTranslationRequest): BackendTranslationResponse {
            TODO("Not implemented in mock")
        }
        
        override suspend fun translateBatched(request: BatchedTranslationRequest): okhttp3.ResponseBody {
            TODO("Not implemented in mock")
        }
        
        override suspend fun getSupportedLanguages(): SupportedLanguagesResponse {
            TODO("Not implemented in mock")
        }
        
        override suspend fun getTranslationModels(): TranslationModelsResponse {
            TODO("Not implemented in mock")
        }
        
        // Authentication endpoints
        override suspend fun createGuest(request: CreateGuestRequest): CreateGuestResponse {
            println("TestApiModule: createGuest called with deviceFingerprint=${request.deviceFingerprint}")
            delay(200)
            return MockApiResponses.createGuestResponse()
        }
        
        override suspend fun startVerification(request: StartVerificationRequest): Response<StartVerificationResponse> {
            delay(300)
            
            return when (request.email) {
                "error@example.com" -> Response.error(500, 
                    okhttp3.ResponseBody.create(null, "Internal server error"))
                "notfound@example.com" -> Response.error(404,
                    okhttp3.ResponseBody.create(null, "Guest user not found"))
                "existing@example.com" -> Response.success(
                    MockApiResponses.startVerificationResponse(isExistingUser = true))
                else -> Response.success(
                    MockApiResponses.startVerificationResponse(isExistingUser = false))
            }
        }
        
        override suspend fun verifyEmail(request: VerifyEmailRequest): Response<VerifyEmailResponse> {
            delay(250)
            
            return when (request.verificationToken) {
                "0000" -> Response.error(400, 
                    okhttp3.ResponseBody.create(null, "Invalid verification code"))
                "invalid" -> Response.success(MockApiResponses.verifyEmailErrorResponse())
                "1234" -> Response.success(MockApiResponses.verifyEmailResponse(includePreferences = false))
                "existing_user" -> Response.success(MockApiResponses.verifyEmailResponse(includePreferences = true))
                else -> Response.success(MockApiResponses.verifyEmailResponse())
            }
        }
        
        override suspend fun resendVerificationCode(request: ResendVerificationRequest): ApiResponse<Unit> {
            delay(200)
            
            return when (request.email) {
                "notfound@example.com" -> MockApiResponses.resendVerificationErrorResponse()
                else -> MockApiResponses.resendVerificationResponse()
            }
        }
        
        override suspend fun refreshToken(request: RefreshTokenRequest): RefreshTokenResponse {
            delay(100)
            
            return when (request.refreshToken) {
                "invalid_token" -> throw Exception("Invalid refresh token")
                else -> MockApiResponses.refreshTokenResponse()
            }
        }
        
        override suspend fun logout(): ApiResponse<Unit> {
            delay(100)
            return MockApiResponses.logoutResponse()
        }
        
        override suspend fun getProfile(): ProfileResponse {
            delay(100)
            return MockApiResponses.profileResponse()
        }
        
        override suspend fun getPreferences(): PreferencesResponse {
            delay(150)
            return MockApiResponses.preferencesResponse()
        }
        
        override suspend fun updatePreferences(preferences: UserPreferences): PreferencesResponse {
            delay(200)
            return MockApiResponses.preferencesResponse()
        }
        
        override suspend fun saveSettings(preferences: UserPreferences): PreferencesResponse {
            delay(250)
            return MockApiResponses.preferencesResponse()
        }
        
        override suspend fun getAuthStatus(): AuthStatusResponse {
            delay(50)
            return MockApiResponses.authStatusResponse()
        }
    }
}