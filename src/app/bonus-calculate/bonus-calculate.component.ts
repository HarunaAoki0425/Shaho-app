import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, getDocs, doc, getDoc, query, orderBy, limit } from '@angular/fire/firestore';
import Decimal from 'decimal.js';
import { JudgeComponent } from '../judge/judge.component';
import { CommonModule } from '@angular/common';
import { getAuth, onAuthStateChanged } from '@angular/fire/auth';

@Component({
  selector: 'app-bonus-calculate',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bonus-calculate.component.html',
  styleUrl: './bonus-calculate.component.css'
})
export class BonusCalculateComponent implements OnInit {
  employeeId: string = '';
  companyId: string = '';
  employeeData: any = null;
  companyData: any = null;
  officeData: any = null;
  latestBonus: any = null;
  insuranceRateData: any = null;
  isLoading: boolean = true;
  isSocialInsuranceExcluded: boolean = false;
  healthInsuranceResult: boolean = false;
  careInsuranceResult: boolean = false;
  pensionInsuranceResult: boolean = false;
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  public router = inject(Router);

  async ngOnInit() {
    // ログインユーザーがいなければ/loginに遷移
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        this.router.navigate(['/login']);
      }
    });
    this.isLoading = true;
    this.employeeId = this.route.snapshot.paramMap.get('id') || '';
    // companiesコレクションを全件取得
    const companiesCol = collection(this.firestore, 'companies');
    const companiesSnap = await getDocs(companiesCol);
    for (const companyDoc of companiesSnap.docs) {
      const employeesCol = collection(this.firestore, 'companies', companyDoc.id, 'employees');
      const employeesSnap = await getDocs(employeesCol);
      for (const empDoc of employeesSnap.docs) {
        if (empDoc.id === this.employeeId) {
          this.companyId = companyDoc.id;
          this.employeeData = empDoc.data();
          // 会社情報も取得
          const companyRef = doc(this.firestore, 'companies', this.companyId);
          const companySnap = await getDoc(companyRef);
          this.companyData = companySnap.exists() ? companySnap.data() : null;
          // 所属事業所情報も取得
          if (this.employeeData.officesId) {
            const officeRef = doc(this.firestore, 'companies', this.companyId, 'offices', this.employeeData.officesId);
            const officeSnap = await getDoc(officeRef);
            this.officeData = officeSnap.exists() ? officeSnap.data() : null;
            // insurance_ratesコレクションから該当データ取得
            if (this.officeData && this.officeData.officePrefecture) {
              const insuranceRatesCol = collection(this.firestore, 'insurance_rates');
              const insuranceRatesSnap = await getDocs(insuranceRatesCol);
              this.insuranceRateData = insuranceRatesSnap.docs
                .map(doc => doc.data())
                .find(row => row['prefecture'] === this.officeData.officePrefecture && String(row['year']) === String(new Date().getFullYear()));
            }
          }
          // すべての年度のmonthBonusサブコレクションを横断し、createdAtが最新のものを取得
          const bonusRootCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus');
          const bonusRootSnap = await getDocs(bonusRootCol);
          let allMonthBonuses: any[] = [];
          for (const nendoDoc of bonusRootSnap.docs) {
            const nendoId = nendoDoc.id;
            const monthBonusCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus', nendoId, 'monthBonus');
            const monthBonusSnap = await getDocs(monthBonusCol);
            allMonthBonuses.push(...monthBonusSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any })));
          }
          // createdAtが最新のものを取得
          allMonthBonuses = allMonthBonuses.filter(b => b.createdAt);
          allMonthBonuses.sort((a, b) => (b.createdAt?.toDate?.() ?? new Date(0)) - (a.createdAt?.toDate?.() ?? new Date(0)));
          this.latestBonus = allMonthBonuses.length > 0 ? allMonthBonuses[0] : null;
          // 計算結果を次のtickで保存
          if (this.latestBonus && this.latestBonus.id) {
            setTimeout(() => {
              this.saveCalculationResults();
            });
          }
          // 判定ロジック呼び出し
          const socialInsuranceRequired = JudgeComponent.judgeSocialInsuranceRequired({
            employee: this.employeeData,
            office: this.officeData,
            company: this.companyData
          });
          if (!socialInsuranceRequired) {
            this.isSocialInsuranceExcluded = true;
            this.isLoading = false;
            return;
          }
          this.healthInsuranceResult = JudgeComponent.judgeHealthInsurance(this.employeeData);
          this.careInsuranceResult = JudgeComponent.judgeCareInsurance(this.employeeData);
          this.pensionInsuranceResult = JudgeComponent.judgePensionInsurance(this.employeeData);
          this.isLoading = false;
          // 自動保存処理: calcAtが未設定の最新bonusがあれば自動保存
          return;
        }
      }
    }
    this.isLoading = false;
  }

  formatWithComma(value: string | number): string {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) return '';
    return num.toLocaleString();
  }

  get healthInsuranceRate100(): string {
    if (!this.insuranceRateData || this.insuranceRateData.health_insurance == null) return '';
    try {
      return new Decimal(this.insuranceRateData.health_insurance).times(100).toString();
    } catch {
      return '';
    }
  }
  get careInsuranceRate100(): string {
    if (!this.insuranceRateData || this.insuranceRateData.care_insurance == null) return '';
    try {
      return new Decimal(this.insuranceRateData.care_insurance).times(100).toString();
    } catch {
      return '';
    }
  }
  get pensionInsuranceRate100(): string {
    if (!this.insuranceRateData || this.insuranceRateData.pension_insurance == null) return '';
    try {
      return new Decimal(this.insuranceRateData.pension_insurance).times(100).toString();
    } catch {
      return '';
    }
  }

  // 健康保険計算用getter
  get healthInsuranceBase(): number {
    if (!this.latestBonus) return 0;
    return this.latestBonus.isKenpoBonusLimitNotReached ? this.latestBonus.kenpoStandardBonusAmount : this.latestBonus.kenpoStandardBonusAmountAdjusted;
  }
  get healthInsuranceTotal(): number {
    if (!this.healthInsuranceResult || !this.insuranceRateData) return 0;
    const base = new Decimal(this.healthInsuranceBase);
    const rate = new Decimal(this.insuranceRateData.health_insurance);
    return Number(base.times(rate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP));
  }
  get healthInsuranceCompany(): number {
    const half = new Decimal(this.healthInsuranceTotal).div(2);
    return Number(half.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)); // 四捨五入
  }
  get healthInsuranceEmployee(): number {
    const half = new Decimal(this.healthInsuranceTotal).div(2);
    const decimalPart = half.minus(half.floor()).times(10).toNumber();
    if (decimalPart <= 5) {
      return Number(half.floor()); // 五捨
    } else {
      return Number(half.ceil()); // 六入
    }
  }

  // 介護保険計算用getter
  get careInsuranceBase(): number {
    if (!this.latestBonus) return 0;
    return this.latestBonus.isKenpoBonusLimitNotReached ? this.latestBonus.kenpoStandardBonusAmount : this.latestBonus.kenpoStandardBonusAmountAdjusted;
  }
  get careInsuranceTotal(): number {
    if (!this.careInsuranceResult || !this.insuranceRateData) return 0;
    const base = new Decimal(this.careInsuranceBase);
    const rate = new Decimal(this.insuranceRateData.care_insurance);
    return Number(base.times(rate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP));
  }
  get careInsuranceCompany(): number {
    const half = new Decimal(this.careInsuranceTotal).div(2);
    return Number(half.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)); // 四捨五入
  }
  get careInsuranceEmployee(): number {
    const half = new Decimal(this.careInsuranceTotal).div(2);
    const decimalPart = half.minus(half.floor()).times(10).toNumber();
    if (decimalPart <= 5) {
      return Number(half.floor()); // 五捨
    } else {
      return Number(half.ceil()); // 六入
    }
  }

  // 厚生年金計算用getter
  get nenkinBase(): number {
    if (!this.latestBonus) return 0;
    return this.latestBonus.nenkinStandardBonusAmount || 0;
  }
  get nenkinTotal(): number {
    if (!this.pensionInsuranceResult || !this.insuranceRateData) return 0;
    const base = new Decimal(this.nenkinBase);
    const rate = new Decimal(this.insuranceRateData.pension_insurance);
    return Number(base.times(rate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP));
  }
  get nenkinCompany(): number {
    const half = new Decimal(this.nenkinTotal).div(2);
    return Number(half.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)); // 四捨五入
  }
  get nenkinEmployee(): number {
    const half = new Decimal(this.nenkinTotal).div(2);
    const decimalPart = half.minus(half.floor()).times(10).toNumber();
    if (decimalPart <= 5) {
      return Number(half.floor()); // 五捨
    } else {
      return Number(half.ceil()); // 六入
    }
  }

  // 合計getter
  get totalInsurance(): number {
    return this.healthInsuranceTotal + this.careInsuranceTotal + this.nenkinTotal;
  }
  get totalInsuranceCompany(): number {
    return this.healthInsuranceCompany + this.careInsuranceCompany + this.nenkinCompany;
  }
  get totalInsuranceEmployee(): number {
    return this.healthInsuranceEmployee + this.careInsuranceEmployee + this.nenkinEmployee;
  }

  async saveCalculationResults() {
    if (!this.latestBonus || !this.latestBonus.id) return;
    const nendo = this.latestBonus.nendo || this.latestBonus.nendoYear || '';
    const monthBonusDocRef = doc(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus', String(nendo), 'monthBonus', this.latestBonus.id);
    const saveData = {
      healthInsuranceTotal: this.healthInsuranceTotal,
      healthInsuranceCompany: this.healthInsuranceCompany,
      healthInsuranceEmployee: this.healthInsuranceEmployee,
      careInsuranceTotal: this.careInsuranceTotal,
      careInsuranceCompany: this.careInsuranceCompany,
      careInsuranceEmployee: this.careInsuranceEmployee,
      nenkinTotal: this.nenkinTotal,
      nenkinCompany: this.nenkinCompany,
      nenkinEmployee: this.nenkinEmployee,
      totalInsurance: this.totalInsurance,
      totalInsuranceCompany: this.totalInsuranceCompany,
      totalInsuranceEmployee: this.totalInsuranceEmployee,
      calcAt: new Date(),
    };
    await import('@angular/fire/firestore').then(m => m.updateDoc(monthBonusDocRef, saveData));
  }

  goToEmployeeDetail() {
    if (!this.employeeId) return;
    this.router.navigate([`/employee-detail/${this.employeeId}`]);
  }
}
