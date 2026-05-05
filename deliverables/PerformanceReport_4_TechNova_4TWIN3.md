# Performance Report — ProjectCode **4** — Team **TechNova** — Class **4TWIN3**

**Product:** Start-Smart (Angular frontend + NestJS backend + FastAPI ai-service)  
**Repository:** monorepo (`frontend/`, `backend/`, `ai-service/`)  
**Report date:** 2026-05-04  
**Important:** This report is **evidence-based from the codebase** and **local development assumptions**. It does **not** attach a fake Lighthouse JSON export. Where numeric ranges appear without a lab trace, they are marked **(estimated from code / local dev)**.

---

## 1. Executive summary

The stack is a **classic three-tier JS + Python** system:

| Layer | Technology | Evidence |
|-------|--------------|----------|
| Web UI | **Angular 16.2** | `frontend/package.json` (`@angular/core` ^16.2.0) |
| API | **NestJS 10** | `backend/package.json` |
| AI / RAG | **FastAPI + Uvicorn**, **Ollama** | `ai-service/api.py`, `ai-service/core/config.py`, `utils/langchain_ollama.py` |

**Strengths (already in code):** route-level lazy loading for heavy areas (Analytics, Brainrush, Codebattle screens), production bundle hashing, MongoDB indexes on hot paths, optional Redis-backed read caches (analytics + chat AI paths), global validation + rate limits in production, AI-side hybrid response cache + embedding cache + explicit LLM wall-clock budgets, latency regression tests for fast-path/cache behavior.

**Main risks (code-evident):** large initial bundle budget headroom (4 MB warning), many heavy client libraries, **widespread hard-coded `http://localhost:3000`** in the Angular tree (production deployment / CDN / same-origin strategy not centralized), no HTTP compression middleware on Nest, no service worker / SSR, duplicate `analytics` route definition in routing (can confuse bundle splitting / navigation).

---

## 2. Methodology

| Indicator | How it should be measured (reproducible) | What this document contains |
|-----------|------------------------------------------|-------------------------------|
| Web Vitals (LCP, INP, CLS, TTFB) | Chrome DevTools **Performance** + **Lighthouse** on a stable URL | **Ranges (estimated)** from Angular production config + dependency weight; **not** a captured Lighthouse run |
| Lighthouse performance score | `npx lighthouse <url> --only-categories=performance --output=json` | **Target** after fixes: ≥ 85 on login + dashboard (hypothesis); current score **not claimed** |
| Unlighthouse crawl | `npx unlighthouse --site <url>` | Recommended command only |
| API latency | `autocannon`, `k6`, or `hey` against representative routes | **Illustrative p50/p95 envelopes (estimated)** + pointers to code paths that dominate latency |

---

## 3. Frontend performance (static evidence)

### 3.1 Build & budgets (`frontend/angular.json`)

- **Production** `optimization` enabled for scripts/styles; **fonts optimization disabled** (`"fonts": false`) — can increase render cost on first paint vs subset fonts.
- **Initial bundle budgets:** `maximumWarning: 4mb`, `maximumError: 5mb` — signals a **large** main bundle; production builds should be profiled with **source-map-explorer** or **webpack-bundle-analyzer** (Angular 16 browser builder).
- **`outputHashing: "all"`** — good for long-term caching of hashed assets.

### 3.2 Lazy loading (`frontend/src/app/app-routing.module.ts`)

- **`loadChildren`:** `AnalyticsModule` (`path: 'analytics'`), `BrainrushModule` (`path: 'brainrush'`).
- **`loadComponent`:** Codebattle **Lobby**, **BattleLobby**, **Game**, **Results** routes — reduces initial bundle for users who never open Codebattle.
- **Issue:** `path: 'analytics'` with `loadChildren` appears **twice** (duplicate route block). This should be cleaned up (router ambiguity / maintenance risk).

### 3.3 Runtime patterns

- **`ng serve`** uses `node --max-old-space-size=4096` (`frontend/package.json`) — mitigates OOM during dev builds; not a production runtime setting.
- **Standalone components:** widespread (`standalone: true` across many files — prior audit ~27 occurrences in 19 files).
- **`ChangeDetectionStrategy.OnPush`:** only **two** components use OnPush (per prior codebase survey) — most components use **default** change detection → more change-detection cycles under load.
- **Images:** no `NgOptimizedImage`, no systematic `loading="lazy"` / `decoding="async"` pattern found in templates (prior survey).
- **HTTP:** `JwtInterceptor` for auth header; **no** global HTTP cache / retry interceptor found.
- **PWA / SSR:** not present (`@angular/service-worker`, `@nguniversal`, `provideClientHydration` not used).

### 3.4 Heavy client dependencies (`frontend/package.json`)

Non-exhaustive list that impacts parse/compile/execute cost:

- `chart.js`, `d3`, `face-api.js`, `html2canvas`, `jspdf`, `mammoth`, `xlsx`, `highlight.js`, `marked` / `ngx-markdown`, `socket.io-client`, `file-saver`.

### 3.5 API base URL coupling (performance + operability)

A **large number** of `frontend/src` files reference **`http://localhost:3000`** (services, components, specs, `proxy.conf.json`). This is a **deployment anti-pattern**: production cannot benefit from same-origin caching, edge CDN, or HTTP/2 coalescing without refactor (`environment.ts` / build-time `fileReplacements` + nginx ingress).

---

## 4. Backend (NestJS) performance (static evidence)

### 4.1 Security & stability middleware (`backend/src/main.ts`)

- **Helmet** with CSP and `crossOriginResourcePolicy: cross-origin` (document previews).
- **CORS** with credentials enabled.
- **Global `ValidationPipe`** with `whitelist`, `transform`, `forbidNonWhitelisted` — reduces accidental payload bloat / invalid fields (CPU + DB).
- **`express-rate-limit`** (`backend/src/main.ts`):
  - **Production (`NODE_ENV === 'production'`):** 100 req / 15 min per IP globally; **`/api/auth/login` skipped** on the global limiter, then a **separate** limiter on `/api/auth/login`: **10 attempts / 15 min**.
  - **Non-production:** a single global limiter **1000 req / minute** (still enabled — not “off” in dev).

### 4.2 Caching

- **Analytics read cache:** `backend/src/analytics/services/analytics-read-cache.service.ts` — in-memory L1 + optional Redis L2 (`REDIS_URL`), TTL configurable (`ANALYTICS_CACHE_TTL_SECONDS` default 45s in related code paths).
- **Chat AI service cache:** `backend/src/chat/ai.service.ts` — in-memory map TTL (~5 min) + optional Redis for response cache; also tracks latency samples per endpoint.

### 4.3 Database indexing (MongoDB / Mongoose)

Evidence from repository survey (counts approximate):

- **`@Prop({ index: true })`:** ~16 occurrences across ~10 schema files (attendance, class relations, adaptive-learning schemas, analytics webhooks, reports, etc.).
- **`Schema.index(...)`:** ~15 compound / unique indexes across activity, risk scores, subjects engagement, analytics alerts, etc.

Indexes reduce worst-case scan time on filtered dashboards and analytics APIs.

### 4.4 Pagination & heavy queries

- Widespread use of **`.limit()` / `.skip()`** in services (courses, chat, analytics, adaptive learning, brainrush, etc.).
- **Aggregations** used in reporting / monitoring paths (e.g. `report.service.ts`, `monitoring.service.ts`).

### 4.5 Background schedulers (cost awareness)

Cron-style jobs (`@nestjs/schedule`) include:

- **Daily** report aggregation (`report.service.ts`).
- **Every 30 minutes** risk score recalculation (`risk-score.scheduler.service.ts`) unless disabled via env.
- **Every minute** webinar status updates (`webinar.service.ts`) — highest wake frequency; should be monitored for DB write amplification.
- **Daily 08:00** AB intervention automation (`ab-intervention-automation.service.ts`).

### 4.6 Not present (gaps)

- **No `compression` middleware** detected in `backend/` (gzip/br not enabled at HTTP layer in code survey).
- **No Nest `ThrottlerGuard`** — rate limiting is via `express-rate-limit` only.

---

## 5. AI-service performance (static evidence)

### 5.1 Caching & async execution

- **`HybridResponseCache`** instantiated in `ai-service/api.py` with **`max_entries=3000`**, **`ttl_seconds=3600`**, disk dir `./response_cache`; integrates optional **Redis** when `REDIS_URL` is set (`core/config.py`).
- **`EmbeddingCache`** (`embeddings/embedding_cache.py`) + on-disk query cache paths in embeddings pipeline.
- **`ThreadPoolExecutor(max_workers=4)`** (`optimization/async_refresh.py`) for bounded parallel refresh / timeout helper `run_with_timeout`.

### 5.2 Explicit latency budgets (`ai-service/api.py`)

Examples present in code comments / constants:

- **`CHAT_LLM_HARD_BUDGET = 120.0`** seconds for LLM phase guarding.
- **`BRAINRUSH_SESSION_BUDGET = 240.0`** seconds for session-level wall clock.

These are **real SLO-style guardrails** in code (monitoring/logging paths reference them).

### 5.3 LLM defaults (`ai-service/utils/langchain_ollama.py`, `core/config.py`)

- Default chat LLM: **`OLLAMA_MODEL`** (e.g. `llama3:8b` in config defaults), `temperature=0.3`, `num_ctx=4096`.
- “Explain” path uses higher **`num_ctx`** (up to **16384**) and `num_predict=1500` — higher cost per request.
- Fast path uses smaller context (`num_ctx=2048`, `num_predict=1024`, `temperature=0.1`) when `OLLAMA_FAST_MODEL` configured.

### 5.4 Automated performance tests

- **`ai-service/tests/test_latency_fastpath.py`** — unit tests mock cache hits / errors; integration section (when enabled) asserts **second** chatbot request is **faster** than first and returns `cache_hit` / `tier_used` metadata — good regression guard for accidental cache breakage.

---

## 6. “Initial vs optimized” narrative (honest)

| Area | Initial / baseline (inferred) | Optimizations evidenced in repo |
|------|-------------------------------|----------------------------------|
| Web delivery | Monolithic dev server, large dependency graph | Lazy routes (Analytics, Brainrush, Codebattle), prod `outputHashing`, bundle budgets as guardrails |
| API cost | Unbounded DB scans (risk) | Mongoose indexes + pagination patterns |
| Abuse / overload | Open login & API flood | Production rate limits + stricter login limiter |
| AI cost | Repeated identical prompts | Hybrid response cache + embedding cache + fast-path tests |
| DB write amplification | N/A | Cron jobs documented — need runtime metrics |

---

## 7. Synthetic / local-dev performance table (NOT Lighthouse export)

**Environment (assumed):** Windows/WSL or Linux dev machine, `ng serve` / `nest start --watch` / `uvicorn`, MongoDB in Docker, LAN latency < 5 ms, **no CDN**, **no HTTP/2 push**, **no gzip** at API layer.

| Metric | Route / scenario | Value | Basis |
|--------|------------------|-------|--------|
| Initial route | `/login` first load (dev) | **2.5 – 6.0 s** TTI (estimated) | Large dependency graph + dev source maps + no lazy vendor split for core |
| Initial route | `/login` prod build served by static host | **1.2 – 3.5 s** LCP (estimated) | `angular.json` 4 MB warning budget + heavy libs |
| INP | Dashboard with charts | **120 – 350 ms** (estimated) | Default change detection + chart.js/d3 work |
| API p50 | `GET /` (Nest root) | **3 – 15 ms** (local) | trivial handler |
| API p95 | Analytics dashboard aggregation | **80 – 800 ms** (estimated) | aggregation + cache TTL 45s cold path |
| API p95 | Chat → AI `/health` proxy | **20 – 120 ms** (estimated) | network hop to ai-service |
| AI p95 | `/chatbot/ask` cold (Ollama) | **3 – 90 s** (wide envelope) | model + context + hardware; code budgets up to 120s LLM phase |
| AI p95 | `/chatbot/ask` warm (cache hit) | **50 – 400 ms** (estimated) | `HybridResponseCache` path |

**Legend:** *(estimated)* = derived from architecture & config, not from a saved Lighthouse run.

---

## 8. Recommended measurement commands (for evaluators / team)

```bash
# Frontend production build size
cd frontend && npm ci && npm run build -- --configuration=production

# Optional bundle inspect
npx source-map-explorer dist/frontend/*.js

# Lighthouse (requires a running URL)
npx lighthouse http://localhost:4200/login --only-categories=performance --output=json --output-path=./lighthouse-login.json

# API quick load (install hey first)
hey -n 2000 -c 50 http://localhost:3000/

# AI service (when running)
hey -n 100 -c 5 http://localhost:8000/health
```

---

## 9. Backlog (next optimizations)

1. Centralize **`environment.prod.ts`** + replace hard-coded `http://localhost:3000` with **`/api` reverse proxy** or env-driven base URL.
2. Roll out **`ChangeDetectionStrategy.OnPush`** + `trackBy` in large lists.
3. Adopt **`NgOptimizedImage`** for avatars & content images.
4. Add **`compression`** to Nest (gzip) behind ingress.
5. Add **HTTP retry / dedupe** for flaky mobile networks.
6. Introduce **SSR or prerender** only if SEO needed (costly).
7. Fix **duplicate `analytics` route** in `app-routing.module.ts`.
8. Add **real** nightly Lighthouse CI artifact (JSON) to this folder — *ground truth*.

---

## 10. Sign-off

Prepared by **Team TechNova** for course **4TWIN3**, project code **4**.  
Metrics without attached JSON are explicitly **estimates** as required by integrity constraints.
