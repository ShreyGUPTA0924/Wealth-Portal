<div align="center">

<!-- Banner-style badge row — tweak hex colors to match your brand -->
<img src="https://readme-typing-svg.demolab.com?font=Inter&weight=600&size=28&duration=3000&pause=800&color=6366F1&center=true&vCenter=true&width=800&height=50&lines=WealthWise+%C2%B7+WealthPortal;India-first+wealth+management+%2B+AI" alt="WealthWise title animation" />

<br/>

[![India-first](https://img.shields.io/badge/India--first-investors-FF6B35?style=for-the-badge)](README.md)
[![Full-stack](https://img.shields.io/badge/Build-Full--stack-6366F1?style=for-the-badge)](README.md)
[![AI](https://img.shields.io/badge/AI-Gemini-8B5CF6?style=for-the-badge&logo=google-gemini&logoColor=white)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License vibe](https://img.shields.io/badge/Project-Academic%20%2F%20Minor-14b8a6?style=for-the-badge)](README.md)

<p align="center">
  <strong>Portfolio tracking · Goal-based planning · AI advisor that knows <em>your</em> context</strong>
</p>

<p align="center">
  <a href="#what-it-does"><img src="https://img.shields.io/badge/Overview-4f46e5?style=flat-square&labelColor=312e81&color=a5b4fc" alt="Jump to overview"/></a>
  <a href="#why-this-project-stands-out-usp"><img src="https://img.shields.io/badge/USP-7c3aed?style=flat-square&labelColor=4c1d95&color=c4b5fd" alt="Jump to USP"/></a>
  <a href="#features-at-a-glance"><img src="https://img.shields.io/badge/Features-0d9488?style=flat-square&labelColor=134e4a&color=99f6e4" alt="Jump to features"/></a>
  <a href="#architecture"><img src="https://img.shields.io/badge/Architecture-e11d48?style=flat-square&labelColor=881337&color=fda4af" alt="Jump to architecture"/></a>
  <a href="#repository-layout"><img src="https://img.shields.io/badge/Layout-ca8a04?style=flat-square&labelColor=713f12&color=fef08a" alt="Jump to layout"/></a>
  <a href="#run-the-project"><img src="https://img.shields.io/badge/Run%20%26%20Demo-ea580c?style=flat-square&labelColor=9a3412&color=fdba74" alt="Jump to run and demo"/></a>
</p>

<br/>

| Web | API | AI | Data |
|:---:|:---:|:---:|:---:|
| [![Next](https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/) | [![Express](https://img.shields.io/badge/Express-5-404040?style=flat&logo=express&logoColor=white)](https://expressjs.com/) | [![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/) | [![Postgres](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.prisma.io/) |

</div>

---

## What it does

**WealthWise** (product UI) / **WealthPortal** (this repo) is a **full-stack wealth-management platform** for Indian investors: secure sign-in, holdings across **equities, mutual funds, fixed income, gold**, **financial goals** with health tracking, **family-linked portfolios**, and an **AI advisor** powered by **Google Gemini** — chat, **smart nudges** (rebalancing, concentration, SIPs), **portfolio health**, and **CIBIL report parsing** via the Python AI service.

The client is a **glass-style dashboard** (sidebar, dark/light mode, Framer Motion) on a **REST API** with JWT sessions, Zod validation, and optional **Redis** plus **cron jobs** for market sync.

---

## Why this project stands out (USP)

| | USP | In one line |
|---|-----|-------------|
| 🇮🇳 | **India-focused instruments** | MF, FD/RD, PPF, EPF, NPS, SGB, gold, Zerodha/Upstox — not “stocks only.” |
| 🧠 | **AI with real portfolio context** | Advice uses **your** holdings, goals, risk, and bill checklist — not generic tips. |
| 🎯 | **Goals ↔ holdings** | Health status, SIP hints, optional **allocations** tied to holdings. |
| 👪 | **Household view** | Family members with **their own portfolios** (spouse, kids’ education, etc.). |
| 🛡️ | **Production-minded API** | Rate limits, Helmet, Prisma, Yahoo **price sync**, Redis-ready, reports & notifications. |

---

## Features at a glance

### Core product

| Area | Highlights |
|------|------------|
| 🔐 **Auth** | Email/password, **Google OAuth**, JWT + refresh (**httpOnly cookies**), silent refresh on `401`, optional **2FA (TOTP)**. |
| 📊 **Dashboard** | Aggregated wealth & activity via dashboard services. |
| 💼 **Portfolio** | Many **asset classes**; brokers: manual, **Zerodha**, **Upstox**, **CSV**; P&amp;L, **XIRR**, scheduled price sync. |
| 🎯 **Goals** | Retirement, house, education, travel, emergency, wedding, custom; **health** (on track / at risk / off track), SIP hints, link to holdings. |
| 👨‍👩‍👧 **Family** | Members, relationships, minors, allowance, **per-member portfolios**. |
| 🔔 **Reminders** | **Checklist** templates (rent, utilities, EMIs, insurance…); monthly paid/unpaid — **fed to AI** for context. |
| 📚 **Learn** | Category-based learning (API-driven). |
| 📄 **Reports** | Portfolio, capital gains, full financial, family — **queued → ready** pipeline. |
| ⚙️ **Settings** | Risk profile, onboarding, preferences. |

### AI layer

| | |
|---|---|
| 💬 **Chat** | Persistent sessions & messages in PostgreSQL. |
| ✨ **Nudges** | Rebalance, expense ratio, concentration, SIP underperform, panic sell, health report + severities. |
| 🔬 **FastAPI** | Health score, **CIBIL PDF parsing** (pdfplumber + Gemini), chat, nudges. |

---

## Architecture

**Next.js** → **Express** (REST + cookies) → **Prisma / PostgreSQL**; **FastAPI + Gemini** for LLM and docs; **Redis** optional; **cron** for prices and goal sync.

```mermaid
flowchart LR
  subgraph client["🖥️ Web — Next.js"]
    UI["App Router · React Query · Zustand"]
  end

  subgraph api["⚙️ API — Node.js"]
    EX["Express 5"]
    PR["Prisma → PostgreSQL"]
    JOB["Cron · prices · goals"]
    RD[("Redis · optional")]
  end

  subgraph ai["🤖 AI — Python"]
    FA["FastAPI"]
    GM["Gemini"]
  end

  UI -->|REST + cookies| EX
  EX --> PR
  EX --> RD
  EX --> JOB
  EX -->|HTTP| FA
  FA --> GM
```

---

## Repository layout

```
Wealth-Portal/
├── web/                    # Next.js 16 · App Router · Tailwind CSS 4 · TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/     # login, register, verify, onboarding
│   │   │   └── (portal)/   # dashboard, portfolio, goals, advisor, family,
│   │   │                    # learn, reminders, reports, settings (+ dynamic routes)
│   │   ├── components/     # UI, shared widgets (e.g. Symbol combobox, modals)
│   │   ├── lib/            # api-client (axios + refresh), utilities
│   │   ├── providers/      # React Query, theme
│   │   └── store/          # auth (Zustand)
│   └── public/
├── server/                 # Express 5 · Prisma · TypeScript
│   ├── prisma/
│   │   └── schema.prisma   # users, portfolios, holdings, goals, family,
│   │                        # transactions, checklist, AI nudges, chat, reports,
│   │                        # notifications, …
│   └── src/
│       ├── controllers/
│       ├── routes/         # auth, market, holdings, portfolio, goals,
│       │                    # dashboard, family, ai, learn, settings, reminders
│       ├── services/         # domain logic (holdings, goals, market, dashboard, …)
│       ├── middleware/       # auth, validate (Zod), rate limit
│       ├── jobs/             # e.g. priceSync
│       └── lib/              # prisma, redis, calculations
├── ai-service/             # FastAPI · Gemini · CIBIL, chat, nudges, health
│   └── app/
│       ├── routers/        # chat, nudges, health_score, parse_cibil
│       └── gemini_client.py
└── shared/                 # shared TS types (stub / future extraction)
```

### Frontend route map

| Area | Routes (examples) |
|------|-------------------|
| **Auth** | `/login`, `/register`, `/verify`, `/onboarding` |
| **Portal shell** | Sidebar: **Dashboard, Portfolio, Goals, AI Advisor, Family, Learn, Reminders, Reports** + **Settings** |
| **Deeper** | `/portfolio/add`, `/portfolio/[holdingId]`, `/goals/new`, `/goals/[goalId]`, `/family/[memberId]`, `/learn/[category]`, `/advisor/nudges` |

---

## Tech stack

| | Layer | Technologies |
|---|------|--------------|
| 🟣 | **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Recharts, Lucide, React Hook Form + Zod, TanStack Query, Zustand, next-themes |
| 🌿 | **Backend** | Node.js, Express 5, Prisma 5, PostgreSQL, Zod, JWT, bcrypt, Bull (deps), ioredis, yahoo-finance2, node-cron, multer, Nodemailer, Speakeasy, Helmet, rate limiting |
| 🔮 | **AI** | Python, FastAPI, google-generativeai, pdfplumber, httpx |
| ☁️ | **Infra** | Supabase-style Postgres URLs, optional Redis, CORS friendly for Vercel + Render (`*.onrender.com`) |

---

## Run the project

### Live app on Render (use incognito)

If the project is deployed on **[Render](https://render.com/)**, open your **live URL** from the Render dashboard (for example `https://<your-service>.onrender.com`) in a **new incognito / private window**:

| Browser | Shortcut (Windows) |
|---------|-------------------|
| **Chrome / Edge** | `Ctrl` + `Shift` + `N` |
| **Firefox** | `Ctrl` + `Shift` + `P` |

**Why incognito?** It **isolates cookies** from your **localhost** dev session, reduces weird **JWT refresh** behaviour when switching environments, and gives reviewers a **clean first visit** for demos.

<p align="center">
  <a href="https://your-app.onrender.com">
    <img src="https://img.shields.io/badge/Open%20live%20app-%20update%20this%20link%20%E2%86%92-46A049?style=for-the-badge&logo=render&logoColor=white" alt="Open Render deployment"/>
  </a>
</p>

Edit the badge URL above in the README to match your real Render service URL.

---

### Run from source locally

**Prerequisites:** Node.js, Python 3, PostgreSQL (e.g. Supabase), optional Redis.

1. **Database** — Create a DB; set `DATABASE_URL` and `DIRECT_URL` under `server/` (see Prisma).
2. **API** — `cd server` → `npm install` → `npx prisma migrate dev` (or `db push`) → set `JWT_SECRET`, `JWT_REFRESH_SECRET` → `npm run dev` (default **`5000`**).
3. **Web** — `cd web` → `npm install` → set `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:5000`) → `npm run dev` (default **`3000`**).
4. **AI service** — `cd ai-service` → venv → `pip install -r requirements.txt` → configure `.env` (Gemini keys) → run Uvicorn; set server **`AI_SERVICE_URL`** (default **`http://localhost:8000`**).

**Health checks:** `GET /health` on the API and on the AI service.

> Env files are not committed — wire `JWT_*`, `DATABASE_URL`, `REDIS_URL`, `AI_SERVICE_URL`, `ALLOWED_ORIGINS`, Google OAuth secrets, etc. per environment.

---

## Project notes

- Root `web/src/app/page.tsx` may still be the **Next.js starter**; the real product is under **`(auth)`** and **`(portal)`** — use **`/login`** once the API is up.
- Set **`DISABLE_PRICE_SYNC=true`** when you want to skip market sync offline.

---

<div align="center">

### WealthWise

*Plan smarter · Invest clearer · Learn as you grow*

<sub>Minor / capstone-style full-stack project · README tuned for clarity & color</sub>

<br/>

[![Stars](https://img.shields.io/github/stars/ShreyGUPTA0924/Wealth-Portal?style=social)](https://github.com/ShreyGUPTA0924/Wealth-Portal)
[![Forks](https://img.shields.io/github/forks/ShreyGUPTA0924/Wealth-Portal?style=social)](https://github.com/ShreyGUPTA0924/Wealth-Portal)

</div>
