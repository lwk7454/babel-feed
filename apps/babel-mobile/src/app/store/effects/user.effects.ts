import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { switchMap, map, catchError, tap } from 'rxjs/operators';
// import { AuthService } from '@auth0/auth0-angular'; // This line can stay if relevant for other future auth methods
// Ensure NO imports from '@abacritt/angularx-social-login' remain here.

import * as UserActions from '../actions/user.actions';
import * as PreferencesActions from '../actions/preferences.actions';
import { UserData } from '../reducers/user.reducer';
import { NavigationService } from '../../services/navigation.service';

@Injectable()
export class UserEffects {
  constructor(
    private actions$: Actions,
    // private apiService: ApiService, // This line can stay if relevant for future API calls
    private router: Router,
    // private auth0Service: AuthService, // This can stay if relevant
    private navigationService: NavigationService
    // Ensure socialAuthService is NOT injected here
  ) {}

  // Handle sign in with email
  signIn$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.signInStart),
      switchMap(({ email }) => {
        console.log(`[UserEffects] signInStart received for email: ${email}`);
        const userData: UserData = {
          id: email, // Email is the new User ID
          email: email,
          displayName: email.split('@')[0], // Basic display name from email
          photoURL: '', // No photo URL for email login
          isEmailVerified: false // Default to false, will be updated by verification flow
        };
        return of(UserActions.signInSuccess({ userData }));
      }),
      catchError((error) => {
        console.error('[UserEffects] Sign-In Error:', error);
        return of(UserActions.signInFailure({ error: error.message || 'Sign-In Failed' }));
      })
    )
  );

  // Handle sign out
  signOut$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.signOutStart),
      tap(() => console.log('[UserEffects] signOutStart received')),
      map(() => {
        console.log('[UserEffects] Dispatching signOutSuccess');
        return UserActions.signOutSuccess();
      })
    )
  );

  // Redirect after sign in success
  authSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.signInSuccess),
      tap(({ userData }) => {
        console.log(`[UserEffects] authSuccess$: User ${userData.email} signed in. Navigating to feed.`);
        this.router.navigate(['/feed']).then(() => {
          // NavigationService will automatically detect feed navigation and set it as root
        });
      }),
      map(({ userData }) => PreferencesActions.loadPreferences({ userId: userData.id }))
    )
  );

  // Redirect after sign out
  authSignOut$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UserActions.signOutSuccess),
        tap(() => {
          console.log('[UserEffects] authSignOut$: signOutSuccess received. Attempting navigation to welcome.');
          this.navigationService.resetToPreLogin();
          this.router.navigate(['/welcome']);
        }),
        map(() => {
          console.log('[UserEffects] authSignOut$: Dispatching clearAllPreferences');
          return PreferencesActions.clearAllPreferences();
        })
      )
  );
  
  // Effect to handle OTP request for email verification
  requestEmailVerificationOtp$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.requestEmailVerificationOtp),
      tap(() => console.log('[UserEffects] Requesting email verification OTP')),
      // TODO: Replace with actual API call to your backend
      switchMap(({ email }) => {
        console.log(`[UserEffects] Simulating OTP request for ${email}`);
        // For now, simulating success after a delay with a mock OTP
        return of(UserActions.requestEmailVerificationOtpSuccess({ otp: '1234' })); 
        // If you want to simulate delay: .pipe(delay(1000)); // Import delay from 'rxjs/operators' if used
      }),
      catchError((error) => {
        console.error('[UserEffects] Request OTP Error:', error);
        return of(UserActions.requestEmailVerificationOtpFailure({ error: 'Failed to request OTP' }));
      })
    )
  );

  // Effect to handle OTP submission for email verification
  verifyEmailOtp$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.verifyEmailOtp),
      tap(({email, otp}) => console.log(`[UserEffects] Verifying email OTP ${otp} for ${email}`)),
      // TODO: Replace with actual API call to your backend
      switchMap(({ email, otp }) => {
        // For now, simulating success if OTP is '1234'
        if (otp === '1234') { 
          console.log(`[UserEffects] OTP verified for ${email}`);
          return of(UserActions.verifyEmailOtpSuccess({ email })); 
        } else {
          console.log(`[UserEffects] Invalid OTP ${otp} for ${email}`);
          return of(UserActions.verifyEmailOtpFailure({ error: 'Invalid OTP' }));
        }
      }),
      catchError((error) => {
        console.error('[UserEffects] Verify OTP Error:', error);
        return of(UserActions.verifyEmailOtpFailure({ error: 'Failed to verify OTP' }));
      })
    )
  );

  // Update user state after successful email verification
  emailVerificationSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.verifyEmailOtpSuccess),
      tap(({email}) => console.log(`[UserEffects] Email ${email} successfully verified. Updating state.`)),
      map(({ email }) => UserActions.updateUserEmailVerificationStatus({ isEmailVerified: true }))
    )
  );

} 