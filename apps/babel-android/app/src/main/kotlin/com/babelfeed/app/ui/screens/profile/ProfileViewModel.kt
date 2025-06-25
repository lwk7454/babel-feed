package com.babelfeed.app.ui.screens.profile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.babelfeed.app.R
import com.babelfeed.app.auth.AuthState
import com.babelfeed.app.auth.AuthenticationManager
import com.babelfeed.app.data.models.User
import com.babelfeed.app.data.models.UserPreferences
import com.babelfeed.app.data.repository.UserRepository
import com.babelfeed.app.utils.LocaleManager
import com.babelfeed.app.utils.PreferencesManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.regex.Pattern
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    application: Application,
    private val authManager: AuthenticationManager,
    private val userRepository: UserRepository,
    val localeManager: LocaleManager
) : AndroidViewModel(application) {

    val authState: StateFlow<AuthState> = authManager.authState
    val currentUser: StateFlow<User?> = authManager.currentUser

    private val _userPreferences = MutableStateFlow<UserPreferences?>(null)
    val userPreferences: StateFlow<UserPreferences?> = _userPreferences.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    private val _shouldRecreateActivity = MutableStateFlow(false)
    val shouldRecreateActivity: StateFlow<Boolean> = _shouldRecreateActivity.asStateFlow()

    private val preferencesManager by lazy { PreferencesManager(localeManager) }

    fun initializeProfile() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            when {
                authManager.needsGuestProfile() -> {
                    createGuestUser()
                }
                authManager.isAuthenticated() -> {
                    // For authenticated users, get profile and preferences from server
                    getCurrentUser()
                    loadServerPreferences()
                }
                else -> {
                    // For guest users, still try to load preferences (may not be available, that's ok)
                    loadUserPreferencesAsync()
                }
            }
            
            _isLoading.value = false
        }
    }

    private suspend fun loadServerPreferences() {
        try {
            userRepository.getUserPreferences()
                .onSuccess { serverPreferences ->
                    val preferences = serverPreferences ?: createDefaultPreferences()
                    // Server preferences override local preferences for authenticated users
                    _userPreferences.value = preferences
                    
                    // Apply server language preference to app locale
                    val serverLanguage = preferences.translationSettings.defaultTargetLanguage
                    val currentLanguage = localeManager.getCurrentLocale(getApplication())
                    if (serverLanguage != currentLanguage) {
                        localeManager.saveLocale(getApplication(), serverLanguage)
                        _shouldRecreateActivity.value = true
                    }
                }
                .onFailure { exception ->
                    // If server preferences fail, use default but don't show as error
                    _userPreferences.value = createDefaultPreferences()
                }
        } catch (e: Exception) {
            // Fallback to default preferences
            _userPreferences.value = createDefaultPreferences()
        }
    }

    private suspend fun loadUserPreferencesAsync() {
        userRepository.getUserPreferences()
            .onSuccess { preferences ->
                _userPreferences.value = preferences
            }
            .onFailure { exception ->
                // Don't show preferences loading errors as main errors since preferences are optional
                // Just use default preferences instead
                _userPreferences.value = createDefaultPreferences()
            }
    }

    private fun createDefaultPreferences(): UserPreferences {
        // Use current locale instead of hardcoded default
        val currentLanguage = localeManager.getCurrentLocale(getApplication())
        return UserPreferences(
            userId = "",
            preferredLanguages = listOf(currentLanguage),
            feedCategories = emptyList(),
            translationSettings = com.babelfeed.app.data.models.TranslationSettings(
                autoTranslate = true,
                defaultTargetLanguage = currentLanguage
            ),
            themePreference = "system",
            notificationSettings = com.babelfeed.app.data.models.NotificationSettings(),
            privacySettings = com.babelfeed.app.data.models.PrivacySettings(),
            updatedAt = ""
        )
    }

    fun createGuestUser() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            authManager.createGuestUser()
                .onSuccess {
                    // Guest user created successfully, now load default preferences
                    _userPreferences.value = createDefaultPreferences()
                }
                .onFailure { exception ->
                    _error.value = getUserFriendlyErrorMessage(exception)
                }
            
            _isLoading.value = false
        }
    }

    fun createAccount(email: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            _successMessage.value = null
            
            // Validate email format
            if (!isValidEmail(email)) {
                _error.value = getApplication<Application>().getString(R.string.error_invalid_email)
                _isLoading.value = false
                return@launch
            }
            
            authManager.createAccountFromGuest(email)
                .onSuccess {
                    // Account creation initiated, waiting for verification
                    _successMessage.value = getApplication<Application>().getString(R.string.success_account_created)
                }
                .onFailure { exception ->
                    _error.value = getUserFriendlyErrorMessage(exception)
                }
            
            _isLoading.value = false
        }
    }

    fun verifyEmail(verificationToken: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            _successMessage.value = null
            
            // Validate verification code format (4 digits)
            if (!isValidVerificationCode(verificationToken)) {
                _error.value = getApplication<Application>().getString(R.string.error_invalid_verification_code)
                _isLoading.value = false
                return@launch
            }
            
            authManager.verifyEmail(verificationToken)
                .onSuccess { user ->
                    // Email verified successfully, reload preferences for the authenticated user
                    _successMessage.value = getApplication<Application>().getString(R.string.success_email_verified)
                    loadUserPreferencesAsync()
                }
                .onFailure { exception ->
                    _error.value = getUserFriendlyErrorMessage(exception)
                }
            
            _isLoading.value = false
        }
    }

    fun logout() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            authManager.logout()
            
            // Clear user preferences and reset to defaults
            _userPreferences.value = createDefaultPreferences()
            
            _isLoading.value = false
        }
    }

    fun getCurrentUser() {
        viewModelScope.launch {
            if (authManager.isAuthenticated()) {
                authManager.getCurrentUser()
                    .onFailure { exception ->
                        // Only show error if it's not a 401 (which might be normal for guest users)
                        if (exception.message?.contains("401") != true) {
                            _error.value = getUserFriendlyErrorMessage(exception)
                        }
                    }
            }
        }
    }

    fun getGuestId(): String? {
        return authManager.getGuestId()
    }

    fun getUserPreferences() {
        viewModelScope.launch {
            loadUserPreferencesAsync()
        }
    }

    fun resendVerificationCode(email: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            _successMessage.value = null
            
            try {
                // Call backend to resend verification code
                authManager.resendVerificationCode(email)
                    .onSuccess {
                        // Show success message
                        _successMessage.value = getApplication<Application>().getString(R.string.success_verification_code_sent)
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

    fun updatePreferences(preferences: UserPreferences) {
        viewModelScope.launch {
            val oldPreferences = _userPreferences.value
            val languageChanged = oldPreferences?.translationSettings?.defaultTargetLanguage != 
                                preferences.translationSettings.defaultTargetLanguage
            
            // Update local state immediately for responsive UI
            _userPreferences.value = preferences
            
            // If language changed, save to locale manager and trigger activity recreation
            if (languageChanged) {
                val newLanguage = preferences.translationSettings.defaultTargetLanguage
                localeManager.saveLocale(getApplication(), newLanguage)
                _shouldRecreateActivity.value = true
            }
            
            // Save preferences to appropriate storage based on user status
            val currentUser = authManager.currentUser.value
            val isVerifiedUser = currentUser?.userStatus == "verified" || currentUser?.userStatus == "vip"
            
            if (authManager.isAuthenticated() && isVerifiedUser) {
                // For verified users, use save-settings endpoint which syncs to server
                userRepository.saveUserSettings(preferences)
                    .onSuccess { updatedPreferences ->
                        _userPreferences.value = updatedPreferences
                        // Also apply to local preferences manager
                        preferencesManager.applyPreferences(getApplication(), updatedPreferences)
                    }
                    .onFailure { exception ->
                        // If save fails for verified users, show warning but keep local changes
                        _error.value = getApplication<Application>().getString(R.string.error_server_unavailable)
                        // Still apply locally even if server sync fails
                        preferencesManager.applyPreferences(getApplication(), preferences)
                    }
            } else if (authManager.isAuthenticated()) {
                // For authenticated but not verified users, use regular update (local + basic server)
                userRepository.updateUserPreferences(preferences)
                    .onSuccess { updatedPreferences ->
                        _userPreferences.value = updatedPreferences
                        preferencesManager.applyPreferences(getApplication(), updatedPreferences)
                    }
                    .onFailure { exception ->
                        _error.value = getApplication<Application>().getString(R.string.error_server_unavailable)
                        preferencesManager.applyPreferences(getApplication(), preferences)
                    }
            } else {
                // For guest users, preferences are only stored locally
                preferencesManager.applyPreferences(getApplication(), preferences)
            }
        }
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

    // Private helper methods for error handling and validation
    
    private fun getUserFriendlyErrorMessage(exception: Throwable): String {
        val message = exception.message?.lowercase() ?: ""
        
        return when {
            message.contains("network") || message.contains("connection") || message.contains("timeout") -> {
                getApplication<Application>().getString(R.string.error_network_connection)
            }
            message.contains("server error") || message.contains("500") || message.contains("503") -> {
                getApplication<Application>().getString(R.string.error_server_unavailable)
            }
            message.contains("invalid email") || message.contains("email format") -> {
                getApplication<Application>().getString(R.string.error_invalid_email)
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
            message.contains("guest session") || message.contains("session expired") -> {
                getApplication<Application>().getString(R.string.error_guest_session_expired)
            }
            else -> {
                // For unknown errors, show a generic message
                getApplication<Application>().getString(R.string.error_unknown)
            }
        }
    }
    
    fun isValidEmail(email: String): Boolean {
        val emailPattern = Pattern.compile(
            "[a-zA-Z0-9+._%-+]{1,256}" +
            "@" +
            "[a-zA-Z0-9][a-zA-Z0-9-]{0,64}" +
            "(" +
            "." +
            "[a-zA-Z0-9][a-zA-Z0-9-]{0,25}" +
            ")+"
        )
        return emailPattern.matcher(email).matches()
    }
    
    private fun isValidVerificationCode(code: String): Boolean {
        // Verification code should be 4 digits
        return code.length == 4 && code.all { it.isDigit() }
    }
}