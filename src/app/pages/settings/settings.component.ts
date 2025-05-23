import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import { AppState } from '../../store';
import * as UserActions from '../../store/actions/user.actions';
import { selectUserData, UserData, selectUserIsAuthenticated } from '../../store/reducers/user.reducer';
import { ThemeService } from '../../services/theme.service';

// PrimeNG Modules
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';
import { RippleModule } from 'primeng/ripple';
import { StyleClassModule } from 'primeng/styleclass'; // For pStyleClass directive

// Define an interface for the list items
export interface SettingsListItem {
  label: string;
  icon: string;
  command: () => void;
  // Optional: Add other properties if they exist or might be added
  // e.g., routeLink?: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    DividerModule,
    AvatarModule,
    RippleModule,
    StyleClassModule
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  userData$: Observable<UserData | null>;
  isAuthenticated$: Observable<boolean>;

  settingsItems: SettingsListItem[];
  infoItems: SettingsListItem[];

  constructor(
    private router: Router,
    private store: Store<AppState>,
    public themeService: ThemeService // Public for template access
  ) {
    this.userData$ = this.store.select(selectUserData);
    this.isAuthenticated$ = this.store.select(selectUserIsAuthenticated);

    this.settingsItems = [
      // { label: 'Language Settings', icon: 'pi pi-language', command: () => this.navigateToLanguageSettings() }, // Revisit based on exact need
      { label: 'Content Preferences', icon: 'pi pi-sliders-h', command: () => this.navigateToContentPreferences() },
      { label: 'Display', icon: this.themeService.getCurrentTheme() === 'light' ? 'pi pi-moon' : 'pi pi-sun', command: () => this.toggleThemeAndUpdateIcon() }
    ];

    this.infoItems = [
      { label: 'About Babel Feed', icon: 'pi pi-info-circle', command: () => this.navigateToInfoPage('about') },
      { label: 'Privacy Policy', icon: 'pi pi-shield', command: () => this.navigateToInfoPage('privacy') },
      { label: 'Terms of Service', icon: 'pi pi-book', command: () => this.navigateToInfoPage('terms') }
    ];
  }

  ngOnInit(): void {}

  toggleThemeAndUpdateIcon(): void {
    this.themeService.toggleTheme();
    const displayItem = this.settingsItems.find(item => item.label === 'Display');
    if (displayItem) {
      displayItem.icon = this.themeService.getCurrentTheme() === 'light' ? 'pi pi-moon' : 'pi pi-sun';
    }
  }

  navigateToContentPreferences(): void {
    this.router.navigate(['/settings/content-preferences']);
  }
  
  // navigateToLanguageSettings(): void {
  //   alert('Language Settings page/modal would appear here');
  // }

  navigateToInfoPage(page: string): void {
    // Placeholder: These would navigate to actual info pages or open external links
    alert(`${page} page would appear here or an external link would be opened.`);
    // Example: if using @tauri-apps/api/opener
    // import { open } from '@tauri-apps/plugin-opener';
    // await open('https://example.com/privacy');
  }

  signOut(): void {
    this.store.dispatch(UserActions.signOutStart());
    // Navigation to /welcome is handled by UserEffects
  }
} 