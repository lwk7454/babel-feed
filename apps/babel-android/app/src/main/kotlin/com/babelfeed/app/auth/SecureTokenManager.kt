package com.babelfeed.app.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
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
            apply()
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
            apply()
        }
    }

    /**
     * Get access token if valid
     */
    fun getAccessToken(): String? {
        val token = encryptedPrefs.getString(ACCESS_TOKEN_KEY, null)
        val expiry = encryptedPrefs.getLong(TOKEN_EXPIRY_KEY, 0)
        
        return if (token != null && System.currentTimeMillis() < expiry) {
            token
        } else {
            null
        }
    }

    /**
     * Get refresh token
     */
    fun getRefreshToken(): String? {
        return encryptedPrefs.getString(REFRESH_TOKEN_KEY, null)
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
            apply()
        }
    }

    /**
     * Clear all stored tokens and user data
     */
    fun clearAll() {
        encryptedPrefs.edit().clear().apply()
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
            apply()
        }
    }

    /**
     * Get authentication state summary
     */
    fun getAuthState(): AuthState {
        val accessToken = getAccessToken()
        val refreshToken = getRefreshToken()
        val guestId = getGuestId()
        val emailVerified = isEmailVerified()
        
        return when {
            accessToken != null && emailVerified -> AuthState.Authenticated
            accessToken != null -> AuthState.PendingVerification
            emailVerified && (refreshToken != null || guestId != null) -> AuthState.PendingVerification
            guestId != null -> AuthState.Guest
            else -> AuthState.None
        }
    }
}

/**
 * Authentication states
 */
enum class AuthState {
    None,           // No authentication or guest data
    Guest,          // Guest user without email
    PendingVerification, // Email provided but not verified
    Authenticated   // Fully authenticated with verified email
}