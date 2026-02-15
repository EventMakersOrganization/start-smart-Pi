# Context-Aware Adaptive Learning Platform

<div align="center">

![Angular](https://img.shields.io/badge/Angular-DD0031?style=flat-square&logo=angular&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

**AI-powered adaptive learning platform for first-year engineering students**

*ESPRIT - Academic Year 2025-2026*

[Features](#-features) • [Tech Stack](#-technology-stack)  • [Team](#-team)

</div>

---

## 📖 Overview

An intelligent web platform that personalizes the learning experience through AI-driven content adaptation, gamification, and real-time performance monitoring. Addresses the challenge of heterogeneous student levels in first-year engineering education.

**Key Differentiators:**
- ✅ Real-time adaptive learning paths
- ✅ Local AI conversational agent (Ollama LLM)
- ✅ Predictive at-risk detection (2-4 weeks advance)
- ✅ Gamified learning with BrainRush
- ✅ Advanced analytics dashboards

---

## ✨ Features

### 🤖 AI Conversational Agent
Natural language knowledge assessment with context-aware responses powered by Ollama LLM. Provides adaptive questioning and personalized feedback.

### 📚 Adaptive Learning Engine
Automatically generates personalized learning paths with dynamic difficulty adjustment and intelligent content recommendations using ChromaDB vector search.

### 🎮 BrainRush Gamification
Interactive learning games in solo and team modes: Timed Quiz, Drag & Drop, True/False, Debug Challenge, Memory Game, and AI Surprise Wheel. Features real-time scoring and leaderboards.

### 🚨 At-Risk Detection
ML-powered predictive analytics to identify struggling students 2-4 weeks in advance with automatic alerts.

### 📊 Analytics Dashboards
Role-based dashboards for students (progress tracking), instructors (class performance), and administrators (system KPIs).

---

## 🏗️ Architecture

```
Frontend (Angular) ──► Backend (Node.js/NestJS) ──┬──► MongoDB
                                                   └──► ChromaDB + Ollama LLM
```

**3-Tier Architecture:**
- **Frontend**: Angular SPA with role-based interfaces
- **Backend**: NestJS with modular services (Auth, Learning Engine, AI Orchestrator, Analytics, BrainRush)
- **Data Layer**: MongoDB (main database) + ChromaDB (vector search) + Ollama (local LLM)

---

## 🛠️ Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Angular, RxJS, Chart.js |
| **Backend** | Node.js, NestJS, JWT |
| **Databases** | MongoDB, ChromaDB |
| **AI/ML** | Ollama (Llama 2), Sentence Transformers |
| **DevOps** | Docker, Jenkins, GitHub Actions |

---


## 👥 Team

<div align="center">

### Team Technova - 4Twin3

<img src="/team.png" alt="Team Technova" width="700"/>

**Supervised by:** Ms. Rommene Ameni  
**Institution:** ESPRIT - Engineering School in Tunisia

</div>

---

<div align="center">

**Built with ❤️ by Team Technova**  
*ESPRIT | Academic Year 2025-2026*

</div>
