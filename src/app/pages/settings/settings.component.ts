import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState } from '../../store';
import * as UserActions from '../../store/actions/user.actions';
import { selectUserData, UserData, selectUserIsAuthenticated } from '../../store/reducers/user.reducer';
import { ThemeService } from '../../services/theme.service';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { RippleModule } from 'primeng/ripple'; // For pRipple directive on list items
import { ListboxModule } from 'primeng/listbox'; // Alternative for settings items if more complex interaction needed
import { PanelModule } from 'primeng/panel'; // For grouping sections
import { DividerModule } from 'primeng/divider';

// Define an interface for the list items
export interface SettingsActionItem {
  id: string;
  label: string;
  icon: string;
  action?: () => void; // For direct actions like toggle theme, sign out
  route?: string;     // For navigation
  dataQa?: string; // For QA automation
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    AvatarModule,
    RippleModule,
    ListboxModule,
    PanelModule,
    DividerModule
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  userData$: Observable<UserData | null>;
  isAuthenticated$: Observable<boolean>;

  accountItems: SettingsActionItem[] = [];
  appearanceItems: SettingsActionItem[] = [];
  informationItems: SettingsActionItem[] = [];
  
  private destroy$ = new Subject<void>();
  private themeSubscription: Subscription | undefined;


  constructor(
    private router: Router,
    private store: Store<AppState>,
    public themeService: ThemeService
  ) {
    this.userData$ = this.store.select(selectUserData);
    this.isAuthenticated$ = this.store.select(selectUserIsAuthenticated);
  }

  ngOnInit(): void {
    this.updateAppearanceItems(); // Initial setup for theme-dependent icons

    // Subscribe to theme changes to update icon dynamically
    this.themeSubscription = this.themeService.themeChanged$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateAppearanceItems();
    });

    this.accountItems = [
      { 
        id: 'profile', 
        label: 'Profile', 
        icon: 'pi pi-user', 
        action: () => this.navigateTo('/user-profile'), // Example: Navigate to a profile page
        dataQa: 'profile-link' 
      },
      // Add other account-related items here if needed
    ];

    this.informationItems = [
      { id: 'about', label: 'About Babel Feed', icon: 'pi pi-info-circle', action: () => this.showInfo('about'), dataQa: 'about-link' },
      { id: 'privacy', label: 'Privacy Policy', icon: 'pi pi-shield', action: () => this.showInfo('privacy'), dataQa: 'privacy-link' },
      { id: 'terms', label: 'Terms of Service', icon: 'pi pi-book', action: () => this.showInfo('terms'), dataQa: 'terms-link' }
    ];
  }
  
  private updateAppearanceItems(): void {
    this.appearanceItems = [
      { 
        id: 'content-preferences', 
        label: 'Content Preferences', 
        icon: 'pi pi-sliders-h', 
        action: () => this.navigateTo('/settings/content-preferences'), 
        dataQa: 'content-preferences-link' 
      },
      { 
        id: 'theme-toggle', 
        label: `Theme: ${this.themeService.getCurrentTheme() === 'light' ? 'Light' : 'Dark'}`, 
        icon: this.themeService.getCurrentTheme() === 'light' ? 'pi pi-moon' : 'pi pi-sun', 
        action: () => this.toggleTheme(), 
        dataQa: 'theme-toggle-button' 
      },
      // { id: 'language', label: 'Language', icon: 'pi pi-language', action: () => this.navigateTo('/settings/language'), dataQa: 'language-link' },
    ];
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
    // The subscription to themeChanged$ will automatically update the items
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
  
  handleItemClick(item: SettingsActionItem): void {
    if (item.action) {
      item.action();
    } else if (item.route) {
      this.navigateTo(item.route);
    }
  }

  showInfo(pageType: string): void {
    // Placeholder for showing info pages (e.g., in a modal or navigating to a dedicated route)
    alert(`Placeholder: Displaying information for '${pageType}'.`);
    // Example: this.router.navigate(['/info', pageType]);
  }

  signOut(): void {
    this.store.dispatch(UserActions.signOutStart());
    // Navigation to welcome page or sign-in page is typically handled by effects after sign-out completes
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }
}
