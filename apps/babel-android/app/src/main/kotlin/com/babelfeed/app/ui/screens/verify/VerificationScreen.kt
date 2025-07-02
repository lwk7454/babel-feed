package com.babelfeed.app.ui.screens.verify

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.babelfeed.app.R
import com.babelfeed.app.ui.theme.spacing
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VerificationScreen(
    email: String,
    onBackClick: () -> Unit,
    onVerificationSuccess: () -> Unit,
    viewModel: VerificationViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val successMessage by viewModel.successMessage.collectAsStateWithLifecycle()
    val resendCooldown by viewModel.resendCooldown.collectAsStateWithLifecycle()
    
    var otpInput by remember { mutableStateOf("") }

    
    LaunchedEffect(uiState) {
        if (uiState == VerificationUiState.Success) {
            delay(2000) // Show success for 2 seconds
            onVerificationSuccess()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(MaterialTheme.spacing.medium),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.medium)
    ) {
        // Navigation Bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onBackClick,
                modifier = Modifier.semantics { contentDescription = "Back" }
            ) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = stringResource(R.string.back)
                )
            }
            
            Text(
                text = stringResource(R.string.verification),
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f).semantics { contentDescription = "Verification Screen" }
            )
            
            Spacer(modifier = Modifier.size(48.dp))
        }

        when (uiState) {
            VerificationUiState.SendingEmail -> {
                CircularProgressIndicator(
                    modifier = Modifier.semantics { contentDescription = "Sending Email" }
                )
                Text(
                    text = stringResource(R.string.sending_verification_email),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.semantics { contentDescription = "Sending Verification Email" }
                )
            }
            
            VerificationUiState.EmailSent -> {
                Text(
                    text = stringResource(R.string.email_sent_to, email),
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.semantics { contentDescription = "Email Sent Message" }
                )
                
                // OTP Input Field
                OutlinedTextField(
                    value = otpInput,
                    onValueChange = { input ->
                        if (input.length <= 4 && input.all { it.isDigit() }) {
                            otpInput = input
                        }
                    },
                    label = { Text(stringResource(R.string.otp_4_digit_code)) },
                    placeholder = { Text("OTP") },
                    modifier = Modifier.fillMaxWidth().semantics { 
                        contentDescription = "OTP"
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true
                )
                
                // Submit Button
                Button(
                    onClick = {
                        if (otpInput.length == 4) {
                            viewModel.verifyOtp(otpInput)
                        }
                    },
                    enabled = otpInput.length == 4 && !isLoading,
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Submit" }
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(stringResource(R.string.submit))
                    }
                }
                
                // Resend Button
                Button(
                    onClick = { viewModel.resendVerificationCode(email) },
                    enabled = resendCooldown == 0 && !isLoading,
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Resend Code" },
                    colors = ButtonDefaults.outlinedButtonColors()
                ) {
                    if (resendCooldown > 0) {
                        Text(stringResource(R.string.resend_in_seconds, resendCooldown))
                    } else {
                        Text(stringResource(R.string.resend_code))
                    }
                }
            }
            
            VerificationUiState.Verifying -> {
                CircularProgressIndicator(
                    modifier = Modifier.semantics { contentDescription = "Verifying" }
                )
                Text(
                    text = stringResource(R.string.verifying_code),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.semantics { contentDescription = "Verifying Code" }
                )
            }
            
            VerificationUiState.Success -> {
                // Success State - Hide all UI, show success icon
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.large)
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = stringResource(R.string.success),
                        modifier = Modifier.size(120.dp).semantics { contentDescription = "Success Icon" },
                        tint = MaterialTheme.colorScheme.primary
                    )
                    
                    Text(
                        text = stringResource(R.string.verification_successful),
                        style = MaterialTheme.typography.headlineMedium,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.semantics { contentDescription = "Verification Successful" }
                    )
                    
                    Text(
                        text = stringResource(R.string.returning_to_profile),
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.semantics { contentDescription = "Returning to Profile" }
                    )
                }
            }
        }
        
        // Error Banner
        error?.let { errorMessage ->
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(MaterialTheme.spacing.medium),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = errorMessage,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.weight(1f).semantics { contentDescription = "Error Message" }
                    )
                    TextButton(
                        onClick = { viewModel.clearError() },
                        modifier = Modifier.semantics { contentDescription = "Dismiss Error" }
                    ) {
                        Text(stringResource(R.string.dismiss))
                    }
                }
            }
        }
        
        // Success Message Banner
        successMessage?.let { message ->
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(MaterialTheme.spacing.medium),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = message,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.weight(1f).semantics { contentDescription = "Success Message" }
                    )
                    TextButton(
                        onClick = { viewModel.clearSuccessMessage() },
                        modifier = Modifier.semantics { contentDescription = "Dismiss Success" }
                    ) {
                        Text(stringResource(R.string.dismiss))
                    }
                }
            }
        }
    }
}