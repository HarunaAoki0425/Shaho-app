import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth, onAuthStateChanged, User, getAuth } from '@angular/fire/auth';
import { Firestore, doc, getDoc, collection, getDocs } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-insurance-history',
  imports: [CommonModule],
  templateUrl: './insurance-history.component.html',
  styleUrl: './insurance-history.component.css'
})
export class InsuranceHistoryComponent implements OnInit {
  public employeeId: string | null = null;
  public currentUser: User | null = null;
  public employee: any = null;
  public insurances: any[] = [];
  public standards: any[] = [];
  public insuranceStandardPairs: { insurance: any, standard: any | null }[] = [];
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  constructor(private route: ActivatedRoute) {
    this.employeeId = this.route.snapshot.paramMap.get('id');
  }

  async ngOnInit() {
    // ログインユーザーがいなければ/loginに遷移
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        this.router.navigate(['/login']);
      }
    });
    if (!this.employeeId) return;
    // employees情報取得
    // 会社IDはURLや他画面から渡されている前提。なければ取得ロジック追加要。
    // ここでは全companiesを走査して該当従業員を探す例
    const companiesCol = collection(this.firestore, 'companies');
    const companiesSnap = await getDocs(companiesCol);
    for (const companyDoc of companiesSnap.docs) {
      const employeesCol = collection(this.firestore, 'companies', companyDoc.id, 'employees');
      const employeesSnap = await getDocs(employeesCol);
      const empDoc = employeesSnap.docs.find(doc => doc.id === this.employeeId);
      if (empDoc) {
        this.employee = empDoc.data();
        this.employee.companyId = companyDoc.id;
        // insurances全件（createdAt降順でソート）
        const insurancesCol = collection(this.firestore, 'companies', companyDoc.id, 'employees', this.employeeId, 'insurances');
        const insurancesSnap = await getDocs(insurancesCol);
        this.insurances = (insurancesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })) as any[])
          .map(item => ({
            ...item,
            createdAt: item.createdAt?.toDate ? item.createdAt.toDate() : (item.createdAt ? new Date(item.createdAt) : null),
            _millis: item.createdAt?.toDate ? item.createdAt.toDate().getTime() : (item.createdAt ? new Date(item.createdAt).getTime() : 0)
          }))
          .sort((a, b) => b._millis - a._millis);
        // standards全件
        const standardsCol = collection(this.firestore, 'companies', companyDoc.id, 'employees', this.employeeId, 'standards');
        const standardsSnap = await getDocs(standardsCol);
        this.standards = standardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // insurancesとstandardsをstandardIdで紐付けてペアにする
        this.insuranceStandardPairs = this.insurances.map(ins => {
          const std = this.standards.find(s => s.id === ins.standardId) || null;
          return { insurance: ins, standard: std };
        });
        break;
      }
    }
  }
}
