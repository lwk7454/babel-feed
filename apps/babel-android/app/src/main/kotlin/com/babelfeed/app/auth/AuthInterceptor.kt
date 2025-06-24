package com.babelfeed.app.auth

import android.util.Log
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
        val path = originalRequest.url.encodedPath
        
        // Only articles endpoints should NOT require auth, everything else should use auth if available
        val isArticlesEndpoint = path.contains("/api/articles") && !path.contains("/api/auth")
        val shouldUseAuth = !isArticlesEndpoint && tokenManager.getAccessToken() != null
        
        Log.d("AuthInterceptor", "Path: $path, isArticlesEndpoint: $isArticlesEndpoint, shouldUseAuth: $shouldUseAuth")
        
        // Add auth header if we should use auth
        val token = tokenManager.getAccessToken()
        val request = if (shouldUseAuth && token != null) {
            Log.d("AuthInterceptor", "Adding auth header for path: $path")
            originalRequest.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            Log.d("AuthInterceptor", "No auth header for path: $path")
            originalRequest
        }
        
        val response = chain.proceed(request)
        
        // Handle token refresh on 401 Unauthorized (only for endpoints that should use auth)
        if (response.code == 401 && shouldUseAuth && token != null) {
            Log.d("AuthInterceptor", "Got 401 for authenticated request, attempting token refresh")
            response.close()
            
            // Try to refresh token
            val refreshToken = tokenManager.getRefreshToken()
            if (refreshToken != null) {
                return handleTokenRefresh(chain, originalRequest, refreshToken)
            } else {
                Log.w("AuthInterceptor", "No refresh token available, clearing auth")
                // No refresh token, clear auth and proceed without auth
                tokenManager.clearAuthTokens()
                return chain.proceed(originalRequest)
            }
        }
        
        if (response.code == 401 && shouldUseAuth) {
            Log.w("AuthInterceptor", "Got 401 for path $path - authentication failed")
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
                Log.d("AuthInterceptor", "Attempting token refresh")
                // Create a temporary API service instance to refresh token
                val newTokens = performTokenRefresh(refreshToken)
                
                if (newTokens != null) {
                    Log.d("AuthInterceptor", "Token refresh successful")
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
                    Log.w("AuthInterceptor", "Token refresh failed, clearing auth")
                    // Refresh failed, clear auth and proceed without auth
                    tokenManager.clearAuthTokens()
                    chain.proceed(originalRequest)
                }
            }
        } catch (e: Exception) {
            Log.e("AuthInterceptor", "Token refresh exception", e)
            // Refresh failed, clear auth and proceed without auth
            tokenManager.clearAuthTokens()
            chain.proceed(originalRequest)
        }
    }

    private suspend fun performTokenRefresh(refreshToken: String): com.babelfeed.app.data.models.AuthTokens? {
        return try {
            Log.d("AuthInterceptor", "Performing token refresh API call")
            // Create a simple HTTP client for token refresh to avoid circular dependencies
            val retrofit = retrofit2.Retrofit.Builder()
                .baseUrl("http://10.0.2.2:3000/api/") // Android emulator localhost
                .addConverterFactory(retrofit2.converter.gson.GsonConverterFactory.create())
                .build()
            
            val refreshService = retrofit.create(RefreshTokenService::class.java)
            val request = com.babelfeed.app.data.models.RefreshTokenRequest(refreshToken)
            val response = refreshService.refreshToken(request)
            
            if (response.success) {
                Log.d("AuthInterceptor", "Token refresh API success")
                response.data
            } else {
                Log.w("AuthInterceptor", "Token refresh API failed: ${response.message}")
                null
            }
        } catch (e: Exception) {
            Log.e("AuthInterceptor", "Token refresh API exception", e)
            null
        }
    }
    
    // Simple service interface for token refresh only
    private interface RefreshTokenService {
        @retrofit2.http.POST("auth/refresh")
        suspend fun refreshToken(@retrofit2.http.Body request: com.babelfeed.app.data.models.RefreshTokenRequest): com.babelfeed.app.data.models.RefreshTokenResponse
    }
}