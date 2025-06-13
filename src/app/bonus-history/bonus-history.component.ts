import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { getAuth, onAuthStateChanged } from '@angular/fire/auth';

@Component({
  selector: 'app-bonus-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bonus-history.component.html',
  styleUrl: './bonus-history.component.css'
})
export class BonusHistoryComponent implements OnInit {
  employeeId: string = '';
  companyId: string = '';
  bonuses: any[] = [];
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  async ngOnInit() {
    // ログインユーザーがいなければ/loginに遷移
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        this.router.navigate(['/login']);
      }
    });
    this.employeeId = this.route.snapshot.paramMap.get('id') || '';
    // companyIdを取得するために全companiesを検索
    const companiesCol = collection(this.firestore, 'companies');
    const companiesSnap = await getDocs(companiesCol);
    for (const companyDoc of companiesSnap.docs) {
      const employeesCol = collection(this.firestore, 'companies', companyDoc.id, 'employees');
      const employeesSnap = await getDocs(employeesCol);
      for (const empDoc of employeesSnap.docs) {
        if (empDoc.id === this.employeeId) {
          this.companyId = companyDoc.id;
          // bonusコレクション全年度のmonthBonusサブコレクションを横断して取得
          const bonusCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus');
          const bonusSnap = await getDocs(bonusCol);
          let allMonthBonuses: any[] = [];
          for (const nendoDoc of bonusSnap.docs) {
            const nendoId = nendoDoc.id;
            const monthBonusCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus', nendoId, 'monthBonus');
            const monthBonusSnap = await getDocs(monthBonusCol);
            allMonthBonuses.push(...monthBonusSnap.docs.map(doc => ({ id: doc.id, nendo: nendoId, ...doc.data() as any })));
          }
          this.bonuses = allMonthBonuses;
          // 支給日降順でソート（nullや不正値は一番下）
          this.bonuses.sort((a, b) => {
            const dateA = a.bonusDateList && a.bonusDateList[0] ? new Date(a.bonusDateList[0]).getTime() : 0;
            const dateB = b.bonusDateList && b.bonusDateList[0] ? new Date(b.bonusDateList[0]).getTime() : 0;
            return dateB - dateA;
          });
          return;
        }
      }
    }
  }

  get healthInsuranceTotalSum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.healthInsuranceTotal) || 0), 0);
  }
  get healthInsuranceCompanySum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.healthInsuranceCompany) || 0), 0);
  }
  get healthInsuranceEmployeeSum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.healthInsuranceEmployee) || 0), 0);
  }
  get careInsuranceTotalSum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.careInsuranceTotal) || 0), 0);
  }
  get careInsuranceCompanySum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.careInsuranceCompany) || 0), 0);
  }
  get careInsuranceEmployeeSum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.careInsuranceEmployee) || 0), 0);
  }
  get pensionInsuranceTotalSum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.pensionInsuranceTotal) || 0), 0);
  }
  get pensionInsuranceCompanySum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.pensionInsuranceCompany) || 0), 0);
  }
  get pensionInsuranceEmployeeSum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.pensionInsuranceEmployee) || 0), 0);
  }
  get totalSum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
  }
  get totalCompanySum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.totalCompany) || 0), 0);
  }
  get totalEmployeeSum(): number {
    return this.bonuses.reduce((sum, b) => sum + (Number(b.totalEmployee) || 0), 0);
  }
}
