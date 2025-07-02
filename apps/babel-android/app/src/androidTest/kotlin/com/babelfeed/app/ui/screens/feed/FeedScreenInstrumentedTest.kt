package com.babelfeed.app.ui.screens.feed

import com.babelfeed.app.TestActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.babelfeed.app.data.models.Article
import com.babelfeed.app.data.repository.ArticleRepository
import com.babelfeed.app.ui.theme.BabelFeedTheme
import com.babelfeed.app.utils.LocaleManager
import dagger.hilt.android.testing.BindValue
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import io.mockk.*
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * Instrumented tests for FeedScreen.
 * These tests verify article display, navigation, and user interactions.
 */
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class FeedScreenInstrumentedTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<TestActivity>()

    @BindValue
    @JvmField
    val mockArticleRepository: ArticleRepository = mockk()

    @Inject
    lateinit var localeManager: LocaleManager

    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val mockOnArticleClick = mockk<(String) -> Unit>(relaxed = true)
    private val mockOnReadFullArticle = mockk<(String) -> Unit>(relaxed = true)
    private val mockOnProfileClick = mockk<() -> Unit>(relaxed = true)

    private val testArticles = listOf(
        Article(
            id = "1",
            title = "Test Article 1",
            titleTranslations = mapOf(
                "en" to "Test Article 1",
                "zh-CN" to "测试文章1",
                "ja" to "テスト記事1"
            ),
            summary = "Test summary 1",
            summaryTranslations = mapOf(
                "en" to "Test summary 1",
                "zh-CN" to "测试摘要1"
            ),
            url = "https://example.com/article1",
            source = "Test Source",
            sourceLanguage = "en",
            publishedAt = "2024-01-01T00:00:00Z"
        ),
        Article(
            id = "2",
            title = "Japanese Article",
            titleTranslations = mapOf(
                "ja" to "Japanese Article",
                "en" to "Japanese Article Translated"
            ),
            summary = "Japanese summary",
            url = "https://example.com/article2",
            source = "Japanese Source",
            sourceLanguage = "ja",
            publishedAt = "2024-01-02T00:00:00Z"
        )
    )

    @Before
    fun setup() {
        hiltRule.inject()
        
        // Mock repository to return test articles by default
        coEvery { mockArticleRepository.getArticles() } returns testArticles
    }

    @Test
    fun feedScreen_displaysAppTitle() {
        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("App Title")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun feedScreen_displaysProfileButton() {
        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("Profile")
            .assertExists()
            .assertIsDisplayed()
            .assertHasClickAction()
    }

    @Test
    fun feedScreen_profileButton_triggersCallback() {
        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("Profile")
            .performClick()

        verify { mockOnProfileClick() }
    }

    @Test
    fun feedScreen_showsLoadingState() {
        // Mock repository to suspend indefinitely to keep loading state
        coEvery { mockArticleRepository.getArticles() } coAnswers { 
            kotlinx.coroutines.delay(10000)
            testArticles
        }

        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        composeTestRule
            .onNodeWithContentDescription("Loading")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun feedScreen_displaysArticles() {
        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        // Wait for loading to complete
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Articles List")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Verify articles are displayed
        composeTestRule
            .onNodeWithContentDescription("Articles List")
            .assertExists()
            .assertIsDisplayed()

        // Verify individual articles
        testArticles.forEach { article ->
            val currentLocale = localeManager.getCurrentLocale(context)
            val localizedTitle = article.getLocalizedTitle(currentLocale)
            
            composeTestRule
                .onNodeWithContentDescription("Article Card $localizedTitle")
                .assertExists()
                .assertIsDisplayed()
        }
    }

    @Test
    fun feedScreen_articleCards_showCorrectContent() {
        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        // Wait for articles to load
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Article Title")
                .fetchSemanticsNodes().isNotEmpty()
        }

        testArticles.forEachIndexed { index, article ->
            val currentLocale = localeManager.getCurrentLocale(context)
            val localizedTitle = article.getLocalizedTitle(currentLocale)
            
            // Check article title
            composeTestRule
                .onNodeWithText(localizedTitle)
                .assertExists()
                .assertIsDisplayed()

            // Check article source (should be formatted as "Source: Test Source")
            // Use onAllNodes to get all source nodes, then check the specific one
            composeTestRule
                .onAllNodesWithContentDescription("Article Source")[index]
                .assertExists()
                .assertIsDisplayed()
        }
    }

    @Test
    fun feedScreen_articleCards_displayLanguageBadges() {
        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        // Wait for articles to load
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Articles List")
                .fetchSemanticsNodes().isNotEmpty()
        }

        testArticles.forEach { article ->
            val expectedLanguageCode = article.getSourceLanguageCode()
            
            composeTestRule
                .onNodeWithText(expectedLanguageCode)
                .assertExists()
                .assertIsDisplayed()
        }
    }

    @Test
    fun feedScreen_articleCards_areClickable() {
        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        // Wait for articles to load
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Article Title")
                .fetchSemanticsNodes().isNotEmpty()
        }

        val firstArticle = testArticles.first()
        val currentLocale = localeManager.getCurrentLocale(context)
        val localizedTitle = firstArticle.getLocalizedTitle(currentLocale)

        composeTestRule
            .onNodeWithContentDescription("Article Card $localizedTitle")
            .assertHasClickAction()
            .performClick()

        verify { mockOnArticleClick(firstArticle.id) }
    }

    @Test
    fun feedScreen_showsErrorState() {
        val errorMessage = "Network error"
        coEvery { mockArticleRepository.getArticles() } throws Exception(errorMessage)

        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        // Wait for error state
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Error Message")
                .fetchSemanticsNodes().isNotEmpty()
        }

        composeTestRule
            .onNodeWithContentDescription("Error Message")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun feedScreen_showsEmptyState() {
        coEvery { mockArticleRepository.getArticles() } returns emptyList()

        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        // Wait for empty state
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("No Articles Available")
                .fetchSemanticsNodes().isNotEmpty()
        }

        composeTestRule
            .onNodeWithContentDescription("No Articles Available")
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun feedScreen_articlesDisplay_respectsUserLanguage() {
        // Set locale to Chinese
        localeManager.saveLocale(context, "zh-CN")

        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        // Wait for articles to load
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Article Title")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Check that Chinese translations are displayed when available
        val firstArticle = testArticles.first()
        val chineseTitle = firstArticle.titleTranslations["zh-CN"]!!
        
        composeTestRule
            .onNodeWithText(chineseTitle)
            .assertExists()
            .assertIsDisplayed()
    }

    @Test
    fun feedScreen_scrolling_worksCorrectly() {
        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        // Wait for articles to load
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Articles List")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Verify scrolling works
        composeTestRule
            .onNodeWithContentDescription("Articles List")
            .performScrollToIndex(testArticles.size - 1)

        // Last article should be visible after scrolling
        val lastArticle = testArticles.last()
        val currentLocale = localeManager.getCurrentLocale(context)
        val localizedTitle = lastArticle.getLocalizedTitle(currentLocale)
        
        composeTestRule
            .onNodeWithContentDescription("Article Card $localizedTitle")
            .assertIsDisplayed()
    }

    @Test
    fun feedScreen_navigationCallbacks_workCorrectly() {
        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        // Wait for articles to load
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Article Title")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Test article click
        val firstArticle = testArticles.first()
        val currentLocale = localeManager.getCurrentLocale(context)
        val localizedTitle = firstArticle.getLocalizedTitle(currentLocale)

        composeTestRule
            .onNodeWithContentDescription("Article Card $localizedTitle")
            .performClick()

        verify { mockOnArticleClick(firstArticle.id) }

        // Test profile click
        composeTestRule
            .onNodeWithContentDescription("Profile")
            .performClick()

        verify { mockOnProfileClick() }
    }

    @Test
    fun feedScreen_languageBadges_showCorrectValues() {
        composeTestRule.setContent {
            BabelFeedTheme {
                FeedScreen(
                    onArticleClick = mockOnArticleClick,
                    onReadFullArticle = mockOnReadFullArticle,
                    onProfileClick = mockOnProfileClick
                )
            }
        }

        // Wait for articles to load
        composeTestRule.waitUntil(timeoutMillis = 5000) {
            composeTestRule
                .onAllNodesWithContentDescription("Articles List")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Verify language badges show correct codes
        composeTestRule
            .onNodeWithText("EN") // English article
            .assertExists()
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText("JA") // Japanese article
            .assertExists()
            .assertIsDisplayed()
    }
}