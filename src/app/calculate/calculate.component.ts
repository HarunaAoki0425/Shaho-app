import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, getDocs, doc, getDoc, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import Decimal from 'decimal.js';

@Component({
  selector: 'app-calculate',
  imports: [CommonModule],
  templateUrl: './calculate.component.html',
  styleUrl: './calculate.component.css'
})
export class CalculateComponent implements OnInit {
  employeesId: string = '';
  companyId: string = '';
  employeeData: any = null;
  companyData: any = null;
  officeData: any = null;
  insuranceRateData: any = null;
  public readonly currentNendo: number = (() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    return month >= 4 ? year : year - 1;
  })();
  constructor(private route: ActivatedRoute, private firestore: Firestore) {}
  async ngOnInit() {
    this.employeesId = this.route.snapshot.paramMap.get('id') || '';
    // companiesコレクションを全件取得
    const companiesCol = collection(this.firestore, 'companies');
    const companiesSnap = await getDocs(companiesCol);
    for (const companyDoc of companiesSnap.docs) {
      const employeesCol = collection(this.firestore, 'companies', companyDoc.id, 'employees');
      const employeesSnap = await getDocs(employeesCol);
      for (const empDoc of employeesSnap.docs) {
        if (empDoc.id === this.employeesId) {
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
                .find(row => row['prefecture'] === this.officeData.officePrefecture && String(row['year']) === String(this.currentNendo)) || null;
            }
          }
          return;
        }
      }
    }
    console.log('currentNendo:', this.currentNendo);
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
  formatWithComma(value: string | number): string {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) return '';
    return num.toLocaleString();
  }
  get healthInsuranceAmount(): string {
    if (!this.employeeData || !this.insuranceRateData) return '';
    const salary = this.employeeData.stdSalaryHealth;
    const rate = this.insuranceRateData.health_insurance;
    if (salary == null || rate == null) return '';
    try {
      return this.formatWithComma(new Decimal(salary).times(new Decimal(rate)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    } catch {
      return '';
    }
  }
  get pensionInsuranceAmount(): string {
    if (!this.employeeData || !this.insuranceRateData) return '';
    const salary = this.employeeData.stdSalaryPension;
    const rate = this.insuranceRateData.pension_insurance;
    if (salary == null || rate == null) return '';
    try {
      return this.formatWithComma(new Decimal(salary).times(new Decimal(rate)).toFixed(0));
    } catch {
      return '';
    }
  }
  get healthInsuranceAmountCompany(): string {
    const total = this.healthInsuranceAmount.replace(/,/g, '');
    if (!total) return '';
    try {
      return this.formatWithComma(new Decimal(total).div(2).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    } catch {
      return '';
    }
  }
  get healthInsuranceAmountEmployee(): string {
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
  get pensionInsuranceAmountCompany(): string {
    const total = this.pensionInsuranceAmount.replace(/,/g, '');
    if (!total) return '';
    try {
      return this.formatWithComma(new Decimal(total).div(2).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    } catch {
      return '';
    }
  }
  get pensionInsuranceAmountEmployee(): string {
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
    if (!this.employeeData || !this.insuranceRateData) return '';
    const salary = this.employeeData.stdSalaryHealth;
    const rate = this.insuranceRateData.care_insurance;
    if (salary == null || rate == null) return '';
    try {
      return this.formatWithComma(new Decimal(salary).times(new Decimal(rate)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    } catch {
      return '';
    }
  }
  get careInsuranceAmountCompany(): string {
    const total = this.careInsuranceAmount.replace(/,/g, '');
    if (!total) return '';
    try {
      return this.formatWithComma(new Decimal(total).div(2).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    } catch {
      return '';
    }
  }
  get careInsuranceAmountEmployee(): string {
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
    const h = this.healthInsuranceAmount.replace(/,/g, '');
    const p = this.pensionInsuranceAmount.replace(/,/g, '');
    const c = this.careInsuranceAmount.replace(/,/g, '');
    if (!h && !p && !c) return '';
    try {
      return this.formatWithComma(new Decimal(h || 0).plus(new Decimal(p || 0)).plus(new Decimal(c || 0)).toString());
    } catch {
      return '';
    }
  }
  get totalInsuranceAmountCompany(): string {
    const h = this.healthInsuranceAmountCompany.replace(/,/g, '');
    const p = this.pensionInsuranceAmountCompany.replace(/,/g, '');
    const c = this.careInsuranceAmountCompany.replace(/,/g, '');
    if (!h && !p && !c) return '';
    try {
      return this.formatWithComma(new Decimal(h || 0).plus(new Decimal(p || 0)).plus(new Decimal(c || 0)).toString());
    } catch {
      return '';
    }
  }
  get totalInsuranceAmountEmployee(): string {
    const h = this.healthInsuranceAmountEmployee.replace(/,/g, '');
    const p = this.pensionInsuranceAmountEmployee.replace(/,/g, '');
    const c = this.careInsuranceAmountEmployee.replace(/,/g, '');
    if (!h && !p && !c) return '';
    try {
      return this.formatWithComma(new Decimal(h || 0).plus(new Decimal(p || 0)).plus(new Decimal(c || 0)).toString());
    } catch {
      return '';
    }
  }
  get stdSalaryHealthWithComma(): string {
    if (!this.employeeData || this.employeeData.stdSalaryHealth == null) return '';
    return this.formatWithComma(this.employeeData.stdSalaryHealth);
  }
  get stdSalaryPensionWithComma(): string {
    if (!this.employeeData || this.employeeData.stdSalaryPension == null) return '';
    return this.formatWithComma(this.employeeData.stdSalaryPension);
  }
  onSaveCalc = async () => {
    if (!this.employeesId) return;
    const insurancesCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeesId, 'insurances');
    const data = {
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
      employeeId: this.employeesId,
      createdAt: serverTimestamp(),
    };
    await addDoc(insurancesCol, data);
  };
}
