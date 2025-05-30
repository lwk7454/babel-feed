import { AsyncPipe, CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, of, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

import { ApiService, NewsItem } from '../../services/api.service'; // Assuming NewsItem structure
import { AppState } from '../../store'; // Assuming AppState is correctly defined
import * as FeedActions from '../../store/actions/feed.actions';
import { LanguagePreference, selectSelectedLanguage } from '../../store/reducers/preferences.reducer';
import { NavigationComponent } from '../../shared/components';
import { TranslatePipe } from '../../shared/pipes';

// PrimeNG Modules for basic UI elements (e.g., button, ripple for interaction)
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner'; // For loading state
import { RippleModule } from 'primeng/ripple';

// Use NewsItem directly since it now has all the fields we need
export type FeedDisplayItem = NewsItem;

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    RippleModule,
    ProgressSpinnerModule,
    DatePipe, // For formatting dates in the template
    AsyncPipe, // For async pipe
    NgClass, // For ngClass directive
    NavigationComponent, // Navigation component
    TranslatePipe // Translation pipe
  ],
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss']
})
export class FeedComponent implements OnInit, OnDestroy {
  newsItems$: Observable<FeedDisplayItem[]>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  selectedLanguage$: Observable<LanguagePreference>;
  
  currentError: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private store: Store<AppState>,
    private apiService: ApiService
  ) {
    this.selectedLanguage$ = this.store.select(selectSelectedLanguage);
    
    // Use API service for immediate data loading with language preference
    this.newsItems$ = this.selectedLanguage$.pipe(
      switchMap(language => {
        const requestLanguage = language?.code && language.code !== 'en' ? language.code : undefined;
        return this.apiService.getNewsFeed(requestLanguage);
      })
    );
    this.loading$ = of(false);
    this.error$ = of(null);

    // Uncomment below to use NGRX store for data (assuming effects and reducers are set up)
    /*
    this.newsItems$ = this.store.select(selectFeedItems).pipe(
      map(items => items as FeedDisplayItem[]) // Ensure items conform to FeedDisplayItem
    );
    this.loading$ = this.store.select(selectFeedLoading);
    this.error$ = this.store.select(selectFeedError);
    */
  }

  ngOnInit(): void {
    // Dispatch action to load real feed data from the store
    // This will eventually replace the mock data if successful
    this.store.dispatch(FeedActions.loadFeedStart());

    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => {
      if (error) {
        console.error('Error loading feed:', error);
        this.currentError = 'Failed to load feed. Please try refreshing.';
        // Optionally, clear items or show mock items as fallback
        // this.newsItems$ = of(this.mockNewsItems); // Or of([])
      } else {
        this.currentError = null;
      }
    });

    // If using store for loading indication:
    // this.loading$.pipe(takeUntil(this.destroy$)).subscribe(isLoading => {
    //   if(isLoading) this.currentError = null; // Clear error when starting to load
    // });
  }



  /**
   * Handle search button click from navigation
   */
  handleSearch(): void {
    this.router.navigate(['/search']);
  }

  openNewsItem(item: FeedDisplayItem): void {
    if (item && item.id) {
      // Navigate to the article detail page
      this.router.navigate(['/article', item.id]);
    } else {
      console.error('Cannot open news item: item or item.id is undefined', item);
    }
  }

  refreshFeed(): void {
    console.log('Refreshing feed...');
    this.currentError = null;
    this.loading$ = of(true);
    
    // Try to load from store first, fallback to API service
    this.store.dispatch(FeedActions.loadFeedStart());
    
    // As fallback, also refresh from API service with language preference
    this.newsItems$ = this.selectedLanguage$.pipe(
      switchMap(language => {
        const requestLanguage = language?.code && language.code !== 'en' ? language.code : undefined;
        return this.apiService.getNewsFeed(requestLanguage);
      })
    );
    this.loading$ = of(false);
  }
  
  // Helper to track items in *ngFor for better performance
  trackById(index: number, item: FeedDisplayItem): string {
    return item.id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
