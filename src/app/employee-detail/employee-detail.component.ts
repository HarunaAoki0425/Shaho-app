import { Component, OnInit, inject } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, getDocs, updateDoc, doc, addDoc, query, where, setDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
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
          console.log('standardsList:', this.standardsList);
          await this.fetchInsurances();
          return;
        }
      }
      console.log('該当従業員が見つかりませんでした');
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
    console.log('insurancesList:', this.insurancesList);
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
}
