"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const adaptation_service_1 = require("./adaptation.service");
describe('AdaptationService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [adaptation_service_1.AdaptationService],
        }).compile();
        service = module.get(adaptation_service_1.AdaptationService);
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
//# sourceMappingURL=adaptation.service.spec.js.map