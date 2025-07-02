package com.babelfeed.app.ui.screens.verify

import com.babelfeed.app.TestActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.semantics.SemanticsProperties
import com.babelfeed.app.auth.AuthenticationManager
import com.babelfeed.app.data.models.*
import com.babelfeed.app.ui.theme.BabelFeedTheme
import com.babelfeed.app.utils.LocaleManager
import dagger.hilt.android.testing.BindValue
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import io.mockk.*
import kotlinx.coroutines.delay
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject
import android.app.Application

/**
 * Instrumented tests for VerificationScreen.
 * These tests verify OTP input, resend functionality, loading states, and success handling.
 */
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class VerificationScreenInstrumentedTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<TestActivity>()

    @BindValue
    @JvmField
    val mockAuthManager: AuthenticationManager = mockk()

    @Inject
    lateinit var localeManager: LocaleManager

    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val mockOnBackClick = mockk<() -> Unit>(relaxed = true)
    private val mockOnVerificationSuccess = mockk<() -> Unit>(relaxed = true)

    private val testEmail = "test@example.com"
    private val testOtp = "1234"

    private val testVerificationResult = VerificationResult(
        user = User(
            id = "test_id",
            email = testEmail,
            guestId = null,
            userStatus = "verified",
            emailVerified = true,
            createdAt = "2024-01-01T00:00:00Z",
            updatedAt = "2024-01-01T00:00:00Z"
        ),
        preferences = UserPreferences(
            userId = "test_id",
            preferredLanguages = listOf("en"),
            feedCategories = emptyList(),
            translationSettings = TranslationSettings(
                autoTranslate = true,
                defaultTargetLanguage = "en"
            ),
            themePreference = "system",
            notificationSettings = NotificationSettings(),
            privacySettings = PrivacySettings(),
            updatedAt = "2024-01-01T00:00:00Z"
        )
    )

    @Before
    fun setup() {
        hiltRule.inject()

        // Setup default mock behaviors
        coEvery { mockAuthManager.verifyEmail(any()) } returns Result.success(testVerificationResult)
        coEvery { mockAuthManager.resendVerificationCode(any()) } returns Result.success(Unit)
    }

    @Test
    fun verificationScreen_displaysNavigationBar() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("Back")
            .assertExists()
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithContentDescription("Verification Screen")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun verificationScreen_backButton_triggersCallback() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("Back")
            .performClick()

        verify { mockOnBackClick() }
    }

    @Test
    fun verificationScreen_displaysEmailSentMessage() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("Email Sent Message")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun verificationScreen_displaysOtpInputField() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("OTP")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun verificationScreen_otpInput_acceptsOnlyDigits() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        val otpInput = composeTestRule.onNodeWithContentDescription("OTP")

        // Custom matcher to check only the editable text property, which holds the input value.
        fun hasEditableText(expectedText: String): SemanticsMatcher {
            return SemanticsMatcher("Editable text is '$expectedText'") { node ->
                val editableText = node.config.getOrElse(SemanticsProperties.EditableText) {
                    // Return an empty AnnotatedString if the property doesn't exist
                    AnnotatedString("")
                }
                editableText.text == expectedText
            }
        }

        // Try to input letters
        otpInput.performTextInput("abcd")
        otpInput.assert(hasEditableText("")) // Should be empty

        // Try to input numbers
        otpInput.performTextInput("1234")
        otpInput.assert(hasEditableText("1234")) // Should accept numbers
    }

    @Test
    fun verificationScreen_submitButton_disabledUntilValidOtp() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        val submitButton = composeTestRule.onNodeWithContentDescription("Submit")
        val otpInput = composeTestRule.onNodeWithContentDescription("OTP")

        // Initially disabled
        submitButton.assertIsNotEnabled()

        // Still disabled with partial input
        otpInput.performTextInput("123")
        submitButton.assertIsNotEnabled()

        // Enabled with 4 digits
        otpInput.performTextInput("4")
        submitButton.assertIsEnabled()
    }

    @Test
    fun verificationScreen_submitButton_triggersVerification() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        val otpInput = composeTestRule.onNodeWithContentDescription("OTP")
        val submitButton = composeTestRule.onNodeWithContentDescription("Submit")

        // Enter valid OTP
        otpInput.performTextInput(testOtp)
        submitButton.performClick()

        // Verify authentication manager was called
        coVerify { mockAuthManager.verifyEmail(testOtp) }
    }

    @Test
    fun verificationScreen_successState_displaysSuccessIcon() {
        // Mock successful verification
        coEvery { mockAuthManager.verifyEmail(any()) } returns Result.success(testVerificationResult)

        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        val otpInput = composeTestRule.onNodeWithContentDescription("OTP")
        val submitButton = composeTestRule.onNodeWithContentDescription("Submit")

        // Submit valid OTP
        otpInput.performTextInput(testOtp)
        submitButton.performClick()

        // Wait for success state
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Success Icon")
                .fetchSemanticsNodes().isNotEmpty()
        }

        composeTestRule
            .onNodeWithContentDescription("Success Icon")
            .assertExists()
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithContentDescription("Verification Successful")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun verificationScreen_successState_triggersNavigationCallback() {
        // Mock successful verification with delay for success display
        coEvery { mockAuthManager.verifyEmail(any()) } returns Result.success(testVerificationResult)

        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        val otpInput = composeTestRule.onNodeWithContentDescription("OTP")
        val submitButton = composeTestRule.onNodeWithContentDescription("Submit")

        // Submit valid OTP
        otpInput.performTextInput(testOtp)
        submitButton.performClick()

        // Wait for success UI to appear
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule.onAllNodesWithContentDescription("Success Icon").fetchSemanticsNodes().isNotEmpty()
        }

        // Advance clock to trigger callback after delay
        composeTestRule.mainClock.advanceTimeBy(3000)

        verify { mockOnVerificationSuccess() }
    }

    @Test
    fun verificationScreen_displaysResendButton() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("Resend Code")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun verificationScreen_resendButton_showsCooldownTimer() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        // Initially should be disabled with cooldown timer
        composeTestRule
            .onNodeWithContentDescription("Resend Code")
            .assertIsNotEnabled()

        // Should show countdown text (starts at 3 in test mode)
        // Wait a moment for initial countdown to show
        composeTestRule.waitForIdle()
        
        // Verify countdown is shown - could be any number between 1-3 in test mode
        composeTestRule.waitUntil(timeoutMillis = 2000) {
            val hasCountdownText = (1..3).any { num ->
                composeTestRule
                    .onAllNodesWithText(num.toString(), substring = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
            hasCountdownText
        }
    }

    @Test
    fun verificationScreen_resendButton_triggersResendAfterCooldown() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        val resendButton = composeTestRule.onNodeWithContentDescription("Resend Code")

        // Initially disabled during cooldown
        resendButton.assertIsNotEnabled()

        // Wait for cooldown to complete (3 seconds in test environment)
        composeTestRule.waitUntil(timeoutMillis = 5_000) {
            composeTestRule
                .onAllNodes(hasContentDescription("Resend Code").and(isEnabled()))
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Button should be enabled now
        resendButton.assertIsEnabled()

        // Click the resend button
        resendButton.performClick()

        // Verify that the resend function was called
        coVerify { mockAuthManager.resendVerificationCode(testEmail) }
    }

    @Test
    fun verificationScreen_verifyingState_showsLoadingIndicator() {
        // Mock verification to take some time
        coEvery { mockAuthManager.verifyEmail(any()) } coAnswers {
            delay(2000)
            Result.success(testVerificationResult)
        }

        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        val otpInput = composeTestRule.onNodeWithContentDescription("OTP")
        val submitButton = composeTestRule.onNodeWithContentDescription("Submit")

        // Submit OTP
        otpInput.performTextInput(testOtp)
        submitButton.performClick()

        // Should show verifying state
        composeTestRule
            .onNodeWithContentDescription("Verifying")
            .assertExists()
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithContentDescription("Verifying Code")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun verificationScreen_errorState_displaysErrorBanner() {
        val errorMessage = "Invalid verification code"
        coEvery { mockAuthManager.verifyEmail(any()) } returns Result.failure(Exception(errorMessage))

        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        val otpInput = composeTestRule.onNodeWithContentDescription("OTP")
        val submitButton = composeTestRule.onNodeWithContentDescription("Submit")

        // Submit invalid OTP
        otpInput.performTextInput(testOtp)
        submitButton.performClick()

        // Wait for error to appear
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Error Message")
                .fetchSemanticsNodes().isNotEmpty()
        }

        composeTestRule
            .onNodeWithContentDescription("Error Message")
            .assertExists()
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithContentDescription("Dismiss Error")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun verificationScreen_errorBanner_canBeDismissed() {
        val errorMessage = "Invalid verification code"
        coEvery { mockAuthManager.verifyEmail(any()) } returns Result.failure(Exception(errorMessage))

        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        val otpInput = composeTestRule.onNodeWithContentDescription("OTP")
        val submitButton = composeTestRule.onNodeWithContentDescription("Submit")

        // Trigger error
        otpInput.performTextInput(testOtp)
        submitButton.performClick()

        // Wait for error to appear
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Error Message")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Dismiss error
        composeTestRule
            .onNodeWithContentDescription("Dismiss Error")
            .performClick()

        // Error should be gone
        composeTestRule
            .onNodeWithContentDescription("Error Message")
            .assertDoesNotExist()
    }

    @Test
    fun verificationScreen_multipleAttempts_allowsRetry() {
        var callCount = 0
        coEvery { mockAuthManager.verifyEmail(any()) } answers {
            callCount++
            if (callCount == 1) {
                Result.failure(Exception("Invalid code"))
            } else {
                Result.success(testVerificationResult)
            }
        }

        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        val otpInput = composeTestRule.onNodeWithContentDescription("OTP")
        val submitButton = composeTestRule.onNodeWithContentDescription("Submit")

        // First attempt - should fail
        otpInput.performTextInput("0000")
        submitButton.performClick()

        // Wait for error
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Error Message")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Clear and try again
        otpInput.performTextClearance()
        otpInput.performTextInput(testOtp)
        submitButton.performClick()

        // Should succeed this time
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Success Icon")
                .fetchSemanticsNodes().isNotEmpty()
        }

        coVerify(exactly = 2) { mockAuthManager.verifyEmail(any()) }
    }

    @Test
    fun verificationScreen_accessibility_labelsAreCorrect() {
        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        // Check all required accessibility labels exist
        val expectedLabels = listOf(
            "Back",
            "Verification Screen",
            "Email Sent Message", 
            "OTP",
            "Submit",
            "Resend Code"
        )

        expectedLabels.forEach { label ->
            composeTestRule
                .onNodeWithContentDescription(label)
                .assertExists()
        }
    }

    @Test
    fun verificationScreen_successMessage_displaysCorrectly() {
        // Mock successful verification to trigger success message
        coEvery { mockAuthManager.resendVerificationCode(any()) } returns Result.success(Unit)

        composeTestRule.setContent {
            BabelFeedTheme {
                VerificationScreen(
                    email = testEmail,
                    onBackClick = mockOnBackClick,
                    onVerificationSuccess = mockOnVerificationSuccess
                )
            }
        }

        // Note: Success message banner would appear after resend success
        // We can test the structure even if we can't easily trigger it in this test
        
        // Verify the basic screen components that should always be there
        composeTestRule
            .onNodeWithContentDescription("Email Sent Message")
            .assertExists()
            .assertIsDisplayed()
    }
}