"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringService = void 0;
const common_1 = require("@nestjs/common");
let ScoringService = class ScoringService {
    constructor() {
        this.BASE_POINTS = {
            easy: 10,
            medium: 20,
            hard: 30,
        };
        this.TIME_BONUS_FACTOR = 0.1;
        this.TIME_THRESHOLD = 10000;
    }
    calculateScore(isCorrect, responseTime, difficulty) {
        if (!isCorrect)
            return 0;
        let score = this.BASE_POINTS[difficulty];
        if (responseTime < this.TIME_THRESHOLD) {
            const timeSaved = this.TIME_THRESHOLD - responseTime;
            const bonus = (timeSaved / 1000) * this.TIME_BONUS_FACTOR * score;
            score += Math.floor(bonus);
        }
        return score;
    }
};
exports.ScoringService = ScoringService;
exports.ScoringService = ScoringService = __decorate([
    (0, common_1.Injectable)()
], ScoringService);
//# sourceMappingURL=scoring.service.js.map