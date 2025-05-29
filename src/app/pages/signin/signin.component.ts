import { Component, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessagesModule } from 'primeng/messages';
import { InputTextModule } from 'primeng/inputtext';

import * as UserActions from '../../store/actions/user.actions';
import { AppState } from '../../store';
import { selectUserError, selectUserIsAuthenticated, selectUserLoading } from '../../store/reducers/user.reducer';
import { ThemeService } from '../../services/theme.service';
import { NavigationService } from '../../services/navigation.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../shared/pipes';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessagesModule,
    InputTextModule,
    AsyncPipe,
    TranslatePipe
  ],
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.scss']
})
export class SigninComponent implements OnInit, OnDestroy {
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  isAuthenticated$: Observable<boolean>;
  signInForm: FormGroup;
  
  messages: any[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    public themeService: ThemeService,
    private navigationService: NavigationService,
    private fb: FormBuilder,
    private translationService: TranslationService
  ) {
    this.loading$ = this.store.select(selectUserLoading);
    this.error$ = this.store.select(selectUserError);
    this.isAuthenticated$ = this.store.select(selectUserIsAuthenticated);

    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => {
      if (error) {
        this.messages = [{ 
          severity: 'error', 
          summary: this.translationService.translate('auth.errorSignInTitle'), 
          detail: error,
          closable: true 
        }];
      } else {
        this.messages = [];
      }
    });
  }
  
  signInWithEmail(): void {
    if (this.signInForm.invalid) {
      this.messages = [{ 
        severity: 'warn', 
        summary: this.translationService.translate('auth.errorInvalidInputTitle'), 
        detail: this.translationService.translate('auth.errorInvalidEmail'), 
        closable: true 
      }];
      return;
    }
    this.messages = [];
    const email = this.signInForm.value.email;
    this.store.dispatch(UserActions.signInStart({ email }));
  }

  /**
   * Dev-only method to skip login and simulate successful authentication
   * This directly dispatches a sign-in success action with mock user data
   */
  skipLoginForDev(): void {
    console.log('🚀 Dev Skip: Simulating successful login with mock user data');
    
    // Clear any previous error messages
    this.messages = [];
    
    // Mock user data that matches the UserData interface
    const mockUserData = {
      id: 'dev-user-123',
      email: 'dev.user@babelfeed.com',
      displayName: 'Dev User',
      photoURL: 'https://via.placeholder.com/150/22c55e/ffffff?text=DEV',
      provider: 'dev-skip'
    };

    // Dispatch success action directly with mock data
    this.store.dispatch(UserActions.signInSuccess({ userData: mockUserData }));
  }

  // Example for other providers (Apple, etc.) if they were to be implemented
  // signInWithApple(): void {
  //   this.messages = [];
  //   this.store.dispatch(UserActions.signInStart({ provider: 'apple' }));
  // }

  /**
   * Navigate back to welcome page
   */
  goBack(): void {
    this.navigationService.goBack();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
