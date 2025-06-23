package com.babelfeed.app.repository

import com.babelfeed.app.data.api.BabelApiService
import com.babelfeed.app.data.models.*
import com.babelfeed.app.data.repository.UserRepository
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.junit.MockitoJUnitRunner
import org.mockito.kotlin.whenever
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@RunWith(MockitoJUnitRunner::class)
class UserRepositoryTest {

    @Mock
    private lateinit var apiService: BabelApiService

    private lateinit var userRepository: UserRepository

    @Before
    fun setup() {
        userRepository = UserRepository(apiService)
    }

    @Test
    fun `getUserPreferences returns success when API call succeeds`() = runTest {
        // Given
        val mockPreferences = UserPreferences(
            userId = "test-user-id",
            preferredLanguages = listOf("en", "es"),
            feedCategories = listOf("tech", "news"),
            translationSettings = TranslationSettings(
                autoTranslate = true,
                defaultTargetLanguage = "en"
            ),
            themePreference = "dark",
            notificationSettings = NotificationSettings(
                emailNotifications = true,
                pushNotifications = false
            ),
            privacySettings = PrivacySettings(
                analytics = false,
                personalization = true
            ),
            updatedAt = "2025-06-23T10:00:00Z"
        )
        val response = PreferencesResponse(
            success = true,
            data = mockPreferences,
            message = "Success"
        )
        whenever(apiService.getPreferences()).thenReturn(response)

        // When
        val result = userRepository.getUserPreferences()

        // Then
        assertTrue(result.isSuccess)
        assertEquals(mockPreferences, result.getOrNull())
    }

    @Test
    fun `getUserPreferences returns failure when API call fails`() = runTest {
        // Given
        val response = PreferencesResponse(
            success = false,
            data = null,
            message = "Failed to get preferences"
        )
        whenever(apiService.getPreferences()).thenReturn(response)

        // When
        val result = userRepository.getUserPreferences()

        // Then
        assertTrue(result.isFailure)
        assertEquals("Failed to get preferences", result.exceptionOrNull()?.message)
    }

    @Test
    fun `updateUserPreferences returns success when API call succeeds`() = runTest {
        // Given
        val inputPreferences = UserPreferences(
            userId = "test-user-id",
            preferredLanguages = listOf("en"),
            feedCategories = emptyList(),
            translationSettings = TranslationSettings(),
            themePreference = "system",
            notificationSettings = NotificationSettings(),
            privacySettings = PrivacySettings(),
            updatedAt = ""
        )
        val updatedPreferences = inputPreferences.copy(
            updatedAt = "2025-06-23T10:30:00Z"
        )
        val response = PreferencesResponse(
            success = true,
            data = updatedPreferences,
            message = "Preferences updated successfully"
        )
        whenever(apiService.updatePreferences(inputPreferences)).thenReturn(response)

        // When
        val result = userRepository.updateUserPreferences(inputPreferences)

        // Then
        assertTrue(result.isSuccess)
        assertEquals(updatedPreferences, result.getOrNull())
    }

    @Test
    fun `updateUserPreferences returns failure when API call fails`() = runTest {
        // Given
        val inputPreferences = UserPreferences(
            userId = "test-user-id",
            preferredLanguages = listOf("en"),
            feedCategories = emptyList(),
            translationSettings = TranslationSettings(),
            themePreference = "system",
            notificationSettings = NotificationSettings(),
            privacySettings = PrivacySettings(),
            updatedAt = ""
        )
        val response = PreferencesResponse(
            success = false,
            data = null,
            message = "Failed to update preferences"
        )
        whenever(apiService.updatePreferences(inputPreferences)).thenReturn(response)

        // When
        val result = userRepository.updateUserPreferences(inputPreferences)

        // Then
        assertTrue(result.isFailure)
        assertEquals("Failed to update preferences", result.exceptionOrNull()?.message)
    }

    @Test
    fun `getUserPreferences handles network exception`() = runTest {
        // Given
        val exception = RuntimeException("Network error")
        whenever(apiService.getPreferences()).thenThrow(exception)

        // When
        val result = userRepository.getUserPreferences()

        // Then
        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }

    @Test
    fun `updateUserPreferences handles network exception`() = runTest {
        // Given
        val inputPreferences = UserPreferences(
            userId = "test-user-id",
            preferredLanguages = listOf("en"),
            feedCategories = emptyList(),
            translationSettings = TranslationSettings(),
            themePreference = "system",
            notificationSettings = NotificationSettings(),
            privacySettings = PrivacySettings(),
            updatedAt = ""
        )
        val exception = RuntimeException("Network error")
        whenever(apiService.updatePreferences(inputPreferences)).thenThrow(exception)

        // When
        val result = userRepository.updateUserPreferences(inputPreferences)

        // Then
        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }
}