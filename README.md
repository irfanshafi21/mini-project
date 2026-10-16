<div align="center">

<img src="docs/images/banner.png" alt="Question bank and examination paper generator" width="100%" />

# Question Bank & Paper Generator

### Organise questions. Build balanced papers. Keep everything local.

A college examination workspace built with **React + Vite**, **Node.js + Express**, **Java**, **PostgreSQL**, and our own **trained ML classifiers**.

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-Backend-43853d?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql&logoColor=white)
![ML](https://img.shields.io/badge/ML-Trained_locally-2b7884)

[Features](#what-you-can-do) · [Screenshots](#a-look-inside) · [Run locally](#run-on-your-laptop) · [Our model](#how-our-own-model-works) · [College hosting](#moving-to-the-college-server)

</div>

> **Current generation is fully local:** no hosted AI provider, external AI key, Ollama installation, or pretrained language-model download is needed. The project uses trained classifiers, authored task grammars, checked objective facts, and numerical problem generators. It is not a neural LLM trained from scratch.

## What you can do

| Workspace | Purpose |
| --- | --- |
| **Question bank** | Add, search, edit, soft-delete and restore questions; filter by subject, unit, difficulty, marks and K level where available. |
| **Subjects** | Register subjects explicitly, browse their questions and view question counts. Each registered subject has its own PostgreSQL partition. |
| **Choose questions yourself** | Select the exact bank questions to include in a paper. |
| **Generate from question bank** | Select saved questions automatically using marks, units, difficulty and Bloom allocation. |
| **Upload a syllabus** | Upload a readable PDF or TXT file and generate new questions locally. |
| **Stored papers** | Retrieve saved paper snapshots, edit their contents and download them again. |
| **Exports** | Download a PDF or TXT paper, or print from the browser. Student exports omit teacher answer fields. |

The interface combines light blue and warm neutral colours with an academic layout: a dedicated desktop sidebar, clear page headings, consistent cards and controls, and compact mobile navigation. The paper studio includes aligned mark fields, six K-level controls and live count summaries. No application login is included.

## A look inside

<table>
<tr><td><strong>Academic workspace</strong><br/><img src="docs/images/academic-dashboard.png" alt="Academic question-bank dashboard with desktop sidebar and paper creation panel" width="100%" /></td></tr>
<tr><td><strong>Marks and Bloom allocation</strong><br/><img src="docs/images/local-bloom-builder.png" alt="Aligned mark counts and K1 to K6 allocations" width="100%" /></td></tr>
</table>

Screenshots illustrate the interface; stored data and totals vary by installation.

## Everyday workflow

```mermaid
flowchart TD
  A[Open the application] --> B{Choose a source}
  B --> C[Select bank questions manually]
  B --> D[Automatic bank selection]
  B --> E[Upload syllabus PDF or TXT]
  D --> F[Set marks, units, difficulty and K counts]
  E --> G[Extract topic and unit text locally]
  G --> H[Our trained classifiers and constrained generator]
  F --> I[Validate and assemble paper]
  H --> I
  C --> I
  I --> J[Save paper snapshot automatically]
  J --> K[Review or edit paper]
  K --> L[Download PDF, TXT or print]
  K --> M[Optional Add to question bank button]
  J --> N[Local checks and classifier retraining]
```

Subjects are created **only** through **Subjects → Add subject**. Choosing an unassigned syllabus paper does not create a subject. Before adding its questions to the bank, select an existing destination subject.

## Marks, question counts and sections

- Supported question values: **1, 2, 5, 10 and 16 marks**.
- Enter the quantity required for each mark value. An unused category stays at **0**.
- The question total updates live: two 2-mark questions and two 5-mark questions produce **4 questions**, worth **14 marks**.
- The selected questions must equal the entered total marks. Papers support at most **50 questions** and **1,000 marks**.
- With all category counts at zero, Java attempts an automatic denomination plan.
- The final paper groups the selected mark values into consecutive sections, starting with **Section A**.
- One-mark questions support **multiple choice** or **fill in the blanks**. Checked MCQs have four distinct options and one recorded correct answer.

## College Bloom mapping

| Level | Cognitive task | Example opening words from the college chart |
| --- | --- | --- |
| **K1 — Remember** | Recall facts, definitions or terminology | Define, List, Name, Recall |
| **K2 — Understand** | Explain meaning or illustrate understanding | Explain, Summarize, Illustrate, Outline |
| **K3 — Apply** | Apply a method to an example or supplied data | Apply, Solve, Construct, Utilize |
| **K4 — Analyze** | Examine causes, components or relationships | Analyze, Examine, Distinguish, Inspect |
| **K5 — Evaluate** | Judge against criteria and justify a decision | Evaluate, Assess, Judge, Justify |
| **K6 — Create** | Produce a design, adaptation or original proposal | Design, Create, Develop, Propose |

The full college word lists are in [bloom-verbs.json](backend/ml/bloom-verbs.json). A requested K level must use an allowed opening word. The task grammar also changes its cognitive demand; merely replacing the first verb would be insufficient.

For every nonzero mark count, distribute that count across **K1–K6**. For example, **10 two-mark questions** can contain **2 K1 + 5 K2 + 3 K3 = 10**. An allocation of 2 + 5 + 4 totals 11 and is rejected.

K level and difficulty are separate requirements. Bank selection satisfies both independently and reports a shortfall instead of silently substituting another level. Unsupported combinations, such as one-mark K6 questions without suitable bank content, can be rejected. Local objective generation covers curated recall facts and supported numerical application tasks; it does not fabricate higher-level MCQ answers.

## How our own model works

### 1. Extract the syllabus

The backend reads text from a PDF or TXT file, removes common headings and page formatting, and extracts topics with Unit 1–5 or Roman-numeral unit headings. Scanned image PDFs need OCR before upload. The file limit is **5 MB**, and extracted text must contain 30–100,000 characters.

### 2. Classify topics with trained ML

Our multinomial Naive Bayes topic model learns four classes: **concept**, **process**, **comparison** and **numerical**. Its features include words, character trigrams and optional bigrams. Python trains the weights; JavaScript loads the saved probabilities and performs inference locally.

A separate six-class Naive Bayes model learns **K1–K6** from complete question wording. It uses word and bigram context because opening verbs can overlap between Bloom levels.

### 3. Generate within controlled question patterns

Java plans marks and difficulty slots. The generator combines extracted syllabus topics with authored, mark-bounded tasks. For explicit K allocations, it uses the corresponding cognitive task grammar and ranks candidates using the trained Bloom classifier. Checked fact collections supply objective questions; supported numerical factories generate inputs, correct answers and variations.

A two-mark question asks a focused task. Longer questions request appropriately expanded reasoning, examples or designs. Some general application tasks explicitly ask the student to supply a small example; they are not solved numerical questions with hidden inputs.

**What is learned:** topic and cognitive-task classification probabilities. **What is authored:** question grammars, mathematical factories and objective fact records. The system does not learn unrestricted subject knowledge simply by generating a paper.

### 4. Control repetition

History is scoped to the subject and normalised syllabus fingerprint. Generation prefers unused text and checks known normalised question patterns. At most **20%** historical repeats are permitted, rounded down; papers with fewer than five questions allow zero. Supported numerical variants change their values, while still counting as the same underlying pattern.

The candidate pool is finite. If it cannot satisfy the requested marks/K counts within the repeat budget, generation returns a clear shortfall. This is not a universal semantic-paraphrase detector. Deliberate manual reuse of bank questions is allowed.

### 5. Retrain locally

New saved papers enter a database-backed learning queue. Local validation and agreement with the Bloom classifier determine which locally generated examples are eligible for self-training. Faculty-labelled examples remain supported. Historical cloud-labelled records are excluded from new local training and candidate retrieval.

The Python trainer excludes held-out records and conflicting labels, evaluates the candidate, and activates it only when the configured benchmark checks do not regress. Training reports are saved in PostgreSQL; active weights are stored under ignored `backend/.runtime/`. Temporary per-run training files are removed after use.

**Self-training labels are not independent ground truth.** Agreement and structural checks do not prove factual accuracy or automatically guarantee improvement. Faculty-reviewed data and independently reviewed papers are needed to measure educational quality.

## Evaluation: what the numbers mean

The bundled classifier was rebuilt locally from **176 curated topic training examples**:

| Check | Result | Interpretation |
| --- | --- | --- |
| Original frozen topic holdout | **13/16 — 81.25%** | Small synthetic topic classification test |
| Expanded topic benchmark | **47/48 — 97.92%** | Separate synthetic topic benchmark |
| Bloom task holdout | **24/24 — 100%** | Small synthetic test with shared wording templates |

These are **classification scores**, not percentages of correct generated exam questions. The Bloom result particularly benefits from repeated wording structures. They do not establish real-college question quality, factual correctness, difficulty accuracy or a deployment guarantee. Runtime results can change after retraining. See [evaluation.json](backend/ml/evaluation.json) and [the model card](backend/ml/MODEL_CARD.md).

## Where the data is stored

| Data | Storage | When it is saved |
| --- | --- | --- |
| Registered subjects | `subjects` | Add subject action |
| Reusable bank questions | `questions` and subject partitions | Manual question entry or **Add to question bank** |
| Complete generated papers | `saved_papers.paper` JSON | Automatically after a successful paper |
| Repetition history | `syllabus_history` | Syllabus generation |
| Training examples | `reviewed_examples` | Eligible local checks or faculty labels |
| Learning queue and results | `automatic_learning_jobs`, `model_training_runs` | Background local training |

Saving a paper does **not** automatically add its questions to the reusable bank. Use the post-generation **Add to question bank** button; there is no save-confirmation popup. Training records and generated-question counters are also distinct from bank question rows.

A subject gets a safe, generated PostgreSQL **LIST partition** beneath the shared `questions` parent. Queries against the parent retrieve all subjects. The `subject_storage` view shows partition names. Editing a saved paper changes its snapshot, not the original bank question.

## Run on your laptop

### Prerequisites

| Software | Requirement |
| --- | --- |
| Node.js and npm | Node 22.12+ or a version compatible with the installed Vite package |
| PostgreSQL | 15+; keep its database service running |
| Java JDK | 17+; `java` must be available in the terminal |
| Python | Python 3; standard library only for classifier training |
| VS Code | Convenient editor and terminals |

**No external AI key or model download is required.** PostgreSQL Stack Builder add-ons are optional for this project.

### 1. Create the database

Open pgAdmin, connect to the PostgreSQL server, right-click **Databases → Create → Database**, and create **questionbank**.

The backend needs the PostgreSQL user's password, which may differ from the pgAdmin master password.

### 2. Start the backend

Open a terminal at the repository root:

```powershell
cd backend
npm.cmd install
Copy-Item .env.example .env
```

Edit `backend/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_DATABASE_PASSWORD@localhost:5432/questionbank
PORT=4000
```

Replace the password locally; URL-encode special characters when used in a connection URL. Then run:

```powershell
npm.cmd run db:init
npm.cmd start
```

Check [the backend health endpoint](http://localhost:4000/api/health). It should return a healthy response. Keep this terminal running.

### 3. Start the frontend

Open a second terminal at the repository root:

```powershell
cd frontend
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

The frontend configuration is:

```dotenv
VITE_API_URL=http://localhost:4000/api
```

Open the URL printed by Vite, usually [http://localhost:5173](http://localhost:5173). Restart the relevant server after changing its environment file.

### Subsequent starts

Keep PostgreSQL running. Start `npm.cmd start` inside `backend` and `npm.cmd run dev` inside `frontend`. Installation is needed initially or when dependencies change. Run `db:init` after schema updates; it is designed to preserve existing records.

Old Gemini/Groq/Ollama environment variables are no longer read by generation or learning. Keep `.env` files private and outside Git.

## Simple project structure

```text
mini-project/
├── frontend/
│   ├── src/             React screens, shared UI, PDF/TXT utilities and CSS
│   ├── public/          Favicon
│   └── vite.config.js   Frontend development/build settings
├── backend/
│   ├── src/             Express routes, local inference, validation and learning
│   ├── ml/              Our datasets, trained probabilities and Python trainers
│   ├── sql/schema.sql   Database tables, partitions and migrations
│   ├── scripts/         Database initialisation
│   └── test/            API, Java, ML and generation checks
├── core/src/
│   └── PaperEngine.java Java paper planning and selection
├── docs/images/         README screenshots
└── README.md
```

React handles state, forms and rendering. Vite serves the frontend in development and produces its build. Express validates HTTP requests, calls Java/our local ML logic, and reads/writes PostgreSQL. The browser never connects directly to the database.

## Inspect data in pgAdmin

Expand **Databases → questionbank → Schemas → public → Tables**. Right-click a table and choose **View/Edit Data → All Rows**. Use Query Tool for read-only inspection:

```sql
SELECT * FROM subjects ORDER BY name;
SELECT * FROM subject_storage;
SELECT id, subject, unit, marks, bloom_level, text
FROM questions WHERE NOT is_deleted ORDER BY id DESC;
SELECT id, title, created_at, paper
FROM saved_papers WHERE NOT is_deleted ORDER BY id DESC;
SELECT status, report FROM model_training_runs ORDER BY id DESC;
```

## Useful API routes

| Method and route | Purpose |
| --- | --- |
| `GET /api/health` | API/database health |
| `GET /api/questions` | List/filter bank questions |
| `POST /api/subjects` | Register a subject |
| `GET /api/subjects/:name/overview` | Subject overview |
| `POST /api/papers/generate` | Automatic bank paper |
| `POST /api/papers/manual` | Manual selection paper |
| `POST /api/papers/from-syllabus` | Fully local syllabus generation |
| `POST /api/papers/save-syllabus` | Explicitly add generated questions to bank |
| `GET /api/papers/saved` | Search/list saved papers |
| `GET /api/papers/saved/:id` | Retrieve a saved paper |
| `PUT /api/papers/saved/:id` | Edit its snapshot |
| `GET /api/model/status` | Local classifier/training status |
| `GET /api/model/papers/:id` | A paper's learning job |
| `POST /api/model/train` | Retrain from eligible stored labels |

## Verification and development

```powershell
# Frontend
cd frontend
npm.cmd run lint
npm.cmd run build
```

Backend tests use a **separate `questionbank_test` database**. Create it first and configure `TEST_DATABASE_URL` with its credentials, then run `npm.cmd test` in `backend`. Never point the test connection at a database containing real college data.

Python trainers and seed datasets are in `backend/ml/`. The topic and Bloom classifiers are our own trained models; no `pip` model package or downloaded foundation weights are required. The background trainer writes candidates and reports automatically. Tests check software behaviour and synthetic classification, not faculty acceptance of exam questions.

## Moving to the college server

1. Obtain the server's operating system, RAM, Java/Node/Python availability, database details and approved deployment access from the college administrator.
2. Copy or clone the application; install dependencies and create the PostgreSQL database.
3. Configure the server's private `backend/.env`, run `db:init`, and migrate the existing database with PostgreSQL backup/restore if required.
4. Build the frontend with `npm.cmd run build` (use `npm` on Linux). Set `VITE_API_URL` to the college API URL **before building**.
5. Serve `frontend/dist` with the college web server; reverse-proxy the Express API and run it under the server's service manager.
6. Persist and back up PostgreSQL and `backend/.runtime/`, and verify paper retrieval, PDF export and Python retraining after a restart.

The application has no authentication layer. Keep it within the approved campus access boundary or add the college's access controls before public exposure. Database credentials stay on the backend. The production workflow requires no external AI service; initial dependency installation still requires packages or an offline package copy.

Server credentials have not been requested or configured here. Laptop operation does not itself mean the college deployment is complete.

## Troubleshooting

| Problem | Check |
| --- | --- |
| `client password must be a string` | Create `backend/.env`, confirm `DATABASE_URL` includes the PostgreSQL password, and restart the backend. |
| Missing `dotenv`, `cors` or another package | Run `npm.cmd install` successfully inside `backend`. |
| Missing tables or partitions | Run `npm.cmd run db:init` using the correct database connection. |
| No syllabus text found | Use a text-based PDF/TXT with topic lines; scanned PDFs need OCR. |
| Not enough fresh questions | Add topics/bank content, reduce the requested count or adjust mark/K allocation. |
| K counts do not match | Sum the six K fields to exactly the question count for each mark value. |
| Paper saved but bank empty | Click **Add to question bank** and select a registered subject. |
| Java/Python unavailable | Verify `java -version` and `python --version` in the backend terminal. |
| Old generation-limit message | Update both frontend and backend and restart them. Current local generation has no hosted-provider quota. |

---

<div align="center"><strong>Built for a clear examination workflow, transparent local ML and college-controlled data.</strong></div>
