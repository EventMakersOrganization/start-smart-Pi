import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-timer-bar',
  template: `
    <div class="timer-container">
      <svg class="timer-svg" width="80" height="80">
        <circle
          cx="40"
          cy="40"
          r="35"
          stroke="#e9ecef"
          stroke-width="5"
          fill="none"
        />
        <circle
          cx="40"
          cy="40"
          r="35"
          stroke="url(#timerGradient)"
          stroke-width="5"
          fill="none"
          stroke-dasharray="219.91"
          [attr.stroke-dashoffset]="dashOffset"
          stroke-linecap="round"
          transform="rotate(-90 40 40)"
        />
        <defs>
          <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#28a745" />
            <stop offset="50%" stop-color="#ffc107" />
            <stop offset="100%" stop-color="#dc3545" />
          </linearGradient>
        </defs>
      </svg>
      <div class="timer-text">{{ timeLeft }}</div>
    </div>
  `,
  styles: [`
    .timer-container {
      position: relative;
      display: inline-block;
    }
    .timer-svg {
      display: block;
    }
    .timer-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 18px;
      font-weight: bold;
      color: #333;
    }
  `]
})
export class TimerBarComponent {
  @Input() timeLeft = 0;
  @Input() totalTime = 20;

  get dashOffset(): number {
    const circumference = 2 * Math.PI * 35;
    const progress = this.timeLeft / this.totalTime;
    return circumference * (1 - progress);
  }
}
