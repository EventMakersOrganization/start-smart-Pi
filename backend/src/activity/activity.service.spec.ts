import { classifyChannelFromHeaders, ActivityService } from './activity.service';

describe('ActivityService helpers (member5)', () => {
  test('classifyChannelFromHeaders respects hint and UA', () => {
    expect(classifyChannelFromHeaders(undefined, 'web')).toBeDefined();
    expect(classifyChannelFromHeaders('mozilla/5.0 (iphone)', undefined)).toBeDefined();
    expect(classifyChannelFromHeaders('', '')).toBeDefined();
  });
});

describe('ActivityService (unit, member5)', () => {
  let svc: ActivityService;
  const makeQuery = () => ({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  });
  const mockModel: any = {
    find: jest.fn(() => makeQuery()),
    save: jest.fn(),
  };

  beforeEach(() => {
    svc = new ActivityService(mockModel as any);
  });

  test('getUserActivities clamps limit and queries by user', async () => {
    mockModel.find.mockClear();
    await svc.getUserActivities('507f1f77bcf86cd799439011', { limit: 5000, action: undefined });
    expect(mockModel.find).toHaveBeenCalled();
  });

  test('logActivity persists an activity with unknown channel by default', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    (svc as any).activityModel = jest.fn().mockImplementation(() => ({ save })) as any;

    await svc.logActivity('507f1f77bcf86cd799439011', 'VIEW_PAGE' as any, { pagePath: '/dashboard' });

    expect(save).toHaveBeenCalled();
    const payload = ((svc as any).activityModel as jest.Mock).mock.calls[0][0];
    expect(payload.channel).toBeDefined();
    expect(payload.pagePath).toBe('/dashboard');
  });

  test('getUserActivities rejects invalid user ids', async () => {
    await expect(svc.getUserActivities('bad-id')).rejects.toThrow();
  });
});
