import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AppState } from '../index';
import { selectSelectedLanguage } from '../reducers/preferences.reducer';
import * as FeedActions from '../actions/feed.actions';

@Injectable()
export class FeedEffects {
  constructor(
    private actions$: Actions,
    private apiService: ApiService,
    private store: Store<AppState>
  ) {}

  loadFeed$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FeedActions.loadFeedStart),
      withLatestFrom(this.store.select(selectSelectedLanguage)),
      switchMap(([action, language]) => {
        // Determine if we should request translated content
        const requestLanguage = language?.code && language.code !== 'en' ? language.code : undefined;
        
        return this.apiService.getNewsFeed(requestLanguage).pipe(
          map(items => FeedActions.loadFeedSuccess({ items })),
          catchError(error => {
            console.error('Error loading feed:', error);
            const errorMessage = error.message || 'Failed to load news feed.';
            return of(FeedActions.loadFeedFailure({ error: errorMessage }));
          })
        );
      })
    )
  );
} 