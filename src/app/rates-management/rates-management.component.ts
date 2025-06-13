import { Component, OnInit, inject, runInInjectionContext, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Auth, onAuthStateChanged, getAuth } from '@angular/fire/auth';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import Decimal from 'decimal.js';

@Component({
  selector: 'app-rates-management',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './rates-management.component.html',
  styleUrl: './rates-management.component.css'
})
export class RatesManagementComponent implements OnInit {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private router = inject(Router);
  prefectures: any[] = [];
  columns: any[][] = [[], [], [], []];
  companies: any[] = [];
  offices: any[] = [];

  // insurance_ratesコレクションの取得結果を格納
  public insuranceRates: any[] = [];

  /** 今の年度（4月始まり）を返す */
  public readonly currentNendo: number = (() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    return month >= 4 ? year : year - 1;
  })();

  private splitColumns() {
    this.columns = [
      this.prefectures.slice(0, 12),
      this.prefectures.slice(12, 24),
      this.prefectures.slice(24, 36),
      this.prefectures.slice(36, 47)
    ];
  }

  ngOnInit(): void {
    // ログインユーザーがいなければ/loginに遷移
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        this.router.navigate(['/login']);
      }
    });
    runInInjectionContext(this.injector, () => {
      onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          // 会社リスト取得
          const companiesCol = collection(this.firestore, 'companies');
          const q = query(companiesCol, where('createdBy', '==', user.uid));
          const companiesSnap = await getDocs(q);
          this.companies = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // 各会社のofficesサブコレクションを取得
          this.offices = [];
          for (const companyDoc of companiesSnap.docs) {
            const officesCol = collection(this.firestore, 'companies', companyDoc.id, 'offices');
            const officesSnap = await getDocs(officesCol);
            const offices = officesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), companyId: companyDoc.id }));
            this.offices.push(...offices);
          }
          // officeNumber順にソート
          this.offices.sort((a, b) => {
            if (a.officeNumber == null && b.officeNumber == null) return 0;
            if (a.officeNumber == null) return 1;
            if (b.officeNumber == null) return -1;
            if (!isNaN(Number(a.officeNumber)) && !isNaN(Number(b.officeNumber))) {
              return Number(a.officeNumber) - Number(b.officeNumber);
            }
            return String(a.officeNumber).localeCompare(String(b.officeNumber), 'ja', { numeric: true });
          });

          // ...既存の都道府県取得処理...
          const kenpoRatesCol = collection(this.firestore, `rates/${user.uid}/kenpoRates`);
          const snapshot = await getDocs(kenpoRatesCol);
          this.prefectures = snapshot.docs.map(doc => doc.data())
            .sort((a, b) => Number(a['code']) - Number(b['code']));
          this.splitColumns();

          // insurance_ratesコレクションからcurrentNendoと一致するyearのデータを取得
          const insuranceRatesCol = collection(this.firestore, 'insurance_rates');
          const insuranceRatesQ = query(insuranceRatesCol, where('year', '==', this.currentNendo));
          const insuranceRatesSnap = await getDocs(insuranceRatesQ);
          const insuranceRates = insuranceRatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          this.insuranceRates = insuranceRates;
        }
      });
    });
  }

  /**
   * 指定した都道府県の健康保険料率を返す（小数点誤差なく100倍して返す）
   */
  getHealthInsuranceRate(prefecture: string): string {
    const rate = this.insuranceRates.find(r => r.prefecture === prefecture)?.health_insurance;
    if (rate == null || rate === '') return '';
    try {
      return new Decimal(rate).times(100).toString();
    } catch {
      return '';
    }
  }

  /**
   * 指定した都道府県の介護保険料率を返す（小数点誤差なく100倍して返す）
   */
  getCareInsuranceRate(prefecture: string): string {
    const rate = this.insuranceRates.find(r => r.prefecture === prefecture)?.care_insurance;
    if (rate == null || rate === '') return '';
    try {
      return new Decimal(rate).times(100).toString();
    } catch {
      return '';
    }
  }

  /**
   * 指定した都道府県の厚生年金保険料率を返す（小数点誤差なく100倍して返す）
   */
  getPensionInsuranceRate(prefecture: string): string {
    const rate = this.insuranceRates.find(r => r.prefecture === prefecture)?.pension_insurance;
    if (rate == null || rate === '') return '';
    try {
      return new Decimal(rate).times(100).toString();
    } catch {
      return '';
    }
  }
}
