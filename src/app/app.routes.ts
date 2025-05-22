import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { EmployeeListComponent } from './employee-list/employee-list.component';
import { EmployeeAddComponent } from './employee-add/employee-add.component';
import { AdminSettingComponent } from './admin-setting/admin-setting.component';
import { CompanySettingComponent } from './company-setting/company-setting.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },
  { path: 'employee-list', component: EmployeeListComponent },
  { path: 'employee-add', component: EmployeeAddComponent },
  { path: 'admin-setting', component: AdminSettingComponent },
  { path: 'company-setting', component: CompanySettingComponent },
  { path: 'kenpo-rates', loadComponent: () => import('./kenpo-rates/kenpo-rates.component').then(m => m.KenpoRatesComponent) }
];
