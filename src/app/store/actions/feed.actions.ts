import { createAction, props } from '@ngrx/store';
import { NewsItem } from '../../services/api.service'; // Assuming NewsItem is exported from ApiService

export const loadFeedStart = createAction(
  '[Feed API] Load Feed Start'
);

export const loadFeedSuccess = createAction(
  '[Feed API] Load Feed Success',
  props<{ items: NewsItem[] }>()
);

export const loadFeedFailure = createAction(
  '[Feed API] Load Feed Failure',
  props<{ error: string }>()
); 