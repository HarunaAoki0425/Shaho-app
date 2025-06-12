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
  
  
  }
