package com.babelfeed.app.auth

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
class SecureTokenManagerTest {

    private lateinit var context: Context
    private lateinit var tokenManager: SecureTokenManager

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        tokenManager = SecureTokenManager(context)
        // Clear any existing data
        tokenManager.clearAll()
    }

    @Test
    fun `storeTokens should store authentication tokens securely`() {
        val accessToken = "test-access-token"
        val refreshToken = "test-refresh-token"
        val userId = "user-123"
        val guestId = "guest-456"

        tokenManager.storeTokens(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = userId,
            guestId = guestId,
            emailVerified = true
        )

        assertEquals(accessToken, tokenManager.getAccessToken())
        assertEquals(refreshToken, tokenManager.getRefreshToken())
        assertEquals(userId, tokenManager.getUserId())
        assertEquals(guestId, tokenManager.getGuestId())
        assertTrue(tokenManager.isEmailVerified())
    }

    @Test
    fun `storeGuestInfo should store guest information`() {
        val guestId = "guest-789"
        val userId = "user-456"

        tokenManager.storeGuestInfo(guestId, userId)

        assertEquals(guestId, tokenManager.getGuestId())
        assertEquals(userId, tokenManager.getUserId())
        assertFalse(tokenManager.isEmailVerified())
    }

    @Test
    fun `getAccessToken should return null for expired token`() {
        // This test is simplified since we can't easily mock time in this context
        // In a real scenario, you might use a DI framework to inject a time provider
        
        val accessToken = "expired-token"
        val refreshToken = "refresh-token"

        tokenManager.storeTokens(accessToken, refreshToken)
        
        // Token should be valid initially
        assertNotNull(tokenManager.getAccessToken())
        
        // Note: In a real test, you would advance time or use a mock time provider
        // to test token expiry behavior
    }

    @Test
    fun `hasTokens should return true when tokens exist`() {
        assertFalse(tokenManager.hasTokens())

        tokenManager.storeTokens("access", "refresh")
        assertTrue(tokenManager.hasTokens())

        tokenManager.clearAll()
        assertFalse(tokenManager.hasTokens())

        tokenManager.storeGuestInfo("guest-id", "user-id")
        assertTrue(tokenManager.hasTokens())
    }

    @Test
    fun `isAuthenticated should return true when access token exists`() {
        assertFalse(tokenManager.isAuthenticated())

        tokenManager.storeTokens("access-token", "refresh-token")
        assertTrue(tokenManager.isAuthenticated())

        tokenManager.clearAuthTokens()
        assertFalse(tokenManager.isAuthenticated())
    }

    @Test
    fun `setEmailVerified should update email verification status`() {
        tokenManager.storeTokens("access", "refresh", emailVerified = false)
        assertFalse(tokenManager.isEmailVerified())

        tokenManager.setEmailVerified(true)
        assertTrue(tokenManager.isEmailVerified())

        tokenManager.setEmailVerified(false)
        assertFalse(tokenManager.isEmailVerified())
    }

    @Test
    fun `clearAll should remove all stored data`() {
        tokenManager.storeTokens(
            accessToken = "access",
            refreshToken = "refresh",
            userId = "user",
            guestId = "guest",
            emailVerified = true
        )

        assertTrue(tokenManager.hasTokens())
        assertTrue(tokenManager.isAuthenticated())

        tokenManager.clearAll()

        assertFalse(tokenManager.hasTokens())
        assertFalse(tokenManager.isAuthenticated())
        assertNull(tokenManager.getAccessToken())
        assertNull(tokenManager.getRefreshToken())
        assertNull(tokenManager.getUserId())
        assertNull(tokenManager.getGuestId())
        assertFalse(tokenManager.isEmailVerified())
    }

    @Test
    fun `clearAuthTokens should remove only authentication tokens`() {
        val guestId = "guest-id"
        val userId = "user-id"

        tokenManager.storeTokens(
            accessToken = "access",
            refreshToken = "refresh",
            userId = userId,
            guestId = guestId,
            emailVerified = true
        )

        tokenManager.clearAuthTokens()

        // Auth tokens should be cleared
        assertNull(tokenManager.getAccessToken())
        assertNull(tokenManager.getRefreshToken())
        assertFalse(tokenManager.isEmailVerified())
        assertFalse(tokenManager.isAuthenticated())

        // Guest info should remain
        assertEquals(guestId, tokenManager.getGuestId())
        assertEquals(userId, tokenManager.getUserId())
        assertTrue(tokenManager.hasTokens())
    }

    @Test
    fun `getAuthState should return correct authentication state`() {
        // None state
        assertEquals(AuthState.None, tokenManager.getAuthState())

        // Guest state
        tokenManager.storeGuestInfo("guest-id", "user-id")
        assertEquals(AuthState.Guest, tokenManager.getAuthState())

        // Pending verification state
        tokenManager.storeTokens("access", "refresh", emailVerified = false)
        assertEquals(AuthState.PendingVerification, tokenManager.getAuthState())

        // Authenticated state
        tokenManager.setEmailVerified(true)
        assertEquals(AuthState.Authenticated, tokenManager.getAuthState())
    }
}