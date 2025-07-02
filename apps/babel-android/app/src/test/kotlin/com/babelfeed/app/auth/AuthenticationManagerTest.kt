package com.babelfeed.app.auth

import com.babelfeed.app.data.api.BabelApiService
import com.babelfeed.app.data.models.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.*
import retrofit2.Response
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class AuthenticationManagerTest {

    @Mock
    private lateinit var tokenManager: SecureTokenManager

    @Mock
    private lateinit var apiService: BabelApiService

    private lateinit var authManager: AuthenticationManager

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        
        // Set up default token manager behavior
        whenever(tokenManager.getAuthState()).thenReturn(AuthState.Guest)
        whenever(tokenManager.hasTokens()).thenReturn(false)
        whenever(tokenManager.isAuthenticated()).thenReturn(false)
        whenever(tokenManager.isEmailVerified()).thenReturn(false)
        
        authManager = AuthenticationManager(tokenManager, apiService)
    }

    @Test
    fun `createGuestUser should create guest user successfully`() = runTest {
        val mockResponse = CreateGuestResponse(
            success = true,
            data = GuestData(
                guestId = "guest-123",
                userId = "user-456",
                createdAt = "2024-01-01T00:00:00Z"
            ),
            message = "Guest profile created successfully"
        )

        whenever(apiService.createGuest(any())).thenReturn(mockResponse)

        val result = authManager.createGuestUser()

        assertTrue(result.isSuccess)
        assertEquals("guest-123", result.getOrNull())
        
        verify(tokenManager).storeGuestInfo("guest-123", "user-456")
        verify(apiService).createGuest(any())
        
        // Verify auth state is updated
        assertEquals(AuthState.Guest, authManager.authState.first())
    }

    @Test
    fun `createGuestUser should handle API failure`() = runTest {
        whenever(apiService.createGuest(any())).thenThrow(RuntimeException("Network error"))

        val result = authManager.createGuestUser()

        assertTrue(result.isFailure)
        verify(tokenManager, never()).storeGuestInfo(any(), any())
    }

    @Test
    fun `startVerification should upgrade guest successfully`() = runTest {
        val guestId = "guest-123"
        val email = "test@example.com"
        
        whenever(tokenManager.getGuestId()).thenReturn(guestId)
        
        val mockResponse = StartVerificationResponse(
            success = true,
            data = StartVerificationData(
                userId = "user-456",
                email = email,
                verificationSent = true,
                isExistingUser = false
            ),
            message = "Verification email sent"
        )

        whenever(apiService.startVerification(any())).thenReturn(Response.success(mockResponse))

        val result = authManager.startVerification(email)

        assertTrue(result.isSuccess)
        verify(apiService).startVerification(StartVerificationRequest(guestId, email))
        assertEquals(AuthState.PendingVerification, authManager.authState.first())
    }

    @Test
    fun `startVerification should fail when no guest user exists`() = runTest {
        whenever(tokenManager.getGuestId()).thenReturn(null)

        val result = authManager.startVerification("test@example.com")

        assertTrue(result.isFailure)
        verify(apiService, never()).startVerification(any())
    }

    @Test
    fun `verifyEmail should complete authentication successfully`() = runTest {
        val verificationToken = "verify-token-123"
        val mockUser = User(
            id = "user-456",
            email = "test@example.com",
            guestId = "guest-123",
            emailVerified = true,
            userStatus = "verified",
            createdAt = "2024-01-01T00:00:00Z",
            updatedAt = "2024-01-01T00:00:00Z"
        )
        
        val mockResponse = VerifyEmailResponse(
            success = true,
            data = VerificationData(
                user = mockUser,
                accessToken = "access-token",
                refreshToken = "refresh-token"
            ),
            message = "Email verified successfully"
        )

        whenever(apiService.verifyEmail(any())).thenReturn(Response.success(mockResponse))

        val result = authManager.verifyEmail(verificationToken)

        assertTrue(result.isSuccess)
        assertEquals(mockUser, result.getOrNull()?.user)
        
        verify(tokenManager).storeTokens(
            accessToken = "access-token",
            refreshToken = "refresh-token",
            userId = "user-456",
            guestId = "guest-123",
            emailVerified = true
        )
        
        assertEquals(AuthState.Authenticated, authManager.authState.first())
        assertEquals(mockUser, authManager.currentUser.first())
    }

    @Test
    fun `getCurrentUser should return user profile for authenticated user`() = runTest {
        val mockUser = User(
            id = "user-456",
            email = "test@example.com",
            guestId = "guest-123",
            emailVerified = true,
            userStatus = "verified",
            createdAt = "2024-01-01T00:00:00Z",
            updatedAt = "2024-01-01T00:00:00Z"
        )
        
        val mockResponse = ProfileResponse(
            success = true,
            data = mockUser
        )

        whenever(tokenManager.isAuthenticated()).thenReturn(true)
        whenever(apiService.getProfile()).thenReturn(mockResponse)

        val result = authManager.getCurrentUser()

        assertTrue(result.isSuccess)
        assertEquals(mockUser, result.getOrNull())
        assertEquals(mockUser, authManager.currentUser.first())
    }

    @Test
    fun `getCurrentUser should fail when not authenticated`() = runTest {
        whenever(tokenManager.isAuthenticated()).thenReturn(false)

        val result = authManager.getCurrentUser()

        assertTrue(result.isFailure)
        verify(apiService, never()).getProfile()
    }

    @Test
    fun `refreshTokenIfNeeded should refresh tokens successfully`() = runTest {
        val refreshToken = "refresh-token"
        val newTokens = AuthTokens(
            accessToken = "new-access-token",
            refreshToken = "new-refresh-token"
        )
        
        val mockResponse = RefreshTokenResponse(
            success = true,
            data = newTokens,
            message = "Tokens refreshed"
        )

        whenever(tokenManager.getRefreshToken()).thenReturn(refreshToken)
        whenever(tokenManager.getUserId()).thenReturn("user-456")
        whenever(tokenManager.getGuestId()).thenReturn("guest-123")
        whenever(tokenManager.isEmailVerified()).thenReturn(true)
        whenever(apiService.refreshToken(any())).thenReturn(mockResponse)

        val result = authManager.refreshTokenIfNeeded()

        assertNotNull(result)
        assertEquals(newTokens, result)
        
        verify(tokenManager).storeTokens(
            accessToken = "new-access-token",
            refreshToken = "new-refresh-token",
            userId = "user-456",
            guestId = "guest-123",
            emailVerified = true
        )
    }

    @Test
    fun `refreshTokenIfNeeded should logout on refresh failure`() = runTest {
        val refreshToken = "refresh-token"

        whenever(tokenManager.getRefreshToken()).thenReturn(refreshToken)
        whenever(tokenManager.isEmailVerified()).thenReturn(false) // Guest user
        whenever(apiService.refreshToken(any())).thenThrow(RuntimeException("Refresh failed"))

        val result = authManager.refreshTokenIfNeeded()

        assertEquals(null, result)
        verify(tokenManager).clearAuthTokens() // Should preserve verification status
        verify(tokenManager).isEmailVerified() // Should check verification status
        assertEquals(AuthState.Guest, authManager.authState.first())
    }

    @Test
    fun `refreshTokenIfNeeded should preserve verification status for verified user`() = runTest {
        val refreshToken = "refresh-token"

        whenever(tokenManager.getRefreshToken()).thenReturn(refreshToken)
        whenever(tokenManager.isEmailVerified()).thenReturn(true) // Verified user
        whenever(apiService.refreshToken(any())).thenThrow(RuntimeException("Refresh failed"))

        val result = authManager.refreshTokenIfNeeded()

        assertEquals(null, result)
        verify(tokenManager).clearAuthTokens() // Should preserve verification status
        verify(tokenManager).isEmailVerified() // Should check verification status
        assertEquals(AuthState.PendingVerification, authManager.authState.first()) // Verified user should remain in pending verification
    }

    @Test
    fun `logout should clear authentication and call API`() = runTest {
        whenever(tokenManager.isAuthenticated()).thenReturn(true)
        whenever(apiService.logout()).thenReturn(ApiResponse(success = true))

        authManager.logout()

        verify(apiService).logout()
        verify(tokenManager).clearAll()
        assertEquals(AuthState.Guest, authManager.authState.first())
        assertEquals(null, authManager.currentUser.first())
    }

    @Test
    fun `silentLogout should clear auth tokens but keep guest data`() = runTest {
        whenever(tokenManager.getGuestId()).thenReturn("guest-123")

        authManager.silentLogout()

        verify(tokenManager).clearAuthTokens()
        verify(tokenManager, never()).clearAll()
        assertEquals(AuthState.Guest, authManager.authState.first())
    }

    @Test
    fun `needsGuestProfile should return correct state`() {
        whenever(tokenManager.hasTokens()).thenReturn(false)
        assertTrue(authManager.needsGuestProfile())

        whenever(tokenManager.hasTokens()).thenReturn(true)
        assertFalse(authManager.needsGuestProfile())
    }

    @Test
    fun `isAuthenticated should delegate to token manager`() {
        whenever(tokenManager.isAuthenticated()).thenReturn(true)
        assertTrue(authManager.isAuthenticated())

        whenever(tokenManager.isAuthenticated()).thenReturn(false)
        assertFalse(authManager.isAuthenticated())
    }

    @Test
    fun `isEmailVerified should delegate to token manager`() {
        whenever(tokenManager.isEmailVerified()).thenReturn(true)
        assertTrue(authManager.isEmailVerified())

        whenever(tokenManager.isEmailVerified()).thenReturn(false)
        assertFalse(authManager.isEmailVerified())
    }

    @Test
    fun `getGuestId should delegate to token manager`() {
        val guestId = "guest-123"
        whenever(tokenManager.getGuestId()).thenReturn(guestId)
        
        assertEquals(guestId, authManager.getGuestId())
    }

    @Test
    fun `getAccessToken should delegate to token manager`() {
        val accessToken = "access-token"
        whenever(tokenManager.getAccessToken()).thenReturn(accessToken)
        
        assertEquals(accessToken, authManager.getAccessToken())
    }
}