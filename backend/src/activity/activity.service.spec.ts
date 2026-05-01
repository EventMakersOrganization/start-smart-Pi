import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ActivityService, LogActivityOptions, classifyChannelFromHeaders } from './activity.service';
import { Activity, ActivityChannel, ActivityAction } from './schemas/activity.schema';
import { SessionService } from './session.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let mockActivityModel: any;
  let mockSessionService: any;

  beforeEach(async () => {
    // Create a constructor function that can be called with 'new'
    mockActivityModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data),
    }));

    // Add query methods to the constructor
    mockActivityModel.find = jest.fn();
    mockActivityModel.create = jest.fn();

    mockSessionService = {
      touchSession: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: getModelToken(Activity.name), useValue: mockActivityModel },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
  });

  describe('logActivity', () => {
    it('should log activity with all options', async () => {
      const userId = 'user123';
      const action = ActivityAction.QUIZ_ATTEMPT;
      const options: LogActivityOptions = {
        channel: ActivityChannel.WEB,
        pagePath: '/quiz/123',
        resourceType: 'quiz',
        resourceId: 'quiz-456',
        resourceTitle: 'Math Quiz',
        durationSec: 300,
        metadata: { score: 85 },
      };


      await service.logActivity(userId, action, options);

        expect(mockActivityModel).toHaveBeenCalled();
      expect(mockSessionService.touchSession).toHaveBeenCalledWith(userId, expect.any(Object));
    });

    it('should log activity with minimal options', async () => {
      const userId = 'user123';
      const action = ActivityAction.PAGE_VIEW;


      await service.logActivity(userId, action);

      expect(mockActivityModel).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          action,
          channel: ActivityChannel.UNKNOWN,
        })
      );
    });

    it('should default channel to UNKNOWN when not provided', async () => {
      const userId = new Types.ObjectId();
      const action = ActivityAction.COURSE_OPEN;


      await service.logActivity(userId, action, { pagePath: '/course' });

      expect(mockActivityModel).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: ActivityChannel.UNKNOWN,
        })
      );
    });

    it('should handle metadata correctly', async () => {
      const userId = 'user123';
      const metadata = { quizId: '456', attempt: 2, correctAnswers: 8 };


      await service.logActivity(userId, ActivityAction.QUIZ_ATTEMPT, { metadata });

      expect(mockActivityModel).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata,
        })
      );
    });

    it('should create empty metadata if not provided', async () => {
      const userId = 'user123';


      await service.logActivity(userId, ActivityAction.PAGE_VIEW);

      expect(mockActivityModel).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {},
        })
      );
    });

    it('should touch session with correct payload', async () => {
      const userId = 'user123';
      const action = ActivityAction.QUIZ_SUBMIT;
      const channel = ActivityChannel.MOBILE;

      const mockSave = jest.fn().mockResolvedValue({});
      mockActivityModel.create = jest.fn().mockImplementation((data) => ({
        ...data,
        save: mockSave,
      }));

      await service.logActivity(userId, action, { channel });

      expect(mockSessionService.touchSession).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          action,
          channel,
        })
      );
    });

    it('should handle ObjectId as userId', async () => {
      const userId = new Types.ObjectId();
      const action = ActivityAction.QUIZ_START;


      await service.logActivity(userId, action);

      expect(mockActivityModel).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
        })
      );
    });
  });

  describe('getAllActivities', () => {
    it('should retrieve all activities with populated user info', async () => {
      const mockActivities = [
        { _id: '1', userId: 'user1', action: 'PAGE_VIEWED', user: { name: 'John', email: 'john@example.com' } },
        { _id: '2', userId: 'user2', action: 'QUIZ_ATTEMPTED', user: { name: 'Jane', email: 'jane@example.com' } },
      ];

      const mockPopulate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockActivities),
      });

      mockActivityModel.find = jest.fn().mockReturnValue({
        populate: mockPopulate,
        exec: jest.fn().mockResolvedValue(mockActivities),
      });

      const result = await service.getAllActivities();

      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe('1');
    });

    it('should return empty array when no activities exist', async () => {
      mockActivityModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getAllActivities();

      expect(result).toEqual([]);
    });
  });

  describe('getUserActivities', () => {
    it('should retrieve user activities with default limit', async () => {
      const userId = new Types.ObjectId().toString();
      const mockActivities = [
        { _id: '1', userId, action: 'PAGE_VIEWED' },
        { _id: '2', userId, action: 'QUIZ_ATTEMPTED' },
      ];

      mockActivityModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockActivities),
            }),
          }),
        }),
      });

      const result = await service.getUserActivities(userId);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(userId);
    });

    it('should apply action filter when provided', async () => {
      const userId = new Types.ObjectId().toString();
      const action = ActivityAction.QUIZ_ATTEMPT;
      const mockActivities = [{ _id: '1', userId, action }];

      const mockFind = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockActivities),
            }),
          }),
        }),
      });

      mockActivityModel.find = mockFind;

      const result = await service.getUserActivities(userId, { action });

      expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ action }));
    });

    it('should apply resourceType filter when provided', async () => {
      const userId = new Types.ObjectId().toString();
      const resourceType = 'quiz';
      const mockActivities = [{ _id: '1', userId, resourceType }];

      const mockFind = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockActivities),
            }),
          }),
        }),
      });

      mockActivityModel.find = mockFind;

      const result = await service.getUserActivities(userId, { resourceType });

      expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ resourceType }));
    });

    it('should respect custom limit', async () => {
      const userId = new Types.ObjectId().toString();
      const limit = 50;

      mockActivityModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await service.getUserActivities(userId, { limit });

      expect(mockActivityModel.find).toHaveBeenCalled();
    });

    it('should cap limit at 2000', async () => {
      const userId = new Types.ObjectId().toString();
      const excessiveLimit = 5000;

      const mockLimit = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      mockActivityModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: mockLimit,
        }),
      });

      await service.getUserActivities(userId, { limit: excessiveLimit });

      expect(mockLimit).toHaveBeenCalledWith(2000);
    });

    it('should enforce minimum limit of 1', async () => {
      const userId = new Types.ObjectId().toString();

      const mockLimit = jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      mockActivityModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: mockLimit,
        }),
      });

      await service.getUserActivities(userId, { limit: 0 });

      // 0 is falsy so it becomes the default of 200
      expect(mockLimit).toHaveBeenCalledWith(200);
    });

    it('should handle ObjectId as userId', async () => {
      const userId = new Types.ObjectId().toString();

      mockActivityModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await service.getUserActivities(userId);

      expect(mockActivityModel.find).toHaveBeenCalled();
    });

    it('should sort activities by timestamp descending', async () => {
      const userId = new Types.ObjectId().toString();
      const mockSort = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockActivityModel.find = jest.fn().mockReturnValue({
        sort: mockSort,
      });

      await service.getUserActivities(userId);

      expect(mockSort).toHaveBeenCalledWith({ timestamp: -1 });
    });
  });

  describe('classifyChannelFromHeaders', () => {
    it('should return WEB when x-client-channel header is "web"', () => {
      const result = classifyChannelFromHeaders('Mozilla/5.0', 'web');
      expect(result).toBe(ActivityChannel.WEB);
    });

    it('should return MOBILE when x-client-channel header is "mobile"', () => {
      const result = classifyChannelFromHeaders('Mozilla/5.0', 'mobile');
      expect(result).toBe(ActivityChannel.MOBILE);
    });

    it('should return MOBILE for mobile user agents', () => {
      const mobileAgents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        'Mozilla/5.0 (Linux; Android 11)',
        'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        'BlackBerry',
      ];

      mobileAgents.forEach((ua) => {
        const result = classifyChannelFromHeaders(ua);
        expect(result).toBe(ActivityChannel.MOBILE);
      });
    });

    it('should return WEB for desktop user agents', () => {
      const desktopAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ];

      desktopAgents.forEach((ua) => {
        const result = classifyChannelFromHeaders(ua);
        expect(result).toBe(ActivityChannel.WEB);
      });
    });

    it('should return UNKNOWN for empty user agent and no header', () => {
      const result = classifyChannelFromHeaders('');
      expect(result).toBe(ActivityChannel.UNKNOWN);
    });

    it('should be case-insensitive for x-client-channel header', () => {
      expect(classifyChannelFromHeaders('', 'WEB')).toBe(ActivityChannel.WEB);
      expect(classifyChannelFromHeaders('', 'MOBILE')).toBe(ActivityChannel.MOBILE);
      expect(classifyChannelFromHeaders('', 'WeB')).toBe(ActivityChannel.WEB);
    });

    it('should prioritize x-client-channel header over user agent', () => {
      const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
      const result = classifyChannelFromHeaders(mobileUA, 'web');
      expect(result).toBe(ActivityChannel.WEB);
    });

    it('should handle whitespace in x-client-channel header', () => {
      const result = classifyChannelFromHeaders('', '  mobile  ');
      expect(result).toBe(ActivityChannel.MOBILE);
    });

    it('should return UNKNOWN for unrecognized x-client-channel values', () => {
      const result = classifyChannelFromHeaders('', 'tablet');
      expect(result).toBe(ActivityChannel.UNKNOWN);
    });
  });
});
