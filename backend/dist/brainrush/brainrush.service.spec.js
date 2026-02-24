"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const brainrush_service_1 = require("./brainrush.service");
describe('BrainrushService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [brainrush_service_1.BrainrushService],
        }).compile();
        service = module.get(brainrush_service_1.BrainrushService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=brainrush.service.spec.js.map