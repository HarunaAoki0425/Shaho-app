import { Component, OnInit, inject } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-employee-edit',
  imports: [CommonModule],
  templateUrl: './employee-edit.component.html',
  styleUrl: './employee-edit.component.css'
})
export class EmployeeEditComponent implements OnInit {
  currentUser: User | null = null;
  employee: any = null;
  employeeId: string | null = null;
  company: any = null;
  companyOffices: any[] = [];

  showInfoPopup: boolean = false;

  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);

  openInfoPopup() {
    this.showInfoPopup = true;
  }

  closeInfoPopup() {
    this.showInfoPopup = false;
  }

  async ngOnInit() {
    // ログインユーザー取得
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
    });

    // employeeId取得
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
          // 会社情報を取得
          const companyDocRef = doc(this.firestore, 'companies', companyDoc.id);
          const companySnap = await getDoc(companyDocRef);
          if (companySnap.exists()) {
            this.company = companySnap.data();
            // officesサブコレクションを取得
            const officesCol = collection(this.firestore, 'companies', companyDoc.id, 'offices');
            const officesSnap = await getDocs(officesCol);
            this.companyOffices = officesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          }
          break;
        }
      }
    }
  }
}
