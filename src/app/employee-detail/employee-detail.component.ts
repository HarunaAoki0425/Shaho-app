import { Component, OnInit, inject } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, getDocs, updateDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  displayFields = [
    { key: 'managementNumber', label: '管理番号' },
    { key: 'lastName', label: '氏名' },
    { key: 'gender', label: '性別' },
    { key: 'birthdate', label: '生年月日' },
    { key: 'age', label: '年齢' },
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
  async ngOnInit() {
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
          // ここから追加: 標準報酬月額（健康保険・介護保険）が空欄/nullの場合、等級をkenpo_standardMonthlySararyから取得
          if ((this.employee.stdSalaryHealth === null || this.employee.stdSalaryHealth === '' || this.employee.stdSalaryHealth === undefined)
            && this.employee.salaryTotal !== null && this.employee.salaryTotal !== '' && this.employee.salaryTotal !== undefined) {
            const kenpoCol = collection(this.firestore, 'kenpo_standardMonthlySarary');
            const kenpoSnap = await getDocs(kenpoCol);
            const salaryTotal = Number(this.employee.salaryTotal);
            const found = kenpoSnap.docs.map(doc => doc.data()).find((row: any) => {
              const rangeStart = row.monthlyRangeStart === null || row.monthlyRangeStart === '' || row.monthlyRangeStart === undefined ? -Infinity : Number(row.monthlyRangeStart);
              const rangeEnd = row.monthlyRangeEnd === null || row.monthlyRangeEnd === '' || row.monthlyRangeEnd === undefined ? Infinity : Number(row.monthlyRangeEnd);
              return salaryTotal >= rangeStart && salaryTotal < rangeEnd;
            });
            if (found) {
              this.autoStdSalaryHealth = found['standardMonthlySalary'] ?? null;
              this.autoStdSalaryHealthGrade = found['grade'] ?? null;
              console.log('標準報酬月額（健康保険・介護保険）自動判定:', found['standardMonthlySalary'], '等級:', found['grade']);
            } else {
              this.autoStdSalaryHealth = null;
              this.autoStdSalaryHealthGrade = null;
              console.log('該当する標準報酬月額（健康保険・介護保険）の等級が見つかりませんでした');
            }
          }
          // 標準報酬月額（厚生年金）が空欄/nullの場合、等級をnenkin_standardMonthlySararyから取得
          if ((this.employee.stdSalaryPension === null || this.employee.stdSalaryPension === '' || this.employee.stdSalaryPension === undefined)
            && this.employee.salaryTotal !== null && this.employee.salaryTotal !== '' && this.employee.salaryTotal !== undefined) {
            const nenkinCol = collection(this.firestore, 'nenkin_standardMonthlySarary');
            const nenkinSnap = await getDocs(nenkinCol);
            const salaryTotal = Number(this.employee.salaryTotal);
            const found = nenkinSnap.docs.map(doc => doc.data()).find((row: any) => {
              const rangeStart = row.nenkinStart === null || row.nenkinStart === '' || row.nenkinStart === undefined ? -Infinity : Number(row.nenkinStart);
              const rangeEnd = row.nenkinEnd === null || row.nenkinEnd === '' || row.nenkinEnd === undefined ? Infinity : Number(row.nenkinEnd);
              return salaryTotal >= rangeStart && salaryTotal < rangeEnd;
            });
            if (found) {
              this.autoStdSalaryPension = found['nenkinMonthly'] ?? null;
              this.autoStdSalaryPensionGrade = found['nenkinGrade'] ?? null;
              console.log('標準報酬月額（厚生年金）自動判定:', found['nenkinMonthly'], '等級:', found['nenkinGrade']);
            } else {
              this.autoStdSalaryPension = null;
              this.autoStdSalaryPensionGrade = null;
              console.log('該当する標準報酬月額（厚生年金）の等級が見つかりませんでした');
            }
          }
          // 合算標準報酬月額（健康保険・介護保険）が空欄/nullの場合、等級をkenpo_standardMonthlySararyから取得
          if ((this.employee.combinedStdSalaryKenpo === null || this.employee.combinedStdSalaryKenpo === '' || this.employee.combinedStdSalaryKenpo === undefined)
            && this.employee.combinedSalary !== null && this.employee.combinedSalary !== '' && this.employee.combinedSalary !== undefined) {
            const kenpoCol = collection(this.firestore, 'kenpo_standardMonthlySarary');
            const kenpoSnap = await getDocs(kenpoCol);
            const combinedSalary = Number(this.employee.combinedSalary);
            const found = kenpoSnap.docs.map(doc => doc.data()).find((row: any) => {
              const rangeStart = row.monthlyRangeStart === null || row.monthlyRangeStart === '' || row.monthlyRangeStart === undefined ? -Infinity : Number(row.monthlyRangeStart);
              const rangeEnd = row.monthlyRangeEnd === null || row.monthlyRangeEnd === '' || row.monthlyRangeEnd === undefined ? Infinity : Number(row.monthlyRangeEnd);
              return combinedSalary >= rangeStart && combinedSalary < rangeEnd;
            });
            if (found) {
              this.autoCombinedStdSalaryKenpo = found['standardMonthlySalary'] ?? null;
              this.autoCombinedStdSalaryKenpoGrade = found['grade'] ?? null;
              console.log('合算標準報酬月額（健康保険・介護保険）自動判定:', found['standardMonthlySalary'], '等級:', found['grade']);
            } else {
              this.autoCombinedStdSalaryKenpo = null;
              this.autoCombinedStdSalaryKenpoGrade = null;
              console.log('該当する合算標準報酬月額（健康保険・介護保険）の等級が見つかりませんでした');
            }
          }
          // 合算標準報酬月額（厚生年金）が空欄/nullの場合、等級をnenkin_standardMonthlySararyから取得
          if ((this.employee.combinedStdSalaryNenkin === null || this.employee.combinedStdSalaryNenkin === '' || this.employee.combinedStdSalaryNenkin === undefined)
            && this.employee.combinedSalary !== null && this.employee.combinedSalary !== '' && this.employee.combinedSalary !== undefined) {
            const nenkinCol = collection(this.firestore, 'nenkin_standardMonthlySarary');
            const nenkinSnap = await getDocs(nenkinCol);
            const combinedSalary = Number(this.employee.combinedSalary);
            const found = nenkinSnap.docs.map(doc => doc.data()).find((row: any) => {
              const rangeStart = row.nenkinStart === null || row.nenkinStart === '' || row.nenkinStart === undefined ? -Infinity : Number(row.nenkinStart);
              const rangeEnd = row.nenkinEnd === null || row.nenkinEnd === '' || row.nenkinEnd === undefined ? Infinity : Number(row.nenkinEnd);
              return combinedSalary >= rangeStart && combinedSalary < rangeEnd;
            });
            if (found) {
              this.autoCombinedStdSalaryNenkin = found['nenkinMonthly'] ?? null;
              this.autoCombinedStdSalaryNenkinGrade = found['nenkinGrade'] ?? null;
              console.log('合算標準報酬月額（厚生年金）自動判定:', found['nenkinMonthly'], '等級:', found['nenkinGrade']);
            } else {
              this.autoCombinedStdSalaryNenkin = null;
              this.autoCombinedStdSalaryNenkinGrade = null;
              console.log('該当する合算標準報酬月額（厚生年金）の等級が見つかりませんでした');
            }
          }
          return;
        }
      }
      console.log('該当従業員が見つかりませんでした');
    }
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
}
