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

    it('should step up when correct just under threshold (4999ms)', () => {
        const nextDiff = service.adaptDifficulty('easy', true, 4999);
        expect(nextDiff).toBe('medium');
    });

    it('should not change level when correct exactly at threshold (5000ms)', () => {
        const nextDiff = service.adaptDifficulty('medium', true, 5000);
        expect(nextDiff).toBe('medium');
    });

    it('should step down when correct just over threshold (5001ms)', () => {
        const nextDiff = service.adaptDifficulty('medium', true, 5001);
        expect(nextDiff).toBe('easy');
    });

    it('should treat unknown difficulty as medium then step up when correct and fast', () => {
        const nextDiff = service.adaptDifficulty('unknown', true, 1000);
        expect(nextDiff).toBe('hard');
    });

    it('should step down when wrong even if response is fast', () => {
        const nextDiff = service.adaptDifficulty('hard', false, 1000);
        expect(nextDiff).toBe('medium');
    });
});
