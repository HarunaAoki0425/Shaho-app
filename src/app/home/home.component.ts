import { Component, OnDestroy, inject, Injector, runInInjectionContext } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { HeaderComponent } from '../header/header.component';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeaderComponent, MatIconModule, RouterModule, CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnDestroy {
  currentUser: User | null = null;
  private unsubscribe: (() => void) | undefined;
  notificationMessage: string | null = null;
  hasCompany: boolean = false;
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  constructor(private auth: Auth) {
    this.unsubscribe = onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      if (user) {
        runInInjectionContext(this.injector, () => {
          const companiesCol = collection(this.firestore, 'companies');
          const q = query(companiesCol, where('createdBy', '==', user.uid));
          runInInjectionContext(this.injector, () => {
            getDocs(q).then(snap => {
              this.hasCompany = !snap.empty;

              if (!this.hasCompany) {
                const notificationsCol = collection(this.firestore, 'notifications');
                const nq = query(
                  notificationsCol,
                  where('message', '==', '会社情報・事業所情報を登録してください。')
                );
                runInInjectionContext(this.injector, () => {
                  getDocs(nq).then(nsnap => {
                    this.notificationMessage = !nsnap.empty ? nsnap.docs[0].data()['message'] : null;
                  });
                });
              } else {
                this.notificationMessage = null;
              }
            });
          });
        });
      } else {
        this.hasCompany = false;
        this.notificationMessage = null;
      }
    });
  }

  ngOnDestroy() {
    if (this.unsubscribe) this.unsubscribe();
  }
}
