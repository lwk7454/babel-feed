package com.babelfeed.app.data.models

import com.google.gson.annotations.SerializedName

/**
 * Request to create a guest profile
 */
data class CreateGuestRequest(
    @SerializedName("deviceFingerprint")
    val deviceFingerprint: String? = null
)

/**
 * Response from creating a guest profile
 */
data class CreateGuestResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("data")
    val data: GuestData,
    
    @SerializedName("message")
    val message: String
)

data class GuestData(
    @SerializedName("guestId")
    val guestId: String,
    
    @SerializedName("userId")
    val userId: String,
    
    @SerializedName("createdAt")
    val createdAt: String
)

/**
 * Request to create account from guest
 */
data class CreateAccountRequest(
    @SerializedName("guestId")
    val guestId: String,
    
    @SerializedName("email")
    val email: String
)

/**
 * Response from creating account
 */
data class CreateAccountResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("data")
    val data: AccountData,
    
    @SerializedName("message")
    val message: String
)

data class AccountData(
    @SerializedName("userId")
    val userId: String,
    
    @SerializedName("email")
    val email: String,
    
    @SerializedName("verificationSent")
    val verificationSent: Boolean
)

/**
 * Request to verify email with verification token
 */
data class VerifyEmailRequest(
    @SerializedName("verificationToken")
    val verificationToken: String
)

/**
 * Request to resend verification code
 */
data class ResendVerificationRequest(
    @SerializedName("email")
    val email: String
)

/**
 * Response from email verification
 */
data class VerifyEmailResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("data")
    val data: VerificationData,
    
    @SerializedName("message")
    val message: String
)

data class VerificationData(
    @SerializedName("user")
    val user: User,
    
    @SerializedName("accessToken")
    val accessToken: String,
    
    @SerializedName("refreshToken")
    val refreshToken: String
)

/**
 * Request to refresh tokens
 */
data class RefreshTokenRequest(
    @SerializedName("refreshToken")
    val refreshToken: String
)

/**
 * Response from token refresh
 */
data class RefreshTokenResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("data")
    val data: AuthTokens,
    
    @SerializedName("message")
    val message: String
)

/**
 * Response from profile requests
 */
data class ProfileResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("data")
    val data: User
)

/**
 * Response from preferences requests
 */
data class PreferencesResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("data")
    val data: UserPreferences?,
    
    @SerializedName("message")
    val message: String? = null
)

/**
 * Authentication status response
 */
data class AuthStatusResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("data")
    val data: AuthStatus
)

data class AuthStatus(
    @SerializedName("authenticated")
    val authenticated: Boolean,
    
    @SerializedName("emailVerified")
    val emailVerified: Boolean,
    
    @SerializedName("userId")
    val userId: String?
)

/**
 * Generic API response wrapper
 */
data class ApiResponse<T>(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("data")
    val data: T? = null,
    
    @SerializedName("message")
    val message: String? = null,
    
    @SerializedName("error")
    val error: ApiError? = null
)

data class ApiError(
    @SerializedName("code")
    val code: String,
    
    @SerializedName("message")
    val message: String,
    
    @SerializedName("details")
    val details: String?
)