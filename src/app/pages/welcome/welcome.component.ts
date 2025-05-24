import { Component, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { trigger, transition, style, animate } from '@angular/animations';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators'; // Removed tap, not strictly needed here
import { FormsModule } from '@angular/forms';

// PrimeNG components
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SelectButtonModule, SelectButtonChangeEvent } from 'primeng/selectbutton';
import { DividerModule } from 'primeng/divider';

import { AppState } from '../../store';
import { LanguagePreference, selectAvailableLanguages, selectSelectedLanguage } from '../../store/reducers/preferences.reducer';
import * as PreferencesActions from '../../store/actions/preferences.actions';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CardModule,
    SelectButtonModule,
    DividerModule,
    AsyncPipe
  ],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
  animations: [
    trigger('fadeInOut', [ // Renamed for clarity if more states are added
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(15px)' }), // Slightly less Y translation
        animate('500ms cubic-bezier(0.35, 0, 0.25, 1)', style({ opacity: 1, transform: 'translateY(0)' })) // Smoother easing
      ]),
      // transition(':leave', [ // Example for fadeOut if needed
      //   animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(-15px)' }))
      // ])
    ])
  ]
})
export class WelcomeComponent implements OnInit, OnDestroy {
  // No need for availableLanguages$ if languageOptions$ is derived correctly
  selectedLanguage$: Observable<LanguagePreference | null>;
  currentSelectedLanguage: LanguagePreference | null = null;

  languageOptions$: Observable<{ label: string, value: LanguagePreference, icon?: string }[]>; // Added optional icon
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private store: Store<AppState>,
    public themeService: ThemeService // public for template access
  ) {
    // Dispatch action to load languages if they aren't loaded by default/app init
    // this.store.dispatch(PreferencesActions.loadAvailableLanguages()); // Assuming an action like this exists

    this.selectedLanguage$ = this.store.select(selectSelectedLanguage);

    this.languageOptions$ = this.store.select(selectAvailableLanguages).pipe(
      map(languages => languages.map(lang => ({ 
        label: lang.native, // e.g., "English", "Español"
        value: lang, 
        // icon: `flag flag-${lang.code.toLowerCase()}` // Example if using a flag icon library
      })))
    );
  }
  
  ngOnInit(): void {
    this.selectedLanguage$.pipe(
      takeUntil(this.destroy$) 
    ).subscribe(lang => {
      this.currentSelectedLanguage = lang;
    });
  }
  
  onLanguageChange(event: SelectButtonChangeEvent): void {
    const language = event.value as LanguagePreference | null; // event.value is the selected LanguagePreference object
    if (language) {
      this.currentSelectedLanguage = language; // Update local state
      this.store.dispatch(PreferencesActions.setLanguage({ language }));
    }
  }
  
  goToSignIn(): void {
    if (this.currentSelectedLanguage) {
      this.router.navigate(['/signin']);
    } else {
      // Optionally, provide user feedback if no language is selected,
      // though the button should be disabled.
      console.warn('No language selected. Please select a language to proceed.');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
