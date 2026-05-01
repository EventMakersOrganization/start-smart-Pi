import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, catchError, of, shareReplay } from 'rxjs';

export interface DashboardData {
  totalUsers: number;
  activeUsers: number;
  highRiskUsers: number;
  totalAlerts: number;
  totalUsersDeltaPct: number | null;
  activeUsersDeltaPct: number | null;
  highRiskUsersDeltaPct: number | null;
  totalAlertsDeltaPct: number | null;
  averageRiskScore: number;
  aiDecisionsToday: number;
}

export interface ActivityByHourResponse {
  hourLabels: string[];
  activityCounts: number[];
  sessionCounts: number[];
  windowStartUtc?: string;
  windowEndUtc?: string;
}

export interface ActivityChannelSplitResponse {
  webPct: number;
  mobilePct: number;
  unknownPct: number;
  total: number;
}

export interface AiEventFeedItem {
  id: string;
  type: 'explainability' | 'alert' | 'risk';
  title: string;
  description: string;
  at: string;
  source: string;
}

export interface AiServiceMonitorSnapshot {
  ok: boolean;
  overall?: string;
  avgLatencyMs?: number;
  requestsPerMinute?: number;
  error?: string;
}

export interface RiskDistributionData {
  low: number;
  medium: number;
  high: number;
  critical?: number;
  lowPercentage: number;
  mediumPercentage: number;
  highPercentage: number;
  criticalPercentage?: number;
  total: number;
}

export interface RiskTrendData {
  date: string;
  averageScore: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
}

export interface AlertTrendData {
  labels: string[];
  values: number[];
}

export interface RecentAlertItem {
  _id?: string;
  userId?: string;
  student?: {
    _id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  riskLevel?: string;
  severity?: string;
  message: string;
  createdAt?: string | Date;
  timestamp?: string | Date;
  resolved?: boolean;
}

export interface StudentRiskListItem {
  userId: string;
  name: string;
  email: string;
  riskScore: number;
  riskLevel: string;
  alertStatus: 'Pending' | 'Reviewed' | 'Resolved';
  isOnline?: boolean;
}

export interface InterventionTrackingItem {
  userId: string;
  name: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dropoutProbability: number;
  suggestions: string[];
  status: 'applied' | 'pending';
  interventionType?: 'post_evaluation' | 'remedial_content' | 'instructor_alert' | 'none' | string;
}

export interface AbAutomationSummary {
  winner: 'A' | 'B' | 'tie' | string;
  sampleSize: number;
  groupA: { count: number; avgRiskDelta: number };
  groupB: { count: number; avgRiskDelta: number };
}

export interface AbAutomationRunResult {
  processed: number;
  highRiskStudents: number;
  winner: string;
}

export interface RetentionTrendPoint {
  date: string;
  activeUsers: number;
  returningUsers: number;
}

export interface RetentionAnalyticsData {
  totalUsers: number;
  retainedUsers: number;
  returningUsers: number;
  dropoutRate: number;
  trend: RetentionTrendPoint[];
}

export interface CohortAnalyticsItem {
  cohort: string;
  averageScore: number;
  averageRisk: number;
  engagementScore: number;
}

export interface InsightsData {
  insights: string[];
}

export interface UnifiedStudentAnalytics {
  userId: string;
  riskScore: {
    score: number;
    riskLevel: string;
    lastUpdated: string | Date | null;
  };
  activityMetrics: {
    totalActivities: number;
    weeklyActivityFrequency: number;
    quizAttempts: number;
    lastActivityAt: string | Date | null;
  };
  performanceMetrics: {
    averageScore: number;
    completionRate: number;
    academicLevel: string;
    profileRiskLevel: string;
    gamificationPoints: number;
    lastUpdated: string | Date | null;
    source: string;
  };
  gameMetrics: {
    sessionsPlayed: number;
    averageGameScore: number;
    currentStreak: number;
    highestLevel: number;
    points: number;
    lastPlayedAt: string | Date | null;
    source: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private apiUrl = 'http://localhost:3000/api/analytics';
  private monitoringUrl = 'http://localhost:3000/api/monitoring';

  /** Memoized observables so repeated subscriptions / navigation reuse one HTTP round-trip. Cleared on logout (see AuthService). */
  private readonly sharedObservables = new Map<string, Observable<unknown>>();

  constructor(private http: HttpClient) {}

  /**
   * Drop all shared analytics streams (call on logout so the next session does not see cached data).
   */
  clearSharedAnalyticsCache(): void {
    this.sharedObservables.clear();
  }

  /**
   * One shared cold→hot observable per logical key; refCount false keeps last value for route re-entry.
   */
  private shareAnalyticsRequest<T>(key: string, factory: () => Observable<T>): Observable<T> {
    const existing = this.sharedObservables.get(key) as Observable<T> | undefined;
    if (existing) {
      return existing;
    }
    const obs = factory().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.sharedObservables.set(key, obs);
    return obs;
  }

  /**
   * Get dashboard KPI data
   */
  getDashboardData(): Observable<DashboardData> {
    return this.shareAnalyticsRequest('dashboard', () =>
      this.http.get<DashboardData>(`${this.apiUrl}/dashboard`),
    );
  }

  getActivityByHour(startIso?: string, endIso?: string): Observable<ActivityByHourResponse> {
    const key =
      startIso && endIso ? `activityByHour:${startIso}:${endIso}` : 'activityByHour';
    return this.shareAnalyticsRequest(key, () => {
      const params: Record<string, string> = {};
      if (startIso && endIso) {
        params['start'] = startIso;
        params['end'] = endIso;
      }
      return this.http.get<ActivityByHourResponse>(`${this.apiUrl}/activity-by-hour`, {
        params: Object.keys(params).length ? params : undefined,
      });
    });
  }

  getActivityChannelSplit(): Observable<ActivityChannelSplitResponse> {
    return this.shareAnalyticsRequest('activityChannelSplit', () =>
      this.http.get<ActivityChannelSplitResponse>(`${this.apiUrl}/activity-channel-split`),
    );
  }

  getAiEventsFeed(limit: number = 20): Observable<AiEventFeedItem[]> {
    return this.shareAnalyticsRequest(`aiEventsFeed:${limit}`, () =>
      this.http.get<AiEventFeedItem[]>(`${this.apiUrl}/ai-events-feed`, {
        params: { limit: String(limit) },
      }),
    );
  }

  getAiServiceMonitor(): Observable<AiServiceMonitorSnapshot> {
    return this.shareAnalyticsRequest('aiServiceMonitor', () =>
      this.http.get<AiServiceMonitorSnapshot>(`${this.monitoringUrl}/ai-service`),
    );
  }

  /**
   * Get risk trends over time
   * @param days - Number of days to look back (default: 30)
   */
  getRiskTrends(days: number = 30): Observable<RiskTrendData[]> {
    return this.shareAnalyticsRequest(`riskTrends:${days}`, () =>
      this.http.get<RiskTrendData[]>(`${this.apiUrl}/risk-trends?days=${days}`),
    );
  }

  /**
   * Get recent alerts
   * @param limit - Number of alerts to return (default: 10)
   */
  getRecentAlerts(limit: number = 10): Observable<RecentAlertItem[]> {
    return this.shareAnalyticsRequest(`recentAlerts:${limit}`, () =>
      this.http.get<RecentAlertItem[]>(`${this.apiUrl}/recent-alerts?limit=${limit}`),
    );
  }

  getRiskDistribution(): Observable<RiskDistributionData> {
    return this.shareAnalyticsRequest('riskDistribution', () =>
      this.http.get<RiskDistributionData>(`${this.apiUrl}/risk-distribution`).pipe(
        catchError(() =>
          this.http.get<RiskDistributionData>('http://localhost:3000/api/analytics/kpis/risk-distribution'),
        ),
      ),
    );
  }

  getAlertTrends(days: number = 7): Observable<AlertTrendData> {
    const fetchLimit = Math.max(10, days * 5);

    return this.shareAnalyticsRequest(`alertTrends:${days}`, () =>
      this.getRecentAlerts(fetchLimit).pipe(
        map((alerts) => {
          const dayBuckets = new Map<string, number>();
          const labels: string[] = [];
          const values: number[] = [];
          const now = new Date();

          for (let offset = days - 1; offset >= 0; offset--) {
            const date = new Date(now);
            date.setDate(now.getDate() - offset);
            const key = this.toDayKey(date);
            dayBuckets.set(key, 0);
            labels.push(date.toLocaleDateString(undefined, { weekday: 'short' }));
          }

          for (const alert of alerts) {
            const dateValue = alert.timestamp || alert.createdAt;
            if (!dateValue) {
              continue;
            }

            const key = this.toDayKey(new Date(dateValue));
            if (dayBuckets.has(key)) {
              dayBuckets.set(key, (dayBuckets.get(key) || 0) + 1);
            }
          }

          for (const key of dayBuckets.keys()) {
            values.push(dayBuckets.get(key) || 0);
          }

          return { labels, values };
        }),
      ),
    );
  }

  getStudentRiskList(): Observable<StudentRiskListItem[]> {
    return this.shareAnalyticsRequest('studentRiskList', () =>
      this.http.get<StudentRiskListItem[]>(`${this.apiUrl}/student-risk-list`).pipe(
        catchError(() =>
          forkJoin({
            riskScores: this.http.get<Array<any>>('http://localhost:3000/api/riskscores'),
            alerts: this.http.get<Array<any>>('http://localhost:3000/api/alerts/unresolved'),
          }).pipe(
            map(({ riskScores, alerts }) => {
              const unresolvedByUser = new Map<string, boolean>();

              for (const alert of alerts || []) {
                const userId = this.extractUserIdFromAlert(alert);
                if (userId) {
                  unresolvedByUser.set(userId, true);
                }
              }

              return (riskScores || []).map((item) => {
                const user = item.user || {};
                const userId = user._id || user.id || (typeof item.user === 'string' ? item.user : '');
                const firstName = user.first_name || '';
                const lastName = user.last_name || '';
                const name = `${firstName} ${lastName}`.trim() || 'Unknown Student';
                const normalizedRisk = String(item.riskLevel || '').toLowerCase();

                return {
                  userId,
                  name,
                  email: user.email || 'N/A',
                  riskScore: Number(item.score || 0),
                  riskLevel: normalizedRisk,
                  alertStatus: unresolvedByUser.has(userId) ? 'Pending' : 'Resolved',
                } as StudentRiskListItem;
              });
            }),
            catchError(() => of([])),
          ),
        ),
      ),
    );
  }

  getInterventions(): Observable<InterventionTrackingItem[]> {
    return this.shareAnalyticsRequest('interventions', () =>
      this.http.get<InterventionTrackingItem[]>(`${this.apiUrl}/interventions`).pipe(
        catchError(() =>
          this.getStudentRiskList().pipe(
            map((students) =>
              (students || []).map(
                (student) =>
                  ({
                    userId: student.userId,
                    name: student.name,
                    riskLevel: this.normalizeRiskLevel(student.riskLevel),
                    dropoutProbability: this.mapRiskScoreToProbability(student.riskScore),
                    suggestions: [this.defaultIntervention(student.riskLevel)],
                    status: student.alertStatus === 'Resolved' ? 'applied' : 'pending',
                  }) as InterventionTrackingItem,
              ),
            ),
            catchError(() => of([])),
          ),
        ),
      ),
    );
  }

  getAbAutomationSummary(): Observable<AbAutomationSummary> {
    return this.shareAnalyticsRequest('abAutomationSummary', () =>
      this.http.get<AbAutomationSummary>(`${this.apiUrl}/ab-testing/automation/summary`),
    );
  }

  runAbAutomationNow(): Observable<AbAutomationRunResult> {
    this.sharedObservables.delete('abAutomationSummary');
    return this.http.post<AbAutomationRunResult>(`${this.apiUrl}/ab-testing/automation/run`, {});
  }

  markInterventionCompleted(userId: string): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/ab-testing/outcome`, {
        userId,
        outcome: 'applied',
      })
      .pipe(catchError(() => of({ success: false })));
  }

  getRetentionAnalytics(days: number = 30): Observable<RetentionAnalyticsData> {
    return this.shareAnalyticsRequest(`retention:${days}`, () =>
      this.http.get<RetentionAnalyticsData>(`${this.apiUrl}/retention?days=${days}`),
    );
  }

  getCohortAnalytics(): Observable<CohortAnalyticsItem[]> {
    return this.shareAnalyticsRequest('cohorts', () =>
      this.http.get<CohortAnalyticsItem[]>(`${this.apiUrl}/cohorts`),
    );
  }

  getInsights(): Observable<InsightsData> {
    return this.shareAnalyticsRequest('insights', () =>
      this.http.get<InsightsData>(`${this.apiUrl}/insights`),
    );
  }

  getUnifiedAnalytics(userId: string): Observable<UnifiedStudentAnalytics> {
    return this.shareAnalyticsRequest(`unified:${userId}`, () =>
      this.http.get<UnifiedStudentAnalytics>(`${this.apiUrl}/unified/${userId}`),
    );
  }

  private extractUserIdFromAlert(alert: any): string {
    if (!alert) {
      return '';
    }

    if (alert.userId && typeof alert.userId === 'string') {
      return alert.userId;
    }

    if (alert.userId && alert.userId._id) {
      return alert.userId._id;
    }

    if (alert.student && typeof alert.student === 'string') {
      return alert.student;
    }

    if (alert.student && alert.student._id) {
      return alert.student._id;
    }

    return '';
  }

  private toDayKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private normalizeRiskLevel(level: string): 'low' | 'medium' | 'high' {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
      return normalized as 'low' | 'medium' | 'high';
    }
    if (normalized === 'critical') {
      return 'high';
    }

    return 'medium';
  }

  private mapRiskScoreToProbability(score: number): number {
    const normalized = Math.max(0, Math.min(100, Number(score || 0)));
    return Number((normalized / 100).toFixed(2));
  }

  private defaultIntervention(riskLevel: string): string {
    const normalized = String(riskLevel || '').toLowerCase();

    if (normalized === 'high') {
      return 'Schedule 1-on-1 session and send personalized feedback';
    }

    if (normalized === 'medium') {
      return 'Encourage participation with weekly check-ins';
    }

    return 'Maintain engagement with positive reinforcement';
  }
}
