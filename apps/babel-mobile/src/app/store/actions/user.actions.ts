import { createAction, props } from '@ngrx/store';
import { UserData } from '../reducers/user.reducer';

// Sign in actions
export const signInStart = createAction(
  '[Auth] Sign In Start',
  props<{ email: string }>()
);

export const signInSuccess = createAction(
  '[Auth] Sign In Success',
  props<{ userData: UserData }>()
);

export const signInFailure = createAction(
  '[Auth] Sign In Failure',
  props<{ error: string }>()
);

// Sign out actions
export const signOutStart = createAction('[Auth] Sign Out Start');

export const signOutSuccess = createAction('[Auth] Sign Out Success');

export const signOutFailure = createAction(
  '[Auth] Sign Out Failure',
  props<{ error: string }>()
);

// Email Verification Actions
export const requestEmailVerificationOtp = createAction(
  '[Auth] Request Email Verification OTP',
  props<{ email: string }>()
);

export const requestEmailVerificationOtpSuccess = createAction(
  '[Auth] Request Email Verification OTP Success',
  props<{ otp: string }>()
);

export const requestEmailVerificationOtpFailure = createAction(
  '[Auth] Request Email Verification OTP Failure',
  props<{ error: string }>()
);

export const verifyEmailOtp = createAction(
  '[Auth] Verify Email OTP',
  props<{ email: string; otp: string }>()
);

export const verifyEmailOtpSuccess = createAction(
  '[Auth] Verify Email OTP Success',
  props<{ email: string }>()
);

export const verifyEmailOtpFailure = createAction(
  '[Auth] Verify Email OTP Failure',
  props<{ error: string }>()
);

export const updateUserEmailVerificationStatus = createAction(
  '[Auth] Update User Email Verification Status',
  props<{ isEmailVerified: boolean }>()
); 