import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, NewsItem } from '../../services/api.service';

@Component({
    selector: 'app-search',
    imports: [CommonModule, FormsModule],
    templateUrl: './search.component.html',
    styleUrls: ['./search.component.scss']
})
export class SearchComponent {
  searchQuery: string = '';
  results: NewsItem[] = [];
  hasSearched: boolean = false;
  
  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}
  
  performSearch(): void {
    if (!this.searchQuery.trim()) return;
    
    this.apiService.searchNews(this.searchQuery).subscribe({
      next: (items) => {
        this.results = items;
        this.hasSearched = true;
      },
      error: (error) => {
        console.error('Error searching news', error);
        this.hasSearched = true;
      }
    });
  }
  
  openNewsItem(item: NewsItem): void {
    this.router.navigate(['/article', item.id]);
  }
  
  goBack(): void {
    this.router.navigate(['/feed']);
  }
} 