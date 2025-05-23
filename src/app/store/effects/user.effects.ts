import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { from, of } from 'rxjs';
import { switchMap, map, catchError, tap } from 'rxjs/operators';
// import { AuthService } from '@auth0/auth0-angular'; // Keep if Auth0 is still used for other things, or remove if not.
import { SocialAuthService, GoogleLoginProvider, SocialUser } from '@abacritt/angularx-social-login';

import * as UserActions from '../actions/user.actions';
// import { ApiService } from '../../services/api.service'; // Assuming social login replaces this for auth
import { UserData } from '../reducers/user.reducer';

@Injectable()
export class UserEffects {
  constructor(
    private actions$: Actions,
    // private apiService: ApiService, // Remove if ApiService is not used here anymore
    private router: Router,
    // private auth0Service: AuthService, // Remove if not used
    private socialAuthService: SocialAuthService
  ) {}

  // Handle sign in
  signIn$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.signInStart),
      switchMap(({ provider }) => { // Removed unused payload for now
        switch (provider) {
          case 'google':
            return from(this.socialAuthService.signIn(GoogleLoginProvider.PROVIDER_ID)).pipe(
              map((socialUser: SocialUser) => {
                const userData: UserData = {
                  id: socialUser.id,
                  email: socialUser.email,
                  displayName: socialUser.name,
                  photoURL: socialUser.photoUrl,
                  provider: socialUser.provider
                };
                return UserActions.signInSuccess({ userData });
              }),
              catchError((error) => {
                console.error('Google Sign-In Error:', error);
                return of(UserActions.signInFailure({ error: error.message || 'Google Sign-In Failed' }));
              })
            );
          
          // Cases for 'apple', 'wechat' currently use ApiService mock.
          // These would need actual implementations if required.
          // For now, they will fail or can be removed if only Google is supported.
          case 'apple':
          case 'wechat':
            return of(UserActions.signInFailure({ error: `Provider '${provider}' not implemented yet.` }));

          default:
            return of(UserActions.signInFailure({ error: 'Unsupported provider' }));
        }
      })
    )
  );

  // Handle sign out
  signOut$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.signOutStart),
      switchMap(() => 
        from(this.socialAuthService.signOut()).pipe(
          map(() => UserActions.signOutSuccess()),
          catchError((error) => {
            console.error('Sign-Out Error:', error);
            return of(UserActions.signOutFailure({ error: error.message || 'Sign-Out Failed' }));
          })
        )
      )
    )
  );

  // Redirect after sign in success
  authSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UserActions.signInSuccess),
        tap(() => {
          this.router.navigate(['/feed']);
        })
      ),
    { dispatch: false }
  );

  // Redirect after sign out
  authSignOut$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UserActions.signOutSuccess),
        tap(() => {
          // Could also clear other user-specific data here if needed
          this.router.navigate(['/welcome']);
        })
      ),
    { dispatch: false }
  );
} 