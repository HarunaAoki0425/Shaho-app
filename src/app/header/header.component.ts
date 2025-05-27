import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  constructor(private auth: Auth, private router: Router) {}

  async logout() {
    if (window.confirm('ログアウトしますか？')) {
      await signOut(this.auth);
      await this.router.navigate(['/login']);
    }
  }
}
