package com.babelfeed.app.ui.screens.welcome

import com.babelfeed.app.TestActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.babelfeed.app.ui.theme.BabelFeedTheme
import com.babelfeed.app.utils.LocaleManager
import dagger.hilt.android.testing.BindValue
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * Instrumented tests for WelcomeScreen.
 * These tests verify language selection functionality and user interactions.
 */
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class WelcomeScreenInstrumentedTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<TestActivity>()

    @BindValue
    @JvmField
    val mockWelcomeViewModel: WelcomeViewModel = mockk(relaxed = true)

    @Inject
    lateinit var localeManager: LocaleManager

    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val mockOnLanguageSelected = mockk<(String) -> Unit>(relaxed = true)

    @Before
    fun setup() {
        hiltRule.inject()
        
        // Setup mock ViewModel behavior
        every { mockWelcomeViewModel.localeManager } returns localeManager
        every { mockWelcomeViewModel.shouldRecreateActivity } returns MutableStateFlow(false)
        every { mockWelcomeViewModel.previewLanguageChange(any(), any()) } returns Unit
        every { mockWelcomeViewModel.saveLanguagePreference(any(), any()) } returns Unit
        every { mockWelcomeViewModel.onActivityRecreated() } returns Unit
    }

    @Test
    fun welcomeScreen_displaysWelcomeMessage() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("Welcome")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun welcomeScreen_displaysLanguageSelectionCard() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("Select Language")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun welcomeScreen_displaysAllSupportedLanguages() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        // Verify all supported languages are displayed
        LocaleManager.SUPPORTED_LANGUAGES.forEach { (code, name) ->
            composeTestRule
                .onNodeWithContentDescription("Language Option $name")
                .assertExists()
                .assertIsDisplayed()
        }
    }

    @Test
    fun welcomeScreen_languageSelection_changesSelectedLanguage() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        // Wait for content to be fully loaded
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Select Language")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Click on Chinese Simplified language option
        val chineseOption = LocaleManager.SUPPORTED_LANGUAGES["zh-CN"]!!
        composeTestRule
            .onNodeWithContentDescription("Language Option $chineseOption")
            .performClick()

        // Verify the radio button is selected
        composeTestRule
            .onNodeWithContentDescription("Select $chineseOption")
            .assertIsSelected()
    }

    @Test
    fun welcomeScreen_multipleLanguageSelection_onlyOneSelected() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        // First select English
        val englishOption = LocaleManager.SUPPORTED_LANGUAGES["en"]!!
        composeTestRule
            .onNodeWithContentDescription("Language Option $englishOption")
            .performClick()

        // Then select Japanese
        val japaneseOption = LocaleManager.SUPPORTED_LANGUAGES["ja"]!!
        composeTestRule
            .onNodeWithContentDescription("Language Option $japaneseOption")
            .performClick()

        // Verify only Japanese is selected now
        composeTestRule
            .onNodeWithContentDescription("Select $japaneseOption")
            .assertIsSelected()

        composeTestRule
            .onNodeWithContentDescription("Select $englishOption")
            .assertIsNotSelected()
    }

    @Test
    fun welcomeScreen_continueButton_isDisplayed() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("Continue")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun welcomeScreen_continueButton_triggersCallback() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        // Wait for content to be fully loaded
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Continue")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Select a language first
        val chineseOption = LocaleManager.SUPPORTED_LANGUAGES["zh-CN"]!!
        composeTestRule
            .onNodeWithContentDescription("Language Option $chineseOption")
            .performClick()

        // Click continue button
        composeTestRule
            .onNodeWithContentDescription("Continue")
            .performClick()

        // Verify callback was called
        verify { mockOnLanguageSelected.invoke("zh-CN") }
    }

    @Test
    fun welcomeScreen_continueWithoutSelection_triggersCallback() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        // Click continue without selecting a language (should use default)
        composeTestRule
            .onNodeWithContentDescription("Continue")
            .performClick()

        // Verify callback was called with default language
        verify { mockOnLanguageSelected.invoke(any()) }
    }

    @Test
    fun welcomeScreen_languageOptions_showCorrectCodes() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        // Verify language codes are displayed
        LocaleManager.SUPPORTED_LANGUAGES.forEach { (code, _) ->
            composeTestRule
                .onNodeWithText(code.uppercase())
                .assertExists()
                .assertIsDisplayed()
        }
    }

    @Test
    fun welcomeScreen_allLanguageOptions_areClickable() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        // Wait for content to be fully loaded
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Select Language")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Test clicking each language option
        LocaleManager.SUPPORTED_LANGUAGES.forEach { (code, name) ->
            composeTestRule
                .onNodeWithContentDescription("Language Option $name")
                .assertHasClickAction()
                .performClick()

            // Verify the selection changed
            composeTestRule
                .onNodeWithContentDescription("Select $name")
                .assertIsSelected()
        }
    }

    @Test
    fun welcomeScreen_accessibilityLabels_areCorrect() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        // Check key accessibility labels exist
        composeTestRule
            .onNodeWithContentDescription("Welcome")
            .assertExists()

        composeTestRule
            .onNodeWithContentDescription("Select Language")
            .assertExists()

        composeTestRule
            .onNodeWithContentDescription("Continue")
            .assertExists()

        // Check language option accessibility
        LocaleManager.SUPPORTED_LANGUAGES.forEach { (_, name) ->
            composeTestRule
                .onNodeWithContentDescription("Language Option $name")
                .assertExists()

            composeTestRule
                .onNodeWithContentDescription("Select $name")
                .assertExists()
        }
    }

    @Test
    fun welcomeScreen_defaultLanguage_isPreselected() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        // Get current locale from manager
        val currentLocale = localeManager.getCurrentLocale(context)
        val currentLanguageName = LocaleManager.SUPPORTED_LANGUAGES[currentLocale]!!

        // Verify default language is pre-selected
        composeTestRule
            .onNodeWithContentDescription("Select $currentLanguageName")
            .assertIsSelected()
    }

    @Test
    fun welcomeScreen_languageSelection_persistsAcrossComposition() {
        composeTestRule.setContent {
            BabelFeedTheme {
                WelcomeScreen(
                    onLanguageSelected = mockOnLanguageSelected,
                    viewModel = mockWelcomeViewModel
                )
            }
        }

        // Select Japanese
        val japaneseOption = LocaleManager.SUPPORTED_LANGUAGES["ja"]!!
        composeTestRule
            .onNodeWithContentDescription("Language Option $japaneseOption")
            .performClick()

        // Verify Japanese is selected
        composeTestRule
            .onNodeWithContentDescription("Select $japaneseOption")
            .assertIsSelected()

        // Wait for composition to stabilize
        composeTestRule.waitForIdle()

        // Verify selection is still maintained
        composeTestRule
            .onNodeWithContentDescription("Select $japaneseOption")
            .assertIsSelected()
    }
}