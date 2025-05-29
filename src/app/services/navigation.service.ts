import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * NavigationService provides centralized navigation management
 * with proper back navigation using browser history stack
 * and special handling for root page management after login
 */
@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private navigationHistory: string[] = [];
  private readonly maxHistorySize = 10;
  private isPostLogin = false; // Track if user is past login
  private readonly FEED_ROUTE = '/feed';
  private readonly WELCOME_ROUTE = '/welcome';
  private readonly SIGNIN_ROUTE = '/signin';

  constructor(
    private location: Location,
    private router: Router
  ) {
    // Track navigation history for advanced use cases
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.addToHistory(event.urlAfterRedirects);
      
      // Track if user has reached feed (post-login state)
      if (event.urlAfterRedirects === this.FEED_ROUTE) {
        this.setFeedAsRoot();
      }
    });
  }

  /**
   * Navigate back using browser history - pops the navigation stack
   * This is the preferred method for back navigation
   * Special handling for feed page (exits app) and sign-in page (goes to welcome)
   */
  goBack(): void {
    const currentRoute = this.getCurrentRoute();
    
    // Special case: Sign-in page should go back to welcome
    if (currentRoute === this.SIGNIN_ROUTE) {
      this.navigateTo(this.WELCOME_ROUTE);
      return;
    }
    
    // Special case: Feed page after login should exit app (for mobile)
    if (currentRoute === this.FEED_ROUTE && this.isPostLogin) {
      this.exitApp();
      return;
    }
    
    // Normal back navigation
    this.location.back();
  }

  /**
   * Navigate to a specific route
   */
  navigateTo(route: string | string[], extras?: any): void {
    if (Array.isArray(route)) {
      this.router.navigate(route, extras);
    } else {
      this.router.navigate([route], extras);
    }
  }

  /**
   * Set feed as the root page after successful login
   * This ensures users cannot navigate back past the feed page
   */
  setFeedAsRoot(): void {
    this.isPostLogin = true;
    
    // Clear history and make feed the only entry
    this.clearHistory();
    this.navigationHistory = [this.FEED_ROUTE];
    
    // Replace current history state to prevent going back past feed
    history.replaceState(null, '', this.FEED_ROUTE);
  }

  /**
   * Reset to pre-login state (called during sign out)
   */
  resetToPreLogin(): void {
    this.isPostLogin = false;
    this.clearHistory();
  }

  /**
   * Navigate back with fallback route if history is empty
   * Use this only when you need a guaranteed fallback
   */
  goBackWithFallback(fallbackRoute: string = '/feed'): void {
    const currentRoute = this.getCurrentRoute();
    
    // Apply special navigation rules first
    if (currentRoute === this.SIGNIN_ROUTE) {
      this.navigateTo(this.WELCOME_ROUTE);
      return;
    }
    
    if (currentRoute === this.FEED_ROUTE && this.isPostLogin) {
      this.exitApp();
      return;
    }
    
    // Normal fallback logic
    if (this.canGoBack()) {
      this.location.back();
    } else {
      this.navigateTo(fallbackRoute);
    }
  }

  /**
   * Check if browser can go back in history
   * Returns false for feed page when in post-login state
   */
  canGoBack(): boolean {
    const currentRoute = this.getCurrentRoute();
    
    // Feed page in post-login state cannot go back
    if (currentRoute === this.FEED_ROUTE && this.isPostLogin) {
      return false;
    }
    
    return window.history.length > 1;
  }

  /**
   * Exit the application (for mobile/Tauri environment)
   */
  private exitApp(): void {
    // Check if we're in a Tauri environment
    if (window && (window as any).__TAURI__) {
      // Use Tauri's exit API
      import('@tauri-apps/api/process').then(({ exit }) => {
        exit(0);
      }).catch(() => {
        // Fallback for older Tauri versions or if import fails
        this.fallbackExit();
      });
    } else {
      this.fallbackExit();
    }
  }

  /**
   * Fallback exit method for non-Tauri environments
   */
  private fallbackExit(): void {
    // For web environments, we can't actually exit the app
    // So we navigate to a special exit page or show a message
    console.log('App exit requested - in web environment, cannot actually exit');
    
    // Option 1: Close the window (may not work due to browser restrictions)
    try {
      window.close();
    } catch (e) {
      // Option 2: Navigate away or show exit message
      console.log('Cannot close window, showing exit message');
      // Could show a toast or modal saying "Press device back button to exit"
      alert('Press your device\'s back button to exit the app');
    }
  }

  /**
   * Check if user is in post-login state
   */
  isPostLoginState(): boolean {
    return this.isPostLogin;
  }

  /**
   * Get the previous route from our tracked history
   * Useful for advanced navigation logic
   */
  getPreviousRoute(): string | null {
    return this.navigationHistory.length > 1 
      ? this.navigationHistory[this.navigationHistory.length - 2] 
      : null;
  }

  /**
   * Get current route
   */
  getCurrentRoute(): string {
    return this.router.url;
  }

  /**
   * Clear navigation history
   */
  clearHistory(): void {
    this.navigationHistory = [];
  }

  /**
   * Add route to internal history tracking
   */
  private addToHistory(url: string): void {
    // Remove the current URL if it's already the last entry (avoid duplicates on refresh)
    if (this.navigationHistory[this.navigationHistory.length - 1] === url) {
      return;
    }

    // If we're in post-login state and trying to add feed again, don't duplicate
    if (this.isPostLogin && url === this.FEED_ROUTE && 
        this.navigationHistory.includes(this.FEED_ROUTE)) {
      return;
    }

    this.navigationHistory.push(url);

    // Keep history size manageable
    if (this.navigationHistory.length > this.maxHistorySize) {
      this.navigationHistory = this.navigationHistory.slice(-this.maxHistorySize);
    }
  }
} 