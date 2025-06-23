package com.babelfeed.app.ui.screens.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.babelfeed.app.R
import com.babelfeed.app.auth.AuthState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel = hiltViewModel()
) {
    val authState by viewModel.authState.collectAsStateWithLifecycle()
    val currentUser by viewModel.currentUser.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    
    var emailInput by remember { mutableStateOf("") }
    var verificationTokenInput by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        viewModel.initializeProfile()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = stringResource(R.string.profile),
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center
        )

        // Error display
        error?.let { errorMessage ->
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
            ) {
                Text(
                    text = errorMessage,
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }

        // Loading indicator
        if (isLoading) {
            CircularProgressIndicator()
        }

        // Authentication state display
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
                    }
                )
            }
            
            AuthState.Authenticated -> {
                AuthenticatedUserCard(
                    user = currentUser,
                    onLogout = { viewModel.logout() }
                )
            }
        }
    }
}

@Composable
private fun NoAuthCard(
    onCreateGuest: () -> Unit
) {
    Card {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
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
    Card {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(R.string.guest_user),
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = stringResource(R.string.guest_id, guestId ?: stringResource(R.string.unknown)),
                style = MaterialTheme.typography.bodySmall
            )
            
            Text(stringResource(R.string.add_email_description))
            
            OutlinedTextField(
                value = emailInput,
                onValueChange = onEmailChange,
                label = { Text(stringResource(R.string.email_address)) },
                modifier = Modifier.fillMaxWidth()
            )
            
            Button(
                onClick = onCreateAccount,
                modifier = Modifier.fillMaxWidth(),
                enabled = emailInput.isNotBlank()
            ) {
                Text(stringResource(R.string.create_account))
            }
        }
    }
}

@Composable
private fun PendingVerificationCard(
    email: String,
    verificationTokenInput: String,
    onTokenChange: (String) -> Unit,
    onVerifyEmail: () -> Unit
) {
    Card {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(R.string.email_verification),
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = stringResource(R.string.email_verification_instruction, email)
            )
            
            OutlinedTextField(
                value = verificationTokenInput,
                onValueChange = onTokenChange,
                label = { Text(stringResource(R.string.verification_code)) },
                modifier = Modifier.fillMaxWidth()
            )
            
            Button(
                onClick = onVerifyEmail,
                modifier = Modifier.fillMaxWidth(),
                enabled = verificationTokenInput.isNotBlank()
            ) {
                Text(stringResource(R.string.verify_email))
            }
        }
    }
}

@Composable
private fun AuthenticatedUserCard(
    user: com.babelfeed.app.data.models.User?,
    onLogout: () -> Unit
) {
    Card {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
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
            
            Spacer(modifier = Modifier.height(8.dp))
            
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