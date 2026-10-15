<div align="center">

<img src="docs/images/banner.png" alt="Question Bank — syllabus to structured examination papers" width="100%" />

# 📘 Question Bank & Paper Generator

### From a syllabus to a structured examination paper

Register subjects, build your question library, and create papers with a clear marks pattern.

![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=flat-square&logo=react&logoColor=222222)
![Vite](https://img.shields.io/badge/Vite-Development-646CFF?style=flat-square&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-REST_API-353535?style=flat-square&logo=express&logoColor=white)
![Java](https://img.shields.io/badge/Java-Paper_Engine-E58B35?style=flat-square)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=flat-square&logo=postgresql&logoColor=white)

**Light blue interface · Warm accents · Subject-based collections · PDF / TXT export**

[Screenshots](#a-look-inside) · [Walkthrough](#visual-walkthrough) · [Features](#features) · [Workflow](#workflow) · [Architecture](#architecture) · [Setup](#local-setup) · [Paper rules](#paper-rules) · [Troubleshooting](#troubleshooting)

</div>

---

> [!TIP]
> **Already installed?** Keep PostgreSQL running. Start `npm.cmd start` in `backend` and `npm.cmd run dev` in `frontend`. Open the Local URL printed by Vite.

## A look inside

Real screenshots from the running application. The sample collection contains a Computer Organisation question generated from a syllabus.

<table>
<tr>
<td width="50%" valign="top">
<h3>📚 Question library</h3>
<p>Search, filter and manage questions by subject, unit and difficulty.</p>
<img src="docs/images/question-bank.jpg" alt="Question bank with a saved Computer Organisation question, statistics and filters" width="100%" />
</td>
<td width="50%" valign="top">
<h3>🗂️ Subject overview</h3>
<p>See your collection totals, marks breakdown and generated-paper count.</p>
<img src="docs/images/subject-overview.jpg" alt="Subject overview with stored question totals and counts for each mark value" width="100%" />
</td>
</tr>
</table>

## Visual walkthrough

<table>
<tr>
<td width="33%" align="center"><h3>01 · Organise</h3><p>Register a subject and build its question collection.</p></td>
<td width="34%" align="center"><h3>02 · Configure</h3><p>Choose your source, marks pattern and difficulty mix.</p></td>
<td width="33%" align="center"><h3>03 · Review</h3><p>Check the paper, then print or download it.</p></td>
</tr>
</table>

### A marks pattern you can see

The builder shows live question counts, Section A–D labels and subtotals. This screenshot uses **2 + 2 + 2 + 1 = 7 questions**, totalling **50 marks**.

<details>
<summary><strong>Open the paper-builder screenshot</strong></summary>

<img src="docs/images/paper-builder.jpg" alt="Syllabus paper builder configured for seven questions totalling fifty marks" width="720" />

</details>

### From collection to examination paper

The following is a real **2-mark bank paper** produced from the saved sample question. Larger papers use the same section layout.

<p align="center">
<img src="docs/images/paper-preview.jpg" alt="Real Computer Organisation paper preview with Section A and a two-mark question" width="520" />
</p>

> [!TIP]
> **Try the full flow:** register a subject → upload a syllabus → choose the destination unit → generate → choose Yes in the save popup → open the question bank. Choose No to keep a preview without saving questions.

---

## Features

| Workspace | Available features |
| :--- | :--- |
| **Subjects** | Register subjects and view stored-question totals, counts by marks, and paper-generation totals |
| **Question bank** | Add, edit, search, filter and paginate questions; soft-delete and restore |
| **Paper sources** | Select existing questions or upload a syllabus to generate new questions |
| **Marks pattern** | Set counts for 2-, 5-, 10- and 16-mark questions, with a live question total and marks subtotal |
| **Difficulty mix** | Configure easy, medium and hard percentages |
| **Save confirmation** | Choose Yes or No after syllabus generation before adding questions to the bank |
| **Paper preview** | Group questions into Sections A–D and review the final paper |
| **Exports** | Download TXT or use the browser's Print / PDF option |

The website has no login or user profile. Subject registration means adding an academic subject, not creating a user account. AI generation uses an external API; this project does not train a local ML model.

## Workflow

```mermaid
flowchart LR
    A[Register a subject] --> B{Choose paper source}
    B --> C[Saved question bank]
    B --> D[Upload syllabus]
    C --> E[Set marks and difficulty]
    D --> E
    E --> F[Generate paper]
    F --> G[Review sections]
    G --> H[Print / PDF or TXT]
```

### 1. Register and organise

Open **Subjects → Add subject**, enter the name, and save. The subject appears immediately with zero questions. Names are normalised, duplicate subjects are rejected, and other subject fields use dropdowns.

Click a subject to see its overview. **View question bank** opens that subject's filtered collection. Deleting the last question does not delete the subject.

### 2. Choose your source

| Your question bank | Upload a syllabus |
| :--- | :--- |
| Select a registered subject | Select a registered subject and destination unit |
| Optionally filter by unit and topic | Upload a PDF or UTF-8 TXT syllabus |
| Java selects eligible stored questions | Java plans the slots; an AI provider writes the questions |
| Existing entries are reused | New questions are saved only after confirmation |

### 3. Configure, review and export

Enter total marks, set question counts by marks, and choose the difficulty mix. Generate the paper, review its content, then select **Download TXT** or **Print / PDF**.

> [!NOTE]
> After generating a syllabus paper, a popup asks whether to add its questions to the bank. Yes saves to the selected subject and unit; No keeps the preview without inserting questions. Existing active text in that same subject and unit is skipped. The original uploaded file is not stored. Review the saved questions for academic correctness.

## Architecture

```mermaid
flowchart TD
    UI[React interface] -->|HTTP JSON| API[Node.js + Express]
    API -->|Read subjects and questions| DB[(PostgreSQL)]
    API -->|Plan slots or select questions| JAVA[Java PaperEngine]
    API --> FILE[Validate PDF / TXT upload]
    FILE --> PROVIDER[Groq extracted text / Gemini document]
    JAVA --> VALIDATE[Validate generated count and content]
    PROVIDER --> VALIDATE
    VALIDATE --> CHOICE{Save questions?}
    CHOICE -->|Yes - insert questions| DB
    CHOICE -->|No - preview only| PREVIEW
    JAVA --> PREVIEW[Sectioned paper preview]
    VALIDATE --> PREVIEW
    PREVIEW --> EXPORT[Print / PDF and TXT]
```

**Bank paper:** React → Express → PostgreSQL pool → Java selection → preview.

**Syllabus paper:** React → registered-subject check → Java slots → upload processing → provider generation → output validation → database save → preview.

The frontend calls `VITE_API_URL`, normally `http://localhost:4000/api`. Express owns HTTP, database access, validation and provider integration. Java owns marks planning and question selection, using JDK source-file launch as a subprocess. Keep `core` beside `backend`; there is no separate Java server or Maven requirement.

### Technology choices

| Choice | Justification |
|---|---|
| React | Reusable components and state for forms, filters, modals and previews |
| Vite | Fast development feedback and a straightforward production build |
| Node.js | Asynchronous HTTP, database and subprocess integration |
| Express | A small REST API with clear routes and middleware |
| PostgreSQL | Persistent relational data, foreign keys, constraints and indexes |
| Java | A dedicated, independently verifiable marks and selection engine |
| External AI API | Question generation without training or hosting an ML model |

---

## Local setup

### Prerequisites

| Tool | Requirement | Official download |
| :--- | :--- | :--- |
| Node.js | 22.13 or newer supported LTS | [Node.js](https://nodejs.org/en/download) |
| Java | JDK 17 or newer | [Adoptium](https://adoptium.net/temurin/releases/) |
| PostgreSQL | Running local server; pgAdmin is useful | [PostgreSQL](https://www.postgresql.org/download/windows/) |
| VS Code | Editor with integrated terminals | [VS Code](https://code.visualstudio.com/download) |
| Git | Optional when downloading a ZIP | [Git](https://git-scm.com/downloads) |

PostgreSQL's optional Stack Builder extensions are not needed. Remember the database password and port chosen during installation. Reopen VS Code after installing tools so PATH updates take effect.

### Step 1 — Get the project

Download this repository's ZIP, extract it, and open the folder containing `backend`, `frontend`, `core` and `README.md` in VS Code. Alternatively:

```powershell
git clone https://github.com/irfanshafi21/mini-project.git
cd mini-project
```

Check the installations in a terminal:

```powershell
node --version
npm.cmd --version
java -version
```

### Step 2 — Create the database

In pgAdmin connect to your local PostgreSQL server. Right-click **Databases → Create → Database**, name it `questionbank`, and save. Alternatively, open Query Tool on `postgres` and run once:

```sql
CREATE DATABASE questionbank;
```

Skip this if the database already exists. Tables are created by `db:init` below.

### Step 3 — Configure the backend

From the project root:

```powershell
Copy-Item backend/.env.example backend/.env
```

Edit **backend/.env**:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/questionbank
PORT=4000
AI_PROVIDER=groq
GROQ_API_KEY=YOUR_GROQ_API_KEY
GROQ_MODEL=openai/gpt-oss-20b
```

Replace both placeholders with your own credentials. URL-encode special characters in the database password. The exact filename is `.env`, directly inside `backend`.

Get your key from the [Groq Console](https://console.groq.com/keys). Select an account-available model supporting [strict structured outputs](https://console.groq.com/docs/structured-outputs). The documented model is configurable; provider availability and quota depend on your account.

> [!IMPORTANT]
> Keep the actual API key and database password in local `.env` only. Never upload `.env` to GitHub or put API keys in frontend variables.

<details>
<summary><strong>Optional: use Gemini instead of Groq</strong></summary>

Set `AI_PROVIDER=gemini`, `GEMINI_API_KEY` and `GEMINI_MODEL` in the backend configuration. Choose a model available to your account. Gemini can receive the PDF directly; Groq receives extracted text. Keys are not interchangeable and there is no automatic provider fallback.

</details>

### Step 4 — Start the backend

In Terminal 1, from the project root:

```powershell
cd backend
npm.cmd ci
npm.cmd run db:init
npm.cmd start
```

Keep this terminal open. Visit [localhost:4000/api/health](http://localhost:4000/api/health). Expected response:

```json
{ "status": "ok" }
```

The startup message confirms the HTTP server started. Health checks PostgreSQL, not Java or an AI provider. `db:init` creates tables and applies the included migrations while preserving existing questions.

### Step 5 — Start the frontend

Open Terminal 2 at the project root:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open the Local URL Vite prints, normally [localhost:5173](http://localhost:5173). If that port is occupied, use the next printed port. Do not launch `index.html` directly or use Live Server.

<details>
<summary><strong>Using a different backend address</strong></summary>

Create `frontend/.env.local` and set:

```dotenv
VITE_API_URL=http://localhost:4000/api
```

Change it to match your backend's host and port. Restart Vite after changing frontend configuration and restart Express after changing backend `.env`.

</details>

### Starting again later

Keep PostgreSQL running. Start these in separate terminals:

| Backend folder | Frontend folder |
| :--- | :--- |
| `npm.cmd start` | `npm.cmd run dev` |

Press **Ctrl+C** to stop each server. Run `npm.cmd ci` after dependency changes and `npm.cmd run db:init` after schema updates.

## Paper rules

### Live question counts

**Number of questions** starts at **0** and is read-only. It updates immediately from the four mark counts: 2 two-mark questions show 2; adding 2 five-mark questions shows 4. Each mark card shows its section and subtotal.

| Section | Marks per question | Example count | Subtotal |
| :--- | ---: | ---: | ---: |
| A | 2 | 2 | 4 |
| B | 5 | 2 | 10 |
| C | 10 | 2 | 20 |
| D | 16 | 1 | 16 |
| **Total** | | **7 questions** | **50 marks** |

- With a custom pattern, `0` skips that mark category.
- All four counts at `0` request automatic allocation.
- Custom subtotals must equal Total marks. The limit is 50 questions and 1,000 marks.
- Automatic syllabus planning uses 2, 5, 10 and 16 marks. Without an explicit API count it chooses the smallest feasible question count.
- Bank mode needs enough eligible stored questions and never repeats an entry within one paper.
- Empty sections are omitted. Question numbering continues across sections in preview, print and TXT.

Legacy API requests omitting `markCounts` retain the earlier algorithms. Existing questions with other mark values can still be browsed and appear in legacy papers.

### Difficulty mix

Easy, medium and hard percentages must sum to **100**. Syllabus planning applies them to question counts, rounded using largest remainders. Bank selection treats difficulty as a target constrained by available questions and marks.

### Uploads and save confirmation

PDF or UTF-8 TXT uploads must be non-empty and no larger than **5 MB**. Groq extracts PDF text locally, limits the text to 100,000 characters, and rejects unreadable or scanned image-only PDFs. Apply OCR first or upload TXT. Extracted text is sent to Groq; Gemini mode sends the document to Google. Provider data policies also apply.

After generating a syllabus paper, choose **Yes, add to question bank** or **No, preview only** in the popup. Generation itself does not insert questions. Yes sends the validated questions to the separate save API and inserts them under the selected subject and unit (1–5). No sends no save request. The API defaults the generation destination unit to 1 when omitted. Topic labels are normalised and limited to 60 characters. Existing active text in the same subject and unit is skipped, so retrying a save does not create duplicates. The batch insert is atomic. Generation counters count successful papers regardless of the save choice and are separate from actual stored-question totals.

The save notice reports new entries and existing duplicates. The bank and subject totals refresh automatically. Syllabus references remain in the paper preview/TXT; the bank stores text, subject, unit, topic, subtopic, difficulty and marks. The uploaded file and full generated paper are not stored. Previous generations are not backfilled.

## Subjects and database

Click a subject card for its stored-question total, 2/5/10/16-mark breakdown, generated-question total and paper count. Other stored mark values are reported separately.

Generation totals count question appearances across successful complete papers, including bank selections and syllabus generations. Reusing a question in a later paper counts again. Failed or incomplete generations do not increment counters. Tracking starts from the counter update; earlier activity cannot be reconstructed. The separate activity panel is hidden.

| Table | Stored information |
| :--- | :--- |
| `subjects` | Registered names, creation timestamp and generation counters |
| `questions` | Question ID, subject, unit, topic, subtopic, text, difficulty, marks, deletion state and timestamps |

IDs begin at 101. Deletion is soft deletion so questions can be restored. A foreign key enforces registered subjects. Indexes support filters and prevent duplicate active text within a subject and unit.

### Inspect data in pgAdmin

Expand **Servers → your server → Databases → questionbank → Schemas → public → Tables**. Right-click a table and select **View/Edit Data → All Rows**. Refresh Tables after initialising the database.

```sql
SELECT * FROM subjects ORDER BY name;
SELECT * FROM questions WHERE NOT is_deleted ORDER BY id;
SELECT * FROM questions WHERE is_deleted ORDER BY deleted_at DESC;
```

## Project structure

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


Keep manifests, lockfiles and startup configuration. `node_modules` and `dist` are generated folders; do not edit or upload them.

## API reference

Base address: `http://localhost:4000/api`.

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/health` | PostgreSQL health |
| GET | `/stats` | Bank statistics and registered-subject counts |
| POST | `/subjects` | Register a subject |
| GET | `/subjects/:name/overview` | Subject totals, marks counts and generation counters |
| GET | `/questions` | Filtered, searchable, paginated bank |
| POST | `/questions` | Add a question |
| GET | `/questions/:id` | Read a question |
| PUT | `/questions/:id` | Edit a question |
| DELETE | `/questions/:id` | Soft-delete a question |
| GET | `/questions/deleted` | Deleted-question list |
| POST | `/questions/undo` | Undo latest deletion |
| POST | `/questions/:id/restore` | Restore a question |
| POST | `/generate/questions` | Select matching stored questions |
| POST | `/papers/generate` | Generate a bank paper through Java |
| POST | `/papers/from-syllabus` | Generate and validate a syllabus preview |
| POST | `/papers/save-syllabus` | Insert generated questions after confirmation |

<details>
<summary><strong>Example paper pattern</strong></summary>

```json
{
  "subject": "COMPUTER_ORGANISATION",
  "unit": 1,
  "totalMarks": 50,
  "count": 7,
  "markCounts": { "2": 2, "5": 2, "10": 2, "16": 1 },
  "split": { "easy": 40, "medium": 40, "hard": 20 }
}
```

For syllabus requests also send `fileName`, `mimeType` (`application/pdf` or `text/plain`) and base64 `data`. `count: 0` lets Java derive the count. Generation returns `savedUnit`. To save after confirmation, POST `subject`, `unit` and the generated `questions` array to `/papers/save-syllabus`; its response includes `savedToBank`, `alreadyInBank` and `savedUnit`. See `backend/requests.http` for other examples.

</details>

## Validation and tests

The project validates requests, registered subjects, file metadata, marks patterns, generated question counts and duplicate output. Tests exercise Java and mock provider responses; they do not require a real AI key.

**Backend — database-independent tests:**

```powershell
node --test test/javaCore.test.js test/syllabus.test.js test/marks.test.js test/groq.test.js
```

**Frontend:**

```powershell
npm.cmd run lint
npm.cmd run build
```

<details>
<summary><strong>Full API tests with a dedicated PostgreSQL database</strong></summary>

Create `questionbank_test`, set `TEST_DATABASE_URL` to that database in your environment, then run `npm.cmd test` inside `backend`.

```sql
CREATE DATABASE questionbank_test;
```

Database tests clear their configured tables. Never point `TEST_DATABASE_URL` at your working question bank. API tests include persistence, unit selection, duplicate skipping and generation tracking. A live provider check additionally requires a valid key and available quota.

</details>

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


## Updating your installation

1. Pull the latest changes or replace the source files from this repository.
2. Keep your local `.env` and its credentials.
3. Run `npm.cmd ci` in a changed frontend/backend package when dependencies change.
4. Run `npm.cmd run db:init` in `backend` when the schema changes.
5. Restart both servers and refresh the browser.

The save-confirmation update needs backend/frontend source changes but no additional database migration. Subject-generation counters require the schema migration included in `db:init`.

## Current scope

The project has no authentication, user permissions or saved paper history. Groq mode does not perform OCR. AI availability, quota and cost are external dependencies. Review generated questions before academic use. Add authentication and request limits before exposing the generation endpoint publicly.

---

<div align="center">

**Organise by subject. Build a balanced paper. Review before sharing.**

[Your repository](https://github.com/irfanshafi21/mini-project) · [Original repository](https://github.com/naveen7655/mini-project) · [Back to top](#-question-bank--paper-generator)

</div>
