import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';

import { AppState } from '../../store'; // Assuming AppState is correctly defined
import { NewsItem } from '../../services/api.service'; // Assuming NewsItem structure
import * as FeedActions from '../../store/actions/feed.actions';
import { selectFeedItems, selectFeedLoading, selectFeedError } from '../../store/reducers/feed.reducer';

// PrimeNG Modules for basic UI elements (e.g., button, ripple for interaction)
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ProgressSpinnerModule } from 'primeng/progressspinner'; // For loading state

// Define a more specific interface for what the template will use, based on NewsItem
export interface FeedDisplayItem extends NewsItem {
  // Ensure all fields used in mock data and potentially from API are here
  // NewsItem should ideally have: id, title, summary?, source, publishedAt, type: 'article' | 'video', imageUrl?, duration?, category?, content?, language?, country?, keywords?
  // Adding summary explicitly as optional for type safety in template
  summary?: string;
}

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    RippleModule,
    ProgressSpinnerModule,
    DatePipe // For formatting dates in the template
  ],
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss']
})
export class FeedComponent implements OnInit, OnDestroy {
  newsItems$: Observable<FeedDisplayItem[]>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  
  currentError: string | null = null;
  private destroy$ = new Subject<void>();

  // Mock data for UI development and styling
  private mockNewsItems: FeedDisplayItem[] = [
    {
      id: 'mock1',
      title: 'Exploring the Depths: A New Underwater Discovery',
      summary: 'Scientists have found a previously unknown species of glowing fish in the Mariana Trench, challenging our understanding of deep-sea ecosystems.',
      source: 'Oceanographic Today',
      publishedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(), // 2 hours ago
      type: 'article',
      imageUrl: 'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA&ixlib=rb-4.0.3&q=80&w=400',
      category: 'Science',
      content: 'Full article content here...',
      language: 'en',
      country: 'us',
      keywords: ['ocean', 'discovery', 'science']
    },
    {
      id: 'mock2',
      title: 'Architectural Marvels: The Future of Urban Living (Video)',
      source: 'FutureScapes Channel',
      publishedAt: new Date(Date.now() - 3600 * 1000 * 28).toISOString(), // 28 hours ago
      type: 'video',
      imageUrl: 'https://images.unsplash.com/photo-1519994940911-d6907047f529?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA&ixlib=rb-4.0.3&q=80&w=400', // Placeholder thumbnail
      duration: '15:32',
      category: 'Technology',
      content: 'Details about the video content...',
      language: 'en',
      country: 'us',
      keywords: ['architecture', 'urban', 'future', 'video'],
      // summary is not typically for video items in this design
    },
    {
      id: 'mock3',
      title: 'The Rise of Sustainable Energy Solutions',
      summary: 'A comprehensive analysis of how renewable energy sources are becoming increasingly viable and the impact on global markets.',
      source: 'Eco World News',
      publishedAt: new Date(Date.now() - 3600 * 1000 * 72).toISOString(), // 3 days ago
      type: 'article',
      imageUrl: null, // Example of an article without an image
      category: 'Environment',
      content: 'Full article content here...',
      language: 'en',
      country: 'us',
      keywords: ['sustainability', 'energy', 'environment']
    }
  ];

  constructor(
    private router: Router,
    private store: Store<AppState>
  ) {
    // Initialize with mock data for immediate UI rendering.
    // The store-based data loading will replace this when available.
    this.newsItems$ = of(this.mockNewsItems); 
    this.loading$ = of(false); // Default to not loading with mock data
    this.error$ = of(null);   // Default to no error with mock data

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

  openNewsItem(item: FeedDisplayItem): void {
    if (item && item.id) {
      // Navigate to the article detail page
      this.router.navigate(['/article', item.id]);
    } else {
      console.error('Cannot open news item: item or item.id is undefined', item);
    }
  }

  refreshFeed(): void {
    console.log('Dispatching refresh feed action...');
    this.currentError = null; // Clear any existing error messages
    // this.loading$ = of(true); // Manually trigger loading for mock if needed
    this.store.dispatch(FeedActions.loadFeedStart());
    
    // For testing mock data refresh:
    // this.newsItems$ = of([]);
    // setTimeout(() => {
    //   this.newsItems$ = of(this.mockNewsItems);
    //   this.loading$ = of(false);
    // }, 1000);
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
