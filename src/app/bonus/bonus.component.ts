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
      const sorted = bonusList.filter(b => b.calcAt).sort((a, b) => new Date(b.calcAt).getTime() - new Date(a.calcAt).getTime());
      this.latestBonus = sorted.length > 0 ? sorted[0] : null;
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
    const bonusCol = collection(this.firestore, `companies/${this.companyId}/employees/${this.employeeId}/bonus`);
    await addDoc(bonusCol, {
      bonusDate: this.bonusDate,
      bonusAmount: this.bonusAmount,
      standardBonusAmount: this.standardBonusAmount,
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
}
