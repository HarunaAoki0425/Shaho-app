import { Component } from '@angular/core';
import Decimal from 'decimal.js';

@Component({
  selector: 'app-judge',
  imports: [],
  templateUrl: './judge.component.html',
  styleUrl: './judge.component.css'
})
export class JudgeComponent {
  static judgeSocialInsuranceRequired({ employee, office, company }: { employee: any, office: any, company: any }): boolean {
    // 条件: 月の所定労働日数・週の所定労働時間が正社員の4分の3以上（Decimalで計算）
    const empWorkDays = new Decimal(employee?.workDays || 0);
    const empWorkHours = new Decimal(employee?.workHours || 0);
    const officeMonthlyDays = new Decimal(office?.monthlyDays || 0);
    const officeWeeklyHours = new Decimal(office?.weeklyHours || 0);
    const daysThreshold = officeMonthlyDays.times(0.75);
    const hoursThreshold = officeWeeklyHours.times(0.75);
    if (
      officeMonthlyDays.gt(0) && officeWeeklyHours.gt(0) &&
      empWorkDays.gte(daysThreshold) &&
      empWorkHours.gte(hoursThreshold)
    ) {
      console.log('[DEBUG] 判定結果: true (4分の3条件)');
      return true;
    }
    // 追加条件: すべて満たす場合true
    const officeEmployeeCount = Number(office?.employeeCount || 0);
    const workHours = Number(employee?.workHours || 0);
    const baseSalary = Number(employee?.baseSalary || 0);
    const isNotStudent = employee?.isStudent === '学生ではない';
    let periodOk = false;
    if (employee?.employmentPeriodType === '無期') {
      periodOk = true;
    } else if (employee?.employmentPeriodType === '有期' && employee?.employmentPeriodStart && employee?.employmentPeriodEnd) {
      const start = new Date(employee.employmentPeriodStart);
      const end = new Date(employee.employmentPeriodEnd);
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      periodOk = diffDays >= 60; // 2か月以上
    }
    const allExtra = (
      officeEmployeeCount >= 51 &&
      workHours >= 20 &&
      baseSalary >= 88000 &&
      isNotStudent &&
      periodOk
    );
    console.log('[DEBUG] 追加条件:', {
      officeEmployeeCount,
      workHours,
      baseSalary,
      isNotStudent,
      periodOk,
      allExtra
    });
    if (allExtra) {
      console.log('[DEBUG] 判定結果: true (追加条件)');
      return true;
    }
    console.log('[DEBUG] 判定結果: false');
    // TODO: 他の条件を追加
    return false;
  }

  static judgeEligibility(employeeData: any): any {
    // TODO: 実際の判定ロジックをここに実装
    // 例: return { health: true, pension: false, ... };
    return { health: true, pension: true, care: true };
  }
}
