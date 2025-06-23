package com.babelfeed.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.babelfeed.app.R
import com.babelfeed.app.utils.LocaleManager

/**
 * A small badge component that displays the source language code
 * (e.g., "EN", "ZH", "JA") for articles and content.
 */
@Composable
fun LanguageBadge(
    languageCode: String,
    modifier: Modifier = Modifier
) {
    val displayCode = getLanguageDisplayCode(languageCode)
    
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(MaterialTheme.colorScheme.secondary)
            .padding(horizontal = 6.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = displayCode,
            color = MaterialTheme.colorScheme.onSecondary,
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 10.sp
            )
        )
    }
}

/**
 * Helper function to get the display code for a language
 */
@Composable
private fun getLanguageDisplayCode(languageCode: String): String {
    return when (languageCode.lowercase()) {
        "en" -> stringResource(R.string.lang_code_en)
        "zh", "zh-cn", "zh-tw" -> stringResource(R.string.lang_code_zh)
        "ja" -> stringResource(R.string.lang_code_ja)
        "es" -> stringResource(R.string.lang_code_es)
        "fr" -> stringResource(R.string.lang_code_fr)
        "de" -> stringResource(R.string.lang_code_de)
        "it" -> stringResource(R.string.lang_code_it)
        "pt" -> stringResource(R.string.lang_code_pt)
        "ko" -> stringResource(R.string.lang_code_ko)
        else -> languageCode.take(2).uppercase()
    }
}