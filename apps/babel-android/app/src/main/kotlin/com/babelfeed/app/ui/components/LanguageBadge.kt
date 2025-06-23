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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Small badge component to display source language code (e.g., "EN", "ZH", "JA")
 */
@Composable
fun LanguageBadge(
    languageCode: String,
    modifier: Modifier = Modifier,
    backgroundColor: Color = MaterialTheme.colorScheme.primaryContainer,
    textColor: Color = MaterialTheme.colorScheme.onPrimaryContainer
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(backgroundColor)
            .padding(horizontal = 6.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = languageCode,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = textColor,
            maxLines = 1
        )
    }
}