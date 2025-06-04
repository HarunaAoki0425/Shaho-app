import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { EmployeeListComponent } from './employee-list/employee-list.component';
import { EmployeeAddComponent } from './employee-add/employee-add.component';
import { CompanySettingComponent } from './company-setting/company-setting.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },
  { path: 'employee-list', component: EmployeeListComponent },
  { path: 'employee-add', component: EmployeeAddComponent },
  { path: 'company-setting', component: CompanySettingComponent },
  { path: 'kenpo-rates', loadComponent: () => import('./kenpo-rates/kenpo-rates.component').then(m => m.KenpoRatesComponent) },
  { path: 'employee-detail/:id', loadComponent: () => import('./employee-detail/employee-detail.component').then(m => m.EmployeeDetailComponent) },
  { path: 'rates-management', loadComponent: () => import('./rates-management/rates-management.component').then(m => m.RatesManagementComponent) },
  { path: 'calculate/:id', loadComponent: () => import('./calculate/calculate.component').then(m => m.CalculateComponent) },
  { path: 'insurance-history/:id', loadComponent: () => import('./insurance-history/insurance-history.component').then(m => m.InsuranceHistoryComponent) },
];
