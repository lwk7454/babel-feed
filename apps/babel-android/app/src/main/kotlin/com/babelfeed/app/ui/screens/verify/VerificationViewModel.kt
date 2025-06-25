package com.babelfeed.app.ui.screens.verify

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.babelfeed.app.R
import com.babelfeed.app.auth.AuthenticationManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class VerificationUiState {
    SendingEmail,
    EmailSent,
    Verifying,
    Success
}

@HiltViewModel
class VerificationViewModel @Inject constructor(
    application: Application,
    private val authManager: AuthenticationManager
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(VerificationUiState.SendingEmail)
    val uiState: StateFlow<VerificationUiState> = _uiState.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    private val _resendCooldown = MutableStateFlow(0)
    val resendCooldown: StateFlow<Int> = _resendCooldown.asStateFlow()

    private var cooldownJob: Job? = null

    fun sendVerificationEmail(email: String) {
        viewModelScope.launch {
            _uiState.value = VerificationUiState.SendingEmail
            _isLoading.value = true
            _error.value = null
            
            try {
                authManager.resendVerificationCode(email)
                    .onSuccess {
                        _uiState.value = VerificationUiState.EmailSent
                        startResendCooldown(60) // 60 second cooldown
                    }
                    .onFailure { exception ->
                        _error.value = getUserFriendlyErrorMessage(exception)
                        _uiState.value = VerificationUiState.EmailSent // Still allow user to try
                    }
            } catch (e: Exception) {
                _error.value = getUserFriendlyErrorMessage(e)
                _uiState.value = VerificationUiState.EmailSent
            }
            
            _isLoading.value = false
        }
    }

    fun verifyOtp(otp: String) {
        viewModelScope.launch {
            _uiState.value = VerificationUiState.Verifying
            _isLoading.value = true
            _error.value = null
            
            try {
                authManager.verifyEmail(otp)
                    .onSuccess { user ->
                        _uiState.value = VerificationUiState.Success
                        _successMessage.value = getApplication<Application>().getString(
                            R.string.success_email_verified
                        )
                    }
                    .onFailure { exception ->
                        _error.value = getUserFriendlyErrorMessage(exception)
                        _uiState.value = VerificationUiState.EmailSent
                    }
            } catch (e: Exception) {
                _error.value = getUserFriendlyErrorMessage(e)
                _uiState.value = VerificationUiState.EmailSent
            }
            
            _isLoading.value = false
        }
    }

    fun resendVerificationCode(email: String) {
        if (_resendCooldown.value > 0) return
        
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            _successMessage.value = null
            
            try {
                authManager.resendVerificationCode(email)
                    .onSuccess {
                        _successMessage.value = getApplication<Application>().getString(
                            R.string.success_verification_code_sent
                        )
                        startResendCooldown(60) // 60 second cooldown
                    }
                    .onFailure { exception ->
                        _error.value = getUserFriendlyErrorMessage(exception)
                    }
            } catch (e: Exception) {
                _error.value = getUserFriendlyErrorMessage(e)
            }
            
            _isLoading.value = false
        }
    }

    private fun startResendCooldown(seconds: Int) {
        cooldownJob?.cancel()
        cooldownJob = viewModelScope.launch {
            _resendCooldown.value = seconds
            repeat(seconds) {
                delay(1000)
                _resendCooldown.value = _resendCooldown.value - 1
            }
        }
    }

    fun clearError() {
        _error.value = null
    }

    fun clearSuccessMessage() {
        _successMessage.value = null
    }

    private fun getUserFriendlyErrorMessage(exception: Throwable): String {
        val message = exception.message?.lowercase() ?: ""
        
        return when {
            message.contains("network") || message.contains("connection") || message.contains("timeout") -> {
                getApplication<Application>().getString(R.string.error_network_connection)
            }
            message.contains("server error") || message.contains("500") || message.contains("503") -> {
                getApplication<Application>().getString(R.string.error_server_unavailable)
            }
            message.contains("invalid verification") || message.contains("verification code") -> {
                getApplication<Application>().getString(R.string.error_invalid_verification_code)
            }
            message.contains("expired") || message.contains("token expired") -> {
                getApplication<Application>().getString(R.string.error_verification_code_expired)
            }
            message.contains("email already exists") || message.contains("user already exists") || 
            message.contains("email address is already registered") || message.contains("already registered") -> {
                getApplication<Application>().getString(R.string.error_email_already_exists)
            }
            message.contains("already verified") -> {
                getApplication<Application>().getString(R.string.error_email_already_verified)
            }
            else -> {
                getApplication<Application>().getString(R.string.error_unknown)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        cooldownJob?.cancel()
    }
}