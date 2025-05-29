import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, catchError, tap, withLatestFrom, startWith, take } from 'rxjs/operators';
import { of, timer } from 'rxjs';
import { TranslationService } from '../../services/translation.service';
import { AppState } from '../index';
import { 
  selectSelectedLanguage, 
  selectAvailableLanguages, 
  LanguagePreference, 
  initialState as initialPreferencesState,
  selectPreferencesState
} from '../reducers/preferences.reducer';
import { selectUserState } from '../reducers/user.reducer';
import * as PreferencesActions from '../actions/preferences.actions';

@Injectable()
export class PreferencesEffects {
  constructor(
    private actions$: Actions,
    private translationService: TranslationService,
    private store: Store<AppState>
  ) {}

  /**
   * Load preferences for a user or set defaults.
   * This simulates loading from a backend or local storage.
   */
  loadPreferences$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PreferencesActions.loadPreferences),
      switchMap(({ userId }) => {
        if (userId) {
          try {
            const storedPrefsString = localStorage.getItem(`preferences_${userId}`);
            if (storedPrefsString) {
              const storedPrefs = JSON.parse(storedPrefsString);
              // Ensure all parts of the state are present, falling back to initial if not
              const completePrefs = { ...initialPreferencesState, ...storedPrefs };
              return of(PreferencesActions.loadPreferencesSuccess({ preferences: completePrefs }));
            }
          } catch (error) {
            console.error('Error loading preferences from localStorage:', error);
            // Fall through to loading initial state if localStorage fails
          }
        }
        // If no userId or no stored preferences, load initial state
        return of(PreferencesActions.loadPreferencesSuccess({ preferences: initialPreferencesState }));
      }),
      catchError(error => {
        console.error('Error in loadPreferences effect:', error);
        return of(PreferencesActions.loadPreferencesFailure({ error: 'Failed to load preferences' }));
      })
    )
  );

  /**
   * Effect to save preferences to local storage whenever they change.
   * This simulates saving to a backend.
   */
  savePreferences$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        PreferencesActions.setLanguage,
        PreferencesActions.toggleTopic,
        PreferencesActions.addBlockedSource,
        PreferencesActions.removeBlockedSource
        // We don't listen to clearAllPreferences here, as that is for session clearing
      ),
      withLatestFrom(this.store.select(selectUserState), this.store.select(selectPreferencesState)),
      switchMap(([action, userState, preferencesState]) => {
        if (userState.userData?.id) {
          try {
            localStorage.setItem(`preferences_${userState.userData.id}`, JSON.stringify(preferencesState));
            return of(PreferencesActions.savePreferencesSuccess()); // Optional: dispatch success
          } catch (error) {
            console.error('Error saving preferences to localStorage:', error);
            return of(PreferencesActions.savePreferencesFailure({ error: 'Failed to save preferences to localStorage' }));
          }
        }
        return of(); // No user, no save
      })
    )
  );

  /**
   * Effect to sync translation service when preferences language changes
   */
  syncTranslationService$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PreferencesActions.setLanguage),
      tap(({ language }) => {
        // Update translation service to match preferences store
        this.translationService.setLanguage(language.code);
      })
    ), { dispatch: false }
  );

  /**
   * Effect to initialize preferences from translation service on app start
   * This runs immediately when the effect is initialized
   */
  initializePreferences$ = createEffect(() =>
    timer(0).pipe( // Trigger immediately on app start
      switchMap(() => 
        this.store.select(selectSelectedLanguage).pipe(
          take(1), // Take only the current value
          withLatestFrom(this.store.select(selectAvailableLanguages)),
          switchMap(([selectedLang, availableLanguages]) => {
            const currentLang = this.translationService.getCurrentLanguage();
            
            // Only sync if they're different (avoid infinite loops)
            if (currentLang !== selectedLang?.code) {
              // Find matching language preference from store
              const matchingLanguage = availableLanguages.find((lang: LanguagePreference) => 
                lang.code === currentLang || lang.id === currentLang
              );
              
              if (matchingLanguage) {
                return of(PreferencesActions.setLanguage({ language: matchingLanguage }));
              }
            }
            return of(); // No action needed
          })
        )
      ),
      catchError(error => {
        console.error('Error initializing preferences:', error);
        return of(); // Don't dispatch any action on error
      })
    )
  );

  /**
   * Effect to sync preferences when translation service language changes
   * This handles cases where translation service changes independently
   */
  syncFromTranslationService$ = createEffect(() =>
    this.translationService.currentLanguage$.pipe(
      withLatestFrom(
        this.store.select(selectSelectedLanguage),
        this.store.select(selectAvailableLanguages)
      ),
      switchMap(([currentLang, selectedLang, availableLanguages]) => {
        // Only sync if they're different and not during initialization
        if (currentLang !== selectedLang?.code) {
          // Find matching language preference from store
          const matchingLanguage = availableLanguages.find((lang: LanguagePreference) => 
            lang.code === currentLang || lang.id === currentLang
          );
          
          if (matchingLanguage) {
            return of(PreferencesActions.setLanguage({ language: matchingLanguage }));
          }
        }
        return of(); // No action needed
      }),
      catchError(error => {
        console.error('Error syncing from translation service:', error);
        return of(); // Don't dispatch any action on error
      })
    )
  );
} 