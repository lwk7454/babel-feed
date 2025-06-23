package com.babelfeed.app.auth

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp interceptor for automatically adding authentication headers
 * and handling token refresh on 401 responses
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: SecureTokenManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        
        // Check if this is an articles endpoint (should not require auth)
        val isArticlesEndpoint = originalRequest.url.encodedPath.contains("/articles")
        
        // Add auth header if user is authenticated and it's not an articles endpoint
        val token = tokenManager.getAccessToken()
        val request = if (token != null && !isArticlesEndpoint) {
            originalRequest.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            originalRequest
        }
        
        val response = chain.proceed(request)
        
        // Handle token refresh on 401 Unauthorized (skip for articles endpoints)
        if (response.code == 401 && token != null && !isArticlesEndpoint) {
            response.close()
            
            // Try to refresh token
            val refreshToken = tokenManager.getRefreshToken()
            if (refreshToken != null) {
                return handleTokenRefresh(chain, originalRequest, refreshToken)
            } else {
                // No refresh token, clear auth and proceed without auth
                tokenManager.clearAuthTokens()
                return chain.proceed(originalRequest)
            }
        }
        
        return response
    }

    private fun handleTokenRefresh(
        chain: Interceptor.Chain,
        originalRequest: okhttp3.Request,
        refreshToken: String
    ): Response {
        // Note: In a real implementation, you might want to handle this differently
        // to avoid blocking the OkHttp thread with coroutines. This is a simplified approach.
        return try {
            runBlocking {
                // Create a temporary API service instance to refresh token
                val newTokens = performTokenRefresh(refreshToken)
                
                if (newTokens != null) {
                    // Update stored tokens
                    tokenManager.storeTokens(
                        accessToken = newTokens.accessToken,
                        refreshToken = newTokens.refreshToken,
                        userId = tokenManager.getUserId(),
                        guestId = tokenManager.getGuestId(),
                        emailVerified = tokenManager.isEmailVerified()
                    )
                    
                    // Retry original request with new token
                    val retryRequest = originalRequest.newBuilder()
                        .header("Authorization", "Bearer ${newTokens.accessToken}")
                        .build()
                    
                    chain.proceed(retryRequest)
                } else {
                    // Refresh failed, clear auth and proceed without auth
                    tokenManager.clearAuthTokens()
                    chain.proceed(originalRequest)
                }
            }
        } catch (e: Exception) {
            // Refresh failed, clear auth and proceed without auth
            tokenManager.clearAuthTokens()
            chain.proceed(originalRequest)
        }
    }

    private suspend fun performTokenRefresh(refreshToken: String): com.babelfeed.app.data.models.AuthTokens? {
        return try {
            // Create a simple HTTP client for token refresh to avoid circular dependencies
            val retrofit = retrofit2.Retrofit.Builder()
                .baseUrl("http://10.0.2.2:3000/api/") // Android emulator localhost
                .addConverterFactory(retrofit2.converter.gson.GsonConverterFactory.create())
                .build()
            
            val refreshService = retrofit.create(RefreshTokenService::class.java)
            val request = com.babelfeed.app.data.models.RefreshTokenRequest(refreshToken)
            val response = refreshService.refreshToken(request)
            
            if (response.success) {
                response.data
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
    
    // Simple service interface for token refresh only
    private interface RefreshTokenService {
        @retrofit2.http.POST("auth/refresh-token")
        suspend fun refreshToken(@retrofit2.http.Body request: com.babelfeed.app.data.models.RefreshTokenRequest): com.babelfeed.app.data.models.RefreshTokenResponse
    }
}