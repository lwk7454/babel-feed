import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent {
  selectedLanguage: string = 'en';
  
  constructor(private router: Router) {}
  
  selectLanguage(lang: string): void {
    this.selectedLanguage = lang;
  }
  
  goToSignIn(): void {
    // In a real app, we'd save the language preference here
    this.router.navigate(['/signin']);
  }
} 