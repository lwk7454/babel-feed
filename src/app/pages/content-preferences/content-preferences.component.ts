import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
    selector: 'app-content-preferences',
    imports: [CommonModule, FormsModule],
    templateUrl: './content-preferences.component.html',
    styleUrls: ['./content-preferences.component.scss']
})
export class ContentPreferencesComponent implements OnInit {
  availableTopics: { name: string; selected: boolean }[] = [
    { name: 'Technology', selected: true },
    { name: 'Entertainment', selected: true },
    { name: 'Politics', selected: false },
    { name: 'Sports', selected: false },
    { name: 'Science', selected: false },
    { name: 'Health', selected: false },
  ];
  
  blockedSources: string[] = ['Example News Site', 'Another Blocked Source'];
  
  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}
  
  ngOnInit(): void {
    this.loadUserPreferences();
  }
  
  loadUserPreferences(): void {
    this.apiService.getUserPreferences().subscribe({
      next: (preferences) => {
        // Update selected topics based on user preferences
        this.availableTopics.forEach(topic => {
          topic.selected = preferences.topics.includes(topic.name);
        });
        
        // Update blocked sources
        this.blockedSources = [...preferences.blockedSources];
      },
      error: (error) => {
        console.error('Error loading user preferences', error);
      }
    });
  }
  
  savePreferences(): void {
    const selectedTopics = this.availableTopics
      .filter(topic => topic.selected)
      .map(topic => topic.name);
    
    this.apiService.updateUserPreferences({
      topics: selectedTopics,
      blockedSources: this.blockedSources
    }).subscribe({
      next: () => {
        console.log('Preferences saved successfully');
      },
      error: (error) => {
        console.error('Error saving preferences', error);
      }
    });
  }
  
  removeBlockedSource(index: number): void {
    this.blockedSources.splice(index, 1);
    this.savePreferences();
  }
  
  goBack(): void {
    this.router.navigate(['/settings']);
  }
} 