import { Component, OnInit, HostBinding } from "@angular/core";
import { RouterOutlet, ChildrenOutletContexts } from "@angular/router"; // Router, NavigationEnd removed for now
import { ThemeService } from "./services/theme.service";
// Removed ToolbarModule, ButtonModule, TieredMenuModule
// import { filter } from 'rxjs/operators'; // Removed
import { fadeAnimation } from './route-animations';
// import { TabViewModule } from 'primeng/tabview'; // Deprecated
import { TabsModule } from 'primeng/tabs'; // Using new Tabs module
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { selectUserIsAuthenticated } from './store/reducers/user.reducer';
import { AppState } from './store';

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    RouterOutlet,
    // TabViewModule, // Deprecated
    TabsModule, // Using new Tabs module
    RouterModule,
    AsyncPipe
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [fadeAnimation] 
})
export class AppComponent implements OnInit {
  @HostBinding('class.auth-padding') addAuthPadding = false;
  isAuthenticated$: Observable<boolean>;

  constructor(
    public themeService: ThemeService, 
    private contexts: ChildrenOutletContexts,
    private store: Store<AppState>
  ) {
    this.isAuthenticated$ = this.store.select(selectUserIsAuthenticated);
    this.isAuthenticated$.subscribe(authenticated => {
      this.addAuthPadding = authenticated;
      console.log('[AppComponent] isAuthenticated: ', authenticated);
    });
  }
  
  navItems = [
    { label: 'Feed', icon: 'pi pi-fw pi-list', routerLink: '/feed' },
    { label: 'Search', icon: 'pi pi-fw pi-search', routerLink: '/search' },
    { label: 'Preferences', icon: 'pi pi-fw pi-cog', routerLink: '/content-preferences' }
  ];

  ngOnInit() {
    // Minimal ngOnInit.
    // If ThemeService needs to react to route changes or perform initialization:
    // this.router.events.pipe(
    //   filter(event => event instanceof NavigationEnd)
    // ).subscribe(event => {
    //   // Logic here
    // });
  }

  getRouteAnimationData() {
    // console.log(this.contexts.getContext('primary')?.route?.snapshot?.data?.['animation']);
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.['animation'] || 
           this.contexts.getContext('primary')?.route?.snapshot?.url.join('/') || 
           'default';
  }
}
