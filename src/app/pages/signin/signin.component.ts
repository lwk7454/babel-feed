import { Component, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessagesModule } from 'primeng/messages';

import * as UserActions from '../../store/actions/user.actions';
import { AppState } from '../../store';
import { selectUserError, selectUserIsAuthenticated, selectUserLoading } from '../../store/reducers/user.reducer';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessagesModule,
    AsyncPipe
  ],
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.scss']
})
export class SigninComponent implements OnInit, OnDestroy {
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  isAuthenticated$: Observable<boolean>;
  
  messages: any[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    public themeService: ThemeService
  ) {
    this.loading$ = this.store.select(selectUserLoading);
    this.error$ = this.store.select(selectUserError);
    this.isAuthenticated$ = this.store.select(selectUserIsAuthenticated);
  }

  ngOnInit(): void {
    // Subscribe to errors and show them as messages
    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => {
      if (error) {
        this.messages = [{ 
          severity: 'error', 
          summary: 'Sign-In Error', 
          detail: error, 
          closable: true 
        }];
      } else {
        this.messages = [];
      }
    });
  }
  
  signInWithGoogle(): void {
    // Clear any previous error messages
    this.messages = [];
    this.store.dispatch(UserActions.signInStart({ provider: 'google' }));
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
