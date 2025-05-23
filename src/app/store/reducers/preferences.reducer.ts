import { createReducer, on, createFeatureSelector, createSelector } from '@ngrx/store';
import * as PreferencesActions from '../actions/preferences.actions';

export interface LanguagePreference {
  id: string;
  name: string;
  code: string;
  native: string;
}

export interface TopicPreference {
  id: string;
  name: string;
  selected: boolean;
}

export interface BlockedSource {
  id: string;
  name: string;
}

export interface State {
  selectedLanguage: LanguagePreference;
  availableLanguages: LanguagePreference[];
  topics: TopicPreference[];
  blockedSources: BlockedSource[];
  loading: boolean;
  error: string | null;
}

const defaultLanguage: LanguagePreference = {
  id: 'en',
  name: 'English',
  code: 'en',
  native: 'English'
};

export const initialState: State = {
  selectedLanguage: defaultLanguage,
  availableLanguages: [
    defaultLanguage,
    {
      id: 'zh-Hans',
      name: 'Chinese (Simplified)',
      code: 'zh-Hans',
      native: '简体中文'
    },
    {
      id: 'zh-Hant',
      name: 'Chinese (Traditional)',
      code: 'zh-Hant',
      native: '繁體中文'
    },
    {
      id: 'ja',
      name: 'Japanese',
      code: 'ja',
      native: '日本語'
    }
  ],
  topics: [
    { id: 'tech', name: 'Technology', selected: true },
    { id: 'entertainment', name: 'Entertainment', selected: true },
    { id: 'politics', name: 'Politics', selected: false },
    { id: 'sports', name: 'Sports', selected: false },
    { id: 'science', name: 'Science', selected: false },
    { id: 'health', name: 'Health', selected: false },
  ],
  blockedSources: [
    // { id: 'source1', name: 'Example News Site' }, // Example, can be empty initially
    // { id: 'source2', name: 'Another Blocked Source' }
  ],
  loading: false,
  error: null
};

export const reducer = createReducer(
  initialState,
  
  // Language preferences
  on(PreferencesActions.setLanguage, (state, { language }) => ({
    ...state,
    selectedLanguage: language
  })),
  
  // Topic preferences
  on(PreferencesActions.toggleTopic, (state, { topicId }) => ({
    ...state,
    topics: state.topics.map(topic => 
      topic.id === topicId 
        ? { ...topic, selected: !topic.selected }
        : topic
    )
  })),
  
  // Blocked sources
  on(PreferencesActions.addBlockedSource, (state, { source }) => ({
    ...state,
    blockedSources: state.blockedSources.find(bs => bs.id === source.id) ? state.blockedSources : [...state.blockedSources, source]
  })),
  
  on(PreferencesActions.removeBlockedSource, (state, { sourceId }) => ({
    ...state,
    blockedSources: state.blockedSources.filter(source => source.id !== sourceId)
  })),
  
  // Load preferences
  on(PreferencesActions.loadPreferencesSuccess, (state, { preferences }) => ({
    ...state,
    ...preferences,
    loading: false,
    error: null
  })),
  
  on(PreferencesActions.loadPreferencesFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  }))
);

// Feature Selector
export const selectPreferencesState = createFeatureSelector<State>('preferences');

// Selectors
export const selectSelectedLanguage = createSelector(
  selectPreferencesState,
  (state: State) => state.selectedLanguage
);

export const selectAvailableLanguages = createSelector(
  selectPreferencesState,
  (state: State) => state.availableLanguages
);

export const selectTopics = createSelector(
  selectPreferencesState,
  (state: State) => state.topics
);

export const selectBlockedSources = createSelector(
  selectPreferencesState,
  (state: State) => state.blockedSources
);

export const selectPreferencesLoading = createSelector(
  selectPreferencesState,
  (state: State) => state.loading
);

export const selectPreferencesError = createSelector(
  selectPreferencesState,
  (state: State) => state.error
); 