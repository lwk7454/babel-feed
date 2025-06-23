package com.babelfeed.app.data.repository

import com.babelfeed.app.data.api.BabelApiService
import com.babelfeed.app.data.models.UserPreferences
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserRepository @Inject constructor(
    private val apiService: BabelApiService
) {
    
    suspend fun getUserPreferences(): Result<UserPreferences?> {
        return try {
            val response = apiService.getPreferences()
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.message ?: "Failed to get preferences"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateUserPreferences(preferences: UserPreferences): Result<UserPreferences> {
        return try {
            val response = apiService.updatePreferences(preferences)
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.message ?: "Failed to update preferences"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}