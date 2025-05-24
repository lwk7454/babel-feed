import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // For ngModel
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, map, startWith } from 'rxjs/operators';

import { AppState } from '../../store';
import * as UserPreferencesActions from '../../store/actions/user-preferences.actions';
import { 
  selectUserPreferences, 
  selectAvailableTopics, 
  selectAvailableSources, // Assuming you might have this
  UserPreferences 
} from '../../store/reducers/user-preferences.reducer'; // Adjust path as needed

// PrimeNG Modules
import { CheckboxModule } from 'primeng/checkbox'; // For selecting topics
import { InputTextModule } from 'primeng/inputtext'; // For adding blocked sources
import { ButtonModule } from 'primeng/button';
import { OrderListModule } from 'primeng/orderlist'; // For managing blocked sources
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { MultiSelectModule } from 'primeng/multiselect'; // For selecting multiple topics/sources easily
import { ToolbarModule } from 'primeng/toolbar'; // For header/footer actions

export interface TopicVM {
  id: string;
  name: string;
  selected: boolean;
}

export interface SourceVM {
  id: string;
  name: string;
  // 'blocked' status can be derived or managed
}

@Component({
  selector: 'app-content-preferences',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CheckboxModule,
    InputTextModule,
    ButtonModule,
    OrderListModule,
    PanelModule,
    DividerModule,
    MultiSelectModule,
    ToolbarModule
  ],
  templateUrl: './content-preferences.component.html',
  styleUrls: ['./content-preferences.component.scss']
})
export class ContentPreferencesComponent implements OnInit, OnDestroy {
  // From Store
  userPreferences$: Observable<UserPreferences | null>;
  availableTopics$: Observable<TopicVM[]>; // Topics available for selection
  
  // Local component state
  selectedTopicIds: string[] = []; // IDs of selected topics
  blockedSources: SourceVM[] = []; // List of sources marked as blocked by user
  
  newBlockedSource: string = ''; // For the input field to add a new source to block

  private destroy$ = new Subject<void>();

  // Mock or initial data (can be replaced by store selectors if available)
  private allAvailableTopics: TopicVM[] = [
    { id: 'tech', name: 'Technology', selected: false },
    { id: 'business', name: 'Business', selected: false },
    { id: 'sports', name: 'Sports', selected: false },
    { id: 'entertainment', name: 'Entertainment', selected: false },
    { id: 'science', name: 'Science', selected: false },
    { id: 'health', name: 'Health & Wellness', selected: false },
    { id: 'world', name: 'World News', selected: false },
    { id: 'politics', name: 'Politics', selected: false },
  ];


  constructor(
    private router: Router,
    private store: Store<AppState>
    // private apiService: ApiService // Keep if direct API calls are still needed for some part
  ) {
    this.userPreferences$ = this.store.select(selectUserPreferences);
    
    // Map available topics from store or use mock, and merge with user's selections
    this.availableTopics$ = combineLatest([
      this.store.select(selectAvailableTopics).pipe(startWith(this.allAvailableTopics)), // Or actual selector
      this.userPreferences$
    ]).pipe(
      map(([availableTopics, prefs]) => {
        return availableTopics.map(topic => ({
          ...topic,
          selected: prefs?.preferredTopicIds?.includes(topic.id) ?? false
        }));
      })
    );
  }

  ngOnInit(): void {
    this.store.dispatch(UserPreferencesActions.loadUserPreferencesStart());
    // this.store.dispatch(UserPreferencesActions.loadAvailableTopicsStart()); // If topics are dynamic

    this.userPreferences$.pipe(takeUntil(this.destroy$)).subscribe(prefs => {
      if (prefs) {
        this.selectedTopicIds = [...(prefs.preferredTopicIds || [])];
        this.blockedSources = (prefs.blockedSourceIds || []).map(id => ({ id: id, name: id })); // Assuming name is same as id for now
      }
    });
  }

  onTopicChange(topic: TopicVM, isChecked: boolean): void {
    if (isChecked) {
      if (!this.selectedTopicIds.includes(topic.id)) {
        this.selectedTopicIds.push(topic.id);
      }
    } else {
      this.selectedTopicIds = this.selectedTopicIds.filter(id => id !== topic.id);
    }
    // No immediate save, user will click a "Save" button
  }
  
  addBlockedSource(): void {
    const sourceName = this.newBlockedSource.trim();
    if (sourceName && !this.blockedSources.find(s => s.name.toLowerCase() === sourceName.toLowerCase())) {
      // For simplicity, using the name as ID. In a real app, sources would have stable IDs.
      this.blockedSources = [...this.blockedSources, { id: sourceName, name: sourceName }];
      this.newBlockedSource = ''; // Clear input
    }
    // No immediate save
  }

  removeBlockedSource(sourceToRemove: SourceVM): void {
    this.blockedSources = this.blockedSources.filter(source => source.id !== sourceToRemove.id);
    // No immediate save
  }

  savePreferences(): void {
    const preferencesToSave: UserPreferences = {
      preferredTopicIds: this.selectedTopicIds,
      blockedSourceIds: this.blockedSources.map(s => s.id),
      // Add other preferences like preferredLanguageIds if implemented
    };
    this.store.dispatch(UserPreferencesActions.updateUserPreferencesStart({ preferences: preferencesToSave }));
    // Optionally, show a success message or handle errors via effects
    console.log('Attempting to save preferences:', preferencesToSave);
  }
  
  goBack(): void {
    // Check if there are unsaved changes before navigating
    // For simplicity, directly navigating back. Add a confirmation dialog if needed.
    this.router.navigate(['/settings']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
