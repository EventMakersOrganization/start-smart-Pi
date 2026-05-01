import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('ChatService (unit, member5)', () => {
  let svc: ChatService;
  const mockModel = () => ({
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    save: jest.fn(),
  });

  beforeEach(() => {
    // Provide minimal mock models required by tested methods
    svc = new ChatService(
      mockModel() as any,
      mockModel() as any,
      mockModel() as any,
      mockModel() as any,
      mockModel() as any,
      mockModel() as any,
      mockModel() as any,
      mockModel() as any,
      mockModel() as any,
    );
  });

  test('resolveParticipants populates known users and unknown fallback', async () => {
    const session: any = { participants: ['u1', 'u2'] };
    const userModel: any = (svc as any).userModel;
    userModel.findById.mockImplementation((id: string) => ({ select: () => ({ lean: async () => (id === 'u1' ? { _id: 'u1', first_name: 'A' } : null) }) }));

    const out = await svc.resolveParticipants(session);
    expect(Array.isArray(out.participants)).toBe(true);
    expect(out.participants[0].first_name).toBe('A');
    expect(out.participants[1].first_name).toBe('Unknown');
  });

  test('createInstructorSession throws for invalid instructor', async () => {
    const userModel: any = (svc as any).userModel;
    userModel.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
    await expect(svc.createInstructorSession('s1', 'i1')).rejects.toThrow(BadRequestException);
  });

  test('createRoomForStudent rejects empty name and insufficient participants', async () => {
    await expect(svc.createRoomForStudent('s1', '   ', [])).rejects.toThrow(BadRequestException);
    await expect(svc.createRoomForStudent('s1', 'Group', ['s1'])).rejects.toThrow(BadRequestException);
  });

  test('isParticipant returns false on errors', async () => {
    const chatAiModel: any = (svc as any).chatAiModel;
    chatAiModel.findById.mockImplementation(() => { throw new Error('boom'); });
    const res = await svc.isParticipant('ChatAi', 'x', 'u');
    expect(res).toBe(false);
  });
});
