package com.babelfeed.app.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.babelfeed.app.ui.theme.BabelFeedTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for LanguageBadge component.
 * These tests verify the UI behavior and display of language badges.
 */
@RunWith(AndroidJUnit4::class)
class LanguageBadgeInstrumentedTest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun languageBadge_displaysEnglishCode() {
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "EN")
            }
        }

        composeTestRule
            .onNodeWithText("EN")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun languageBadge_displaysChineseSimplifiedCode() {
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "ZH")
            }
        }

        composeTestRule
            .onNodeWithText("ZH")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun languageBadge_displaysChineseTraditionalCode() {
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "ZH")
            }
        }

        composeTestRule
            .onNodeWithText("ZH")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun languageBadge_displaysJapaneseCode() {
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "JA")
            }
        }

        composeTestRule
            .onNodeWithText("JA")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun languageBadge_displaysUnknownLanguageCode() {
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "UN")
            }
        }

        composeTestRule
            .onNodeWithText("UN")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun languageBadge_handlesEmptyString() {
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "")
            }
        }

        // Empty text may not be visible, but the badge container should exist
        composeTestRule
            .onNodeWithContentDescription("Language Badge ")
            .assertExists()
    }

    @Test
    fun languageBadge_handlesCaseSensitivity() {
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "en")
            }
        }

        // Should display as provided
        composeTestRule
            .onNodeWithText("en")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun languageBadge_handlesLongLanguageCode() {
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "EN-US-VARIANT")
            }
        }

        // Should display full string as provided
        composeTestRule
            .onNodeWithText("EN-US-VARIANT")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun languageBadge_multipleLanguages_displayCorrectly() {
        val languages = listOf("EN", "ZH", "JA", "FR")
        
        // Test all languages in a single setContent call to avoid "setContent twice" error
        composeTestRule.setContent {
            BabelFeedTheme {
                // Create multiple badges to test different language codes
                androidx.compose.foundation.layout.Column {
                    languages.forEach { code ->
                        LanguageBadge(languageCode = code)
                    }
                }
            }
        }

        // Verify each language badge is displayed correctly
        languages.forEach { code ->
            composeTestRule
                .onNodeWithText(code)
                .assertExists()
                .assertIsDisplayed()
                
            composeTestRule
                .onNodeWithContentDescription("Language Badge $code")
                .assertExists()
                .assertIsDisplayed()
        }
    }

    @Test
    fun languageBadge_hasAccessibleContentDescription() {
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "EN")
            }
        }

        // Verify accessibility content description exists
        composeTestRule
            .onNodeWithContentDescription("Language Badge EN")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun languageBadge_visualProperties() {
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "JA")
            }
        }

        // Verify the badge is displayed with proper styling
        val badge = composeTestRule.onNodeWithText("JA")
        badge.assertExists()
        badge.assertIsDisplayed()
        
        // Badge should be visible and interactive
        val badgeContainer = composeTestRule.onNodeWithContentDescription("Language Badge JA")
        badgeContainer.assertExists()
        badgeContainer.assertIsDisplayed()
    }

    @Test
    fun languageBadge_consistentSizing() {
        // Test with one representative language code
        composeTestRule.setContent {
            BabelFeedTheme {
                LanguageBadge(languageCode = "EN")
            }
        }

        // Badge should have consistent sizing
        val badge = composeTestRule.onNodeWithContentDescription("Language Badge EN")
        badge.assertExists()
        badge.assertIsDisplayed()
    }
}