import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { Exercise, Difficulty } from './schemas/exercise.schema';

describe('ExercisesService', () => {
  let service: ExercisesService;
  let model: any;

  const mockExercise = {
    _id: 'exId',
    content: 'Solve X',
    difficulty: Difficulty.MEDIUM,
    save: jest.fn(),
  };

  const createMockModel = () => {
      const m: any = jest.fn().mockImplementation(() => mockExercise);
      m.find = jest.fn().mockReturnThis();
      m.findById = jest.fn().mockReturnThis();
      m.findByIdAndUpdate = jest.fn().mockReturnThis();
      m.findByIdAndDelete = jest.fn().mockReturnThis();
      m.countDocuments = jest.fn();
      m.populate = jest.fn().mockReturnThis();
      m.skip = jest.fn().mockReturnThis();
      m.limit = jest.fn().mockReturnThis();
      m.exec = jest.fn().mockResolvedValue([]);
      return m;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        {
          provide: getModelToken(Exercise.name),
          useValue: createMockModel(),
        },
      ],
    }).compile();

    service = module.get<ExercisesService>(ExercisesService);
    model = module.get(getModelToken(Exercise.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('happy path: should create an exercise', async () => {
      mockExercise.save.mockResolvedValue(mockExercise);
      const result = await service.create({ content: 'New' } as any);
      expect(result).toEqual(mockExercise);
      expect(mockExercise.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('happy path: should return paginated exercises', async () => {
      model.exec.mockResolvedValue([mockExercise]);
      model.countDocuments.mockResolvedValue(1);

      const result = await service.findAll(1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('edge case: should filter by difficulty', async () => {
        model.exec.mockResolvedValue([]);
        model.countDocuments.mockResolvedValue(0);
        await service.findAll(1, 10, undefined, Difficulty.HARD);
        expect(model.find).toHaveBeenCalledWith({ difficulty: Difficulty.HARD });
    });
  });

  describe('findOne', () => {
    it('happy path: should return one exercise', async () => {
      model.exec.mockResolvedValue(mockExercise);
      const result = await service.findOne('id');
      expect(result).toEqual(mockExercise);
    });

    it('error path: should throw NotFoundException if missing', async () => {
      model.exec.mockResolvedValue(null);
      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
      it('happy path: should delete', async () => {
          model.exec.mockResolvedValue(true);
          await service.remove('id');
          expect(model.findByIdAndDelete).toHaveBeenCalledWith('id');
      });

      it('error path: should throw if not found', async () => {
          model.exec.mockResolvedValue(null);
          await expect(service.remove('id')).rejects.toThrow(NotFoundException);
      });
  });
});
