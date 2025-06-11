import { Component } from '@angular/core';
import Decimal from 'decimal.js';
import { Firestore, collection, addDoc, doc, serverTimestamp } from '@angular/fire/firestore';
import { inject } from '@angular/core';

@Component({
  selector: 'app-judge',
  imports: [],
  templateUrl: './judge.component.html',
  styleUrl: './judge.component.css'
})
export class JudgeComponent {
  private firestore = inject(Firestore);

  static judgeSocialInsuranceRequired({ employee, office, company }: { employee: any, office: any, company: any }): boolean {
    // 有期契約で2か月以内かつ更新なしの場合は社会保険加入不要（最優先で判定）
    if (
      employee?.employmentPeriodType === '有期' &&
      employee?.employmentPeriodStart &&
      employee?.employmentPeriodEnd &&
      employee?.employmentPeriodRenewal === '更新なし'
    ) {
      const start = new Date(employee.employmentPeriodStart);
      const end = new Date(employee.employmentPeriodEnd);
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 62) { // 2か月以内（厳密に2か月=62日で判定）
        console.log('[DEBUG] 判定結果: false (有期2か月以内・更新なし)');
        return false;
      }
    }
    // 事業所が非適用なら即false
    if (office?.applicableOffice === false) {
      console.log('[DEBUG] 判定結果: false (事業所が非適用)');
      return false;
    }
    // すべての保険判定がfalseなら対象外
    const health = this.judgeHealthInsurance(employee);
    const care = this.judgeCareInsurance(employee);
    const pension = this.judgePensionInsurance(employee);
    if (!health && !care && !pension) {
      console.log('[DEBUG] 判定結果: false (全保険判定がfalse)');
      return false;
    }
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

  static judgeHealthInsurance(employee: any): boolean {
    if (!employee?.birthdate) return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const birth = new Date(employee.birthdate);
    if (isNaN(birth.getTime())) return false;
    const seventyFifthBirthday = new Date(birth.getFullYear() + 75, birth.getMonth(), birth.getDate());
    const lastEligibleYear = seventyFifthBirthday.getFullYear();
    const lastEligibleMonth = seventyFifthBirthday.getMonth() + 1;
    // 75歳の誕生日の属する月まで対象
    if (
      currentYear < lastEligibleYear ||
      (currentYear === lastEligibleYear && currentMonth <= lastEligibleMonth)
    ) {
      return true;
    }
    return false;
  }

  static judgeCareInsurance(employee: any): boolean {
    if (!employee?.birthdate) return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const birth = new Date(employee.birthdate);
    if (isNaN(birth.getTime())) return false;
    // 40歳の誕生日の前日
    const fortyBirthday = new Date(birth.getFullYear() + 40, birth.getMonth(), birth.getDate());
    const fortyEve = new Date(fortyBirthday);
    fortyEve.setDate(fortyEve.getDate() - 1);
    const fortyEveYear = fortyEve.getFullYear();
    const fortyEveMonth = fortyEve.getMonth() + 1;
    // 65歳の誕生日の前日
    const sixtyFiveBirthday = new Date(birth.getFullYear() + 65, birth.getMonth(), birth.getDate());
    const sixtyFiveEve = new Date(sixtyFiveBirthday);
    sixtyFiveEve.setDate(sixtyFiveEve.getDate() - 1);
    let sixtyFiveEveYear = sixtyFiveEve.getFullYear();
    let sixtyFiveEveMonth = sixtyFiveEve.getMonth() + 1;
    // 終了月は65歳の誕生日の前日が含まれる月の前の月
    let endYear = sixtyFiveEveYear;
    let endMonth = sixtyFiveEveMonth - 1;
    if (endMonth === 0) {
      endMonth = 12;
      endYear -= 1;
    }
    // 判定
    const afterStart =
      currentYear > fortyEveYear ||
      (currentYear === fortyEveYear && currentMonth >= fortyEveMonth);
    const beforeEnd =
      currentYear < endYear ||
      (currentYear === endYear && currentMonth <= endMonth);
    return afterStart && beforeEnd;
  }

  static judgePensionInsurance(employee: any): boolean {
    if (!employee?.birthdate) return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const birth = new Date(employee.birthdate);
    if (isNaN(birth.getTime())) return false;
    // 70歳の誕生日の前日
    const seventyBirthday = new Date(birth.getFullYear() + 70, birth.getMonth(), birth.getDate());
    const seventyEve = new Date(seventyBirthday);
    seventyEve.setDate(seventyEve.getDate() - 1);
    let seventyEveYear = seventyEve.getFullYear();
    let seventyEveMonth = seventyEve.getMonth() + 1;
    // 終了月は70歳の誕生日の前日が含まれる月の前の月
    let endYear = seventyEveYear;
    let endMonth = seventyEveMonth - 1;
    if (endMonth === 0) {
      endMonth = 12;
      endYear -= 1;
    }
    // 判定
    const result = (
      currentYear < endYear ||
      (currentYear === endYear && currentMonth <= endMonth)
    );
    // 70歳を超えていても、seniorVoluntaryEnrollmentが「する」ならtrue
    if (employee.seniorVoluntaryEnrollment === 'する') {
      return true;
    }
    return result;
  }

  static judgeInternationalSocialInsurance(employee: any): boolean {
    // 海外派遣判定が不要な場合はtrueを返す
    if (!employee.dispatchedAbroad || employee.dispatchedAbroad === '該当しない') {
      return true;
    }
    // 社会保障協定国が「該当しない」の場合は計算対象
    if (employee.socialSecurityAgreement === '該当しない') {
      return true;
    }
    // 社会保障協定国が「該当する」の場合
    if (employee.socialSecurityAgreement === '該当する') {
      // 日本から外国への派遣労働者 かつ 一時派遣が「該当する」
      if (
        employee.dispatchedAbroad === '日本から外国への派遣労働者' &&
        employee.temporaryDispatch === '該当する'
      ) {
        return true;
      }
      // 外国から日本への派遣労働者 かつ 一時派遣が「該当しない」
      if (
        employee.dispatchedAbroad === '外国から日本への派遣労働者' &&
        employee.temporaryDispatch === '該当しない'
      ) {
        return true;
      }
    }
    // それ以外は除外
    return false;
  }

  async onJudgeAndNavigate(employee: any, office: any, company: any, standardId: string) {
    const isTarget = JudgeComponent.judgeSocialInsuranceRequired({ employee, office, company });
    if (!isTarget) {
      // 社会保険対象外の場合、insurancesサブコレクションに保存
      const employeeRef = doc(this.firestore, `companies/${company.id}/employees/${employee.id}`);
      const insurancesCol = collection(employeeRef, 'insurances');
      await addDoc(insurancesCol, {
        createdAt: serverTimestamp(),
        standardId: standardId,
        isInsuranceTarget: false
      });
      // 画面遷移
      // this.router.navigate(['/calculate', employee.id]);
    } else {
      // 対象の場合は従来通り
      // this.router.navigate(['/calculate', employee.id]);
    }
  }
}
