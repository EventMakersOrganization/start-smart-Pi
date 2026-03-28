"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptationService = void 0;
const common_1 = require("@nestjs/common");
let AdaptationService = class AdaptationService {
    constructor() {
        this.TIME_THRESHOLD = 5000;
    }
    adaptDifficulty(currentDifficulty, isCorrect, responseTime) {
        const levels = ['easy', 'medium', 'hard'];
        let currentIndex = levels.indexOf(currentDifficulty);
        if (currentIndex === -1)
            currentIndex = 1;
        if (isCorrect && responseTime < this.TIME_THRESHOLD) {
            currentIndex = Math.min(currentIndex + 1, levels.length - 1);
        }
        else if (!isCorrect || responseTime > this.TIME_THRESHOLD) {
            currentIndex = Math.max(currentIndex - 1, 0);
        }
        return levels[currentIndex];
    }
};
exports.AdaptationService = AdaptationService;
exports.AdaptationService = AdaptationService = __decorate([
    (0, common_1.Injectable)()
], AdaptationService);
//# sourceMappingURL=adaptation.service.js.map