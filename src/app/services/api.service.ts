import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { environment } from '../../environments/environment';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  url: string;
  type: 'article' | 'video';
  duration?: string; // for videos
}

export interface User {
  id: string;
  email: string;
  preferences: {
    language: string;
    topics: string[];
    blockedSources: string[];
  }
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  
  constructor() { }

  // Authentication methods
  signIn(provider: string): Observable<User> {
    console.log(`Signing in with ${provider} via ${this.apiUrl}/auth`);
    // In a real implementation, this would call the auth endpoint
    return this.mockRequest<User>('auth', {
      id: 'user1',
      email: 'user@example.com',
      preferences: {
        language: 'English',
        topics: ['Technology', 'Entertainment'],
        blockedSources: ['Example News Site', 'Another Blocked Source']
      }
    });
  }

  // News feed methods
  getNewsFeed(): Observable<NewsItem[]> {
    console.log(`Fetching news feed from ${this.apiUrl}/feed`);
    return this.mockRequest<NewsItem[]>('feed', [
      {
        id: '1',
        title: 'Sample News Article Headline Goes Here',
        summary: 'Brief summary of the news article goes here, providing a quick overview.',
        source: 'News Source',
        publishedAt: '2h ago',
        imageUrl: 'https://via.placeholder.com/300x150',
        url: 'https://example.com/article1',
        type: 'article'
      },
      {
        id: '2',
        title: 'Sample Video Title Here',
        summary: 'Brief description of this video content.',
        source: 'Channel Name',
        publishedAt: '3h ago',
        imageUrl: 'https://via.placeholder.com/300x150',
        url: 'https://example.com/video1',
        type: 'video',
        duration: '3:45'
      }
    ]);
  }

  getNewsItem(id: string): Observable<NewsItem | undefined> {
    console.log(`Fetching news item ${id} from ${this.apiUrl}/items/${id}`);
    return this.mockRequest<NewsItem | undefined>(`items/${id}`, {
      id: id,
      title: 'Sample Article Title',
      summary: 'This is the article summary',
      source: 'News Source',
      publishedAt: '2h ago',
      imageUrl: 'https://via.placeholder.com/300x150',
      url: 'https://example.com/article1',
      type: 'article'
    });
  }

  searchNews(query: string): Observable<NewsItem[]> {
    console.log(`Searching for "${query}" at ${this.apiUrl}/search?q=${query}`);
    return this.mockRequest<NewsItem[]>('search', [
      {
        id: '3',
        title: `Search Result for "${query}"`,
        summary: 'This is a search result article.',
        source: 'News Source',
        publishedAt: '1d ago',
        imageUrl: 'https://via.placeholder.com/300x150',
        url: 'https://example.com/article3',
        type: 'article'
      }
    ]);
  }

  // User preferences methods
  getUserPreferences(): Observable<User['preferences']> {
    console.log(`Fetching user preferences from ${this.apiUrl}/user/preferences`);
    return this.mockRequest<User['preferences']>('user/preferences', {
      language: 'English',
      topics: ['Technology', 'Entertainment'],
      blockedSources: ['Example News Site', 'Another Blocked Source']
    });
  }

  updateUserPreferences(preferences: Partial<User['preferences']>): Observable<User['preferences']> {
    console.log(`Updating preferences at ${this.apiUrl}/user/preferences`, preferences);
    return this.mockRequest<User['preferences']>('user/preferences', {
      language: preferences.language || 'English',
      topics: preferences.topics || ['Technology', 'Entertainment'],
      blockedSources: preferences.blockedSources || ['Example News Site']
    });
  }

  // Translation service
  translateContent(html: string, targetLanguage: string): Observable<string> {
    console.log(`Translating content to ${targetLanguage} via Tauri plugin`);
    // In a real implementation, this would call a Tauri plugin
    return this.mockRequest<string>('translate', `[Translated to ${targetLanguage}] ${html}`);
  }

  // Helper method to simulate API requests
  private mockRequest<T>(endpoint: string, mockData: T, delayMs: number = 500): Observable<T> {
    // Log the request as if it were a real API call
    console.log(`Mock ${this.apiUrl}/${endpoint} - Returning data in ${delayMs}ms`);
    // Return the mock data with a delay to simulate network latency
    return of(mockData).pipe(delay(delayMs));
  }
} 