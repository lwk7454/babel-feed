package com.babelfeed.app.ui.screens.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import android.app.Activity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.babelfeed.app.R
import com.babelfeed.app.auth.AuthState
import com.babelfeed.app.data.models.UserPreferences
import com.babelfeed.app.ui.theme.spacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onBackClick: (() -> Unit)? = null,
    viewModel: ProfileViewModel = hiltViewModel()
) {

    val authState by viewModel.authState.collectAsStateWithLifecycle()
    val currentUser by viewModel.currentUser.collectAsStateWithLifecycle()
    val userPreferences by viewModel.userPreferences.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val successMessage by viewModel.successMessage.collectAsStateWithLifecycle()
    val shouldRecreateActivity by viewModel.shouldRecreateActivity.collectAsStateWithLifecycle()
    
    val context = LocalContext.current
    
    var emailInput by remember { mutableStateOf("") }
    var verificationTokenInput by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        viewModel.initializeProfile()
    }

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
            .padding(MaterialTheme.spacing.medium)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.medium)
    ) {
        // Header with title and back button
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            onBackClick?.let {
                IconButton(onClick = it) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = stringResource(R.string.back)
                    )
                }
            } ?: Spacer(modifier = Modifier.size(48.dp))
            
            Text(
                text = stringResource(R.string.profile),
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f)
            )
            
            // Placeholder for symmetry
            Spacer(modifier = Modifier.size(48.dp))
        }

        // Success message display
        successMessage?.let { message ->
            if (!isLoading) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = message,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(
                            onClick = { viewModel.clearSuccessMessage() }
                        ) {
                            Text(stringResource(R.string.dismiss))
                        }
                    }
                }
            }
        }

        // Error display - only show non-loading errors
        error?.let { errorMessage ->
            if (!isLoading) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = errorMessage,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(
                            onClick = { viewModel.clearError() }
                        ) {
                            Text(stringResource(R.string.dismiss))
                        }
                    }
                }
            }
        }

        // Loading indicator
        if (isLoading) {
            CircularProgressIndicator()
        }

        // Authentication state display with integrated preferences
        when (authState) {
            AuthState.None -> {
                NoAuthCard(
                    onCreateGuest = { viewModel.createGuestUser() }
                )
            }
            
            AuthState.Guest -> {
                GuestUserCard(
                    guestId = viewModel.getGuestId(),
                    emailInput = emailInput,
                    onEmailChange = { emailInput = it },
                    onCreateAccount = { 
                        if (emailInput.isNotBlank()) {
                            viewModel.createAccount(emailInput)
                        }
                    }
                )
                
                // Show preferences for guest users too
                Spacer(modifier = Modifier.height(8.dp))
                
                PreferencesSection(
                    preferences = userPreferences,
                    currentLocale = viewModel.localeManager.getCurrentLocale(context),
                    onUpdatePreferences = { preferences ->
                        viewModel.updatePreferences(preferences)
                    }
                )
            }
            
            AuthState.PendingVerification -> {
                PendingVerificationCard(
                    email = currentUser?.email ?: "Unknown",
                    verificationTokenInput = verificationTokenInput,
                    onTokenChange = { verificationTokenInput = it },
                    onVerifyEmail = {
                        if (verificationTokenInput.isNotBlank()) {
                            viewModel.verifyEmail(verificationTokenInput)
                        }
                    },
                    onResendCode = {
                        currentUser?.email?.let { email ->
                            viewModel.resendVerificationCode(email)
                        }
                    }
                )
                
                // Show preferences for pending verification users
                Spacer(modifier = Modifier.height(8.dp))
                
                PreferencesSection(
                    preferences = userPreferences,
                    currentLocale = viewModel.localeManager.getCurrentLocale(context),
                    onUpdatePreferences = { preferences ->
                        viewModel.updatePreferences(preferences)
                    }
                )
            }
            
            AuthState.Authenticated -> {
                AuthenticatedUserCard(
                    user = currentUser,
                    onLogout = { viewModel.logout() }
                )
                
                // Show preferences for authenticated users
                Spacer(modifier = Modifier.height(8.dp))
                
                PreferencesSection(
                    preferences = userPreferences,
                    currentLocale = viewModel.localeManager.getCurrentLocale(context),
                    onUpdatePreferences = { preferences ->
                        viewModel.updatePreferences(preferences)
                    }
                )
            }
        }
    }
}

@Composable
private fun NoAuthCard(
    onCreateGuest: () -> Unit
) {
    Card(
        elevation = CardDefaults.cardElevation(
            defaultElevation = 4.dp
        )
    ) {
        Column(
            modifier = Modifier.padding(MaterialTheme.spacing.medium),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.small)
        ) {
            Text(
                text = stringResource(R.string.welcome_to_babel_feed),
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = stringResource(R.string.create_guest_profile_description),
                textAlign = TextAlign.Center
            )
            Button(onClick = onCreateGuest) {
                Text(stringResource(R.string.start_as_guest))
            }
        }
    }
}

@Composable
private fun GuestUserCard(
    guestId: String?,
    emailInput: String,
    onEmailChange: (String) -> Unit,
    onCreateAccount: () -> Unit
) {
    Card(
        elevation = CardDefaults.cardElevation(
            defaultElevation = 4.dp
        )
    ) {
        Column(
            modifier = Modifier.padding(MaterialTheme.spacing.medium),
            verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.small)
        ) {
            Text(
                text = stringResource(R.string.guest_user),
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = stringResource(R.string.guest_id, guestId ?: stringResource(R.string.unknown)),
                style = MaterialTheme.typography.bodySmall
            )
            
            Text(stringResource(R.string.email_verification_for_sync))
            
            OutlinedTextField(
                value = emailInput,
                onValueChange = onEmailChange,
                label = { Text(stringResource(R.string.email_address)) },
                modifier = Modifier.fillMaxWidth()
            )
            
            Button(
                onClick = onCreateAccount,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(R.string.verify_email_address))
            }
        }
    }
}

@Composable
private fun PendingVerificationCard(
    email: String,
    verificationTokenInput: String,
    onTokenChange: (String) -> Unit,
    onVerifyEmail: () -> Unit,
    onResendCode: () -> Unit
) {
    Card(
        elevation = CardDefaults.cardElevation(
            defaultElevation = 4.dp
        )
    ) {
        Column(
            modifier = Modifier.padding(MaterialTheme.spacing.medium),
            verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.small)
        ) {
            Text(
                text = stringResource(R.string.pending_verification),
                style = MaterialTheme.typography.titleMedium
            )
            Text(stringResource(R.string.verification_email_sent, email))
            
            OutlinedTextField(
                value = verificationTokenInput,
                onValueChange = onTokenChange,
                label = { Text(stringResource(R.string.verification_code)) },
                modifier = Modifier.fillMaxWidth()
            )
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onVerifyEmail,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(stringResource(R.string.verify_email))
                }
                
                OutlinedButton(
                    onClick = onResendCode,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(stringResource(R.string.resend_code))
                }
            }
        }
    }
}

@Composable
private fun AuthenticatedUserCard(
    user: com.babelfeed.app.data.models.User?,
    onLogout: () -> Unit
) {
    Card(
        elevation = CardDefaults.cardElevation(
            defaultElevation = 4.dp
        )
    ) {
        Column(
            modifier = Modifier.padding(MaterialTheme.spacing.medium),
            verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.small)
        ) {
            Text(
                text = stringResource(R.string.authenticated_user),
                style = MaterialTheme.typography.titleMedium
            )
            
            user?.let { u ->
                Text(stringResource(R.string.user_email, u.email ?: stringResource(R.string.unknown)))
                Text(stringResource(R.string.user_id, u.id))
                Text(stringResource(R.string.email_verified, if (u.emailVerified) stringResource(R.string.yes) else stringResource(R.string.no)))
                Text(stringResource(R.string.member_since, u.createdAt))
            }
            
            Button(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text(stringResource(R.string.logout))
            }
        }
    }
}

@Composable
private fun PreferencesSection(
    preferences: UserPreferences?,
    currentLocale: String,
    onUpdatePreferences: (UserPreferences) -> Unit
) {
    Card {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = stringResource(R.string.preferences),
                style = MaterialTheme.typography.titleMedium
            )
            
            preferences?.let { prefs ->
                PreferencesContent(
                    preferences = prefs,
                    onUpdatePreferences = onUpdatePreferences
                )
            } ?: run {
                // Show default preferences if none are loaded yet
                val defaultPrefs = UserPreferences(
                    userId = "",
                    preferredLanguages = listOf(currentLocale),
                    feedCategories = emptyList(),
                    translationSettings = com.babelfeed.app.data.models.TranslationSettings(
                        autoTranslate = true,
                        defaultTargetLanguage = currentLocale
                    ),
                    themePreference = "system",
                    notificationSettings = com.babelfeed.app.data.models.NotificationSettings(),
                    privacySettings = com.babelfeed.app.data.models.PrivacySettings(),
                    updatedAt = ""
                )
                PreferencesContent(
                    preferences = defaultPrefs,
                    onUpdatePreferences = onUpdatePreferences
                )
            }
        }
    }
}