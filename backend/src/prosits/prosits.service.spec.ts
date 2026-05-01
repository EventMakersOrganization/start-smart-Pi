import { normalizePrositGradeToOutOf20, PrositsService } from './prosits.service';

describe('Prosits helpers (member5)', () => {
  test('normalizePrositGradeToOutOf20 converts percentages and bounds', () => {
    expect(normalizePrositGradeToOutOf20(18)).toBe(18);
    expect(normalizePrositGradeToOutOf20(200)).toBe(20);
    expect(normalizePrositGradeToOutOf20(-5)).toBe(0);
    expect(normalizePrositGradeToOutOf20(NaN)).toBe(0);
  });
});

describe('PrositsService (unit, member5)', () => {
  test('createSubmission trims input and persists a submission', async () => {
    const findOne = jest.fn().mockReturnValue({ exec: async () => null });
    const save = jest.fn().mockResolvedValue({ _id: 'p1' });
    const prositModel: any = jest.fn().mockImplementation(() => ({ save }))
      ;
    prositModel.findOne = findOne;
    const subjectModel: any = { findOne: jest.fn() };
    const svc = new PrositsService(prositModel as any, subjectModel as any);

    const result = await svc.createSubmission({
      studentId: ' s1 ',
      prositTitle: ' p ',
      chapterTitle: ' c ',
      subChapterTitle: ' sc ',
      subjectTitle: ' subject ',
    } as any);

    expect(result).toEqual({ _id: 'p1' });
    expect(save).toHaveBeenCalled();
  });

  test('createSubmission rejects duplicates', async () => {
    const prositModel: any = { findOne: jest.fn().mockReturnValue({ exec: async () => ({ _id: 'dup' }) }) };
    const subjectModel: any = { findOne: jest.fn() };
    const svc = new PrositsService(prositModel as any, subjectModel as any);

    await expect(
      svc.createSubmission({
        studentId: 's1',
        prositTitle: 'p',
        chapterTitle: 'c',
        subChapterTitle: 'sc',
      } as any),
    ).rejects.toThrow();
  });

  test('gradeSubmission throws NotFound when missing', async () => {
    const prositModel: any = { findById: jest.fn().mockReturnValue({ exec: async () => null }) };
    const subjectModel: any = { findOne: jest.fn() };
    const svc = new PrositsService(prositModel as any, subjectModel as any);
    await expect(svc.gradeSubmission('x', 'i', 10)).rejects.toThrow();
  });
});
