import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ChatService } from './chat.service';
import { ChatAi } from './schemas/chat-ai.schema';
import { ChatInstructor } from './schemas/chat-instructor.schema';
import { ChatRoom } from './schemas/chat-room.schema';
import { ChatMessage } from './schemas/chat-message.schema';
import { User } from '../users/schemas/user.schema';
import { StudentProfile } from '../users/schemas/student-profile.schema';
import { SchoolClass } from '../academic/schemas/school-class.schema';
import { ClassSubject } from '../academic/schemas/class-subject.schema';
import { Subject } from '../subjects/schemas/subject.schema';

describe('ChatService', () => {
  let service: ChatService;
  let mockChatAiModel: any;
  let mockChatInstructorModel: any;
  let mockChatRoomModel: any;
  let mockChatMessageModel: any;
  let mockUserModel: any;
  let mockStudentProfileModel: any;
  let mockSchoolClassModel: any;
  let mockClassSubjectModel: any;
  let mockSubjectModel: any;

  beforeEach(async () => {
    // Mock Mongoose model constructors and methods
    mockChatAiModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ _id: 'session1', ...data }),
    }));
    mockChatAiModel.create = jest.fn();
    mockChatAiModel.findOne = jest.fn();
    mockChatAiModel.findById = jest.fn();

    mockChatInstructorModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ _id: 'session1', ...data }),
      toObject: jest.fn().mockReturnValue({}),
    }));
    mockChatInstructorModel.create = jest.fn();
    mockChatInstructorModel.findOne = jest.fn();
    mockChatInstructorModel.findById = jest.fn();

    mockChatRoomModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ _id: 'room1', ...data }),
      participants: data.participants || [],
    }));
    mockChatRoomModel.create = jest.fn();
    mockChatRoomModel.findOne = jest.fn();
    mockChatRoomModel.findById = jest.fn();

    mockChatMessageModel = {
      create: jest.fn(),
    };
    mockUserModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      }),
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      }),
      find: jest.fn(),
    };
    mockStudentProfileModel = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    mockSchoolClassModel = {
      find: jest.fn(),
    };
    mockClassSubjectModel = {
      find: jest.fn(),
    };
    mockSubjectModel = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getModelToken(ChatAi.name), useValue: mockChatAiModel },
        { provide: getModelToken(ChatInstructor.name), useValue: mockChatInstructorModel },
        { provide: getModelToken(ChatRoom.name), useValue: mockChatRoomModel },
        { provide: getModelToken(ChatMessage.name), useValue: mockChatMessageModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(StudentProfile.name), useValue: mockStudentProfileModel },
        { provide: getModelToken(SchoolClass.name), useValue: mockSchoolClassModel },
        { provide: getModelToken(ClassSubject.name), useValue: mockClassSubjectModel },
        { provide: getModelToken(Subject.name), useValue: mockSubjectModel },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('createAiSession', () => {
    it('should create an AI session with default title when title is not provided', async () => {
      const studentId = 'student123';

      const result = await service.createAiSession(studentId);

      expect(mockChatAiModel).toHaveBeenCalledWith({
        student: studentId,
        title: 'New AI Session',
      });
      expect(result).toBeDefined();
    });

    it('should create an AI session with provided title', async () => {
      const studentId = 'student123';
      const title = 'Math Discussion';

      const result = await service.createAiSession(studentId, title);

      expect(mockChatAiModel).toHaveBeenCalledWith({
        student: studentId,
        title: title,
      });
      expect(result).toBeDefined();
    });

    it('should handle empty title by using default', async () => {
      const studentId = 'student123';

      const result = await service.createAiSession(studentId, '');

      expect(mockChatAiModel).toHaveBeenCalledWith({
        student: studentId,
        title: 'New AI Session',
      });
      expect(result).toBeDefined();
    });
  });

  describe('resolveParticipants', () => {
    it('should resolve participants with user details', async () => {
      const userId1 = new Types.ObjectId().toString();
      const userId2 = new Types.ObjectId().toString();
      const session = {
        _id: 'room1',
        participants: [userId1, userId2],
      };

      const mockUsers = [
        {
          _id: userId1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          role: 'student',
        },
        {
          _id: userId2,
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          role: 'teacher',
        },
      ];

      mockUserModel.findById = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockUsers[0]),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockUsers[1]),
          }),
        });

      const result = await service.resolveParticipants(session);

      expect(result.participants).toHaveLength(2);
      expect(result.participants[0].first_name).toBe('John');
      expect(result.participants[1].first_name).toBe('Jane');
    });

    it('should return fallback user info when user not found', async () => {
      const session = {
        participants: [new Types.ObjectId().toString()],
      };

      mockUserModel.findById = jest.fn().mockResolvedValue(null);

      const result = await service.resolveParticipants(session);

      expect(result.participants[0].first_name).toBe('Unknown');
      expect(result.participants[0].last_name).toBe('User');
    });

    it('should return session unchanged when no participants', async () => {
      const session = {
        _id: 'room1',
        name: 'Study Group',
      };

      const result = await service.resolveParticipants(session);

      expect(result).toEqual(session);
    });
  });

  describe('createInstructorSession', () => {
    it('should create instructor session for valid instructor and student', async () => {
      const studentId = 'student123';
      const instructorId = 'instructor1';

      mockUserModel.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: instructorId }),
        }),
      });
      mockChatInstructorModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      mockUserModel.findById = jest.fn().mockResolvedValue({
        _id: instructorId,
        first_name: 'Prof',
      });

      const result = await service.createInstructorSession(studentId, instructorId);

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for invalid instructor', async () => {
      const studentId = 'student123';
      const instructorId = 'invalid';

      mockUserModel.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.createInstructorSession(studentId, instructorId)).rejects.toThrow(BadRequestException);
    });

    it('should reuse existing session if already exists', async () => {
      const studentId = 'student123';
      const instructorId = 'instructor1';

      mockUserModel.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: instructorId }),
        }),
      });

      const existingSession = {
        _id: 'existing',
        participants: [studentId, instructorId],
      };

      mockChatInstructorModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(existingSession),
      });

      mockUserModel.findById = jest.fn().mockResolvedValue({ _id: instructorId });

      const result = await service.createInstructorSession(studentId, instructorId);

      expect(result).toBeDefined();
      expect(mockChatInstructorModel.findOne).toHaveBeenCalled();
    });

    it('should check student authorization when requester is student', async () => {
      const studentId = 'student123';
      const instructorId = 'instructor1';

      mockUserModel.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: instructorId }),
        }),
      });
      mockStudentProfileModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createInstructorSession(studentId, instructorId, 'student')
      ).rejects.toThrow();
    });
  });

  describe('getAvailableInstructors', () => {
    it('should return all instructors for non-student role', async () => {
      const mockInstructors = [
        { _id: 'inst1', first_name: 'Prof', last_name: 'Smith', email: 'prof@example.com', role: 'teacher' },
        { _id: 'inst2', first_name: 'Dr', last_name: 'Johnson', email: 'dr@example.com', role: 'instructor' },
      ];

      mockUserModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockInstructors),
        }),
      });

      const result = await service.getAvailableInstructors('admin-id', 'admin');

      expect(result).toHaveLength(2);
      expect(result[0].first_name).toBe('Prof');
      expect(mockUserModel.find).toHaveBeenCalled();
    });

    it('should return empty array for student with no allowed instructors', async () => {
      const studentId = 'student123';

      mockStudentProfileModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getAvailableInstructors(studentId, 'student');

      expect(result).toEqual([]);
    });

    it('should return filtered instructors for student role', async () => {
      const studentId = 'student123';

      mockStudentProfileModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ class: '1A', userId: studentId }),
      });

      mockSchoolClassModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: 'class1' }]),
        }),
      });

      mockClassSubjectModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ subjectId: 'subj1' }]),
        }),
      });

      mockSubjectModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ instructors: ['inst1'] }]),
        }),
      });

      mockUserModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: 'inst1', first_name: 'Prof', last_name: 'Test' },
          ]),
        }),
      });

      const result = await service.getAvailableInstructors(studentId, 'student');

      expect(result).toBeDefined();
    });
  });

  describe('createRoom', () => {
    it('should create a room with name and participants', async () => {
      const name = 'Study Group';
      const participants = ['user1', 'user2'];

      const result = await service.createRoom(name, participants);

      expect(mockChatRoomModel).toHaveBeenCalledWith({ name, participants });
      expect(result).toBeDefined();
    });

    it('should create room with empty participants', async () => {
      const name = 'Empty Room';

      const result = await service.createRoom(name, []);

      expect(mockChatRoomModel).toHaveBeenCalledWith({ name, participants: [] });
      expect(result).toBeDefined();
    });
  });

  describe('createRoomForStudent', () => {
    it('should throw error for empty room name', async () => {
      const studentId = 'student123';
      const participants = ['user2'];

      await expect(
        service.createRoomForStudent(studentId, '', participants)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when less than 2 unique participants', async () => {
      const studentId = 'student123';

      await expect(
        service.createRoomForStudent(studentId, 'Room', [])
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when student class not set', async () => {
      const studentId = 'student123';
      const participants = ['user2'];

      mockStudentProfileModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createRoomForStudent(studentId, 'Room', participants)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should successfully create room for students in same class', async () => {
      const studentId = 'student123';
      const userId2 = 'user2';
      const participants = [userId2];

      mockStudentProfileModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ class: '1A', userId: studentId }),
      });

      mockUserModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn()
            .mockResolvedValueOnce([
              { _id: studentId, role: 'student' },
              { _id: userId2, role: 'student' },
            ])
            .mockResolvedValueOnce([
              { userId: studentId },
              { userId: userId2 },
            ]),
        }),
      });

      mockSchoolClassModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: 'class1' }]),
        }),
      });

      mockStudentProfileModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { userId: studentId },
            { userId: userId2 },
          ]),
        }),
      });

      const result = await service.createRoomForStudent(studentId, 'Study Group', participants);

      expect(result).toBeDefined();
    });

    it('should throw UnauthorizedException for students from different classes', async () => {
      const studentId = 'student123';
      const userId2 = 'user2';
      const participants = [userId2];

      mockStudentProfileModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ class: '1A', userId: studentId }),
      });

      mockUserModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn()
            .mockResolvedValueOnce([
              { _id: studentId, role: 'student' },
              { _id: userId2, role: 'student' },
            ])
            .mockResolvedValueOnce([{ userId: studentId }]),
        }),
      });

      mockSchoolClassModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: 'class1' }]),
        }),
      });

      mockStudentProfileModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ userId: studentId }]),
        }),
      });

      await expect(
        service.createRoomForStudent(studentId, 'Study Group', participants)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('addParticipantsToRoom', () => {
    it('should add participants to room for valid member', async () => {
      const studentId = new Types.ObjectId().toString();
      const roomId = 'room1';
      const userId2 = new Types.ObjectId().toString();
      const newParticipants = [userId2];

      const mockRoom = {
        _id: roomId,
        participants: [studentId],
        save: jest.fn().mockResolvedValue({}),
        toObject: jest.fn().mockReturnValue({ participants: [studentId] }),
      };

      mockChatRoomModel.findById = jest.fn().mockResolvedValue(mockRoom);
      mockStudentProfileModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ class: '1A' }),
      });

      mockUserModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn()
            .mockResolvedValueOnce([{ _id: userId2, role: 'student' }])
            .mockResolvedValueOnce([{ userId: userId2 }]),
        }),
      });

      mockStudentProfileModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ userId: userId2 }]),
        }),
      });

      mockUserModel.findById = jest.fn().mockResolvedValue({});

      const result = await service.addParticipantsToRoom(studentId, roomId, newParticipants);

      expect(result).toBeDefined();
    });

    it('should throw UnauthorizedException if not room member', async () => {
      const studentId = 'student123';
      const roomId = 'room1';
      const otherUserId = new Types.ObjectId().toString();

      const mockRoom = {
        _id: roomId,
        participants: [otherUserId],
      };

      mockChatRoomModel.findById = jest.fn().mockResolvedValue(mockRoom);

      await expect(
        service.addParticipantsToRoom(studentId, roomId, ['user2'])
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return room without changes if no new valid participants', async () => {
      const studentId = new Types.ObjectId().toString();
      const roomId = 'room1';

      const mockRoom = {
        _id: roomId,
        participants: [studentId],
        toObject: jest.fn().mockReturnValue({ participants: [studentId] }),
      };

      mockChatRoomModel.findById = jest.fn().mockResolvedValue(mockRoom);
      mockStudentProfileModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ class: '1A' }),
      });
      mockUserModel.findById = jest.fn().mockResolvedValue({});

      const result = await service.addParticipantsToRoom(studentId, roomId, [studentId]);

      expect(result).toBeDefined();
    });
  });
});
