const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI || "mongodb://localhost/user-management";

const topics = [
  "algorithms",
  "databases",
  "frontend",
  "backend",
  "data-structures",
  "OOP",
  "testing",
  "devops",
  "security",
  "ui-ux",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeOptions(i) {
  return [
    `Option A for q${i}`,
    `Option B for q${i}`,
    `Option C for q${i}`,
    `Option D for q${i}`,
  ];
}

(async function seed() {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const collection = mongoose.connection.collection("questions");

    const docs = [];

    // Balanced distribution: 34 beginner, 33 intermediate, 33 advanced = 100
    const difficulties = [];
    difficulties.push(...Array(34).fill("beginner"));
    difficulties.push(...Array(33).fill("intermediate"));
    difficulties.push(...Array(33).fill("advanced"));

    for (let i = 0; i < 100; i++) {
      const diff = difficulties[i];
      const opts = makeOptions(i + 1);
      const correct = pick(opts);
      docs.push({
        questionText: `${diff.charAt(0).toUpperCase() + diff.slice(1)} sample question #${i + 1}`,
        options: opts,
        correctAnswer: correct,
        topic: pick(topics),
        difficulty: diff,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const result = await collection.insertMany(docs);
    console.log(
      "Inserted questions:",
      result.insertedCount || Object.keys(result.insertedIds).length,
    );
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed", err);
    process.exit(1);
  }
})();
