import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessagesModule } from 'primeng/messages';
// import { Message } from 'primeng/api'; // Temporarily commented out due to persistent import issues
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';

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
    CardModule,
    DividerModule
  ],
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.scss']
})
export class SigninComponent implements OnInit {
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  isAuthenticated$: Observable<boolean>;
  
  messages: any[] = []; // Temporarily reverting to any[]

  constructor(
    private store: Store<AppState>,
    public themeService: ThemeService
  ) {
    this.loading$ = this.store.select(selectUserLoading);
    this.error$ = this.store.select(selectUserError);
    this.isAuthenticated$ = this.store.select(selectUserIsAuthenticated);
  }

  ngOnInit(): void {
    this.error$.subscribe(error => {
      if (error) {
        this.messages = [{ severity: 'error', summary: 'Error', detail: error }];
      } else {
        this.messages = [];
      }
    });
  }
  
  signInWithGoogle(): void {
    this.messages = [];
    this.store.dispatch(UserActions.signInStart({ provider: 'google' }));
  }

  // Placeholder for other providers if they were to be implemented
  // signIn(provider: string): void {
  //   this.messages = [];
  //   this.store.dispatch(UserActions.signInStart({ provider }));
  // }
} 