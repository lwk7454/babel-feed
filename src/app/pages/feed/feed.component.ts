import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, NewsItem } from '../../services/api.service';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss']
})
export class FeedComponent implements OnInit {
  newsItems: NewsItem[] = [];
  loading: boolean = true;
  
  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}
  
  ngOnInit(): void {
    this.loadNewsFeed();
  }
  
  loadNewsFeed(): void {
    this.loading = true;
    this.apiService.getNewsFeed().subscribe({
      next: (items) => {
        this.newsItems = items;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading news feed', error);
        this.loading = false;
      }
    });
  }
  
  openNewsItem(item: NewsItem): void {
    this.router.navigate(['/article', item.id]);
  }
  
  refreshFeed(): void {
    this.loadNewsFeed();
  }
  
  navigateToSearch(): void {
    this.router.navigate(['/search']);
  }
  
  navigateToSettings(): void {
    this.router.navigate(['/settings']);
  }
} 