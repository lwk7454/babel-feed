package com.babelfeed.app.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.babelfeed.app.data.models.User
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Secure token manager using Android Keystore encryption
 */
@Singleton
class SecureTokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val PREFS_NAME = "babel_secure_tokens"
        private const val ACCESS_TOKEN_KEY = "access_token"
        private const val REFRESH_TOKEN_KEY = "refresh_token"
        private const val TOKEN_EXPIRY_KEY = "token_expiry"
        private const val USER_ID_KEY = "user_id"
        private const val GUEST_ID_KEY = "guest_id"
        private const val EMAIL_VERIFIED_KEY = "email_verified"
        private const val USER_PROFILE_KEY = "user_profile"
    }

    private val encryptedPrefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private val gson = Gson()

    /**
     * Store authentication tokens securely
     */
    fun storeTokens(
        accessToken: String,
        refreshToken: String,
        userId: String? = null,
        guestId: String? = null,
        emailVerified: Boolean = false
    ) {
        encryptedPrefs.edit().apply {
            putString(ACCESS_TOKEN_KEY, accessToken)
            putString(REFRESH_TOKEN_KEY, refreshToken)
            putLong(TOKEN_EXPIRY_KEY, System.currentTimeMillis() + (30L * 24 * 60 * 60 * 1000)) // 30 days
            userId?.let { putString(USER_ID_KEY, it) }
            guestId?.let { putString(GUEST_ID_KEY, it) }
            putBoolean(EMAIL_VERIFIED_KEY, emailVerified)
            commit() // Use commit() for synchronous write in critical auth flows
        }
    }

    /**
     * Store guest information
     */
    fun storeGuestInfo(guestId: String, userId: String) {
        encryptedPrefs.edit().apply {
            putString(GUEST_ID_KEY, guestId)
            putString(USER_ID_KEY, userId)
            putBoolean(EMAIL_VERIFIED_KEY, false)
            commit() // Use commit() for synchronous write in critical auth flows
        }
    }

    /**
     * Get access token if valid
     */
    fun getAccessToken(): String? {
        val token = encryptedPrefs.getString(ACCESS_TOKEN_KEY, null)
        val expiry = encryptedPrefs.getLong(TOKEN_EXPIRY_KEY, 0)
        
        return if (token != null && token.isNotBlank() && System.currentTimeMillis() < expiry) {
            token
        } else {
            null
        }
    }

    /**
     * Get refresh token
     */
    fun getRefreshToken(): String? {
        val token = encryptedPrefs.getString(REFRESH_TOKEN_KEY, null)
        return if (token != null && token.isNotBlank()) token else null
    }

    /**
     * Get user ID
     */
    fun getUserId(): String? {
        return encryptedPrefs.getString(USER_ID_KEY, null)
    }

    /**
     * Get guest ID
     */
    fun getGuestId(): String? {
        return encryptedPrefs.getString(GUEST_ID_KEY, null)
    }

    /**
     * Check if email is verified
     */
    fun isEmailVerified(): Boolean {
        return encryptedPrefs.getBoolean(EMAIL_VERIFIED_KEY, false)
    }

    /**
     * Check if user has any tokens (authenticated or guest)
     */
    fun hasTokens(): Boolean {
        return getAccessToken() != null || getGuestId() != null
    }

    /**
     * Check if user is authenticated (has valid access token)
     */
    fun isAuthenticated(): Boolean {
        return getAccessToken() != null
    }

    /**
     * Update email verification status
     */
    fun setEmailVerified(verified: Boolean) {
        encryptedPrefs.edit().apply {
            putBoolean(EMAIL_VERIFIED_KEY, verified)
            commit() // Use commit() for synchronous write in critical auth flows
        }
    }

    /**
     * Store user profile locally
     */
    fun storeUserProfile(user: User) {
        try {
            val userJson = gson.toJson(user)
            encryptedPrefs.edit().apply {
                putString(USER_PROFILE_KEY, userJson)
                commit()
            }
        } catch (e: Exception) {
            // Silently ignore JSON serialization errors
        }
    }

    /**
     * Get stored user profile
     */
    fun getUserProfile(): User? {
        return try {
            val userJson = encryptedPrefs.getString(USER_PROFILE_KEY, null)
            if (userJson != null) {
                gson.fromJson(userJson, User::class.java)
            } else {
                null
            }
        } catch (e: Exception) {
            // Silently ignore JSON deserialization errors
            null
        }
    }

    /**
     * Clear all stored tokens and user data
     */
    fun clearAll() {
        encryptedPrefs.edit().clear().commit()
    }

    /**
     * Clear only authentication tokens but keep guest info
     */
    fun clearAuthTokens() {
        encryptedPrefs.edit().apply {
            remove(ACCESS_TOKEN_KEY)
            remove(REFRESH_TOKEN_KEY)
            remove(TOKEN_EXPIRY_KEY)
            putBoolean(EMAIL_VERIFIED_KEY, false)
            commit() // Use commit() for synchronous write in critical auth flows
        }
    }

    /**
     * Get authentication state summary
     */
    fun getAuthState(): AuthState {
        val accessToken = getAccessToken()
        val refreshToken = getRefreshToken()
        val storedAccessToken = encryptedPrefs.getString(ACCESS_TOKEN_KEY, null)
        val guestId = getGuestId()
        val emailVerified = isEmailVerified()
        
        return when {
            // If user is verified and has any auth tokens (valid or expired), they are authenticated
            emailVerified && (storedAccessToken != null || refreshToken != null) -> AuthState.Authenticated
            // If user has valid access token but not verified, they are pending verification
            accessToken != null -> AuthState.PendingVerification
            // If user is verified but has no tokens, they need to re-verify
            emailVerified && guestId != null -> AuthState.PendingVerification
            // Otherwise they are guest
            else -> AuthState.Guest
        }
    }
}

/**
 * Authentication states
 */
enum class AuthState {
    Guest,          // Guest user without email
    PendingVerification, // Email provided but not verified
    Authenticated   // Fully authenticated with verified email
}