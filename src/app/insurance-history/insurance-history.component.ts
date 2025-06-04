import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-insurance-history',
  imports: [],
  templateUrl: './insurance-history.component.html',
  styleUrl: './insurance-history.component.css'
})
export class InsuranceHistoryComponent {
  public employeeId: string | null = null;

  constructor(private route: ActivatedRoute) {
    this.employeeId = this.route.snapshot.paramMap.get('id');
  }
}
