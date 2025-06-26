package com.babelfeed.app.ui.profile

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
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
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
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

    @Mock
    private lateinit var sharedPreferences: SharedPreferences

    @Mock
    private lateinit var sharedPreferencesEditor: SharedPreferences.Editor

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
        whenever(authManager.isAuthenticated()).thenReturn(true)
        
        // Mock LocaleManager
        whenever(localeManager.getCurrentLocale(application)).thenReturn("en")
        whenever(localeManager.isLanguageSupported(any())).thenReturn(true)
        
        // Mock Application getString method for error messages
        whenever(application.getString(any())).thenReturn("Our servers are temporarily unavailable. Please try again later.")
        
        // Mock SharedPreferences
        whenever(application.getSharedPreferences(eq("app_preferences"), eq(Context.MODE_PRIVATE))).thenReturn(sharedPreferences)
        whenever(sharedPreferences.edit()).thenReturn(sharedPreferencesEditor)
        whenever(sharedPreferencesEditor.putString(any(), any())).thenReturn(sharedPreferencesEditor)
        whenever(sharedPreferencesEditor.putBoolean(any(), any())).thenReturn(sharedPreferencesEditor)
        whenever(sharedPreferencesEditor.apply()).then { }
        
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
    fun `getUserPreferences uses default preferences on failure`() = runTest {
        // Given
        val errorMessage = "Failed to load preferences"
        whenever(userRepository.getUserPreferences()).thenReturn(
            Result.failure(Exception(errorMessage))
        )

        // When
        viewModel.getUserPreferences()
        testScheduler.advanceUntilIdle()

        // Then
        // Should use default preferences instead of setting error
        assertEquals("en", viewModel.userPreferences.value?.preferredLanguages?.first())
        assertEquals("system", viewModel.userPreferences.value?.themePreference)
        assertEquals(false, viewModel.isLoading.value)
        // No error should be set for preferences loading failures
        assertNull(viewModel.error.value)
    }

    @Test
    fun `updatePreferences updates state on success for verified user`() = runTest {
        // Given
        val updatedPreferences = mockPreferences.copy(
            themePreference = "dark",
            updatedAt = "2025-06-23T11:00:00Z"
        )
        whenever(userRepository.saveUserSettings(updatedPreferences)).thenReturn(
            Result.success(updatedPreferences)
        )

        // When
        viewModel.updatePreferences(updatedPreferences)
        testScheduler.advanceUntilIdle()

        // Then
        assertEquals(updatedPreferences, viewModel.userPreferences.value)
        assertEquals(false, viewModel.isLoading.value)
        assertNull(viewModel.error.value)
        verify(userRepository).saveUserSettings(updatedPreferences)
    }

    @Test
    fun `updatePreferences sets error on failure for verified user`() = runTest {
        // Given
        val errorMessage = "Failed to save settings"
        val updatedPreferences = mockPreferences.copy(themePreference = "dark")
        whenever(userRepository.saveUserSettings(updatedPreferences)).thenReturn(
            Result.failure(Exception(errorMessage))
        )

        // When
        viewModel.updatePreferences(updatedPreferences)
        testScheduler.advanceUntilIdle()

        // Then
        assertEquals(false, viewModel.isLoading.value)
        assertTrue(viewModel.error.value?.contains("Our servers are temporarily unavailable") == true)
        verify(userRepository).saveUserSettings(updatedPreferences)
    }

    @Test
    fun `clearError resets error state`() = runTest {
        // When
        viewModel.clearError()

        // Then
        assertNull(viewModel.error.value)
    }
}