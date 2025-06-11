import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, getDocs, doc, getDoc, query, orderBy, limit } from '@angular/fire/firestore';
import Decimal from 'decimal.js';
import { JudgeComponent } from '../judge/judge.component';
import { CommonModule } from '@angular/common';

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
          // 最新のbonusを取得（createdAt降順で1件）
          const bonusCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus');
          const bonusQuery = query(bonusCol, orderBy('createdAt', 'desc'), limit(1));
          const bonusSnap = await getDocs(bonusQuery);
          this.latestBonus = bonusSnap.docs.length > 0 ? bonusSnap.docs[0].data() : null;
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
  get usedBonusAmount(): number | null {
    if (this.latestBonus) {
      if (this.latestBonus.nendoBonusExcessAdjusted != null) {
        return this.latestBonus.nendoBonusExcessAdjusted;
      }
      if (this.latestBonus.standardBonusAmount != null) {
        return this.latestBonus.standardBonusAmount;
      }
    }
    return null;
  }
  get healthInsuranceAmount(): string {
    if (!this.healthInsuranceResult || !this.insuranceRateData) return '';
    const stdSalary = this.usedBonusAmount;
    const rate = this.insuranceRateData.health_insurance;
    if (stdSalary == null || rate == null) return '';
    try {
      return this.formatWithComma(new Decimal(stdSalary).times(new Decimal(rate)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    } catch {
      return '';
    }
  }
  get healthInsuranceAmountCompany(): string {
    if (!this.healthInsuranceResult) return '';
    const total = this.healthInsuranceAmount.replace(/,/g, '');
    if (!total) return '';
    try {
      return this.formatWithComma(new Decimal(total).div(2).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    } catch {
      return '';
    }
  }
  get healthInsuranceAmountEmployee(): string {
    if (!this.healthInsuranceResult) return '';
    const total = this.healthInsuranceAmount.replace(/,/g, '');
    if (!total) return '';
    try {
      const half = new Decimal(total).div(2);
      const decimalPart = half.minus(half.floor()).times(10).toNumber();
      if (decimalPart <= 5) {
        return this.formatWithComma(half.floor().toString());
      } else {
        return this.formatWithComma(half.ceil().toString());
      }
    } catch {
      return '';
    }
  }
  get usedPensionBonusAmount(): number | null {
    if (this.latestBonus) {
      if (this.latestBonus.monthBonusExcessAdjustedDiff != null) {
        return this.latestBonus.monthBonusExcessAdjustedDiff;
      }
      if (this.latestBonus.standardBonusAmount != null) {
        return this.latestBonus.standardBonusAmount;
      }
    }
    return null;
  }
  get pensionInsuranceAmount(): string {
    if (!this.pensionInsuranceResult || !this.insuranceRateData) return '';
    const stdSalary = this.usedPensionBonusAmount;
    const rate = this.insuranceRateData.pension_insurance;
    if (stdSalary == null || rate == null) return '';
    try {
      return this.formatWithComma(new Decimal(stdSalary).times(new Decimal(rate)).toFixed(0));
    } catch {
      return '';
    }
  }
  get pensionInsuranceAmountCompany(): string {
    if (!this.pensionInsuranceResult) return '';
    const total = this.pensionInsuranceAmount.replace(/,/g, '');
    if (!total) return '';
    try {
      return this.formatWithComma(new Decimal(total).div(2).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    } catch {
      return '';
    }
  }
  get pensionInsuranceAmountEmployee(): string {
    if (!this.pensionInsuranceResult) return '';
    const total = this.pensionInsuranceAmount.replace(/,/g, '');
    if (!total) return '';
    try {
      const half = new Decimal(total).div(2);
      const decimalPart = half.minus(half.floor()).times(10).toNumber();
      if (decimalPart <= 5) {
        return this.formatWithComma(half.floor().toString());
      } else {
        return this.formatWithComma(half.ceil().toString());
      }
    } catch {
      return '';
    }
  }
  get careInsuranceAmount(): string {
    if (!this.careInsuranceResult || !this.insuranceRateData) return '';
    const stdSalary = this.usedBonusAmount;
    const rate = this.insuranceRateData.care_insurance;
    if (stdSalary == null || rate == null) return '';
    try {
      return this.formatWithComma(new Decimal(stdSalary).times(new Decimal(rate)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    } catch {
      return '';
    }
  }
  get careInsuranceAmountCompany(): string {
    if (!this.careInsuranceResult) return '';
    const total = this.careInsuranceAmount.replace(/,/g, '');
    if (!total) return '';
    try {
      return this.formatWithComma(new Decimal(total).div(2).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    } catch {
      return '';
    }
  }
  get careInsuranceAmountEmployee(): string {
    if (!this.careInsuranceResult) return '';
    const total = this.careInsuranceAmount.replace(/,/g, '');
    if (!total) return '';
    try {
      const half = new Decimal(total).div(2);
      const decimalPart = half.minus(half.floor()).times(10).toNumber();
      if (decimalPart <= 5) {
        return this.formatWithComma(half.floor().toString());
      } else {
        return this.formatWithComma(half.ceil().toString());
      }
    } catch {
      return '';
    }
  }
  get totalInsuranceAmount(): string {
    const h = this.healthInsuranceResult ? this.healthInsuranceAmount.replace(/,/g, '') : '';
    const p = this.pensionInsuranceResult ? this.pensionInsuranceAmount.replace(/,/g, '') : '';
    const c = this.careInsuranceResult ? this.careInsuranceAmount.replace(/,/g, '') : '';
    if (!h && !p && !c) return '';
    try {
      return this.formatWithComma(new Decimal(h || 0).plus(new Decimal(p || 0)).plus(new Decimal(c || 0)).toString());
    } catch {
      return '';
    }
  }
  get totalInsuranceAmountCompany(): string {
    const h = this.healthInsuranceResult ? this.healthInsuranceAmountCompany.replace(/,/g, '') : '';
    const p = this.pensionInsuranceResult ? this.pensionInsuranceAmountCompany.replace(/,/g, '') : '';
    const c = this.careInsuranceResult ? this.careInsuranceAmountCompany.replace(/,/g, '') : '';
    if (!h && !p && !c) return '';
    try {
      return this.formatWithComma(new Decimal(h || 0).plus(new Decimal(p || 0)).plus(new Decimal(c || 0)).toString());
    } catch {
      return '';
    }
  }
  get totalInsuranceAmountEmployee(): string {
    const h = this.healthInsuranceResult ? this.healthInsuranceAmountEmployee.replace(/,/g, '') : '';
    const p = this.pensionInsuranceResult ? this.pensionInsuranceAmountEmployee.replace(/,/g, '') : '';
    const c = this.careInsuranceResult ? this.careInsuranceAmountEmployee.replace(/,/g, '') : '';
    if (!h && !p && !c) return '';
    try {
      return this.formatWithComma(new Decimal(h || 0).plus(new Decimal(p || 0)).plus(new Decimal(c || 0)).toString());
    } catch {
      return '';
    }
  }

  async saveBonusCalc() {
    if (!this.companyId || !this.employeeId || !this.latestBonus) return;
    // bonusコレクションの最新ドキュメント参照
    const bonusCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus');
    // 最新のbonusドキュメントIDを取得
    const bonusQuery = query(bonusCol, orderBy('createdAt', 'desc'), limit(1));
    const bonusSnap = await getDocs(bonusQuery);
    if (bonusSnap.empty) return;
    const bonusDocRef = doc(bonusCol, bonusSnap.docs[0].id);
    // 保存データ作成
    const saveData: any = {
      calcAt: new Date(),
      healthInsuranceTotal: this.healthInsuranceAmount.replace(/,/g, ''),
      healthInsuranceCompany: this.healthInsuranceAmountCompany.replace(/,/g, ''),
      healthInsuranceEmployee: this.healthInsuranceAmountEmployee.replace(/,/g, ''),
      careInsuranceTotal: this.careInsuranceAmount.replace(/,/g, ''),
      careInsuranceCompany: this.careInsuranceAmountCompany.replace(/,/g, ''),
      careInsuranceEmployee: this.careInsuranceAmountEmployee.replace(/,/g, ''),
      pensionInsuranceTotal: this.pensionInsuranceAmount.replace(/,/g, ''),
      pensionInsuranceCompany: this.pensionInsuranceAmountCompany.replace(/,/g, ''),
      pensionInsuranceEmployee: this.pensionInsuranceAmountEmployee.replace(/,/g, ''),
      total: this.totalInsuranceAmount.replace(/,/g, ''),
      totalCompany: this.totalInsuranceAmountCompany.replace(/,/g, ''),
      totalEmployee: this.totalInsuranceAmountEmployee.replace(/,/g, ''),
    };
    await import('@angular/fire/firestore').then(m => m.updateDoc(bonusDocRef, saveData));
    alert('計算結果を保存しました。');
    this.router.navigate(['/employee-detail', this.employeeId]);
  }
}
