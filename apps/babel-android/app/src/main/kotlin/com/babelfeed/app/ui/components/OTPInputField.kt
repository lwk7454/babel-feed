package com.babelfeed.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun OTPInputField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    digitCount: Int = 4,
    isError: Boolean = false
) {
    val focusRequester = remember { FocusRequester() }
    var textFieldValue by remember(value) {
        mutableStateOf(
            TextFieldValue(
                text = value,
                selection = TextRange(value.length)
            )
        )
    }

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(digitCount) { index ->
            OTPDigitBox(
                digit = value.getOrNull(index)?.toString() ?: "",
                isFocused = index == value.length,
                isError = isError,
                modifier = Modifier.weight(1f)
            )
        }
    }

    // Hidden text field for input handling
    BasicTextField(
        value = textFieldValue,
        onValueChange = { newValue ->
            val filteredText = newValue.text.filter { it.isDigit() }.take(digitCount)
            textFieldValue = newValue.copy(
                text = filteredText,
                selection = TextRange(filteredText.length)
            )
            onValueChange(filteredText)
        },
        modifier = Modifier
            .size(0.dp)
            .focusRequester(focusRequester),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        singleLine = true
    )

    // Auto-focus when component appears
    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }
}

@Composable
private fun OTPDigitBox(
    digit: String,
    isFocused: Boolean,
    isError: Boolean,
    modifier: Modifier = Modifier
) {
    val borderColor = when {
        isError -> MaterialTheme.colorScheme.error
        isFocused -> MaterialTheme.colorScheme.primary
        digit.isNotEmpty() -> MaterialTheme.colorScheme.outline
        else -> MaterialTheme.colorScheme.outlineVariant
    }

    val backgroundColor = when {
        isError -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.1f)
        isFocused -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.1f)
        else -> MaterialTheme.colorScheme.surface
    }

    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .border(
                width = 2.dp,
                color = borderColor,
                shape = RoundedCornerShape(12.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = digit,
            style = TextStyle(
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = if (isError) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onSurface
                }
            )
        )
        
        // Cursor indicator when focused and empty
        if (isFocused && digit.isEmpty()) {
            Box(
                modifier = Modifier
                    .width(2.dp)
                    .height(24.dp)
                    .background(MaterialTheme.colorScheme.primary)
            )
        }
    }
}