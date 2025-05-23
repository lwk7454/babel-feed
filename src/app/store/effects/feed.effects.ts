import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import * as FeedActions from '../actions/feed.actions';

@Injectable()
export class FeedEffects {
  constructor(
    private actions$: Actions,
    private apiService: ApiService
  ) {}

  loadFeed$ = createEffect(() =>
    this.actions$.pipe(
      ofType(FeedActions.loadFeedStart),
      switchMap(() =>
        this.apiService.getNewsFeed().pipe(
          map(items => FeedActions.loadFeedSuccess({ items })),
          catchError(error => {
            console.error('Error loading feed:', error);
            const errorMessage = error.message || 'Failed to load news feed.';
            return of(FeedActions.loadFeedFailure({ error: errorMessage }));
          })
        )
      )
    )
  );
} 