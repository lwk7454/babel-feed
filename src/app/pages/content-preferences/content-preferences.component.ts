import { Component, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // For ngModel
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, map, startWith } from 'rxjs/operators';

import { AppState } from '../../store';
import * as PreferencesActions from '../../store/actions/preferences.actions';
import { 
  selectTopics, 
  selectBlockedSources,
  TopicPreference,
  BlockedSource
} from '../../store/reducers/preferences.reducer';

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
    FormsModule,
    CheckboxModule,
    InputTextModule,
    ButtonModule,
    OrderListModule,
    PanelModule,
    DividerModule,
    MultiSelectModule,
    ToolbarModule,
    AsyncPipe
  ],
  templateUrl: './content-preferences.component.html',
  styleUrls: ['./content-preferences.component.scss']
})
export class ContentPreferencesComponent implements OnInit, OnDestroy {
  // From Store
  topics$: Observable<TopicPreference[]>;
  blockedSources$: Observable<BlockedSource[]>;
  
  // Local component state
  selectedTopicIds: string[] = []; // IDs of selected topics
  blockedSources: SourceVM[] = []; // List of sources marked as blocked by user
  
  newBlockedSource: string = ''; // For the input field to add a new source to block

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private store: Store<AppState>
  ) {
    this.topics$ = this.store.select(selectTopics);
    this.blockedSources$ = this.store.select(selectBlockedSources);
  }

  ngOnInit(): void {
    this.store.dispatch(PreferencesActions.loadPreferences());

    this.topics$.pipe(takeUntil(this.destroy$)).subscribe(topics => {
      this.selectedTopicIds = topics.filter(topic => topic.selected).map(topic => topic.id);
    });

    this.blockedSources$.pipe(takeUntil(this.destroy$)).subscribe(sources => {
      this.blockedSources = sources.map(source => ({ id: source.id, name: source.name }));
    });
  }

  onTopicChange(topic: TopicPreference, isChecked: boolean): void {
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
    // Update topics
    this.selectedTopicIds.forEach(topicId => {
      this.store.dispatch(PreferencesActions.toggleTopic({ topicId }));
    });

    // Update blocked sources
    this.blockedSources.forEach(source => {
      this.store.dispatch(PreferencesActions.addBlockedSource({ source: { id: source.id, name: source.name } }));
    });

    console.log('Attempting to save preferences');
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
