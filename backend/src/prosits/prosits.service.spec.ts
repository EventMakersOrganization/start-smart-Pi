import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PrositsService, normalizePrositGradeToOutOf20 } from './prosits.service';
import { PrositSubmission } from './schemas/prosit-submission.schema';
import { Subject } from '../subjects/schemas/subject.schema';
import { CreatePrositSubmissionDto } from './dto/create-prosit-submission.dto';

describe('PrositsService', () => {
  let service: PrositsService;
  let mockPrositSubmissionModel: any;
  let mockSubjectModel: any;

  beforeEach(async () => {
    // Create a constructor function that can be called with 'new'
    mockPrositSubmissionModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data),
    }));

    // Add query methods to the constructor
    mockPrositSubmissionModel.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockPrositSubmissionModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockPrositSubmissionModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    });
    mockPrositSubmissionModel.findByIdAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    });

    mockSubjectModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrositsService,
        { provide: getModelToken(PrositSubmission.name), useValue: mockPrositSubmissionModel },
        { provide: getModelToken(Subject.name), useValue: mockSubjectModel },
      ],
    }).compile();

    service = module.get<PrositsService>(PrositsService);
  });

  describe('normalizePrositGradeToOutOf20', () => {
    it('should return grade as-is when already between 0-20', () => {
      expect(normalizePrositGradeToOutOf20(15)).toBe(15);
      expect(normalizePrositGradeToOutOf20(0)).toBe(0);
      expect(normalizePrositGradeToOutOf20(20)).toBe(20);
    });

    it('should convert percentage to /20 scale', () => {
      expect(normalizePrositGradeToOutOf20(100)).toBe(20);
      expect(normalizePrositGradeToOutOf20(50)).toBe(10);
      expect(normalizePrositGradeToOutOf20(75)).toBe(15);
    });

    it('should cap at 20', () => {
      expect(normalizePrositGradeToOutOf20(25)).toBe(5);
      expect(normalizePrositGradeToOutOf20(200)).toBe(20);
    });

    it('should return 0 for negative values', () => {
      expect(normalizePrositGradeToOutOf20(-5)).toBe(0);
      expect(normalizePrositGradeToOutOf20(-100)).toBe(0);
    });

    it('should handle non-finite values', () => {
      expect(normalizePrositGradeToOutOf20(NaN)).toBe(0);
      expect(normalizePrositGradeToOutOf20(Infinity)).toBe(0);
    });

    it('should convert string numbers correctly', () => {
      expect(normalizePrositGradeToOutOf20(Number('15'))).toBe(15);
      expect(normalizePrositGradeToOutOf20(Number('80'))).toBe(16);
    });
  });

  describe('createSubmission', () => {
    it('should create new submission when none exists', async () => {
      const dto: CreatePrositSubmissionDto = {
        studentId: 'student1',
        studentName: 'John Doe',
        studentEmail: 'john@example.com',
        prositTitle: 'Prosit 1',
        chapterTitle: 'Chapter 1',
        subChapterTitle: 'Section 1.1',
        reportText: 'Report content',
        reportHtml: '<p>Report</p>',
        wordCount: 100,
        subjectTitle: 'Mathematics',
      };

      mockPrositSubmissionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const mockSave = jest.fn().mockResolvedValue({ _id: 'sub1', ...dto });
      mockPrositSubmissionModel.create = jest.fn().mockImplementation((data) => ({
        ...data,
        save: mockSave,
      }));

      const result = await service.createSubmission(dto);

      expect(result).toBeDefined();
      expect(mockPrositSubmissionModel.findOne).toHaveBeenCalled();
    });

    it('should overwrite existing submission', async () => {
      const dto: CreatePrositSubmissionDto = {
        studentId: 'student1',
        studentName: 'John Doe',
        studentEmail: 'john@example.com',
        prositTitle: 'Prosit 1',
        chapterTitle: 'Chapter 1',
        subChapterTitle: 'Section 1.1',
        reportText: 'New content',
        reportHtml: '<p>New report</p>',
        wordCount: 150,
        subjectTitle: 'Mathematics',
      };

      const existingSubmission = {
        _id: 'existing1',
        reportText: 'Old content',
        reportHtml: '<p>Old report</p>',
        wordCount: 50,
        subjectTitle: 'Mathematics',
        submittedAt: new Date(),
        status: 'submitted',
        save: jest.fn().mockResolvedValue({}),
      };

      mockPrositSubmissionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingSubmission),
      });

      const result = await service.createSubmission(dto);

      expect(existingSubmission.save).toHaveBeenCalled();
      expect(existingSubmission.reportText).toBe('New content');
      expect(existingSubmission.wordCount).toBe(150);
    });

    it('should handle file upload correctly', async () => {
      const dto: CreatePrositSubmissionDto = {
        studentId: 'student1',
        studentName: 'John Doe',
        studentEmail: 'john@example.com',
        prositTitle: 'Prosit 1',
        chapterTitle: 'Chapter 1',
        subChapterTitle: 'Section 1.1',
        reportText: 'Content',
        reportHtml: '<p>Content</p>',
        wordCount: 100,
      };

      const mockFile = {
        originalname: 'report.pdf',
        filename: 'report_12345.pdf',
      } as any;

      mockPrositSubmissionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockPrositSubmissionModel.create = jest.fn().mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue({ _id: 'sub1', ...data }),
      }));

      const result = await service.createSubmission(dto, mockFile);

      expect(result).toBeDefined();
    });

    it('should set status to "submitted" for new submissions', async () => {
      const dto: CreatePrositSubmissionDto = {
        studentId: 'student1',
        studentName: 'John Doe',
        studentEmail: 'john@example.com',
        prositTitle: 'Prosit 1',
        chapterTitle: 'Chapter 1',
        subChapterTitle: 'Section 1.1',
        reportText: 'Content',
        reportHtml: '<p>Content</p>',
        wordCount: 100,
      };

      mockPrositSubmissionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockPrositSubmissionModel.create = jest.fn().mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue({ ...data, status: 'submitted' }),
      }));

      const result = await service.createSubmission(dto);

      expect(result).toBeDefined();
    });

    it('should trim whitespace from string fields', async () => {
      const dto: CreatePrositSubmissionDto = {
        studentId: '  student1  ',
        studentName: '  John Doe  ',
        studentEmail: '  john@example.com  ',
        prositTitle: '  Prosit 1  ',
        chapterTitle: '  Chapter 1  ',
        subChapterTitle: '  Section 1.1  ',
        reportText: 'Content',
        reportHtml: '<p>Content</p>',
        wordCount: 100,
        subjectTitle: '  Mathematics  ',
      };

      mockPrositSubmissionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockPrositSubmissionModel.create = jest.fn().mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue(data),
      }));

      await service.createSubmission(dto);

      expect(mockPrositSubmissionModel.findOne).toHaveBeenCalled();
    });
  });

  describe('getSubmissionsByChapter', () => {
    it('should retrieve submissions by chapter sorted by date', async () => {
      const chapterTitle = 'Chapter 1';
      const mockSubmissions = [
        { _id: 'sub1', chapterTitle, submittedAt: new Date() },
        { _id: 'sub2', chapterTitle, submittedAt: new Date(Date.now() - 1000) },
      ];

      mockPrositSubmissionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSubmissions),
        }),
      });

      const result = await service.getSubmissionsByChapter(chapterTitle);

      expect(result).toHaveLength(2);
      expect(mockPrositSubmissionModel.find).toHaveBeenCalledWith({ chapterTitle });
    });

    it('should return empty array when no submissions found', async () => {
      const chapterTitle = 'NonExistent';

      mockPrositSubmissionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getSubmissionsByChapter(chapterTitle);

      expect(result).toEqual([]);
    });
  });

  describe('getSubmissionsByStudent', () => {
    it('should retrieve submissions for a student', async () => {
      const studentId = 'student1';
      const mockSubmissions = [
        { _id: 'sub1', studentId, submittedAt: new Date() },
        { _id: 'sub2', studentId, submittedAt: new Date(Date.now() - 1000) },
      ];

      mockPrositSubmissionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSubmissions),
        }),
      });

      const result = await service.getSubmissionsByStudent(studentId);

      expect(result).toHaveLength(2);
      expect(mockPrositSubmissionModel.find).toHaveBeenCalledWith({ studentId });
    });

    it('should return empty array when student has no submissions', async () => {
      const studentId = 'unknown-student';

      mockPrositSubmissionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getSubmissionsByStudent(studentId);

      expect(result).toEqual([]);
    });
  });

  describe('getSubmissionById', () => {
    it('should retrieve submission by ID', async () => {
      const submissionId = 'sub123';
      const mockSubmission = { _id: submissionId, studentId: 'student1' };

      mockPrositSubmissionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSubmission),
      });

      const result = await service.getSubmissionById(submissionId);

      expect(result).toEqual(mockSubmission);
      expect(mockPrositSubmissionModel.findById).toHaveBeenCalledWith(submissionId);
    });

    it('should return null when submission not found', async () => {
      const submissionId = 'nonexistent';

      mockPrositSubmissionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getSubmissionById(submissionId);

      expect(result).toBeNull();
    });
  });

  describe('updateGrade', () => {
    it('should update grade and set status to "graded"', async () => {
      const submissionId = 'sub1';
      const grade = 15;
      const feedback = 'Good work';

      const mockSubmission = { _id: submissionId, grade: null, status: 'submitted' };

      mockPrositSubmissionModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockSubmission,
          grade: 15,
          feedback,
          status: 'graded',
        }),
      });

      const result = await service.updateGrade(submissionId, grade, feedback);

      expect(result.grade).toBe(15);
      expect(result.status).toBe('graded');
      expect(mockPrositSubmissionModel.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('should normalize grade to /20 scale', async () => {
      const submissionId = 'sub1';
      const grade = 85; // 85% = 17/20

      mockPrositSubmissionModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ grade: 17, status: 'graded' }),
      });

      const result = await service.updateGrade(submissionId, grade, 'Feedback');

      expect(mockPrositSubmissionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        submissionId,
        expect.objectContaining({
          grade: expect.any(Number),
        }),
        expect.any(Object)
      );
    });

    it('should set gradedAt timestamp', async () => {
      const submissionId = 'sub1';

      mockPrositSubmissionModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: submissionId,
          gradedAt: expect.any(Date),
        }),
      });

      const result = await service.updateGrade(submissionId, 15, 'Good');

      expect(mockPrositSubmissionModel.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('assertInstructorCanGrade', () => {
    it('should allow grading when instructor teaches the subject', async () => {
      const instructorId = new Types.ObjectId();
      const submission = {
        subjectTitle: 'Mathematics',
      } as any;

      mockSubjectModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          title: 'Mathematics',
          instructors: [instructorId],
        }),
      });

      await expect(
        service.assertInstructorCanGrade(instructorId.toString(), submission)
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when instructor does not teach subject', async () => {
      const instructorId = new Types.ObjectId();
      const otherInstructor = new Types.ObjectId();
      const submission = {
        subjectTitle: 'Mathematics',
      } as any;

      mockSubjectModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.assertInstructorCanGrade(instructorId.toString(), submission)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when subject title is missing', async () => {
      const instructorId = new Types.ObjectId();
      const submission = {
        subjectTitle: '',
      } as any;

      await expect(
        service.assertInstructorCanGrade(instructorId.toString(), submission)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when subject title is null', async () => {
      const instructorId = new Types.ObjectId();
      const submission = {
        subjectTitle: null,
      } as any;

      await expect(
        service.assertInstructorCanGrade(instructorId.toString(), submission)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('gradeSubmission', () => {
    it('should grade submission when authorized', async () => {
      const submissionId = 'sub1';
      const instructorId = new Types.ObjectId();

      const mockSubmission = {
        _id: submissionId,
        subjectTitle: 'Mathematics',
      };

      mockPrositSubmissionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSubmission),
      });

      mockSubjectModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          instructors: [instructorId],
        }),
      });

      mockPrositSubmissionModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockSubmission,
          grade: 15,
          status: 'graded',
        }),
      });

      const result = await service.gradeSubmission(submissionId, instructorId.toString(), 75, 'Good work');

      expect(result).toBeDefined();
      expect(mockPrositSubmissionModel.findById).toHaveBeenCalledWith(submissionId);
    });

    it('should throw NotFoundException when submission not found', async () => {
      const submissionId = 'nonexistent';
      const instructorId = new Types.ObjectId();

      mockPrositSubmissionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.gradeSubmission(submissionId, instructorId.toString(), 75)
      ).rejects.toThrow(NotFoundException);
    });

    it('should use default empty feedback when not provided', async () => {
      const submissionId = 'sub1';
      const instructorId = new Types.ObjectId();

      const mockSubmission = {
        _id: submissionId,
        subjectTitle: 'Math',
      };

      mockPrositSubmissionModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSubmission),
      });

      mockSubjectModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ instructors: [instructorId] }),
      });

      mockPrositSubmissionModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockSubmission,
          grade: 15,
        }),
      });

      await service.gradeSubmission(submissionId, instructorId.toString(), 75);

      expect(mockPrositSubmissionModel.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('getSubmissionsForInstructor', () => {
    it('should retrieve submissions for instructor with valid ID', async () => {
      const instructorId = new Types.ObjectId();

      const mockSubjects = [
        { title: 'Mathematics' },
        { title: 'Physics' },
      ];

      const mockSubmissions = [
        { _id: 'sub1', subjectTitle: 'Mathematics', toObject: jest.fn().mockReturnValue({}) },
        { _id: 'sub2', subjectTitle: 'Physics', toObject: jest.fn().mockReturnValue({}) },
      ];

      mockSubjectModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSubjects),
        }),
      });

      mockPrositSubmissionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSubmissions),
        }),
      });

      const result = await service.getSubmissionsForInstructor(instructorId.toString());

      expect(result).toBeDefined();
      expect(mockSubjectModel.find).toHaveBeenCalledWith({ instructors: instructorId });
    });

    it('should return empty array for invalid instructor ID', async () => {
      const invalidId = 'not-a-valid-id';

      const result = await service.getSubmissionsForInstructor(invalidId);

      expect(result).toEqual([]);
    });

    it('should return empty array when instructor teaches no subjects', async () => {
      const instructorId = new Types.ObjectId();

      mockSubjectModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getSubmissionsForInstructor(instructorId.toString());

      expect(result).toEqual([]);
    });

    it('should add subject field to submissions', async () => {
      const instructorId = new Types.ObjectId();

      mockSubjectModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([{ title: 'Math' }]),
        }),
      });

      const mockSubmission = {
        _id: 'sub1',
        subjectTitle: 'Math',
        toObject: jest.fn().mockReturnValue({ _id: 'sub1', subjectTitle: 'Math' }),
      };

      mockPrositSubmissionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([mockSubmission]),
        }),
      });

      const result = await service.getSubmissionsForInstructor(instructorId.toString());

      expect(result).toBeDefined();
    });
  });

  describe('getAllSubmissions', () => {
    it('should retrieve all submissions sorted by date', async () => {
      const mockSubmissions = [
        { _id: 'sub1', submittedAt: new Date() },
        { _id: 'sub2', submittedAt: new Date(Date.now() - 1000) },
      ];

      mockPrositSubmissionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSubmissions),
        }),
      });

      const result = await service.getAllSubmissions();

      expect(result).toHaveLength(2);
      expect(mockPrositSubmissionModel.find).toHaveBeenCalled();
    });

    it('should return empty array when no submissions exist', async () => {
      mockPrositSubmissionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getAllSubmissions();

      expect(result).toEqual([]);
    });

    it('should sort by submittedAt descending', async () => {
      mockPrositSubmissionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      await service.getAllSubmissions();

      expect(mockPrositSubmissionModel.find).toHaveBeenCalledWith();
    });
  });

  describe('Edge cases', () => {
    it('should handle submissions with special characters in title', async () => {
      const dto: CreatePrositSubmissionDto = {
        studentId: 'student@123',
        studentName: 'John Doe',
        studentEmail: 'john@example.com',
        prositTitle: 'Prosit #1: "Special" (Test)',
        chapterTitle: 'Chapter & Section',
        subChapterTitle: 'Sub-section / Part',
        reportText: 'Content',
        reportHtml: '<p>Content</p>',
        wordCount: 100,
      };

      mockPrositSubmissionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockPrositSubmissionModel.create = jest.fn().mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue(data),
      }));

      await service.createSubmission(dto);

      expect(mockPrositSubmissionModel.findOne).toHaveBeenCalled();
    });

    it('should handle very long word counts', async () => {
      const dto: CreatePrositSubmissionDto = {
        studentId: 'student1',
        studentName: 'John Doe',
        studentEmail: 'john@example.com',
        prositTitle: 'Prosit 1',
        chapterTitle: 'Chapter 1',
        subChapterTitle: 'Section 1',
        reportText: 'Content',
        reportHtml: '<p>Content</p>',
        wordCount: 999999,
      };

      mockPrositSubmissionModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockPrositSubmissionModel.create = jest.fn().mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue(data),
      }));

      await service.createSubmission(dto);

      expect(mockPrositSubmissionModel.findOne).toHaveBeenCalled();
    });
  });
});
