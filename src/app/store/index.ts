import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { localStorageSyncReducer } from './meta-reducers/local-storage.reducer';
import { environment } from '../../environments/environment';
import * as fromUser from './reducers/user.reducer';
import * as fromPreferences from './reducers/preferences.reducer';
import * as fromFeed from './reducers/feed.reducer';

export interface AppState {
  user: fromUser.State;
  preferences: fromPreferences.State;
  feed: fromFeed.State;
}

export const reducers: ActionReducerMap<AppState> = {
  user: fromUser.reducer,
  preferences: fromPreferences.reducer,
  feed: fromFeed.reducer
};

// Add meta-reducers for local storage sync, clear state, etc.
export const metaReducers: MetaReducer<AppState>[] = !environment.production
  ? [localStorageSyncReducer]
  : [localStorageSyncReducer]; 