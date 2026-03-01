import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StudentProfile, StudentProfileDocument }
  from '../users/schemas/student-profile.schema';
import { StudentPerformance, StudentPerformanceDocument }
  from './schemas/student-performance.schema';
import { Recommendation, RecommendationDocument }
  from './schemas/recommendation.schema';
import { LevelTest, LevelTestDocument }
  from './schemas/level-test.schema';
import { Question, QuestionDocument }
  from './schemas/question.schema';
import { CreateStudentProfileDto }
  from './dto/create-student-profile.dto';
import { CreateStudentPerformanceDto }
  from './dto/create-student-performance.dto';
import { CreateRecommendationDto }
  from './dto/create-recommendation.dto';
import { CreateQuestionDto }
  from './dto/create-question.dto';

@Injectable()
export class AdaptiveLearningService {

  constructor(
    @InjectModel(StudentProfile.name)
    private profileModel: Model<StudentProfileDocument>,
    @InjectModel(StudentPerformance.name)
    private performanceModel: Model<StudentPerformanceDocument>,
    @InjectModel(Recommendation.name)
    private recommendationModel: Model<RecommendationDocument>,
    @InjectModel(LevelTest.name)
    private levelTestModel: Model<LevelTestDocument>,
    @InjectModel(Question.name)
    private questionModel: Model<QuestionDocument>,
  ) { }

  // ══════════════════════════════════
  // STUDENT PROFILE CRUD
  // ══════════════════════════════════

  async createProfile(
    dto: CreateStudentProfileDto
  ): Promise<StudentProfile> {
    const profile = new this.profileModel(dto);
    return profile.save();
  }

  async findAllProfiles(): Promise<StudentProfile[]> {
    return this.profileModel.find().exec();
  }

  async findProfileByUserId(
    userId: string
  ): Promise<StudentProfile> {
    const profile = await this.profileModel
      .findOne({ userId }).exec();
    if (!profile)
      throw new NotFoundException(
        `Profile not found for user ${userId}`
      );
    return profile;
  }

  async updateProfile(
    userId: string,
    updateData: Partial<StudentProfile>
  ): Promise<StudentProfile> {
    const updated = await this.profileModel
      .findOneAndUpdate({ userId }, updateData, { new: true })
      .exec();
    if (!updated)
      throw new NotFoundException(
        `Profile not found for user ${userId}`
      );
    return updated;
  }

  async deleteProfile(userId: string): Promise<void> {
    await this.profileModel
      .findOneAndDelete({ userId }).exec();
  }

  // ══════════════════════════════════
  // STUDENT PERFORMANCE CRUD
  // ══════════════════════════════════

  async createPerformance(
    dto: CreateStudentPerformanceDto
  ): Promise<StudentPerformance> {
    const performance = new this.performanceModel(dto);
    return performance.save();
  }

  async findAllPerformances(): Promise<StudentPerformance[]> {
    return this.performanceModel.find().exec();
  }

  async findPerformanceByStudent(
    studentId: string
  ): Promise<StudentPerformance[]> {
    return this.performanceModel
      .find({ studentId })
      .sort({ attemptDate: -1 })
      .exec();
  }

  async deletePerformance(id: string): Promise<void> {
    await this.performanceModel.findByIdAndDelete(id).exec();
  }

  async getAverageScore(studentId: string): Promise<number> {
    const result = await this.performanceModel.aggregate([
      { $match: { studentId } },
      { $group: { _id: null, avg: { $avg: '$score' } } }
    ]);
    return result[0]?.avg || 0;
  }

  // ══════════════════════════════════
  // RECOMMENDATION CRUD
  // ══════════════════════════════════

  async createRecommendation(
    dto: CreateRecommendationDto
  ): Promise<Recommendation> {
    const recommendation = new this.recommendationModel(dto);
    return recommendation.save();
  }

  async findRecommendationsByStudent(
    studentId: string
  ): Promise<Recommendation[]> {
    return this.recommendationModel
      .find({ studentId })
      .sort({ generatedAt: -1 })
      .exec();
  }

  async markRecommendationViewed(
    id: string
  ): Promise<Recommendation> {
    const rec = await this.recommendationModel
      .findByIdAndUpdate(id, { isViewed: true }, { new: true })
      .exec();
    if (!rec)
      throw new NotFoundException(
        `Recommendation ${id} not found`
      );
    return rec;
  }

  async deleteRecommendation(id: string): Promise<void> {
    await this.recommendationModel
      .findByIdAndDelete(id).exec();
  }

  // ══════════════════════════════════
  // QUESTION BANK CRUD
  // ══════════════════════════════════

  async createQuestion(dto: CreateQuestionDto): Promise<Question> {
    const question = new this.questionModel(dto);
    return question.save();
  }

  async findAllQuestions(): Promise<Question[]> {
    return this.questionModel.find().exec();
  }

  // ══════════════════════════════════
  // LEVEL TEST CRUD
  // ══════════════════════════════════

  async createLevelTest(studentId: string): Promise<any> {
    // 5 Beginner, 8 Intermediate, 7 Advanced
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

    // Construct the test with the exact 10 dynamically sampled questions
    let selectedQuestions = [...beginnerQs, ...intermediateQs, ...advancedQs];

    // Fallback logic if database is empty 
   if (selectedQuestions.length === 0) {
  selectedQuestions = [
    // ── BEGINNER (6) ──────────────────────
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
    // ── INTERMEDIATE (8) ──────────────────
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
    // ── ADVANCED (6) ──────────────────────
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

    // Return to frontend with stripped 'correctAnswer' to prevent cheating
    const testObj = levelTest.toObject();
    testObj.questions = testObj.questions.map((q: any) => {
      const copy = { ...q };
      delete copy.correctAnswer;
      return copy;
    });

    return testObj;
  }

  async submitLevelTest(
  id: string,
  answers: any[]
): Promise<LevelTest> {
  const test = await this.levelTestModel.findById(id).exec();
  if (!test)
    throw new NotFoundException(`LevelTest ${id} not found`);

  let correct = 0;

  // ── Calcul des réponses ──────────────────
  const processedAnswers = answers.map((ans, index) => {
    const isCorrect =
      test.questions[index]?.correctAnswer === ans.selectedAnswer;
    if (isCorrect) correct++;
    return { ...ans, isCorrect };
  });

  // ── Score global ─────────────────────────
  const totalScore = Math.round(
    (correct / test.questions.length) * 100
  );

  const resultLevel =
    totalScore >= 70 ? 'advanced' :
    totalScore >= 40 ? 'intermediate' :
    'beginner';

  // ── Détection forces/faiblesses par topic ─
  const topicMap: Record<string, { correct: number; total: number }> = {};

  test.questions.forEach((q: any, index: number) => {
    const topic = q.topic || 'General';
    if (!topicMap[topic]) {
      topicMap[topic] = { correct: 0, total: 0 };
    }
    topicMap[topic].total++;
    if (processedAnswers[index]?.isCorrect) {
      topicMap[topic].correct++;
    }
  });

  // Force = topic avec score >= 70%
  const detectedStrengths = Object.entries(topicMap)
    .filter(([_, stat]) =>
      Math.round((stat.correct / stat.total) * 100) >= 70
    )
    .map(([topic, stat]) => ({
      topic,
      score: Math.round((stat.correct / stat.total) * 100),
      correct: stat.correct,
      total: stat.total
    }));

  // Faiblesse = topic avec score < 50%
  const detectedWeaknesses = Object.entries(topicMap)
    .filter(([_, stat]) =>
      Math.round((stat.correct / stat.total) * 100) < 50
    )
    .map(([topic, stat]) => ({
      topic,
      score: Math.round((stat.correct / stat.total) * 100),
      correct: stat.correct,
      total: stat.total
    }));

  // ── Mise à jour MongoDB ───────────────────
  const updated = await this.levelTestModel
    .findByIdAndUpdate(
      id,
      {
        answers: processedAnswers,
        totalScore,
        resultLevel,
        detectedStrengths,
        detectedWeaknesses,
        status: 'completed',
        completedAt: new Date()
      },
      { new: true }
    ).exec();

  if (!updated)
    throw new NotFoundException(`LevelTest ${id} not found`);

  // ── Met à jour le profil étudiant ─────────
  const existingProfile = await this.profileModel
  .findOne({ userId: test.studentId }).exec();

if (existingProfile) {
  //  Profil existe → mise à jour
  await this.profileModel.findOneAndUpdate(
    { userId: test.studentId },
    {
      level: resultLevel,
      strengths: detectedStrengths.map((s: any) => s.topic),
      weaknesses: detectedWeaknesses.map((w: any) => w.topic),
      levelTestCompleted: true,
      progress: totalScore,
    },
    { new: true }
  ).exec();
} else {
  //  Profil n'existe pas → création complète
  await this.profileModel.create({
    userId: test.studentId,
    academic_level: 'N/A',
    risk_level: totalScore >= 70 ? 'LOW' :
                totalScore >= 40 ? 'MEDIUM' : 'HIGH',
    points_gamification: 0,
    level: resultLevel,
    strengths: detectedStrengths.map((s: any) => s.topic),
    weaknesses: detectedWeaknesses.map((w: any) => w.topic),
    levelTestCompleted: true,
    progress: totalScore,
  });
}

  return updated;
}

  async findLevelTestByStudent(
    studentId: string
  ): Promise<any> {
    const test = await this.levelTestModel
      .findOne({ studentId })
      .sort({ createdAt: -1 })
      .exec();

    if (!test) return null;

    // Strip out correctAnswer if the test is still in-progress
    const testObj = test.toObject();
    if (testObj.status === 'in-progress') {
      testObj.questions = testObj.questions.map((q: any) => {
        const copy = { ...q };
        delete copy.correctAnswer;
        return copy;
      });
    }

    return testObj;
  }
}