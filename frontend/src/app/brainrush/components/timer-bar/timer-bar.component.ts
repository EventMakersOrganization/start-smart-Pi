import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-timer-bar',
  template: `
    <div class="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden">
      <div class="bg-blue-500 h-4 rounded-full transition-all duration-100 ease-linear" 
           [style.width.%]="(timeLeft / totalTime) * 100"></div>
    </div>
  `
})
export class TimerBarComponent implements OnInit, OnDestroy {
  @Input() totalTime = 15000;
  @Output() timeUp = new EventEmitter<void>();
  
  timeLeft!: number;
  private interval: any;

  ngOnInit() {
    this.timeLeft = this.totalTime;
  }

  start() {
    this.timeLeft = this.totalTime;
    this.interval = setInterval(() => {
      this.timeLeft -= 100;
      if (this.timeLeft <= 0) {
        this.stop();
        this.timeUp.emit();
      }
    }, 100);
  }

  stop() {
    clearInterval(this.interval);
  }

  ngOnDestroy() {
    this.stop();
  }
}
