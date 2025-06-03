import { Component, OnInit, inject, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Firestore, collection, addDoc, serverTimestamp, doc, query, where, getDocs, deleteDoc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-company-setting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-setting.component.html',
  styleUrl: './company-setting.component.css'
})
export class CompanySettingComponent implements OnInit {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  user: User | null = null;

  companyName: string = '';
  errorMessage: string = '';

  offices = [
    { officeName: '', officePrefecture: '', employeeCount: null, weeklyHours: null, monthlyDays: null }
  ];

  prefectures: string[] = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県',
    '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];

  showForm: boolean = true;
  isLoading: boolean = true;
  companyNameView: string = '';
  officesView: any[] = [];
  companyView: any = null;
  editingOfficeIndex: number | null = null;
  editingOffice: any = {};

  showOfficeDialog: boolean = false;
  officeForm = { officeName: '', officePrefecture: '', employeeCount: null, weeklyHours: null, monthlyDays: null };

  employmentTypes: string[] = [];
  customEmploymentTypes: string[] = [];
  customEmploymentTypeInput: string = '';
  showCustomTypeInput: boolean = false;

  async ngOnInit() {
    runInInjectionContext(this.injector, () => {
      onAuthStateChanged(this.auth, async (user) => {
        this.user = user;
        if (user) {
          await runInInjectionContext(this.injector, async () => {
            const companiesCol = collection(this.firestore, 'companies');
            const q = query(companiesCol, where('createdBy', '==', user.uid));
            const snap = await getDocs(q);
            if (!snap.empty) {
              this.showForm = false;
              this.companyNameView = snap.docs[0].data()['companyName'] || '';
              this.companyView = { id: snap.docs[0].id, ...snap.docs[0].data() };
              const companyDocRef = snap.docs[0].ref;
              if (!companyDocRef) return;
              const officesCol = collection(companyDocRef, 'offices');
              const officesSnap = await getDocs(officesCol);
              this.officesView = officesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))
                .sort((a, b) => ((a.officeNumber ?? 0) - (b.officeNumber ?? 0)));
            }
          });
        }
        this.isLoading = false;
      });
    });
  }

  async saveCompany() {
    if (!this.companyName) {
      this.errorMessage = '会社名を入力してください';
      return;
    }
    const first = this.offices[0];
    if (
      !first.officeName ||
      !first.officePrefecture ||
      !first.employeeCount ||
      !first.weeklyHours ||
      !first.monthlyDays
    ) {
      this.errorMessage = '1つ目の事業所情報はすべて入力してください';
      return;
    }
    if (!this.user) return;
    this.errorMessage = '';
    await runInInjectionContext(this.injector, async () => {
      const companiesCol = collection(this.firestore, 'companies');
      const companyDocRef = await addDoc(companiesCol, {
        companyName: this.companyName,
        createdBy: this.user!.uid,
        createdAt: serverTimestamp(),
        updatedBy: null,
        updatedAt: null,
        employmentType: this.employmentTypes
      });
      const companyId = companyDocRef.id;
      for (let i = 0; i < this.offices.length; i++) {
        const office = this.offices[i];
        const officesCol = collection(companyDocRef, 'offices');
        await addDoc(officesCol, {
          ...office,
          officeNumber: i + 1,
          companyId,
          createdBy: this.user!.uid,
          createdAt: serverTimestamp(),
          updatedBy: null,
          updatedAt: null
        });
      }
    });
    window.location.reload();
  }

  addOffice() {
    this.offices.push({ officeName: '', officePrefecture: '', employeeCount: null, weeklyHours: null, monthlyDays: null });
  }

  removeOffice(i: number) {
    if (this.offices.length > 1) {
      this.offices.splice(i, 1);
    }
  }

  openOfficeDialog() {
    this.officeForm = { officeName: '', officePrefecture: '', employeeCount: null, weeklyHours: null, monthlyDays: null };
    this.showOfficeDialog = true;
  }
  closeOfficeDialog() {
    this.showOfficeDialog = false;
  }
  async saveOfficeDialog() {
    if (!this.user) return;
    await runInInjectionContext(this.injector, async () => {
      const companiesCol = collection(this.firestore, 'companies');
      const q = query(companiesCol, where('createdBy', '==', this.user!.uid));
      const snap = await getDocs(q);
      if (snap.empty) return;
      const companyDocRef = snap.docs[0].ref;
      if (!companyDocRef) return;
      const officesCol = collection(companyDocRef, 'offices');
      const officesSnap = await getDocs(officesCol);
      let maxNumber = 0;
      officesSnap.docs.forEach(doc => {
        const n = doc.data()['officeNumber'];
        if (typeof n === 'number' && n > maxNumber) maxNumber = n;
      });
      await addDoc(officesCol, {
        ...this.officeForm,
        officeNumber: maxNumber + 1,
        companyId: companyDocRef.id,
        createdBy: this.user!.uid,
        createdAt: serverTimestamp(),
        updatedBy: null,
        updatedAt: null
      });
    });
    this.showOfficeDialog = false;
    window.location.reload();
  }

  async deleteOffice(office: any) {
    if (!this.user) return;
    const confirmed = window.confirm('本当に削除しますか？（所属従業員は無効となります。）');
    if (!confirmed) return;
    await runInInjectionContext(this.injector, async () => {
      const companiesCol = collection(this.firestore, 'companies');
      const q = query(companiesCol, where('createdBy', '==', this.user!.uid));
      const snap = await getDocs(q);
      if (snap.empty) return;
      const companyDocRef = snap.docs[0].ref;
      if (!companyDocRef) return;
      const officesCol = collection(companyDocRef, 'offices');
      const officesSnap = await getDocs(officesCol);
      const targetDoc = officesSnap.docs.find(doc => doc.data()['officeNumber'] === office.officeNumber);
      if (!targetDoc) return;
      await deleteDoc(targetDoc.ref);
    });
    window.location.reload();
  }

  onEmploymentTypeChange(event: any, type: string) {
    if (event.target.checked) {
      if (!this.employmentTypes.includes(type)) {
        this.employmentTypes.push(type);
      }
    } else {
      this.employmentTypes = this.employmentTypes.filter(t => t !== type);
      if (this.customEmploymentTypes.includes(type)) {
        this.customEmploymentTypes = this.customEmploymentTypes.filter(t => t !== type);
      }
    }
  }

  addCustomEmploymentType() {
    const value = this.customEmploymentTypeInput.trim();
    if (value && !this.customEmploymentTypes.includes(value) && !['正社員', '契約社員', 'パート・アルバイト'].includes(value)) {
      this.customEmploymentTypes.push(value);
      if (!this.employmentTypes.includes(value)) {
        this.employmentTypes.push(value);
      }
      this.customEmploymentTypeInput = '';
      this.showCustomTypeInput = false;
    }
  }

  startEditOffice(i: number, office: any) {
    console.log('[DEBUG] startEditOffice called', { i, office });
    this.editingOfficeIndex = i;
    this.editingOffice = { ...office };
    console.log('[DEBUG] editingOfficeIndex set to', this.editingOfficeIndex);
  }

  async saveEditOffice(i: number) {
    const office = this.editingOffice;
    console.log('[DEBUG] saveEditOffice called', { i, office, companyView: this.companyView });

    // Firestore更新
    if (this.companyView && office.id) {
      const officeDocRef = doc(this.firestore, 'companies', this.companyView.id, 'offices', office.id);
      console.log('[DEBUG] officeDocRef path:', officeDocRef.path);
      try {
        await updateDoc(officeDocRef, {
          officeName: office.officeName,
          officePrefecture: office.officePrefecture,
          employeeCount: office.employeeCount,
          weeklyHours: office.weeklyHours,
          monthlyDays: office.monthlyDays
        });
        console.log('[DEBUG] Firestore update success');
      } catch (e) {
        console.error('[DEBUG] Firestore update error:', e);
      }
    } else {
      console.warn('[DEBUG] companyView or office.id is missing', { companyView: this.companyView, officeId: office.id });
    }

    // ローカルも反映
    this.officesView[i] = { ...office };
    this.editingOfficeIndex = null;
    console.log('[DEBUG] editingOfficeIndex reset to null');
  }

  cancelEditOffice() {
    console.log('[DEBUG] cancelEditOffice called');
    this.editingOfficeIndex = null;
    console.log('[DEBUG] editingOfficeIndex reset to null');
  }

  logDebug(...args: any[]) {
    console.log('[TEMPLATE DEBUG]', ...args);
  }
}
