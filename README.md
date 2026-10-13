# Examination Question Bank

A simple three-part application: **React + Vite** renders the interface, **Node.js + Express** exposes the API and calls Gemini, and **Java** runs the core paper algorithms. PostgreSQL stores the question bank.

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
│   │   ├── syllabusGenerator.js   # Syllabus validation and Gemini integration
│   │   ├── validation.js
│   │   ├── mapper.js
│   │   ├── errors.js
│   │   └── routes/
│   │       ├── questions.js
│   │       ├── stats.js
│   │       ├── generate.js
│   │       └── syllabus.js
│   └── test/
│       ├── api.test.js
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
        ├── index.css
        └── assets/
```

## How it works

- **Stored question paper:** React → Express → PostgreSQL question pool → Java selection → React preview.
- **Syllabus paper:** React uploads PDF/TXT → Express → Java calculates exact question slots → Gemini writes questions for those slots → Express validates the result → React preview/TXT download.
- Java owns the total-marks and difficulty algorithms. Node owns HTTP, database access, input validation and external API integration. Gemini supplies question content; there is no locally trained ML model.
- Java runs as a subprocess using JDK source-file launch. No Maven, Java server or extra port is needed. Keep `core/` next to `backend/` when deploying. Source-file launch recompiles on each request, which is appropriate for this small project.

## Run locally

Install **Node.js 22.12+**, **JDK 17+** (`java -version` must work), and **PostgreSQL**.

1. Create the database:
   ```sql
   CREATE DATABASE questionbank;
   CREATE DATABASE questionbank_test;
   ```
2. Copy `backend/.env.example` to `backend/.env`. Set `DATABASE_URL` and `GEMINI_API_KEY`. Never put the key in React or Git.
3. Start the API:
   ```sh
   cd backend
   npm ci
   npm run db:init
   npm start
   ```
4. In another terminal, start React:
   ```sh
   cd frontend
   npm ci
   npm run dev
   ```
5. Open the URL Vite prints. To change the API address, copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_URL`.

`JAVA_COMMAND` can optionally point to a Java executable if it is not on PATH. The syllabus API does not need PostgreSQL; the existing bank features do.

## Syllabus generation

Upload a PDF or UTF-8 TXT file, maximum 5 MB. Choose total marks, question count and difficulty percentages. Java distributes marks evenly and rounds difficulty percentages to question counts using largest remainders. The returned total is exact. Generated questions include syllabus references and are not automatically added to the database.

Documents are sent to Google Gemini and held in memory by this app. Review the generated questions and references before use. Gemini model availability, quota and billing depend on your account; `GEMINI_MODEL` is configurable. The app reports unreadable documents, incomplete/duplicate output, unavailable Java, and Gemini failures.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Database health |
| `GET /api/questions` | Filtered and paginated questions |
| `POST /api/questions` | Add a question |
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
