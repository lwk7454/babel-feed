package com.babelfeed.app.ui.screens.verify

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.babelfeed.app.R
import com.babelfeed.app.auth.AuthenticationManager
import com.babelfeed.app.utils.LocaleManager
import com.babelfeed.app.utils.PreferencesManager
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
    private val authManager: AuthenticationManager,
    private val localeManager: LocaleManager
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(VerificationUiState.EmailSent)
    val uiState: StateFlow<VerificationUiState> = _uiState.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    private val _resendCooldown = MutableStateFlow(getCooldownDuration()) // Start with cooldown
    val resendCooldown: StateFlow<Int> = _resendCooldown.asStateFlow()

    private val _shouldRecreateActivity = MutableStateFlow(false)
    val shouldRecreateActivity: StateFlow<Boolean> = _shouldRecreateActivity.asStateFlow()

    private var cooldownJob: Job? = null
    private val preferencesManager by lazy { PreferencesManager(localeManager) }

    init {
        // Start initial cooldown since email was already sent
        startResendCooldown(getCooldownDuration())
    }

    fun sendVerificationEmail(email: String) {
        viewModelScope.launch {
            _uiState.value = VerificationUiState.SendingEmail
            _isLoading.value = true
            _error.value = null
            
            try {
                authManager.resendVerificationCode(email)
                    .onSuccess {
                        _uiState.value = VerificationUiState.EmailSent
                        startResendCooldown(getCooldownDuration()) // 60 second cooldown
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
                    .onSuccess { verificationResult ->
                        _uiState.value = VerificationUiState.Success
                        _successMessage.value = getApplication<Application>().getString(
                            R.string.success_email_verified
                        )
                        
                        // If this was an existing user, sync their preferences
                        verificationResult.preferences?.let { serverPreferences ->
                            // Apply server preferences to override local settings
                            preferencesManager.applyPreferences(getApplication(), serverPreferences)
                            
                            // Check if language changed and needs activity recreation
                            val serverLanguage = serverPreferences.translationSettings.defaultTargetLanguage
                            val currentLanguage = localeManager.getCurrentLocale(getApplication())
                            if (serverLanguage != currentLanguage) {
                                localeManager.saveLocale(getApplication(), serverLanguage)
                                _shouldRecreateActivity.value = true
                            }
                        }
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
                        startResendCooldown(getCooldownDuration()) // 60 second cooldown
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
                delay(if (isTestEnvironment()) 100 else 1000) // Faster in tests
                _resendCooldown.value = _resendCooldown.value - 1
            }
        }
    }
    
    private fun isTestEnvironment(): Boolean {
        return try {
            Class.forName("androidx.test.espresso.Espresso")
            true
        } catch (e: ClassNotFoundException) {
            false
        }
    }
    
    private fun getCooldownDuration(): Int {
        return if (isTestEnvironment()) 3 else 60 // 3 seconds in tests, 60 in production
    }

    fun clearError() {
        _error.value = null
    }

    fun clearSuccessMessage() {
        _successMessage.value = null
    }

    fun onActivityRecreated() {
        _shouldRecreateActivity.value = false
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