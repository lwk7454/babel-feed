import { createAction, props } from '@ngrx/store';
import { UserData } from '../reducers/user.reducer';

// Sign in actions
export const signInStart = createAction(
  '[Auth] Sign In Start',
  props<{ provider: string, payload?: any }>()
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