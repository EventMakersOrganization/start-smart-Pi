import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-question-card',
  template: `
    <div class="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl mx-auto">
      <h2 class="text-2xl font-bold mb-6 text-gray-800">{{ question?.questionText }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button *ngFor="let option of question?.options" 
                (click)="selectAnswer(option)"
                class="p-4 rounded-xl border-2 hover:bg-indigo-50 hover:border-indigo-400 transition-all font-semibold text-lg text-gray-700">
          {{ option }}
        </button>
      </div>
    </div>
  `
})
export class QuestionCardComponent {
  @Input() question: any;
  @Output() answerSelected = new EventEmitter<string>();

  selectAnswer(answer: string) {
    this.answerSelected.emit(answer);
  }
}
