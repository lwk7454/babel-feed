import { Component, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { trigger, transition, style, animate } from '@angular/animations';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

// PrimeNG components
import { ButtonModule } from 'primeng/button';

import { AppState } from '../../store';
import { LanguagePreference, selectAvailableLanguages, selectSelectedLanguage } from '../../store/reducers/preferences.reducer';
import * as PreferencesActions from '../../store/actions/preferences.actions';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    AsyncPipe
  ],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(15px)' }),
        animate('500ms cubic-bezier(0.35, 0, 0.25, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class WelcomeComponent implements OnInit, OnDestroy {
  selectedLanguage$: Observable<LanguagePreference | null>;
  currentSelectedLanguage: LanguagePreference | null = null;
  languageOptions$: Observable<{ label: string, value: LanguagePreference }[]>;
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private store: Store<AppState>,
    public themeService: ThemeService
  ) {
    this.selectedLanguage$ = this.store.select(selectSelectedLanguage);

    this.languageOptions$ = this.store.select(selectAvailableLanguages).pipe(
      map(languages => languages.map(lang => ({ 
        label: lang.native,
        value: lang
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
  
  onLanguageSelect(language: LanguagePreference): void {
    this.currentSelectedLanguage = language;
    this.store.dispatch(PreferencesActions.setLanguage({ language }));
  }
  
  goToSignIn(): void {
    console.log('Attempting to navigate to signin...');
    if (this.currentSelectedLanguage) {
      console.log('Language selected, proceeding with navigation.');
      this.router.navigate(['/signin']);
    } else {
      console.warn('No language selected. Please select a language to proceed.');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
