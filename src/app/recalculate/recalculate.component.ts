import { Component, OnInit, inject } from '@angular/core';
import { Firestore, collection, getDocs, query, where, doc, addDoc } from '@angular/fire/firestore';
import { Auth, getAuth } from '@angular/fire/auth';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { JudgeComponent } from '../judge/judge.component';

@Component({
  selector: 'app-recalculate',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './recalculate.component.html',
  styleUrl: './recalculate.component.css'
})
export class RecalculateComponent implements OnInit {
  user: any = null;
  companies: any[] = [];
  employees: any[] = [];
  offices: any[] = [];
  insurances: any[] = [];
  standards: any[] = [];
  bonuses: any[] = [];
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  isCalculating = false;
  calcMessage = '';
  isLoading = true;
  loadingMessage = '従業員情報取得中・・・';

  async ngOnInit() {
    this.isLoading = true;
    this.loadingMessage = '従業員情報取得中・・・';
    // ログインユーザー取得
    const auth = getAuth();
    this.user = auth.currentUser;
    if (!this.user) return;
    // createdByが自分のcompanies取得
    const companiesCol = collection(this.firestore, 'companies');
    const companiesQuery = query(companiesCol, where('createdBy', '==', this.user.uid));
    const companiesSnap = await getDocs(companiesQuery);
    this.companies = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    // 各companyごとにサブコレクション取得
    for (const company of this.companies) {
      // employees
      const employeesCol = collection(this.firestore, 'companies', company.id, 'employees');
      const employeesSnap = await getDocs(employeesCol);
      const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any, companyId: company.id }));
      this.employees.push(...employees);
      // offices
      const officesCol = collection(this.firestore, 'companies', company.id, 'offices');
      const officesSnap = await getDocs(officesCol);
      const offices = officesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any, companyId: company.id }));
      this.offices.push(...offices);
      // 各employeeごとにinsurances, standards, bonus
      for (const emp of employees) {
        const insurancesCol = collection(this.firestore, 'companies', company.id, 'employees', emp.id, 'insurances');
        const insurancesSnap = await getDocs(insurancesCol);
        const insurances = insurancesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any, employeeId: emp.id, companyId: company.id }));
        this.insurances.push(...insurances);
        const standardsCol = collection(this.firestore, 'companies', company.id, 'employees', emp.id, 'standards');
        const standardsSnap = await getDocs(standardsCol);
        const standards = standardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any, employeeId: emp.id, companyId: company.id }));
        this.standards.push(...standards);
        const bonusCol = collection(this.firestore, 'companies', company.id, 'employees', emp.id, 'bonus');
        const bonusSnap = await getDocs(bonusCol);
        const bonuses = bonusSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any, employeeId: emp.id, companyId: company.id }));
        this.bonuses.push(...bonuses);
      }
    }
    // デバッグ用に全データを出力
    console.log('user:', this.user);
    console.log('companies:', this.companies);
    console.log('employees:', this.employees);
    console.log('offices:', this.offices);
    console.log('insurances:', this.insurances);
    console.log('standards:', this.standards);
    console.log('bonuses:', this.bonuses);
    this.isLoading = false;
    this.loadingMessage = '';
  }

  async onBatchRecalculate() {
    if (!this.companies.length || !this.employees.length || !this.offices.length) {
      alert('データが取得できていません');
      return;
    }
    this.isCalculating = true;
    this.calcMessage = '計算中・・・';
    let processed = 0;
    for (const company of this.companies) {
      const employees = this.employees.filter(e => e.companyId === company.id);
      const offices = this.offices.filter(o => o.companyId === company.id);
      for (const emp of employees) {
        const office = offices.find(o => o.id === emp.officesId);
        // 判定
        const isTarget = JudgeComponent.judgeSocialInsuranceRequired({ employee: emp, office, company });
        const isInternationalTarget = JudgeComponent.judgeInternationalSocialInsurance(emp);
        if (!isTarget || isInternationalTarget === false) continue;
        // 料率取得
        const insuranceRatesCol = collection(this.firestore, 'insurance_rates');
        const insuranceRatesSnap = await getDocs(insuranceRatesCol);
        const currentNendo = (() => {
          const today = new Date();
          const year = today.getFullYear();
          const month = today.getMonth() + 1;
          return month >= 4 ? year : year - 1;
        })();
        const insuranceRateData = insuranceRatesSnap.docs
          .map(doc => doc.data())
          .find(row => row['prefecture'] === office?.officePrefecture && String(row['year']) === String(currentNendo)) || null;
        if (!insuranceRateData) continue;
        // 標準報酬月額取得
        const standardsCol = collection(this.firestore, 'companies', company.id, 'employees', emp.id, 'standards');
        const standardsSnap = await getDocs(standardsCol);
        const standardsList = standardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        const latestStandard = standardsList.length > 0 ? standardsList.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return bTime - aTime;
        })[0] : null;
        if (!latestStandard) continue;
        // 計算
        const stdSalaryHealth = latestStandard.kenpoStandardMonthly ?? emp.stdSalaryHealth;
        const stdSalaryPension = latestStandard.nenkinStandardMonthly ?? emp.stdSalaryPension;
        const result: any = {
          standardId: latestStandard.id,
          employeeId: emp.id,
          createdAt: new Date(),
          memo: '一斉算出',
        };
        // 健康保険
        if (JudgeComponent.judgeHealthInsurance(emp)) {
          const h = stdSalaryHealth && insuranceRateData['health_insurance'] ? Math.round(stdSalaryHealth * insuranceRateData['health_insurance']) : 0;
          result.healthInsuranceTotal = h;
          result.healthInsuranceCompany = Math.floor(h / 2);
          result.healthInsuranceEmployee = h - result.healthInsuranceCompany;
        }
        // 介護保険
        if (JudgeComponent.judgeCareInsurance(emp)) {
          const c = stdSalaryHealth && insuranceRateData['care_insurance'] ? Math.round(stdSalaryHealth * insuranceRateData['care_insurance']) : 0;
          result.careInsuranceTotal = c;
          result.careInsuranceCompany = Math.floor(c / 2);
          result.careInsuranceEmployee = c - result.careInsuranceCompany;
        }
        // 厚生年金
        if (JudgeComponent.judgePensionInsurance(emp)) {
          const p = stdSalaryPension && insuranceRateData['pension_insurance'] ? Math.round(stdSalaryPension * insuranceRateData['pension_insurance']) : 0;
          result.pensionInsuranceTotal = p;
          result.pensionInsuranceCompany = Math.floor(p / 2);
          result.pensionInsuranceEmployee = p - result.pensionInsuranceCompany;
        }
        // 合計
        result.total = (result.healthInsuranceTotal || 0) + (result.careInsuranceTotal || 0) + (result.pensionInsuranceTotal || 0);
        result.totalCompany = (result.healthInsuranceCompany || 0) + (result.careInsuranceCompany || 0) + (result.pensionInsuranceCompany || 0);
        result.totalEmployee = (result.healthInsuranceEmployee || 0) + (result.careInsuranceEmployee || 0) + (result.pensionInsuranceEmployee || 0);
        // 保存
        const insurancesCol = collection(this.firestore, 'companies', company.id, 'employees', emp.id, 'insurances');
        await addDoc(insurancesCol, result);
        processed++;
      }
    }
    this.isCalculating = false;
    this.calcMessage = '計算が完了しました。';
    alert(`一斉計算が完了しました（${processed}件保存）`);
  }
}
