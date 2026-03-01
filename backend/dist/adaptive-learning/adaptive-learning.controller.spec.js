"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const adaptive_learning_controller_1 = require("./adaptive-learning.controller");
describe('AdaptiveLearningController', () => {
    let controller;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [adaptive_learning_controller_1.AdaptiveLearningController],
        }).compile();
        controller = module.get(adaptive_learning_controller_1.AdaptiveLearningController);
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
//# sourceMappingURL=adaptive-learning.controller.spec.js.map