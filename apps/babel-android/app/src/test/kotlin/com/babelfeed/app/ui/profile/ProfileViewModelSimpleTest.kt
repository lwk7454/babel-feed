package com.babelfeed.app.ui.profile

import android.app.Application
import com.babelfeed.app.auth.AuthState
import com.babelfeed.app.auth.AuthenticationManager
import com.babelfeed.app.data.models.*
import com.babelfeed.app.data.repository.UserRepository
import com.babelfeed.app.ui.screens.profile.ProfileViewModel
import com.babelfeed.app.utils.LocaleManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.junit.MockitoJUnitRunner
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

@ExperimentalCoroutinesApi
@RunWith(MockitoJUnitRunner::class)
class ProfileViewModelSimpleTest {

    @Mock
    private lateinit var application: Application

    @Mock
    private lateinit var authManager: AuthenticationManager

    @Mock
    private lateinit var userRepository: UserRepository

    @Mock
    private lateinit var localeManager: LocaleManager

    private lateinit var viewModel: ProfileViewModel
    private val testDispatcher = UnconfinedTestDispatcher()

    private val mockUser = User(
        id = "test-user-id",
        email = "test@example.com",
        guestId = null,
        emailVerified = true,
        userStatus = "verified",
        createdAt = "2025-06-23T10:00:00Z",
        updatedAt = "2025-06-23T10:00:00Z"
    )

    private val mockPreferences = UserPreferences(
        userId = "test-user-id",
        preferredLanguages = listOf("en"),
        feedCategories = emptyList(),
        translationSettings = TranslationSettings(),
        themePreference = "system",
        notificationSettings = NotificationSettings(),
        privacySettings = PrivacySettings(),
        updatedAt = "2025-06-23T10:00:00Z"
    )

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        
        // Mock AuthenticationManager flows
        whenever(authManager.authState).thenReturn(MutableStateFlow(AuthState.Authenticated))
        whenever(authManager.currentUser).thenReturn(MutableStateFlow(mockUser))
        
        viewModel = ProfileViewModel(application, authManager, userRepository, localeManager)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `getUserPreferences updates state on success`() = runTest {
        // Given
        whenever(userRepository.getUserPreferences()).thenReturn(Result.success(mockPreferences))

        // When
        viewModel.getUserPreferences()
        testScheduler.advanceUntilIdle()

        // Then
        assertEquals(mockPreferences, viewModel.userPreferences.value)
        assertEquals(false, viewModel.isLoading.value)
        assertNull(viewModel.error.value)
    }

    @Test
    fun `getUserPreferences sets error on failure`() = runTest {
        // Given
        val errorMessage = "Failed to load preferences"
        whenever(userRepository.getUserPreferences()).thenReturn(
            Result.failure(Exception(errorMessage))
        )

        // When
        viewModel.getUserPreferences()
        testScheduler.advanceUntilIdle()

        // Then
        assertNull(viewModel.userPreferences.value)
        assertEquals(false, viewModel.isLoading.value)
        assertTrue(viewModel.error.value?.contains(errorMessage) == true)
    }

    @Test
    fun `updatePreferences updates state on success`() = runTest {
        // Given
        val updatedPreferences = mockPreferences.copy(
            themePreference = "dark",
            updatedAt = "2025-06-23T11:00:00Z"
        )
        whenever(userRepository.updateUserPreferences(updatedPreferences)).thenReturn(
            Result.success(updatedPreferences)
        )

        // When
        viewModel.updatePreferences(updatedPreferences)
        testScheduler.advanceUntilIdle()

        // Then
        assertEquals(updatedPreferences, viewModel.userPreferences.value)
        assertEquals(false, viewModel.isLoading.value)
        assertNull(viewModel.error.value)
        verify(userRepository).updateUserPreferences(updatedPreferences)
    }

    @Test
    fun `updatePreferences sets error on failure`() = runTest {
        // Given
        val errorMessage = "Failed to update preferences"
        val updatedPreferences = mockPreferences.copy(themePreference = "dark")
        whenever(userRepository.updateUserPreferences(updatedPreferences)).thenReturn(
            Result.failure(Exception(errorMessage))
        )

        // When
        viewModel.updatePreferences(updatedPreferences)
        testScheduler.advanceUntilIdle()

        // Then
        assertEquals(false, viewModel.isLoading.value)
        assertTrue(viewModel.error.value?.contains(errorMessage) == true)
        verify(userRepository).updateUserPreferences(updatedPreferences)
    }

    @Test
    fun `clearError resets error state`() = runTest {
        // When
        viewModel.clearError()

        // Then
        assertNull(viewModel.error.value)
    }
}