import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { environment } from '../../environments/environment';

export interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  url: string;
  type: 'article' | 'video';
  duration?: string; // for videos
  category?: string;
  content?: string;
  language?: string;
  country?: string;
  keywords?: string[];
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

export interface TopicOption {
  id: string;
  name: string;
  description?: string;
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
    return this.mockRequest<NewsItem[]>('feed', this.getMockNewsItems());
  }

  private getMockNewsItems(): NewsItem[] {
    return [
      {
        id: 'mock1',
        title: 'Exploring the Depths: A New Underwater Discovery',
        summary: 'Scientists have found a previously unknown species of glowing fish in the Mariana Trench, challenging our understanding of deep-sea ecosystems.',
        source: 'Oceanographic Today',
        publishedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(), // 2 hours ago
        type: 'article',
        imageUrl: 'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA&ixlib=rb-4.0.3&q=80&w=400',
        url: 'https://example.com/ocean-discovery',
        category: 'Science',
        content: 'Full article content here...',
        language: 'en',
        country: 'us',
        keywords: ['ocean', 'discovery', 'science']
      },
      {
        id: 'mock2',
        title: 'Architectural Marvels: The Future of Urban Living (Video)',
        summary: 'Discover how cutting-edge architecture is reshaping our cities and creating sustainable living spaces for the future.',
        source: 'FutureScapes Channel',
        publishedAt: new Date(Date.now() - 3600 * 1000 * 28).toISOString(), // 28 hours ago
        type: 'video',
        imageUrl: 'https://images.unsplash.com/photo-1519994940911-d6907047f529?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA&ixlib=rb-4.0.3&q=80&w=400',
        url: 'https://example.com/architectural-marvels-video',
        duration: '15:32',
        category: 'Technology',
        content: 'Details about the video content...',
        language: 'en',
        country: 'us',
        keywords: ['architecture', 'urban', 'future', 'video']
      },
      {
        id: 'mock3',
        title: 'The Rise of Sustainable Energy Solutions',
        summary: 'A comprehensive analysis of how renewable energy sources are becoming increasingly viable and the impact on global markets.',
        source: 'Eco World News',
        publishedAt: new Date(Date.now() - 3600 * 1000 * 72).toISOString(), // 3 days ago
        type: 'article',
        url: 'https://example.com/sustainable-energy',
        category: 'Environment',
        content: 'Full article content here...',
        language: 'en',
        country: 'us',
        keywords: ['sustainability', 'energy', 'environment']
      },
      {
        id: 'mock4',
        title: 'AI Revolution in Healthcare: Transforming Patient Care',
        summary: 'How artificial intelligence is revolutionizing medical diagnosis, treatment planning, and patient outcomes across the globe.',
        source: 'MedTech Weekly',
        publishedAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString(), // 8 hours ago
        type: 'article',
        imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA&ixlib=rb-4.0.3&q=80&w=400',
        url: 'https://example.com/ai-healthcare',
        category: 'Technology',
        content: 'Full article content here...',
        language: 'en',
        country: 'us',
        keywords: ['AI', 'healthcare', 'technology', 'medicine']
      },
      {
        id: 'mock5',
        title: 'Climate Summit 2024: Key Takeaways (Video)',
        summary: 'Watch the highlights from this year\'s international climate summit and learn about the new commitments made by world leaders.',
        source: 'Global News Network',
        publishedAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(), // 2 days ago
        type: 'video',
        imageUrl: 'https://images.unsplash.com/photo-1569163139127-de3b9c7bb1f3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA&ixlib=rb-4.0.3&q=80&w=400',
        url: 'https://example.com/climate-summit-2024',
        duration: '8:45',
        category: 'Environment',
        content: 'Video summary and key points...',
        language: 'en',
        country: 'global',
        keywords: ['climate', 'summit', 'environment', 'policy']
      }
    ];
  }

  getNewsItem(id: string): Observable<NewsItem | undefined> {
    console.log(`Fetching news item ${id} from ${this.apiUrl}/items/${id}`);
    const mockItems = this.getMockNewsItems();
    const foundItem = mockItems.find(item => item.id === id);
    return this.mockRequest<NewsItem | undefined>(`items/${id}`, foundItem);
  }

  searchNews(query: string): Observable<NewsItem[]> {
    console.log(`Searching for "${query}" at ${this.apiUrl}/search?q=${query}`);
    const mockItems = this.getMockNewsItems();
    // Simple mock search - filter by title, summary, keywords, or category
    const filteredItems = mockItems.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.summary?.toLowerCase().includes(query.toLowerCase()) ||
      item.category?.toLowerCase().includes(query.toLowerCase()) ||
      item.keywords?.some(keyword => keyword.toLowerCase().includes(query.toLowerCase()))
    );
    return this.mockRequest<NewsItem[]>('search', filteredItems);
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

  getAvailableTopics(): Observable<TopicOption[]> {
    console.log(`Fetching available topics from ${this.apiUrl}/topics`);
    return this.mockRequest<TopicOption[]>('topics', [
      { id: 'tech', name: 'Technology', description: 'Latest tech news and innovations' },
      { id: 'business', name: 'Business', description: 'Business news and market updates' },
      { id: 'sports', name: 'Sports', description: 'Sports news and updates' },
      { id: 'entertainment', name: 'Entertainment', description: 'Movies, TV, and celebrity news' },
      { id: 'science', name: 'Science', description: 'Scientific discoveries and research' },
      { id: 'health', name: 'Health & Wellness', description: 'Health tips and medical news' },
      { id: 'world', name: 'World News', description: 'International news and events' },
      { id: 'politics', name: 'Politics', description: 'Political news and analysis' },
      { id: 'environment', name: 'Environment', description: 'Climate change and environmental news' }
    ]);
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