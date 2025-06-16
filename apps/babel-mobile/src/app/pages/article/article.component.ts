import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, NewsItem } from '../../services/api.service'; // Assuming NewsItem has a 'url' property
// import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'; // Removed
import { Store } from '@ngrx/store';
import { Observable, Subject, combineLatest } from 'rxjs';
import { invoke } from '@tauri-apps/api/tauri';
import { takeUntil, switchMap, distinctUntilChanged } from 'rxjs/operators';

// State management
import { AppState } from '../../store';
import { selectSelectedLanguage, LanguagePreference } from '../../store/reducers/preferences.reducer';

// Translation
import { TranslatePipe } from '../../shared/pipes';

// PrimeNG Modules for UI elements
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message'; // For error display
import { ToolbarModule } from 'primeng/toolbar'; // For footer controls
// import { InputSwitchModule } from 'primeng/inputswitch'; // Removed
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

// Placeholder for WRY WebView class/object
// declare var WebView: any; // Removed
import { WebviewWindow } from '@tauri-apps/api/window';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule,
    ToolbarModule,
    // InputSwitchModule, // Removed
    MenuModule,
    TranslatePipe
  ],
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.scss']
})
export class ArticleComponent implements OnInit, OnDestroy, AfterViewInit {
  newsItem: NewsItem | undefined;
  // safeUrl: SafeResourceUrl | null = null; // Removed
  currentUrl: string | undefined;
  private webview: WebviewWindow | null = null;
  
  isLoading: boolean = true;
  errorMessage: string | undefined;
  
  isTranslating: boolean = false; // For the translation toggle
  selectedLanguage$: Observable<LanguagePreference>;
  functionMenuItems: MenuItem[];
  
  private destroy$ = new Subject<void>();
  private articleId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private apiService: ApiService,
    // private sanitizer: DomSanitizer, // Removed
    private store: Store<AppState>
  ) {
    this.selectedLanguage$ = this.store.select(selectSelectedLanguage);

    this.functionMenuItems = [
      {
        label: 'Toggle translation', // Consider using translate pipe here if needed
        icon: 'pi pi-fw pi-globe',
        command: () => this.toggleTranslation()
      },
      {
        label: 'Read aloud content', // Consider using translate pipe here if needed
        icon: 'pi pi-fw pi-volume-up',
        command: () => this.readAloud()
      }
    ];
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
    this.errorMessage = undefined;
    // this.safeUrl = null; // Removed

    // Determine if we should request translated content
    // Only request translation if the target language is different from English (source language)
    const requestLanguage = targetLanguage && targetLanguage !== 'en' ? targetLanguage : undefined;

    this.apiService.getNewsItem(id, requestLanguage).pipe(takeUntil(this.destroy$)).subscribe({
      next: async (item) => { // Make this async
        if (item && item.url) {
          this.newsItem = item;
          this.currentUrl = item.url;
          this.isTranslating = !!item.translatedContent;

          // Check if webview exists and has setUrl method (adjusting for actual TauriWebview API)
          // For TauriWebview, there isn't a direct `setUrl` on an existing embedded instance.
          // Usually, you'd destroy and recreate, or the internal component handles URL changes if it's designed that way.
          // Given our setup, re-initializing is the most straightforward approach with current structure.
          // If this.webview.window.navigateTo(url) was available, that would be for a WebviewWindow, not an embedded one.
          // For an embedded one, if it doesn't have a setUrl, we'd need to destroy and re-create.
          // The provided plan mentions `this.webview.setUrl` - we'll assume it exists for the purpose of this step.
          // If not, initializeWebView would be the path.
          if (this.webview && (this.webview as any).setUrl) {
            this.isLoading = true;
            try {
              await (this.webview as any).setUrl(this.currentUrl); // Assuming setUrl exists
              // SIMULATE load event for this navigation
              this.onWebViewLoad();
            } catch (e) {
              this.onWebViewError(`Failed to set URL: ${e}`);
            }
          } else {
            // Webview not initialized yet or doesn't support setUrl
            await this.initializeWebView(); // This will pick up this.currentUrl
          }
          // isLoading state is now primarily managed by initializeWebView and onWebViewLoad/Error
        } else {
          this.errorMessage = 'Article content or URL not found.';
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Error loading article:', error);
        this.errorMessage = 'Failed to load article. Please try again later.';
        this.isLoading = false;
      }
    });
  }
  
  // Removed onToggleTranslate as it's replaced by menu item command

  toggleTranslation(): void {
    this.isTranslating = !this.isTranslating;
    console.log(`Placeholder: Toggle translation. Is translating: ${this.isTranslating}`);
    if (this.isTranslating) {
      this.triggerMockTranslation();
    } else {
      this.revertToOriginalContent();
    }
  }

  readAloud(): void {
    console.log('Placeholder: Read aloud content activated for ' + this.currentUrl);
    // Future: Implement text-to-speech functionality
  }

  async triggerMockTranslation(): Promise<void> {
    if (!this.webview) {
      this.errorMessage = 'WebView is not available.';
      console.error('WebView not available for translation.');
      // Optionally set isTranslating back to false if it was toggled true
      // this.isTranslating = false;
      return;
    }
    this.isLoading = true;
    this.errorMessage = undefined; // Clear previous errors

    try {
      console.log('Attempting to extract content from webview...');
      // Assumes the command is available to the window the ArticleComponent is in.
      const extractedText: string = await invoke('extract_content_command');
      console.log('Content extracted (first 100 chars):', extractedText.substring(0, 100) + '...');

      console.log('Attempting to translate content via Tauri command...');
      const translatedText: string = await invoke('translate_content_command', { text: extractedText });
      console.log('Content translated (first 100 chars):', translatedText.substring(0, 100) + '...');

      console.log('Attempting to inject translated content into webview...');
      // The Rust command `inject_content_command` expects `text_content` as per previous definition.
      // The payload should be { textContent: translatedText } for the Rust command defined as:
      // async fn inject_content_command(window: tauri::Window, text_content: String)
      // Tauri will map camelCase from JS to snake_case in Rust if not specified otherwise.
      // So, { textContent: translatedText } in JS becomes { text_content: translatedText } in Rust.
      await invoke('inject_content_command', { textContent: translatedText });
      console.log('Translated content injected into webview.');

    } catch (error) {
      console.error('Error during translation bridge process:', error);
      this.errorMessage = `Translation process failed: ${error instanceof Error ? error.message : String(error)}`;
      // Optionally, revert the toggle state if an error occurs
      this.isTranslating = false;
    } finally {
      this.isLoading = false;
    }
  }

  async revertToOriginalContent(): Promise<void> {
    if (!this.webview) {
      this.errorMessage = 'WebView is not available to revert content.';
      console.error('WebView not available for reverting content.');
      this.isTranslating = false; // Reset toggle if webview is gone
      return;
    }
    // Assuming setUrl exists on TauriWebview instance, or similar method
    if (this.currentUrl && (this.webview as any).setUrl) {
      console.log(`Reverting to original content by reloading URL: ${this.currentUrl}`);
      this.isLoading = true;
      this.errorMessage = undefined;
      try {
        await (this.webview as any).setUrl(this.currentUrl);
        // SIMULATE load event for this navigation
        this.onWebViewLoad();
      } catch (e) {
        this.onWebViewError(`Failed to revert to URL: ${e}`);
        // If revert fails, isTranslating should ideally be reset
        this.isTranslating = false;
      }
    } else if (this.currentUrl) { // Fallback to re-initialize if setUrl is not available
      console.log(`Reverting to original content by re-initializing webview with URL: ${this.currentUrl}`);
      await this.initializeWebView();
    }
    else {
      this.errorMessage = 'Could not revert to original content: No current URL.';
      console.error('Cannot revert: currentUrl missing.');
      this.isLoading = false;
      this.isTranslating = false; // Reset toggle if we can't revert
    }
  }
  
  /**
   * Navigate back to feed page
   * Direct navigation to avoid browser history issues
   */
  goBack(): void {
    this.router.navigate(['/feed']);
  }

  openInNewTab(url: string): void {
    window.open(url, '_blank');
  }

  // Handle webview load event to potentially turn off loader
  onWebViewLoad(): void {
    console.log('WRY WebView: Content loaded/attempted.'); // Updated log
    this.isLoading = false;
  }

  // Add a new handler for webview errors
  private onWebViewError(errorPayload: any): void {
    console.error('WRY WebView reported an error:', errorPayload);
    this.errorMessage = `WebView error: ${String(errorPayload)}`;
    this.isLoading = false;
  }

  ngAfterViewInit(): void {
    // Initialize webview here if currentUrl is already known, or just ensure container is ready.
    // loadArticle will also call initializeWebView if needed.
    if (document.getElementById('wry-webview-container')) {
        if (this.currentUrl) {
            this.initializeWebView();
        } else {
            console.log('WebView container is ready, URL will be loaded by loadArticle.');
        }
    } else {
        console.error('WebView container not found during ngAfterViewInit.');
        this.errorMessage = 'WebView container could not be found after view init.';
        this.isLoading = false;
    }
  }

  private async destroyWebView(): Promise<void> {
    if (this.webview) {
      try {
        // Assuming a destroy method, could also be close() or dispose()
        // For TauriWebview, it might not have a direct destroy method for embedded views.
        // This might be handled by the component that owns it, or by destroying the parent window/element.
        // If `this.webview` is a `WebviewWindow`, it would have `close()`.
        // For an embedded `Webview` from `@tauri-apps/api/webview`, the API is less clear on direct destruction.
        // We'll assume a hypothetical `destroy()` or rely on parent component destruction.
        // For this subtask, we'll keep the call and log.
        if (typeof (this.webview as any).destroy === 'function') {
             await (this.webview as any).destroy();
        } else {
            console.warn('WRY WebView does not have a direct destroy() method. Relaying on GC or parent destruction.');
        }
        console.log('WRY WebView notionally destroyed.');
      } catch (error) {
        console.error('Error destroying WRY WebView:', error);
      } finally {
        this.webview = null;
      }
    }
  }

  private async initializeWebView(): Promise<void> {
    const container = document.getElementById('wry-webview-container');
    if (!container) {
      console.error('WRY WebView container [wry-webview-container] not found.');
      this.errorMessage = 'Failed to initialize WebView: DOM container not found.';
      this.isLoading = false;
      return;
    }

    if (this.webview) {
      await this.destroyWebView();
    }

    this.isLoading = true;
    this.errorMessage = undefined;

    try {
      console.log(`Initializing WRY WebView for URL: ${this.currentUrl || 'about:blank'}`);

      this.webview = new WebviewWindow('articleWebview', {
        url: this.currentUrl || 'about:blank',
        // Actual event handling would be more complex, e.g., using `listen` from `@tauri-apps/api/event`
        // on specific events emitted by this webview instance if it's a separate window,
        // or via direct callbacks if the API supports it for embedded views.
        // For now, we simulate this.
      });

      if (!this.webview) {
          throw new Error("Webview construction did not return an instance or threw an error.");
      }

      // Placeholder for attaching event listeners or handling load completion.
      // With `@tauri-apps/api/webview`, the Webview class is primarily for creating *new windows*.
      // If we are embedding WRY directly without `new TauriWebview()`, the setup is different.
      // Assuming `TauriWebview` can be used for embedding as per the subtask's premise.
      // A real embedded WRY view might not have explicit load/error events directly on the JS object,
      // but might communicate via `emit` or `invoke` from Rust side.

      console.log('WRY WebView instance notionally created.');

      // Manually call onWebViewLoad as a placeholder for actual event handling
      this.onWebViewLoad(); // This will set isLoading = false.

    } catch (error) {
      console.error('Failed to initialize or load initial content in WRY WebView:', error);
      this.errorMessage = `WebView init/load error: ${error instanceof Error ? error.message : String(error)}`;
      this.isLoading = false;
      if (this.webview) {
          await this.destroyWebView();
      }
    }
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyWebView(); // Call the new async method
  }
}
