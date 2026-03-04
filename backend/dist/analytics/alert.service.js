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
exports.AlertService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const alert_schema_1 = require("./schemas/alert.schema");
let AlertService = class AlertService {
    constructor(alertModel) {
        this.alertModel = alertModel;
    }
    async create(createAlertDto) {
        const alert = new this.alertModel(createAlertDto);
        return alert.save();
    }
    async findAll() {
        return this.alertModel
            .find()
            .populate('student', 'first_name last_name email')
            .populate('instructor', 'first_name last_name email')
            .exec();
    }
    async findOne(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException(`Invalid Alert ID: ${id}`);
        }
        const alert = await this.alertModel
            .findById(id)
            .populate('student', 'first_name last_name email')
            .populate('instructor', 'first_name last_name email')
            .exec();
        if (!alert) {
            throw new common_1.NotFoundException(`Alert with ID ${id} not found`);
        }
        return alert;
    }
    async findByStudent(studentId) {
        if (!mongoose_2.Types.ObjectId.isValid(studentId)) {
            throw new common_1.NotFoundException(`Invalid Student ID: ${studentId}`);
        }
        return this.alertModel
            .find({ student: studentId })
            .populate('student', 'first_name last_name email')
            .populate('instructor', 'first_name last_name email')
            .exec();
    }
    async findByInstructor(instructorId) {
        if (!mongoose_2.Types.ObjectId.isValid(instructorId)) {
            throw new common_1.NotFoundException(`Invalid Instructor ID: ${instructorId}`);
        }
        return this.alertModel
            .find({ instructor: instructorId })
            .populate('student', 'first_name last_name email')
            .populate('instructor', 'first_name last_name email')
            .exec();
    }
    async findUnresolved() {
        return this.alertModel
            .find({ resolved: false })
            .populate('student', 'first_name last_name email')
            .populate('instructor', 'first_name last_name email')
            .exec();
    }
    async update(id, updateAlertDto) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException(`Invalid Alert ID: ${id}`);
        }
        const alert = await this.alertModel
            .findByIdAndUpdate(id, updateAlertDto, { new: true })
            .populate('student', 'first_name last_name email')
            .populate('instructor', 'first_name last_name email')
            .exec();
        if (!alert) {
            throw new common_1.NotFoundException(`Alert with ID ${id} not found`);
        }
        return alert;
    }
    async resolve(id) {
        return this.update(id, { resolved: true });
    }
    async remove(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException(`Invalid Alert ID: ${id}`);
        }
        const result = await this.alertModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new common_1.NotFoundException(`Alert with ID ${id} not found`);
        }
    }
    async count() {
        return this.alertModel.countDocuments().exec();
    }
};
exports.AlertService = AlertService;
exports.AlertService = AlertService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(alert_schema_1.Alert.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], AlertService);
//# sourceMappingURL=alert.service.js.map