import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterOutlet, Router, NavigationEnd, ChildrenOutletContexts } from "@angular/router";
import { ThemeService } from "./services/theme.service";
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { TieredMenuModule } from 'primeng/tieredmenu'; // For potential overflow menu in top bar
import { MenuItem } from 'primeng/api';
import { filter } from 'rxjs/operators';
import { fadeAnimation } from './route-animations'; // Import the animation

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    ToolbarModule, 
    ButtonModule,
    TieredMenuModule
  ],
  template: `
    <p-toolbar>
      <ng-template pTemplate="start">
        <span style="font-size: 1.5rem; font-weight: bold; cursor: pointer;" (click)="navigateToHome()">Babel Feed</span>
      </ng-template>

      <ng-template pTemplate="center">
        <!-- Optional: Can display current route title here if needed -->
        <span class="current-route-title">{{ currentRouteTitle }}</span>
      </ng-template>

      <ng-template pTemplate="end">
        <p-button 
          [icon]="themeService.getCurrentTheme() === 'light' ? 'pi pi-moon' : 'pi pi-sun'" 
          (click)="themeService.toggleTheme()" 
          styleClass="p-button-rounded p-button-text">
        </p-button>
        <!-- Search icon can be conditionally shown here based on route if needed -->
        <p-button 
          *ngIf="showSearchIcon" 
          icon="pi pi-search" 
          (click)="navigateToSearch()" 
          styleClass="p-button-rounded p-button-text">
        </p-button>
      </ng-template>
    </p-toolbar>

    <div class="app-content" [@routeAnimations]="getRouteAnimationData()">
      <router-outlet></router-outlet>
    </div>

    <!-- Bottom Navigation -->
    <div class="bottom-nav-bar p-d-flex p-jc-around p-ai-center p-shadow-2">
      <button pButton type="button" icon="pi pi-list" class="p-button-text bottom-nav-button" routerLink="/feed" routerLinkActive="active-bottom-nav"></button>
      <button pButton type="button" icon="pi pi-search" class="p-button-text bottom-nav-button" routerLink="/search" routerLinkActive="active-bottom-nav"></button>
      <button pButton type="button" icon="pi pi-cog" class="p-button-text bottom-nav-button" routerLink="/settings" routerLinkActive="active-bottom-nav"></button>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      position: relative; /* Needed for absolute positioning of animated routes */
    }
    .app-content {
      flex: 1;
      overflow-y: auto;
      /* Padding is removed here, can be added to individual page containers or kept if global padding is desired */
      position: relative; /* Container for animated routes */
    }
    .current-route-title {
      font-size: 1.1rem;
      font-weight: normal;
      color: var(--text-color-secondary);
    }
    .bottom-nav-bar {
      height: 56px; /* Standard mobile nav height */
      background-color: var(--surface-b); /* PrimeNG surface color */
      border-top: 1px solid var(--surface-d);
    }
    .bottom-nav-button {
      font-size: 1.5rem; /* Larger icons */
      color: var(--text-color-secondary);
      flex-grow: 1;
      height: 100%;
      border-radius: 0;
    }
    .bottom-nav-button.active-bottom-nav {
      color: var(--primary-color);
      /* background-color: var(--primary-color-faded); /* Optional: subtle background for active tab */
    }
    :host ::ng-deep .p-toolbar {
       border-radius: 0;
       border-bottom: 1px solid var(--surface-d);
    }
  `],
  animations: [fadeAnimation] // Add to component animations
})
export class AppComponent implements OnInit {
  currentRouteTitle: string = '';
  showSearchIcon: boolean = false;

  constructor(
    public themeService: ThemeService, 
    private router: Router,
    private contexts: ChildrenOutletContexts // Inject ChildrenOutletContexts
  ) {}
  
  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(event => {
      const e = event as NavigationEnd;
      this.showSearchIcon = e.urlAfterRedirects.startsWith('/feed');
      // You could derive a title from the route data if set up in app.routes.ts
      if (e.urlAfterRedirects.startsWith('/feed')) {
        this.currentRouteTitle = ''; // Feed title is in the toolbar start
      } else if (e.urlAfterRedirects.startsWith('/search')) {
        this.currentRouteTitle = 'Search';
      } else if (e.urlAfterRedirects.startsWith('/settings')) {
        this.currentRouteTitle = 'Settings';
      } else if (e.urlAfterRedirects.startsWith('/article')) {
        this.currentRouteTitle = 'Article'; // Or fetch article title
      } else if (e.urlAfterRedirects.startsWith('/welcome')) {
        this.currentRouteTitle = 'Welcome';
      } else if (e.urlAfterRedirects.startsWith('/signin')) {
        this.currentRouteTitle = 'Sign In';
      } else {
        this.currentRouteTitle = '';
      }
    });
  }

  getRouteAnimationData() {
    // Use the route path as the animation trigger value, or any unique string per route
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.['animation'] || 
           this.contexts.getContext('primary')?.route?.snapshot?.url.join('/') || 
           'default';
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  navigateToSearch(): void {
    this.router.navigate(['/search']);
  }
}
