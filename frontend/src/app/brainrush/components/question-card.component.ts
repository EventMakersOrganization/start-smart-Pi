import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-question-card',
  template: `
    <div class="question-card">
      <h2>{{ question }}</h2>
      <div class="options">
        <button *ngFor="let option of options" (click)="selectOption.emit(option)" [class.selected]="selectedOption === option">
          {{ option }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .question-card {
      padding: 20px;
      border: 1px solid #ccc;
      margin: 20px 0;
    }
    .options button {
      display: block;
      margin: 10px 0;
      padding: 10px;
      width: 100%;
      border: 1px solid #ccc;
      background-color: white;
      cursor: pointer;
    }
    .options button.selected {
      background-color: #007bff;
      color: white;
    }
  `]
})
export class QuestionCardComponent {
  @Input() question = '';
  @Input() options: string[] = [];
  @Input() selectedOption = '';
  @Output() selectOption = new EventEmitter<string>();
}
