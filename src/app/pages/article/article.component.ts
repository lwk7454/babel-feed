import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, NewsItem } from '../../services/api.service'; // Assuming NewsItem has a 'url' property
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import { takeUntil, switchMap, distinctUntilChanged } from 'rxjs/operators';

// State management
import { AppState } from '../../store';
import { selectSelectedLanguage, LanguagePreference } from '../../store/reducers/preferences.reducer';

// PrimeNG Modules for UI elements
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message'; // For error display
import { ToolbarModule } from 'primeng/toolbar'; // For footer controls
import { InputSwitchModule } from 'primeng/inputswitch'; // For translate toggle

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule,
    ToolbarModule,
    InputSwitchModule
  ],
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.scss']
})
export class ArticleComponent implements OnInit, OnDestroy {
  newsItem: NewsItem | undefined;
  safeUrl: SafeResourceUrl | null = null; // Initialize as null
  currentUrl: string = ''; // For displaying the source URL
  
  isLoading: boolean = true;
  errorMessage: string | null = null;
  
  isTranslating: boolean = false; // For the translation toggle
  selectedLanguage$: Observable<LanguagePreference>;
  
  private destroy$ = new Subject<void>();
  private articleId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private sanitizer: DomSanitizer,
    private store: Store<AppState>
  ) {
    this.selectedLanguage$ = this.store.select(selectSelectedLanguage);
  }
  
  ngOnInit(): void {
    this.articleId = this.route.snapshot.paramMap.get('id');
    if (this.articleId) {
      // Combine route params and user language preference to load article
      combineLatest([
        this.route.paramMap,
        this.selectedLanguage$
      ]).pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      ).subscribe(([paramMap, language]) => {
        const id = paramMap.get('id');
        if (id) {
          this.loadArticle(id, language?.code);
        }
      });
    } else {
      this.isLoading = false;
      this.errorMessage = 'Article ID not found.';
    }
  }
  
  loadArticle(id: string, targetLanguage?: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.safeUrl = null;

    // Determine if we should request translated content
    // Only request translation if the target language is different from English (source language)
    const requestLanguage = targetLanguage && targetLanguage !== 'en' ? targetLanguage : undefined;

    this.apiService.getNewsItem(id, requestLanguage).pipe(takeUntil(this.destroy$)).subscribe({
      next: (item) => {
        if (item && item.url) {
          this.newsItem = item;
          this.currentUrl = item.url; // Store the original URL for display
          
          // Auto-enable translation toggle if we have translated content
          this.isTranslating = !!item.translatedContent;
          
          // For now, we assume any URL can be iframed. In reality, X-Frame-Options might prevent this.
          // A backend service might be needed to proxy or fetch content if direct iframe is blocked.
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(item.url);
        } else {
          this.errorMessage = 'Article content or URL not found.';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading article:', error);
        this.errorMessage = 'Failed to load article. Please try again later.';
        this.isLoading = false;
      }
    });
  }
  
  // Placeholder for translation toggle action
  onToggleTranslate(event: any): void { // 'event' might be from PrimeNG InputSwitch (checked: boolean)
    this.isTranslating = event.checked; // Assuming PrimeNG InputSwitch event
    
    if (this.isTranslating && this.newsItem) {
      console.log(`Placeholder: Translation activated for ${this.currentUrl}`);
      // Show translated content if available
      if (this.newsItem.translatedContent) {
        console.log(`Showing translated content in ${this.newsItem.translatedContent.targetLanguage}`);
      }
      // Future: Call Tauri plugin or translation service
      // Simulate translation process
      // alert(`Simulating translation for: ${this.currentUrl}`);
    } else {
      console.log(`Placeholder: Translation deactivated for ${this.currentUrl}`);
      // Show original content
      console.log('Showing original content');
      // Future: Revert to original content if translation was done client-side
      // alert(`Simulating reversion to original for: ${this.currentUrl}`);
    }
  }
  
  goBack(): void {
    if (window.history.length > 1) {
      window.history.back(); // Use browser history if available
    } else {
      this.router.navigate(['/feed']); // Fallback to feed
    }
  }

  openInNewTab(url: string): void {
    window.open(url, '_blank');
  }

  // Handle iframe load event to potentially turn off loader
  onIframeLoad(): void {
    // Note: This event might fire even if the content is an error page from the source server (e.g. 404)
    // It signifies the iframe itself has loaded *something*
    // this.isLoading = false; // Be cautious with this, might already be false from API call.
    console.log('Iframe content loaded/attempted.');
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
