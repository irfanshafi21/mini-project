# Examination Question Bank

A simple three-part application: **React + Vite** renders the interface, **Node.js + Express** exposes the API and calls Gemini, and **Java** runs the core paper algorithms. PostgreSQL stores the question bank.

## Simple interface

The interface has a question bank, subject collections, and a Create a Paper workspace. Add and edit questions by subject, unit, topic, subtopic, difficulty and marks. Search/filter the bank, browse pages, and undo a soft deletion. Create a paper by choosing **Your question bank** or **Upload a syllabus**, then configure the paper and review it before downloading TXT or printing/saving PDF.

### Adding subjects and questions

1. Open **Subjects â†’ Add subject**, enter a subject name, and select **Save subject**.
2. The new subject appears immediately with **0 questions**, even before you add any questions. Subject names are case-insensitive, and duplicate names are rejected.
3. Select a subject card to open its filtered question bank. Use **Add question** in the question bank and select/type that subject in the Subject field.
4. Saved subjects are also available in filters and the question-paper Subject selector. Deleting the last question does not delete the subject.

After pulling this update, run `npm run db:init` in `backend` once and restart the backend. This creates the `subjects` table and registers existing question subjects without deleting any question data.

The interface uses light blue and warm cream colors. It has no login, registration or user profile. Unused starter images/icons were removed, and frontend styles are in one `App.css` file.

After updating an existing installation, run `npm run db:init` in `backend` once. This adds the subject column and subject-aware duplicate index without deleting question rows. Existing questions are assigned to **General**; edit them to set their subjects. Generated syllabus questions are not automatically stored.

## File structure

```text
mini-project/
â”œâ”€â”€ README.md
â”œâ”€â”€ .gitignore
â”œâ”€â”€ core/
â”‚   â””â”€â”€ src/
â”‚       â””â”€â”€ PaperEngine.java       # Core marks, difficulty allocation and question selection
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ .env.example
â”‚   â”œâ”€â”€ package.json
â”‚   â”œâ”€â”€ package-lock.json
â”‚   â”œâ”€â”€ requests.http             # API examples
â”‚   â”œâ”€â”€ scripts/init-db.js
â”‚   â”œâ”€â”€ sql/schema.sql
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ app.js                 # Express application
â”‚   â”‚   â”œâ”€â”€ server.js              # HTTP startup
â”‚   â”‚   â”œâ”€â”€ db.js                  # PostgreSQL connection
â”‚   â”‚   â”œâ”€â”€ javaCore.js            # Node â†’ Java bridge
â”‚   â”‚   â”œâ”€â”€ syllabusGenerator.js   # Syllabus validation and Gemini integration
â”‚   â”‚   â”œâ”€â”€ validation.js
â”‚   â”‚   â”œâ”€â”€ mapper.js
â”‚   â”‚   â”œâ”€â”€ errors.js
â”‚   â”‚   â””â”€â”€ routes/
â”‚   â”‚       â”œâ”€â”€ questions.js
â”‚   â”‚       â”œâ”€â”€ subjects.js        # Create standalone subjects
â”‚   â”‚       â”œâ”€â”€ stats.js
â”‚   â”‚       â”œâ”€â”€ generate.js
â”‚   â”‚       â””â”€â”€ syllabus.js
â”‚   â””â”€â”€ test/
â”‚       â”œâ”€â”€ api.test.js
â”‚       â”œâ”€â”€ javaCore.test.js
â”‚       â””â”€â”€ syllabus.test.js
â””â”€â”€ frontend/
    â”œâ”€â”€ .env.example
    â”œâ”€â”€ package.json
    â”œâ”€â”€ package-lock.json
    â”œâ”€â”€ index.html
    â”œâ”€â”€ vite.config.js
    â”œâ”€â”€ eslint.config.js
    â”œâ”€â”€ public/
    â””â”€â”€ src/
        â”œâ”€â”€ main.jsx
        â”œâ”€â”€ App.jsx                # Question bank and stored-paper interface
        â”œâ”€â”€ SyllabusPaper.jsx      # Syllabus upload, generated preview and download
        â”œâ”€â”€ App.css
```

## How it works

- **Stored question paper:** React â†’ Express â†’ PostgreSQL question pool â†’ Java selection â†’ React preview.
- **Syllabus paper:** React uploads PDF/TXT â†’ Express â†’ Java calculates exact question slots â†’ Gemini writes questions for those slots â†’ Express validates the result â†’ React preview/TXT download.
- Java owns the total-marks and difficulty algorithms. Node owns HTTP, database access, input validation and external API integration. Gemini supplies question content; there is no locally trained ML model.
- Java runs as a subprocess using JDK source-file launch. No Maven, Java server or extra port is needed. Keep `core/` next to `backend/` when deploying. Source-file launch recompiles on each request, which is appropriate for this small project.

## Run locally

### Open in VS Code on Windows

1. Download/clone this repository, then use **File â†’ Open Folder** in VS Code and open the **mini-project** folder (the folder containing `frontend`, `backend`, `core` and this README). You do not need to open every file separately.
2. Install Node.js 22.12 or newer, JDK 17 or newer, and PostgreSQL. Open **Terminal â†’ New Terminal** and check:
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
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   GEMINI_MODEL=gemini-3.8-flash
   ```
   Replace the password and API key placeholders with your own values. URL-encode special characters in the database password. The key stays in this local ignored file. A Gemini key is needed only for syllabus generation.
5. **Terminal 1 â€” backend:**
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

Upload a PDF or UTF-8 TXT file, maximum 5 MB. Choose total marks, question count and difficulty percentages. Java distributes marks evenly and rounds difficulty percentages to question counts using largest remainders. The returned total is exact. Generated questions include syllabus references and are not automatically added to the database.

Documents are sent to Google Gemini and held in memory by this app. Review the generated questions and references before use. Gemini model availability, quota and billing depend on your account; `GEMINI_MODEL` is configurable. The app reports unreadable documents, incomplete/duplicate output, unavailable Java, and Gemini failures.

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

Syllabus request JSON: `fileName`, `mimeType` (`application/pdf` or `text/plain`), `data` (base64 file content), `totalMarks`, `count`, and `split` (`easy`, `medium`, `hard`, summing to 100).

## Checks

From `backend`, run `npm run test:core` for actual Java bridge and mocked Gemini tests. Run `npm test` for the full suite, using a dedicated PostgreSQL test database (`TEST_DATABASE_URL`); database tests clear their configured test table. From `frontend`, run `npm run lint` and `npm run build`.

The stored-question algorithm is greedy and may miss an achievable marks total or deviate from the difficulty target. Authentication and rate limits are needed before exposing the paid Gemini endpoint publicly.

## Registered-subject workflow

Create subjects in **Subjects → Add subject** before adding questions or generating papers. All other subject fields are dropdowns of registered subjects. New questions, edits and both paper-generation modes reject unregistered subjects at the API layer. Questions also have a subject foreign-key constraint. Existing subjects are migrated without deleting questions.

After updating, run `npm run db:init` in `backend`, then restart both servers. Subject is required for question creation, bank paper generation, random selection and syllabus requests; implicit GENERAL/all-subject generation is removed. The bank filter retains All subjects for browsing registered collections.
