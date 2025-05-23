import { Injectable } from '@angular/core';
import { Actions } from '@ngrx/effects'; // Removed unused createEffect, ofType for now
// import { map, switchMap, catchError } from 'rxjs/operators';
// import { of } from 'rxjs';
// import { ApiService } from '../../services/api.service';
// import * as PreferencesActions from '../actions/preferences.actions';

@Injectable()
export class PreferencesEffects {
  constructor(
    private actions$: Actions,
    // private apiService: ApiService
  ) {}

  // Example: Effect to save preferences to backend if needed in the future
  /*
  savePreferences$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PreferencesActions.updatePreferencesOnBackend), // A new action if you want to trigger backend save
      switchMap(action => 
        this.apiService.updateUserPreferences(action.preferences).pipe(
          map(() => PreferencesActions.updatePreferencesSuccess()), // Optional success action
          catchError(error => of(PreferencesActions.updatePreferencesFailure({ error: error.message })))
        )
      )
    )
  ); 
  */

  // For now, preferences are updated synchronously in the reducer. No effects needed for basic client-side updates.
} 