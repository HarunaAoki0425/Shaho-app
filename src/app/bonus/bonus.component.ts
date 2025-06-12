import { Component, Input, inject, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Firestore, collection, addDoc, serverTimestamp, getDocs } from '@angular/fire/firestore';
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
    if (this.bonusAmount === 0) {
      alert('0円の賞与は保存できません');
      return;
    }
    const confirmed = window.confirm('賞与情報を保存し、社会保険料を算出しますか？');
    if (!confirmed) return;
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

}
