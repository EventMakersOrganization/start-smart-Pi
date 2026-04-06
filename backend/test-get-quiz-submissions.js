const http = require("http");
const jwt = require("jsonwebtoken");

// Create a valid dummy token with standard JWT "sub" claim
const token = jwt.sign(
  { sub: "69c1d673d649a840f248d0cf", email: "test@test.com", role: "student" },
  "your-secret-key-here", // From .env
  { expiresIn: "1h" },
);

console.log("JWT Token:", token);

const options = {
  hostname: "127.0.0.1",
  port: 3000,
  path: "/api/subjects/quiz-submissions/student",
  method: "GET",
  headers: {
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

req.end();

console.log("Getting all quiz submissions for student...");
