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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskScoreService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const riskscore_schema_1 = require("./schemas/riskscore.schema");
let RiskScoreService = class RiskScoreService {
    constructor(riskScoreModel) {
        this.riskScoreModel = riskScoreModel;
    }
    async create(createRiskScoreDto) {
        const riskScore = new this.riskScoreModel({
            ...createRiskScoreDto,
            lastUpdated: new Date(),
        });
        return riskScore.save();
    }
    async findAll() {
        return this.riskScoreModel.find().populate('user', 'first_name last_name email').exec();
    }
    async findOne(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException(`Invalid RiskScore ID: ${id}`);
        }
        const riskScore = await this.riskScoreModel
            .findById(id)
            .populate('user', 'first_name last_name email')
            .exec();
        if (!riskScore) {
            throw new common_1.NotFoundException(`RiskScore with ID ${id} not found`);
        }
        return riskScore;
    }
    async findByUser(userId) {
        if (!mongoose_2.Types.ObjectId.isValid(userId)) {
            throw new common_1.NotFoundException(`Invalid User ID: ${userId}`);
        }
        return this.riskScoreModel
            .find({ user: userId })
            .populate('user', 'first_name last_name email')
            .exec();
    }
    async update(id, updateRiskScoreDto) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException(`Invalid RiskScore ID: ${id}`);
        }
        const riskScore = await this.riskScoreModel
            .findByIdAndUpdate(id, { ...updateRiskScoreDto, lastUpdated: new Date() }, { new: true })
            .populate('user', 'first_name last_name email')
            .exec();
        if (!riskScore) {
            throw new common_1.NotFoundException(`RiskScore with ID ${id} not found`);
        }
        return riskScore;
    }
    async remove(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException(`Invalid RiskScore ID: ${id}`);
        }
        const result = await this.riskScoreModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new common_1.NotFoundException(`RiskScore with ID ${id} not found`);
        }
    }
    async count() {
        return this.riskScoreModel.countDocuments().exec();
    }
};
exports.RiskScoreService = RiskScoreService;
exports.RiskScoreService = RiskScoreService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(riskscore_schema_1.RiskScore.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], RiskScoreService);
//# sourceMappingURL=riskscore.service.js.map