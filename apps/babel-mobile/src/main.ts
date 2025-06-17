import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";

// Add global error handling
window.addEventListener('error', (event) => {
  console.error('[Global] Unhandled JavaScript error:', event.error);
  console.error('[Global] Error message:', event.message);
  console.error('[Global] Error source:', event.filename, 'at line', event.lineno);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global] Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent the default handling (which may crash the app)
});

console.log('[Main] Starting Angular application bootstrap...');

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    console.log('[Main] Angular application bootstrapped successfully');
  })
  .catch((err) => {
    console.error('[Main] Angular bootstrap error:', err);
    console.error('[Main] Error stack:', err?.stack);
  });
