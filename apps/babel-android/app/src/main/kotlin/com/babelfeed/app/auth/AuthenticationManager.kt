package com.babelfeed.app.auth

import com.babelfeed.app.data.api.BabelApiService
import com.babelfeed.app.data.models.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import com.google.gson.Gson
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Authentication manager for handling user authentication and session management
 */
@Singleton
class AuthenticationManager @Inject constructor(
    private val tokenManager: SecureTokenManager,
    private val apiService: BabelApiService
) {
    private val _authState = MutableStateFlow(AuthState.None)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    init {
        // Initialize authentication state on startup
        initializeAuthState()
    }

    /**
     * Initialize authentication state from stored tokens
     */
    private fun initializeAuthState() {
        val state = tokenManager.getAuthState()
        _authState.value = state
        
        // If we have tokens, try to get user profile
        if (state == AuthState.Authenticated || state == AuthState.PendingVerification) {
            // Will be called when needed
        }
    }

    /**
     * Create a guest user profile
     */
    suspend fun createGuestUser(): Result<String> {
        return try {
            val deviceFingerprint = generateDeviceFingerprint()
            val request = CreateGuestRequest(deviceFingerprint)
            val response = apiService.createGuest(request)
            
            if (response.success) {
                tokenManager.storeGuestInfo(response.data.guestId, response.data.userId)
                _authState.value = AuthState.Guest
                Result.success(response.data.guestId)
            } else {
                Result.failure(Exception("Failed to create guest user"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Upgrade guest to authenticated user by adding email
     */
    suspend fun createAccountFromGuest(email: String): Result<Unit> {
        return try {
            val guestId = tokenManager.getGuestId()
                ?: return Result.failure(Exception("No guest user found"))
            
            val request = CreateAccountRequest(guestId, email)
            val response = apiService.createAccount(request)
            
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true) {
                    _authState.value = AuthState.PendingVerification
                    Result.success(Unit)
                } else {
                    val errorMessage = body?.error?.message ?: body?.message ?: "Unknown error"
                    Result.failure(Exception(errorMessage))
                }
            } else {
                // Handle HTTP error response
                val errorBody = response.errorBody()?.string()
                val errorMessage = try {
                    val gson = Gson()
                    val errorResponse = gson.fromJson(errorBody, CreateAccountResponse::class.java)
                    errorResponse.error?.message ?: errorResponse.message ?: "Unknown error"
                } catch (e: Exception) {
                    "Network error occurred"
                }
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Verify email and complete authentication
     */
    suspend fun verifyEmail(verificationToken: String): Result<User> {
        return try {
            val request = VerifyEmailRequest(verificationToken)
            val response = apiService.verifyEmail(request)
            
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true && body.data != null) {
                    tokenManager.storeTokens(
                        accessToken = body.data.accessToken,
                        refreshToken = body.data.refreshToken,
                        userId = body.data.user.id,
                        guestId = body.data.user.guestId,
                        emailVerified = true
                    )
                    
                    _currentUser.value = body.data.user
                    _authState.value = AuthState.Authenticated
                    
                    Result.success(body.data.user)
                } else {
                    val errorMessage = body?.error?.message ?: body?.message ?: "Email verification failed"
                    Result.failure(Exception(errorMessage))
                }
            } else {
                // Handle HTTP error response
                val errorBody = response.errorBody()?.string()
                val errorMessage = try {
                    val gson = Gson()
                    val errorResponse = gson.fromJson(errorBody, VerifyEmailResponse::class.java)
                    errorResponse.error?.message ?: errorResponse.message ?: "Email verification failed"
                } catch (e: Exception) {
                    "Network error occurred"
                }
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Resend verification code for email verification
     */
    suspend fun resendVerificationCode(email: String): Result<Unit> {
        return try {
            val request = ResendVerificationRequest(email)
            val response = apiService.resendVerificationCode(request)
            
            if (response.success) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.message))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get current user profile
     */
    suspend fun getCurrentUser(): Result<User> {
        return try {
            if (!tokenManager.isAuthenticated()) {
                return Result.failure(Exception("Not authenticated"))
            }
            
            val response = apiService.getProfile()
            
            if (response.success) {
                _currentUser.value = response.data
                Result.success(response.data)
            } else {
                Result.failure(Exception("Failed to get user profile"))
            }
        } catch (e: Exception) {
            // Try to refresh token if request failed
            refreshTokenIfNeeded()?.let {
                // Retry after refresh
                try {
                    val response = apiService.getProfile()
                    if (response.success) {
                        _currentUser.value = response.data
                        return Result.success(response.data)
                    }
                } catch (retryException: Exception) {
                    // Ignore retry exception, return original
                }
            }
            Result.failure(e)
        }
    }

    /**
     * Refresh access token using refresh token
     */
    suspend fun refreshTokenIfNeeded(): AuthTokens? {
        return try {
            val refreshToken = tokenManager.getRefreshToken() ?: return null
            val request = RefreshTokenRequest(refreshToken)
            val response = apiService.refreshToken(request)
            
            if (response.success) {
                val tokens = response.data
                tokenManager.storeTokens(
                    accessToken = tokens.accessToken,
                    refreshToken = tokens.refreshToken,
                    userId = tokenManager.getUserId(),
                    guestId = tokenManager.getGuestId(),
                    emailVerified = tokenManager.isEmailVerified()
                )
                tokens
            } else {
                // Refresh failed, logout user
                logout()
                null
            }
        } catch (e: Exception) {
            // Refresh failed, logout user
            logout()
            null
        }
    }

    /**
     * Logout user and clear all authentication data
     */
    suspend fun logout() {
        try {
            if (tokenManager.isAuthenticated()) {
                apiService.logout()
            }
        } catch (e: Exception) {
            // Ignore logout API errors
        }
        
        tokenManager.clearAll()
        _currentUser.value = null
        _authState.value = AuthState.None
    }

    /**
     * Silent logout (clear local data only)
     */
    fun silentLogout() {
        tokenManager.clearAuthTokens()
        _currentUser.value = null
        _authState.value = if (tokenManager.getGuestId() != null) AuthState.Guest else AuthState.None
    }

    /**
     * Get user preferences
     */
    suspend fun getUserPreferences(): Result<UserPreferences?> {
        return try {
            val response = apiService.getPreferences()
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Failed to get preferences"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Update user preferences
     */
    suspend fun updateUserPreferences(preferences: UserPreferences): Result<UserPreferences> {
        return try {
            val response = apiService.updatePreferences(preferences)
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.message ?: "Failed to update preferences"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Check if user needs to create guest profile
     */
    fun needsGuestProfile(): Boolean {
        return !tokenManager.hasTokens()
    }

    /**
     * Check if user is authenticated
     */
    fun isAuthenticated(): Boolean {
        return tokenManager.isAuthenticated()
    }

    /**
     * Check if email is verified
     */
    fun isEmailVerified(): Boolean {
        return tokenManager.isEmailVerified()
    }

    /**
     * Get current guest ID
     */
    fun getGuestId(): String? {
        return tokenManager.getGuestId()
    }

    /**
     * Get access token for API requests
     */
    fun getAccessToken(): String? {
        return tokenManager.getAccessToken()
    }

    // Private helper methods

    private fun generateDeviceFingerprint(): String {
        // Simple device fingerprint - in production, you might want more sophisticated fingerprinting
        return "android_${UUID.randomUUID()}"
    }
}