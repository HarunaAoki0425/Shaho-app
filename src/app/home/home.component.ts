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
                // ここから今月の一斉算出履歴チェック
                snap.docs.forEach(async (companyDoc) => {
                  const companyId = companyDoc.id;
                  const batchHistoryCol = collection(this.firestore, 'companies', companyId, 'batchRecalculateHistory');
                  const batchSnap = await getDocs(batchHistoryCol);
                  const now = new Date();
                  const currentYear = now.getFullYear();
                  const currentMonth = now.getMonth() + 1;
                  const found = batchSnap.docs.some(doc => {
                    const executedAt = doc.data()['executedAt'];
                    if (!executedAt) return false;
                    const date = executedAt.toDate ? executedAt.toDate() : new Date(executedAt);
                    return date.getFullYear() === currentYear && (date.getMonth() + 1) === currentMonth;
                  });
                  if (!found) {
                    // Firestoreのnotificationsから該当メッセージを取得して表示
                    const notificationsCol = collection(this.firestore, 'notifications');
                    const nq = query(
                      notificationsCol,
                      where('message', '==', '最新の社会保険料を反映するため、今月分の一斉算出を実行してください。')
                    );
                    const nsnap = await getDocs(nq);
                    this.notificationMessage = !nsnap.empty ? nsnap.docs[0].data()['message'] : null;
                  }
                });
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
