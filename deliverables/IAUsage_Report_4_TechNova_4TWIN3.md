# AI Usage Report — ProjectCode **4** — Team **TechNova** — Class **4TWIN3**

**Purpose:** Transparent disclosure of how **generative AI** and **coding agents** were used, per course instructions.  
**Principle:** AI accelerated exploration and boilerplate; **human review** applied for security, architecture, and correctness.

---

## 1. Tools & models

| Category | Tool / runtime | Role |
|----------|----------------|------|
| **IDE agent** | **Cursor** + **Claude (Anthropic)** via Cursor | Primary pair-programmer for refactors, tests, DevOps YAML, debugging |
| **Cursor subagents** | Cursor **Explore** / **fast** agent (where invoked) | Read-only codebase scans, parallel search |
| **Local LLM runtime** | **Ollama** (`llama3:8b`, `qwen2.5:3b`, `mistral`, etc.) | **Application runtime** for ai-service (RAG, MCQ, chat) — *not* the same as “ChatGPT wrote the app” |
| **CI** | **Jenkins** (WSL) | Builds/tests; not generative AI |
| **Quality gate** | **SonarQube** | Static analysis; not generative AI |

**Note on model IDs:** Exported Cursor chat transcripts on disk **do not include** the parent model slug; when the UI showed **“Claude Opus 4.7”** (or similar), that is the conversational model used for those sessions. Subagent traces sometimes include `"model":"fast"` (Cursor routing).

---

## 2. Representative Cursor sessions (parent transcripts)

Each link is a **parent** session UUID (no subagent IDs), per course citation rules:

| # | Session (title) | UUID | What AI helped with |
|---|-----------------|------|---------------------|
| 1 | [Instructor brief and DevOps choices](a0371452-fd48-45d3-a754-09f53818367a) | `a0371452-fd48-45d3-a754-09f53818367a` | Monorepo vs split CI, Jenkins/Docker prerequisites, integrating ai-service with backend pipeline |
| 2 | [Level test code and MCQ design](4b8f92f1-2aef-414d-8dab-71a29e5a3033) | `4b8f92f1-2aef-414d-8dab-71a29e5a3033` | Locating level-test pipeline, two-stage MCQ generation spec (small + large model) |
| 3 | [Per-subject level test and subchapters](0f81e3e4-90f9-499b-905a-a1d4913c9917) | `0f81e3e4-90f9-499b-905a-a1d4913c9917` | One level test per subject, one question per subchapter, strengths/weaknesses mapping |
| 4 | [AI-service bootstrap and broad product work](2eb3fc66-cf1a-41e4-96ed-abadee474acc) | `2eb3fc66-cf1a-41e4-96ed-abadee474acc` | Early `config.py` / `db_connection.py` / `chroma_setup.py` / `api.py` scaffolding; Sprint 6 inventory; WCAG-style HTML survey |
| 5 | [Merge resolution and chatbot quality](bb5fdad7-df03-4e54-8e92-a3dce5b6ac56) | `bb5fdad7-df03-4e54-8e92-a3dce5b6ac56` | Large merge (Jenkins/Sonar/Docker + adaptive modules), conflict resolution, chatbot answer-quality debugging |
| 6 | [Faster Mistral for many questions](1b7c791a-5575-4caa-a4d7-2e0aa51b286d) | `1b7c791a-5575-4caa-a4d7-2e0aa51b286d` | Advice-only throughput for batch MCQ generation |
| 7 | *(this session)* | *(current chat)* | Kubernetes manifests, UFW/DNS, kubeadm cert SANs, Sonar/Jest/pytest triage, final PI deliverable markdown |

---

## 3. Example prompts (verbatim excerpts, shortened)

> “what is better in our case working with aiservice back and front separate… integrate with back or make pipelines for ai separately”

> “give me the parts in ai-service that are responsible for generating the level test”

> “You are an AI system designed to generate high-quality multiple choice questions… TWO-STAGE pipeline”

> “each subject must have its own level test… number of subchapters… = number of questions”

> “Create a config.py file that: 1. Uses python-dotenv…”

> “Resolve this merge conflict @Branch”

> “this ai chatbot is trash… I asked it a clear question”

> “mistral agent is too slow… 40 questions generation… just give me solution written dont do anything”

---

## 4. Tasks where AI assistance was used (taxonomy)

| Task type | Examples | Human oversight |
|-----------|----------|-----------------|
| **Code generation** | Nest modules, FastAPI routes, Angular components, k8s YAML | Security review (secrets), manual test on VM |
| **Unit / integration tests** | Jest specs (`*.spec.ts`), pytest (`ai-service/tests/`) | CI must pass; flaky tests rewritten |
| **Debugging** | CoreDNS / UFW / kube-proxy paths, Mongo pod reachability | Verified with `kubectl`, `nc`, `dig` |
| **DevOps** | `Jenkinsfile.*`, `k8s/kustomization.yaml`, `docker-compose.vm-deps.yml` | Adjusted for real infra (2 Docker Hub images only) |
| **Documentation** | This deliverables folder | Marked estimated vs measured clearly |
| **Refactoring** | Removing duplicate ai-service image plan | Team decision after inventory |

---

## 5. Critical thinking — where AI output was **rejected** or **corrected**

1. **Third Docker image (`startsmart-ai`)** — initial k8s plan assumed a separate Hub image; **corrected** after team confirmed only **`slm334/startsmart-api`** and **`slm334/startsmart-web`** exist; ai-service runs **on-VM** with `AI_SERVICE_URL` pointing to host LAN IP.  
2. **“Pods cannot reach API” mis-diagnosis** — early theory blamed Flannel broadly; **narrowed** to **UFW INPUT on tcp/6443** using `nc` vs `ping` evidence.  
3. **BusyBox `wget` TLS** — false alarm on ClusterIP; validated with **`curlimages/curl` Job**.  
4. **Netplan static `192.168.204.100`** — removed stale static route/gateway; **migrated** to DHCP on VMware NAT; **regenerated apiserver cert SANs** for new IP + `127.0.0.1`.  
5. **DNS for Docker pulls** — public resolvers timed out; **pivoted** to `docker save` / `load` path when registry DNS flaky.

---

## 6. Runtime LLMs (product feature vs coding assistant)

The **ai-service** calls **Ollama** models for user-facing generation (MCQ, chat, RAG). These models **do not author the repository** autonomously; they execute at **runtime** inside the team’s infrastructure.

Environment defaults are documented in [`ai-service/core/config.py`](ai-service/core/config.py) and LLM wiring in [`ai-service/utils/langchain_ollama.py`](ai-service/utils/langchain_ollama.py).

---

## 7. Honesty statement about *this* document

Sections of **Performance**, **Accessibility**, and **this IA Usage** report were drafted with **Cursor + Claude** using the repository and transcript index as sources. Any performance numbers labelled **(estimated)** were **not** taken from a Lighthouse JSON artifact.

---

## 8. Sign-off

**Team TechNova — Class 4TWIN3 — Project code 4**  
Date: **2026-05-04**
