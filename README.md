# Question Bank & Examination Paper Generator

> Register subjects. Organise questions. Create sectioned examination papers from your bank or a syllabus.

[Features](#simple-interface) | [Architecture](#how-it-works) | [Installation](#run-locally) | [API](#api) | [Marks and sections](#question-counts-by-marks) | [Troubleshooting](#troubleshooting)

| Frontend | Backend | Core algorithms | Storage | Syllabus generation |
|---|---|---|---|---|
| React + Vite | Node.js + Express | Java JDK | PostgreSQL | Groq or Gemini |

## Groq setup

Groq support extracts text from PDF files in the backend before generating questions. Upload a text-based PDF or UTF-8 TXT syllabus, up to 5 MB. Scanned image-only PDFs require OCR first. Extracted text is limited to 100,000 characters. Generated questions are validated against the Java marks plan before the preview appears.

In **backend/.env**, use these settings alongside your existing database URL:

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=YOUR_GROQ_API_KEY
GROQ_MODEL=openai/gpt-oss-20b
```

Create a key in the [Groq Console](https://console.groq.com/keys). Use a model available to your account that supports [strict structured outputs](https://console.groq.com/docs/structured-outputs). Keep the actual key only in your ignored local `.env` file.

After updating the backend files, run:

```powershell
cd backend
npm.cmd ci
npm.cmd start
```

Gemini remains optional: select `AI_PROVIDER=gemini` and configure its own `GEMINI_API_KEY` and available `GEMINI_MODEL`. Provider keys are not interchangeable. There is no automatic fallback between providers. The frontend, database and Java marks rules work with either provider.

---

A simple three-part application: **React + Vite** renders the interface, **Node.js + Express** exposes the API and calls the selected generation provider, and **Java** runs the core paper algorithms. PostgreSQL stores registered subjects and questions. AI generation uses an external API; no local ML model is trained.

## Simple interface

The interface has a question bank, subject collections, and a Create a Paper workspace. Add and edit questions by subject, unit, topic, subtopic, difficulty and marks. Search/filter the bank, browse pages, and undo a soft deletion. Create a paper by choosing **Your question bank** or **Upload a syllabus**, then configure the paper and review it before downloading TXT or printing/saving PDF.

### Adding subjects and questions

1. Open **Subjects → Add subject**, enter a subject name, and select **Save subject**.
2. The new subject appears immediately with **0 questions**, even before you add any questions. Subject names are case-insensitive, and duplicate names are rejected.
3. Select a subject card to open its filtered question bank. Use **Add question** in the question bank and select that registered subject in the Subject field.
4. Saved subjects are also available in filters and the question-paper Subject selector. Deleting the last question does not delete the subject.

After pulling this update, run `npm run db:init` in `backend` once and restart the backend. This creates the `subjects` table and registers existing question subjects without deleting any question data.

The interface uses light blue and warm cream colors. It has no login, registration or user profile. Unused starter images/icons were removed, and frontend styles are in one `App.css` file.

Generated syllabus questions are not automatically stored. Review them before using a paper for an examination.

## File structure

```text
mini-project/
├── README.md
├── .gitignore
├── core/
│   └── src/
│       └── PaperEngine.java       # Core marks, difficulty allocation and question selection
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   ├── requests.http             # API examples
│   ├── scripts/init-db.js
│   ├── sql/schema.sql
│   ├── src/
│   │   ├── app.js                 # Express application
│   │   ├── server.js              # HTTP startup
│   │   ├── db.js                  # PostgreSQL connection
│   │   ├── javaCore.js            # Node → Java bridge
│   │   ├── syllabusGenerator.js   # PDF text extraction, Groq/Gemini and output validation
│   │   ├── validation.js
│   │   ├── mapper.js
│   │   ├── errors.js
│   │   └── routes/
│   │       ├── questions.js
│   │       ├── subjects.js        # Create standalone subjects
│   │       ├── stats.js
│   │       ├── generate.js
│   │       └── syllabus.js
│   └── test/
│       ├── groq.test.js
│       ├── api.test.js
│       ├── marks.test.js
│       ├── javaCore.test.js
│       └── syllabus.test.js
└── frontend/
    ├── .env.example
    ├── package.json
    ├── package-lock.json
    ├── index.html
    ├── vite.config.js
    ├── eslint.config.js
    ├── public/
    └── src/
        ├── main.jsx
        ├── App.jsx                # Question bank and stored-paper interface
        ├── SyllabusPaper.jsx      # Syllabus upload, generated preview and download
        ├── App.css
```

## How it works

```mermaid
flowchart TD
    UI[React browser interface] --> API[Express API on Node.js]
    API --> DB[(PostgreSQL)]
    API --> JAVA[Java marks and selection engine]
    API --> SOURCE[Syllabus PDF or TXT]
    SOURCE --> AI[Selected generation provider]
    AI --> VALIDATE[Validate generated questions]
    JAVA --> VALIDATE
    DB --> JAVA
    VALIDATE --> PAPER[Sectioned preview]
    PAPER --> EXPORT[Print / PDF or TXT]
```

- **Stored question paper:** React → Express → PostgreSQL question pool → Java selection → React preview.
- **Syllabus paper:** React uploads PDF/TXT → Express checks the registered subject → Java calculates question slots → the provider writes questions → Express validates the result → React preview/TXT download. Groq receives extracted text; Gemini can receive the PDF directly.
- Java owns the total-marks and difficulty algorithms. Node owns HTTP, database access, input validation and external API integration.
- Java runs as a subprocess using JDK source-file launch. No Maven, Java server or extra port is needed. Keep `core/` next to `backend/` when deploying. Source-file launch recompiles on each request, which is appropriate for this small project.

## Run locally

### Open in VS Code on Windows

1. Download/clone this repository, then use **File → Open Folder** in VS Code and open the **mini-project** folder (the folder containing `frontend`, `backend`, `core` and this README). You do not need to open every file separately.
2. Install Node.js 22.13 or newer supported LTS, JDK 17 or newer, and PostgreSQL. Open **Terminal → New Terminal** and check:
   ```powershell
   node --version
   npm --version
   java -version
   ```
   If a command is not recognized, install the corresponding tool and reopen VS Code so its PATH updates.
3. Open pgAdmin, connect to your local PostgreSQL server and open **Query Tool** on its default `postgres` database. Run these statements separately:
   ```sql
   CREATE DATABASE questionbank;
   CREATE DATABASE questionbank_test;
   ```
   Skip a statement if that database already exists. The second database is only for automated tests.
4. In the VS Code terminal, starting in the **mini-project root folder**, run:
   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```
   Open `backend/.env` in VS Code and update it:
   ```dotenv
   DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/questionbank
   PORT=4000
   AI_PROVIDER=groq
   GROQ_API_KEY=YOUR_GROQ_API_KEY
   GROQ_MODEL=openai/gpt-oss-20b
   ```
   Replace the password and API key placeholders with your own values. URL-encode special characters in the database password. The key stays in this local ignored file and is needed only for syllabus generation. The file must be named `.env`, directly inside `backend`, not `backend.env` or `.env.txt`.
5. **Terminal 1 — backend:**
   ```powershell
   cd backend
   npm ci
   npm run db:init
   npm start
   ```
   Keep it running. Open `http://localhost:4000/api/health` in your browser; the expected response is `{"status":"ok"}`. `db:init` also upgrades older question banks with subjects; it does not delete the questions.
6. Click the terminal **+** button in VS Code to create **Terminal 2**. Make sure this new terminal starts in the **mini-project root folder**, then run:
   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```
   Open the **Local URL printed by Vite**, usually `http://localhost:5173`. If port 5173 is occupied, use the next port Vite prints.
7. Add questions with a subject, or use **Create a paper** to choose the question bank or syllabus upload.

Do not launch `index.html` directly, use Live Server, or run individual Java files in VS Code for the web app. Vite serves React, and Express starts Java automatically when a paper is requested.

### Starting again later

Keep PostgreSQL running. You only need two terminals:

```powershell
# Terminal 1, from mini-project
cd backend
npm start
```

```powershell
# Terminal 2, from mini-project
cd frontend
npm run dev
```

Press **Ctrl+C** in each terminal to stop. Run `npm ci` again only after dependency changes, and run `npm run db:init` after schema updates.

### If something does not start

- **Database connection failed:** check that PostgreSQL is running and `DATABASE_URL` uses your password and an existing database.
- **Question bank unavailable:** check Terminal 1 for errors and open `/api/health`.
- **Java core unavailable:** check `java -version`; the app needs a JDK and the `core` folder beside `backend`.
- **Gemini key/model/quota error:** check `GEMINI_API_KEY` and `GEMINI_MODEL`, then restart the backend after changing `.env`.
- **Port 4000 already in use:** stop the previous backend, or change `PORT` in `backend/.env` and set the matching `VITE_API_URL` in `frontend/.env.local`.

### Which files are needed?

Most files are small configuration or source modules, not separate applications. You normally edit only `App.jsx`, `SyllabusPaper.jsx`, `App.css`, the Express routes, and `PaperEngine.java`.

- `package.json` and `package-lock.json`: dependencies and repeatable installation; keep both in frontend and backend.
- `index.html`, `main.jsx`, `vite.config.js`: React + Vite startup.
- `schema.sql`, `init-db.js`: create/update the PostgreSQL table.
- Backend modules and routes: API, validation, Gemini and the Java bridge.
- Test files: verification; they are not required to run the app but are worth keeping.
- `.env.example`: safe configuration template; `.env` is your local secret file.
- `node_modules` and `dist`: generated folders; do not edit or upload them. `npm ci` and `npm run build` recreate them.

Unused starter assets and the extra stylesheet were removed to keep the structure smaller.

## Syllabus generation

Upload a PDF or UTF-8 TXT file, maximum 5 MB. Choose total marks, question count and difficulty percentages. Java allocates the selected or automatic marks pattern and rounds difficulty percentages to question counts using largest remainders. The returned total is exact. Generated questions include syllabus references and are not automatically added to the database.

Uploads are held in memory by this app. Groq receives extracted syllabus text; Gemini mode sends the document to Google. Provider data policies also apply. Review questions and references before use. Model availability, quota and billing depend on your account. The app rejects incomplete, duplicate or wrong-count output and reports unreadable documents and generation failures.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Database health |
| `GET /api/questions` | Filtered and paginated questions |
| `POST /api/questions` | Add a question |
| `POST /api/subjects` | Create a subject before adding questions (body: `{"name":"Computer Networks"}`) |
| `GET /api/questions/:id` | Read a question |
| `PUT /api/questions/:id` | Update a question |
| `DELETE /api/questions/:id` | Soft delete |
| `GET /api/questions/deleted` | Recycle bin |
| `POST /api/questions/undo` | Undo latest deletion |
| `POST /api/questions/:id/restore` | Restore a deleted question |
| `GET /api/stats` | Question bank statistics |
| `POST /api/generate/questions` | Random matching stored questions |
| `POST /api/papers/generate` | Java selects a paper from the bank |
| `POST /api/papers/from-syllabus` | Java plans slots; Gemini writes questions |

Syllabus request JSON: registered `subject`, `fileName`, `mimeType` (`application/pdf` or `text/plain`), `data` (base64 file content), `totalMarks`, `count`, optional `markCounts`, and `split` (`easy`, `medium`, `hard`, summing to 100).

## Checks

Run all database-independent Java and provider tests from `backend`:

```powershell
node --test test/javaCore.test.js test/syllabus.test.js test/marks.test.js test/groq.test.js
```

From `backend`, run `npm run test:core` for actual Java bridge and mocked Gemini tests. Run `npm test` for the full suite, using a dedicated PostgreSQL test database (`TEST_DATABASE_URL`); database tests clear their configured test table. From `frontend`, run `npm run lint` and `npm run build`.

Legacy requests without markCounts use the earlier algorithms. The standard marks workflow uses bounded exact selection; difficulty remains a target. Authentication and rate limits are needed before exposing the generation endpoint publicly.

## Registered-subject workflow

Create subjects in **Subjects → Add subject** before adding questions or generating papers. All other subject fields are dropdowns of registered subjects. New questions, edits and both paper-generation modes reject unregistered subjects at the API layer. Questions also have a subject foreign-key constraint. Existing subjects are migrated without deleting questions.

After updating, run `npm run db:init` in `backend`, then restart both servers. Subject is required for question creation, bank paper generation, random selection and syllabus requests; implicit GENERAL/all-subject generation is removed. The bank filter retains All subjects for browsing registered collections.

## Question counts by marks

Both paper sources accept counts of 2-, 5-, 10- and 16-mark questions. All four counts at 0 selects automatic allocation; otherwise 0 skips a category. Custom counts must sum to the total marks and at most 50 questions. Number of questions may be 0 for automatic, or an exact desired count. Java uses dynamic programming for automatic marks allocation and bounded selection from the bank. Impossible totals/counts or insufficient bank questions return a clear error. Difficulty remains a target, not a guarantee of the actual bank mix. Requests use `markCounts: {"2": 0, "5": 0, "10": 0, "16": 0}` and `count: 0`. Legacy requests without markCounts retain the earlier algorithm.

UI labels use plain text or SVG icons to prevent corrupted symbols. Update frontend/src/App.jsx, frontend/src/SyllabusPaper.jsx, backend/src/validation.js, backend/src/syllabusGenerator.js, backend/src/javaCore.js, backend/src/routes/generate.js and core/src/PaperEngine.java together, then restart both servers. No database migration is needed for this marks update.

### Example: a 50-mark paper

| Section | Marks per question | Number of questions | Subtotal |
|---|---:|---:|---:|
| A | 2 | 2 | 4 |
| B | 5 | 2 | 10 |
| C | 10 | 2 | 20 |
| D | 16 | 1 | 16 |
| **Total** | | **7** | **50** |

Leave Number of questions blank to derive 7 from these counts. With all four counts zero and no explicit count, automatic syllabus planning chooses the smallest feasible count using the standard mark values. Bank mode is additionally constrained by the stored question pool.

## Sections and optional question count

Leaving Number of questions blank (or 0) uses the sum of the four custom mark counts. With all four counts at 0, Java allocates the count automatically. Nonzero explicit question counts must still match a custom pattern. Preview, Print/PDF and TXT group questions by marks: Section A = 2 marks, B = 5, C = 10, D = 16. Empty sections are omitted and question numbering continues across sections. Count inputs use equal-width columns, with two columns on small screens. This update changes frontend/src/SyllabusPaper.jsx, frontend/src/App.css and README.md only. Restart the frontend; no database changes are required.

## View your stored database

In pgAdmin expand **Servers → your server → Databases → questionbank → Schemas → public → Tables**. Right-click `subjects` or `questions` and choose **View/Edit Data → All Rows**. Refresh Tables after initialising the database.

Read-only Query Tool examples:

```sql
SELECT * FROM subjects ORDER BY name;
SELECT * FROM questions WHERE NOT is_deleted ORDER BY id;
SELECT * FROM questions WHERE is_deleted ORDER BY deleted_at DESC;
```

Question IDs start at 101. Deleted questions remain in the database for restoration. Subjects are linked to questions through a foreign key; indexes support filters and reject duplicate active text within a subject and unit.

## Troubleshooting

| Symptom | Action |
|---|---|
| PostgreSQL password must be a string | Check that `backend/.env` exists, contains the correct `DATABASE_URL`, and restart the backend |
| Internal server error on health | Read the backend terminal; check the PostgreSQL service, credentials, database and schema |
| `ENOTEMPTY` while installing | Stop running app processes and pause OneDrive sync or move outside OneDrive before reinstalling |
| Missing `dotenv` or `cors` | Complete a successful dependency installation before starting |
| PowerShell blocks npm | Use `npm.cmd` instead of `npm` |
| Java unavailable | Check JDK installation, PATH and that `core` is beside `backend` |
| API key rejected | Check the selected provider's key and account access; restart after configuration changes |
| Model unavailable | Choose a model available to your account with the required output support |
| Rate limit reached | Wait for the provider's quota window to reset |
| Generation temporarily unavailable / 503 | Provider is busy; retry later. Reinstalling the project does not resolve provider overload |
| Groq cannot read a PDF | Use a text-based PDF or TXT; apply OCR to scanned pages first |
| Wrong or incomplete generated count | Try fewer questions or a clearer syllabus; inspect the backend error |
| Impossible marks pattern | Check the weighted sum and count; bank mode needs enough eligible questions |
| Frontend cannot connect | Keep the backend running; check health and `VITE_API_URL` |

The startup message only confirms that the HTTP server started. `/api/health` checks PostgreSQL; it does not test Java or an AI provider.

## Technology choices and limitations

| Choice | Justification |
|---|---|
| React | Reusable components and state for forms, filters, modals and previews |
| Vite | Fast development feedback and a straightforward production build |
| Node.js | Asynchronous HTTP, database and subprocess integration |
| Express | A small REST API with clear routes and middleware |
| PostgreSQL | Persistent relational data, foreign keys, constraints and indexes |
| Java | A dedicated, independently verifiable marks and selection engine |
| External AI API | Question generation without training or hosting an ML model |

There is no authentication, user permissions or saved paper history. Generated questions need academic review. Groq mode does not perform OCR. AI availability, cost and quota are external dependencies.

For an existing installation, keep your local `.env`, update backend source and package files together, run `npm.cmd ci`, and restart the backend. The Groq update does not require database changes. Do not upload `.env`, `node_modules` or `dist` to GitHub.
