import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, getDocs, updateDoc, doc, addDoc, query, where, setDoc, deleteDoc, deleteField } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BonusComponent } from '../bonus/bonus.component';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BonusComponent],
  templateUrl: './employee-detail.component.html',
  styleUrl: './employee-detail.component.css'
})
export class EmployeeDetailComponent implements OnInit {
  currentUser: User | null = null;
  employee: any = null;
  autoStdSalaryHealth: number | null = null;
  autoStdSalaryHealthGrade: string | null = null;
  autoStdSalaryPension: number | null = null;
  autoStdSalaryPensionGrade: string | null = null;
  autoCombinedStdSalaryKenpo: number | null = null;
  autoCombinedStdSalaryKenpoGrade: string | null = null;
  autoCombinedStdSalaryNenkin: number | null = null;
  autoCombinedStdSalaryNenkinGrade: string | null = null;
  currentAge: number | null = null;
  fixedWages: string[] = Array(12).fill('');
  nonFixedWages: string[] = Array(12).fill('');
  savedFixedWages: string[] = Array(12).fill('');
  savedNonFixedWages: string[] = Array(12).fill('');
  isSaved: boolean[] = Array(12).fill(false);
  isEditing: boolean[] = Array(12).fill(false);
  justSaved: boolean[] = Array(12).fill(false);
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  displayFields = [
    { key: 'managementNumber', label: '管理番号' },
    { key: 'lastName', label: '氏名' },
    { key: 'gender', label: '性別' },
    { key: 'birthdate', label: '生年月日' },
    { key: 'nationality', label: '国籍' },
    { key: 'officeName', label: '事業所' },
    { key: 'employmentType', label: '雇用形態' },
    { key: 'employmentPeriodType', label: '雇用契約期間' },
    { key: 'employmentPeriodStart', label: '契約開始日' },
    { key: 'employmentPeriodEnd', label: '契約終了日' },
    { key: 'workDays', label: '所定労働日数（月）' },
    { key: 'workHours', label: '所定労働時間（週）' },
    { key: 'salaryCash', label: '報酬月額（通貨）' },
    { key: 'salaryInKind', label: '報酬月額（現物）' },
    { key: 'salaryTotal', label: '報酬月額（合計）' },
    { key: 'stdSalaryHealth', label: '標準報酬月額（健康保険・介護保険）' },
    { key: 'stdSalaryPension', label: '標準報酬月額（厚生年金）' },
    { key: 'joinDate', label: '資格取得年月日（入社日）' },
    { key: 'leaveDate', label: '資格喪失年月日（退職日）' },
    { key: 'isStudent', label: '学生区分' },
    { key: 'multiOffice', label: '二以上事業所勤務区分' },
    { key: 'selectedOfficeType', label: '選択事業所／非選択事業所' },
    { key: 'combinedSalary', label: '合算報酬月額（通貨＋現物）' },
    { key: 'combinedStdSalaryKenpo', label: '合算標準報酬月額（健康保険・介護保険）' },
    { key: 'combinedStdSalaryNenkin', label: '合算標準報酬月額（厚生年金）' },
    { key: 'dependentStatus', label: '被扶養者の有無' },
    { key: 'dependentRelations', label: '被扶養者続柄' },
    { key: 'dispatchedAbroad', label: '外国派遣労働者区分' },
    { key: 'socialSecurityAgreement', label: '社会保障協定国' },
    { key: 'temporaryDispatch', label: '一時派遣（5年以内）' }
  ];
  public employeeId: string | null = null;
  public currentNendo: string = '';
  months = ['4月','5月','6月','7月','8月','9月','10月','11月','12月','1月','2月','3月'];
  public standardsList: any[] = [];
  public insurancesList: any[] = [];
  public companyOffices: any[] = [];
  public isEditPersonal = false;
  private originalPersonalInfo: any = null;
  public isEditContract = false;
  private originalContractInfo: any = null;
  public companyEmploymentTypes: string[] = [];
  public isEditOther = false;
  private originalOtherInfo: any = null;
  public deductionYMList: string[] = [];
  private prevSalaryTotal: number | null = null;
  private prevSalaryTotalForConfirm: number | null = null;
  public isEditInsurance = false;
  private originalInsuranceInfo: any = null;
  public kenpoStandardMonthlyList: any[] = [];
  public nenkinStandardMonthlyList: any[] = [];
  public showMaternityLeaveInputs = false;
  public maternityLeaveStart: string = '';
  public maternityLeaveEnd: string = '';
  public isEditCombined = false;
  public tempCombinedSalary: string | number | null = null;
  public tempCombinedKenpoStandardMonthly: number | null = null;
  public tempCombinedKenpoGrade: string | null = null;
  public tempCombinedNenkinStandardMonthly: number | null = null;
  public tempCombinedNenkinGrade: string | null = null;
  public insurancesLoaded = false;
  showBonusInfoPopup = false;

  constructor() {}

  async ngOnInit() {
    // 年度（4月始まり）を自動計算
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    if (month >= 4) {
      this.currentNendo = `${year}年度`;
    } else {
      this.currentNendo = `${year - 1}年度`;
    }
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
    });
    const id = this.route.snapshot.paramMap.get('id');
    this.employeeId = id;
    if (id) {
      // 全companiesを取得し、各サブコレクションemployeesからid一致を探す
      const companiesCol = collection(this.firestore, 'companies');
      const companiesSnap = await getDocs(companiesCol);
      for (const companyDoc of companiesSnap.docs) {
        const employeesCol = collection(this.firestore, 'companies', companyDoc.id, 'employees');
        const employeesSnap = await getDocs(employeesCol);
        const empDoc = employeesSnap.docs.find(doc => doc.id === id);
        if (empDoc) {
          this.employee = empDoc.data();
          this.employee.companyId = companyDoc.id;
          // leaveDateが今月を過ぎていたら資格喪失済みフラグを保存
          if (this.employee.leaveDate) {
            const leave = new Date(this.employee.leaveDate);
            const now = new Date();
            // 今日が資格喪失日より後なら資格喪失済み
            if (now > leave) {
              const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${id}`);
              await updateDoc(employeeRef, { isLostQualification: true });
              this.employee.isLostQualification = true;
            }
          }
          // 会社の事業所一覧を取得
          const officesCol = collection(this.firestore, 'companies', companyDoc.id, 'offices');
          const officesSnap = await getDocs(officesCol);
          this.companyOffices = officesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // 会社の雇用形態配列を取得
          const companyData = companyDoc.data();
          this.companyEmploymentTypes = Array.isArray(companyData['employmentType']) ? companyData['employmentType'] : [];
          // 年齢再計算
          if (this.employee.birthdate) {
            const today = new Date();
            const birth = new Date(this.employee.birthdate);
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
              age--;
            }
            this.currentAge = age;
            if (this.employee.age !== age) {
              // Firestoreの年齢情報を上書き
              const companiesCol = collection(this.firestore, 'companies');
              const companiesSnap = await getDocs(companiesCol);
              for (const companyDoc of companiesSnap.docs) {
                const employeesCol = collection(this.firestore, 'companies', companyDoc.id, 'employees');
                const employeesSnap = await getDocs(employeesCol);
                const empDocToUpdate = employeesSnap.docs.find(doc => doc.id === id);
                if (empDocToUpdate) {
                  const empRef = empDocToUpdate.ref;
                  await updateDoc(empRef, { age });
                  break;
                }
              }
            }
          } else {
            this.currentAge = null;
          }

          // ここでmonthlySarary取得
          const employeeDocRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
          const monthlySararyCol = collection(employeeDocRef, 'monthlySarary');
          const q = query(monthlySararyCol, where('nendo', '==', this.currentNendo));
          const snap = await getDocs(q);
          snap.forEach(docSnap => {
            const data = docSnap.data();
            const idx = this.months.indexOf(data['month']);
            if (idx !== -1) {
              this.fixedWages[idx] = this.formatWithComma(String(data['fixedWages'] ?? ''));
              this.nonFixedWages[idx] = this.formatWithComma(String(data['nonFixedWages'] ?? ''));
              this.savedFixedWages[idx] = this.fixedWages[idx];
              this.savedNonFixedWages[idx] = this.nonFixedWages[idx];
              this.isSaved[idx] = true;
            }
          });
          // standardsサブコレクション取得
          const standardsCol = collection(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}/standards`);
          const standardsSnap = await getDocs(standardsCol);
          this.standardsList = standardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          await this.fetchInsurances();
          this.generateDeductionYMList();
          // 画面表示時にonMaternityLeaveを自動判定
          const start = this.employee.maternityLeaveStartDate;
          const end = this.employee.maternityLeaveEndDate;
          if (start && end) {
            const now = new Date();
            const startDate = new Date(start);
            const endDate = new Date(end);
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              if (now >= startDate && now <= endDate && !this.employee.onMaternityLeave) {
                const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
                await updateDoc(employeeRef, { onMaternityLeave: true });
                this.employee.onMaternityLeave = true;
              }
            }
          }
          // リロード後のアラート表示
          if (localStorage.getItem('showSeniorVoluntaryEnrollmentAlert') === '1') {
            const confirmed = window.confirm('厚生年金の算出をします');
            localStorage.removeItem('showSeniorVoluntaryEnrollmentAlert');
            if (confirmed) {
              this.router.navigate(['/calculate', this.employeeId]);
            } else {
              this.employee.seniorVoluntaryEnrollment = 'しない';
              if (this.employeeId && this.employee.companyId) {
                const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
                updateDoc(employeeRef, { seniorVoluntaryEnrollment: 'しない' });
              }
            }
          }
        }
      }
    }
  }

  async fetchInsurances() {
    if (!this.employee || !this.employee.companyId || !this.employeeId) return;
    const insurancesCol = collection(
      this.firestore,
      `companies/${this.employee.companyId}/employees/${this.employeeId}/insurances`
    );
    const insurancesSnap = await getDocs(insurancesCol);
    this.insurancesList = insurancesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    this.insurancesLoaded = true;
    this.cdr.detectChanges();
  }

  // 雇用形態の表示用
  get displayEmploymentType(): string {
    if (!this.employee) return '';
    if (this.employee.employmentType === 'その他' && this.employee.employmentTypeOther) {
      return `その他（${this.employee.employmentTypeOther}）`;
    }
    return this.employee.employmentType || '';
  }

  get hasUnnotified(): boolean {
    if (!this.employee) return false;
    const stdHealth = this.employee.stdSalaryHealth === null || this.employee.stdSalaryHealth === '' || this.employee.stdSalaryHealth === undefined;
    const stdPension = this.employee.stdSalaryPension === null || this.employee.stdSalaryPension === '' || this.employee.stdSalaryPension === undefined;
    let combinedKenpo = false;
    let combinedNenkin = false;
    if (this.employee.multiOffice === '二以上事業所勤務') {
      combinedKenpo = this.employee.combinedStdSalaryKenpo === null || this.employee.combinedStdSalaryKenpo === '' || this.employee.combinedStdSalaryKenpo === undefined;
      combinedNenkin = this.employee.combinedStdSalaryNenkin === null || this.employee.combinedStdSalaryNenkin === '' || this.employee.combinedStdSalaryNenkin === undefined;
    }
    return stdHealth || stdPension || combinedKenpo || combinedNenkin;
  }

  onRecalc() {
    this.router.navigate(['/calculate', this.employeeId]);
  }

  formatWithComma(value: string): string {
    if (!value) return '';
    // 数値以外の文字を除去
    const num = value.replace(/[^\d]/g, '');
    if (!num) return '';
    return Number(num).toLocaleString();
  }

  getMonthlyTotal(i: number): string {
    const fixed = Number((this.fixedWages[i] || '').replace(/,/g, '')) || 0;
    const nonFixed = Number((this.nonFixedWages[i] || '').replace(/,/g, '')) || 0;
    if (!fixed && !nonFixed) return '';
    return (fixed + nonFixed).toLocaleString();
  }

  async saveMonthlySalary(i: number) {
    if (!this.employeeId) return;
    const fixed = Number((this.fixedWages[i] || '').replace(/,/g, '')) || 0;
    const nonFixed = Number((this.nonFixedWages[i] || '').replace(/,/g, '')) || 0;
    const total = fixed + nonFixed;
    const month = this.months[i];
    const data = {
      nendo: this.currentNendo,
      month,
      fixedWages: fixed,
      nonFixedWages: nonFixed,
      total,
      employeeId: this.employeeId
    };
    const employeeDocRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
    const monthlySararyCol = collection(employeeDocRef, 'monthlySarary');
    // 既存ドキュメントを検索
    const q = query(monthlySararyCol, where('nendo', '==', this.currentNendo), where('month', '==', month));
    const snap = await getDocs(q);
    if (!snap.empty) {
      // 既存があれば上書き
      const docRef = snap.docs[0].ref;
      await setDoc(docRef, data, { merge: true });
    } else {
      // なければ新規作成
      await addDoc(monthlySararyCol, data);
    }
    this.isSaved[i] = true;
    this.savedFixedWages[i] = this.fixedWages[i];
    this.savedNonFixedWages[i] = this.nonFixedWages[i];
    this.justSaved[i] = true;
    window.location.reload();
  }

  onBlur(i: number, type: 'fixed' | 'nonFixed') {
    this.isEditing[i] = false;
    // 保存ボタンが表示されている間は値を戻さない
    if (!this.isSaved[i] || this.isEditing[i] || this.fixedWages[i] !== this.savedFixedWages[i] || this.nonFixedWages[i] !== this.savedNonFixedWages[i]) {
      return;
    }
    if (this.justSaved[i]) {
      this.justSaved[i] = false;
      return;
    }
    if (this.isSaved[i]) {
      if (type === 'fixed') {
        this.fixedWages[i] = this.savedFixedWages[i];
      } else {
        this.nonFixedWages[i] = this.savedNonFixedWages[i];
      }
    }
  }

  copyWages(i: number) {
    if (i > 0) {
      this.fixedWages[i] = this.fixedWages[i-1];
      this.nonFixedWages[i] = this.nonFixedWages[i-1];
      if (
        this.fixedWages[i] !== this.savedFixedWages[i] ||
        this.nonFixedWages[i] !== this.savedNonFixedWages[i]
      ) {
        this.isEditing[i] = true;
      }
    }
  }

  goToCalculate() {
    if (this.employeeId) {
      this.router.navigate(['/calculate', this.employeeId]);
    }
  }

  goToEdit() {
    if (this.employeeId) {
      this.router.navigate(['/employee-edit', this.employeeId]);
    }
  }

  public toggleEditPersonal() {
    this.isEditPersonal = !this.isEditPersonal;
    if (this.isEditPersonal) {
      // 編集開始時に元データを保存
      this.originalPersonalInfo = {
        lastName: this.employee.lastName,
        firstName: this.employee.firstName,
        nationality: this.employee.nationality,
        officeName: this.employee.officeName,
        birthdate: this.employee.birthdate
      };
    }
  }

  public cancelEditPersonal() {
    if (this.originalPersonalInfo) {
      this.employee.lastName = this.originalPersonalInfo.lastName;
      this.employee.firstName = this.originalPersonalInfo.firstName;
      this.employee.nationality = this.originalPersonalInfo.nationality;
      this.employee.officeName = this.originalPersonalInfo.officeName;
    }
    this.isEditPersonal = false;
    window.location.reload();
  }

  public async savePersonalInfo() {
    if (!this.employeeId || !this.employee.companyId) return;
    const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
    try {
      // 生年月日が変更されているか判定
      const birthdateChanged = this.originalPersonalInfo && this.originalPersonalInfo.birthdate !== this.employee.birthdate;
      if (birthdateChanged) {
        const confirmed = window.confirm('生年月日を変更しますか？社会保険料が変更される可能性があります。');
        if (!confirmed) {
          this.isEditPersonal = false;
          window.location.reload();
          return;
        }
        // standards新規作成
        if (this.latestStandard) {
          const standardsCol = collection(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}/standards`);
          const { id, createdAt, ...copyFields } = this.latestStandard;
          await addDoc(standardsCol, {
            ...copyFields,
            createdAt: new Date(),
            memo: '生年月日変更'
          });
        }
        // employees上書き
        await updateDoc(employeeRef, {
          lastName: this.employee.lastName,
          firstName: this.employee.firstName,
          gender: this.employee.gender,
          nationality: this.employee.nationality,
          officeName: this.employee.officeName,
          officesId: this.employee.officesId,
          birthdate: this.employee.birthdate,
          leaveDate: this.employee.leaveDate
        });
        this.router.navigate(['/calculate', this.employeeId]);
        return;
      }
      // 所属事業所が変更されているか判定
      const officeChanged = this.originalPersonalInfo && this.originalPersonalInfo.officeName !== this.employee.officeName;
      if (officeChanged) {
        const confirmed = window.confirm('所属事業所を変更しますか？社会保険料が変更されます。');
        if (!confirmed) {
          this.isEditPersonal = false;
          window.location.reload();
          return;
        }
        // 事業所IDも更新
        const office = this.companyOffices.find(o => o.officeName === this.employee.officeName);
        if (office) {
          this.employee.officesId = office.id;
        }
        // standards新規作成
        if (this.employee.officesId && this.latestStandard) {
          const standardsCol = collection(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}/standards`);
          const { id, createdAt, ...copyFields } = this.latestStandard;
          await addDoc(standardsCol, {
            ...copyFields,
            createdAt: new Date(),
            memo: '所属事業所変更'
          });
        }
        // employees上書き
        await updateDoc(employeeRef, {
          lastName: this.employee.lastName,
          firstName: this.employee.firstName,
          gender: this.employee.gender,
          nationality: this.employee.nationality,
          officeName: this.employee.officeName,
          officesId: this.employee.officesId,
          birthdate: this.employee.birthdate,
          leaveDate: this.employee.leaveDate
        });
        // calculate画面へ遷移
        this.router.navigate(['/calculate', this.employeeId]);
        return;
      }
      // 事業所変更がない場合は通常保存
      await updateDoc(employeeRef, {
        lastName: this.employee.lastName,
        firstName: this.employee.firstName,
        gender: this.employee.gender,
        nationality: this.employee.nationality,
        officeName: this.employee.officeName,
        birthdate: this.employee.birthdate,
        leaveDate: this.employee.leaveDate
      });
      // leaveDateのロジック分岐
      if (!this.employee.leaveDate && this.latestStandard && this.latestStandard.id) {
        // 1. leaveDate未入力: standards.leaveDateを空、isLostQualification削除
        const standardRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}/standards/${this.latestStandard.id}`);
        await updateDoc(standardRef, { leaveDate: '' });
        await updateDoc(employeeRef, { isLostQualification: deleteField() });
        this.employee.isLostQualification = undefined;
      } else if (this.employee.leaveDate && this.latestStandard && this.latestStandard.id) {
        // 2. leaveDateが未来日: standards.leaveDateを次の日にセット
        const leaveDateObj = new Date(this.employee.leaveDate);
        leaveDateObj.setDate(leaveDateObj.getDate() + 1);
        const nextDay = leaveDateObj.toISOString().slice(0, 10);
        const standardRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}/standards/${this.latestStandard.id}`);
        await updateDoc(standardRef, { leaveDate: nextDay });
        // leaveDate+1日の月が今月以前なら isLostQualification: true, まだなら削除
        const now = new Date();
        const leaveYear = leaveDateObj.getFullYear();
        const leaveMonth = leaveDateObj.getMonth();
        const nowYear = now.getFullYear();
        const nowMonth = now.getMonth();
        if (leaveYear < nowYear || (leaveYear === nowYear && leaveMonth <= nowMonth)) {
          await updateDoc(employeeRef, { isLostQualification: true });
          this.employee.isLostQualification = true;
        } else {
          await updateDoc(employeeRef, { isLostQualification: deleteField() });
          this.employee.isLostQualification = undefined;
        }
      }
      this.isEditPersonal = false;
      window.location.reload();
    } catch (e) {
      alert('保存に失敗しました');
    }
  }

  public toggleEditContract() {
    this.isEditContract = !this.isEditContract;
    if (this.isEditContract) {
      this.originalContractInfo = {
        employmentType: this.employee.employmentType,
        employmentPeriodType: this.employee.employmentPeriodType,
        employmentPeriodStart: this.employee.employmentPeriodStart,
        employmentPeriodEnd: this.employee.employmentPeriodEnd,
        employmentPeriodRenewal: this.employee.employmentPeriodRenewal,
        workDays: this.employee.workDays,
        workHours: this.employee.workHours,
        salaryCash: this.employee.salaryCash,
        salaryInKind: this.employee.salaryInKind,
        salaryTotal: this.employee.salaryTotal,
        baseSalary: this.employee.baseSalary
      };
    }
  }

  public cancelEditContract() {
    if (this.originalContractInfo) {
      this.employee.employmentType = this.originalContractInfo.employmentType;
      this.employee.employmentPeriodType = this.originalContractInfo.employmentPeriodType;
      this.employee.employmentPeriodStart = this.originalContractInfo.employmentPeriodStart;
      this.employee.employmentPeriodEnd = this.originalContractInfo.employmentPeriodEnd;
      this.employee.employmentPeriodRenewal = this.originalContractInfo.employmentPeriodRenewal;
      this.employee.workDays = this.originalContractInfo.workDays;
      this.employee.workHours = this.originalContractInfo.workHours;
      this.employee.salaryCash = this.originalContractInfo.salaryCash;
      this.employee.salaryInKind = this.originalContractInfo.salaryInKind;
      this.employee.salaryTotal = this.originalContractInfo.salaryTotal;
      this.employee.baseSalary = this.originalContractInfo.baseSalary;
    }
    this.isEditContract = false;
    window.location.reload();
  }

  public async saveContractInfo() {
    if (this.employee.employmentPeriodType === '有期' && (!this.employee.employmentPeriodStart || !this.employee.employmentPeriodEnd)) {
      alert('雇用契約開始日・終了日は必須です');
      return;
    }
    if (!this.employeeId || !this.employee.companyId) return;
    const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
    try {
      let contractChanged = false;
      let onlyBaseSalaryChanged = false;
      if (this.originalContractInfo) {
        const keys = [
          'employmentType',
          'employmentPeriodType',
          'employmentPeriodStart',
          'employmentPeriodEnd',
          'employmentPeriodRenewal',
          'workDays',
          'workHours',
          'salaryCash',
          'salaryInKind',
          'salaryTotal',
          'baseSalary'
        ];
        let changedKeys = [];
        for (const key of keys) {
          if (this.employee[key] !== this.originalContractInfo[key]) {
            contractChanged = true;
            changedKeys.push(key);
          }
        }
        if (contractChanged && changedKeys.length === 1 && changedKeys[0] === 'baseSalary') {
          onlyBaseSalaryChanged = true;
        }
      }
      if (onlyBaseSalaryChanged) {
        alert('標準報酬月額に変動がないか確認してください');
        await updateDoc(employeeRef, {
          employmentType: this.employee.employmentType,
          employmentPeriodType: this.employee.employmentPeriodType,
          employmentPeriodStart: this.employee.employmentPeriodStart,
          employmentPeriodEnd: this.employee.employmentPeriodEnd,
          employmentPeriodRenewal: this.employee.employmentPeriodRenewal,
          workDays: this.employee.workDays,
          workHours: this.employee.workHours,
          salaryCash: this.employee.salaryCash,
          salaryInKind: this.employee.salaryInKind,
          salaryTotal: this.employee.salaryTotal,
          baseSalary: this.employee.baseSalary
        });
        this.isEditContract = false;
        return;
      }
      if (contractChanged) {
        const confirmed = window.confirm('雇用契約情報を変更しますか？社会保険料が変更になる可能性があります。');
        if (!confirmed) {
          this.isEditContract = false;
          window.location.reload();
          return;
        }
        if (this.latestStandard) {
          const standardsCol = collection(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}/standards`);
          const { id, createdAt, ...copyFields } = this.latestStandard;
          await addDoc(standardsCol, {
            ...copyFields,
            createdAt: new Date(),
            memo: '雇用契約情報更新'
          });
        }
        await updateDoc(employeeRef, {
          employmentType: this.employee.employmentType,
          employmentPeriodType: this.employee.employmentPeriodType,
          employmentPeriodStart: this.employee.employmentPeriodStart,
          employmentPeriodEnd: this.employee.employmentPeriodEnd,
          employmentPeriodRenewal: this.employee.employmentPeriodRenewal,
          workDays: this.employee.workDays,
          workHours: this.employee.workHours,
          salaryCash: this.employee.salaryCash,
          salaryInKind: this.employee.salaryInKind,
          salaryTotal: this.employee.salaryTotal,
          baseSalary: this.employee.baseSalary
        });
        this.router.navigate(['/calculate', this.employeeId]);
        return;
      }
      // 差分がない場合は通常保存
      await updateDoc(employeeRef, {
        employmentType: this.employee.employmentType,
        employmentPeriodType: this.employee.employmentPeriodType,
        employmentPeriodStart: this.employee.employmentPeriodStart,
        employmentPeriodEnd: this.employee.employmentPeriodEnd,
        employmentPeriodRenewal: this.employee.employmentPeriodRenewal,
        workDays: this.employee.workDays,
        workHours: this.employee.workHours,
        salaryCash: this.employee.salaryCash,
        salaryInKind: this.employee.salaryInKind,
        salaryTotal: this.employee.salaryTotal,
        baseSalary: this.employee.baseSalary
      });
      this.isEditContract = false;
    } catch (e) {
      alert('保存に失敗しました');
    }
  }

  public isContractValid(): boolean {
    return (
      this.employee.baseSalary !== undefined && this.employee.baseSalary !== null && this.employee.baseSalary !== '' && Number(this.employee.baseSalary) !== 0 &&
      this.employee.workDays !== undefined && this.employee.workDays !== null && this.employee.workDays !== '' && Number(this.employee.workDays) !== 0 &&
      this.employee.workHours !== undefined && this.employee.workHours !== null && this.employee.workHours !== '' && Number(this.employee.workHours) !== 0
    );
  }

  public hasAnySalary(): boolean {
    const cash = this.employee.salaryCash;
    const inKind = this.employee.salaryInKind;
    return (
      (cash !== undefined && cash !== null && cash !== '' && Number(cash) !== 0) ||
      (inKind !== undefined && inKind !== null && inKind !== '' && Number(inKind) !== 0)
    );
  }

  public isEmptyOrZero(value: any): boolean {
    return value === undefined || value === null || value === '' || Number(value) === 0;
  }

  public isPersonalValid(): boolean {
    return !!(this.employee.lastName && this.employee.firstName && this.employee.nationality && this.employee.officeName);
  }

  public toggleEditOther() {
    this.isEditOther = !this.isEditOther;
    if (this.isEditOther) {
      this.originalOtherInfo = {
        dependentStatus: this.employee.dependentStatus,
        dependentRelations: this.employee.dependentRelations,
        isStudent: this.employee.isStudent,
        dispatchedAbroad: this.employee.dispatchedAbroad,
        multiOffice: this.employee.multiOffice
      };
      if (this.employee.dependentStatus === '被扶養者あり') {
        if (!Array.isArray(this.employee.dependentRelations) || !this.employee.dependentRelations.length) {
          this.employee.dependentRelations = [''];
        }
      }
    }
  }

  public cancelEditOther() {
    if (this.originalOtherInfo) {
      this.employee.dependentStatus = this.originalOtherInfo.dependentStatus;
      this.employee.dependentRelations = this.originalOtherInfo.dependentRelations;
      this.employee.isStudent = this.originalOtherInfo.isStudent;
      this.employee.dispatchedAbroad = this.originalOtherInfo.dispatchedAbroad;
      this.employee.multiOffice = this.originalOtherInfo.multiOffice;
    }
    this.isEditOther = false;
    window.location.reload();
  }

  public async saveOtherInfo() {
    if (!this.employeeId || !this.employee.companyId) return;
    const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
    try {
      // 差分チェック
      let otherChanged = false;
      if (this.originalOtherInfo) {
        const keys = [
          'dependentStatus',
          'dependentRelations',
          'isStudent',
          'dispatchedAbroad',
          'multiOffice',
          'selectedOfficeType',
          'socialSecurityAgreement',
          'temporaryDispatch',
          'combinedSalary'
        ];
        for (const key of keys) {
          if (JSON.stringify(this.employee[key]) !== JSON.stringify(this.originalOtherInfo[key])) {
            otherChanged = true;
            break;
          }
        }
      }
      if (otherChanged) {
        const confirmed = window.confirm('その他情報を変更しますか？社会保険料が変更になる可能性があります。');
        if (!confirmed) {
          this.isEditOther = false;
          window.location.reload();
          return;
        }
        if (this.latestStandard) {
          const standardsCol = collection(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}/standards`);
          const { id, createdAt, ...copyFields } = this.latestStandard;
          await addDoc(standardsCol, {
            ...copyFields,
            createdAt: new Date(),
            memo: 'その他情報更新'
          });
        }
        await updateDoc(employeeRef, {
          dependentStatus: this.employee.dependentStatus,
          dependentRelations: this.employee.dependentRelations,
          isStudent: this.employee.isStudent,
          dispatchedAbroad: this.employee.dispatchedAbroad,
          multiOffice: this.employee.multiOffice,
          selectedOfficeType: this.employee.selectedOfficeType,
          socialSecurityAgreement: this.employee.socialSecurityAgreement,
          temporaryDispatch: this.employee.temporaryDispatch,
          combinedSalary: this.employee.combinedSalary
        });
        this.router.navigate(['/calculate', this.employeeId]);
        return;
      }
      // 差分がない場合は通常保存
      await updateDoc(employeeRef, {
        dependentStatus: this.employee.dependentStatus,
        dependentRelations: this.employee.dependentRelations,
        isStudent: this.employee.isStudent,
        dispatchedAbroad: this.employee.dispatchedAbroad,
        multiOffice: this.employee.multiOffice,
        selectedOfficeType: this.employee.selectedOfficeType,
        socialSecurityAgreement: this.employee.socialSecurityAgreement,
        temporaryDispatch: this.employee.temporaryDispatch,
        combinedSalary: this.employee.combinedSalary
      });
      this.isEditOther = false;
    } catch (e) {
      alert('保存に失敗しました');
    }
  }

  public addDependentRelation() {
    if (!Array.isArray(this.employee.dependentRelations)) {
      this.employee.dependentRelations = this.employee.dependentRelations ? [this.employee.dependentRelations] : [''];
    }
    this.employee.dependentRelations.push('');
  }

  public removeDependentRelation(i: number) {
    if (Array.isArray(this.employee.dependentRelations) && this.employee.dependentRelations.length > 1) {
      this.employee.dependentRelations.splice(i, 1);
    }
  }

  public isArray(val: any): boolean {
    return Array.isArray(val);
  }

  public onDependentStatusChange() {
    if (this.employee.dependentStatus === '被扶養者あり') {
      if (!Array.isArray(this.employee.dependentRelations) || !this.employee.dependentRelations.length) {
        this.employee.dependentRelations = [''];
      }
    } else {
      this.employee.dependentRelations = [];
    }
  }

  public isOtherValid(): boolean {
    if (this.isEditOther && this.employee.dependentStatus === '被扶養者あり') {
      if (!Array.isArray(this.employee.dependentRelations) || !this.employee.dependentRelations.some((r: string) => r && r.trim() !== '')) {
        return false;
      }
    }
    if (this.isEditOther && this.employee.dispatchedAbroad !== '該当しない') {
      if (!this.employee.socialSecurityAgreement) {
        return false;
      }
      if (this.employee.socialSecurityAgreement === '該当する' && !this.employee.temporaryDispatch) {
        return false;
      }
    }
    if (this.isEditOther && this.employee.multiOffice === '該当する') {
      if (!this.employee.selectedOfficeType) {
        return false;
      }
      if (this.employee.combinedSalary === undefined || this.employee.combinedSalary === null || this.employee.combinedSalary === '' || Number(this.employee.combinedSalary) === 0) {
        return false;
      }
    }
    return true;
  }

  public onDispatchedAbroadChange() {
    if (this.employee.dispatchedAbroad === '該当しない') {
      this.employee.socialSecurityAgreement = '';
      this.employee.temporaryDispatch = '';
    }
  }

  public onMultiOfficeChange() {
    if (this.employee.multiOffice === '該当しない') {
      this.employee.selectedOfficeType = '';
      this.employee.combinedSalary = '';
    }
  }

  public onEmploymentPeriodTypeChange() {
    if (this.employee.employmentPeriodType === '無期') {
      this.employee.employmentPeriodStart = '';
      this.employee.employmentPeriodEnd = '';
    }
  }

  generateDeductionYMList() {
    const startYear = 2025;
    const startMonth = 3;
    const count = 12;
    const list: string[] = [];
    let year = startYear;
    let month = startMonth;
    for (let i = 0; i < count; i++) {
      list.push(`${year}/${month}`);
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    this.deductionYMList = list;
  }

  public async toggleEditInsurance() {
    this.isEditInsurance = true;
    this.originalInsuranceInfo = { ...this.employee };
    // employee-addと同じくルート直下から取得
    const kenpoCol = collection(this.firestore, 'kenpo_standardMonthlySarary');
    const kenpoSnap = await getDocs(kenpoCol);
    this.kenpoStandardMonthlyList = kenpoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const nenkinCol = collection(this.firestore, 'nenkin_standardMonthlySarary');
    const nenkinSnap = await getDocs(nenkinCol);
    this.nenkinStandardMonthlyList = nenkinSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // 変更後の標準報酬月額最終改定月の初期値を今の年月に
    if (!this.employee.updatedStdSalaryMonth) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      this.employee.updatedStdSalaryMonth = `${yyyy}-${mm}`;
    }
    // テーブル取得後に自動取得を必ず走らせる
    this.updateSalaryTotal();
  }

  public cancelEditInsurance() {
    this.isEditInsurance = false;
    if (this.originalInsuranceInfo) {
      this.employee.salaryCash = this.originalInsuranceInfo.salaryCash;
      this.employee.salaryInKind = this.originalInsuranceInfo.salaryInKind;
      this.employee.salaryTotal = this.originalInsuranceInfo.salaryTotal;
    }
    window.location.reload();
  }

  public async saveInsuranceInfo() {
    if (!window.confirm('標準報酬月額と等級を変更し社会保険料を再算出しますか？')) {
      window.location.reload();
      return;
    }
    this.isEditInsurance = false;
    if (!this.employeeId || !this.employee.companyId) return;
    const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
    try {
      await updateDoc(employeeRef, {
        salaryCash: this.employee.salaryCash,
        salaryInKind: this.employee.salaryInKind,
        salaryTotal: this.employee.salaryTotal
      });
      // standardsサブコレクションに新規ドキュメントを追加
      const standardsCol = collection(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}/standards`);
      await addDoc(standardsCol, {
        createdAt: new Date(),
        createdBy: this.currentUser?.uid || '',
        kenpoGrade: this.employee.stdSalaryHealthGrade || null,
        kenpoStandardMonthly: this.employee.stdSalaryHealth || null,
        nenkinGrade: this.employee.stdSalaryPensionGrade || null,
        nenkinStandardMonthly: this.employee.stdSalaryPension || null,
        revisionType: this.employee.updatedRevisionType || null,
        lastRevisionMonth: this.employee.updatedStdSalaryMonth || null,
        joinDate: this.latestStandard?.joinDate || '',
        leaveDate: this.latestStandard?.leaveDate || '',
        memo: ''
      });
      this.router.navigate(['/calculate', this.employeeId]);
    } catch (e) {
      alert('標準報酬月額情報の保存に失敗しました');
    }
  }

  public isInsuranceValid(): boolean {
    // 変更後の標準報酬月額最終改定月・報酬月額（通貨）・改定種別は必須
    if (!this.employee.updatedStdSalaryMonth || this.employee.updatedStdSalaryMonth === '') return false;
    if (this.employee.salaryCash === undefined || this.employee.salaryCash === null || this.employee.salaryCash === '' || Number(this.employee.salaryCash) === 0) return false;
    if (!this.employee.updatedRevisionType || this.employee.updatedRevisionType === '') return false;
    return true;
  }

  public getKenpoStandardForSalary(salary: number) {
    return this.kenpoStandardMonthlyList.find(
      (item: any) => salary >= item.lower && salary <= item.upper
    );
  }

  public getNenkinStandardForSalary(salary: number) {
    return this.nenkinStandardMonthlyList.find(
      (item: any) => salary >= item.lower && salary <= item.upper
    );
  }

  public updateSalaryTotal() {
    const cash = Number(this.employee.salaryCash) || 0;
    const inKind = Number(this.employee.salaryInKind) || 0;
    const total = cash + inKind;
    this.employee.salaryTotal = total;

    // 健康保険・介護保険
    let kenpo = this.kenpoStandardMonthlyList.find(item => {
      const start = Number(item.monthlyRangeStart ?? -Infinity);
      const end = item.monthlyRangeEnd === null || item.monthlyRangeEnd === '' || item.monthlyRangeEnd === undefined
        ? Infinity
        : Number(item.monthlyRangeEnd);
      return total >= start && total < end;
    }) || null;
    if (!kenpo) {
      kenpo = this.kenpoStandardMonthlyList.find(item =>
        item.monthlyRangeEnd === null || item.monthlyRangeEnd === '' || item.monthlyRangeEnd === undefined
      ) || null;
    }
    this.employee.stdSalaryHealth = kenpo ? kenpo.standardMonthlySalary : null;
    this.employee.stdSalaryHealthGrade = kenpo ? kenpo.grade : null;

    // 厚生年金
    let nenkin = this.nenkinStandardMonthlyList.find(item => {
      const start = Number(item.nenkinStart ?? -Infinity);
      const end = item.nenkinEnd === null || item.nenkinEnd === '' || item.nenkinEnd === undefined
        ? Infinity
        : Number(item.nenkinEnd);
      return total >= start && total < end;
    }) || null;
    if (!nenkin) {
      nenkin = this.nenkinStandardMonthlyList.find(item =>
        item.nenkinEnd === null || item.nenkinEnd === '' || item.nenkinEnd === undefined
      ) || null;
    }
    this.employee.stdSalaryPension = nenkin ? nenkin.nenkinMonthly : null;
    this.employee.stdSalaryPensionGrade = nenkin ? nenkin.nenkinGrade : null;
  }

  get latestStandard() {
    if (!this.standardsList || this.standardsList.length === 0) return null;
    return this.standardsList.reduce((latest, item) => {
      if (!latest) return item;
      const latestTime = latest.createdAt?.toDate ? latest.createdAt.toDate() : new Date(latest.createdAt);
      const itemTime = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
      return itemTime > latestTime ? item : latest;
    }, null);
  }

  get latestInsurance() {
    if (!this.insurancesList || this.insurancesList.length === 0) return null;
    const validList = this.insurancesList.filter(item => !!item.createdAt);
    if (validList.length === 0) return null;
    return validList
      .map(item => ({
        ...item,
        _millis: item.createdAt?.toDate ? item.createdAt.toDate().getTime() : (item.createdAt ? new Date(item.createdAt).getTime() : 0)
      }))
      .sort((a, b) => b._millis - a._millis)[0];
  }

  goToHistory() {
    if (this.employeeId) {
      this.router.navigate(['/insurance-history', this.employeeId]);
    }
  }

  async onOfficeNameChange() {
    if (!this.employee || !this.companyOffices) return;
    const office = this.companyOffices.find(o => o.officeName === this.employee.officeName);
    if (office) {
      this.employee.officesId = office.id;
      // Firestoreのemployeesにも反映
      if (this.employeeId && this.employee.companyId) {
        const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
        await updateDoc(employeeRef, { officesId: office.id });
      }
    }
  }

  getMonthBeforeSeventyBirthdayEve(birthdate: string): { year: number, month: number } | null {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    if (isNaN(birth.getTime())) return null;
    // 70歳の誕生日
    const seventyBirthday = new Date(birth.getFullYear() + 70, birth.getMonth(), birth.getDate());
    // 70歳の誕生日の前日
    const seventyEve = new Date(seventyBirthday);
    seventyEve.setDate(seventyEve.getDate() - 1);
    // その月の前の月
    let year = seventyEve.getFullYear();
    let month = seventyEve.getMonth(); // 0-indexed, 前の月
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    // monthは1-indexedで返す
    return { year, month };
  }

  /**
   * 現在が「70歳の誕生日の前日を含む月の前の月」以降かどうかを判定するgetter
   */
  get isAfterMonthBeforeSeventyBirthdayEve(): boolean {
    if (!this.employee?.birthdate) return false;
    const target = this.getMonthBeforeSeventyBirthdayEve(this.employee.birthdate);
    if (!target) return false;
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1; // 1-indexed
    // 現在年月が「70歳の誕生日の前日を含む月の前の月」以降か
    if (nowYear > target.year) return true;
    if (nowYear === target.year && nowMonth >= target.month) return true;
    return false;
  }

  public async confirmSeniorVoluntaryEnrollment() {
    if (!this.employeeId || !this.employee.companyId) return;
    const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
    try {
      await updateDoc(employeeRef, {
        seniorVoluntaryEnrollment: this.employee.seniorVoluntaryEnrollment
      });
      // standardsにも新規作成
      const latest = this.latestStandard;
      if (latest) {
        const standardsCol = collection(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}/standards`);
        // id, createdAt以外をコピー
        const { id, createdAt, ...copyFields } = latest;
        await addDoc(standardsCol, {
          ...copyFields,
          createdAt: new Date(),
          memo: '厚生年金高齢任意加入手続きのため変更'
        });
      }
      // 画面上も即時反映
      this.employee.seniorVoluntaryEnrollment = this.employee.seniorVoluntaryEnrollment;
      // 「する」の場合はリロード後にアラートを出すフラグをセット
      if (this.employee.seniorVoluntaryEnrollment === 'する') {
        localStorage.setItem('showSeniorVoluntaryEnrollmentAlert', '1');
      }
      window.location.reload();
    } catch (e) {
      alert('高齢任意加入の保存に失敗しました');
    }
  }

  public onMaternityLeave() {
    this.showMaternityLeaveInputs = !this.showMaternityLeaveInputs;
    // 入力欄を閉じたときは値をリセット
    if (!this.showMaternityLeaveInputs) {
      this.maternityLeaveStart = '';
      this.maternityLeaveEnd = '';
    }
  }

  public async onSaveMaternityLeave() {
    if (!this.maternityLeaveStart || !this.maternityLeaveEnd) {
      alert('開始年月日と終了年月日を両方入力してください');
      return;
    }
    if (!this.employeeId || !this.employee.companyId) return;
    const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
    try {
      await updateDoc(employeeRef, {
        onMaternityLeave: false,
        maternityLeaveStartDate: this.maternityLeaveStart,
        maternityLeaveEndDate: this.maternityLeaveEnd
      });
      alert('育休・産休情報を保存しました');
      this.showMaternityLeaveInputs = false;
      this.maternityLeaveStart = '';
      this.maternityLeaveEnd = '';
      window.location.reload();
    } catch (e) {
      alert('育休・産休情報の保存に失敗しました');
    }
  }

  public onEditMaternityLeaveDates() {
    this.maternityLeaveStart = this.employee.maternityLeaveStartDate || '';
    this.maternityLeaveEnd = this.employee.maternityLeaveEndDate || '';
    this.showMaternityLeaveInputs = true;
    this.cdr.detectChanges();
  }

  public onCancelMaternityLeaveInput() {
    this.showMaternityLeaveInputs = false;
    this.maternityLeaveStart = '';
    this.maternityLeaveEnd = '';
  }

  async deleteEmployee() {
    if (!this.employeeId || !this.employee?.companyId) return;
    if (!window.confirm('本当にこの従業員を削除しますか？\nこの操作は元に戻せません。')) return;
    const employeePath = `companies/${this.employee.companyId}/employees/${this.employeeId}`;
    const employeeRef = doc(this.firestore, employeePath);
    // サブコレクション削除
    const subcollections = ['standards', 'insurances', 'monthlySarary'];
    for (const sub of subcollections) {
      const subCol = collection(this.firestore, `${employeePath}/${sub}`);
      const subSnap = await getDocs(subCol);
      for (const subDoc of subSnap.docs) {
        await deleteDoc(subDoc.ref);
      }
    }
    // 従業員本体削除
    await deleteDoc(employeeRef);
    alert('従業員を削除しました');
    this.router.navigate(['/employee-list']);
  }

  async toggleEditCombined() {
    this.isEditCombined = !this.isEditCombined;
    if (this.isEditCombined) {
      this.tempCombinedSalary = this.employee?.combinedSalary ?? '';
      // 標準報酬月額テーブルが空ならFirestoreから取得
      if (!this.kenpoStandardMonthlyList.length) {
        const kenpoCol = collection(this.firestore, 'kenpo_standardMonthlySarary');
        const kenpoSnap = await getDocs(kenpoCol);
        this.kenpoStandardMonthlyList = kenpoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      if (!this.nenkinStandardMonthlyList.length) {
        const nenkinCol = collection(this.firestore, 'nenkin_standardMonthlySarary');
        const nenkinSnap = await getDocs(nenkinCol);
        this.nenkinStandardMonthlyList = nenkinSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      // 入力欄を開いたときに初期値で自動判定
      this.onTempCombinedSalaryChange();
    }
  }

  async saveCombinedSalary() {
    if (!this.employeeId || !this.employee?.companyId) return;
    const employeeRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}`);
    await updateDoc(employeeRef, {
      combinedSalary: this.tempCombinedSalary,
      combinedKenpoStandardMonthly: this.tempCombinedKenpoStandardMonthly,
      combinedKenpoGrade: this.tempCombinedKenpoGrade,
      combinedNenkinStandardMonthly: this.tempCombinedNenkinStandardMonthly,
      combinedNenkinGrade: this.tempCombinedNenkinGrade
    });
    this.employee.combinedSalary = this.tempCombinedSalary;
    this.employee.combinedKenpoStandardMonthly = this.tempCombinedKenpoStandardMonthly;
    this.employee.combinedKenpoGrade = this.tempCombinedKenpoGrade;
    this.employee.combinedNenkinStandardMonthly = this.tempCombinedNenkinStandardMonthly;
    this.employee.combinedNenkinGrade = this.tempCombinedNenkinGrade;
    // standardsサブコレクションのlastStandardも上書き
    if (this.latestStandard && this.latestStandard.id) {
      const standardRef = doc(this.firestore, `companies/${this.employee.companyId}/employees/${this.employeeId}/standards/${this.latestStandard.id}`);
      await updateDoc(standardRef, {
        combinedSalary: this.tempCombinedSalary,
        combinedKenpoStandardMonthly: this.tempCombinedKenpoStandardMonthly,
        combinedKenpoGrade: this.tempCombinedKenpoGrade,
        combinedNenkinStandardMonthly: this.tempCombinedNenkinStandardMonthly,
        combinedNenkinGrade: this.tempCombinedNenkinGrade
      });
    }
    this.isEditCombined = false;
  }

  // 合算報酬月額の入力値が変わったときに標準報酬月額・等級を自動判定
  onTempCombinedSalaryChange() {
    const salary = Number(this.tempCombinedSalary);
    if (!salary || isNaN(salary)) {
      this.tempCombinedKenpoStandardMonthly = null;
      this.tempCombinedKenpoGrade = null;
      this.tempCombinedNenkinStandardMonthly = null;
      this.tempCombinedNenkinGrade = null;
      return;
    }
    // 健康保険・介護保険
    let kenpo = this.kenpoStandardMonthlyList.find(item => {
      const start = Number(item.monthlyRangeStart ?? -Infinity);
      const end = item.monthlyRangeEnd === null || item.monthlyRangeEnd === '' || item.monthlyRangeEnd === undefined
        ? Infinity
        : Number(item.monthlyRangeEnd);
      return salary >= start && salary < end;
    }) || null;
    if (!kenpo) {
      kenpo = this.kenpoStandardMonthlyList.find(item =>
        item.monthlyRangeEnd === null || item.monthlyRangeEnd === '' || item.monthlyRangeEnd === undefined
      ) || null;
    }
    this.tempCombinedKenpoStandardMonthly = kenpo ? kenpo.standardMonthlySalary : null;
    this.tempCombinedKenpoGrade = kenpo ? kenpo.grade : null;
    // 厚生年金
    let nenkin = this.nenkinStandardMonthlyList.find(item => {
      const start = Number(item.nenkinStart ?? -Infinity);
      const end = item.nenkinEnd === null || item.nenkinEnd === '' || item.nenkinEnd === undefined
        ? Infinity
        : Number(item.nenkinEnd);
      return salary >= start && salary < end;
    }) || null;
    if (!nenkin) {
      nenkin = this.nenkinStandardMonthlyList.find(item =>
        item.nenkinEnd === null || item.nenkinEnd === '' || item.nenkinEnd === undefined
      ) || null;
    }
    this.tempCombinedNenkinStandardMonthly = nenkin ? nenkin.nenkinMonthly : null;
    this.tempCombinedNenkinGrade = nenkin ? nenkin.nenkinGrade : null;
  }

  // 社会保険対象外かどうかを判定するgetter
  get isSocialInsuranceExcludedByInsurance(): boolean {
    return this.insurancesList.some(i => i.isInsuranceTarget === false || i.isInsuranceTarget === 'false' || i.isInsuranceTarget === 0);
  }

  // 40歳の誕生日の前日が含まれる月が今月以前かどうかを判定する関数
  isMonthOfFortiethBirthdayEveOrBefore(birthdate: string): boolean {
    if (!birthdate) return false;
    const birth = new Date(birthdate);
    if (isNaN(birth.getTime())) return false;
    const now = new Date();
    // 40歳の誕生日の前日
    const fortyBirthday = new Date(birth.getFullYear() + 40, birth.getMonth(), birth.getDate());
    const fortyEve = new Date(fortyBirthday);
    fortyEve.setDate(fortyEve.getDate() - 1);
    // その月の1日
    const monthStart = new Date(fortyEve.getFullYear(), fortyEve.getMonth(), 1);
    // 今月の1日
    const nowMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // 「誕生日の前日が含まれる月」が今月以前か
    return monthStart <= nowMonthStart;
  }

  get isMaternityLeaveButtonDisabled(): boolean {
    if (!this.latestInsurance) return false;
    if (!('isInsuranceTarget' in this.latestInsurance)) return false;
    return this.latestInsurance.isInsuranceTarget === false;
  }

  openBonusInfoPopup() { this.showBonusInfoPopup = true; }
  closeBonusInfoPopup() { this.showBonusInfoPopup = false; }

  get isSeishain(): boolean {
    return this.employee?.employmentType === '正社員';
  }

  async onEmploymentTypeChange(newType: string) {
    this.employee.employmentType = newType;
    // officeIdまたはofficesIdのどちらかがあれば使う
    const officeId = this.employee.officeId || this.employee.officesId;
    if (newType === '正社員' && officeId && this.employee.companyId) {
      try {
        const officeDocRef = doc(this.firestore, `companies/${this.employee.companyId}/offices/${officeId}`);
        const officeSnap = await getDocs(collection(this.firestore, `companies/${this.employee.companyId}/offices`));
        const officeDoc = officeSnap.docs.find(doc => doc.id === officeId);
        if (officeDoc) {
          const officeData = officeDoc.data();
          if (officeData['monthlyDays'] !== undefined) {
            this.employee.workDays = officeData['monthlyDays'];
          }
          if (officeData['weeklyHours'] !== undefined) {
            this.employee.workHours = officeData['weeklyHours'];
          }
        }
      } catch (e) {
        // エラー時は何もしない
      }
    } else if (newType === '正社員' && this.employee.officeName && this.companyOffices.length > 0) {
      // officeIdが未設定だがofficeNameが選択されている場合
      const office = this.companyOffices.find(o => o.officeName === this.employee.officeName);
      if (office) {
        this.employee.officeId = office.id;
        if (office['monthlyDays'] !== undefined) {
          this.employee.workDays = office['monthlyDays'];
        }
        if (office['weeklyHours'] !== undefined) {
          this.employee.workHours = office['weeklyHours'];
        }
      }
    }
  }

}
