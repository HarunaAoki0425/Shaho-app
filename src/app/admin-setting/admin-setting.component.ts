import { Component, OnInit } from '@angular/core';
import { getAuth, onAuthStateChanged, User, reauthenticateWithCredential, EmailAuthProvider, updatePassword, deleteUser } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, query, where, doc, deleteDoc } from '@angular/fire/firestore';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-setting',
  templateUrl: './admin-setting.component.html',
  styleUrls: ['./admin-setting.component.css'],
  imports: [CommonModule, FormsModule]
})
export class AdminSettingComponent implements OnInit {
  user: User | null = null;
  isEditUser = false;
  userName: string = '';
  userEmail: string = '';
  showPasswordForm = false;
  currentPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  passwordError: string = '';
  passwordSuccess: string = '';
  isSavingPassword = false;
  private firestore = inject(Firestore);
  private router = inject(Router);

  constructor() { }
  ngOnInit(): void {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      this.user = user;
      this.userName = user?.displayName || '';
      this.userEmail = user?.email || '';
      console.log('[admin-setting] ログインユーザー:', this.user);
      if (!user) {
        this.router.navigate(['/login']);
      }
    });
  }

  get canSavePassword(): boolean {
    return !!this.currentPassword &&
      !!this.newPassword &&
      !!this.confirmPassword &&
      this.newPassword === this.confirmPassword &&
      this.newPassword.length >= 6 &&
      !this.isSavingPassword;
  }

  onResetPassword(): void {
    this.showPasswordForm = true;
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.passwordError = '';
    this.passwordSuccess = '';
  }

  async onSubmitPasswordReset(): Promise<void> {
    this.passwordError = '';
    this.passwordSuccess = '';
    if (!this.user || !this.user.email) {
      this.passwordError = 'ユーザー情報が取得できません。';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = '新しいパスワードが一致しません。';
      return;
    }
    if (this.newPassword.length < 6) {
      this.passwordError = '新しいパスワードは6文字以上で入力してください。';
      return;
    }
    this.isSavingPassword = true;
    try {
      // 現在のパスワードで再認証
      const credential = EmailAuthProvider.credential(this.user.email, this.currentPassword);
      await reauthenticateWithCredential(this.user, credential);
      // パスワード変更
      await updatePassword(this.user, this.newPassword);
      this.passwordSuccess = '';
      this.showPasswordForm = false;
      alert('パスワードが変更されました。');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password') {
        this.passwordError = '現在のパスワードが正しくありません。';
      } else {
        this.passwordError = 'パスワード変更に失敗しました: ' + (err.message || err.code);
      }
    } finally {
      this.isSavingPassword = false;
    }
  }

  async onDeleteAccount(): Promise<void> {
    if (!this.user || !this.user.email) return;
    const confirmed = confirm('本当にアカウントを削除しますか？\n\nこの操作は取り消せません。\n\n会社情報・従業員情報など、あなたが作成した全てのデータが完全に削除されます。\n\nよろしければOKを押してください。');
    if (!confirmed) return;
    // パスワード入力を促す
    const password = prompt('アカウント削除のため、パスワードを入力してください。');
    if (!password) {
      alert('パスワードが入力されませんでした。アカウント削除を中止します。');
      return;
    }
    try {
      // 再認証
      const credential = EmailAuthProvider.credential(this.user.email, password);
      await reauthenticateWithCredential(this.user, credential);
      // 1. ユーザーが作成したcompaniesを取得
      const companiesCol = collection(this.firestore, 'companies');
      const companiesQuery = query(companiesCol, where('createdBy', '==', this.user.uid));
      const companiesSnap = await getDocs(companiesQuery);
      for (const companyDoc of companiesSnap.docs) {
        const companyId = companyDoc.id;
        // 2. サブコレクション employees, offices を削除
        const employeesCol = collection(this.firestore, 'companies', companyId, 'employees');
        const employeesSnap = await getDocs(employeesCol);
        for (const empDoc of employeesSnap.docs) {
          const empId = empDoc.id;
          // employees配下のサブコレクション（insurances, standards, bonus）も削除
          const subCols = ['insurances', 'standards', 'bonus'];
          for (const sub of subCols) {
            const subCol = collection(this.firestore, 'companies', companyId, 'employees', empId, sub);
            const subSnap = await getDocs(subCol);
            for (const subDoc of subSnap.docs) {
              await deleteDoc(doc(this.firestore, 'companies', companyId, 'employees', empId, sub, subDoc.id));
            }
          }
          await deleteDoc(doc(this.firestore, 'companies', companyId, 'employees', empId));
        }
        const officesCol = collection(this.firestore, 'companies', companyId, 'offices');
        const officesSnap = await getDocs(officesCol);
        for (const officeDoc of officesSnap.docs) {
          await deleteDoc(doc(this.firestore, 'companies', companyId, 'offices', officeDoc.id));
        }
        // 3. 会社本体を削除
        await deleteDoc(doc(this.firestore, 'companies', companyId));
      }
      // 4. ユーザー削除
      await deleteUser(this.user);
      alert('アカウントと関連データが全て削除されました。ご利用ありがとうございました。');
      window.location.href = '/';
    } catch (err: any) {
      if (err.code === 'auth/wrong-password') {
        alert('パスワードが正しくありません。アカウント削除を中止します。');
      } else if (err.code === 'auth/too-many-requests') {
        alert('リクエストが多すぎます。しばらくしてから再度お試しください。');
      } else {
        alert('アカウント削除に失敗しました: ' + (err.message || err.code));
      }
    }
  }
}
