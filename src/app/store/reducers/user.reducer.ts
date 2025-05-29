import { createReducer, on, createFeatureSelector, createSelector } from '@ngrx/store';
import * as UserActions from '../actions/user.actions';

export interface UserData {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  provider?: string;
  isEmailVerified?: boolean;
}

export interface State {
  userData: UserData | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export const initialState: State = {
  userData: null,
  isAuthenticated: false,
  loading: false,
  error: null
};

export const reducer = createReducer(
  initialState,
  
  // Sign in actions
  on(UserActions.signInStart, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(UserActions.signInSuccess, (state, { userData }) => ({
    ...state,
    userData: {
      ...userData,
      isEmailVerified: userData.isEmailVerified || false
    },
    isAuthenticated: true,
    loading: false,
    error: null
  })),
  
  on(UserActions.signInFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Sign out actions
  on(UserActions.signOutStart, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(UserActions.signOutSuccess, () => ({
    ...initialState
  })),
  
  on(UserActions.signOutFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Handle email verification update
  on(UserActions.updateUserEmailVerificationStatus, (state, { isEmailVerified }) => {
    if (!state.userData) return state; // Should not happen if user is logged in
    return {
      ...state,
      userData: {
        ...state.userData,
        isEmailVerified
      }
    };
  })
);

// Feature Selector for the user state
export const selectUserState = createFeatureSelector<State>('user');

// Selectors
export const selectUserData = createSelector(
  selectUserState,
  (state: State) => state.userData
);

export const selectUserIsAuthenticated = createSelector(
  selectUserState,
  (state: State) => state.isAuthenticated
);

export const selectUserLoading = createSelector(
  selectUserState,
  (state: State) => state.loading
);

export const selectUserError = createSelector(
  selectUserState,
  (state: State) => state.error
); 