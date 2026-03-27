# AI Service Load Testing (Locust)

This folder provides a baseline load test for Sprint 8 AI endpoints.

## Endpoints covered
- `/chatbot/ask`
- `/brainrush/generate-question`
- `/monitor/eval-benchmark`

## Run

Install dependencies:

```bash
pip install -r requirements.txt
```

Start AI service on `http://localhost:8000`, then run:

```bash
locust -f loadtests/locustfile.py --host http://localhost:8000
```

Open Locust UI at `http://localhost:8089`.

## Suggested baseline profile
- Users: 20
- Spawn rate: 4/sec
- Duration: 5 minutes

Collect and record:
- p50 / p95 latency
- error rate
- requests/sec
