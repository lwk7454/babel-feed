import { createReducer, on, createFeatureSelector, createSelector } from '@ngrx/store';
import { NewsItem } from '../../services/api.service';
import * as FeedActions from '../actions/feed.actions';

export interface State {
  items: NewsItem[];
  loading: boolean;
  error: string | null;
}

export const initialState: State = {
  items: [],
  loading: false,
  error: null
};

export const reducer = createReducer(
  initialState,
  on(FeedActions.loadFeedStart, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(FeedActions.loadFeedSuccess, (state, { items }) => ({
    ...state,
    items,
    loading: false,
    error: null
  })),
  on(FeedActions.loadFeedFailure, (state, { error }) => ({
    ...state,
    items: [], // Optionally clear items on failure or keep stale data
    loading: false,
    error
  }))
);

// Feature Selector
export const selectFeedState = createFeatureSelector<State>('feed');

// Selectors
export const selectFeedItems = createSelector(
  selectFeedState,
  (state: State) => state.items
);

export const selectFeedLoading = createSelector(
  selectFeedState,
  (state: State) => state.loading
);

export const selectFeedError = createSelector(
  selectFeedState,
  (state: State) => state.error
); 