import { Injectable, RendererFactory2, Renderer2, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private renderer: Renderer2;
  private currentTheme: 'light' | 'dark' = 'light';
  private readonly themeKey = 'app-theme';
  private readonly darkThemeClass = 'dark-theme';
  private themeSubject = new BehaviorSubject<'light' | 'dark'>('light');
  
  public themeChanged$: Observable<'light' | 'dark'> = this.themeSubject.asObservable();

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.loadTheme();
  }

  private loadTheme(): void {
    const storedTheme = localStorage.getItem(this.themeKey) as 'light' | 'dark' | null;
    if (storedTheme) {
      this.setTheme(storedTheme);
    } else {
      // Check system preference if no theme is stored
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light');
    }
  }

  private setTheme(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
    localStorage.setItem(this.themeKey, theme);
    
    // Apply theme class to both html and body elements for better coverage
    const htmlElement = this.document.documentElement;
    const bodyElement = this.document.body;
    
    if (theme === 'dark') {
      this.renderer.addClass(htmlElement, this.darkThemeClass);
      this.renderer.addClass(bodyElement, this.darkThemeClass);
    } else {
      this.renderer.removeClass(htmlElement, this.darkThemeClass);
      this.renderer.removeClass(bodyElement, this.darkThemeClass);
    }
    
    this.themeSubject.next(theme);
  }

  toggleTheme(): void {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    console.log(`Switching theme from ${this.currentTheme} to ${newTheme}`);
    this.setTheme(newTheme);
  }

  getCurrentTheme(): 'light' | 'dark' {
    return this.currentTheme;
  }
} 