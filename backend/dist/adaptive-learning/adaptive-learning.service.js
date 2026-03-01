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
exports.AdaptiveLearningService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const student_profile_schema_1 = require("../users/schemas/student-profile.schema");
const student_performance_schema_1 = require("./schemas/student-performance.schema");
const recommendation_schema_1 = require("./schemas/recommendation.schema");
const level_test_schema_1 = require("./schemas/level-test.schema");
const question_schema_1 = require("./schemas/question.schema");
let AdaptiveLearningService = class AdaptiveLearningService {
    constructor(profileModel, performanceModel, recommendationModel, levelTestModel, questionModel) {
        this.profileModel = profileModel;
        this.performanceModel = performanceModel;
        this.recommendationModel = recommendationModel;
        this.levelTestModel = levelTestModel;
        this.questionModel = questionModel;
    }
    async createProfile(dto) {
        const profile = new this.profileModel(dto);
        return profile.save();
    }
    async findAllProfiles() {
        return this.profileModel.find().exec();
    }
    async findProfileByUserId(userId) {
        const profile = await this.profileModel
            .findOne({ userId }).exec();
        if (!profile)
            throw new common_1.NotFoundException(`Profile not found for user ${userId}`);
        return profile;
    }
    async updateProfile(userId, updateData) {
        const updated = await this.profileModel
            .findOneAndUpdate({ userId }, updateData, { new: true })
            .exec();
        if (!updated)
            throw new common_1.NotFoundException(`Profile not found for user ${userId}`);
        return updated;
    }
    async deleteProfile(userId) {
        await this.profileModel
            .findOneAndDelete({ userId }).exec();
    }
    async createPerformance(dto) {
        const performance = new this.performanceModel(dto);
        return performance.save();
    }
    async findAllPerformances() {
        return this.performanceModel.find().exec();
    }
    async findPerformanceByStudent(studentId) {
        return this.performanceModel
            .find({ studentId })
            .sort({ attemptDate: -1 })
            .exec();
    }
    async deletePerformance(id) {
        await this.performanceModel.findByIdAndDelete(id).exec();
    }
    async getAverageScore(studentId) {
        const result = await this.performanceModel.aggregate([
            { $match: { studentId } },
            { $group: { _id: null, avg: { $avg: '$score' } } }
        ]);
        return result[0]?.avg || 0;
    }
    async createRecommendation(dto) {
        const recommendation = new this.recommendationModel(dto);
        return recommendation.save();
    }
    async findRecommendationsByStudent(studentId) {
        return this.recommendationModel
            .find({ studentId })
            .sort({ generatedAt: -1 })
            .exec();
    }
    async markRecommendationViewed(id) {
        const rec = await this.recommendationModel
            .findByIdAndUpdate(id, { isViewed: true }, { new: true })
            .exec();
        if (!rec)
            throw new common_1.NotFoundException(`Recommendation ${id} not found`);
        return rec;
    }
    async deleteRecommendation(id) {
        await this.recommendationModel
            .findByIdAndDelete(id).exec();
    }
    async createQuestion(dto) {
        const question = new this.questionModel(dto);
        return question.save();
    }
    async findAllQuestions() {
        return this.questionModel.find().exec();
    }
    async createLevelTest(studentId) {
        const beginnerQs = await this.questionModel.aggregate([
            { $match: { difficulty: 'beginner' } },
            { $sample: { size: 5 } }
        ]);
        const intermediateQs = await this.questionModel.aggregate([
            { $match: { difficulty: 'intermediate' } },
            { $sample: { size: 8 } }
        ]);
        const advancedQs = await this.questionModel.aggregate([
            { $match: { difficulty: 'advanced' } },
            { $sample: { size: 7 } }
        ]);
        let selectedQuestions = [...beginnerQs, ...intermediateQs, ...advancedQs];
        if (selectedQuestions.length === 0) {
            selectedQuestions = [
                {
                    questionText: "What does OOP stand for?",
                    options: ["Object Oriented Programming", "Open Object Processing", "Ordered Output Program", "None"],
                    correctAnswer: "Object Oriented Programming",
                    topic: "OOP", difficulty: "beginner"
                },
                {
                    questionText: "What is a variable in programming?",
                    options: ["A fixed value", "A storage location with a name", "A function", "A loop"],
                    correctAnswer: "A storage location with a name",
                    topic: "programming", difficulty: "beginner"
                },
                {
                    questionText: "What does HTML stand for?",
                    options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Language", "None"],
                    correctAnswer: "Hyper Text Markup Language",
                    topic: "web", difficulty: "beginner"
                },
                {
                    questionText: "What is a primary key in databases?",
                    options: ["A unique identifier for each record", "The first column", "An encrypted field", "A foreign reference"],
                    correctAnswer: "A unique identifier for each record",
                    topic: "databases", difficulty: "beginner"
                },
                {
                    questionText: "What is a loop in programming?",
                    options: ["A condition", "A repeated execution block", "A variable", "A function call"],
                    correctAnswer: "A repeated execution block",
                    topic: "programming", difficulty: "beginner"
                },
                {
                    questionText: "What is CSS used for?",
                    options: ["Database management", "Styling web pages", "Server logic", "Algorithms"],
                    correctAnswer: "Styling web pages",
                    topic: "web", difficulty: "beginner"
                },
                {
                    questionText: "What is the time complexity of binary search?",
                    options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
                    correctAnswer: "O(log n)",
                    topic: "algorithms", difficulty: "intermediate"
                },
                {
                    questionText: "What is inheritance in OOP?",
                    options: ["Copying code", "A class acquiring properties of another", "A loop structure", "A data type"],
                    correctAnswer: "A class acquiring properties of another",
                    topic: "OOP", difficulty: "intermediate"
                },
                {
                    questionText: "What is a REST API?",
                    options: ["A database", "An architectural style for web services", "A programming language", "A UI framework"],
                    correctAnswer: "An architectural style for web services",
                    topic: "web", difficulty: "intermediate"
                },
                {
                    questionText: "What is SQL used for?",
                    options: ["Styling web pages", "Managing relational databases", "Building mobile apps", "Writing scripts"],
                    correctAnswer: "Managing relational databases",
                    topic: "databases", difficulty: "intermediate"
                },
                {
                    questionText: "What is polymorphism?",
                    options: ["Multiple forms of a function or object", "A loop type", "A database join", "A network protocol"],
                    correctAnswer: "Multiple forms of a function or object",
                    topic: "OOP", difficulty: "intermediate"
                },
                {
                    questionText: "What is Big O notation?",
                    options: ["A math formula", "A way to describe algorithm performance", "A database query", "A design pattern"],
                    correctAnswer: "A way to describe algorithm performance",
                    topic: "algorithms", difficulty: "intermediate"
                },
                {
                    questionText: "What is a binary tree?",
                    options: ["A tree with two roots", "A hierarchical structure where each node has at most 2 children", "A sorting algorithm", "A type of loop"],
                    correctAnswer: "A hierarchical structure where each node has at most 2 children",
                    topic: "algorithms", difficulty: "intermediate"
                },
                {
                    questionText: "What is normalization in databases?",
                    options: ["Encrypting data", "Organizing data to reduce redundancy", "Backing up data", "Indexing tables"],
                    correctAnswer: "Organizing data to reduce redundancy",
                    topic: "databases", difficulty: "intermediate"
                },
                {
                    questionText: "What is the CAP theorem?",
                    options: ["Consistency, Availability, Partition tolerance", "Create, Alter, Partition", "Cache, Access, Process", "None"],
                    correctAnswer: "Consistency, Availability, Partition tolerance",
                    topic: "databases", difficulty: "advanced"
                },
                {
                    questionText: "What is dynamic programming?",
                    options: ["Writing code dynamically", "Solving problems by breaking them into overlapping subproblems", "A web framework", "A type of database"],
                    correctAnswer: "Solving problems by breaking them into overlapping subproblems",
                    topic: "algorithms", difficulty: "advanced"
                },
                {
                    questionText: "What is microservices architecture?",
                    options: ["A small computer", "An approach where an app is built as small independent services", "A CSS technique", "A database type"],
                    correctAnswer: "An approach where an app is built as small independent services",
                    topic: "programming", difficulty: "advanced"
                },
                {
                    questionText: "What is a design pattern?",
                    options: ["A UI template", "A reusable solution to a common software problem", "A database schema", "A CSS framework"],
                    correctAnswer: "A reusable solution to a common software problem",
                    topic: "programming", difficulty: "advanced"
                },
                {
                    questionText: "What is SOLID in software engineering?",
                    options: ["A database type", "5 principles of object-oriented design", "A testing framework", "A network protocol"],
                    correctAnswer: "5 principles of object-oriented design",
                    topic: "OOP", difficulty: "advanced"
                },
                {
                    questionText: "What is the difference between SQL and NoSQL?",
                    options: [
                        "SQL is faster than NoSQL",
                        "SQL uses structured tables, NoSQL uses flexible documents/key-value",
                        "NoSQL is only for small projects",
                        "They are the same"
                    ],
                    correctAnswer: "SQL uses structured tables, NoSQL uses flexible documents/key-value",
                    topic: "databases", difficulty: "advanced"
                }
            ];
        }
        const levelTest = new this.levelTestModel({
            studentId,
            questions: selectedQuestions
        });
        await levelTest.save();
        const testObj = levelTest.toObject();
        testObj.questions = testObj.questions.map((q) => {
            const copy = { ...q };
            delete copy.correctAnswer;
            return copy;
        });
        return testObj;
    }
    async submitLevelTest(id, answers) {
        const test = await this.levelTestModel.findById(id).exec();
        if (!test)
            throw new common_1.NotFoundException(`LevelTest ${id} not found`);
        let correct = 0;
        const processedAnswers = answers.map((ans, index) => {
            const isCorrect = test.questions[index]?.correctAnswer === ans.selectedAnswer;
            if (isCorrect)
                correct++;
            return { ...ans, isCorrect };
        });
        const totalScore = Math.round((correct / test.questions.length) * 100);
        const resultLevel = totalScore >= 70 ? 'advanced' :
            totalScore >= 40 ? 'intermediate' :
                'beginner';
        const topicMap = {};
        test.questions.forEach((q, index) => {
            const topic = q.topic || 'General';
            if (!topicMap[topic]) {
                topicMap[topic] = { correct: 0, total: 0 };
            }
            topicMap[topic].total++;
            if (processedAnswers[index]?.isCorrect) {
                topicMap[topic].correct++;
            }
        });
        const detectedStrengths = Object.entries(topicMap)
            .filter(([_, stat]) => Math.round((stat.correct / stat.total) * 100) >= 70)
            .map(([topic, stat]) => ({
            topic,
            score: Math.round((stat.correct / stat.total) * 100),
            correct: stat.correct,
            total: stat.total
        }));
        const detectedWeaknesses = Object.entries(topicMap)
            .filter(([_, stat]) => Math.round((stat.correct / stat.total) * 100) < 50)
            .map(([topic, stat]) => ({
            topic,
            score: Math.round((stat.correct / stat.total) * 100),
            correct: stat.correct,
            total: stat.total
        }));
        const updated = await this.levelTestModel
            .findByIdAndUpdate(id, {
            answers: processedAnswers,
            totalScore,
            resultLevel,
            detectedStrengths,
            detectedWeaknesses,
            status: 'completed',
            completedAt: new Date()
        }, { new: true }).exec();
        if (!updated)
            throw new common_1.NotFoundException(`LevelTest ${id} not found`);
        const existingProfile = await this.profileModel
            .findOne({ userId: test.studentId }).exec();
        if (existingProfile) {
            await this.profileModel.findOneAndUpdate({ userId: test.studentId }, {
                level: resultLevel,
                strengths: detectedStrengths.map((s) => s.topic),
                weaknesses: detectedWeaknesses.map((w) => w.topic),
                levelTestCompleted: true,
                progress: totalScore,
            }, { new: true }).exec();
        }
        else {
            await this.profileModel.create({
                userId: test.studentId,
                academic_level: 'N/A',
                risk_level: totalScore >= 70 ? 'LOW' :
                    totalScore >= 40 ? 'MEDIUM' : 'HIGH',
                points_gamification: 0,
                level: resultLevel,
                strengths: detectedStrengths.map((s) => s.topic),
                weaknesses: detectedWeaknesses.map((w) => w.topic),
                levelTestCompleted: true,
                progress: totalScore,
            });
        }
        return updated;
    }
    async findLevelTestByStudent(studentId) {
        const test = await this.levelTestModel
            .findOne({ studentId })
            .sort({ createdAt: -1 })
            .exec();
        if (!test)
            return null;
        const testObj = test.toObject();
        if (testObj.status === 'in-progress') {
            testObj.questions = testObj.questions.map((q) => {
                const copy = { ...q };
                delete copy.correctAnswer;
                return copy;
            });
        }
        return testObj;
    }
};
exports.AdaptiveLearningService = AdaptiveLearningService;
exports.AdaptiveLearningService = AdaptiveLearningService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(student_profile_schema_1.StudentProfile.name)),
    __param(1, (0, mongoose_1.InjectModel)(student_performance_schema_1.StudentPerformance.name)),
    __param(2, (0, mongoose_1.InjectModel)(recommendation_schema_1.Recommendation.name)),
    __param(3, (0, mongoose_1.InjectModel)(level_test_schema_1.LevelTest.name)),
    __param(4, (0, mongoose_1.InjectModel)(question_schema_1.Question.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], AdaptiveLearningService);
//# sourceMappingURL=adaptive-learning.service.js.map