import { createAction, props } from '@ngrx/store';
import { LanguagePreference, BlockedSource, State as PreferencesState } from '../reducers/preferences.reducer';

// Language preferences
export const setLanguage = createAction(
  '[Preferences] Set Language',
  props<{ language: LanguagePreference }>()
);

// Topic preferences
export const toggleTopic = createAction(
  '[Preferences] Toggle Topic',
  props<{ topicId: string }>()
);

// Blocked sources
export const addBlockedSource = createAction(
  '[Preferences] Add Blocked Source',
  props<{ source: BlockedSource }>()
);

export const removeBlockedSource = createAction(
  '[Preferences] Remove Blocked Source',
  props<{ sourceId: string }>()
);

// Load preferences from API
export const loadPreferences = createAction('[Preferences] Load Preferences');

export const loadPreferencesSuccess = createAction(
  '[Preferences] Load Preferences Success',
  props<{ preferences: Partial<PreferencesState> }>()
);

export const loadPreferencesFailure = createAction(
  '[Preferences] Load Preferences Failure',
  props<{ error: string }>()
);

// Save preferences to API
export const savePreferences = createAction(
  '[Preferences] Save Preferences',
  props<{ preferences: Partial<PreferencesState> }>()
);

export const savePreferencesSuccess = createAction(
  '[Preferences] Save Preferences Success'
);

export const savePreferencesFailure = createAction(
  '[Preferences] Save Preferences Failure',
  props<{ error: string }>()
); 