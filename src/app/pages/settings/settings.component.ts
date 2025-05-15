import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
    selector: 'app-settings',
    imports: [CommonModule],
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  constructor(private router: Router) {}
  
  goBack(): void {
    this.router.navigate(['/feed']);
  }
  
  navigateToLanguageSettings(): void {
    // For PoC, we'll just show a placeholder
    alert('Language Settings page would appear here');
  }
  
  navigateToContentPreferences(): void {
    this.router.navigate(['/settings/content-preferences']);
  }
  
  navigateToDisplaySettings(): void {
    // For PoC, we'll just show a placeholder
    alert('Display Settings page would appear here');
  }
  
  navigateToAbout(): void {
    // For PoC, we'll just show a placeholder
    alert('About page would appear here');
  }
  
  navigateToPrivacyPolicy(): void {
    // For PoC, we'll just show a placeholder
    alert('Privacy Policy would appear here');
  }
  
  navigateToTerms(): void {
    // For PoC, we'll just show a placeholder
    alert('Terms of Service would appear here');
  }
} 