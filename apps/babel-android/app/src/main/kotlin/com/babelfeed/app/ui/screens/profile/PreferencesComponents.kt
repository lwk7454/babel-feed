package com.babelfeed.app.ui.screens.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.babelfeed.app.R
import com.babelfeed.app.data.models.UserPreferences

@Composable
fun PreferencesCard(
    preferences: UserPreferences?,
    onUpdatePreferences: (UserPreferences) -> Unit,
    onBack: () -> Unit
) {
    var currentPreferences by remember { 
        mutableStateOf(preferences ?: UserPreferences(
            userId = "",
            preferredLanguages = listOf("en"),
            feedCategories = emptyList(),
            translationSettings = com.babelfeed.app.data.models.TranslationSettings(),
            themePreference = "system",
            notificationSettings = com.babelfeed.app.data.models.NotificationSettings(),
            privacySettings = com.babelfeed.app.data.models.PrivacySettings(),
            updatedAt = ""
        ))
    }

    Card {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.preferences),
                    style = MaterialTheme.typography.titleLarge
                )
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = stringResource(R.string.back))
                }
            }

            Divider()

            // Language Preferences
            PreferenceSection(
                title = stringResource(R.string.language_preferences),
                icon = Icons.Default.Person
            ) {
                val languageOptions = listOf(
                    "en" to stringResource(R.string.language_english),
                    "es" to stringResource(R.string.language_spanish), 
                    "fr" to stringResource(R.string.language_french),
                    "de" to stringResource(R.string.language_german),
                    "it" to stringResource(R.string.language_italian),
                    "pt" to stringResource(R.string.language_portuguese),
                    "ja" to stringResource(R.string.language_japanese),
                    "ko" to stringResource(R.string.language_korean),
                    "zh" to stringResource(R.string.language_chinese)
                )
                
                Column(modifier = Modifier.selectableGroup()) {
                    languageOptions.forEach { (code, name) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(
                                    selected = currentPreferences.preferredLanguages.contains(code),
                                    onClick = {
                                        val updatedLanguages = if (currentPreferences.preferredLanguages.contains(code)) {
                                            currentPreferences.preferredLanguages - code
                                        } else {
                                            currentPreferences.preferredLanguages + code
                                        }
                                        currentPreferences = currentPreferences.copy(
                                            preferredLanguages = updatedLanguages
                                        )
                                    }
                                ),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = currentPreferences.preferredLanguages.contains(code),
                                onCheckedChange = null
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(name)
                        }
                    }
                }
            }

            // Translation Settings
            PreferenceSection(
                title = stringResource(R.string.translation_settings),
                icon = Icons.Default.Person
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(stringResource(R.string.auto_translate_content))
                    Switch(
                        checked = currentPreferences.translationSettings.autoTranslate,
                        onCheckedChange = { enabled ->
                            currentPreferences = currentPreferences.copy(
                                translationSettings = currentPreferences.translationSettings.copy(
                                    autoTranslate = enabled
                                )
                            )
                        }
                    )
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = stringResource(R.string.default_target_language),
                    style = MaterialTheme.typography.bodyMedium
                )
                val targetLanguageOptions = listOf(
                    "en" to stringResource(R.string.language_english),
                    "es" to stringResource(R.string.language_spanish),
                    "fr" to stringResource(R.string.language_french),
                    "de" to stringResource(R.string.language_german)
                )
                Column(modifier = Modifier.selectableGroup()) {
                    targetLanguageOptions.forEach { (code, name) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(
                                    selected = currentPreferences.translationSettings.defaultTargetLanguage == code,
                                    onClick = {
                                        currentPreferences = currentPreferences.copy(
                                            translationSettings = currentPreferences.translationSettings.copy(
                                                defaultTargetLanguage = code
                                            )
                                        )
                                    }
                                ),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = currentPreferences.translationSettings.defaultTargetLanguage == code,
                                onClick = null
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(name)
                        }
                    }
                }
            }

            // Theme Preferences
            PreferenceSection(
                title = stringResource(R.string.theme),
                icon = Icons.Default.Person
            ) {
                val themeOptions = listOf(
                    "light" to stringResource(R.string.theme_light),
                    "dark" to stringResource(R.string.theme_dark),
                    "system" to stringResource(R.string.theme_system)
                )
                Column(modifier = Modifier.selectableGroup()) {
                    themeOptions.forEach { (code, name) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(
                                    selected = currentPreferences.themePreference == code,
                                    onClick = {
                                        currentPreferences = currentPreferences.copy(
                                            themePreference = code
                                        )
                                    }
                                ),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = currentPreferences.themePreference == code,
                                onClick = null
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(name)
                        }
                    }
                }
            }

            // Notification Settings
            PreferenceSection(
                title = stringResource(R.string.notifications),
                icon = Icons.Default.Person
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(stringResource(R.string.email_notifications))
                    Switch(
                        checked = currentPreferences.notificationSettings.emailNotifications,
                        onCheckedChange = { enabled ->
                            currentPreferences = currentPreferences.copy(
                                notificationSettings = currentPreferences.notificationSettings.copy(
                                    emailNotifications = enabled
                                )
                            )
                        }
                    )
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(stringResource(R.string.push_notifications))
                    Switch(
                        checked = currentPreferences.notificationSettings.pushNotifications,
                        onCheckedChange = { enabled ->
                            currentPreferences = currentPreferences.copy(
                                notificationSettings = currentPreferences.notificationSettings.copy(
                                    pushNotifications = enabled
                                )
                            )
                        }
                    )
                }
            }

            // Privacy Settings
            PreferenceSection(
                title = stringResource(R.string.privacy),
                icon = Icons.Default.Person
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(stringResource(R.string.analytics))
                    Switch(
                        checked = currentPreferences.privacySettings.analytics,
                        onCheckedChange = { enabled ->
                            currentPreferences = currentPreferences.copy(
                                privacySettings = currentPreferences.privacySettings.copy(
                                    analytics = enabled
                                )
                            )
                        }
                    )
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(stringResource(R.string.personalization))
                    Switch(
                        checked = currentPreferences.privacySettings.personalization,
                        onCheckedChange = { enabled ->
                            currentPreferences = currentPreferences.copy(
                                privacySettings = currentPreferences.privacySettings.copy(
                                    personalization = enabled
                                )
                            )
                        }
                    )
                }
            }

            Divider()

            // Save Button
            Button(
                onClick = { onUpdatePreferences(currentPreferences) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = stringResource(R.string.save),
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.save_preferences))
            }
        }
    }
}

@Composable
fun PreferenceSection(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    content: @Composable () -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
        
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Box(modifier = Modifier.padding(12.dp)) {
                content()
            }
        }
    }
}