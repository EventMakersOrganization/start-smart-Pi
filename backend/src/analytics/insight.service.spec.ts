import { InsightService } from './insight.service';

describe('InsightService', () => {
  it('should generate actionable insights from retention, cohorts, and engagement scoring', async () => {
    const analyticsService = {
      getRetentionAnalytics: jest.fn().mockResolvedValue({
        totalUsers: 100,
        retainedUsers: 55,
        returningUsers: 34,
        dropoutRate: 45,
        trend: [
          { date: '2026-03-01', activeUsers: 80, returningUsers: 40 },
          { date: '2026-03-02', activeUsers: 78, returningUsers: 39 },
          { date: '2026-03-03', activeUsers: 76, returningUsers: 38 },
          { date: '2026-03-04', activeUsers: 75, returningUsers: 37 },
          { date: '2026-03-05', activeUsers: 74, returningUsers: 36 },
          { date: '2026-03-06', activeUsers: 73, returningUsers: 35 },
          { date: '2026-03-07', activeUsers: 72, returningUsers: 34 },
          { date: '2026-03-08', activeUsers: 60, returningUsers: 30 },
          { date: '2026-03-09', activeUsers: 58, returningUsers: 29 },
          { date: '2026-03-10', activeUsers: 56, returningUsers: 28 },
          { date: '2026-03-11', activeUsers: 55, returningUsers: 27 },
          { date: '2026-03-12', activeUsers: 54, returningUsers: 26 },
          { date: '2026-03-13', activeUsers: 53, returningUsers: 25 },
          { date: '2026-03-14', activeUsers: 52, returningUsers: 24 },
        ],
      }),
      getCohortAnalytics: jest.fn().mockResolvedValue([
        {
          cohort: 'performance:low',
          averageScore: 30,
          averageRisk: 62,
          engagementScore: 28,
        },
      ]),
      getStudentEngagementScore: jest.fn().mockResolvedValue({
        userId: 'u1',
        engagementScore: 30,
        level: 'low',
      }),
    };

    const activityModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]),
      }),
    };

    const service = new InsightService(analyticsService as any, activityModel as any);

    const result = await service.generateInsights();

    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.insights.some((line) => line.toLowerCase().includes('dropout'))).toBe(true);
    expect(result.insights.some((line) => line.toLowerCase().includes('engagement'))).toBe(true);
    expect(result.insights.some((line) => line.toLowerCase().includes('higher risk'))).toBe(true);
  });

  it('should return safe default message when no rule is triggered', async () => {
    const analyticsService = {
      getRetentionAnalytics: jest.fn().mockResolvedValue({
        totalUsers: 100,
        retainedUsers: 95,
        returningUsers: 80,
        dropoutRate: 5,
        trend: [],
      }),
      getCohortAnalytics: jest.fn().mockResolvedValue([
        {
          cohort: 'course:grade-10',
          averageScore: 75,
          averageRisk: 20,
          engagementScore: 72,
        },
      ]),
      getStudentEngagementScore: jest.fn().mockResolvedValue({
        userId: 'u1',
        engagementScore: 72,
        level: 'high',
      }),
    };

    const activityModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const service = new InsightService(analyticsService as any, activityModel as any);

    const result = await service.generateInsights();

    expect(result).toEqual({
      insights: ['No critical anomalies detected across retention, cohorts, and engagement scoring this cycle.'],
    });
  });
});
