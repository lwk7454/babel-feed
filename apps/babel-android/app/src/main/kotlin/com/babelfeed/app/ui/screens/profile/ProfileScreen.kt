package com.babelfeed.app.ui.screens.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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
            text = "Profile",
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
                text = "Welcome to Babel Feed",
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "Create a guest profile to start using the app",
                textAlign = TextAlign.Center
            )
            Button(onClick = onCreateGuest) {
                Text("Start as Guest")
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
                text = "Guest User",
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "Guest ID: ${guestId ?: "Unknown"}",
                style = MaterialTheme.typography.bodySmall
            )
            
            Text("Add your email to save your preferences across devices:")
            
            OutlinedTextField(
                value = emailInput,
                onValueChange = onEmailChange,
                label = { Text("Email Address") },
                modifier = Modifier.fillMaxWidth()
            )
            
            Button(
                onClick = onCreateAccount,
                modifier = Modifier.fillMaxWidth(),
                enabled = emailInput.isNotBlank()
            ) {
                Text("Create Account")
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
                text = "Email Verification",
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "Please check your email ($email) for a verification token."
            )
            
            OutlinedTextField(
                value = verificationTokenInput,
                onValueChange = onTokenChange,
                label = { Text("Verification Token") },
                modifier = Modifier.fillMaxWidth()
            )
            
            Button(
                onClick = onVerifyEmail,
                modifier = Modifier.fillMaxWidth(),
                enabled = verificationTokenInput.isNotBlank()
            ) {
                Text("Verify Email")
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
                text = "Authenticated User",
                style = MaterialTheme.typography.titleMedium
            )
            
            user?.let { u ->
                Text("Email: ${u.email}")
                Text("User ID: ${u.id}")
                Text("Email Verified: ${if (u.emailVerified) "Yes" else "No"}")
                Text("Member since: ${u.createdAt}")
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Button(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Logout")
            }
        }
    }
}