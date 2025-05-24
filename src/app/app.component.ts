import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterOutlet, ChildrenOutletContexts } from "@angular/router"; // Router, NavigationEnd removed for now
import { ThemeService } from "./services/theme.service";
// Removed ToolbarModule, ButtonModule, TieredMenuModule
// import { filter } from 'rxjs/operators'; // Removed
import { fadeAnimation } from './route-animations';

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [fadeAnimation] 
})
export class AppComponent implements OnInit {

  constructor(
    public themeService: ThemeService, 
    private contexts: ChildrenOutletContexts,
    // private router: Router, // Keep router if ngOnInit will use it
    // private route: ActivatedRoute // To get route data for animations
  ) {}
  
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
