import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from '@angular/fire/auth';
import { Firestore, collection, addDoc, doc, setDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  // ログイン用
  email = '';
  password = '';
  loginError = '';

  // 新規登録用
  registerName = '';
  registerEmail = '';
  registerPassword = '';
  registerPasswordConfirm = '';
  registerError = '';
  registerSuccess = '';
  loginSuccess = '';

  showRegister = false;

  constructor(private auth: Auth, private firestore: Firestore, private router: Router) {}

  private getErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'メールアドレスの形式が正しくありません。';
      case 'auth/user-disabled':
        return 'このユーザーアカウントは無効化されています。';
      case 'auth/user-not-found':
        return 'メールアドレスまたはパスワードが間違っています。';
      case 'auth/wrong-password':
        return 'メールアドレスまたはパスワードが間違っています。';
      case 'auth/email-already-in-use':
        return 'このメールアドレスは既に使用されています。';
      case 'auth/weak-password':
        return 'パスワードは6文字以上で入力してください。';
      case 'auth/missing-password':
        return 'パスワードを入力してください。';
      default:
        return 'エラーが発生しました。もう一度お試しください。';
    }
  }

  async login() {
    this.loginError = '';
    try {
      await signInWithEmailAndPassword(this.auth, this.email, this.password);
      await this.router.navigate(['/home']);
    } catch (err: any) {
      this.loginError = this.getErrorMessage(err);
    }
  }

  async register() {
    this.registerError = '';
    this.registerSuccess = '';
    if (this.registerPassword !== this.registerPasswordConfirm) {
      this.registerError = 'パスワードが一致しません。';
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, this.registerEmail, this.registerPassword);
      if (userCredential.user && this.registerName) {
        await updateProfile(userCredential.user, { displayName: this.registerName });
      }
      // Firestoreにユーザー情報を保存
      await setDoc(doc(this.firestore, 'users', userCredential.user.uid), {
        userName: this.registerName,
        'e-mail': this.registerEmail
      });
      // 入力欄をクリア
      this.registerName = '';
      this.registerEmail = '';
      this.registerPassword = '';
      this.registerPasswordConfirm = '';
      this.showRegister = false;
      this.loginSuccess = '新規登録が完了しました。ログインしてください。';
      this.registerSuccess = '';
    } catch (err: any) {
      this.registerError = this.getErrorMessage(err);
    }
  }
}
