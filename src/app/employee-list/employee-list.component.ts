import { Component, OnInit, inject } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.css'
})
export class EmployeeListComponent implements OnInit {
  currentUser: User | null = null;
  companies: any[] = [];
  employees: any[] = [];
  selectedEmploymentType: string = '';
  selectedOfficeName: string = '';
  sortKey: 'managementNumber' | 'joinDate' | null = 'managementNumber';
  sortDirection: 'asc' | 'desc' | 'none' = 'asc';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  async ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUser = user;
      if (user) {
        // companies取得
        const companiesCol = collection(this.firestore, 'companies');
        const q = query(companiesCol, where('createdBy', '==', user.uid));
        const companiesSnap = await getDocs(q);
        this.companies = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // employees取得
        this.employees = [];
        for (const company of this.companies) {
          const employeesCol = collection(this.firestore, 'companies', company.id, 'employees');
          const employeesSnap = await getDocs(employeesCol);
          const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), companyId: company.id }));
          this.employees.push(...employees);
        }
        // 管理番号順にソート
        this.employees.sort((a, b) => Number(a.managementNumber) - Number(b.managementNumber));
      }
    });
  }

  get officeNames() {
    // employeesから重複なしの事業所名リストを取得
    return Array.from(new Set(this.employees.map(emp => emp.officeName).filter(name => !!name)));
  }

  toggleSort(key: 'managementNumber' | 'joinDate') {
    if (this.sortKey !== key) {
      this.sortKey = key;
      this.sortDirection = 'asc';
    } else {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    }
  }

  get filteredEmployees() {
    let result = this.employees;
    if (this.selectedEmploymentType) {
      result = result.filter(emp => emp.employmentType === this.selectedEmploymentType);
    }
    if (this.selectedOfficeName) {
      result = result.filter(emp => emp.officeName === this.selectedOfficeName);
    }
    if (this.sortKey === 'joinDate' && (this.sortDirection === 'asc' || this.sortDirection === 'desc')) {
      result = result.slice().sort((a, b) => {
        const dateA = a.joinDate ? new Date(a.joinDate).getTime() : 0;
        const dateB = b.joinDate ? new Date(b.joinDate).getTime() : 0;
        return this.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      });
    } else if (this.sortKey === 'managementNumber' && (this.sortDirection === 'asc' || this.sortDirection === 'desc')) {
      result = result.slice().sort((a, b) => {
        const numA = Number(a.managementNumber);
        const numB = Number(b.managementNumber);
        return this.sortDirection === 'asc' ? numA - numB : numB - numA;
      });
    }
    return result;
  }

  goToDetail(emp: any) {
    this.router.navigate(['/employee-detail', emp.id]);
  }
}
