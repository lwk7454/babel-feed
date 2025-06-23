package com.babelfeed.app.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.babelfeed.app.auth.AuthState
import com.babelfeed.app.auth.AuthenticationManager
import com.babelfeed.app.data.models.User
import com.babelfeed.app.data.models.UserPreferences
import com.babelfeed.app.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val authManager: AuthenticationManager,
    private val userRepository: UserRepository
) : ViewModel() {

    val authState: StateFlow<AuthState> = authManager.authState
    val currentUser: StateFlow<User?> = authManager.currentUser

    private val _userPreferences = MutableStateFlow<UserPreferences?>(null)
    val userPreferences: StateFlow<UserPreferences?> = _userPreferences.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun initializeProfile() {
        viewModelScope.launch {
            if (authManager.needsGuestProfile()) {
                createGuestUser()
            } else if (authManager.isAuthenticated()) {
                // Try to get current user profile and preferences
                getCurrentUser()
                getUserPreferences()
            }
        }
    }

    fun createGuestUser() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            authManager.createGuestUser()
                .onSuccess {
                    // Guest user created successfully
                }
                .onFailure { exception ->
                    _error.value = "Failed to create guest user: ${exception.message}"
                }
            
            _isLoading.value = false
        }
    }

    fun createAccount(email: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            authManager.createAccountFromGuest(email)
                .onSuccess {
                    // Account creation initiated, waiting for verification
                }
                .onFailure { exception ->
                    _error.value = "Failed to create account: ${exception.message}"
                }
            
            _isLoading.value = false
        }
    }

    fun verifyEmail(verificationToken: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            authManager.verifyEmail(verificationToken)
                .onSuccess { user ->
                    // Email verified successfully
                }
                .onFailure { exception ->
                    _error.value = "Email verification failed: ${exception.message}"
                }
            
            _isLoading.value = false
        }
    }

    fun logout() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            authManager.logout()
            
            _isLoading.value = false
        }
    }

    fun getCurrentUser() {
        viewModelScope.launch {
            authManager.getCurrentUser()
                .onFailure { exception ->
                    _error.value = "Failed to load user profile: ${exception.message}"
                }
        }
    }

    fun getGuestId(): String? {
        return authManager.getGuestId()
    }

    fun getUserPreferences() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            userRepository.getUserPreferences()
                .onSuccess { preferences ->
                    _userPreferences.value = preferences
                }
                .onFailure { exception ->
                    _error.value = "Failed to load preferences: ${exception.message}"
                }
            
            _isLoading.value = false
        }
    }

    fun updatePreferences(preferences: UserPreferences) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            userRepository.updateUserPreferences(preferences)
                .onSuccess { updatedPreferences ->
                    _userPreferences.value = updatedPreferences
                }
                .onFailure { exception ->
                    _error.value = "Failed to update preferences: ${exception.message}"
                }
            
            _isLoading.value = false
        }
    }

    fun clearError() {
        _error.value = null
    }
}