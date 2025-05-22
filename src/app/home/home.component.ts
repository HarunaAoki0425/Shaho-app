import { Component, OnDestroy } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { HeaderComponent } from '../header/header.component';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeaderComponent, MatIconModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnDestroy {
  currentUser: User | null = null;
  private unsubscribe: (() => void) | undefined;

  constructor(private auth: Auth) {
    this.unsubscribe = onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      console.log('Current user:', user);
    });
  }

  ngOnDestroy() {
    if (this.unsubscribe) this.unsubscribe();
  }
}
