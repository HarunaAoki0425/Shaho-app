import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';

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
  apportionedStdSalary: string | number | null = null;
  dependentStatus: string = '';
  dependentRelations: string[] = [''];
  showInfoPopup: boolean = false;
  showAgreementInfoPopup: boolean = false;
  dispatchedAbroad: string = '';
  temporaryDispatch: string = '';
  socialSecurityAgreement: string = '';
  nationality: string = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.currentUser = user;
        await this.loadUserCompanies();
        await this.loadUserOffices();
      }
    });
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
        case 'apportionedStdSalary': this.apportionedStdSalary = null; break;
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
      case 'apportionedStdSalary':
        this.apportionedStdSalary = isNaN(num) ? '' : num;
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
}
