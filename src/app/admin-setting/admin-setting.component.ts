import { Component, OnInit, inject, runInInjectionContext, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-admin-setting',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-setting.component.html',
  styleUrl: './admin-setting.component.css'
})
export class AdminSettingComponent implements OnInit {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  prefectures: any[] = [];
  columns: any[][] = [[], [], [], []];

  private splitColumns() {
    this.columns = [
      this.prefectures.slice(0, 12),
      this.prefectures.slice(12, 24),
      this.prefectures.slice(24, 36),
      this.prefectures.slice(36, 47)
    ];
  }

  ngOnInit() {
    runInInjectionContext(this.injector, () => {
      onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          const kenpoRatesCol = collection(this.firestore, `rates/${user.uid}/kenpoRates`);
          const snapshot = await getDocs(kenpoRatesCol);
          this.prefectures = snapshot.docs.map(doc => doc.data())
            .sort((a, b) => Number(a['code']) - Number(b['code']));
          this.splitColumns();
        }
      });
    });
  }
}
