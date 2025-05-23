import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, NewsItem } from '../../services/api.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.scss']
})
export class ArticleComponent implements OnInit {
  newsItem: NewsItem | undefined;
  safeUrl: SafeResourceUrl = '';
  isTranslating: boolean = false;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private sanitizer: DomSanitizer
  ) {}
  
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadArticle(id);
    }
  }
  
  loadArticle(id: string): void {
    this.apiService.getNewsItem(id).subscribe({
      next: (item) => {
        if (item) {
          this.newsItem = item;
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(item.url);
        } else {
          this.router.navigate(['/feed']);
        }
      },
      error: (error) => {
        console.error('Error loading article', error);
        this.router.navigate(['/feed']);
      }
    });
  }
  
  toggleTranslation(): void {
    this.isTranslating = !this.isTranslating;
    
    if (this.isTranslating && this.newsItem) {
      // In a real implementation, this would call a Tauri plugin to translate the content
      console.log('Translating content from', this.newsItem.url);
      // Simulate translation in progress
      setTimeout(() => {
        console.log('Translation complete');
      }, 1500);
    }
  }
  
  goBack(): void {
    this.router.navigate(['/feed']);
  }
} 