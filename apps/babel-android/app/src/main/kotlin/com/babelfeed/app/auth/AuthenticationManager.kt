package com.babelfeed.app.auth

import com.babelfeed.app.data.api.BabelApiService
import com.babelfeed.app.data.models.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
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
    private val _authState = MutableStateFlow(AuthState.Guest)
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
        refreshAuthState()
    }

    /**
     * Refresh authentication state from current token state
     * This method can be called to sync AuthManager with TokenManager changes
     */
    fun refreshAuthState() {
        val state = tokenManager.getAuthState()
        _authState.value = state
        
        // For authenticated users, try to restore user profile
        if (state == AuthState.Authenticated) {
            // First, try to restore from local storage
            val storedProfile = tokenManager.getUserProfile()
            if (storedProfile != null) {
                _currentUser.value = storedProfile
            }
            
            // Then try to fetch fresh profile from server in background
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    // Check if access token is expired and try to refresh if needed
                    if (!tokenManager.isAuthenticated() && tokenManager.getRefreshToken() != null) {
                        // Access token is expired but we have a refresh token - try to refresh
                        refreshTokenIfNeeded()
                    }
                    
                    // Try to fetch user profile from server
                    if (tokenManager.isAuthenticated()) {
                        val response = apiService.getProfile()
                        if (response.success) {
                            _currentUser.value = response.data
                            // Store the fresh profile locally
                            tokenManager.storeUserProfile(response.data)
                        }
                        // If API call fails, we already have the stored profile
                    }
                } catch (e: Exception) {
                    // Background profile fetch failed - that's okay, we have the stored profile
                    // The profile will be fetched when needed
                }
            }
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
     * Start verification process (unified for new and existing users)
     */
    suspend fun startVerification(email: String): Result<Unit> {
        return try {
            val guestId = tokenManager.getGuestId()
                ?: return Result.failure(Exception("No guest user found"))
            
            val request = StartVerificationRequest(guestId, email)
            val response = apiService.startVerification(request)
            
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
                    val errorResponse = gson.fromJson(errorBody, StartVerificationResponse::class.java)
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
    suspend fun verifyEmail(verificationToken: String): Result<VerificationResult> {
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
                    
                    // Store user profile locally for persistence
                    tokenManager.storeUserProfile(body.data.user)
                    
                    _currentUser.value = body.data.user
                    _authState.value = AuthState.Authenticated
                    
                    val result = VerificationResult(
                        user = body.data.user,
                        preferences = body.data.preferences
                    )
                    Result.success(result)
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
                // Set auth state to pending verification for navigation
                _authState.value = AuthState.PendingVerification
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
                // Store the fresh profile locally for persistence
                tokenManager.storeUserProfile(response.data)
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
                        // Store the fresh profile locally for persistence
                        tokenManager.storeUserProfile(response.data)
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
                // Refresh failed, clear tokens but preserve verification status
                silentLogout()
                null
            }
        } catch (e: Exception) {
            // Refresh failed, clear tokens but preserve verification status
            silentLogout()
            null
        }
    }

    /**
     * Logout user and clear authentication data but preserve guest profile
     */
    suspend fun logout() {
        try {
            if (tokenManager.isAuthenticated()) {
                apiService.logout()
            }
        } catch (e: Exception) {
            // Ignore logout API errors
        }
        
        // Clear auth tokens but preserve guest data
        tokenManager.clearAuthTokens()
        _currentUser.value = null
        _authState.value = AuthState.Guest
    }

    /**
     * Silent logout (clear local data only)
     */
    fun silentLogout() {
        tokenManager.clearAuthTokens()
        _currentUser.value = null
        
        // Set auth state based on verification status
        _authState.value = if (tokenManager.isEmailVerified()) {
            AuthState.PendingVerification
        } else {
            AuthState.Guest
        }
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
     * Save user settings (sync to server) - for verified users only
     */
    suspend fun saveUserSettings(preferences: UserPreferences): Result<UserPreferences> {
        return try {
            if (!isAuthenticated()) {
                return Result.failure(Exception("Authentication required for settings sync"))
            }
            
            val response = apiService.saveSettings(preferences)
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.message ?: "Failed to save settings"))
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