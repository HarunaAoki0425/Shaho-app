import { Component, OnInit, AfterViewChecked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, getDocs, doc, getDoc, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import Decimal from 'decimal.js';
import { JudgeComponent } from '../judge/judge.component';

@Component({
  selector: 'app-calculate',
  imports: [CommonModule],
  templateUrl: './calculate.component.html',
  styleUrl: './calculate.component.css'
})
export class CalculateComponent implements OnInit, AfterViewChecked {
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
  public standardsList: any[] = [];
  public isLoading: boolean = true;
  public eligibilityResult: any = null;
  public isSocialInsuranceExcluded: boolean = false;
  public healthInsuranceResult: boolean = false;
  public careInsuranceResult: boolean = false;
  public pensionInsuranceResult: boolean = false;
  public hasUnsavedCalc: boolean = false;
  public hasSavedExcludedInsurance: boolean = false;
  private triedSaveExcluded: boolean = false;
  constructor(private route: ActivatedRoute, private firestore: Firestore, public router: Router) {}
  async ngOnInit() {
    this.isLoading = true;
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
          // standardsサブコレクション取得（createdAt降順でソート）
          const standardsCol = collection(this.firestore, `companies/${this.companyId}/employees/${this.employeesId}/standards`);
          const standardsSnap = await getDocs(standardsCol);
          this.standardsList = (standardsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })) as any[])
            .filter(item => !!item.createdAt)
            .map(item => ({
              ...item,
              _millis: item.createdAt?.toDate ? item.createdAt.toDate().getTime() : (item.createdAt ? new Date(item.createdAt).getTime() : 0)
            }))
            .sort((a, b) => b._millis - a._millis);
          // 社会保険要否判定の結果をコンソールに出力
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
          // 健康保険判定結果をコンソールに出力
          const healthInsuranceResult = JudgeComponent.judgeHealthInsurance(this.employeeData);
          console.log('[健康保険判定]', healthInsuranceResult);
          // 介護保険判定結果をコンソールに出力
          const careInsuranceResult = JudgeComponent.judgeCareInsurance(this.employeeData);
          console.log('[介護保険判定]', careInsuranceResult);
          // 厚生年金判定結果をコンソールに出力
          const pensionInsuranceResult = JudgeComponent.judgePensionInsurance(this.employeeData);
          console.log('[厚生年金判定]', pensionInsuranceResult);
          // 国際社会保険判定
          if (this.employeeData.dispatchedAbroad !== '該当しない') {
            const internationalSocialInsuranceResult = JudgeComponent.judgeInternationalSocialInsurance(this.employeeData);
            console.log('[海外派遣判定]', internationalSocialInsuranceResult);
            if (!internationalSocialInsuranceResult) {
              this.isSocialInsuranceExcluded = true;
              this.isLoading = false;
              return;
            }
          } else {
            console.log('[海外派遣判定] 判定しない');
          }
          // 各保険判定結果をプロパティに格納
          this.healthInsuranceResult = JudgeComponent.judgeHealthInsurance(this.employeeData);
          this.careInsuranceResult = JudgeComponent.judgeCareInsurance(this.employeeData);
          this.pensionInsuranceResult = JudgeComponent.judgePensionInsurance(this.employeeData);
          // 判定ロジック呼び出し
          this.eligibilityResult = JudgeComponent.judgeEligibility(this.employeeData);
          this.isLoading = false;
          await this.checkUnsavedCalc();
          // 自動保存処理
          if (this.hasUnsavedCalc) {
            await this.onSaveCalc(true); // true: 自動保存
          }
          return;
        }
      }
    }
    console.log('currentNendo:', this.currentNendo);
    this.isLoading = false;
    await this.checkUnsavedCalc();
  }
  ngAfterViewChecked() {
    if (this.isSocialInsuranceExcluded && !this.hasSavedExcludedInsurance && !this.triedSaveExcluded) {
      this.triedSaveExcluded = true;
      this.saveExcludedInsurance();
    }
  }
  async saveExcludedInsurance() {
    const employeeRef = doc(this.firestore, `companies/${this.companyId}/employees/${this.employeesId}`);
    const insurancesCol = collection(employeeRef, 'insurances');
    const latestStandard = this.standardsList && this.standardsList.length > 0 ? this.standardsList[0] : null;
    const standardIdToSave = latestStandard ? latestStandard.id : null;
    // 既存のinsurancesを取得
    const insurancesSnap = await getDocs(insurancesCol);
    const insurancesList = insurancesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
    // 同じstandardIdが既に存在する場合は保存しない
    if (standardIdToSave && insurancesList.some(i => i.standardId === standardIdToSave)) {
      console.log('[DEBUG] 社会保険対象外: 同じstandardIdが既に存在するため保存しません', standardIdToSave);
      this.hasSavedExcludedInsurance = true;
      return;
    }
    console.log('[DEBUG] 社会保険対象外: insurances保存開始', {
      employeeId: this.employeesId,
      companyId: this.companyId,
      standardId: standardIdToSave
    });
    await addDoc(insurancesCol, {
      createdAt: serverTimestamp(),
      standardId: standardIdToSave,
      isInsuranceTarget: false
    });
    console.log('[DEBUG] 社会保険対象外: insurances保存完了');
    this.hasSavedExcludedInsurance = true;
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
  get latestStandard() {
    if (!this.standardsList || this.standardsList.length === 0) return null;
    const validList = this.standardsList.filter(item => !!item.createdAt);
    if (validList.length === 0) return null;
    return validList
      .map(item => ({
        ...item,
        _millis: item.createdAt?.toDate ? item.createdAt.toDate().getTime() : (item.createdAt ? new Date(item.createdAt).getTime() : 0)
      }))
      .sort((a, b) => b._millis - a._millis)[0];
  }
  get healthInsuranceAmount(): string {
    if (!this.healthInsuranceResult || !this.insuranceRateData) return '';
    const stdSalary = this.latestStandard?.kenpoStandardMonthly ?? (this.employeeData ? this.employeeData.stdSalaryHealth : null);
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
  get pensionInsuranceAmount(): string {
    if (!this.pensionInsuranceResult || !this.insuranceRateData) return '';
    const stdSalary = this.latestStandard?.nenkinStandardMonthly ?? (this.employeeData ? this.employeeData.stdSalaryPension : null);
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
    const stdSalary = this.latestStandard?.kenpoStandardMonthly ?? (this.employeeData ? this.employeeData.stdSalaryHealth : null);
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
  get stdSalaryHealthWithComma(): string {
    if (!this.employeeData || this.employeeData.stdSalaryHealth == null) return '';
    return this.formatWithComma(this.employeeData.stdSalaryHealth);
  }
  get stdSalaryPensionWithComma(): string {
    if (!this.employeeData || this.employeeData.stdSalaryPension == null) return '';
    return this.formatWithComma(this.employeeData.stdSalaryPension);
  }
  private async checkUnsavedCalc() {
    if (!this.companyId || !this.employeesId || !this.latestStandard) {
      this.hasUnsavedCalc = false;
      return;
    }
    const insurancesCol = collection(this.firestore, `companies/${this.companyId}/employees/${this.employeesId}/insurances`);
    const insurancesSnap = await getDocs(insurancesCol);
    const insurancesList = insurancesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }))
      .filter(item => !!item.createdAt)
      .map(item => ({
        ...item,
        _millis: item.createdAt?.toDate ? item.createdAt.toDate().getTime() : (item.createdAt ? new Date(item.createdAt).getTime() : 0)
      }))
      .sort((a, b) => b._millis - a._millis);
    const latestInsurance = insurancesList[0];
    const usedStandardId = this.latestStandard?.id;
    this.hasUnsavedCalc = !(latestInsurance && latestInsurance.standardId === usedStandardId);
  }
  onSaveCalc = async (autoSave: boolean = false) => {
    if (!this.companyId || !this.employeesId || !this.latestStandard) return;
    const insurancesCol = collection(this.firestore, `companies/${this.companyId}/employees/${this.employeesId}/insurances`);
    const insurancesSnap = await getDocs(insurancesCol);
    const insurancesList = insurancesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }))
      .filter(item => !!item.createdAt)
      .map(item => ({
        ...item,
        _millis: item.createdAt?.toDate ? item.createdAt.toDate().getTime() : (item.createdAt ? new Date(item.createdAt).getTime() : 0)
      }))
      .sort((a, b) => b._millis - a._millis);
    const latestInsurance = insurancesList[0];
    const usedStandardId = this.latestStandard?.id;
    if (latestInsurance && latestInsurance.standardId === usedStandardId) {
      if (!autoSave) alert('すでにこの標準報酬月額・等級で計算結果が保存されています。');
      return;
    }
    // 計算結果を保存（standardIdも含める）
    const saveData: any = {
      standardId: usedStandardId,
      employeeId: this.employeesId,
      createdAt: new Date(),
    };
    // もしinsurancesListが空ならmemoを追加
    if (insurancesList.length === 0) {
      saveData.memo = '登録時算出';
    }
    if (insurancesList.length > 0) {
      saveData.memo = '情報更新時算出';
    }
    if (this.healthInsuranceResult) {
      saveData.healthInsuranceTotal = this.healthInsuranceAmount.replace(/,/g, '');
      saveData.healthInsuranceCompany = this.healthInsuranceAmountCompany.replace(/,/g, '');
      saveData.healthInsuranceEmployee = this.healthInsuranceAmountEmployee.replace(/,/g, '');
    }
    if (this.careInsuranceResult) {
      saveData.careInsuranceTotal = this.careInsuranceAmount.replace(/,/g, '');
      saveData.careInsuranceCompany = this.careInsuranceAmountCompany.replace(/,/g, '');
      saveData.careInsuranceEmployee = this.careInsuranceAmountEmployee.replace(/,/g, '');
    }
    if (this.pensionInsuranceResult) {
      saveData.pensionInsuranceTotal = this.pensionInsuranceAmount.replace(/,/g, '');
      saveData.pensionInsuranceCompany = this.pensionInsuranceAmountCompany.replace(/,/g, '');
      saveData.pensionInsuranceEmployee = this.pensionInsuranceAmountEmployee.replace(/,/g, '');
    }
    // 合計は含まれる保険のみで計算
    saveData.total = this.totalInsuranceAmount.replace(/,/g, '');
    saveData.totalCompany = this.totalInsuranceAmountCompany.replace(/,/g, '');
    saveData.totalEmployee = this.totalInsuranceAmountEmployee.replace(/,/g, '');
    await addDoc(insurancesCol, saveData);
    if (!autoSave) {
      alert('計算結果を保存しました。');
    }
  };
  onNavigateToDetail = async () => {
    await this.checkUnsavedCalc();
    if (this.hasUnsavedCalc) {
      alert('計算結果を保存してください');
      return;
    }
    this.router.navigate(['/employee-detail', this.employeesId]);
  };
}
