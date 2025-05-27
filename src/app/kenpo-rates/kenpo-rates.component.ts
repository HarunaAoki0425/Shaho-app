import { Component, OnInit, inject, runInInjectionContext, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import Decimal from 'decimal.js';

@Component({
  selector: 'app-kenpo-rates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kenpo-rates.component.html',
  styleUrl: './kenpo-rates.component.css'
})
export class KenpoRatesComponent implements OnInit {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  allRates: any[] = [];
  years: number[] = [];
  selectedYear: number = 2025;
  prefectures: any[] = [];
  columns: any[][] = [[], [], []];

  readonly PREF_ORDER = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];

  async getAllRates() {
    const snapshot = await getDocs(collection(this.firestore, 'insurance_rates'));
    this.allRates = snapshot.docs.map(doc => doc.data());
    // 年度リストをユニークに抽出し降順ソート
    const yearSet = new Set(this.allRates.map(d => d.year));
    this.years = Array.from(yearSet).sort((a, b) => b - a);
  }

  async ngOnInit() {
    await runInInjectionContext(this.injector, async () => {
      await this.getAllRates();
      this.selectedYear = this.years[0];
      this.filterByYear();
    });
  }

  async onYearChange() {
    await runInInjectionContext(this.injector, async () => {
      await this.getAllRates();
      this.filterByYear();
    });
  }

  filterByYear() {
    this.prefectures = this.allRates
      .filter(d => Number(d.year) === Number(this.selectedYear))
      .filter(d => this.PREF_ORDER.indexOf(d['prefecture']) !== -1)
      .sort((a, b) => this.PREF_ORDER.indexOf(a['prefecture']) - this.PREF_ORDER.indexOf(b['prefecture']));
    this.splitColumns();
  }

  private splitColumns() {
    this.columns = [
      this.prefectures.slice(0, 16),
      this.prefectures.slice(16, 32),
      this.prefectures.slice(32, 47)
    ];
  }

  /**
   * health_insuranceをdecimal.jsで100倍して返す
   */
  getHealthInsuranceRate100x(rate: any): string {
    if (rate == null || rate === '') return '';
    try {
      return new Decimal(rate).times(100).toString();
    } catch {
      return '';
    }
  }
} 