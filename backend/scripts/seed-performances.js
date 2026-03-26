const mongoose = require("mongoose");
require("dotenv").config();

// Schemas
const performanceSchema = new mongoose.Schema({
  studentId: String,
  topic: String,
  difficulty: String,
  score: Number,
  timeSpent: Number,
  source: String,
  attemptDate: Date,
});

const Performance = mongoose.model("StudentPerformance", performanceSchema);

// Sample data for different learning styles
const samplePerformances = [
  // Fast Learner Data
  {
    studentId: "507f1f77bcf86cd799439011",
    topic: "javascript",
    difficulty: "beginner",
    score: 95,
    timeSpent: 120,
    source: "exercise",
    attemptDate: new Date("2026-03-20"),
  },
  {
    studentId: "507f1f77bcf86cd799439011",
    topic: "css",
    difficulty: "beginner",
    score: 92,
    timeSpent: 150,
    source: "exercise",
    attemptDate: new Date("2026-03-19"),
  },
  {
    studentId: "507f1f77bcf86cd799439011",
    topic: "html",
    difficulty: "intermediate",
    score: 88,
    timeSpent: 200,
    source: "exercise",
    attemptDate: new Date("2026-03-18"),
  },
  {
    studentId: "507f1f77bcf86cd799439011",
    topic: "algorithms",
    difficulty: "intermediate",
    score: 85,
    timeSpent: 180,
    source: "exercise",
    attemptDate: new Date("2026-03-17"),
  },
  {
    studentId: "507f1f77bcf86cd799439011",
    topic: "data-structures",
    difficulty: "advanced",
    score: 80,
    timeSpent: 250,
    source: "exercise",
    attemptDate: new Date("2026-03-16"),
  },
  {
    studentId: "507f1f77bcf86cd799439011",
    topic: "databases",
    difficulty: "advanced",
    score: 79,
    timeSpent: 280,
    source: "exercise",
    attemptDate: new Date("2026-03-15"),
  },

  // Methodical Learner Data (shows progression)
  {
    studentId: "507f1f77bcf86cd799439012",
    topic: "javascript",
    difficulty: "beginner",
    score: 50,
    timeSpent: 900,
    source: "exercise",
    attemptDate: new Date("2026-03-10"),
  },
  {
    studentId: "507f1f77bcf86cd799439012",
    topic: "javascript",
    difficulty: "beginner",
    score: 65,
    timeSpent: 850,
    source: "exercise",
    attemptDate: new Date("2026-03-12"),
  },
  {
    studentId: "507f1f77bcf86cd799439012",
    topic: "javascript",
    difficulty: "beginner",
    score: 75,
    timeSpent: 800,
    source: "exercise",
    attemptDate: new Date("2026-03-14"),
  },
  {
    studentId: "507f1f77bcf86cd799439012",
    topic: "javascript",
    difficulty: "intermediate",
    score: 82,
    timeSpent: 950,
    source: "exercise",
    attemptDate: new Date("2026-03-20"),
  },
  {
    studentId: "507f1f77bcf86cd799439012",
    topic: "javascript",
    difficulty: "intermediate",
    score: 88,
    timeSpent: 900,
    source: "exercise",
    attemptDate: new Date("2026-03-22"),
  },
  {
    studentId: "507f1f77bcf86cd799439012",
    topic: "algorithms",
    difficulty: "intermediate",
    score: 70,
    timeSpent: 1200,
    source: "exercise",
    attemptDate: new Date("2026-03-24"),
  },

  // Challenge Seeker Data (prefers advanced, high scores)
  {
    studentId: "507f1f77bcf86cd799439013",
    topic: "algorithms",
    difficulty: "advanced",
    score: 92,
    timeSpent: 400,
    source: "exercise",
    attemptDate: new Date("2026-03-20"),
  },
  {
    studentId: "507f1f77bcf86cd799439013",
    topic: "data-structures",
    difficulty: "advanced",
    score: 89,
    timeSpent: 450,
    source: "exercise",
    attemptDate: new Date("2026-03-19"),
  },
  {
    studentId: "507f1f77bcf86cd799439013",
    topic: "databases",
    difficulty: "advanced",
    score: 85,
    timeSpent: 500,
    source: "exercise",
    attemptDate: new Date("2026-03-18"),
  },
  {
    studentId: "507f1f77bcf86cd799439013",
    topic: "system-design",
    difficulty: "advanced",
    score: 88,
    timeSpent: 480,
    source: "exercise",
    attemptDate: new Date("2026-03-17"),
  },
  {
    studentId: "507f1f77bcf86cd799439013",
    topic: "javascript",
    difficulty: "intermediate",
    score: 75,
    timeSpent: 200,
    source: "exercise",
    attemptDate: new Date("2026-03-16"),
  },

  // Visual Learner Data (good on visual topics)
  {
    studentId: "507f1f77bcf86cd799439014",
    topic: "algorithms",
    difficulty: "beginner",
    score: 88,
    timeSpent: 1200,
    source: "exercise",
    attemptDate: new Date("2026-03-20"),
  },
  {
    studentId: "507f1f77bcf86cd799439014",
    topic: "databases",
    difficulty: "beginner",
    score: 85,
    timeSpent: 1100,
    source: "exercise",
    attemptDate: new Date("2026-03-19"),
  },
  {
    studentId: "507f1f77bcf86cd799439014",
    topic: "data-structures",
    difficulty: "intermediate",
    score: 82,
    timeSpent: 1300,
    source: "exercise",
    attemptDate: new Date("2026-03-18"),
  },
  {
    studentId: "507f1f77bcf86cd799439014",
    topic: "javascript",
    difficulty: "beginner",
    score: 65,
    timeSpent: 700,
    source: "exercise",
    attemptDate: new Date("2026-03-17"),
  },
  {
    studentId: "507f1f77bcf86cd799439014",
    topic: "css",
    difficulty: "beginner",
    score: 60,
    timeSpent: 600,
    source: "exercise",
    attemptDate: new Date("2026-03-16"),
  },

  // Consistent Learner Data (regular sessions, consistent scores)
  {
    studentId: "507f1f77bcf86cd799439015",
    topic: "javascript",
    difficulty: "beginner",
    score: 78,
    timeSpent: 400,
    source: "exercise",
    attemptDate: new Date("2026-03-20"),
  },
  {
    studentId: "507f1f77bcf86cd799439015",
    topic: "css",
    difficulty: "beginner",
    score: 76,
    timeSpent: 400,
    source: "exercise",
    attemptDate: new Date("2026-03-19"),
  },
  {
    studentId: "507f1f77bcf86cd799439015",
    topic: "html",
    difficulty: "beginner",
    score: 80,
    timeSpent: 400,
    source: "exercise",
    attemptDate: new Date("2026-03-18"),
  },
  {
    studentId: "507f1f77bcf86cd799439015",
    topic: "javascript",
    difficulty: "intermediate",
    score: 79,
    timeSpent: 400,
    source: "exercise",
    attemptDate: new Date("2026-03-17"),
  },
  {
    studentId: "507f1f77bcf86cd799439015",
    topic: "css",
    difficulty: "intermediate",
    score: 77,
    timeSpent: 400,
    source: "exercise",
    attemptDate: new Date("2026-03-16"),
  },

  // Topic Specialist Data (very good at one topic)
  {
    studentId: "507f1f77bcf86cd799439016",
    topic: "algorithms",
    difficulty: "advanced",
    score: 95,
    timeSpent: 300,
    source: "exercise",
    attemptDate: new Date("2026-03-20"),
  },
  {
    studentId: "507f1f77bcf86cd799439016",
    topic: "algorithms",
    difficulty: "advanced",
    score: 92,
    timeSpent: 350,
    source: "exercise",
    attemptDate: new Date("2026-03-19"),
  },
  {
    studentId: "507f1f77bcf86cd799439016",
    topic: "algorithms",
    difficulty: "intermediate",
    score: 88,
    timeSpent: 250,
    source: "exercise",
    attemptDate: new Date("2026-03-18"),
  },
  {
    studentId: "507f1f77bcf86cd799439016",
    topic: "javascript",
    difficulty: "beginner",
    score: 45,
    timeSpent: 800,
    source: "exercise",
    attemptDate: new Date("2026-03-17"),
  },
  {
    studentId: "507f1f77bcf86cd799439016",
    topic: "css",
    difficulty: "beginner",
    score: 50,
    timeSpent: 700,
    source: "exercise",
    attemptDate: new Date("2026-03-16"),
  },
];

async function seedPerformances() {
  try {
    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/start-smart";

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    // Clear existing performances
    await Performance.deleteMany({});
    console.log("🗑️  Cleared existing performances");

    // Insert sample data
    await Performance.insertMany(samplePerformances);
    console.log(`✅ Inserted ${samplePerformances.length} sample performances`);

    console.log("\n📊 Sample Student IDs for testing:");
    console.log("  - 507f1f77bcf86cd799439011 (Fast Learner)");
    console.log("  - 507f1f77bcf86cd799439012 (Methodical Learner)");
    console.log("  - 507f1f77bcf86cd799439013 (Challenge Seeker)");
    console.log("  - 507f1f77bcf86cd799439014 (Visual Learner)");
    console.log("  - 507f1f77bcf86cd799439015 (Consistent Learner)");
    console.log("  - 507f1f77bcf86cd799439016 (Topic Specialist)");

    await mongoose.disconnect();
    console.log("\n✅ Seeding completed successfully");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

seedPerformances();
