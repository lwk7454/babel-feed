import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { trigger, transition, style, animate } from '@angular/animations';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
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
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    SelectButtonModule,
    DividerModule
  ],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('500ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class WelcomeComponent implements OnInit {
  availableLanguages$: Observable<LanguagePreference[]>;
  selectedLanguage$: Observable<LanguagePreference | null>;
  currentSelectedLanguage: LanguagePreference | null = null;

  languageOptions$: Observable<{ label: string, value: LanguagePreference }[]>;
  
  constructor(
    private router: Router,
    private store: Store<AppState>,
    public themeService: ThemeService
  ) {
    this.availableLanguages$ = this.store.select(selectAvailableLanguages);
    this.selectedLanguage$ = this.store.select(selectSelectedLanguage);

    this.languageOptions$ = this.availableLanguages$.pipe(
      map(languages => languages.map(lang => ({ label: lang.native, value: lang })))
    );
  }
  
  ngOnInit(): void {
    this.selectedLanguage$.pipe(
      tap(lang => {
        this.currentSelectedLanguage = lang;
      })
    ).subscribe();
  }
  
  onLanguageChange(event: SelectButtonChangeEvent): void {
    const language = event.value as LanguagePreference | null;
    if (language) {
      this.currentSelectedLanguage = language;
      this.store.dispatch(PreferencesActions.setLanguage({ language }));
    }
  }
  
  goToSignIn(): void {
    if (this.currentSelectedLanguage) {
      this.router.navigate(['/signin']);
    } else {
      console.warn('No language selected. Please select a language to continue.');
    }
  }
} 