import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { KpiService } from './kpi.service';
import { User } from '../../users/schemas/user.schema';
import { RiskScore } from '../schemas/riskscore.schema';
import { Alert } from '../schemas/alert.schema';
import { AnalyticsReadCacheService } from './analytics-read-cache.service';
import { SessionService } from '../../activity/session.service';

describe('KpiService', () => {
  let service: KpiService;
  let userModel: any;
  let riskScoreModel: any;
  let alertModel: any;
  let sessionService: any;

  const readCache = {
    getOrSet: jest.fn(async (_k: string, fn: () => Promise<any>) => fn()),
  };

  beforeEach(async () => {
    userModel = {
      countDocuments: jest.fn(),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };
    riskScoreModel = {
      countDocuments: jest.fn(),
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    };
    alertModel = {
      countDocuments: jest.fn(),
    };
    sessionService = {
      countOnlineUsers: jest.fn().mockResolvedValue(5),
      countUsersSeenInWindow: jest.fn().mockResolvedValue(10),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KpiService,
        { provide: AnalyticsReadCacheService, useValue: readCache },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(RiskScore.name), useValue: riskScoreModel },
        { provide: getModelToken(Alert.name), useValue: alertModel },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    service = module.get(KpiService);
  });

  describe('getDashboardDeltas', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-07T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should compute percent deltas from windowed counts', async () => {
      // Active users (24h)
      sessionService.countUsersSeenInWindow
        .mockResolvedValueOnce(2) // current
        .mockResolvedValueOnce(1); // previous

      // New users (7d)
      userModel.countDocuments
        .mockResolvedValueOnce(10) // current
        .mockResolvedValueOnce(5); // previous

      // Total alerts (7d)
      alertModel.countDocuments
        .mockResolvedValueOnce(8) // current
        .mockResolvedValueOnce(4); // previous

      // High risk users (7d)
      riskScoreModel.countDocuments
        .mockResolvedValueOnce(3) // current
        .mockResolvedValueOnce(1); // previous

      const d = await service.getDashboardDeltas();

      expect(d.activeUsersDeltaPct).toBe(100);
      expect(d.totalUsersDeltaPct).toBe(100);
      expect(d.totalAlertsDeltaPct).toBe(100);
      expect(d.highRiskUsersDeltaPct).toBe(200);
    });

    it('should return null when both windows are zero for each metric', async () => {
      sessionService.countUsersSeenInWindow.mockResolvedValue(0);
      userModel.countDocuments.mockResolvedValue(0);
      alertModel.countDocuments.mockResolvedValue(0);
      riskScoreModel.countDocuments.mockResolvedValue(0);

      const d = await service.getDashboardDeltas();

      expect(d.activeUsersDeltaPct).toBeNull();
      expect(d.totalUsersDeltaPct).toBeNull();
      expect(d.totalAlertsDeltaPct).toBeNull();
      expect(d.highRiskUsersDeltaPct).toBeNull();
    });

    it('should return 100 when previous window is zero and current window is positive', async () => {
      sessionService.countUsersSeenInWindow
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0);

      userModel.countDocuments
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(0);

      alertModel.countDocuments
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(0);

      riskScoreModel.countDocuments
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);

      const d = await service.getDashboardDeltas();

      expect(d.activeUsersDeltaPct).toBe(100);
      expect(d.totalUsersDeltaPct).toBe(100);
      expect(d.totalAlertsDeltaPct).toBe(100);
      expect(d.highRiskUsersDeltaPct).toBe(100);
    });
  });

  describe('getAverageRiskScorePercent', () => {
    it('should return rounded average from aggregation', async () => {
      // Mock active students
      userModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'u1' }]),
      });

      // Mock risk score aggregation
      riskScoreModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ userId: 'u1', score: 42.7 }]),
      });

      const v = await service.getAverageRiskScorePercent();
      expect(v).toBe(43);
    });

    it('should return 0 when no scores', async () => {
      userModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const v = await service.getAverageRiskScorePercent();
      expect(v).toBe(0);
    });
  });
});
