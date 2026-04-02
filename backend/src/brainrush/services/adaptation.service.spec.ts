import { Test, TestingModule } from '@nestjs/testing';
import { AdaptationService } from './adaptation.service';

describe('AdaptationService', () => {
    let service: AdaptationService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [AdaptationService],
        }).compile();

        service = module.get<AdaptationService>(AdaptationService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should step up difficulty when correct and fast', () => {
        const nextDiff = service.adaptDifficulty('easy', true, 3000);
        expect(nextDiff).toBe('medium');
    });

    it('should not exceed hard difficulty', () => {
        const nextDiff = service.adaptDifficulty('hard', true, 3000);
        expect(nextDiff).toBe('hard');
    });

    it('should step down difficulty when wrong', () => {
        const nextDiff = service.adaptDifficulty('hard', false, 3000);
        expect(nextDiff).toBe('medium');
    });

    it('should step down difficulty when slow response', () => {
        const nextDiff = service.adaptDifficulty('medium', true, 6000);
        expect(nextDiff).toBe('easy');
    });

    it('should not go below easy difficulty', () => {
        const nextDiff = service.adaptDifficulty('easy', false, 3000);
        expect(nextDiff).toBe('easy');
    });
});
