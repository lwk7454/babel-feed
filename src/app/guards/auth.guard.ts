import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs/operators';
import { AppState } from '../store';
import { selectUserIsAuthenticated } from '../store/reducers/user.reducer';

export const authGuard: CanActivateFn = (route, state) => {
  const store = inject(Store<AppState>);
  const router = inject(Router);

  return store.select(selectUserIsAuthenticated).pipe(
    take(1), // Take the latest value and complete
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true;
      }
      // Redirect to the welcome page or sign-in page if not authenticated
      router.navigate(['/welcome']); 
      return false;
    })
  );
}; 