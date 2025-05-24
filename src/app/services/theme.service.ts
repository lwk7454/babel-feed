import { Injectable, RendererFactory2, Renderer2 } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private renderer: Renderer2;
  private currentTheme: 'light' | 'dark' = 'light'; // Default to light
  private readonly themeKey = 'app-theme';
  private readonly darkThemeClass = 'dark-theme';
  private themeSubject = new BehaviorSubject<'light' | 'dark'>('light');
  
  public themeChanged$: Observable<'light' | 'dark'> = this.themeSubject.asObservable();

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.loadTheme();
  }

  private loadTheme(): void {
    const storedTheme = localStorage.getItem(this.themeKey) as 'light' | 'dark' | null;
    if (storedTheme) {
      this.setTheme(storedTheme);
    } else {
      // Optionally, check system preference if no theme is stored
      // const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      // this.setTheme(prefersDark ? 'dark' : 'light');
      this.setTheme(this.currentTheme); // Initialize with default
    }
  }

  private setTheme(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
    localStorage.setItem(this.themeKey, theme);
    if (theme === 'dark') {
      this.renderer.addClass(document.body, this.darkThemeClass);
    } else {
      this.renderer.removeClass(document.body, this.darkThemeClass);
    }
    this.themeSubject.next(theme);
  }

  toggleTheme(): void {
    this.setTheme(this.currentTheme === 'light' ? 'dark' : 'light');
  }

  getCurrentTheme(): 'light' | 'dark' {
    return this.currentTheme;
  }
} 