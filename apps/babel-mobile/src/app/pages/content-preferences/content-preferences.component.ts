import { Component, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe, Location } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // For ngModel
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState } from '../../store';
import * as PreferencesActions from '../../store/actions/preferences.actions';
import { 
  selectTopics, 
  selectBlockedSources,
  TopicPreference,
  BlockedSource
} from '../../store/reducers/preferences.reducer';

// PrimeNG Modules
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

export interface SourceVM {
  id: string;
  name: string;
}

@Component({
  selector: 'app-content-preferences',
  standalone: true,
  imports: [
    FormsModule,
    CheckboxModule,
    InputTextModule,
    ButtonModule,
    PanelModule,
    DividerModule,
    ToastModule,
    AsyncPipe
  ],
  providers: [MessageService],
  templateUrl: './content-preferences.component.html',
  styleUrls: ['./content-preferences.component.scss']
})
export class ContentPreferencesComponent implements OnInit, OnDestroy {
  // From Store
  topics$: Observable<TopicPreference[]>;
  blockedSources$: Observable<BlockedSource[]>;
  
  // Local component state for blocked sources management
  newBlockedSource: string = '';

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private location: Location,
    private store: Store<AppState>,
    private messageService: MessageService
  ) {
    this.topics$ = this.store.select(selectTopics);
    this.blockedSources$ = this.store.select(selectBlockedSources);
  }

  ngOnInit(): void {
    // Preferences are loaded on user sign-in via an effect.
    // No need to dispatch loadPreferences() here.
  }

  /**
   * Handle topic selection change - immediately updates store
   */
  onTopicChange(topic: TopicPreference, isChecked: boolean): void {
    if (topic.selected !== isChecked) {
      this.store.dispatch(PreferencesActions.toggleTopic({ topicId: topic.id }));
      this.showToast('success', 'Updated', `${topic.name} ${isChecked ? 'added to' : 'removed from'} your interests`);
    }
  }
  
  /**
   * Add a new blocked source
   */
  addBlockedSource(): void {
    const sourceName = this.newBlockedSource.trim();
    if (!sourceName) {
      this.showToast('warn', 'Warning', 'Please enter a source name');
      return;
    }

    // Check if source already exists
    this.blockedSources$.pipe(takeUntil(this.destroy$)).subscribe(sources => {
      const exists = sources.find(s => s.name.toLowerCase() === sourceName.toLowerCase());
      if (exists) {
        this.showToast('warn', 'Already Blocked', 'This source is already in your blocked list');
        return;
      }

      // Add to store
      const newSource: BlockedSource = { 
        id: this.generateSourceId(sourceName), 
        name: sourceName 
      };
      this.store.dispatch(PreferencesActions.addBlockedSource({ source: newSource }));
      this.newBlockedSource = '';
      this.showToast('success', 'Source Blocked', `${sourceName} will no longer appear in your feed`);
    }).unsubscribe();
  }

  /**
   * Remove a blocked source
   */
  removeBlockedSource(source: BlockedSource): void {
    this.store.dispatch(PreferencesActions.removeBlockedSource({ sourceId: source.id }));
    this.showToast('info', 'Source Unblocked', `${source.name} can now appear in your feed`);
  }

  /**
   * Generate a unique ID for a source
   */
  private generateSourceId(sourceName: string): string {
    return sourceName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
  }

  /**
   * Show toast message
   */
  private showToast(severity: string, summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail, life: 3000 });
  }
  
  /**
   * Navigate back to settings page
   * Direct navigation to avoid browser history issues
   */
  goBack(): void {
    this.router.navigate(['/settings']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
