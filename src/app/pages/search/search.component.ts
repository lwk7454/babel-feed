import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Subject, Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';

import { ApiService, NewsItem } from '../../services/api.service';
import { TranslatePipe } from '../../shared/pipes';

// PrimeNG Modules
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule,
    CardModule,
    RippleModule,
    DatePipe,
    TranslatePipe
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  searchQuery: string = '';
  searchResults: NewsItem[] = [];
  isLoading: boolean = false;
  errorMessage: string | undefined;
  hasSearched: boolean = false;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private router: Router,
    private location: Location,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    // Set up reactive search with debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.trim()) {
          this.isLoading = true;
          this.errorMessage = undefined;
          return this.apiService.searchNews(query);
        } else {
          return of([]);
        }
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.isLoading = false;
        this.hasSearched = true;
      },
      error: (error) => {
        console.error('Search error:', error);
        this.errorMessage = 'Search failed. Please try again.';
        this.isLoading = false;
        this.hasSearched = true;
      }
    });
  }

  onSearchQueryChange(query: string): void {
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  performSearch(): void {
    if (this.searchQuery.trim()) {
      this.searchSubject.next(this.searchQuery);
    }
  }

  openNewsItem(item: NewsItem): void {
    if (item && item.id) {
      this.router.navigate(['/article', item.id]);
    }
  }

  /**
   * Navigate back to feed page
   * Direct navigation to avoid browser history issues
   */
  goBack(): void {
    this.router.navigate(['/feed']);
  }

  // Helper method for tracking items in *ngFor
  trackById(index: number, item: NewsItem): string {
    return item.id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
