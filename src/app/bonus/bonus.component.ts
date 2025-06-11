import { Component, Input, inject, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Firestore, collection, addDoc, serverTimestamp, getDocs } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Component({
  selector: 'app-bonus',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bonus.component.html',
  styleUrl: './bonus.component.css'
})
export class BonusComponent implements OnInit, OnChanges {
  @Input() employeeId: string | null = null;
  @Input() companyId: string | null = null;
  bonusAmount: number | null = null;
  standardBonusAmount: number | null = null;
  bonusDate: string = '';
  latestBonus: any = null;
  allBonuses: any[] = [];
  private firestore = inject(Firestore);
  private router = inject(Router);

  async ngOnInit() {
    await this.loadLatestBonus();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if ((changes['companyId'] && this.companyId) || (changes['employeeId'] && this.employeeId)) {
      await this.loadLatestBonus();
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

  onBonusAmountChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const num = Number(value);
    if (!isNaN(num)) {
      this.bonusAmount = num;
      this.standardBonusAmount = Math.floor(num / 1000) * 1000;
    } else {
      this.bonusAmount = null;
      this.standardBonusAmount = null;
    }
  }

  async saveBonus() {
    if (!this.employeeId || !this.companyId) {
      alert('従業員情報が取得できません');
      return;
    }
    if (!this.bonusDate || this.bonusAmount === null || this.standardBonusAmount === null) {
      alert('賞与支給年月日・賞与額を入力してください');
      return;
    }
    // 年度計算
    const dateObj = new Date(this.bonusDate);
    const nendo = dateObj.getMonth() + 1 >= 4 ? dateObj.getFullYear() : dateObj.getFullYear() - 1;
    const start = new Date(nendo, 3, 1); // 4月1日
    const end = new Date(nendo + 1, 3, 1); // 翌年4月1日未満
    // 同年度のbonusをすべて取得
    const bonusCol = collection(this.firestore, `companies/${this.companyId}/employees/${this.employeeId}/bonus`);
    const bonusSnap = await getDocs(bonusCol);
    const bonuses = bonusSnap.docs.map(doc => doc.data() as any);
    const nendoBonuses = bonuses.filter(b => b.bonusDate && new Date(b.bonusDate) >= start && new Date(b.bonusDate) < end);
    // 今回入力値も加えた合計（standardBonusAmountベース）
    const nendoBonusTotal = nendoBonuses.reduce((sum, b) => sum + (typeof b.standardBonusAmount === 'number' ? b.standardBonusAmount : Number(b.standardBonusAmount) || 0), 0) + (this.standardBonusAmount || 0);
    let nendoBonusExcess: number | undefined = undefined;
    if (nendoBonusTotal >= 5730000) {
      nendoBonusExcess = nendoBonusTotal - 5730000;
    }
    let nendoBonusExcessAdjusted: number | undefined = undefined;
    if (nendoBonusExcess !== undefined) {
      nendoBonusExcessAdjusted = Math.max((this.standardBonusAmount || 0) - nendoBonusExcess, 0);
    }
    // 同月のbonusをすべて取得
    const inputYear = dateObj.getFullYear();
    const inputMonth = dateObj.getMonth(); // 0-indexed
    const monthBonuses = bonuses.filter(b => {
      if (!b.bonusDate) return false;
      const d = new Date(b.bonusDate);
      return d.getFullYear() === inputYear && d.getMonth() === inputMonth;
    });
    const monthBonusTotal = monthBonuses.reduce((sum, b) => sum + (typeof b.standardBonusAmount === 'number' ? b.standardBonusAmount : Number(b.standardBonusAmount) || 0), 0) + (this.standardBonusAmount || 0);
    let monthBonusExcessAdjusted: number | undefined = undefined;
    if (monthBonusTotal > 1500000) {
      monthBonusExcessAdjusted = Math.max(monthBonusTotal - 1500000, 0);
    }
    let monthBonusExcessAdjustedDiff: number | undefined = undefined;
    if (monthBonusExcessAdjusted !== undefined) {
      monthBonusExcessAdjustedDiff = Math.max((this.standardBonusAmount || 0) - monthBonusExcessAdjusted, 0);
    }
    await addDoc(bonusCol, {
      bonusDate: this.bonusDate,
      bonusAmount: this.bonusAmount,
      standardBonusAmount: this.standardBonusAmount,
      nendoBonusTotal,
      monthBonusTotal,
      ...(nendoBonusExcess !== undefined ? { nendoBonusExcess } : {}),
      ...(nendoBonusExcessAdjusted !== undefined ? { nendoBonusExcessAdjusted } : {}),
      ...(monthBonusExcessAdjusted !== undefined ? { monthBonusExcessAdjusted } : {}),
      ...(monthBonusExcessAdjustedDiff !== undefined ? { monthBonusExcessAdjustedDiff } : {}),
      createdAt: serverTimestamp()
    });
    alert('賞与情報を保存しました。賞与の社会保険料を算出してください。');
    this.bonusDate = '';
    this.bonusAmount = null;
    this.standardBonusAmount = null;
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

  get currentNendoBonusTotal(): number {
    const nendo = this.currentNendo;
    const start = new Date(nendo, 3, 1); // 4月1日
    const end = new Date(nendo + 1, 3, 1); // 翌年4月1日未満
    return this.allBonuses
      .filter(b => b.bonusDate && new Date(b.bonusDate) >= start && new Date(b.bonusDate) < end)
      .reduce((sum, b) => sum + (typeof b.bonusAmount === 'number' ? b.bonusAmount : Number(b.bonusAmount) || 0), 0);
  }

  get currentNendoLatestBonusNendoBonusTotal(): number | null {
    const nendo = this.currentNendo;
    const start = new Date(nendo, 3, 1); // 4月1日
    const end = new Date(nendo + 1, 3, 1); // 翌年4月1日未満
    const nendoBonuses = this.allBonuses
      .filter(b => b.bonusDate && new Date(b.bonusDate) >= start && new Date(b.bonusDate) < end && b.standardBonusAmount != null);
    if (nendoBonuses.length === 0) return null;
    // bonusDateが最新のもの
    const latest = nendoBonuses.sort((a, b) => new Date(b.bonusDate).getTime() - new Date(a.bonusDate).getTime())[0];
    return latest.nendoBonusTotal ?? null;
  }

  get currentYearMonthLabel(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return `${year}年${month.toString().padStart(2, '0')}月`;
  }

  get currentMonthLatestBonusMonthBonusTotal(): number | null {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthBonuses = this.allBonuses
      .filter(b => {
        if (!b.bonusDate) return false;
        const d = new Date(b.bonusDate);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      });
    if (monthBonuses.length === 0) return null;
    // bonusDateが最新のもの
    const latest = monthBonuses.sort((a, b) => new Date(b.bonusDate).getTime() - new Date(a.bonusDate).getTime())[0];
    return latest.monthBonusTotal ?? null;
  }
}
