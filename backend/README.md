# Question Bank Backend (Node.js + Express + PostgreSQL)

REST API for the Examination Question Bank and Paper Generator. It does everything the Java CLI does
(add, update, delete + undo, search, statistics, balanced paper generation), with units 1-5 and
automatic question numbers (Q101, Q102, ...).

## 1. Setup (Windows)

1. Install **Node.js 20+** and **PostgreSQL** (remember the password you set for the `postgres` user).
2. Create two databases (pgAdmin, or SQL Shell `psql -U postgres`):
   ```sql
   CREATE DATABASE questionbank;       -- your real data
   CREATE DATABASE questionbank_test;  -- used only by `npm test`
   ```
3. In this folder, copy `.env.example` to `.env` and put your password in `DATABASE_URL`:
   ```
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/questionbank
   PORT=4000
   ```
4. Run:
   ```
   npm install
   npm run db:init     # creates the tables
   npm start           # API at http://localhost:4000
   ```
5. Open http://localhost:4000/api/health - you should see `{"status":"ok"}`.
6. Optional: `npm test` runs 11 automated API tests. (If your password is not `postgres`, set
   `TEST_DATABASE_URL` first.)

Use `requests.http` (VS Code "REST Client" extension) to try every endpoint.

## 2. API

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/api/questions` | **Manual entry.** Body: `unit, topic, subtopic, difficulty, marks, text` |
| GET | `/api/questions` | List with filters: `unit, topic, subtopic, difficulty, marks, q, page, limit` |
| GET | `/api/questions/:id` | One question (`101` or `Q101`) |
| PUT | `/api/questions/:id` | Update |
| DELETE | `/api/questions/:id` | Soft delete (moves to the deleted list) |
| GET | `/api/questions/deleted` | Deleted questions, newest first |
| POST | `/api/questions/undo` | Restore the most recently deleted question |
| POST | `/api/questions/:id/restore` | Restore a specific deleted question |
| GET | `/api/stats` | Counts by difficulty, marks, unit, topic and total marks |
| POST | `/api/generate/questions` | **Automatic option.** Body: `topic, subtopic?, marks, difficulty, count, unit?`. Picks random matching questions and reports any `shortfall` |
| POST | `/api/papers/generate` | Balanced paper. Body: `totalMarks, unit? (0 = all), topic?, subtopic?, split? {easy, medium, hard}` (default 40/40/20) |

Errors are JSON: `400` validation (with the field name), `404` not found, `409` duplicate question text.

## 3. How the Java ideas map to this backend

| Java CLI | Backend |
|---|---|
| ArrayList of records | `questions` table |
| HashMap topic -> questions | index on `topic` |
| Stack for undo | soft delete (`is_deleted`, `deleted_at`) + `/undo` takes the newest one |
| PriorityQueue by marks | `src/paperGenerator.js` (highest marks first, two passes) |
| questions.txt | PostgreSQL |
| Auto question number | identity column starting at 101 |

## 4. Folder structure

```
sql/schema.sql              table definition
scripts/init-db.js          npm run db:init
src/app.js, server.js       Express app and startup
src/routes/                 questions.js, stats.js, generate.js
src/validation.js           input rules (units 1-5, difficulty, marks)
src/paperGenerator.js       paper selection algorithm
test/api.test.js            automated tests
```

## 5. Next phases

1. **Frontend** (React): a page with two options - *Manual entry* (form) and *Automatic* (topic, subtopic,
   marks, difficulty -> calls `/api/generate/questions`).
2. **ML service** (Python FastAPI + scikit-learn): duplicate detection (TF-IDF + cosine similarity),
   difficulty prediction, and AI question generation to fill the `shortfall`.
