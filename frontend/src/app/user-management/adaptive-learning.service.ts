import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type TargetLevel = 'beginner' | 'intermediate' | 'advanced';

export interface GoalSettings {
  studyHoursPerWeek: number;
  targetTopic: string;
  targetScorePerTopic: number;
  exercisesPerDay: number;
  targetLevel: TargetLevel;
  deadline: string;
  createdAt: string;
}

export type BadgeCategory = 'performance' | 'progress' | 'topic' | 'milestone';

export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
}

export interface AchievementBadgesResponse {
  totalBadges: number;
  earnedBadges: number;
  completionRate: number;
  badges: AchievementBadge[];
}

export type ReviewUrgency = 'overdue' | 'due_today' | 'upcoming' | 'scheduled';

export interface SpacedRepetitionSession {
  topic: string;
  lastScore: number;
  lastAttemptDate: string;
  nextReviewDate: string;
  intervalDays: number;
  urgency: ReviewUrgency;
  daysUntilReview: number;
  recommendedDifficulty: string;
}

export interface SpacedRepetitionResponse {
  schedule: SpacedRepetitionSession[];
  overdueCount: number;
  dueTodayCount: number;
  nextSession: {
    topic: string;
    urgency: string;
    date: string;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class AdaptiveLearningService {
  private apiUrl = 'http://localhost:3000/api/adaptive';
  private chatApiUrl = 'http://localhost:3000/api/chat';
  private goalsStorageKey = 'adaptive_learning_goals_v1';

  constructor(private http: HttpClient) {}

  getProfile(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/profiles/${userId}`);
  }

  getAllProfiles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/profiles`);
  }

  createProfile(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/profiles`, data);
  }

  updateProfile(userId: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/profiles/${userId}`, data);
  }

  getPerformances(studentId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/performances/student/${studentId}`,
    );
  }

  getRecommendations(studentId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/recommendations/student/${studentId}`,
    );
  }

  startLevelTest(studentId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/level-test/${studentId}`, {});
  }

  submitLevelTest(testId: string, answers: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/level-test/${testId}/submit`, {
      answers,
    });
  }

  startLevelTestStage(subjects?: string[]): Observable<any> {
    return this.http.post(`${this.chatApiUrl}/ai/level-test/start`, {
      subjects: subjects || [],
    });
  }

  submitLevelTestAnswer(sessionId: string, answer: string): Observable<any> {
    return this.http.post(`${this.chatApiUrl}/ai/level-test/submit-answer`, {
      session_id: sessionId,
      answer,
    });
  }

  completeLevelTestStage(sessionId: string): Observable<any> {
    return this.http.post(`${this.chatApiUrl}/ai/level-test/complete`, {
      session_id: sessionId,
    });
  }

  getLevelTestSession(sessionId: string): Observable<any> {
    return this.http.get(
      `${this.chatApiUrl}/ai/level-test/session/${sessionId}`,
    );
  }

  getLevelTest(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/level-test/student/${studentId}`);
  }

  markRecommendationViewed(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/recommendations/${id}/viewed`, {});
  }

  generateRecommendations(studentId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/recommendations/generate/${studentId}`,
      {},
    );
  }

  getExerciseCompletionTracking(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/tracking/${studentId}`);
  }

  getLearningPath(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/learning-path/${studentId}`);
  }

  getSpacedRepetitionSchedule(
    studentId: string,
  ): Observable<SpacedRepetitionResponse> {
    return this.http.get<SpacedRepetitionResponse>(
      `${this.apiUrl}/spaced-repetition/${studentId}`,
    );
  }

  getWeakAreaRecommendations(studentId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/recommendations/weak-areas/${studentId}`,
    );
  }

  getAchievementBadges(
    studentId: string,
  ): Observable<AchievementBadgesResponse> {
    return this.http.get<AchievementBadgesResponse>(
      `${this.apiUrl}/badges/${studentId}`,
    );
  }

  getGoalSettings(studentId: string): GoalSettings | null {
    const store = this.readGoalsStore();
    return store[studentId] || null;
  }

  saveGoalSettings(studentId: string, goals: GoalSettings): void {
    const store = this.readGoalsStore();
    store[studentId] = goals;
    localStorage.setItem(this.goalsStorageKey, JSON.stringify(store));
  }

  resetGoalSettings(studentId: string): void {
    const store = this.readGoalsStore();
    delete store[studentId];
    localStorage.setItem(this.goalsStorageKey, JSON.stringify(store));
  }

  private readGoalsStore(): Record<string, GoalSettings> {
    try {
      const raw = localStorage.getItem(this.goalsStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
