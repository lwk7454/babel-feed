import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth.guard";

export const routes: Routes = [
  { path: '', redirectTo: 'welcome', pathMatch: 'full' },
  { path: 'welcome', loadComponent: () => import('./pages/welcome/welcome.component').then(m => m.WelcomeComponent) },
  { path: 'signin', loadComponent: () => import('./pages/signin/signin.component').then(m => m.SigninComponent) },
  {
    path: 'feed', 
    loadComponent: () => import('./pages/feed/feed.component').then(m => m.FeedComponent),
    canActivate: [authGuard]
  },
  {
    path: 'article/:id', 
    loadComponent: () => import('./pages/article/article.component').then(m => m.ArticleComponent),
    canActivate: [authGuard]
  },
  {
    path: 'search', 
    loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent),
    canActivate: [authGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'content-preferences',
    loadComponent: () => import('./pages/content-preferences/content-preferences.component').then(m => m.ContentPreferencesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'model-config',
    loadComponent: () => import('./pages/model-config/model-config.component').then(m => m.ModelConfigComponent),
    canActivate: [authGuard]
  },
  {
    path: 'verify-otp',
    loadComponent: () => import('./pages/verify-otp/verify-otp.component').then(m => m.VerifyOtpComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'welcome' }
];
