# PROJECT_PROGRESS.md — AR-Based Smart Attendance System

> **Single source of truth for resuming development.** Read this document in full
> before doing anything. Do NOT re-analyze the repository, do NOT recreate existing
> files, and do NOT assume features exist beyond what is documented here.
>
> Last updated: 2026-08-02

---

## 1. Project overview

### 1.1 Current project objective

Build a **production-ready, server-side face-recognition Smart Attendance System**:

- **Phase 0–1 (COMPLETE):** Project setup, Spring Security + JWT auth with `ADMIN`
  and `TEACHER` roles, role-based React dashboards.
- **Phase 2 (COMPLETE in code):** Face-recognition backend. Admin creates classes
  and registers students with multiple face photos; embeddings are generated
  server-side by a Python/FastAPI vision service (InsightFace `buffalo_l`:
  RetinaFace detection + ArcFace recognition on ONNX Runtime). Teachers run a
  live webcam attendance session; each frame is matched against the class gallery
  and present/unknown students are reported in real time.
- **Not yet done:** Full end-to-end execution on a real database with real face
  photos, automated tests, deployment/HTTPS hardening, and an initial commit of
  the Phase 2 work.

### 1.2 Overall architecture (3 tiers)

```
attendance-frontend/        React 18 + Vite (camera capture, upload, UI)
        |  HTTP / JWT  (localhost:5173)
attendance-backend/         Spring Boot 3.3 API (auth, CRUD, orchestration)
        |  HTTP  (localhost:8080)
attendance-vision-service/  Python 3.11 + FastAPI + InsightFace (detect/embed/match)
        |
     PostgreSQL (Neon cloud)
```

### 1.3 Technology stack

| Tier | Technology |
|------|-----------|
| Frontend | React 18.3, Vite 5, Tailwind CSS 3, react-router-dom 6, axios, zustand (declared, not yet used) |
| Backend | Spring Boot 3.3.2, Java 17, Spring Web, Spring Data JPA, Spring Security, Spring Validation, Spring WebSocket (declared), jjwt 0.12.5, springdoc-openapi 2.5.0, Postgres driver |
| Vision service | Python 3.11, FastAPI 0.115.6, uvicorn 0.32.1, insightface 0.7.3, onnxruntime 1.20.1, numpy 1.26.4, opencv-python-headless 4.10.0.84, pydantic 2.9.2 / pydantic-settings 2.6.1 |
| Database | PostgreSQL (Neon cloud, connection string previously in `application.properties`) |

### 1.4 Current face recognition architecture

- **Detection:** RetinaFace (`det_10g.onnx` from `buffalo_l` pack) via
  `insightface.app.FaceAnalysis`, detector size 640×640, threshold 0.5.
- **Recognition:** ArcFace `w600k_r50.onnx`; each detected face yields an
  L2-normalised 512-d embedding (`face.normed_embedding`).
- **Enrollment:** each uploaded student photo → best-face 512-d embedding, stored
  in `student_embeddings` as a JSON text column. Gallery = per-student centroid of
  their embeddings, L2 re-normalised (computed in Java `StudentService.centroid`).
- **Matching:** cosine similarity of a query-face embedding against the gallery;
  `score` = cosine similarity, `distance` = 1 − score. A face is `matched` when the
  best candidate `score >= threshold` (backend `app.recognition.threshold`, default 0.6).
- **Frame flow:** webcam JPEG (quality 0.8) → base64 → `POST /api/attendance/scan`
  → `POST /match` on vision service → PRESENT records upserted, unknown faces
  reported but never stored.

### 1.5 Spring Boot ↔ FastAPI ↔ React communication flow

1. **React → Spring Boot:** `axios` base URL `http://localhost:8080/api`, JWT in
   `Authorization: Bearer <token>` (interceptor in `src/api/axios.js`). Auth via
   `AuthContext` (zustand-backed store per code; verify actual implementation).
2. **Spring Boot → FastAPI:** `FaceRecognitionClient` (RestClient) with
   connect 3000 ms / read 30000 ms timeouts and retry-with-backoff (3 attempts,
   exponential, cap 4000 ms) for idempotent calls. Calls: `GET /health`,
   `POST /embed/batch` (multipart, field `files`), `POST /match` (JSON).
   Single-image `POST /embed` is implemented in the client but **not used** by any
   backend service.
3. **Wire contract (JSON):** snake_case, e.g. `face_detected`, `model_loaded`,
   `student_id`, `face_count`. Backend DTOs use `@JsonProperty` to map to camelCase
   records. See section 3.9 for the full contract.

---

## 2. Repository status

### 2.1 Current folder structure

```
S:\Projects\AR-BASED-SMART-ATTENDANCE-SYSTEM\
├── .github/                     (workflows — contents not modified)
├── .qodo/                       (tooling config — not part of the app)
├── .vscode/settings.json        (Java Language Server config — automatic build config, JDK 17)
├── .gitignore                   (root, comprehensive — added)
├── README.md                    (updated: architecture, env-var setup, vision service)
├── PROJECT_PROGRESS.md          (this document)
├── .venv311/                    (local Python 3.11.9 venv for the vision service — gitignored)
├── attendance-backend/          (Spring Boot API)
│   ├── pom.xml                  (Java 17)
│   ├── .env.example             (DB_URL, DB_USERNAME, DB_PASSWORD, JWT_SECRET template)
│   └── src/main/java/com/attendance/... (62 Java files)
│   └── src/main/resources/application.properties
├── attendance-frontend/         (React + Vite)
│   └── src/                     (App.jsx + routes, pages, api modules, context, components)
└── attendance-vision-service/   (FastAPI + InsightFace — recreated, 17 files)
    ├── requirements.txt
    ├── Dockerfile
    ├── .dockerignore
    ├── .env.example
    └── app/  (main.py, config.py, schemas.py, models.py, detection.py,
               recognition.py, embedding.py, similarity.py, api/routes.py, utils/image_utils.py)
```

### 2.2 Modules

**Existing (pre-Phase-2) backend modules (present since initial commits):**
- `AttendanceApplication`, `HomeController`, `AuthController`, `AuthService`,
  `AuthResponse`, `LoginRequest`, `RegisterRequest`, `User`, `Role`,
  `UserRepository`, `JwtUtil`, `JwtAuthFilter`, `SecurityConfig`,
  `CustomUserDetailsService`, `GlobalExceptionHandler`, `application.properties`.

**Newly created backend modules (Phase 2, all present, all compile):**
- `model/`: `ClassRoom`, `Student`, `StudentEmbedding`, `AttendanceSession`,
  `Attendance`, `SessionStatus`, `AttendanceStatus`, `converter/EmbeddingConverter`.
- `repository/`: `ClassRoomRepository`, `StudentRepository`, `StudentEmbeddingRepository`,
  `AttendanceSessionRepository`, `AttendanceRepository`.
- `service/`: `StorageService`, `ClassRoomService`, `StudentService`,
  `AttendanceSessionService`, `AttendanceService`, `FaceRecognitionClient` (rewritten).
- `security/`: `AppUserDetails`, `CurrentUser` (+ `CustomUserDetailsService` updated).
- `dto/`: `ClassRoomRequest/Response`, `StudentRequest/Response`, `SessionStartRequest`,
  `SessionResponse`, `SessionReportResponse`, `AttendanceScanRequest`, `RecognizedFace`,
  `ScanResponse`, `AttendanceRecordResponse`.
- `dto/vision/`: `EmbedResult`, `EmbedBatchResult`, `CandidateFace`, `MatchScore`,
  `FaceMatch`, `MatchResult`, `HealthStatus`, `BoundingBox` (older `MatchItem` deleted).
- `exception/`: `NotFoundException`, `InvalidFileException`, `VisionServiceException`
  (+ `GlobalExceptionHandler` extended).
- `controller/`: `ClassRoomController`, `StudentController`, `AttendanceSessionController`,
  `AttendanceController`.

**Frontend modules (all present):**
- `src/api/`: `axios.js` (JWT interceptor), `classes.js`, `students.js`, `sessions.js`, `attendance.js`.
- `src/pages/`: `Login`, `Register`, `AdminDashboard`, `TeacherDashboard`,
  `ClassManagement`, `StudentRegistration`, `AttendanceScan`, `AttendanceReports`.
- `src/components/ProtectedRoute.jsx`, `src/context/AuthContext.jsx`.
- `src/App.jsx` — all routes wired (see 2.5).

**Vision service modules (recreated and verified — see section 3.6):**
- `app/main.py` (app + lifespan warmup), `app/config.py`, `app/schemas.py`,
  `app/models.py` (engine singleton), `app/detection.py` (RetinaFace),
  `app/recognition.py` (ArcFace), `app/embedding.py`, `app/similarity.py`,
  `app/api/routes.py`, `app/utils/image_utils.py`.

### 2.3 Existing APIs (present since Phase 1)

- `POST /api/auth/register` — create ADMIN/TEACHER user.
- `POST /api/auth/login` — JWT login.
- `GET /` — home.

### 2.4 New APIs (Phase 2, all implemented in code, none yet exercised end-to-end)

- **Classes** (`/api/classes`, ADMIN): `POST /api/classes`, `GET /api/classes`,
  `GET /api/classes/{id}`, `PUT /api/classes/{id}`, `DELETE /api/classes/{id}`.
- **Students** (`/api/students`, ADMIN/TEACHER): `POST /api/students` (multipart,
  `files` up to 10, `rollNumber/name/email/classId`),
  `GET /api/students`, `GET /api/students/{id}`,
  `GET /api/students/{id}/photos/{fileName}`, `DELETE /api/students/{id}`.
- **Sessions** (`/api/sessions`, ADMIN/TEACHER): `POST /api/sessions` (start, body
  `{classId}`), `POST /api/sessions/{id}/end`, `GET /api/sessions`,
  `GET /api/sessions/{id}`, `GET /api/sessions/{id}/report`.
- **Attendance** (`/api/attendance`, ADMIN/TEACHER): `POST /api/attendance/scan`
  (body `{sessionId, imageBase64}`).

**Vision service endpoints (verified live):** `GET /health`, `POST /embed`,
`POST /embed/batch`, `POST /match`. OpenAPI UI at `/docs`.

### 2.5 Frontend routes (wired in `App.jsx`)

| Route | Role | Page |
|-------|------|------|
| `/` | any (redirect) | Login or dashboard |
| `/login`, `/register` | public | Login, Register |
| `/admin` | ADMIN | AdminDashboard |
| `/admin/classes` | ADMIN | ClassManagement |
| `/admin/students/register` | ADMIN | StudentRegistration |
| `/teacher` | TEACHER, ADMIN | TeacherDashboard |
| `/teacher/scan` | TEACHER, ADMIN | AttendanceScan |
| `/teacher/sessions`, `/teacher/sessions/:id` | TEACHER, ADMIN | AttendanceReports |

### 2.6 Database entities (auto-created via `ddl-auto=update`; NOT yet migrated/verified)

- `users` — id, name, email, password (bcrypt), role, timestamps. (pre-existing, was working)
- `class_rooms` — id, name, code, description, timestamps.
- `students` — id, name, roll_number (unique), email, class_room_id, face_registered,
  active, photo_paths (JSON), timestamps.
- `student_embeddings` — id, student_id, vector (JSON text column of 512 doubles,
  via `EmbeddingConverter`), source, timestamps.
- `attendance_sessions` — id, class_room_id, status (ACTIVE/ENDED), started_at, ended_at.
- `attendance` — id, session_id, student_id, status (PRESENT/ABSENT/UNVERIFIED),
  similarity, timestamp.

> The exact column names are per the JPA entities; no database has been created or
> migrated from this code yet (see Verification status).

### 2.7 Configuration files

- `attendance-backend/src/main/resources/application.properties` — DB/JWT via env
  placeholders; upload limits (8 MB file / 50 MB request), vision timeouts, recognition
  settings, storage path, CORS origins, server port.
- `attendance-backend/.env.example` — template for required env vars (placeholders only).
- `attendance-vision-service/.env.example` — template for vision env vars (placeholders only).
- `attendance-vision-service/Dockerfile` — `python:3.11-slim`, `MODEL_ROOT=/models`,
  model mounted via volume.
- `.vscode/settings.json` — Java LSP: `updateBuildConfiguration=automatic`, JDK 17 pinned.
- Root `.gitignore` — covers target/, node_modules/, dist/, Python caches, `.venv*/`,
  `.env*`, uploads, IDE/OS files. The old `attendance-backend/.gitignore` was deleted.

### 2.8 Environment variables

**Backend (required; app fails fast if unset):**
| Var | Purpose |
|-----|---------|
| `DB_URL` | JDBC URL (e.g. `jdbc:postgresql://host:5432/neondb?sslmode=require`) |
| `DB_USERNAME` | DB user |
| `DB_PASSWORD` | DB password |
| `JWT_SECRET` | JWT signing key, ≥32 chars (HS256) |

**Vision service (all optional; sensible defaults):**
`MODEL_NAME=buffalo_l`, `MODEL_ROOT=~/.insightface`, `ONNX_PROVIDER=auto|cpu|cuda`,
`DETECTION_THRESHOLD=0.5`, `DETECTION_SIZE=[640,640]`, `MAX_FACES_PER_FRAME=20`,
`EMBEDDING_SIZE=512`, `SIMILARITY_THRESHOLD=0.6`, `TOP_K_CANDIDATES=5`,
`MAX_IMAGE_SIZE=2048`, `MAX_UPLOAD_BYTES=15728640`, `MAX_FILES_PER_BATCH=10`,
`WARMUP_ON_STARTUP=true`, `HOST`, `PORT`, `LOG_LEVEL`.

---

## 3. Completed work

### 3.1 Repository analysis (done)
Full inventory of all backend/frontend files, git history (2 commits:
`bae631e` initial, `65d2598` "updation after database connection"), toolchain
versions (Maven 3.9.11, JDK 17.0.12 at `C:\Program Files\Java\jdk-17`, Node 24,
Python 3.13 system + 3.11.9 in `.venv311`). Identified: `face-api.js` already
absent from source/package.json; broken `.gitignore`; secrets in committed
`application.properties`; `target/` and `node_modules/` tracked in git.

### 3.2 Removal/replacement of face-api.js (done)
`face-api.js` had already been removed from `package.json` and `node_modules`.
Verified no source references remain (only a README note stating client-side
face-api.js is not used). Client-side ML was fully replaced by the server-side
Python vision service. No client ML runs in the browser.

### 3.3 Spring Boot modifications (done, compiles)
- New JPA entities, enums, repositories, services, controllers, DTOs (see 2.2).
- `EmbeddingConverter`: stores `List<Double>` as a JSON text column.
- `FaceRecognitionClient` rewrite (see 3.8).
- `StorageService`: validated uploads (type/size), sanitised UUID filenames,
  photo paths `students/<studentId>/<uuid>.<ext>` under `app.storage.path`.
- `StudentService.register`: multi-photo upload → `embedBatch` → stores valid
  512-d embeddings; fails (and cleans up stored files) if no usable face.
- `AttendanceService.scan`: builds gallery, calls `/match`, upserts PRESENT
  records (creates, or upgrades UNVERIFIED, keeping max similarity).
- `SecurityConfig`: whitelists `/api/students/**`, `/api/classes/**`,
  `/api/sessions/**`, `/api/attendance/**`; JWT filter; role rules (verify exact
  rules in file).
- `GlobalExceptionHandler`: 400 (`InvalidFileException`, illegal arg),
  404 (`NotFoundException`), 503 (`VisionServiceException`), 413 (upload size),
  plus no-resource/method-not-supported and generic handling.
- `pom.xml`: Java version set to 17 (was 21).

### 3.4 React modifications (done, builds)
- API modules for classes/students/sessions/attendance using axios + JWT.
- Pages: `ClassManagement` (CRUD classes), `StudentRegistration` (multi-photo
  upload with previews, max 10, jpeg/png/webp/bmp, 8 MB each),
  `AttendanceScan` (webcam via `getUserMedia`, 1.5 s scan interval, JPEG 0.8
  quality, canvas bounding-box overlay green=matched/red=unknown, present list,
  start/end session), `AttendanceReports` (session list + detail report).
- `App.jsx` routes + `AdminDashboard`/`TeacherDashboard` navigation cards.
- No ESLint/tsconfig configured; `npm run build` passes (Vite/esbuild, no type-check).

### 3.5 Frontend dashboard navigation (done)
Admin → Class Management, Student Registration. Teacher → Start Attendance Scan,
Sessions & Reports.

### 3.6 FastAPI vision service (recreated, verified live)
Created from scratch under `attendance-vision-service/` (the directory had
vanished from the repo). 17 files. See 2.2/2.4 and section 4 for verification.

### 3.7 InsightFace / RetinaFace / ArcFace / ONNX Runtime integration (done, verified)
- `app/models.py` `FaceRecognitionEngine`: lazy singleton; provider resolution
  `auto|cpu|cuda` via `onnxruntime.get_available_providers()`; `ctx_id` 0 for
  CUDA / −1 for CPU; `FaceAnalysis(name, root=expanduser(MODEL_ROOT), providers=...)`;
  `prepare(ctx_id, det_thresh, det_size=(640,640))`; background warmup thread so
  `/health` reports `loading` until ready; `ModelNotReadyError` → HTTP 503.
- `app/detection.py` (RetinaFace layer) and `app/recognition.py` (ArcFace layer)
  wrap the shared `engine.app` pipeline; embeddings come from
  `face.normed_embedding` (512-d, L2-normalised).
- Model root semantics: insightface looks up the pack at `<MODEL_ROOT>/models/<name>`,
  so `MODEL_ROOT` defaults to `~/.insightface` (pack at `~/.insightface/models/buffalo_l`).
  First start auto-downloads buffalo_l (~150 MB) from the deepinsight/insightface
  GitHub release.

### 3.8 FaceRecognitionClient (done, compiles)
`RestClient`-based, timeouts, bounded retry with exponential backoff for idempotent
calls (GET/health, deterministic POSTs), `embedBatch` via `MultipartBodyBuilder`,
`match` via JSON payload `{image_base64, candidates:[{student_id, embedding}], threshold}`.
Uses `org.springframework.boot.web.client.ClientHttpRequestFactories` /
`ClientHttpRequestFactorySettings` (Spring 6.1 API).

### 3.9 DTOs / wire contract (done)
Backend vision DTOs map the FastAPI JSON contract (snake_case):
- `GET /health` → `HealthStatus{status, model_loaded, service, version}`.
- `POST /embed` (raw bytes) → `EmbedResult{face_detected, embedding, confidence, bbox, error}`.
- `POST /embed/batch` (multipart `files`) → `EmbedBatchResult{processed, results[]}`.
- `POST /match` → `MatchResult{face_count, threshold, faces[]}`;
  `FaceMatch{bbox, confidence, matched, best, candidates[]}`;
  `MatchScore{student_id, distance, score}`; `BoundingBox{x,y,width,height}`;
  `CandidateFace{student_id, embedding}`.
All verified end-to-end against the running service (see section 4).

### 3.10 Security improvements (done)
- `AppUserDetails` carries the DB user id; `CurrentUser` component resolves the
  authenticated user for controllers.
- JWT secret + DB credentials moved out of source (env vars) — see 3.11.
- Role-gated routes for all new controllers.
- Vision service treats the Spring backend as the only caller (no auth on the
  FastAPI side — must not be exposed publicly).

### 3.11 Environment variable migration (done)
- `application.properties`: `spring.datasource.*` and `app.jwt.secret` now read
  `${DB_URL}`, `${DB_USERNAME}`, `${DB_PASSWORD}`, `${JWT_SECRET}` with no defaults
  (fail fast). Non-secret settings remain in the file.
- `attendance-backend/.env.example` documents PowerShell / bash / `-Dspring-boot.run.arguments`
  setup, and the ≥32-char HS256 JWT secret requirement.
- **Security caveat:** the old real credentials (Neon password, hardcoded JWT secret)
  still exist in git history; rotate both before production. (Documented in README.)

### 3.12 .gitignore fixes (done)
- New root `.gitignore`: `**/target/`, `**/node_modules/`, `**/dist/`, `__pycache__/`,
  `*.py[cod]`, `.venv*/`, `venv*/`, `*.egg-info/`, pytest/mypy/ruff caches, `.vscode/*`
  (except `settings.json`), `.idea/`, `.classpath/.project/.factorypath`, OS files,
  `*.log`, `.env`, `.env.*` (except `!.env.example`), `attendance-backend/uploads/`.
- Deleted the broken `attendance-backend/.gitignore`.
- Untracked `attendance-backend/target/` (23 files) and `attendance-frontend/node_modules`
  (6594 files) via `git rm -r --cached`. Verified with `git check-ignore`.

### 3.13 README updates (done)
Rewritten: 3-tier architecture, vision service setup + layout tree + env vars,
backend env-var setup with PowerShell/bash/CLI examples, full API list, Docker
volume mount, recognition tuning, and a security note to rotate leaked credentials.

### 3.14 Build verification (done)
See section 9 (Verification status).

### 3.15 Testing already completed
- Java: compile only (no test sources exist; `spring-boot-starter-test` is declared).
- Frontend: production build only (no lint/test setup).
- Vision service: syntax checks, import test, provider resolution, live model load,
  live inference, and live HTTP smoke tests (health transition, `/embed`, `/match`
  validation, `/embed/batch` 422). No automated Python tests written.

---

## 4. Current implementation status

### 4.1 Fully implemented
- JWT auth + roles (Phase 0/1) — was already working.
- All Phase 2 backend code: entities, repos, services, controllers, exception
  handling, vision DTOs, `FaceRecognitionClient` — compiles.
- Complete FastAPI vision service (all four endpoints), verified live with the real
  model.
- Frontend pages, API modules, routing, dashboard navigation — builds cleanly.
- `.gitignore`, env-var migration, README, `.env.example` files, `.vscode` Java
  LSP config.

### 4.2 Partially implemented / in code but not end-to-end exercised
- **The full student-registration → attendance-scan flow.** All components exist,
  but no real enrollment/scan has ever been run against a live backend + DB.
- `POST /embed` (single image) exists in vision service and client but is not called
  by any backend service.
- Frontend pages are functional but never used against a live backend (no real
  session, no registered students).
- Database tables were never created/migrated from this codebase (DDL is auto-generated).

### 4.3 Verified (concrete evidence in section 9)
Backend compile; frontend build; vision service startup; `/health`; model download,
load, and inference; ONNX Runtime CPU provider; insightface 0.7.3; wire contract
responses. Python 3.11.9 venv with the pinned `requirements.txt` installed.

### 4.4 Still requires implementation
- End-to-end integration run (boot both services + DB, enroll a real face, scan).
- Automated tests (backend unit/integration, vision service, frontend).
- Production hardening: HTTPS, CORS tightening, auth on the vision service,
  secrets rotation, removing `show-sql`, tuned pool/limits, logging/monitoring.
- Deployment (Docker Compose or cloud) for backend + frontend.
- Any remaining UX/polish in the new pages.

---

## 5. Important architectural decisions

1. **Server-side face recognition, no client ML.** Reasons: model weights (~150 MB)
   and inference cost must not ship to browsers; embeddings must never leave the
   server; consistent model versioning; privacy. `face-api.js` was dropped.
2. **Separate Python microservice rather than in-JVM inference.** InsightFace is a
   Python ecosystem (PyPI wheels, ONNX Runtime); keeps Java heap/JVM clean; allows
   independent scaling on CPU/GPU; the Spring app stays the single orchestrator.
3. **InsightFace `buffalo_l` pack (RetinaFace `det_10g` + ArcFace `w600k_r50`).**
   One download, one pipeline, canonical embeddings, widely deployed; 512-d L2-normed
   embeddings are the ArcFace standard.
4. **ONNX Runtime provider resolution `auto|cpu|cuda`.** CPU-first default so the
   system runs anywhere; CUDA chosen automatically when the GPU provider is available;
   `ctx_id` (0 CUDA / −1 CPU) matches insightface conventions.
5. **Centroid gallery (per student).** Robustness across photos without storing all
   embeddings in the request; Java-side mean + L2 renormalise keeps the payload
   small (one 512-d vector per student per scan).
6. **Cosine similarity + backend-owned threshold.** `score=cosine`, `distance=1-score`;
   the authoritative cutoff lives in `app.recognition.threshold` so tuning needs no
   vision-service rebuild.
7. **Enrollment stores raw embeddings in JSON columns** (`EmbeddingConverter`).
   Simple schema, no vector index needed at this scale; a vector store can replace it
   later without API changes.
8. **Lazy singleton engine + background warmup.** `/health` answers immediately
   (`loading`), inference endpoints return 503 until ready — fast startup, no
   blocking on first request.
9. **Retry with exponential backoff, only for idempotent calls.** Frame re-matching
   is safe to repeat; bounded attempts prevent stampede on a down vision service.
10. **Env-var injection, fail-fast.** Secrets never in source; unresolved placeholders
    abort startup so misconfiguration is caught immediately.
11. **Maven + Vite standard builds, Java 17 LTS** — the only JDK on the dev machine;
    pom previously targeted 21 and was downgraded to 17.
12. **Python 3.11 pinning.** insightface 0.7.3 + numpy 1.26 + onnxruntime 1.20.1 are
    mutually compatible; Python 3.13 lacks compatible wheels. Local `.venv311` and the
    Docker image both use 3.11.

---

## 6. Current project workflow (as built)

1. **Login/register:** user → `/register` or `/login` → Spring Security issues JWT →
   frontend stores it (AuthContext) → axios attaches `Authorization` header →
   role-based redirect (ADMIN → `/admin`, TEACHER → `/teacher`).
2. **Class creation (ADMIN):** `/admin/classes` → `POST /api/classes` → `ClassRoom` row.
3. **Student registration (ADMIN):** `/admin/students/register` → `POST /api/students`
   (multipart: rollNumber, name, email, classId, ≤10 photos) → `StorageService` saves
   photos → `FaceRecognitionClient.embedBatch` → vision service embeds best face per
   photo → valid 512-d embeddings stored in `student_embeddings` (JSON) →
   `face_registered=true`; registration fails and cleans up if no usable face.
4. **Start session (TEACHER):** `/teacher/scan` → `POST /api/sessions {classId}` →
   ACTIVE `AttendanceSession`.
5. **Attendance scan:** webcam frames captured every 1.5 s → `POST /api/attendance/scan`
   `{sessionId, imageBase64}` → backend loads gallery (centroid per enrolled student) →
   vision `/match` → per face: if `matched` and student active → upsert PRESENT
   (`Attendance` with max similarity) → response lists recognized/unknown faces with
   bboxes; frontend draws overlay (green/red).
6. **End session / report:** `POST /api/sessions/{id}/end` → ENDED; `/api/sessions/{id}/report`
   returns records; `/teacher/sessions` shows history.
7. **Database updates:** all mutations flow through Spring Data JPA repositories
   (`ddl-auto=update`).

---

## 7. Remaining work (toward production-ready)

1. **End-to-end integration run** — boot vision service + backend with real env vars
   against Neon, register a class + students with real photos, start a session,
   scan a real face, confirm PRESENT/UNKNOWN reporting and the report page.
2. **Rotate leaked credentials** (Neon DB password, JWT secret) and purge/rewrite git
   history or accept the exposure risk on a throwaway DB.
3. **Commit the Phase 2 work** (currently all uncommitted; `node_modules`/`target`
   untracked, vision service untracked).
4. **Automated tests:** backend (JUnit/MockMvc for controllers/services; MockRestServiceServer
   for `FaceRecognitionClient`), vision service (pytest + TestClient, synthetic faces),
   frontend (vitest/RTL or at minimum build CI).
5. **Database migrations** (Flyway/Liquibase) replacing `ddl-auto=update`; indexes on
   `attendance(session_id, student_id)` etc.
6. **Hardening:** HTTPS everywhere, tight CORS, auth/API-key on the vision service,
   remove `show-sql`, secret manager (Vault/env), rate limiting on auth, input size
   guards already present.
7. **Deployment:** Docker Compose (db, backend, vision, frontend) or cloud deploy;
   model baked into image or mounted volume; health checks.
8. **Operational:** structured logging, metrics, graceful shutdown, warmup caching,
   optional CUDA/GPU deployment path.
9. **Optional product features:** student lists/attendance editing, reports/CSV export,
   multiple classes per teacher, session re-open rules, face-recapture for low
   similarity, mobile camera (HTTPS origin + CORS).

---

## 8. Known issues

### 8.1 Current limitations
- Nothing has been run end-to-end against a real DB with real faces — the integration
  surface (Spring ↔ FastAPI ↔ Neon ↔ React) is unproven in practice.
- No automated tests anywhere.
- Vision service has no authentication; it is an open HTTP service (fine on localhost,
  must be network-isolated in production).
- `/embed` single-image endpoint is dead code from the backend's perspective.
- Frontend has no lint/type-check; `zustand` is declared but `AuthContext` may use it —
  verify actual store usage.
- `spring.jpa.show-sql=true` and `ddl-auto=update` are dev conveniences.

### 8.2 Technical debt
- Real DB password and JWT secret are in git history (`application.properties` in old
  commits) — requires rotation and possibly history rewrite.
- `target/` and `node_modules/` were previously committed (now untracked) — the next
  commit must not re-add them; verify `.gitignore` holds.
- Backend `.gitignore` was deleted in favour of the root one — no leftover duplication.
- The old `MatchItem` DTO was deleted; ensure no stray references remain (verified none
  in source at last check).
- Recognition accuracy/tuning (0.6 threshold, 1.5 s cadence, JPEG 0.8) is untested on
  real faces — expect to tune.

### 8.3 Risks
- Python 3.13 system Python is NOT compatible with the pinned deps; always use
  `.venv311` (3.11.9). Docker image is 3.11-slim.
- Model auto-download on first start requires network access and ~150 MB disk; on
  restricted networks, pre-provision `~/.insightface/models/buffalo_l`.
- `Keys.hmacShaKeyFor` throws at runtime if `JWT_SECRET` is <32 chars — the app will
  fail fast, which is intended, but the error may surprise during setup.
- GPU path (`ONNX_PROVIDER=cuda`) is untested on this machine (CPU only available).
- Neon free-tier connection pool limits; the Hikari pool is 10 max — fine, but watch
  free-tier concurrency.
- If the vision service is down, all enroll/scan calls fail (503) by design; consider
  a fallback UX message (frontend already surfaces errors).

### 8.4 Future improvements
Vector index for embeddings, GPU serving, model-pack pinning in CI, request caching,
async scan pipeline, camera quality heuristics (blur/pose), anti-spoofing.

---

## 9. Verification status

Environment: Windows, PowerShell 5.1, JDK 17.0.12 (`C:\Program Files\Java\jdk-17`,
`JAVA_HOME` set), Maven 3.9.11, Node 24, Python 3.13 (system) + 3.11.9 (`.venv311`).

| # | Check | Command | Result |
|---|-------|---------|--------|
| 1 | Backend compile (full, fresh) | `mvn clean compile` (in `attendance-backend`) | ✅ BUILD SUCCESS |
| 2 | Backend test-compile | `mvn clean test-compile` | ✅ exit 0 (no test sources) |
| 3 | Backend compile (incremental) | `mvn -q compile` | ✅ exit 0 |
| 4 | Frontend install | `npm install` (in `attendance-frontend`) | ✅ |
| 5 | Frontend build | `npm run build` | ✅ 101 modules, ~246 kB bundle |
| 6 | Vision service syntax | `python -m py_compile` on all 13 modules | ✅ all OK |
| 7 | Vision service deps | `.venv311\Scripts\python.exe -m pip install -r requirements.txt` | ✅ all pinned versions installed |
| 8 | Vision service import | `import app.main` | ✅ app created; routes registered |
| 9 | ONNX Runtime providers | `engine._resolve_providers()` | ✅ CPUExecutionProvider, ctx_id −1 (CPU-only machine) |
| 10 | Model download + load | `engine.init()` (buffalo_l auto-downloaded ~150 MB) | ✅ ready=True |
| 11 | InsightFace / ArcFace / RetinaFace inference | `embed_faces()`/`detect_faces()` on blank 640×640 | ✅ ran; 0 faces (correct) |
| 12 | FastAPI startup | `uvicorn app.main:app` on port 8001 | ✅ startup complete |
| 13 | `/health` | GET (before warmup) | ✅ 200 `{"status":"loading","model_loaded":false,...}` |
| 14 | `/health` (after warmup) | GET | ✅ 200 `{"status":"ok","model_loaded":true,...}` |
| 15 | `/embed` | POST JPEG → 200 | ✅ `{"face_detected":false,...,"error":"no face detected"}` |
| 16 | `/match` validation | POST invalid image JSON → 400 | ✅ `{"detail":"Could not decode image;..."}` |
| 17 | `/embed/batch` validation | POST without files → 422 | ✅ |
| 18 | Model root semantics | `ensure_available('models','buffalo_l',root)` | ✅ pack at `~/.insightface/models/buffalo_l` |
| 19 | Git ignore rules | `git check-ignore` (target, node_modules, `.env`, `__pycache__`, uploads, `.venv311`) | ✅ all ignored; `.env.example` NOT ignored |
| 20 | Secrets removed from working tree | grep for old password/secret | ✅ no hits outside `.git`/`node_modules`/`target` |
| 21 | **Database connectivity** | **Backend never booted** | ⚠️ **NOT VERIFIED** — app not run against Neon; tables not created; env vars not set during this session |

Note on #21: The previous commit ("updation after database connection") suggests a
Neon connection worked before the env-var migration, but that is unverified after the
migration. Booting now requires setting `DB_URL/DB_USERNAME/DB_PASSWORD/JWT_SECRET`
and will auto-create tables.

---

## 10. Next recommended task

**Run the first end-to-end integration pass and then commit the Phase 2 work.**

Concretely, in order:

1. Set backend env vars (`.env.example` values; at minimum a valid `JWT_SECRET`
   ≥32 chars and the Neon DB credentials the user has).
2. Start the vision service (`cd attendance-vision-service; ..\.venv311\Scripts\python.exe -m uvicorn app.main:app --port 8000`) and confirm `/health` → `ok`.
3. Start the backend (`cd attendance-backend; mvn spring-boot:run` with env vars set).
   Confirm Spring Boot boots and tables auto-create against the DB (this also
   verifies `ddl-auto` + `EmbeddingConverter`).
4. Register an admin/teacher (existing `/api/auth/register`), create a class, register
   one student with 2–3 real face photos, and confirm `face_registered=true` with
   embeddings stored.
5. Start a session and POST a real face frame to `/api/attendance/scan`; confirm the
   student is marked PRESENT and the frontend scan/report pages display correctly.
6. Tune `app.recognition.threshold` if the results are weak.
7. Commit everything (one or a few logical commits): new backend modules, frontend
   modules, vision service, root `.gitignore`, `.env.example` files, `.vscode` settings,
   README, PROJECT_PROGRESS.md. Do NOT commit `target/`, `node_modules/`, `.venv311/`,
   or real `.env` files.
8. After the flow is proven, write automated tests (see section 7) before hardening.

---

## 11. Instructions for Future OpenCode Sessions

> ### IMPORTANT — READ FIRST

**Read `PROJECT_PROGRESS.md` completely before doing anything.**

- **Do NOT re-analyze the repository.** All required context is in this document and
  the files referenced here.
- **Do NOT recreate existing files.** Everything listed in sections 2, 3, and 4 already
  exists (verify with `Test-Path`/`glob` if a file seems missing — do not rewrite from
  memory).
- **Preserve the existing architecture.** Server-side recognition, the 3-tier layout,
  the wire contract, the centroid-gallery design, and the env-var configuration are
  deliberate decisions (section 5). Do not change them without a strong reason.
- **Continue only from the current implementation state.** Read section 4
  (implementation status) and section 10 (next task) — everything outside that is
  already done.
- **Verify existing code before making modifications.** Run the checks in section 9
  before editing; confirm `mvn -q compile` (backend), `npm run build` (frontend), and
  Python `py_compile` (vision service) pass before and after changes.
- **Use the correct toolchain:** JDK 17 (`C:\Program Files\Java\jdk-17`), Maven 3.9.11,
  Node ≥18, and Python 3.11 via the repo-root `.venv311` (NOT the system Python 3.13).
- **Never commit secrets.** `application.properties` holds placeholders only; real DB
  credentials and `JWT_SECRET` come from env vars. Real values from an earlier commit
  are still in git history and must be rotated (section 8.2).
- **Keep `PROJECT_PROGRESS.md` current.** When you complete the next task, update this
  document (status, verification results, next task) so the handoff stays accurate.
- **Start from the last completed task:** the last completed work is the recreated and
  verified FastAPI vision service plus the full Phase 2 code. The next task is the
  end-to-end integration run and first commit (section 10).
