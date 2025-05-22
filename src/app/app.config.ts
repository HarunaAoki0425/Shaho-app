import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    importProvidersFrom(FormsModule),
    provideFirebaseApp(() => initializeApp({ projectId: "shaho-app", appId: "1:857849685000:web:56352eb8674b0369901dbd", storageBucket: "shaho-app.firebasestorage.app", apiKey: "AIzaSyBHpc-0qsB_kYH6HL8QEipXXEyHMSJ7Z5s", authDomain: "shaho-app.firebaseapp.com", messagingSenderId: "857849685000" })),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore())
  ]
};
