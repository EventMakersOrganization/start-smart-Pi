"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationSchema = exports.Recommendation = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let Recommendation = class Recommendation {
};
exports.Recommendation = Recommendation;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Recommendation.prototype, "studentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Recommendation.prototype, "recommendedContent", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Recommendation.prototype, "reason", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        enum: ['course', 'exercise', 'topic'],
        default: 'course'
    }),
    __metadata("design:type", String)
], Recommendation.prototype, "contentType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0, max: 100 }),
    __metadata("design:type", Number)
], Recommendation.prototype, "confidenceScore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Recommendation.prototype, "isViewed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], Recommendation.prototype, "generatedAt", void 0);
exports.Recommendation = Recommendation = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Recommendation);
exports.RecommendationSchema = mongoose_1.SchemaFactory.createForClass(Recommendation);
//# sourceMappingURL=recommendation.schema.js.map