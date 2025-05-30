import { Component, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe, CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';

import { AppState } from '../../store';
import * as UserActions from '../../store/actions/user.actions';
import { selectUserLoading, selectUserError, selectUserData } from '../../store/reducers/user.reducer';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../shared/pipes';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessagesModule } from 'primeng/messages';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    MessagesModule,
    ProgressSpinnerModule,
    AsyncPipe,
    TranslatePipe
  ],
  templateUrl: './verify-otp.component.html',
  // styleUrls: ['./verify-otp.component.scss'] // Add SCSS file if needed
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  otpForm: FormGroup;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  messages: any[] = [];
  emailToVerify: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private store: Store<AppState>,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private location: Location,
    private translationService: TranslationService
  ) {
    this.loading$ = this.store.select(selectUserLoading);
    this.error$ = this.store.select(selectUserError);
    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(4), Validators.pattern(/^[0-9]+$/)]]
    });
  }

  ngOnInit(): void {
    this.activatedRoute.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.emailToVerify = params.get('email');
      if (!this.emailToVerify) {
        // Optional: redirect if email is missing, though settings should ensure it
        console.warn('Email not provided for OTP verification, redirecting to settings.');
        this.router.navigate(['/settings']);
      }
    });

    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => {
      if (error) {
        this.messages = [{ 
          severity: 'error', 
          summary: this.translationService.translate('otp.errorVerificationTitle'), 
          detail: error, // Error detail from backend/effect or a generic translated one
          closable: true 
        }];
      } else {
        // Do not clear messages here if success message is also set through this.messages
        // this.messages = []; 
      }
    });

    // Listen for successful OTP verification to navigate back
    this.store.select(selectUserData).pipe(takeUntil(this.destroy$)).subscribe(userData => {
        if (userData?.email === this.emailToVerify && userData?.isEmailVerified) {
            this.messages = [{ 
                severity: 'success', 
                summary: this.translationService.translate('common.success'), 
                detail: this.translationService.translate('otp.successMessage'), 
                life: 2000 
            }];
            setTimeout(() => this.router.navigate(['/settings']), 2000);
        }
    });
  }

  onVerifyOtp(): void {
    if (this.otpForm.invalid || !this.emailToVerify) {
      this.messages = [{ 
        severity: 'warn', 
        summary: this.translationService.translate('auth.errorInvalidInputTitle'), 
        detail: this.translationService.translate('otp.errorInvalidOtp'), 
        closable: true 
      }];
      return;
    }
    this.messages = []; 
    const otp = this.otpForm.value.otp;
    this.store.dispatch(UserActions.verifyEmailOtp({ email: this.emailToVerify, otp }));
  }

  goBack(): void {
    // Navigate back to settings page or previous page
    this.router.navigate(['/settings']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
} 