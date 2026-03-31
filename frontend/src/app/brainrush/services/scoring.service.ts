import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScoringService {
  private scoreSubject = new BehaviorSubject<number>(0);
  score$ = this.scoreSubject.asObservable();

  setScore(score: number) {
    this.scoreSubject.next(score);
  }

  getScore() {
    return this.scoreSubject.value;
  }
}
