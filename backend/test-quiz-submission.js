const http = require("http");
const jwt = require("jsonwebtoken");

// Create a valid dummy token with standard JWT "sub" claim
const token = jwt.sign(
  { sub: "69c1d673d649a840f248d0cf", email: "test@test.com", role: "student" },
  "your-secret-key-here", // From .env
  { expiresIn: "1h" },
);

console.log("JWT Token:", token);

const quizSubmissionData = {
  quizId: "507f1f77bcf86cd799439011",
  quizTitle: "Test Quiz",
  subjectTitle: "Mathematics",
  chapterTitle: "Chapter 1",
  subChapterTitle: "Basics",
  totalQuestions: 2,
  scoreObtained: 15,
  answers: [
    {
      questionIndex: 0,
      selectedOptionIndex: 1,
      correctOptionIndex: 1,
      isCorrect: true,
    },
    {
      questionIndex: 1,
      selectedOptionIndex: 2,
      correctOptionIndex: 0,
      isCorrect: false,
    },
  ],
};

const postData = JSON.stringify(quizSubmissionData);

const options = {
  hostname: "127.0.0.1",
  port: 3000,
  path: "/api/subjects/quiz-submissions/submit",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
    Authorization: `Bearer ${token}`,
  },
};

const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${data}`);
  });
});

req.on("error", (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.write(postData);
req.end();

console.log("Quiz submission test sent...");
