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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.babelfeed.app.R
import com.babelfeed.app.data.models.UserPreferences
import com.babelfeed.app.ui.theme.spacing

@Composable
fun PreferenceSection(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    content: @Composable () -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.medium)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.small),
            modifier = Modifier.padding(vertical = MaterialTheme.spacing.small)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                modifier = Modifier.size(20.dp).semantics { contentDescription = "$title Icon" },
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.semantics { contentDescription = "$title Section" }
            )
        }
        
        Card(
            elevation = CardDefaults.cardElevation(
                defaultElevation = 2.dp
            ),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Box(modifier = Modifier.padding(MaterialTheme.spacing.large)) {
                content()
            }
        }
    }
}

@Composable
fun PreferencesContent(
    preferences: UserPreferences,
    onUpdatePreferences: (UserPreferences) -> Unit
) {
    var currentPreferences by remember { mutableStateOf(preferences) }
    
    LaunchedEffect(preferences) {
        currentPreferences = preferences
    }

    Column(
        verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.large)
    ) {

        // Translation Settings
        PreferenceSection(
            title = stringResource(R.string.translation_settings),
            icon = Icons.Default.Person
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.medium)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.auto_translate_content),
                        modifier = Modifier.weight(1f).semantics { contentDescription = "Auto Translate Content" }
                    )
                    Spacer(modifier = Modifier.width(MaterialTheme.spacing.small))
                    Switch(
                        checked = currentPreferences.translationSettings.autoTranslate,
                        onCheckedChange = { enabled ->
                            currentPreferences = currentPreferences.copy(
                                translationSettings = currentPreferences.translationSettings.copy(
                                    autoTranslate = enabled
                                )
                            )
                            onUpdatePreferences(currentPreferences)
                        },
                        modifier = Modifier.semantics { contentDescription = "Auto Translate Toggle" }
                    )
                }
                
                Column(
                    verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.small)
                ) {
                    Text(
                        text = stringResource(R.string.choose_your_language),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(bottom = MaterialTheme.spacing.small).semantics { contentDescription = "Choose Your Language" }
                    )
                    
                    val targetLanguageOptions = listOf(
                        "en" to "English",
                        "zh-CN" to "中文（简体）",
                        "zh-TW" to "中文（繁體）",
                        "ja" to "日本語"
                    )
                    
                    Column(
                        modifier = Modifier.selectableGroup(),
                        verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.small)
                    ) {
                        targetLanguageOptions.forEach { (code, name) ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = MaterialTheme.spacing.extraSmall)
                                    .selectable(
                                        selected = currentPreferences.translationSettings.defaultTargetLanguage == code,
                                        onClick = {
                                            currentPreferences = currentPreferences.copy(
                                                preferredLanguages = listOf(code),
                                                translationSettings = currentPreferences.translationSettings.copy(
                                                    defaultTargetLanguage = code
                                                )
                                            )
                                            onUpdatePreferences(currentPreferences)
                                        }
                                    )
                                    .semantics { contentDescription = "Language Option $name" },
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = currentPreferences.translationSettings.defaultTargetLanguage == code,
                                    onClick = null,
                                    modifier = Modifier.semantics { contentDescription = "Select $name" }
                                )
                                Spacer(modifier = Modifier.width(MaterialTheme.spacing.small))
                                Text(
                                    text = name,
                                    modifier = Modifier.semantics { contentDescription = "$name Language" }
                                )
                            }
                        }
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
            Column(
                modifier = Modifier.selectableGroup(),
                verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.small)
            ) {
                themeOptions.forEach { (code, name) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = MaterialTheme.spacing.extraSmall)
                            .selectable(
                                selected = currentPreferences.themePreference == code,
                                onClick = {
                                    currentPreferences = currentPreferences.copy(
                                        themePreference = code
                                    )
                                    onUpdatePreferences(currentPreferences)
                                }
                            )
                            .semantics { contentDescription = "Theme Option $name" },
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = currentPreferences.themePreference == code,
                            onClick = null,
                            modifier = Modifier.semantics { contentDescription = "Select $name Theme" }
                        )
                        Spacer(modifier = Modifier.width(MaterialTheme.spacing.small))
                        Text(
                            text = name,
                            modifier = Modifier.semantics { contentDescription = "$name Theme Option" }
                        )
                    }
                }
            }
        }

        // Notification Settings
        PreferenceSection(
            title = stringResource(R.string.notifications),
            icon = Icons.Default.Person
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.medium)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.email_notifications),
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(MaterialTheme.spacing.small))
                    Switch(
                        checked = currentPreferences.notificationSettings.emailNotifications,
                        onCheckedChange = { enabled ->
                            currentPreferences = currentPreferences.copy(
                                notificationSettings = currentPreferences.notificationSettings.copy(
                                    emailNotifications = enabled
                                )
                            )
                            onUpdatePreferences(currentPreferences)
                        }
                    )
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.push_notifications),
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(MaterialTheme.spacing.small))
                    Switch(
                        checked = currentPreferences.notificationSettings.pushNotifications,
                        onCheckedChange = { enabled ->
                            currentPreferences = currentPreferences.copy(
                                notificationSettings = currentPreferences.notificationSettings.copy(
                                    pushNotifications = enabled
                                )
                            )
                            onUpdatePreferences(currentPreferences)
                        }
                    )
                }
            }
        }

        // Privacy Settings
        PreferenceSection(
            title = stringResource(R.string.privacy),
            icon = Icons.Default.Person
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.medium)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.analytics),
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(MaterialTheme.spacing.small))
                    Switch(
                        checked = currentPreferences.privacySettings.analytics,
                        onCheckedChange = { enabled ->
                            currentPreferences = currentPreferences.copy(
                                privacySettings = currentPreferences.privacySettings.copy(
                                    analytics = enabled
                                )
                            )
                            onUpdatePreferences(currentPreferences)
                        }
                    )
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.personalization),
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(MaterialTheme.spacing.small))
                    Switch(
                        checked = currentPreferences.privacySettings.personalization,
                        onCheckedChange = { enabled ->
                            currentPreferences = currentPreferences.copy(
                                privacySettings = currentPreferences.privacySettings.copy(
                                    personalization = enabled
                                )
                            )
                            onUpdatePreferences(currentPreferences)
                        }
                    )
                }
            }
        }
    }
}