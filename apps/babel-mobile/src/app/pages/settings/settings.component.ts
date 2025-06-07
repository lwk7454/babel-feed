import { Component, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject, filter as rxjsFilter, take, map as rxjsMap, withLatestFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState } from '../../store';
import * as UserActions from '../../store/actions/user.actions';
import * as PreferencesActions from '../../store/actions/preferences.actions';
import { selectUserData, UserData, selectUserIsAuthenticated } from '../../store/reducers/user.reducer';
import { selectSelectedLanguage, selectAvailableLanguages, LanguagePreference } from '../../store/reducers/preferences.reducer';
import { ThemeService } from '../../services/theme.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../shared/pipes';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { RippleModule } from 'primeng/ripple';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    ButtonModule,
    AvatarModule,
    RippleModule,
    PanelModule,
    DividerModule,
    ToastModule,
    DropdownModule,
    FormsModule,
    TagModule,
    TranslatePipe,
    AsyncPipe
  ],
  providers: [MessageService],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  userData$: Observable<UserData | null>;
  isAuthenticated$: Observable<boolean>;
  isEmailVerified$: Observable<boolean | undefined>;
  
  // Language properties from preferences store
  availableLanguages$: Observable<LanguagePreference[]>;
  selectedLanguage$: Observable<LanguagePreference | null>;
  selectedLanguage: LanguagePreference | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private store: Store<AppState>,
    private themeService: ThemeService,
    private translationService: TranslationService,
    private messageService: MessageService
  ) {
    this.userData$ = this.store.select(selectUserData);
    this.isAuthenticated$ = this.store.select(selectUserIsAuthenticated);
    this.isEmailVerified$ = this.userData$.pipe(rxjsMap(user => user?.isEmailVerified));
    this.availableLanguages$ = this.store.select(selectAvailableLanguages);
    this.selectedLanguage$ = this.store.select(selectSelectedLanguage);
  }

  ngOnInit(): void {
    this.selectedLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(language => {
        this.selectedLanguage = language;
      });
    
    this.store.select(state => state.user.error)
      .pipe(
        takeUntil(this.destroy$),
        rxjsFilter(error => !!error)
      )
      .subscribe((error) => {
        if (error && error.includes('OTP')) {
          this.messageService.add({ 
            severity: 'error', 
            summary: this.translationService.translate('settings.otpRequestFailed'),
            detail: error,
            life: 3000 
          });
        }
      });
  }

  startEmailVerification(): void {
    this.userData$.pipe(take(1)).subscribe(user => {
      if (user && user.email) {
        this.store.dispatch(UserActions.requestEmailVerificationOtp({ email: user.email }));
        this.router.navigate(['/verify-otp'], { queryParams: { email: user.email } });
      } else {
        this.messageService.add({ 
            severity: 'error', 
            summary: this.translationService.translate('common.error'), 
            detail: this.translationService.translate('settings.userEmailNotFound') 
        });
      }
    });
  }

  /**
   * Navigate to content preferences page
   */
  navigateToContentPreferences(): void {
    this.router.navigate(['/content-preferences']);
  }

  /**
   * Navigate to model configuration page
   */
  navigateToModelConfig(): void {
    this.router.navigate(['/model-config']);
  }

  /**
   * Change app language - now uses preferences store
   */
  onLanguageChange(language: LanguagePreference): void {
    if (language && language.code !== this.selectedLanguage?.code) {
      // Dispatch to preferences store - effect will sync with translation service
      this.store.dispatch(PreferencesActions.setLanguage({ language }));
      
      this.messageService.add({
        severity: 'success',
        summary: this.translationService.translate('settings.languageChanged'),
        detail: this.translationService.translate('settings.languageChangedDesc', { language: language.native }),
        life: 3000
      });
    }
  }

  /**
   * Toggle app theme between light and dark
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
    const newTheme = this.themeService.getCurrentTheme();
    const themeKey = newTheme === 'light' ? 'settings.lightTheme' : 'settings.darkTheme';
    this.messageService.add({
      severity: 'info',
      summary: this.translationService.translate('settings.themeChanged'),
      detail: this.translationService.translate('settings.themeChangedDesc', { 
        theme: this.translationService.translate(themeKey).toLowerCase() 
      }),
      life: 2000
    });
  }

  /**
   * Get current theme label
   */
  getThemeLabel(): string {
    const themeKey = this.themeService.getCurrentTheme() === 'light' ? 'settings.lightTheme' : 'settings.darkTheme';
    return this.translationService.translate(themeKey);
  }

  /**
   * Get theme icon
   */
  getThemeIcon(): string {
    return this.themeService.getCurrentTheme() === 'light' ? 'pi pi-moon' : 'pi pi-sun';
  }

  /**
   * Show about app info
   */
  showAboutInfo(): void {
    const feature = this.translationService.translate('settings.aboutApp');
    this.messageService.add({
      severity: 'info',
      summary: this.translationService.translate('settings.comingSoon'),
      detail: this.translationService.translate('settings.comingSoonDesc', { feature }),
      life: 3000
    });
  }

  /**
   * Show privacy policy info
   */
  showPrivacyInfo(): void {
    const feature = this.translationService.translate('settings.privacyPolicy');
    this.messageService.add({
      severity: 'info',
      summary: this.translationService.translate('settings.comingSoon'),
      detail: this.translationService.translate('settings.comingSoonDesc', { feature }),
      life: 3000
    });
  }

  /**
   * Show terms of service info
   */
  showTermsInfo(): void {
    const feature = this.translationService.translate('settings.termsOfService');
    this.messageService.add({
      severity: 'info',
      summary: this.translationService.translate('settings.comingSoon'),
      detail: this.translationService.translate('settings.comingSoonDesc', { feature }),
      life: 3000
    });
  }

  /**
   * Sign out user
   */
  signOut(): void {
    this.store.dispatch(UserActions.signOutStart());
    this.messageService.add({
      severity: 'success',
      summary: this.translationService.translate('settings.signedOut'),
      detail: this.translationService.translate('settings.signedOutDesc'),
      life: 2000
    });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
