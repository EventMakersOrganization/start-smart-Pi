import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-final-feedback',
  template: `
    <div class="final-feedback">
      <h3>AI Feedback</h3>
      <div *ngIf="feedback.strengths">
        <h4>Strengths</h4>
        <ul>
          <li *ngFor="let strength of feedback.strengths">{{ strength }}</li>
        </ul>
      </div>
      <div *ngIf="feedback.weaknesses">
        <h4>Weaknesses</h4>
        <ul>
          <li *ngFor="let weakness of feedback.weaknesses">{{ weakness }}</li>
        </ul>
      </div>
      <div *ngIf="feedback.recommendations">
        <h4>Recommendations</h4>
        <ul>
          <li *ngFor="let rec of feedback.recommendations">{{ rec }}</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .final-feedback {
      padding: 20px;
      border: 1px solid #ccc;
      margin: 20px 0;
    }
  `]
})
export class FinalFeedbackComponent {
  @Input() feedback: any = {};
}
