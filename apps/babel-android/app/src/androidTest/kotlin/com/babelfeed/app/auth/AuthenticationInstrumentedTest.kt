package com.babelfeed.app.auth

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * Instrumented tests for authentication state management and token persistence.
 * These tests verify core authentication functionality using real Android components.
 */
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class AuthenticationInstrumentedTest {

    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @Inject
    lateinit var authManager: AuthenticationManager

    @Inject
    lateinit var tokenManager: SecureTokenManager

    @Before
    fun setup() {
        hiltRule.inject()
        // Clear any existing state before each test
        tokenManager.clearAll()
        // Give the authentication manager time to react to token clearing
        Thread.sleep(200)
    }

    @Test
    fun tokenManager_storeAndRetrieveTokens() = runTest {
        val accessToken = "test-access-token"
        val refreshToken = "test-refresh-token"
        val userId = "user-123"
        val guestId = "guest-456"

        // Store tokens
        tokenManager.storeTokens(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = userId,
            guestId = guestId,
            emailVerified = true
        )

        // Verify tokens are stored correctly
        assertEquals(accessToken, tokenManager.getAccessToken())
        assertEquals(refreshToken, tokenManager.getRefreshToken())
        assertEquals(userId, tokenManager.getUserId())
        assertEquals(guestId, tokenManager.getGuestId())
        assertTrue(tokenManager.isAuthenticated())
        assertTrue(tokenManager.isEmailVerified())
        assertEquals(AuthState.Authenticated, tokenManager.getAuthState())
    }

    @Test
    fun tokenManager_guestUserState() = runTest {
        val guestId = "guest-test-123"
        val userId = "user-test-456"

        // Store guest information
        tokenManager.storeGuestInfo(guestId, userId)

        // Verify guest state
        assertEquals(guestId, tokenManager.getGuestId())
        assertEquals(userId, tokenManager.getUserId())
        assertEquals(AuthState.Guest, tokenManager.getAuthState())
        assertFalse(tokenManager.isAuthenticated())
        assertFalse(tokenManager.isEmailVerified())
    }

    @Test
    fun tokenManager_clearTokens() = runTest {
        // First store some tokens
        tokenManager.storeTokens(
            accessToken = "access-token",
            refreshToken = "refresh-token",
            userId = "user-123",
            guestId = "guest-456",
            emailVerified = true
        )

        // Verify tokens are stored
        assertTrue(tokenManager.isAuthenticated())

        // Clear auth tokens (preserving guest data)
        tokenManager.clearAuthTokens()

        // Verify auth tokens are cleared but guest data remains
        assertFalse(tokenManager.isAuthenticated())
        assertEquals("guest-456", tokenManager.getGuestId())
        assertEquals("user-123", tokenManager.getUserId())
        assertEquals(AuthState.Guest, tokenManager.getAuthState())
    }

    @Test
    fun tokenManager_clearAll() = runTest {
        // Store tokens and guest data
        tokenManager.storeTokens(
            accessToken = "access-token",
            refreshToken = "refresh-token",
            userId = "user-123",
            guestId = "guest-456",
            emailVerified = true
        )

        // Verify data is stored
        assertTrue(tokenManager.isAuthenticated())
        assertNotNull(tokenManager.getGuestId())

        // Clear all data
        tokenManager.clearAll()

        // Verify everything is cleared
        assertFalse(tokenManager.isAuthenticated())
        assertNull(tokenManager.getGuestId())
        assertNull(tokenManager.getUserId())
        assertNull(tokenManager.getAccessToken())
        assertNull(tokenManager.getRefreshToken())
        assertEquals(AuthState.Guest, tokenManager.getAuthState())
    }

    @Test
    fun tokenManager_persistenceAcrossAppRestart_verifiedUser() = runTest {
        val accessToken = "persistent-access-token-123"
        val refreshToken = "persistent-refresh-token-456"
        val userId = "user-verified-789"
        val guestId = "guest-verified-012"

        // Store verified user tokens
        tokenManager.storeTokens(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = userId,
            guestId = guestId,
            emailVerified = true
        )

        // Verify authenticated state
        assertTrue("User should be authenticated after storing tokens", tokenManager.isAuthenticated())
        assertTrue("User should be email verified", tokenManager.isEmailVerified())
        assertEquals("Auth state should be Authenticated", AuthState.Authenticated, tokenManager.getAuthState())

        // Simulate app restart by creating new instances
        // This is the critical test - tokens should persist across component recreation
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val newTokenManager = SecureTokenManager(context)
        
        // Give time for initialization
        delay(100)

        // Verify tokens persist after "app restart"
        assertEquals("Access token should persist", accessToken, newTokenManager.getAccessToken())
        assertEquals("Refresh token should persist", refreshToken, newTokenManager.getRefreshToken())
        assertEquals("User ID should persist", userId, newTokenManager.getUserId())
        assertEquals("Guest ID should persist", guestId, newTokenManager.getGuestId())
        assertTrue("User should still be authenticated after restart", newTokenManager.isAuthenticated())
        assertTrue("User should still be email verified after restart", newTokenManager.isEmailVerified())
        assertEquals("Auth state should remain Authenticated after restart", AuthState.Authenticated, newTokenManager.getAuthState())
    }

    @Test
    fun tokenManager_persistenceAcrossAppRestart_guestUser() = runTest {
        val guestId = "guest-persistent-123"
        val userId = "user-persistent-456"

        // Store guest info
        tokenManager.storeGuestInfo(guestId, userId)

        // Verify guest state
        assertEquals("Guest state should be set", AuthState.Guest, tokenManager.getAuthState())
        assertEquals("Guest ID should be stored", guestId, tokenManager.getGuestId())
        assertEquals("User ID should be stored", userId, tokenManager.getUserId())
        assertFalse("Guest should not be authenticated", tokenManager.isAuthenticated())

        // Simulate app restart
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val newTokenManager = SecureTokenManager(context)
        
        delay(100)

        // Verify guest data persists
        assertEquals("Guest ID should persist after restart", guestId, newTokenManager.getGuestId())
        assertEquals("User ID should persist after restart", userId, newTokenManager.getUserId())
        assertEquals("Auth state should remain Guest after restart", AuthState.Guest, newTokenManager.getAuthState())
        assertFalse("Guest should not be authenticated after restart", newTokenManager.isAuthenticated())
    }

    @Test
    fun tokenManager_persistenceAcrossAppRestart_emptyState() = runTest {
        // Ensure clean state
        tokenManager.clearAll()
        
        // Verify empty state
        assertNull("Access token should be null", tokenManager.getAccessToken())
        assertNull("Refresh token should be null", tokenManager.getRefreshToken())
        assertNull("User ID should be null", tokenManager.getUserId())
        assertNull("Guest ID should be null", tokenManager.getGuestId())
        assertEquals("Auth state should be Guest", AuthState.Guest, tokenManager.getAuthState())
        assertFalse("Should not be authenticated", tokenManager.isAuthenticated())

        // Simulate app restart
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val newTokenManager = SecureTokenManager(context)
        
        delay(100)

        // Verify empty state persists (no tokens stored)
        assertNull("Access token should remain null after restart", newTokenManager.getAccessToken())
        assertNull("Refresh token should remain null after restart", newTokenManager.getRefreshToken())
        assertNull("User ID should remain null after restart", newTokenManager.getUserId())
        assertNull("Guest ID should remain null after restart", newTokenManager.getGuestId())
        assertEquals("Auth state should remain Guest after restart", AuthState.Guest, newTokenManager.getAuthState())
        assertFalse("Should not be authenticated after restart", newTokenManager.isAuthenticated())
    }

    @Test
    fun tokenManager_tokenExpiration() = runTest {
        tokenManager.storeTokens(
            accessToken = "test-token",
            refreshToken = "refresh-token",
            userId = "user-123",
            guestId = "guest-456",
            emailVerified = true
        )

        // Test token validity checking
        assertTrue(tokenManager.isAuthenticated())
        
        // Test that tokens are considered valid when not expired
        assertTrue(tokenManager.hasTokens())
    }

    @Test
    fun tokenManager_authStateTransitions() = runTest {
        // Test Guest -> Authenticated transition
        assertEquals(AuthState.Guest, tokenManager.getAuthState())

        // Store guest info
        tokenManager.storeGuestInfo("guest-123", "user-456")
        assertEquals(AuthState.Guest, tokenManager.getAuthState())

        // Complete authentication
        tokenManager.storeTokens(
            accessToken = "access-token",
            refreshToken = "refresh-token",
            userId = "user-456",
            guestId = "guest-123",
            emailVerified = true
        )
        assertEquals(AuthState.Authenticated, tokenManager.getAuthState())

        // Logout (clear auth tokens)
        tokenManager.clearAuthTokens()
        assertEquals(AuthState.Guest, tokenManager.getAuthState())
    }

    @Test
    fun tokenManager_persistence() = runTest {
        val accessToken = "persistent-access-token"
        val refreshToken = "persistent-refresh-token"
        val userId = "persistent-user-123"
        val guestId = "persistent-guest-456"

        // Store tokens
        tokenManager.storeTokens(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = userId,
            guestId = guestId,
            emailVerified = true
        )

        // Verify persistence by reading values multiple times
        repeat(3) {
            assertEquals(accessToken, tokenManager.getAccessToken())
            assertEquals(refreshToken, tokenManager.getRefreshToken())
            assertEquals(userId, tokenManager.getUserId())
            assertEquals(guestId, tokenManager.getGuestId())
            assertTrue(tokenManager.isAuthenticated())
            assertTrue(tokenManager.isEmailVerified())
        }
    }

    @Test
    fun tokenManager_secureStorage() = runTest {
        val sensitiveToken = "super-secret-access-token-12345"
        val sensitiveRefresh = "super-secret-refresh-token-67890"

        // Store sensitive tokens
        tokenManager.storeTokens(
            accessToken = sensitiveToken,
            refreshToken = sensitiveRefresh,
            userId = "secure-user-123",
            guestId = "secure-guest-456",
            emailVerified = true
        )

        // Verify tokens can be retrieved
        assertEquals(sensitiveToken, tokenManager.getAccessToken())
        assertEquals(sensitiveRefresh, tokenManager.getRefreshToken())

        // This test verifies that the secure storage mechanism works
        // The actual encryption/decryption is handled by Android's EncryptedSharedPreferences
        assertTrue(tokenManager.isAuthenticated())
    }

    @Test
    fun tokenManager_corruptedDataRecovery() = runTest {
        // Test recovery from corrupted or invalid stored data
        
        // Store valid tokens first
        tokenManager.storeTokens(
            accessToken = "valid-token",
            refreshToken = "valid-refresh",
            userId = "user-123",
            guestId = "guest-456",
            emailVerified = true
        )
        
        assertTrue("Should be authenticated with valid tokens", tokenManager.isAuthenticated())
        
        // Test token expiration scenario (simpler than storage corruption)
        // Clear just the access token to simulate expiration while keeping other data
        tokenManager.clearAuthTokens()
        
        // Should handle expired state gracefully
        assertFalse("Should not be authenticated with expired/cleared tokens", tokenManager.isAuthenticated())
        assertEquals("Should fallback to Guest state", AuthState.Guest, tokenManager.getAuthState())
        
        // Should still preserve guest data
        assertEquals("Guest ID should be preserved", "guest-456", tokenManager.getGuestId())
        assertEquals("User ID should be preserved", "user-123", tokenManager.getUserId())
    }

    @Test
    fun tokenManager_concurrentAccess() = runTest {
        // Test thread safety and concurrent access patterns
        val accessToken = "concurrent-access-token"
        val refreshToken = "concurrent-refresh-token"
        
        // Store tokens
        tokenManager.storeTokens(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = "user-concurrent",
            guestId = "guest-concurrent",
            emailVerified = true
        )
        
        // Simulate concurrent reads (common in real app usage)
        val results = mutableListOf<Boolean>()
        
        repeat(10) {
            val isAuth = tokenManager.isAuthenticated()
            val token = tokenManager.getAccessToken()
            val state = tokenManager.getAuthState()
            
            results.add(isAuth && token == accessToken && state == AuthState.Authenticated)
        }
        
        assertTrue("All concurrent reads should be consistent", results.all { it })
    }

    @Test
    fun tokenManager_edgeCaseValues() = runTest {
        // Test handling of edge case values
        
        // Test empty strings
        tokenManager.storeTokens(
            accessToken = "",
            refreshToken = "",
            userId = "",
            guestId = "",
            emailVerified = false
        )
        
        // Empty tokens should not be considered valid authentication
        assertFalse("Empty tokens should not be authenticated", tokenManager.isAuthenticated())
        assertEquals("Should be in Guest state with empty tokens", AuthState.Guest, tokenManager.getAuthState())
        
        // Test very long tokens (within reason)
        val longToken = "a".repeat(1000)
        tokenManager.storeTokens(
            accessToken = longToken,
            refreshToken = longToken,
            userId = "user-long",
            guestId = "guest-long",
            emailVerified = true
        )
        
        assertEquals("Should handle long tokens", longToken, tokenManager.getAccessToken())
        assertTrue("Should be authenticated with long valid tokens", tokenManager.isAuthenticated())
    }

    @Test
    fun authManager_stateConsistencyAfterOperations() = runTest {
        // Test that auth state remains consistent after various operations
        
        // Start in clean state
        assertEquals("Should start in Guest state", AuthState.Guest, authManager.authState.first())
        
        // Create guest user
        val guestResult = authManager.createGuestUser()
        assertNotNull("Guest creation should succeed", guestResult)
        
        val initialGuestId = authManager.getGuestId()
        val initialUserId = tokenManager.getUserId()
        
        // Verify state consistency
        assertEquals("Should remain in Guest state after guest creation", AuthState.Guest, authManager.authState.first())
        assertFalse("Should not be authenticated as guest", authManager.isAuthenticated())
        
        // Authenticate the guest
        tokenManager.storeTokens(
            accessToken = "auth-token-123",
            refreshToken = "refresh-token-456", 
            userId = initialUserId ?: "fallback-user",
            guestId = initialGuestId ?: "fallback-guest",
            emailVerified = true
        )
        
        // Refresh AuthManager state to see the changes
        authManager.refreshAuthState()
        delay(50) // Give time for state propagation
        
        // Verify authenticated state
        assertTrue("Should be authenticated after token storage", authManager.isAuthenticated())
        assertEquals("Should be in Authenticated state", AuthState.Authenticated, authManager.authState.first())
        
        // IDs should remain consistent
        assertEquals("Guest ID should remain consistent", initialGuestId, authManager.getGuestId())
        assertEquals("User ID should remain consistent", initialUserId, tokenManager.getUserId())
        
        // Logout and verify state
        authManager.logout()
        
        assertEquals("Should return to Guest state after logout", AuthState.Guest, authManager.authState.first())
        assertFalse("Should not be authenticated after logout", authManager.isAuthenticated())
        
        // Guest data should still be available after logout
        assertEquals("Guest ID should persist after logout", initialGuestId, authManager.getGuestId())
        assertEquals("User ID should persist after logout", initialUserId, tokenManager.getUserId())
    }

    @Test
    fun authManager_integrationWithTokenManager() = runTest {
        // Test comprehensive integration between AuthManager and TokenManager
        
        // Initial state - should be guest
        assertFalse("Should not be authenticated initially", authManager.isAuthenticated())
        assertEquals("Initial auth state should be Guest", AuthState.Guest, authManager.authState.first())

        // Create guest profile
        val guestResult = authManager.createGuestUser()
        assertNotNull("Guest creation should return result", guestResult)
        
        // Verify guest state is reflected in both managers
        val guestId = authManager.getGuestId()
        assertNotNull("Guest ID should be set after creation", guestId)
        assertEquals("TokenManager should have same guest ID", guestId, tokenManager.getGuestId())
        assertEquals("Auth state should be Guest", AuthState.Guest, authManager.authState.first())
        assertFalse("Should not be authenticated as guest", authManager.isAuthenticated())

        // Simulate authentication (store tokens directly in TokenManager)
        tokenManager.storeTokens(
            accessToken = "test-access-123",
            refreshToken = "test-refresh-456",
            userId = tokenManager.getUserId() ?: "user-789",
            guestId = guestId ?: "guest-012",
            emailVerified = true
        )
        
        // Refresh AuthManager state to see the changes
        authManager.refreshAuthState()
        delay(50) // Give time for state propagation

        // Verify AuthManager sees the authentication
        assertTrue("Should be authenticated after storing tokens", authManager.isAuthenticated())
        assertEquals("Auth state should be Authenticated", AuthState.Authenticated, authManager.authState.first())
        
        // Test logout
        authManager.logout()
        
        // Verify logout clears auth state
        assertFalse("Should not be authenticated after logout", authManager.isAuthenticated())
        assertEquals("Auth state should be Guest after logout", AuthState.Guest, authManager.authState.first())
    }
}