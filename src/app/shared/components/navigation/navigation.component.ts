import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { AppState } from '../../../store';
import * as UserActions from '../../../store/actions/user.actions';
import { selectUserData, UserData } from '../../../store/reducers/user.reducer';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    RippleModule,
    AsyncPipe
  ],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss']
})
export class NavigationComponent implements OnInit, OnDestroy {
  @Input() showSearch = true; // Allow parent to control search button visibility
  @Input() showRefresh = false; // Allow parent to control refresh button visibility
  @Input() onRefresh?: () => void; // Optional refresh callback
  @Input() onSearch?: () => void; // Optional search callback
  
  userData$: Observable<UserData | null>;
  
  // Navigation menu state
  isMenuOpen = false;
  currentRoute = '/feed';
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private store: Store<AppState>
  ) {
    this.userData$ = this.store.select(selectUserData);
  }

  ngOnInit(): void {
    // Track current route for menu highlighting
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.urlAfterRedirects;
    });

    // Set initial route
    this.currentRoute = this.router.url;
  }

  /**
   * Toggle the navigation menu open/closed
   */
  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  /**
   * Close the navigation menu
   */
  closeMenu(): void {
    this.isMenuOpen = false;
  }

  /**
   * Navigate to search page or call custom search handler
   */
  openSearch(): void {
    if (this.onSearch) {
      this.onSearch();
    } else {
      this.router.navigate(['/search']);
    }
  }

  /**
   * Call refresh handler if provided
   */
  handleRefresh(): void {
    if (this.onRefresh) {
      this.onRefresh();
    }
  }

  /**
   * Navigate to a specific route and close menu
   */
  navigateTo(route: string): void {
    this.closeMenu();
    this.router.navigate([route]);
  }

  /**
   * Sign out the user
   */
  signOut(): void {
    this.closeMenu();
    this.store.dispatch(UserActions.signOutStart());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
} 