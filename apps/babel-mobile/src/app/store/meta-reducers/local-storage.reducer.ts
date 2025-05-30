import { ActionReducer, Action } from '@ngrx/store';
import { AppState } from '..';

const STORAGE_PREFIX = 'babel_feed_';

// Save to local storage
export function localStorageSyncReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  let onInit = true;
  
  // Return a reducer function that handles local storage
  return function(state: AppState | undefined, action: Action) {
    // Load state from localStorage on init
    if (onInit) {
      onInit = false;
      const savedState = loadFromLocalStorage();
      
      // Merge with initial state if available
      const mergedState = { ...state, ...savedState } as AppState;
      return reducer(mergedState, action);
    }
    
    // Process the current action and get the next state
    const nextState = reducer(state, action);
    
    // Save to localStorage if we have a state
    if (nextState) {
      saveToLocalStorage(nextState);
    }
    
    return nextState;
  };
}

// Helper function to save state to localStorage
function saveToLocalStorage(state: AppState): void {
  try {
    // Only save specific slices of state
    const stateToSave: Record<string, unknown> = {};
    
    if (state.preferences) {
      stateToSave['preferences'] = state.preferences;
    }
    
    if (state.user) {
      stateToSave['user'] = state.user;
    }
    
    if (Object.keys(stateToSave).length > 0) {
      localStorage.setItem(`${STORAGE_PREFIX}state`, JSON.stringify(stateToSave));
    }
  } catch (e) {
    console.error('Error saving state to localStorage', e);
  }
}

// Helper function to load state from localStorage
function loadFromLocalStorage(): Partial<AppState> {
  try {
    const serializedState = localStorage.getItem(`${STORAGE_PREFIX}state`);
    if (!serializedState) return {};
    
    const parsed = JSON.parse(serializedState) as Record<string, unknown>;
    const result: Partial<AppState> = {};
    
    if (parsed['preferences']) {
      result.preferences = parsed['preferences'] as AppState['preferences'];
    }
    
    if (parsed['user']) {
      result.user = parsed['user'] as AppState['user'];
    }
    
    return result;
  } catch (e) {
    console.error('Error loading state from localStorage', e);
    return {};
  }
}