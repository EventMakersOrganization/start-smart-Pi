import { Test, TestingModule } from '@nestjs/testing';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CourseIndexingService } from './course-indexing.service';

describe('CoursesController', () => {
  let controller: CoursesController;
  let service: any;

  const mockCourse = {
    _id: 'courseId',
    title: 'Test Course',
    level: '1st Year',
  };

  const mockCoursesService = {
    create: jest.fn().mockResolvedValue(mockCourse),
    findAll: jest.fn().mockResolvedValue({ data: [mockCourse], total: 1 }),
    findOne: jest.fn().mockResolvedValue(mockCourse),
    update: jest.fn().mockResolvedValue(mockCourse),
    remove: jest.fn().mockResolvedValue(undefined),
    findAllSubjects: jest.fn().mockResolvedValue([]),
    findSubjectByTitle: jest.fn().mockResolvedValue({}),
  };

  const mockIndexingService = {
    getIndexingStatus: jest.fn().mockResolvedValue({ coverage: 100 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        {
          provide: CoursesService,
          useValue: mockCoursesService,
        },
        {
          provide: CourseIndexingService,
          useValue: mockIndexingService,
        },
      ],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
    service = module.get<CoursesService>(CoursesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('happy path: should call service.create', async () => {
      const dto = { title: 'New' };
      const result = await controller.create(dto as any);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCourse);
    });
  });

  describe('findAll', () => {
    it('happy path: should call service.findAll with params', async () => {
      await controller.findAll(2, 5, 'L1', 'inst1');
      expect(service.findAll).toHaveBeenCalledWith(2, 5, 'L1', 'inst1');
    });

    it('edge case: should use default values', async () => {
        // Pipes handle defaults in real app, but let's test the call
        await controller.findAll(1, 10, undefined, undefined);
        expect(service.findAll).toHaveBeenCalledWith(1, 10, undefined, undefined);
    });
  });

  describe('findOne', () => {
    it('happy path: should return a course', async () => {
      const result = await controller.findOne('id');
      expect(service.findOne).toHaveBeenCalledWith('id');
      expect(result).toEqual(mockCourse);
    });
  });

  describe('update', () => {
    it('happy path: should update a course', async () => {
      const dto = { title: 'Updated' };
      await controller.update('id', dto as any);
      expect(service.update).toHaveBeenCalledWith('id', dto);
    });
  });

  describe('remove', () => {
    it('happy path: should delete a course', async () => {
      await controller.remove('id');
      expect(service.remove).toHaveBeenCalledWith('id');
    });
  });

  describe('getSubjectsFromCourses', () => {
      it('happy path: should return subjects', async () => {
          await controller.getSubjectsFromCourses('inst1');
          expect(service.findAllSubjects).toHaveBeenCalledWith('inst1');
      });
  });
});
