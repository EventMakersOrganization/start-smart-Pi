import { AnalyticsService } from './analytics.service';

describe('AnalyticsService engagement scoring', () => {
  const baseUnified = {
    userId: 'u1',
    riskScore: {
      score: 50,
      riskLevel: 'medium',
      lastUpdated: null,
    },
    activityMetrics: {
      totalActivities: 0,
      weeklyActivityFrequency: 0,
      quizAttempts: 0,
      lastActivityAt: null,
    },
    performanceMetrics: {
      averageScore: 0,
      completionRate: 0,
      academicLevel: 'unknown',
      profileRiskLevel: 'LOW',
      gamificationPoints: 0,
      lastUpdated: null,
      source: 'test',
    },
    gameMetrics: {
      sessionsPlayed: 0,
      averageGameScore: 0,
      currentStreak: 0,
      highestLevel: 0,
      points: 0,
      lastPlayedAt: null,
      source: 'test',
    },
  };

  const makeService = (unifiedOverride: any) => {
    const integrationService = {
      getUnifiedStudentAnalytics: jest.fn().mockResolvedValue({
        ...baseUnified,
        ...unifiedOverride,
      }),
    };

    const service = new AnalyticsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      integrationService as any,
    );

    return { service, integrationService };
  };

  it('should return low engagement for small weighted score', async () => {
    const { service } = makeService({
      activityMetrics: {
        ...baseUnified.activityMetrics,
        weeklyActivityFrequency: 2,
      },
      gameMetrics: {
        ...baseUnified.gameMetrics,
        sessionsPlayed: 3,
      },
      performanceMetrics: {
        ...baseUnified.performanceMetrics,
        completionRate: 5,
      },
    });

    // raw = (2*3) + (3*2) + (5*4) = 32
    const result = await service.getStudentEngagementScore('u1');

    expect(result).toEqual({
      userId: 'u1',
      engagementScore: 32,
      level: 'low',
    });
  });

  it('should return medium engagement at medium threshold', async () => {
    const { service } = makeService({
      activityMetrics: {
        ...baseUnified.activityMetrics,
        weeklyActivityFrequency: 5,
      },
      gameMetrics: {
        ...baseUnified.gameMetrics,
        sessionsPlayed: 5,
      },
      performanceMetrics: {
        ...baseUnified.performanceMetrics,
        completionRate: 10,
      },
    });

    // raw = (5*3) + (5*2) + (10*4) = 65
    const result = await service.getStudentEngagementScore('u1');

    expect(result).toEqual({
      userId: 'u1',
      engagementScore: 65,
      level: 'medium',
    });
  });

  it('should normalize score to 100 and return high engagement', async () => {
    const { service } = makeService({
      activityMetrics: {
        ...baseUnified.activityMetrics,
        weeklyActivityFrequency: 30,
      },
      gameMetrics: {
        ...baseUnified.gameMetrics,
        sessionsPlayed: 20,
      },
      performanceMetrics: {
        ...baseUnified.performanceMetrics,
        completionRate: 20,
      },
    });

    // raw = (30*3) + (20*2) + (20*4) = 210 -> normalized to 100
    const result = await service.getStudentEngagementScore('u1');

    expect(result).toEqual({
      userId: 'u1',
      engagementScore: 100,
      level: 'high',
    });
  });

  it('should keep exact threshold behavior (35 => medium, 70 => high)', async () => {
    const { service: mediumService } = makeService({
      activityMetrics: {
        ...baseUnified.activityMetrics,
        weeklyActivityFrequency: 5,
      },
      gameMetrics: {
        ...baseUnified.gameMetrics,
        sessionsPlayed: 0,
      },
      performanceMetrics: {
        ...baseUnified.performanceMetrics,
        completionRate: 5,
      },
    });

    // raw = (5*3) + (0*2) + (5*4) = 35
    const mediumResult = await mediumService.getStudentEngagementScore('u1');
    expect(mediumResult.level).toBe('medium');
    expect(mediumResult.engagementScore).toBe(35);

    const { service: highService } = makeService({
      activityMetrics: {
        ...baseUnified.activityMetrics,
        weeklyActivityFrequency: 10,
      },
      gameMetrics: {
        ...baseUnified.gameMetrics,
        sessionsPlayed: 0,
      },
      performanceMetrics: {
        ...baseUnified.performanceMetrics,
        completionRate: 10,
      },
    });

    // raw = (10*3) + (0*2) + (10*4) = 70
    const highResult = await highService.getStudentEngagementScore('u1');
    expect(highResult.level).toBe('high');
    expect(highResult.engagementScore).toBe(70);
  });
});

describe('AnalyticsService retention analytics', () => {
  const makeRetentionService = (params: {
    totalUsers: number;
    currentUsers: string[];
    previousUsers: string[];
    trend: { date: string; users: string[] }[];
  }) => {
    const userModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(params.totalUsers) }),
    };

    const activityModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            currentUsers: params.currentUsers.map((id) => ({ _id: id })),
            previousUsers: params.previousUsers.map((id) => ({ _id: id })),
            trend: params.trend,
          },
        ]),
      }),
    };

    const service = new AnalyticsService(
      {} as any,
      {} as any,
      userModel as any,
      {} as any,
      activityModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, userModel, activityModel };
  };

  it('should calculate retained users, returning users, and dropout rate', async () => {
    const { service } = makeRetentionService({
      totalUsers: 10,
      currentUsers: ['u1', 'u2', 'u3', 'u4'],
      previousUsers: ['u2', 'u3', 'u9'],
      trend: [
        { date: '2026-03-26', users: ['u1', 'u2'] },
        { date: '2026-03-27', users: ['u2', 'u3', 'u4'] },
      ],
    });

    const result = await service.getRetentionAnalytics(7);

    expect(result.totalUsers).toBe(10);
    expect(result.retainedUsers).toBe(4);
    expect(result.returningUsers).toBe(2);
    expect(result.dropoutRate).toBe(60);
    expect(result.trend).toEqual([
      {
        date: '2026-03-26',
        activeUsers: 2,
        returningUsers: 1,
      },
      {
        date: '2026-03-27',
        activeUsers: 3,
        returningUsers: 2,
      },
    ]);
  });

  it('should safely handle empty populations', async () => {
    const { service } = makeRetentionService({
      totalUsers: 0,
      currentUsers: [],
      previousUsers: [],
      trend: [],
    });

    const result = await service.getRetentionAnalytics(30);

    expect(result).toEqual({
      totalUsers: 0,
      retainedUsers: 0,
      returningUsers: 0,
      dropoutRate: 0,
      trend: [],
    });
  });
});

describe('AnalyticsService cohort analytics', () => {
  it('should return aggregated cohort rows from pipeline result', async () => {
    const expectedRows = [
      {
        cohort: 'course:grade-10',
        averageScore: 62.5,
        averageRisk: 41.2,
        engagementScore: 58.4,
      },
      {
        cohort: 'signup:2026-03',
        averageScore: 60,
        averageRisk: 39,
        engagementScore: 55,
      },
    ];

    const userModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(expectedRows),
      }),
    };

    const service = new AnalyticsService(
      {} as any,
      {} as any,
      userModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getCohortAnalytics();

    expect(userModel.aggregate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expectedRows);
  });
});
