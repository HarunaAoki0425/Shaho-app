import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

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

  async ngOnInit() {
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
          // bonusコレクション全件取得
          const bonusCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus');
          const bonusSnap = await getDocs(bonusCol);
          this.bonuses = bonusSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
          // 支給日降順でソート（nullや不正値は一番下）
          this.bonuses.sort((a, b) => {
            const dateA = a.bonusDate ? new Date(a.bonusDate).getTime() : 0;
            const dateB = b.bonusDate ? new Date(b.bonusDate).getTime() : 0;
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
