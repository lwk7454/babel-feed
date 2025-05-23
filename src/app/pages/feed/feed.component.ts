import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState } from '../../store';
import { NewsItem } from '../../services/api.service';
import * as FeedActions from '../../store/actions/feed.actions';
import { selectFeedItems, selectFeedLoading, selectFeedError } from '../../store/reducers/feed.reducer';

// PrimeNG Modules
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessagesModule } from 'primeng/messages';
// import { Message } from 'primeng/api'; // Temporarily remove for linter
import { DataViewModule } from 'primeng/dataview'; // DataViewLayoutOptions removed if not critically used or causing issues
import { TagModule } from 'primeng/tag';
import { RippleModule } from 'primeng/ripple';
import { SkeletonModule } from 'primeng/skeleton'; // For loading state

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessagesModule,
    DataViewModule,
    TagModule,
    RippleModule,
    SkeletonModule
  ],
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss']
})
export class FeedComponent implements OnInit, OnDestroy {
  newsItems$: Observable<NewsItem[]>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  
  errorMessages: any[] = []; // Using any[] for messages due to linter issues
  private destroy$ = new Subject<void>();

  layout: 'list' | 'grid' = 'list'; // Default layout for DataView
  // sortOrder and sortField can be added if sorting controls are implemented

  constructor(
    private router: Router,
    private store: Store<AppState>
  ) {
    this.newsItems$ = this.store.select(selectFeedItems);
    this.loading$ = this.store.select(selectFeedLoading);
    this.error$ = this.store.select(selectFeedError);
  }

  ngOnInit(): void {
    this.store.dispatch(FeedActions.loadFeedStart());

    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => {
      if (error) {
        this.errorMessages = [{ severity: 'error', summary: 'Error Loading Feed', detail: error, life: 5000 }];
      } else {
        this.errorMessages = [];
      }
    });
  }

  openNewsItem(item: NewsItem): void {
    this.router.navigate(['/article', item.id]);
  }

  refreshFeed(): void {
    this.errorMessages = [];
    this.store.dispatch(FeedActions.loadFeedStart());
  }
  
  getArticleTagSeverity(itemType: 'article' | 'video'): string {
    switch (itemType) {
        case 'article':
            return 'info';
        case 'video':
            return 'warning';
        default:
            return 'contrast'; // PrimeNG contrast severity
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
} 