import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Firebase Injection Context警告を非表示にする（グローバルで1回だけ）
const originalWarn = window.console.warn;
window.console.warn = function (...args: any[]) {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Calling Firebase APIs outside of an Injection context')
  ) {
    return;
  }
  originalWarn.apply(window.console, args);
};

bootstrapApplication(AppComponent, appConfig);

