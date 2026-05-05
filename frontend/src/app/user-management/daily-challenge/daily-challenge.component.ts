import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { AdaptiveLearningService } from '../adaptive-learning.service';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

interface DailyChallengeQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

@Component({
  selector: 'app-daily-challenge',
  templateUrl: './daily-challenge.component.html',
  styleUrls: []
})
export class DailyChallengeComponent implements OnInit, OnDestroy {
  @Input() studentId!: string;

  isLoading = true;
  errorMessage = '';
  
  dailyQuestion: DailyChallengeQuestion | null = null;
  hasCompletedToday = false;
  selectedOptionIndex: number | null = null;
  isCorrect: boolean | null = null;
  
  streak = 0;
  timeLeft = '';
  
  private timerInterval: any;

  constructor(private adaptiveService: AdaptiveLearningService) {}

  ngOnInit(): void {
    if (!this.studentId) {
      // Si l'ID n'est pas encore dispo, on attend (géré par ngOnChanges idéalement, mais ngOnInit suffit souvent si le parent utilise *ngIf)
    }
    this.loadState();
    this.startTimer();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  private getStorageKey(key: string): string {
    return `daily_challenge_${this.studentId}_${key}`;
  }

  private loadState(): void {
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const savedDate = localStorage.getItem(this.getStorageKey('date'));
    const savedStreak = localStorage.getItem(this.getStorageKey('streak'));
    
    this.streak = savedStreak ? parseInt(savedStreak, 10) : 0;

    if (savedDate === todayStr) {
      // 1. Charger la question sauvegardée pour aujourd'hui
      const savedQuestion = localStorage.getItem(this.getStorageKey('question'));
      if (savedQuestion) {
        try {
          this.dailyQuestion = JSON.parse(savedQuestion);
        } catch (e) {
          console.error('Failed to parse saved question', e);
        }
      }

      // 2. Vérifier si déjà complété
      const savedState = localStorage.getItem(this.getStorageKey('state'));
      if (savedState === 'completed') {
        const savedChoice = localStorage.getItem(this.getStorageKey('choice'));
        if (savedChoice !== null && this.dailyQuestion) {
          this.hasCompletedToday = true;
          this.selectedOptionIndex = parseInt(savedChoice, 10);
          this.isCorrect = this.selectedOptionIndex === this.dailyQuestion.correctIndex;
          this.isLoading = false;
          return;
        } else {
          // État incohérent (complété mais choix manquant), on réinitialise
          localStorage.removeItem(this.getStorageKey('state'));
          this.hasCompletedToday = false;
        }
      }
      
      // Si question chargée mais pas encore répondue
      if (this.dailyQuestion) {
        this.isLoading = false;
        return;
      }
    } else if (savedDate) {
      // Un autre jour. Est-ce qu'il a raté un jour ?
      const lastDate = new Date(savedDate);
      const today = new Date(todayStr);
      const diffTime = Math.abs(today.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1) {
        // Streak perdu
        this.streak = 0;
        localStorage.setItem(this.getStorageKey('streak'), '0');
      }
      
      // Réinitialiser l'état
      localStorage.removeItem(this.getStorageKey('state'));
      localStorage.removeItem(this.getStorageKey('question'));
    }

    this.generateQuestion(todayStr);
  }

  private generateQuestion(todayStr: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    const prompt = `Generate a Daily Challenge for a student. 
Create ONE single multiple-choice question about a general computer science, mathematics, or science concept.
You MUST respond ONLY with a valid JSON object containing exactly these keys:
- "question": the question asked
- "options": an array of 4 strings (the possible answers)
- "correctIndex": the index (0 to 3) of the correct answer in the options array.
Do not add any other text, only the JSON.`;

    this.adaptiveService.askChatbot({
      student_id: this.studentId,
      question: prompt,
      conversation_history: []
    }).subscribe({
      next: (response) => {
        try {
          // Extraire le JSON si le bot a ajouté du texte autour
          let jsonStr = response?.answer;
          if (!jsonStr) {
            throw new Error("Empty response from AI");
          }

          const match = jsonStr.match(/\{[\s\S]*\}/);
          if (match) {
            jsonStr = match[0];
          }
          
          const q = JSON.parse(jsonStr) as DailyChallengeQuestion;
          if (q && q.question && Array.isArray(q.options) && typeof q.correctIndex === 'number') {
            this.dailyQuestion = q;
            localStorage.setItem(this.getStorageKey('question'), JSON.stringify(q));
            localStorage.setItem(this.getStorageKey('date'), todayStr);
          } else {
            throw new Error("Invalid format");
          }
        } catch (e) {
          console.error("Failed to parse AI response:", response.answer, e);
          this.setupFallbackQuestion(todayStr);
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error("Failed to generate daily challenge", err);
        this.setupFallbackQuestion(todayStr);
        this.isLoading = false;
      }
    });
  }

  private setupFallbackQuestion(todayStr: string): void {
    this.dailyQuestion = {
      question: "What is the primary characteristic of Object-Oriented Programming?",
      options: [
        "Sequential execution of instructions",
        "Encapsulation of data and behaviors within objects",
        "Direct manipulation of hardware memory",
        "Exclusive use of pure functions"
      ],
      correctIndex: 1
    };
    localStorage.setItem(this.getStorageKey('question'), JSON.stringify(this.dailyQuestion));
    localStorage.setItem(this.getStorageKey('date'), todayStr);
  }

  selectOption(index: number): void {
    if (this.hasCompletedToday || this.selectedOptionIndex !== null) return;
    
    this.selectedOptionIndex = index;
    localStorage.setItem(this.getStorageKey('choice'), index.toString());
    
    if (this.dailyQuestion && index === this.dailyQuestion.correctIndex) {
      this.isCorrect = true;
      this.streak++;
      localStorage.setItem(this.getStorageKey('streak'), this.streak.toString());
    } else {
      this.isCorrect = false;
      // Optionnel: on pourrait réinitialiser le streak, mais on peut être gentil
    }

    setTimeout(() => {
      this.hasCompletedToday = true;
      localStorage.setItem(this.getStorageKey('state'), 'completed');
    }, 1500);
  }

  private startTimer(): void {
    this.updateTimeLeft();
    this.timerInterval = setInterval(() => {
      this.updateTimeLeft();
    }, 1000);
  }

  private updateTimeLeft(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0); // Minuit de ce soir
    
    const diffMs = tomorrow.getTime() - now.getTime();
    
    const h = Math.floor(diffMs / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    this.timeLeft = `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  }
}
