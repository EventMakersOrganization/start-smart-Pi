from __future__ import annotations

import random

from locust import HttpUser, between, task


class AIServiceUser(HttpUser):
    wait_time = between(0.5, 2.0)

    @task(3)
    def chatbot_ask(self):
        questions = [
            "Explain loops in simple words",
            "What is a variable in Python?",
            "How do functions work?",
            "Explain SQL SELECT with example",
        ]
        self.client.post(
            "/chatbot/ask",
            json={
                "question": random.choice(questions),
                "conversation_history": [],
                "student_id": "loadtest-user",
            },
            name="/chatbot/ask",
        )

    @task(2)
    def brainrush_question(self):
        topics = ["variables", "loops", "functions", "arrays"]
        self.client.post(
            "/brainrush/generate-question",
            json={
                "subject": "Programmation",
                "difficulty": "medium",
                "topic": random.choice(topics),
                "question_type": "MCQ",
                "student_id": "loadtest-user",
            },
            name="/brainrush/generate-question",
        )

    @task(1)
    def benchmark_snapshot(self):
        self.client.get("/monitor/eval-benchmark", name="/monitor/eval-benchmark")
