import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Firestore, collection, getDocs, query, where, addDoc, serverTimestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-employee-add',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-add.component.html',
  styleUrl: './employee-add.component.css'
})
export class EmployeeAddComponent implements OnInit {
  birthdate: string = '';
  age: number | null = null;
  officeList: any[] = [];
  selectedOfficeId: string = '';
  currentUser: User | null = null;
  companyList: any[] = [];
  employmentType: string = '';
  otherEmploymentType: string = '';
  employmentPeriodType: string = '';
  employmentPeriodStart: string = '';
  employmentPeriodEnd: string = '';
  monthlyDays: number | null = null;
  weeklyHours: number | null = null;
  workDays: number | null = null;
  workHours: number | null = null;
  salaryCash: string | number | null = null;
  salaryInKind: string | number | null = null;
  stdSalaryHealth: string | number | null = null;
  stdSalaryPension: string | number | null = null;
  isStudent: string = '';
  multiOffice: string = '';
  selectedOfficeType: string = '';
  combinedSalary: string | number | null = null;
  combinedStdSalary: string | number | null = null;
  dependentStatus: string = '';
  dependentRelations: string[] = [''];
  showInfoPopup: boolean = false;
  showAgreementInfoPopup: boolean = false;
  dispatchedAbroad: string = '';
  temporaryDispatch: string = '';
  socialSecurityAgreement: string = '';
  nationality: string = '';
  selectedCompanyId: string = '';
  lastName: string = '';
  firstName: string = '';
  joinDate: string = '';
  leaveDate: string = '';
  gender: string = '';
  kenpoStandardMonthlySalaries: any[] = [];
  nenkinStandardMonthlySalaries: any[] = [];
  combinedStdSalaryKenpo: string | number | null = null;
  combinedStdSalaryNenkin: string | number | null = null;
  kenpoSalaryError: string = '';
  nenkinSalaryError: string = '';
  combinedKenpoSalaryError: string = '';
  combinedNenkinSalaryError: string = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);

  async ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.currentUser = user;
        await this.loadUserCompanies();
        await this.loadUserOffices();
      }
    });
    // 標準報酬月額（健康保険・厚生年金）マスタ取得
    const kenpoCol = collection(this.firestore, 'kenpo_standardMonthlySarary');
    const nenkinCol = collection(this.firestore, 'nenkin_standardMonthlySarary');
    const kenpoSnap = await getDocs(kenpoCol);
    const nenkinSnap = await getDocs(nenkinCol);
    this.kenpoStandardMonthlySalaries = kenpoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => Number((a as any).grade ?? 0) - Number((b as any).grade ?? 0));
    this.nenkinStandardMonthlySalaries = nenkinSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => Number((a as any).nenkinGrade ?? 0) - Number((b as any).nenkinGrade ?? 0));
  }

  async loadUserOffices() {
    if (!this.currentUser) return;
    this.officeList = [];
    for (const company of this.companyList) {
      const officesCol = collection(this.firestore, 'companies', company.id, 'offices');
      const officesSnap = await getDocs(officesCol);
      const offices = officesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), companyId: company.id }));
      this.officeList.push(...offices);
    }
  }

  async loadUserCompanies() {
    if (!this.currentUser) return;
    const companiesCol = collection(this.firestore, 'companies');
    const q = query(companiesCol, where('createdBy', '==', this.currentUser.uid));
    const companiesSnap = await getDocs(q);
    this.companyList = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  onBirthdateChange(event: any) {
    const value = event.target.value;
    this.birthdate = value;
    if (value) {
      const today = new Date();
      const birth = new Date(value);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      this.age = age;
    } else {
      this.age = null;
    }
  }

  onEmploymentTypeChange(value: string) {
    this.employmentType = value;
    if (value === '正社員') {
      this.employmentPeriodType = '無期';
      if (this.monthlyDays !== null) {
        this.workDays = this.monthlyDays;
      }
      if (this.weeklyHours !== null) {
        this.workHours = this.weeklyHours;
      }
    }
  }

  onOfficeChange(officeId: string) {
    const office = this.officeList.find(o => o.id === officeId);
    if (office) {
      this.monthlyDays = office.monthlyDays ?? null;
      this.weeklyHours = office.weeklyHours ?? null;
      if (this.employmentType === '正社員') {
        this.workDays = this.monthlyDays;
        this.workHours = this.weeklyHours;
      }
    } else {
      this.monthlyDays = null;
      this.weeklyHours = null;
      if (this.employmentType === '正社員') {
        this.workDays = null;
        this.workHours = null;
      }
    }
  }

  formatNumber(field: string) {
    switch (field) {
      case 'salaryCash':
        if (typeof this.salaryCash === 'string') {
          const num = Number(this.salaryCash.replace(/,/g, ''));
          this.salaryCash = isNaN(num) ? null : num;
        }
        break;
      case 'salaryInKind':
        if (typeof this.salaryInKind === 'string') {
          const num = Number(this.salaryInKind.replace(/,/g, ''));
          this.salaryInKind = isNaN(num) ? null : num;
        }
        break;
      case 'stdSalaryHealth':
        if (typeof this.stdSalaryHealth === 'string') {
          const num = Number(this.stdSalaryHealth.replace(/,/g, ''));
          this.stdSalaryHealth = isNaN(num) ? null : num;
        }
        break;
      case 'stdSalaryPension':
        if (typeof this.stdSalaryPension === 'string') {
          const num = Number(this.stdSalaryPension.replace(/,/g, ''));
          this.stdSalaryPension = isNaN(num) ? null : num;
        }
        break;
    }
  }

  formatWithComma(value: string | number | null): string {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : Number(value.toString().replace(/,/g, ''));
    if (isNaN(num)) return '';
    return num.toLocaleString();
  }

  onCommaInput(event: any, field: string) {
    const raw = event.target.value.replace(/,/g, '');
    if (raw === '') {
      switch (field) {
        case 'salaryCash': this.salaryCash = null; break;
        case 'salaryInKind': this.salaryInKind = null; break;
        case 'stdSalaryHealth': this.stdSalaryHealth = null; break;
        case 'stdSalaryPension': this.stdSalaryPension = null; break;
        case 'combinedSalary': this.combinedSalary = null; break;
        case 'combinedStdSalary': this.combinedStdSalary = null; break;
      }
      return;
    }
    const num = Number(raw);
    switch (field) {
      case 'salaryCash':
        this.salaryCash = isNaN(num) ? '' : num;
        break;
      case 'salaryInKind':
        this.salaryInKind = isNaN(num) ? '' : num;
        break;
      case 'stdSalaryHealth':
        this.stdSalaryHealth = isNaN(num) ? '' : num;
        break;
      case 'stdSalaryPension':
        this.stdSalaryPension = isNaN(num) ? '' : num;
        break;
      case 'combinedSalary':
        this.combinedSalary = isNaN(num) ? '' : num;
        break;
      case 'combinedStdSalary':
        this.combinedStdSalary = isNaN(num) ? '' : num;
        break;
    }
  }

  addRelation() {
    this.dependentRelations.push('');
  }

  removeRelation(index: number) {
    if (this.dependentRelations.length > 1) {
      this.dependentRelations.splice(index, 1);
    }
  }

  openInfoPopup() {
    this.showInfoPopup = true;
  }

  closeInfoPopup() {
    this.showInfoPopup = false;
  }

  openAgreementInfoPopup() {
    this.showAgreementInfoPopup = true;
  }

  closeAgreementInfoPopup() {
    this.showAgreementInfoPopup = false;
  }

  get salaryTotal(): string | number {
    if ((this.salaryCash === null || this.salaryCash === '' || isNaN(Number(this.salaryCash)))
      && (this.salaryInKind === null || this.salaryInKind === '' || isNaN(Number(this.salaryInKind)))) {
      return '';
    }
    const cash = typeof this.salaryCash === 'number' ? this.salaryCash : Number((this.salaryCash || '').toString().replace(/,/g, ''));
    const inKind = typeof this.salaryInKind === 'number' ? this.salaryInKind : Number((this.salaryInKind || '').toString().replace(/,/g, ''));
    const total = (isNaN(cash) ? 0 : cash) + (isNaN(inKind) ? 0 : inKind);
    return total;
  }

  onWorkDaysInput(event: any) {
    let value = event.target.value;
    if (value.startsWith('.')) value = '0' + value;
    if (value === '' || value === null) {
      this.workDays = null;
      return;
    }
    const num = Number(value);
    if (/^(?:0|[1-9]|[1-2][0-9]|3[01])(?:\.\d*)?$/.test(value) && num >= 0 && num <= 31) {
      this.workDays = value;
    } else {
      event.target.value = this.workDays ?? '';
    }
  }

  onWorkHoursInput(event: any) {
    let value = event.target.value;
    if (value.startsWith('.')) value = '0' + value;
    if (value === '' || value === null) {
      this.workHours = null;
      return;
    }
    const num = Number(value);
    if (/^(?:0|[1-9]|[1-9][0-9]|100)(?:\.\d*)?$/.test(value) && num >= 0 && num <= 100) {
      this.workHours = value;
    } else {
      event.target.value = this.workHours ?? '';
    }
  }

  onSalaryInput(event: any, field: 'salaryCash' | 'salaryInKind' | 'stdSalaryHealth' | 'stdSalaryPension' | 'combinedSalary' | 'combinedStdSalary') {
    const value = event.target.value.replace(/,/g, '');
    if (value === '' || value === null) {
      this[field] = null;
      return;
    }
    const num = Number(value);
    if (/^\d{1,10}$|^10000000000$/.test(value) && Number.isInteger(num) && num >= 1 && num <= 10000000000) {
      this[field] = num;
    } else {
      // 不正な値は無視して元の値を維持
      event.target.value = this[field] === null ? '' : this.formatWithComma(this[field]);
    }
  }

  onRelationInput(event: any, i: number) {
    const value = event.target.value;
    // 日本語（ひらがな・カタカナ・漢字・全角スペース）のみ許可
    const jp = value.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF66-\uFF9F\u3000]/g, '');
    this.dependentRelations[i] = jp;
    event.target.value = jp;
  }

  async onRegister() {
    // 必須項目バリデーション
    if (!this.lastName || !this.firstName) {
      alert('氏名（姓・名）は必須です');
      return;
    }
    if (!this.gender) {
      alert('性別は必須です');
      return;
    }
    if (!this.birthdate) {
      alert('生年月日は必須です');
      return;
    }
    if (!this.employmentType || this.employmentType === '' || this.employmentType === '選択してください') {
      alert('雇用形態は必須です');
      return;
    }
    if (this.employmentType === 'その他' && (!this.otherEmploymentType || this.otherEmploymentType.trim() === '')) {
      alert('雇用形態「その他」の内容を入力してください');
      return;
    }
    if (!this.selectedOfficeId || this.selectedOfficeId === '' || this.selectedOfficeId === '選択してください') {
      alert('所属事業所は必須です');
      return;
    }
    if (this.workDays === null || String(this.workDays) === '' || isNaN(Number(this.workDays))) {
      alert('所定労働日数は必須です');
      return;
    }
    if (this.workHours === null || String(this.workHours) === '' || isNaN(Number(this.workHours))) {
      alert('所定労働時間は必須です');
      return;
    }
    if ((this.salaryCash === null || this.salaryCash === '' || isNaN(Number(this.salaryCash))) && (this.salaryInKind === null || this.salaryInKind === '' || isNaN(Number(this.salaryInKind)))) {
      alert('報酬月額（通貨・現物）のいずれかは必須です');
      return;
    }
    if (!this.joinDate) {
      alert('資格取得年月日は必須です');
      return;
    }
    if (!this.isStudent || this.isStudent === '' || this.isStudent === '選択してください') {
      alert('学生区分は必須です');
      return;
    }
    if (!this.multiOffice || this.multiOffice === '' || this.multiOffice === '選択してください') {
      alert('二以上事業所勤務区分は必須です');
      return;
    }
    if (!this.dependentStatus || this.dependentStatus === '' || this.dependentStatus === '選択してください') {
      alert('被扶養者の有無は必須です');
      return;
    }
    if (this.dependentStatus === '被扶養者あり') {
      if (!this.dependentRelations || this.dependentRelations.length === 0 || this.dependentRelations.some(r => !r || r.trim() === '')) {
        alert('被扶養者がある場合は続柄をすべて入力してください');
        return;
      }
    }
    if (!this.dispatchedAbroad || this.dispatchedAbroad === '' || this.dispatchedAbroad === '選択してください') {
      alert('外国派遣労働者区分は必須です');
      return;
    }
    if (this.dispatchedAbroad && this.dispatchedAbroad !== '該当しない') {
      if (!this.socialSecurityAgreement || this.socialSecurityAgreement === '' || this.socialSecurityAgreement === '選択してください') {
        alert('外国派遣労働者区分が「あり」の場合は社会保障協定国に該当するか選択してください');
        return;
      }
      if (this.socialSecurityAgreement === '該当する') {
        if (!this.temporaryDispatch || this.temporaryDispatch === '' || this.temporaryDispatch === '選択してください') {
          alert('社会保障協定国が該当する場合は一時派遣区分を選択してください');
          return;
        }
      }
    }
    if (this.employmentPeriodType === '有期') {
      if (!this.employmentPeriodStart) {
        alert('雇用契約期間が有期の場合、開始年月日は必須です');
        return;
      }
      if (!this.employmentPeriodEnd) {
        alert('雇用契約期間が有期の場合、終了年月日は必須です');
        return;
      }
    }
    if (this.multiOffice === '二以上事業所勤務') {
      if (!this.selectedOfficeType || this.selectedOfficeType === '' || this.selectedOfficeType === '選択してください') {
        alert('二以上事業所勤務該当時は「選択事業所／非選択事業所」を選択してください');
        return;
      }
      if (this.combinedSalary === null || this.combinedSalary === '' || isNaN(Number(this.combinedSalary))) {
        alert('二以上事業所勤務該当時は「合算報酬月額」を入力してください');
        return;
      }
    }
    // 会社IDの取得
    const companyId = this.selectedCompanyId || (this.companyList.length === 1 ? this.companyList[0].id : null);
    if (!companyId) {
      alert('会社が選択されていません');
      return;
    }
    // 管理番号の採番
    const employeesCol = collection(this.firestore, 'companies', companyId, 'employees');
    const snapshot = await getDocs(employeesCol);
    let maxManagementNumber = 0;
    snapshot.forEach(doc => {
      const num = Number(doc.data()['managementNumber']);
      if (!isNaN(num) && num > maxManagementNumber) {
        maxManagementNumber = num;
      }
    });
    const managementNumber = maxManagementNumber + 1;

    // 金額はカンマ除去して数値化
    const parseNumber = (val: any) => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val.toString().replace(/,/g, ''));
      return isNaN(num) ? null : num;
    };
    // true/false変換
    const toBool = (val: string) => val === '該当する' || val === '被扶養者あり';

    // Firestoreに保存するデータ
    const data = {
      lastName: this.lastName,
      firstName: this.firstName,
      gender: this.gender,
      birthdate: this.birthdate,
      age: this.age,
      nationality: this.nationality,
      officeName: this.officeList.find(o => o.id === this.selectedOfficeId)?.officeName || '',
      officesId: this.selectedOfficeId,
      employmentType: this.employmentType,
      employmentTypeOther: this.employmentType === 'その他' ? this.otherEmploymentType : '',
      employmentPeriodType: this.employmentPeriodType,
      employmentPeriodStart: this.employmentPeriodStart,
      employmentPeriodEnd: this.employmentPeriodEnd,
      workDays: String(this.workDays) === '' ? null : Number(this.workDays),
      workHours: String(this.workHours) === '' ? null : Number(this.workHours),
      salaryCash: (this.salaryCash === null || this.salaryCash === '' || isNaN(Number(this.salaryCash))) ? 0 : parseNumber(this.salaryCash),
      salaryInKind: (this.salaryInKind === null || this.salaryInKind === '' || isNaN(Number(this.salaryInKind))) ? 0 : parseNumber(this.salaryInKind),
      salaryTotal: parseNumber(this.salaryTotal),
      stdSalaryHealth: this.stdSalaryHealth === '' ? null : parseNumber(this.stdSalaryHealth),
      stdSalaryHealthGrade: this.kenpoStandardMonthlySalaries.find(item => String(item.standardMonthlySalary) === String(this.stdSalaryHealth))?.grade ?? null,
      stdSalaryPension: this.stdSalaryPension === '' ? null : parseNumber(this.stdSalaryPension),
      stdSalaryPensionGrade: this.nenkinStandardMonthlySalaries.find(item => String(item.nenkinGrade) === String(this.stdSalaryPension))?.nenkinGrade ?? null,
      joinDate: this.joinDate,
      leaveDate: this.leaveDate,
      isStudent: this.isStudent,
      multiOffice: this.multiOffice,
      selectedOfficeType: this.selectedOfficeType,
      combinedSalary: parseNumber(this.combinedSalary),
      combinedStdSalaryKenpo: this.combinedStdSalaryKenpo === '' ? null : parseNumber(this.combinedStdSalaryKenpo),
      combinedStdSalaryKenpoGrade: this.kenpoStandardMonthlySalaries.find(item => String(item.standardMonthlySalary) === String(this.combinedStdSalaryKenpo))?.grade ?? null,
      combinedStdSalaryNenkin: this.combinedStdSalaryNenkin === '' ? null : (() => {
        // 等級（grade）から金額（nenkinMonthly）を取得
        const nenkin = this.nenkinStandardMonthlySalaries.find(item => String(item.nenkinGrade) === String(this.combinedStdSalaryNenkin));
        return nenkin ? nenkin.nenkinMonthly : null;
      })(),
      combinedStdSalaryNenkinGrade: this.nenkinStandardMonthlySalaries.find(item => String(item.nenkinGrade) === String(this.combinedStdSalaryNenkin))?.nenkinGrade ?? null,
      dependentStatus: this.dependentStatus,
      dependentCount: this.dependentRelations.filter(r => r && r.trim()).length,
      dependentRelations: this.dependentRelations.filter(r => r && r.trim()),
      dispatchedAbroad: this.dispatchedAbroad,
      socialSecurityAgreement: this.socialSecurityAgreement,
      temporaryDispatch: this.temporaryDispatch,
      createdBy: this.currentUser?.uid || '',
      createdAt: serverTimestamp(),
      updatedBy: this.currentUser?.uid || '',
      updatedAt: serverTimestamp(),
      managementNumber,
      companiesId: companyId,
    };

    console.log('Preparing to save employee data to Firestore');
    try {
      // Firestore保存処理
      console.log('Saving employee data:', data);
      await addDoc(employeesCol, data);
      console.log('Employee data saved successfully');
      // 完了メッセージやリセット処理などは必要に応じて追加
    } catch (error) {
      console.error('Failed to save employee data:', error);
      // 既存のエラー時処理 ...
    }
  }

  onStdSalaryHealthChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const selected = this.kenpoStandardMonthlySalaries.find(item => item.standardMonthlySalary == value);
    if (selected && this.salaryTotal != null) {
      const salary = Number(this.salaryTotal);
      // 上限・下限がnull/空欄なら限度なし
      const start = (selected.monthlyRangeStart === null || selected.monthlyRangeStart === undefined || selected.monthlyRangeStart === '') ? 0 : selected.monthlyRangeStart;
      const end = (selected.monthlyRangeEnd === null || selected.monthlyRangeEnd === undefined || selected.monthlyRangeEnd === '') ? Infinity : selected.monthlyRangeEnd;
      if (salary >= start && salary < end) {
        console.log('報酬月額（合計）は標準報酬月額（健康保険・介護保険）の範囲内です');
        this.kenpoSalaryError = '';
      } else {
        console.log('報酬月額（合計）は標準報酬月額（健康保険・介護保険）の範囲外です');
        this.kenpoSalaryError = '報酬月額（合計）が標準報酬月額（健康保険・介護保険）の範囲外です';
      }
    } else {
      this.kenpoSalaryError = '';
    }
  }

  onStdSalaryPensionChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const selected = this.nenkinStandardMonthlySalaries.find(item => String(item.nenkinGrade) === value);
    if (selected && this.salaryTotal != null) {
      console.log('選択等級のnenkinStart:', selected.nenkinStart, 'nenkinEnd:', selected.nenkinEnd);
      const salary = Number(this.salaryTotal);
      // 上限・下限がnull/空欄なら限度なし
      const start = (selected.nenkinStart === null || selected.nenkinStart === undefined || selected.nenkinStart === '') ? 0 : selected.nenkinStart;
      const end = (selected.nenkinEnd === null || selected.nenkinEnd === undefined || selected.nenkinEnd === '') ? Infinity : selected.nenkinEnd;
      if (salary >= start && salary < end) {
        console.log('報酬月額（合計）は標準報酬月額（厚生年金）の範囲内です');
        this.nenkinSalaryError = '';
      } else {
        console.log('報酬月額（合計）は標準報酬月額（厚生年金）の範囲外です');
        this.nenkinSalaryError = '報酬月額（合計）が標準報酬月額（厚生年金）の範囲外です';
      }
    } else {
      this.nenkinSalaryError = '';
    }
  }

  checkCombinedKenpoSalaryRange() {
    const salary = Number(this.combinedSalary);
    const selected = this.kenpoStandardMonthlySalaries.find(item => String(item.standardMonthlySalary) === String(this.combinedStdSalaryKenpo));
    if (selected && !isNaN(salary)) {
      // 上限・下限がnull/空欄なら限度なし
      const start = (selected.monthlyRangeStart === null || selected.monthlyRangeStart === undefined || selected.monthlyRangeStart === '') ? 0 : selected.monthlyRangeStart;
      const end = (selected.monthlyRangeEnd === null || selected.monthlyRangeEnd === undefined || selected.monthlyRangeEnd === '') ? Infinity : selected.monthlyRangeEnd;
      if (salary >= start && salary < end) {
        this.combinedKenpoSalaryError = '';
      } else {
        this.combinedKenpoSalaryError = '合算報酬月額（通貨＋現物）が合算標準報酬月額（健康保険・介護保険）の範囲外です';
      }
    } else {
      this.combinedKenpoSalaryError = '';
    }
  }

  checkCombinedNenkinSalaryRange() {
    const salary = Number(this.combinedSalary);
    const selected = this.nenkinStandardMonthlySalaries.find(item => String(item.nenkinGrade) === String(this.combinedStdSalaryNenkin));
    if (selected && !isNaN(salary)) {
      // 上限・下限がnull/空欄なら限度なし
      const start = (selected.nenkinStart === null || selected.nenkinStart === undefined || selected.nenkinStart === '') ? 0 : selected.nenkinStart;
      const end = (selected.nenkinEnd === null || selected.nenkinEnd === undefined || selected.nenkinEnd === '') ? Infinity : selected.nenkinEnd;
      if (salary >= start && salary < end) {
        this.combinedNenkinSalaryError = '';
      } else {
        this.combinedNenkinSalaryError = '合算報酬月額（通貨＋現物）が合算標準報酬月額（厚生年金）の範囲外です';
      }
    } else {
      this.combinedNenkinSalaryError = '';
    }
  }

  onJoinDateChange(event: any) {
    // デバッグ出力削除済み
  }
}
