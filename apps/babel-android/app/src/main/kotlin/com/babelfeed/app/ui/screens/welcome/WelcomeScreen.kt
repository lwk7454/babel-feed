package com.babelfeed.app.ui.screens.welcome

import android.app.Activity
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.babelfeed.app.R
import com.babelfeed.app.utils.LocaleManager

@Composable
fun WelcomeScreen(
    onLanguageSelected: (String) -> Unit,
    viewModel: WelcomeViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val shouldRecreateActivity by viewModel.shouldRecreateActivity.collectAsStateWithLifecycle()
    var selectedLanguage by remember { mutableStateOf(viewModel.localeManager.getCurrentLocale(context)) }
    
    // Handle activity recreation when language changes
    LaunchedEffect(shouldRecreateActivity) {
        if (shouldRecreateActivity) {
            (context as? Activity)?.recreate()
            viewModel.onActivityRecreated()
        }
    }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Spacer(modifier = Modifier.height(32.dp))
        
        // App Logo/Icon (you can replace with actual logo)
        Icon(
            imageVector = Icons.Default.Settings,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        
        // Welcome Title
        Text(
            text = stringResource(R.string.welcome_to_babel_feed),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.semantics { contentDescription = "Welcome" }
        )
        
        // Subtitle
        Text(
            text = stringResource(R.string.choose_your_language),
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Language Selection Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .selectableGroup(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = stringResource(R.string.select_language),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(bottom = 8.dp).semantics { contentDescription = "Select Language" }
                )
                
                LocaleManager.SUPPORTED_LANGUAGES.forEach { (code, name) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = selectedLanguage == code,
                                onClick = { 
                                    selectedLanguage = code
                                    // Immediately apply language change for UI reflection
                                    viewModel.previewLanguageChange(context, code)
                                }
                            )
                            .padding(vertical = 4.dp)
                            .semantics { contentDescription = "Language Option $name" },
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selectedLanguage == code,
                            onClick = { 
                                selectedLanguage = code
                                // Immediately apply language change for UI reflection
                                viewModel.previewLanguageChange(context, code)
                            },
                            modifier = Modifier.semantics { contentDescription = "Select $name" }
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = name,
                                style = MaterialTheme.typography.bodyLarge
                            )
                            Text(
                                text = code.uppercase(),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
        
        Spacer(modifier = Modifier.weight(1f))
        
        // Continue Button
        Button(
            onClick = { 
                viewModel.saveLanguagePreference(context, selectedLanguage)
                onLanguageSelected(selectedLanguage)
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .semantics { contentDescription = "Continue" }
        ) {
            Icon(
                imageVector = Icons.Default.ArrowForward,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = stringResource(R.string.continue_button),
                style = MaterialTheme.typography.titleMedium
            )
        }
    }
}