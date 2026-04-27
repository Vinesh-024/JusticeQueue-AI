# JusticeQueue AI — Neural Legal Triage System

A full-stack AI-powered legal case management system that analyzes PDFs using Legal-BERT, detects signatures with computer vision, and optimizes court scheduling with Google OR-Tools.

## Architecture

```
Frontend (React + Vite + Tailwind v4 + Framer Motion)  :5173
     ↕ REST
Backend (Node.js + Express + MongoDB)                   :3001
     ↕ HTTP proxy
AI Engine (FastAPI + PyMuPDF + Legal-BERT + OR-Tools)   :8000
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB running locally on port 27017

### 1. AI Engine
```bash
cd ai-engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Backend
```bash
cd backend
npm install
node server.js
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Features
- **PDF Upload** — drag-and-drop with live analysis progress bar
- **Legal-BERT Analysis** — urgency & complexity scoring (0–100)
- **Signature Detection** — OpenCV-based contour analysis
- **OR-Tools Optimization** — global re-scheduling into optimal 30-min slots
- **Justice Calendar** — animated 5-day CSS Grid calendar
- **Glassmorphism UI** — indigo/slate dark theme with Framer Motion animations
