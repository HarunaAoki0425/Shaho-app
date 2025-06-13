import { Component, Input, inject, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Firestore, collection, addDoc, serverTimestamp, getDocs, doc } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Component({
  selector: 'app-bonus',
  standalone: true,
  imports: [CommonModule, FormsModule, ],
  templateUrl: './bonus.component.html',
  styleUrl: './bonus.component.css'
})
export class BonusComponent implements OnInit, OnChanges {
  @Input() employeeId: string | null = null;
  @Input() companyId: string | null = null;
  @Input() isLostQualification: boolean | null = null;
  bonusAmount: number | null = null;
  nenkinStandardBonusAmount: number | null = null;
  bonusDate: string = '';
  latestBonus: any = null;
  allBonuses: any[] = [];
  allMonthBonuses: any[] = [];
  private firestore = inject(Firestore);
  private router = inject(Router);

  async ngOnInit() {
    await this.loadLatestBonus();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if ((changes['companyId'] && this.companyId) || (changes['employeeId'] && this.employeeId)) {
      await this.loadLatestBonus();
      await this.getAllMonthBonuses();
    }
  }

  private async loadLatestBonus() {
    if (this.companyId && this.employeeId) {
      const bonusCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus');
      const bonusSnap = await getDocs(bonusCol);
      const bonusList = bonusSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      this.allBonuses = bonusList;
      // bonusDateが最も新しいもの（日まで比較）
      const dateBonuses = bonusList.filter(b => b.bonusDate).sort((a, b) => new Date(b.bonusDate).getTime() - new Date(a.bonusDate).getTime());
      this.latestBonus = dateBonuses.length > 0 ? dateBonuses[0] : null;
    }
  }

  onBonusAmountInput(event: Event) {
    let value = (event.target as HTMLInputElement).value;
    // 全角数字を半角に変換
    value = value.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    // 先頭の0を除去（0単体はOK）
    value = value.replace(/^0+(?!$)/, '');
    // 小数点以下を除去
    value = value.replace(/\..*$/, '');
    (event.target as HTMLInputElement).value = value;
    const num = Number(value);
    if (!isNaN(num)) {
      this.bonusAmount = num;
      this.nenkinStandardBonusAmount = Math.floor(num / 1000) * 1000;
    } else {
      this.bonusAmount = null;
      this.nenkinStandardBonusAmount = null;
    }
  }

  async saveBonus() {
    if (!this.employeeId || !this.companyId) {
      alert('従業員情報が取得できません');
      return;
    }
    if (!this.bonusDate || this.bonusAmount === null) {
      alert('賞与支給年月日・賞与額を入力してください');
      return;
    }
    if (this.bonusAmount === 0) {
      alert('0円の賞与は保存できません');
      return;
    }
    const confirmed = window.confirm('賞与情報を保存し、社会保険料を算出しますか？');
    if (!confirmed) return;

    // 支給日から年度（4月始まり）を算出
    const inputDate = new Date(this.bonusDate);
    const inputYear = inputDate.getFullYear();
    const inputMonth = inputDate.getMonth() + 1;
    const nendo = inputMonth >= 4 ? inputYear : inputYear - 1;

    // Firestoreのコレクション参照を年度ごとに変更
    const monthBonusCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus', String(nendo), 'monthBonus');
    const monthBonusSnap = await getDocs(monthBonusCol);
    let updated = false;
    let savedMonthBonusDocRef: any = null;
    for (const docSnap of monthBonusSnap.docs) {
      const data = docSnap.data();
      if (Array.isArray(data['bonusDateList'])) {
        for (const dateStr of data['bonusDateList']) {
          const d = new Date(dateStr);
          if (d.getFullYear() === inputYear && (d.getMonth() + 1) === inputMonth) {
            // 同じ月のドキュメントが見つかったので、配列に追加
            const newBonusDateList = [...data['bonusDateList'], this.bonusDate];
            const newBonusAmountList = [...data['bonusAmountList'], this.bonusAmount];
            const total = newBonusAmountList.reduce((sum, v) => sum + v, 0);
            let nenkinStandardBonusAmount = Math.floor(total / 1000) * 1000;
            nenkinStandardBonusAmount = Math.min(nenkinStandardBonusAmount, 1500000);
            const kenpoStandardBonusAmount = Math.floor(total / 1000) * 1000;
            const monthTotal = newBonusAmountList.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
            // update
            const docRef = docSnap.ref;
            savedMonthBonusDocRef = docRef;
            await import('@angular/fire/firestore').then(m => m.updateDoc(docRef, {
              bonusDateList: newBonusDateList,
              bonusAmountList: newBonusAmountList,
              nenkinStandardBonusAmount,
              kenpoStandardBonusAmount,
              nendo: nendo,
              monthTotal,
              updatedAt: serverTimestamp(),
            }));
            await this.loadLatestBonus();
            updated = true;
            break;
          }
        }
      }
      if (updated) break;
    }
    if (!updated) {
      // 新規作成
      const bonusDateList = [this.bonusDate];
      const bonusAmountList = [this.bonusAmount];
      const total = bonusAmountList.reduce((sum, v) => sum + v, 0);
      let nenkinStandardBonusAmount = Math.floor(total / 1000) * 1000;
      nenkinStandardBonusAmount = Math.min(nenkinStandardBonusAmount, 1500000);
      const kenpoStandardBonusAmount = Math.floor(total / 1000) * 1000;
      const monthTotal = bonusAmountList.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
      try {
        const docRef = await addDoc(monthBonusCol, {
          bonusDateList,
          bonusAmountList,
          nenkinStandardBonusAmount,
          kenpoStandardBonusAmount,
          nendo: nendo,
          monthTotal,
          createdAt: serverTimestamp(),
        });
        savedMonthBonusDocRef = docRef;
        await this.loadLatestBonus();
      } catch (e) {
        alert('保存に失敗しました');
        console.error(e);
      }
    }

    // --- 年度合計の更新処理 ---
    // monthBonusサブコレクション全件取得
    const nendoDocRef = doc(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus', String(nendo));
    const monthBonusCol2 = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus', String(nendo), 'monthBonus');
    const monthBonusSnap2 = await getDocs(monthBonusCol2);
    let kenpoStandardBonusTotal = 0;
    let nendoTotal = 0;
    for (const docSnap of monthBonusSnap2.docs) {
      const data = docSnap.data();
      if (typeof data['kenpoStandardBonusAmount'] === 'number') {
        kenpoStandardBonusTotal += data['kenpoStandardBonusAmount'];
      }
      if (Array.isArray(data['bonusAmountList'])) {
        nendoTotal += data['bonusAmountList'].reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
      }
    }
    // 年度ドキュメントに合計値を保存
    await import('@angular/fire/firestore').then(m => m.setDoc(nendoDocRef, { kenpoStandardBonusTotal, nendoTotal }, { merge: true }));

    // 年度ドキュメントにkenpoStandardBonusAmount-5730000の値（0未満なら0）も保存
    const kenpoStandardBonusAmountDiff = Math.max(kenpoStandardBonusTotal - 5730000, 0);
    await import('@angular/fire/firestore').then(m => m.setDoc(nendoDocRef, { kenpoStandardBonusAmountDiff }, { merge: true }));

    // 保存・更新したmonthBonusドキュメントだけにkenpoStandardBonusAmountAdjustedとisKenpoBonusLimitNotReachedを保存
    if (savedMonthBonusDocRef) {
      // 最新値を取得
      const savedDocSnap = await import('@angular/fire/firestore').then(m => m.getDoc(savedMonthBonusDocRef));
      const savedData = (savedDocSnap && savedDocSnap.data && typeof savedDocSnap.data === 'function') ? savedDocSnap.data() : null;
      let kenpoStandardBonusAmount = null;
      if (savedData && typeof (savedData as any)['kenpoStandardBonusAmount'] === 'number') {
        kenpoStandardBonusAmount = (savedData as any)['kenpoStandardBonusAmount'];
      } else if (!updated) {
        kenpoStandardBonusAmount = kenpoStandardBonusAmount; // 新規作成時は変数から
      }
      if (kenpoStandardBonusAmount !== null) {
        const kenpoStandardBonusAmountAdjusted = Math.max(kenpoStandardBonusAmount - kenpoStandardBonusAmountDiff, 0);
        const isKenpoBonusLimitNotReached = kenpoStandardBonusAmountDiff === 0;
        await import('@angular/fire/firestore').then(m => m.updateDoc(savedMonthBonusDocRef, { kenpoStandardBonusAmountAdjusted, isKenpoBonusLimitNotReached }));
      }
    }

    if (confirmed) {
      this.goToBonusCalculate();
    }
  }

  goToBonusCalculate() {
    if (!this.employeeId) return;
    this.router.navigate([`/bonus-calculate/${this.employeeId}`]);
  }

  goToBonusHistory() {
    if (!this.employeeId) return;
    this.router.navigate([`/bonus-history/${this.employeeId}`]);
  }

  get currentNendo(): number {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    return month >= 4 ? year : year - 1;
  }

  get currentYearMonthLabel(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return `${year}年${month.toString().padStart(2, '0')}月`;
  }

  get standardBonusAmount(): number | null {
    if (this.bonusAmount === null) return null;
    return Math.floor(this.bonusAmount / 1000) * 1000;
  }

  async getAllMonthBonuses() {
    if (!this.companyId || !this.employeeId) return;
    const bonusCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus');
    const bonusSnap = await getDocs(bonusCol);
    let allMonthBonuses: any[] = [];
    for (const nendoDoc of bonusSnap.docs) {
      const nendoId = nendoDoc.id;
      const monthBonusCol = collection(this.firestore, 'companies', this.companyId, 'employees', this.employeeId, 'bonus', nendoId, 'monthBonus');
      const monthBonusSnap = await getDocs(monthBonusCol);
      allMonthBonuses.push(...monthBonusSnap.docs.map(doc => ({ id: doc.id, nendo: nendoId, ...doc.data() as any })));
    }
    this.allMonthBonuses = allMonthBonuses;
  }

  get latestMonthBonus(): any {
    if (!this.allMonthBonuses || this.allMonthBonuses.length === 0) return null;
    // createdAtがあるものだけで降順ソート
    const sorted = this.allMonthBonuses
      .filter(b => b.createdAt)
      .sort((a, b) => {
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bDate.getTime() - aDate.getTime();
      });
    return sorted.length > 0 ? sorted[0] : null;
  }

  getKenpoStandardBonusTotal(nendo: number): number {
    // nendoに一致するmonthBonusのkenpoStandardBonusAmountを合計
    if (!this.allMonthBonuses) return 0;
    let total = 0;
    for (const bonus of this.allMonthBonuses) {
      if (bonus.nendo == nendo && typeof bonus.kenpoStandardBonusAmount === 'number') {
        total += bonus.kenpoStandardBonusAmount;
      }
    }
    return total;
  }

  getNendoTotal(nendo: number): number {
    if (!this.allMonthBonuses) return 0;
    const total = this.allMonthBonuses.reduce((sum, bonus) => {
      if (bonus.nendo == nendo && typeof bonus.monthTotal === 'number') {
        return sum + bonus.monthTotal;
      }
      return sum;
    }, 0);
    return total;
  }
}
