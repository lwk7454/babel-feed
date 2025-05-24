import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // Added DatePipe
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, NewsItem } from '../../services/api.service'; // Assuming NewsItem structure
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, catchError, tap } from 'rxjs/operators'; // Added more operators

// PrimeNG Modules
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message'; // For displaying messages
import { CardModule } from 'primeng/card'; // For styling search results
import { RippleModule } from 'primeng/ripple';


@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    InputTextModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule,
    CardModule,
    RippleModule,
    DatePipe // Added DatePipe
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit, OnDestroy {
  searchQuery: string = '';
  results: NewsItem[] = [];
  isLoading: boolean = false;
  hasSearched: boolean = false;
  errorMessage: string | null = null;

  private searchQuery$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.searchQuery$.pipe(
      debounceTime(300), // Wait for 300ms pause in events
      distinctUntilChanged(), // Only emit if value has changed
      tap(() => { // Side effect for loading state
        if(this.searchQuery.trim()){
          this.isLoading = true;
          this.hasSearched = true;
          this.results = [];
          this.errorMessage = null;
        } else {
          this.isLoading = false;
          this.hasSearched = false;
          this.results = [];
          this.errorMessage = null;
        }
      }),
      switchMap(query => {
        if (!query.trim()) {
          return []; // Return empty array if query is empty, preventing API call
        }
        return this.apiService.searchNews(query).pipe(
          catchError(error => {
            console.error('Error searching news:', error);
            this.errorMessage = 'An error occurred while searching. Please try again.';
            return []; // Return empty array on error
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(items => {
      this.isLoading = false;
      this.results = items;
      if (this.hasSearched && items.length === 0 && !this.errorMessage && this.searchQuery.trim()) {
        // This condition might be redundant if errorMessage is set for no results by API
        // this.errorMessage = 'No results found. Try a different search term.';
      }
    });
  }
  
  onSearchQueryChange(query: string): void {
    this.searchQuery$.next(query);
  }

  // performSearch can be triggered by a button click or explicitly if needed
  performSearch(): void {
    if (this.searchQuery.trim()) {
      this.searchQuery$.next(this.searchQuery); // Push current query to trigger search
    } else {
      // Clear results if query is empty
      this.results = [];
      this.hasSearched = false;
      this.isLoading = false;
      this.errorMessage = null;
    }
  }
  
  openNewsItem(item: NewsItem): void {
    this.router.navigate(['/article', item.id]);
  }
  
  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/feed']); // Default fallback
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
