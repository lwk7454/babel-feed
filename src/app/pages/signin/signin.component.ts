import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.scss']
})
export class SigninComponent {
  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}
  
  signIn(provider: string): void {
    this.apiService.signIn(provider).subscribe({
      next: (user) => {
        console.log('Signed in', user);
        this.router.navigate(['/feed']);
      },
      error: (error) => {
        console.error('Error signing in', error);
      }
    });
  }
} 