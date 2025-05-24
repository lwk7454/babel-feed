import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessagesModule } from 'primeng/messages';
import { Message } from 'primeng/api'; // Use specific Message interface
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider'; // For visual separation

import * as UserActions from '../../store/actions/user.actions';
import { AppState } from '../../store';
import { selectUserError, selectUserIsAuthenticated, selectUserLoading } from '../../store/reducers/user.reducer';
import { ThemeService } from '../../services/theme.service'; // For theme toggle in footer

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessagesModule,
    CardModule,
    DividerModule
  ],
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.scss']
})
export class SigninComponent implements OnInit, OnDestroy {
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  isAuthenticated$: Observable<boolean>; // To potentially redirect if already authenticated
  
  messages: Message[] = []; // Use PrimeNG Message interface
  private destroy$ = new Subject<void>();

  constructor(
    private store: Store<AppState>,
    public themeService: ThemeService // Public for template access
  ) {
    this.loading$ = this.store.select(selectUserLoading);
    this.error$ = this.store.select(selectUserError);
    this.isAuthenticated$ = this.store.select(selectUserIsAuthenticated);
  }

  ngOnInit(): void {
    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => {
      if (error) {
        this.messages = [{ severity: 'error', summary: 'Sign-In Error', detail: error, closable: true }];
      } else {
        this.messages = [];
      }
    });

    // Optional: Redirect if user is already authenticated and lands on sign-in page
    // this.isAuthenticated$.pipe(
    //   filter(isAuthenticated => isAuthenticated),
    //   take(1) // Only need to check once
    // ).subscribe(() => {
    //   this.router.navigate(['/feed']); // Or to a dashboard
    // });
  }
  
  signInWithGoogle(): void {
    this.messages = []; // Clear previous messages
    this.store.dispatch(UserActions.signInStart({ provider: 'google' }));
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
