<a id="top"></a>

<div align="center">

<img src="docs/images/readme-cover.svg" alt="Question bank and examination paper generator" width="100%" />

# Question Bank & Paper Generator

### Build syllabus-grounded papers with AI and clear academic controls.

A college examination workspace built with **React + Vite**, **Node.js + Express**, **Java**, **PostgreSQL**, a **Gemini API model**, and local ML classifiers for selected classification tasks.

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white&style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white&style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-Backend-43853d?logo=nodedotjs&logoColor=white&style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql&logoColor=white&style=for-the-badge)
![Java](https://img.shields.io/badge/Java-Paper_engine-b27d42?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-Model_training-3776ab?logo=python&logoColor=white&style=for-the-badge)
![ML](https://img.shields.io/badge/ML-Trained_locally-2b7884?style=for-the-badge)

**React UI** → **Express API** → **Gemini + BM25 syllabus evidence + validation** → **Examination paper**

[Explore](#a-look-inside) · [Workflow](#the-workflow-at-a-glance) · [Install & run](#run-on-your-laptop) · [Learn from scratch](#learn-the-project-from-scratch) · [Architecture](#system-architecture) · [Code walkthrough](#code-walkthrough) · [Local ML](#how-our-own-model-works) · [Viva](#viva-and-project-explanation)

</div>

> **Question writing uses Gemini through the backend.** The API key stays in `backend/.env`; the React browser never receives it. Local BM25 retrieval, Bloom classification and quality checks continue to run in the backend. For a paid desktop product, keep a shared API key on a protected server rather than embedding it in the executable.

<table>
<tr>
<td width="33%" align="center"><strong>01 · USE THE APP</strong><br/>Set up the database, start both servers and create your first paper.<br/><br/><a href="#run-on-your-laptop">Open the setup guide →</a></td>
<td width="34%" align="center"><strong>02 · UNDERSTAND THE CODE</strong><br/>Follow a request from React through Express, Java and PostgreSQL.<br/><br/><a href="#code-walkthrough">Follow the code tour →</a></td>
<td width="33%" align="center"><strong>03 · EXPLAIN THE PROJECT</strong><br/>Understand the ML boundaries, design choices and deployment steps.<br/><br/><a href="#viva-and-project-explanation">Prepare your explanation →</a></td>
</tr>
</table>

<details>
<summary><strong>Browse the complete guide</strong></summary>

| Getting started | Understanding the implementation | Taking it further |
| --- | --- | --- |
| [Features](#what-you-can-do) | [System architecture](#system-architecture) | [Evaluation](#evaluation-what-the-numbers-mean) |
| [Screenshots](#a-look-inside) | [Code walkthrough](#code-walkthrough) | [Development checks](#verification-and-development) |
| [Welcome page and navigation](#welcome-page-and-navigation) | [Typography and logo](#typography-and-logo) | [Project limits](#project-boundaries) |
| [Learning roadmap](#learn-the-project-from-scratch) | [Our own model](#how-our-own-model-works) | [College hosting](#moving-to-the-college-server) |
| [Installation](#run-on-your-laptop) | [Training visualised](#training-and-inference-visualised) | [Troubleshooting](#troubleshooting) |
| [Everyday workflow](#everyday-workflow) | [Database relationships](#database-relationships) | [Viva questions](#viva-and-project-explanation) |
| [Marks and sections](#marks-question-counts-and-sections) | [API routes](#useful-api-routes) | [Project boundaries](#project-boundaries) |
| [Request visual](#system-architecture) | [Local generation visual](#training-and-inference-visualised) | [Data map](#where-the-data-is-stored) |

</details>

> [!TIP]
> **Already installed?** Keep PostgreSQL running. In one VS Code terminal run `cd backend` then `npm.cmd start`. In a second terminal from the project root run `cd frontend` then `npm.cmd run dev`. Open [localhost:5173](http://localhost:5173/).

<br/>

<img src="docs/images/section-explore.svg" alt="What you can do" width="100%" />

## What you can do

| Workspace | Purpose |
| --- | --- |
| **Question bank** | Add, search, edit, soft-delete and restore questions; filter by subject, unit, difficulty, marks and K level where available. |
| **Subjects** | Register subjects explicitly, browse their questions and view question counts. Each registered subject has its own PostgreSQL partition. |
| **Choose questions yourself** | Select the exact bank questions to include in a paper. |
| **Generate from question bank** | Select saved questions automatically using marks, units, difficulty and Bloom allocation. |
| **Upload a syllabus** | Upload a readable PDF, TXT file, or syllabus photo (JPEG, PNG or WebP). Gemini reads photo text; local BM25 retrieval finds relevant syllabus evidence and Gemini drafts structured questions through the backend. |
| **Stored papers** | Retrieve saved paper snapshots, edit their contents and download them again. |
| **Exports** | Download a PDF or TXT paper, or print from the browser. Student exports omit teacher answer fields. |

The interface uses a shared academic design system: bundled Noto Sans typography, deep navy text, clear blue actions, pale blue surfaces and restrained warm paper accents. Consistent cards, form controls, navigation, focus indicators and responsive layouts carry through the question bank, paper builder, subject pages, stored papers and paper previews. Mark counts update live, Bloom allocation is shown by K1–K6, and saved papers can be reopened for review. No application login is included.

## Welcome page and navigation

Open the app at `http://localhost:5173/` to see the welcome page before entering the dashboard. The page explains the main assessment workflow and provides direct links to the relevant workspace screens.

| Welcome page action | Destination | What opens |
| --- | --- | --- |
| **Enter the workspace** / **Open workspace** | `#bank` | The question-bank dashboard. |
| **How it works** / **Explore the tools** | `#welcome-features` | The four-step workflow explanation on the welcome page. |
| **Start with a syllabus** | `#create` | The paper builder with syllabus upload selected. |
| **Configure a paper** / **Open the paper builder** | `#create` | The paper builder, where you choose manual, question-bank or syllabus-based creation. |
| **View stored papers** | `#stored-papers` | The saved-paper archive. |
| **Question Bank logo** | `#welcome` | The top of the welcome page. |

The four steps describe the actual workflow: select syllabus units, configure marks and question style, review or edit the generated paper, and retrieve saved papers or export a PDF. The syllabus route does not require a subject name. All actions work from buttons or in-page links, and direct links such as `#create` continue to open the requested app section.

### Typography and logo

The landing page and workspace use the bundled **Noto Sans** font so the typography stays consistent without loading a remote font. The custom book mark in `frontend/public/question-bank-logo.svg` is used in the page header and as the browser-tab favicon.

## Syllabus question styles

When building a paper from an uploaded syllabus, choose the kind of questions the paper should contain:

| Style | What it asks the generator to produce |
| --- | --- |
| **Theory only** | Conceptual questions grounded in the selected syllabus units. It filters out calculations and worked numerical exercises. |
| **Sums / problem solving only** | Calculations, derivations, worked problems or other procedural questions when the selected units support them. |
| **Mixed theory and problem solving** | A combination of conceptual and supported numerical/procedural questions. The generator asks Gemini for both when the syllabus contains suitable problem-solving material and the paper has room for at least two questions. |

The selection is sent with syllabus-generation requests as `questionStyle` (`THEORY`, `PROBLEM_SOLVING` or `MIXED`). It applies to syllabus-based generation; question-bank and manual-selection papers keep their own question-selection flow. Unit selection still limits the source material. The generator excludes book/reference metadata and uses syllabus passages as evidence, so a textbook title or author is not treated as examinable content. If a syllabus unit contains no supported numerical material, the app should not invent a sum just to fill the selected style.

```mermaid
flowchart LR
  A[Upload syllabus] --> B[Choose units]
  B --> C{Choose style}
  C -->|Theory| D[Grounded conceptual questions]
  C -->|Sums| E[Supported calculations and procedures]
  C -->|Mixed| F[Both, when source topics support them]
  D --> G[Validate and review paper]
  E --> G
  F --> G
```
## The workflow at a glance

From the first source to a paper you can retrieve later, each stage has a clear role. The graphic below is a high-resolution vector image, so labels stay sharp when zoomed.

<img src="docs/images/readme-flow.svg" alt="Four-step workflow from choosing questions and structuring marks to local generation, review, saving and export" width="100%" />

<table>
<tr>
<td width="25%" align="center"><strong>01 · CHOOSE</strong><br/>Pick bank questions, select saved questions manually, or upload a syllabus.</td>
<td width="25%" align="center"><strong>02 · STRUCTURE</strong><br/>Set units, marks, difficulty and the desired Bloom-level distribution.</td>
<td width="25%" align="center"><strong>03 · PREPARE</strong><br/>BM25 retrieves syllabus evidence and Gemini creates a structured draft.</td>
<td width="25%" align="center"><strong>04 · REVIEW</strong><br/>Edit, save, retrieve, print or export the completed paper.</td>
</tr>
</table>

## A look inside

### 01 / The academic workspace

A subject-centred workspace for browsing the question bank, checking saved content and opening the paper builder.

<img src="docs/images/readme-workspace.svg" alt="Illustrated preview of the Question Bank academic workspace" width="100%" />

### 02 / Build an assessment

Choose a question source, select syllabus units, set marks and allocate questions across Bloom levels K1–K6.

<img src="docs/images/readme-builder.svg" alt="Illustrated preview of the assessment builder and Bloom-level controls" width="100%" />

### 03 / Retrieve and review a paper

Generated papers can be saved, reopened, printed and exported. Bloom labels communicate the intended cognitive level.

<img src="docs/images/readme-paper.svg" alt="Illustrated preview of a generated paper with mark sections and Bloom labels" width="100%" />

<sub>These are crisp, scalable vector illustrations of the main screens, created for this README. They are not live screenshots; actual subjects and questions vary by installation.</sub>

<details>
<summary>View original captured application screenshots</summary>

<br />

| Academic workspace | Assessment builder | Generated paper |
| --- | --- | --- |
| [Open original](docs/images/academic-dashboard.png) | [Open original](docs/images/local-bloom-builder.png) | [Open original](docs/images/question-paper-blooms.png) |

</details>

<br/>

<img src="docs/images/section-learn.svg" alt="Learn the project from scratch" width="100%" />

## Learn the project from scratch

You do not need to learn every file at once. Follow this order and use the checkpoints to test your understanding.

```mermaid
flowchart LR
  A["01 · Browser basics"] --> B["02 · React + Vite"]
  B --> C["03 · HTTP + Express"]
  C --> D["04 · PostgreSQL"]
  D --> E["05 · Java engine"]
  E --> F["06 · Local ML"]
  F --> G["07 · Test + export"]
  G --> H["08 · Deploy + maintain"]
  classDef sky fill:#edf6fd,stroke:#82aecb,color:#204d6b
  classDef warm fill:#fff4e5,stroke:#ceac7b,color:#755431
  class A,B,C,D sky
  class E,F,G,H warm
```

| Stage | Learn | Read in this project | Checkpoint |
| --- | --- | --- | --- |
| **1. Foundations** | HTML structure, CSS, JavaScript functions, arrays, objects, promises and JSON | [index.html](frontend/index.html), [App.css](frontend/src/App.css) | Explain why the browser needs HTML, CSS and JavaScript. |
| **2. Frontend** | JSX, components, props, state, effects and controlled forms | [main.jsx](frontend/src/main.jsx), [App.jsx](frontend/src/App.jsx) | Explain why changing a mark count updates the displayed total. |
| **3. Connectivity** | Requests, responses, methods, endpoints, status codes and asynchronous work | [app.js](backend/src/app.js), [server.js](backend/src/server.js) | Trace a button click into an API request. |
| **4. Persistence** | Tables, primary/foreign keys, SQL parameters, partitions and JSONB | [schema.sql](backend/sql/schema.sql), [db.js](backend/src/db.js) | Explain where questions and complete papers are stored. |
| **5. Core logic** | Child processes, slot planning and question selection | [javaCore.js](backend/src/javaCore.js), [PaperEngine.java](core/src/PaperEngine.java) | Explain how Node receives a result from Java. |
| **6. ML** | Features, labels, training, inference, holdouts and pseudo-labels | [localModel.js](backend/src/localModel.js), [train_reviewed.py](backend/ml/train_reviewed.py) | Distinguish a classifier from a general-purpose language model. |
| **7. Quality** | Validation, regression checks, export and error handling | [backend tests](backend/test), [paperPdf.js](frontend/src/paperPdf.js) | Explain which checks protect paper structure and which require faculty review. |
| **8. Operation** | Builds, configuration, service management and backups | [Deployment steps](#moving-to-the-college-server) | Explain how development differs from college hosting. |

<details>
<summary><strong>Beginner glossary · 14 terms used throughout the project</strong></summary>

| Term | Plain-language meaning |
| --- | --- |
| Component | A React function that describes part of the screen. |
| JSX | JavaScript syntax used to describe UI elements. |
| State | Values React remembers, such as selected questions or input counts. |
| Props | Values a parent component passes to another component. |
| API endpoint | A URL and method representing one backend operation. |
| HTTP | The request/response protocol between browser and backend. |
| JSON | Text representing structured objects and arrays. |
| Middleware | Express code that processes a request before or after a route. |
| Schema | A definition of valid input or database structure, depending on context. |
| Query | A database instruction, usually written in SQL. |
| Partition | A physical subdivision of a database table. |
| Inference | Applying already-trained model probabilities to new input. |
| Training | Estimating model parameters from labelled examples. |
| Holdout | Examples kept out of training to evaluate a candidate model. |

</details>

> [!TIP]
> Start with a small example: register one subject, add two questions, select them manually, retrieve the saved paper, and download its PDF. Then study automatic generation. This separates basic connectivity from ML behaviour.

## Everyday workflow

```mermaid
flowchart TD
  A[Open the application] --> B{Choose a source}
  B --> C[Select bank questions manually]
  B --> D[Automatic bank selection]
  B --> E[Upload syllabus PDF or TXT]
  D --> F[Set marks, units, difficulty and K counts]
  E --> G[Extract topic and unit text locally]
  G --> H[Local BM25 retrieves evidence; Gemini writes questions]
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

## System architecture

```mermaid
flowchart TB
  U["Faculty / project user"] --> R["React interface"]
  V["Vite development server or built static assets"] -. "serves UI" .-> R
  R <-->|"HTTP + JSON"| E["Node.js + Express API"]
  E <-->|"SQL through pg connection pool"| P[("PostgreSQL")]
  E <-->|"stdin / stdout"| J["Java PaperEngine"]
  E --> L["Local JavaScript ML inference"]
  L --> W["Our trained JSON probabilities"]
  E --> Q["Durable learning queue"]
  Q --> T["Python classifier training"]
  T --> W
  R --> X["Browser PDF / TXT / print"]
  classDef sky fill:#edf6fd,stroke:#82aecb,color:#204d6b
  classDef warm fill:#fff4e5,stroke:#ceac7b,color:#755431
  class R,V,E,X sky
  class P,J,L,W,Q,T warm
```

The browser calls Express directly using `VITE_API_URL`. The current Vite configuration does **not** define a backend proxy. Express owns database access and starts Java/Python subprocesses when their work is needed. Java is not a second web server; Python training is not a separately hosted API.

<img src="docs/images/readme-request-flow.svg" alt="Detailed visual of a React request moving through Express to PostgreSQL and Java logic, then returning as a JSON response" width="100%" />

### What each layer does during one click

| Step | What happens | Why the boundary matters |
| --- | --- | --- |
| **1. React reads the form** | Controlled inputs keep the selected subject, units, marks, difficulty and K-level counts in component state. | The preview and automatic totals stay in sync with what the user entered. |
| **2. The browser sends a request** | The page uses `fetch` to call an endpoint under `VITE_API_URL`, sending JSON and, for syllabus generation, the uploaded document data. | The browser only needs to know the API contract; it does not need database credentials. |
| **3. Express validates and routes** | Middleware parses the body, route handlers validate input and call the correct generation, subject, question or saved-paper service. | Invalid requests get a clear error response before they reach SQL or core logic. |
| **4. The backend coordinates work** | `pg` executes parameterised PostgreSQL queries. When needed, Node starts the Java planner or invokes local JavaScript generation and Python training code. | Each part has one job: HTTP, persistence, slot planning or model learning. |
| **5. JSON returns to React** | Express returns the paper or an error with an appropriate status. React updates the preview, list or message. PDF output is assembled in the browser. | The interface can display useful validation messages and does not become responsible for backend state. |

To trace a real feature, start at its button in `frontend/src`, find the request URL, search for that route in `backend/src/routes`, and follow the database/helper calls from there. This is a practical way to learn full-stack code: follow one user action rather than trying to memorise every file.

| Layer | Responsibility | Why it fits |
| --- | --- | --- |
| **React** | Components, state, forms, navigation and paper previews | Reuses UI behaviour across several paper workflows. |
| **Vite** | Development serving, React tooling and production asset builds | Keeps frontend setup and the build command straightforward. |
| **Node.js** | Server runtime, asynchronous I/O and subprocess integration | Connects HTTP, PostgreSQL, Java and Python in one backend. |
| **Express** | Routes, request parsing, middleware and responses | Provides a small, explicit REST interface. |
| **PostgreSQL** | Durable relational records, constraints, partitions and snapshots | Keeps subjects/questions linked while storing complete papers as JSONB. |
| **Java** | Marks planning and ordinary bank selection | Keeps the core planning algorithm separate from HTTP/UI code. |
| **Python + JavaScript ML** | Python training and JavaScript inference | Uses our own small classifiers without a model service or downloaded foundation weights. |

### One request, end to end

This example shows syllabus generation. Bank/manual flows use different selection logic but share validation and paper storage.

```mermaid
sequenceDiagram
  actor User
  participant UI as React
  participant API as Express
  participant DB as PostgreSQL
  participant Java as Java planner
  participant AI as Gemini API
  User->>UI: Upload syllabus and set marks/K counts
  UI->>API: POST /api/papers/from-syllabus
  API->>API: Validate body and extract document text
  API->>DB: Check subject and previous generation history
  API->>Java: Request marks/difficulty slots
  Java-->>API: Planned slots as JSON
  API->>API: Retrieve matching syllabus passages with BM25
  API->>AI: Topics, evidence, slots and repetition history
  AI-->>API: Structured question candidates
  API->>DB: Record history, save paper and queue learning
  API-->>UI: Saved paper with ID and questions
  UI-->>User: Preview with Bloom levels beside questions
  User->>UI: Download PDF
  UI-->>User: Browser-generated PDF
  Note over API,DB: Background local learning runs separately from display
```

For a bank-only paper, upload and retrieval are skipped: Express asks the Java planner for slots and selects eligible saved questions. For manual selection, the browser sends the chosen question IDs and the backend validates them before building the saved paper. Each route returns a paper object that the frontend can pass to its preview and export controls.

## Marks, question counts and sections

- Supported question values: **1, 2, 5, 10 and 16 marks**.
- Enter the quantity required for each mark value. An unused category stays at **0**.
- The question total updates live: two 2-mark questions and two 5-mark questions produce **4 questions**, worth **14 marks**.
- The selected questions must equal the entered total marks. Papers support at most **50 questions** and **1,000 marks**.
- With all category counts at zero, Java attempts an automatic denomination plan.
- The final paper groups the selected mark values into consecutive sections, starting with **Section A**.
- Each question shows its **Bloom level on the right**, such as K1 or K4. Section headings and paper totals retain marks. The PDF keeps this arrangement; TXT retains the K label without a per-question marks suffix. Browser printing uses print CSS and can wrap or paginate differently from the PDF.
- One-mark questions support **multiple choice** or **fill in the blanks**. Checked MCQs have four distinct options and one recorded correct answer.

## College Bloom mapping

<img src="docs/images/bloom-spectrum.svg" alt="K1 Remember, K2 Understand, K3 Apply, K4 Analyze, K5 Evaluate, K6 Create" width="100%" />

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

For syllabus generation, Bloom level controls both the cognitive task and exact displayed toughness: **K1/K2 = Easy**, **K3/K4 = Medium**, and **K5/K6 = Hard**. The question must require the corresponding thinking (recall, explain, apply, analyze, evaluate or create); changing only the opening verb does not qualify. The requested difficulty mix guides slot planning, while the assigned Bloom level determines the final generated-question difficulty. Bank selection checks the requested K level and its configured difficulty requirement independently and reports a shortfall rather than silently substituting another level. Local objective fallback covers curated recall facts and supported numerical application tasks; it does not fabricate higher-level MCQ answers.

## How our own model works

### 1. Extract the syllabus

The backend reads text from a PDF or TXT file, or asks Gemini to transcribe syllabus photos (JPEG, PNG or WebP). If a PDF has little or no extractable text, Gemini reads the scanned PDF pages directly. It removes common headings and page formatting, and extracts topics with Unit 1–5 or Roman-numeral unit headings. Clear, high-resolution scans improve transcription. Each uploaded file is limited to **5 MB**, and extracted text must contain 30–100,000 characters. Visual transcription uses the configured Gemini API key before the regular question-generation request.

### 2. Classify topics with trained ML

Our multinomial Naive Bayes topic model learns four classes: **concept**, **process**, **comparison** and **numerical**. Its features include words, character trigrams and optional bigrams. Python trains the weights; JavaScript loads the saved probabilities and performs inference locally.

A separate six-class Naive Bayes model learns **K1–K6** from complete question wording. It uses word and bigram context because opening verbs can overlap between Bloom levels.

### 3. Generate with syllabus-grounded Gemini prompts

Java plans marks and difficulty slots. For syllabus papers, users can select one or more units. The backend extracts the topics, restricts them to those units, and uses a local BM25 retriever to find the most relevant syllabus passage for each question slot. Gemini receives the exact topic, retrieved evidence, allowed subtopics, question format and required Bloom level as structured instructions. The API key stays on the backend; the browser never receives it.

The prompt maps K1 Remember and K2 Understand to EASY, K3 Apply and K4 Analyze to MEDIUM, and K5 Evaluate and K6 Create to HARD. Each level must change the actual reasoning task, not merely the opening verb. It uses original GATE-style precision as a quality reference: each stem names the task, uses clear technical terminology, and includes the assumptions, parameters, values and units needed for a unique answer. Numerical premises should be checked for sufficiency and consistency. MCQ distractors should be plausible and distinct. The generator must use only retrieved evidence from the selected syllabus, exclude course/document metadata, avoid generic filler and repeated questions, and never copy past GATE items. When a question truly depends on a visual or input data, Gemini may also return concise supporting material: a small labelled synthetic dataset for an ML/data task or a printable ASCII diagram for a diagram-dependent topic. The material is attached beneath the question stem and travels with previews, stored papers, TXT, print and PDF exports; it stays empty for questions that do not need it. The application checks the returned count, syllabus scope, question format, Bloom verb, numerical requirements and difficulty before saving a paper.

The local Naive Bayes models still classify topic families and Bloom tasks and support background review. They are not generative language models and do not replace Gemini's question-writing capability. Retrieval narrows the evidence supplied to Gemini; it cannot guarantee that every generated item is factually or pedagogically perfect, so teachers should review papers before use.

### GATE-referenced question quality

GATE is used only as a **quality reference** for precise, technically rigorous assessment questions; the generator does not reproduce the official GATE exam pattern or copy past-paper questions. For every generated item, the prompt asks Gemini to:

- Test one named concept or subtopic present in the selected syllabus evidence.
- State exactly what students must determine, explain, compare, prove or construct, using the syllabus terminology.
- Include sufficient assumptions, model/distribution parameters, inputs, units and conditions so a numerical task has a unique, solvable result.
- Make conceptual comparisons specific by naming the objects and conditions, avoiding vague phrases such as ?a given function? or ?a suitable application.?
- Match the requested K level to its real cognitive demand and exact difficulty mapping above.
- Use four plausible, distinct MCQ choices with one correct answer when the one-mark format is MCQ.
- Exclude questions about the syllabus document, course identity, coverage, year, author or reference books; these details are not examinable content.

These prompt rules improve clarity and grounding but cannot guarantee factual correctness for every model response. Teachers should review the final paper, especially calculations and assumptions, before using it in an examination.

### 4. Control repetition

History is scoped to the subject and normalised syllabus fingerprint. Generation prefers unused text and checks known normalised question patterns. At most **20%** historical repeats are permitted, rounded down; papers with fewer than five questions allow zero. Supported numerical variants change their values, while still counting as the same underlying pattern.

The candidate pool is finite. If it cannot satisfy the requested marks/K counts within the repeat budget, generation returns a clear shortfall. This is not a universal semantic-paraphrase detector. Deliberate manual reuse of bank questions is allowed.

#### BM25 in this project, in plain language

BM25 is a text-search ranking method. It splits each syllabus passage and topic into tokens, ignores a small list of very common words, and gives more value to terms that help distinguish one passage from another. A topic such as *K-means centroid clustering* should rank a passage that discusses K-means and centroids ahead of a generic course introduction. The implementation also considers passage length so that a long paragraph does not win simply because it contains more words. A small same-unit bonus can prefer evidence from the requested unit.

The retriever indexes the uploaded syllabus in memory for the current generation request. It does not download an embedding model, call a hosted vector database or retain the uploaded file as a stored syllabus. The selected passage is attached to the candidate as its syllabus reference, helping generation stay grounded and making the source easier to inspect. BM25 can only retrieve evidence present in the uploaded text; unclear or missing syllabus content still limits the questions it can support.

> [!NOTE]
> **RAG here means local retrieval plus API generation.** BM25 retrieves relevant passages from the uploaded syllabus; Gemini uses those passages to write structured questions. The small local classifiers are separate and do not generate the question text.

### 5. Retrain locally

New saved papers enter a database-backed learning queue. Local validation and agreement with the Bloom classifier determine which locally generated examples are eligible for self-training. Faculty-labelled examples remain supported. Historical cloud-labelled records are excluded from new local training and candidate retrieval.

The Python trainer excludes held-out records and conflicting labels, evaluates the candidate, and activates it only when the configured benchmark checks do not regress. Training reports are saved in PostgreSQL; active weights are stored under ignored `backend/.runtime/`. Temporary per-run training files are removed after use.

**Self-training labels are not independent ground truth.** Agreement and structural checks do not prove factual accuracy or automatically guarantee improvement. Faculty-reviewed data and independently reviewed papers are needed to measure educational quality.

## Training and inference visualised

**Training builds probabilities. Inference uses them. Generation also needs authored task rules.**

The following diagram separates retrieval, classification, wording and validation. BM25 searches the uploaded syllabus, the local classifiers estimate topic family and Bloom task, Gemini writes candidates from retrieved evidence, and validation checks the requested structure.

<img src="docs/images/readme-model-pipeline.svg" alt="Color-coded syllabus generation stages: extract, filter units, retrieve with BM25, classify, generate with Gemini and validate" width="100%" />

```mermaid
flowchart LR
  subgraph TRAIN["Training · Python"]
    A["Curated / eligible labelled examples"] --> B["Extract words, pairs and character features"]
    B --> C["Estimate Naive Bayes probabilities"]
    C --> D["Validate and evaluate candidate"]
    D --> E{"Checks do not regress?"}
    E -->|"Yes, with eligible reviewed topics"| F["Activate candidate JSON"]
    E -->|"No"| G["Keep previous model"]
  end
  subgraph RUN["Inference and generation · JavaScript"]
    H["Extracted syllabus topics"] --> J["BM25 retrieves matching passages locally"]
    F -.-> I
    I["Load trained topic and Bloom classifiers"] --> L["Classify topic family and rank Bloom tasks"]
    J --> K["Gemini generates structured questions from retrieved evidence"]
    K --> L
    L --> M["Validate counts, prefixes and reuse budget"]
  end
```

<details>
<summary><strong>Understand the model mathematics without a machine-learning background</strong></summary>

Suppose a topic contains words such as *conversion*, *binary* and *arithmetic*. Training counts how frequently its features occur in each labelled topic class. At inference time, the classifier scores each class using its saved probabilities:

```text
score(class) = log P(class) + sum of log P(feature | class)
predicted class = the class with the highest score
```

Smoothing avoids assigning zero probability to a feature/class combination merely because it was absent in the small training set. The current trainer compares feature/smoothing configurations using a separate validation set. Tests check that Python training and JavaScript inference produce matching predictions.

The Bloom classifier uses whole-question words and bigrams. A shared opening word, such as *Compare*, cannot by itself distinguish understanding, analysis and evaluation. Candidate task wording supplies additional context.

The local review's `confidence` field is a structural eligibility gate (0 or 1), **not** a calibrated probability of academic correctness. Automatic self-training can reinforce errors, so its results must be interpreted alongside independently labelled faculty data.

</details>

### What happens after a paper is saved?

```mermaid
stateDiagram-v2
  [*] --> Pending: paper saved
  Pending --> Processing: worker claims job
  Processing --> Completed: checks and optional training finish
  Processing --> Retrying: recoverable failure
  Retrying --> Processing: retry becomes due
  Processing --> Failed: attempt limit reached
  Processing --> Skipped: saved paper unavailable
  Completed --> [*]
  Failed --> [*]
  Skipped --> [*]
```

The queue survives a backend restart. A completed job can accept zero examples or retain the previous classifier; **completed** does not necessarily mean that new weights were activated. The stored paper remains available when background learning fails. Current source polls every 15 seconds and permits up to three attempts; legacy queue states may still appear in old installations.

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

<img src="docs/images/readme-data-map.svg" alt="Color-coded overview of subjects, the shared partitioned questions table, saved paper snapshots, syllabus history and local learning records" width="100%" />

### How to think about the records

The **question bank** is reusable source material: each question belongs to a registered subject and may carry a unit, topic, mark value, difficulty, answer format and Bloom label. Deleting a question is a soft delete, so the application can restore it rather than immediately losing its row. A subject partition is a PostgreSQL storage detail; API calls still query the shared `questions` parent and filter by subject.

A **saved paper** is a snapshot of the assessment at the moment it was generated or saved. It keeps its own wording and settings, so later edits to bank questions do not rewrite an older paper. That is why a saved paper can be retrieved even after its source question changes. Adding generated questions to the reusable bank is a separate, explicit action.

The **learning records** serve another purpose. `automatic_learning_jobs` tracks background work for each paper, `reviewed_examples` stores eligible labelled examples, and `model_training_runs` stores reports. These records support traceability; they are not themselves question-bank entries and do not guarantee that model quality improved. The source paper remains saved even if optional training fails.

## Database relationships

The diagram shows selected logical relationships, not every schema column. Subject partitions share the `questions` parent rather than duplicating bank data.

```mermaid
erDiagram
  SUBJECTS ||--o{ QUESTIONS : owns
  SUBJECTS o|--o{ SAVED_PAPERS : groups
  SUBJECTS o|--o{ SYLLABUS_HISTORY : scopes
  SAVED_PAPERS ||--o{ REVIEWED_EXAMPLES : supplies
  SAVED_PAPERS ||--o| AUTOMATIC_LEARNING_JOBS : queues
  SUBJECTS {
    text name PK
    int generated_papers
  }
  QUESTIONS {
    int id
    text subject FK
    int marks
    text bloom_level
    boolean is_deleted
  }
  SAVED_PAPERS {
    int id PK
    text subject FK
    text title
    jsonb paper
  }
  REVIEWED_EXAMPLES {
    int id PK
    int paper_id FK
    text label
    text bloom_level
  }
  SYLLABUS_HISTORY {
    text subject FK
    text syllabus_hash
    text question_hash
    text signature_hash
  }
  AUTOMATIC_LEARNING_JOBS {
    int paper_id PK, FK
    text status
    int attempts
  }
```

The question primary key is the composite **(id, subject)**. `model_training_runs` stores run-level JSON reports separately; there is no invented foreign-key relationship from that table to an individual example. `subject_storage` is a view for finding safe physical partition names.

Read the data map from left to right: subjects provide a registered destination; the shared question parent stores reusable content; saved-paper JSON stores an assessment snapshot. The physical subject partitions sit under the shared question parent. Syllabus history helps enforce the repeat policy, while the learning queue and review records make optional local training traceable to the paper that produced it. Foreign keys connect records and check constraints limit valid values. Application-level validation gives the user a useful message; database constraints provide a final safeguard if a request reaches persistence.

> [!IMPORTANT]
> A paper snapshot, a bank question and a training example serve different purposes. Deleting or editing one does not mean every other representation has changed.

<br/>

<img src="docs/images/section-build.svg" alt="Run on your laptop" width="100%" />

## Run on your laptop

### Prerequisites

| Software | Requirement |
| --- | --- |
| Node.js and npm | Node 22.12+ or a version compatible with the installed Vite package |
| PostgreSQL | 15+; keep its database service running |
| Java JDK | 17+; `java` must be available in the terminal |
| Python | Python 3; standard library only for classifier training |
| VS Code | Convenient editor and terminals |

PostgreSQL Stack Builder add-ons are optional. Gemini generation requires a Gemini API key from Google AI Studio and an internet connection. Local retrieval and classification do not replace the Gemini question-writing model.

### 0. Get the source and check the tools

Clone your repository, or download its ZIP and extract it. Open the folder containing `frontend`, `backend` and `core` in VS Code.

```powershell
git clone https://github.com/irfanshafi21/mini-project.git
cd mini-project
node --version
npm.cmd --version
java -version
python --version
```

Git is optional for ZIP users. Reopen VS Code after installing tools so new PATH entries become available. Keep the three project folders together; Node locates Java through the relative `core/src` path.

### 1. Create the database

Open pgAdmin, connect to the PostgreSQL server, right-click **Databases → Create → Database**, and create **questionbank**.

The backend needs the PostgreSQL user's password, which may differ from the pgAdmin master password.

### 2. Start the backend

```powershell
cd backend
npm.cmd install
Copy-Item .env.example .env
```

Edit `backend/.env`. Set your PostgreSQL connection string and paste your private Gemini API key locally:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_DATABASE_PASSWORD@localhost:5432/questionbank
PORT=4000
AI_PROVIDER=gemini
GEMINI_API_KEY=your_primary_private_key
GEMINI_API_KEY_FALLBACK_1=
GEMINI_API_KEY_FALLBACK_2=
GEMINI_MODEL=gemini-3.8-flash
```

Replace the sample database password and primary API key locally. If you have additional Gemini keys, enter them in `GEMINI_API_KEY_FALLBACK_1` and `GEMINI_API_KEY_FALLBACK_2`; leave unused fallback values blank. On authentication, quota/rate-limit, network, or provider-server errors, the backend tries the configured keys in order. The same model and prompt are used for every key. Gemini rate limits are project-scoped, so multiple keys from one Google project do not increase the same project rate limit; see the [official rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits). URL-encode special characters in the database URL. Keep `.env` private: never commit it or embed API keys in frontend code or an installer. Then run:

To use Groq instead, set `AI_PROVIDER=groq`, add `GROQ_MODEL` and configure `GROQ_API_KEY`, `GROQ_API_KEY_FALLBACK_1` and `GROQ_API_KEY_FALLBACK_2`. Groq tries these keys one at a time in order and switches after authentication, quota/rate-limit, network or provider-server errors; it does not send duplicate requests simultaneously. Keys from the same Groq project may share quota limits, so fallback helps most when keys have independent quota or one key is invalid/temporarily unavailable. If all keys are unavailable, the app returns one clear provider error. Restart the backend after changing `.env`.

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

The default provider is Gemini. Its key and model are read by the backend from `backend/.env`; never put the key in React code or commit it. Automatic review and ML classifier training remain local.

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

React handles state, forms and rendering. Vite serves the frontend in development and produces its build. Express validates HTTP requests, retrieves syllabus evidence, calls Gemini and Java, and reads/writes PostgreSQL. The browser never connects directly to the database and never receives the Gemini key.

<br/>

<img src="docs/images/section-explain.svg" alt="Code walkthrough" width="100%" />

## Code walkthrough

Use this as a guided reading order. The short examples explain the real design; they are educational fragments, not complete replacement source files.

### Frontend component map

```mermaid
flowchart TD
  M["main.jsx · React root"] --> A["App.jsx · shell, navigation, library, subjects"]
  A --> S["SyllabusPaper · automatic bank / syllabus"]
  A --> N["ManualPaper · exact question selection"]
  A --> P["StoredPapers · list and retrieval"]
  S --> B["BloomCounts · K allocation"]
  S --> E["PaperEditor"]
  N --> E
  P --> E
  S --> D["PdfDownload"]
  N --> D
  P --> D
  D --> U["paperPdf.js · PDF layout"]
  S --> L["ReviewLearning · job status"]
  N --> L
  P --> L
  classDef sky fill:#edf6fd,stroke:#82aecb,color:#204d6b
  class M,A,S,N,P,B,E,D,L,U sky
```

<details open>
<summary><strong>01 · React: how the interface is built</strong></summary>

[main.jsx](frontend/src/main.jsx) finds the HTML element with ID `root` and mounts `<App />`. [App.jsx](frontend/src/App.jsx) supplies the shared sidebar, navigation, question library, subject screens and dialogs. Components return JSX describing the screen.

- **State:** `useState` remembers inputs, selected subjects, source choice, errors and loaded records.
- **Props:** the parent passes values such as `subjects`, `apiUrl` and callbacks into child screens.
- **Effects:** `useEffect` fetches data or listens for navigation changes; cleanup cancels obsolete work where implemented.
- **Derived values:** question counts and mark subtotals are calculated from inputs instead of being manually entered twice.
- **Conditional rendering:** only the selected page or source configuration is displayed.
- **Hash navigation:** views use paths such as `#bank`, `#create`, `#subjects` and `#stored-papers/8`; this project does not use React Router.

A simplified version of the live count calculation:

```jsx
const totalQuestions = [1, 2, 5, 10, 16].reduce(
  (sum, marks) => sum + (Number(form['m' + marks]) || 0),
  0,
)

<input type="number" readOnly value={totalQuestions} />
```

When a controlled input updates `form`, React renders again. The derived total and allocation summary therefore update immediately. It does not require a database write for every keystroke in the mark controls.

The CSS in [App.css](frontend/src/App.css) controls the academic theme, desktop sidebar, mobile layouts, focus states and print-specific hiding. The paper illustration is CSS/HTML decoration; it does not load an external image/model service.

</details>

<details>
<summary><strong>02 · Vite: where it is and what it does</strong></summary>

Read [vite.config.js](frontend/vite.config.js), [frontend/package.json](frontend/package.json) and [index.html](frontend/index.html).

| Command | What happens |
| --- | --- |
| `npm.cmd run dev` | Vite serves the frontend, usually on port 5173, and updates development code as files change. |
| `npm.cmd run build` | Vite prepares production frontend assets in `frontend/dist`. |
| `npm.cmd run preview` | Locally previews that build; it does not start Express or PostgreSQL. |

The React plugin supplies the frontend's React integration. Vite is a development/build tool; Node + Express remains the application backend. A successful frontend build cannot prove the database or Java engine works.

`VITE_API_URL` is read by the frontend build. Values exposed with the `VITE_` prefix are intended for the browser, so database credentials do not belong there. The current frontend directly requests the configured API URL; it does not rely on a Vite proxy.

</details>

<details>
<summary><strong>03 · Frontend/backend connectivity: follow the request</strong></summary>

A simplified subject-registration request has this shape:

```js
const response = await fetch(`${API}/subjects`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Computer Organisation' }),
})
const result = await response.json()
if (!response.ok) throw new Error(result.error)
```

`fetch` starts an HTTP request. `JSON.stringify` turns the JavaScript object into request text. Express parses that text back into an object. The route validates the name and writes to PostgreSQL. The response becomes frontend state, so the interface can refresh.

| Method | Typical meaning here |
| --- | --- |
| `GET` | Retrieve questions, a subject overview, papers or model status. |
| `POST` | Create a subject/question/paper or request an action such as training. |
| `PUT` | Update an existing question or saved-paper snapshot. |
| `DELETE` | Soft-delete a bank question through its route. |

The frontend and backend normally run on different ports. Express uses `cors()` to permit cross-origin frontend requests. **CORS is not authentication or access control.**

</details>

<details>
<summary><strong>04 · Node and Express: middleware, routes and errors</strong></summary>

[server.js](backend/src/server.js) starts the HTTP listener and the local learning worker. [app.js](backend/src/app.js) creates Express, registers JSON parsing/CORS, connects route modules and installs the error handler.

```text
Incoming request
  → CORS / JSON middleware
  → matching route
  → Zod validation
  → database / Java / local model work
  → JSON response
  → shared error handler if an operation fails
```

Route modules separate questions, subjects, statistics, paper generation, stored papers and learning. [validation.js](backend/src/validation.js) defines supported values, counts and consistency checks. [errors.js](backend/src/errors.js) converts failures into HTTP responses.

| Status | Typical meaning in this project |
| --- | --- |
| `400` | Invalid request, subject or allocation. |
| `404` | Requested record/route not found. |
| `409` | Conflict or insufficient fresh/matching questions. |
| `413` | Request body too large. |
| `503` | A required local service/runtime is unavailable. |
| `500` | Unexpected server failure. |

Server validation is essential even when the form already checks inputs: callers can send requests without using the website.

</details>

<details>
<summary><strong>05 · PostgreSQL: how records persist</strong></summary>

[db.js](backend/src/db.js) creates a `pg.Pool` using the private `DATABASE_URL`. Routes call its shared `query` function. A connection pool manages database connections rather than creating a new unmanaged connection for each operation.

A simplified parameterised lookup:

```js
const { rows } = await query(
  'SELECT id, text, marks, bloom_level FROM questions WHERE subject = $1 AND NOT is_deleted',
  [subject],
)
```

`$1` represents a data value supplied separately. The questions route also constructs a filter from fixed SQL fragments and parameter values, instead of inserting raw user text into SQL.

Subject names are normalised, foreign keys link records, constraints reject unsupported values, and soft deletion allows question restoration. Subject partitions provide separate physical question storage while the parent table supports shared searches. Complete papers use JSONB snapshots so that later bank edits do not silently change an archived paper.

The browser does not contain the database password and does not run SQL directly. See [schema.sql](backend/sql/schema.sql) for the authoritative constraints and migration details.

</details>

<details>
<summary><strong>06 · Java: why a separate core exists</strong></summary>

[javaCore.js](backend/src/javaCore.js) starts [PaperEngine.java](core/src/PaperEngine.java) using the JDK's source-file launcher. It sends a small line/tab-separated protocol to standard input, collects standard output, parses the JSON result and maps selected IDs back to question metadata.

```text
Node: parameters + candidate IDs
       │ stdin
       ▼
Java: PLAN / PLAN_FIXED / SELECT / SELECT_FIXED
       │ stdout JSON
       ▼
Node: planned slots or selected bank questions
```

Java handles marks planning and ordinary bank selection. Explicit bank Bloom/difficulty matching is also handled by [blooms.js](backend/src/blooms.js), so not every selection rule belongs to Java alone. Java does not train the model, access the browser or run its own HTTP port. The bridge checks failures, malformed output and a timeout.

</details>

<details>
<summary><strong>07 · Local generation: where the questions come from</strong></summary>

Read these files in order:

| File | What to look for |
| --- | --- |
| [syllabusGenerator.js](backend/src/syllabusGenerator.js) | Validated request shape, extracted text, Java slots and local generation call. |
| [localModel.js](backend/src/localModel.js) | Model loading, topic extraction, topic classification, task grammars and candidate ranking. |
| [blooms.js](backend/src/blooms.js) | Contextual K classification, permitted prefixes and allocation matching. |
| [objectiveQuestions.js](backend/src/objectiveQuestions.js) | Checked definition groups and related MCQ distractors. |
| [numericalQuestions.js](backend/src/numericalQuestions.js) | Parameterised mathematical problems and calculated answers. |
| [routes/syllabus.js](backend/src/routes/syllabus.js) | Registered-subject checks, history policy, saved papers and explicit bank insertion. |

For example, a supported linear-prediction factory can generate a problem such as `y = 3x + 2` at `x = 4` and calculate `14`. A later numerical variant can change the coefficients or input. Those values are generated by code; they are not invented by a remote LLM.

Changing numbers still counts as reusing the same known numerical pattern. Topic classification, task composition and repetition checking are separate steps. Adding a new arbitrary topic does not automatically supply verified objective facts or a new mathematical solver for it.

</details>

<details>
<summary><strong>08 · Python training: how weights are rebuilt</strong></summary>

[train.py](backend/ml/train.py) provides topic feature extraction, Naive Bayes training and prediction. [train_bloom.py](backend/ml/train_bloom.py) trains the six-class cognitive-task model. [train_reviewed.py](backend/ml/train_reviewed.py) combines eligible examples, excludes held-out/conflicting rows, selects a configuration and produces evaluation reports. [train_from_archive.py](backend/ml/train_from_archive.py) reads the supplied GATE CS past-paper ZIP locally, trains from 2022 examples, and keeps 2023 questions held out for evaluation. It does not copy the source PDFs or extracted questions into the repository.

To repeat the archive training on Windows, open a terminal in `backend` and run:

```powershell
python -m pip install -r ml/requirements-training.txt
python ml/train_from_archive.py --archive "C:\Users\YOUR_NAME\Downloads\All_Past_Exam_Papers_with_Syllabi.zip" --integrate
```

The archive does not include faculty-assigned Bloom levels. Training labels are inferred from unambiguous verbs in the college chart, so the evaluation measures agreement with that verb rule, not educational quality. See [MODEL_CARD.md](backend/ml/MODEL_CARD.md) and [archive-evaluation.json](backend/ml/archive-evaluation.json) for the dataset limits and held-out results.

[automaticLearning.js](backend/src/automaticLearning.js) performs local eligibility checks and processes queued papers. [routes/learning.js](backend/src/routes/learning.js) launches Python, evaluates the returned report, and either activates the candidate or keeps the current model.

Read the frozen train/validation/test files before interpreting accuracy. Runtime reports are available through `/api/model/status`. A training run can finish successfully without activating a model. More self-labelled questions do not necessarily mean better accuracy or better academic content.

</details>

<details>
<summary><strong>09 · Paper editing, PDF, TXT and print</strong></summary>

[PaperEditor.jsx](frontend/src/PaperEditor.jsx) manages an editable draft and saves an updated snapshot. It does not modify an existing bank question simply because its paper copy changed.

[paperText.js](frontend/src/paperText.js) formats question stems/options and supplies Bloom labels. Previews and [paperPdf.js](frontend/src/paperPdf.js) place K1–K6 beside each question, while marks stay in section headings/totals. TXT keeps the K tag without a per-question marks suffix.

[PdfDownload.jsx](frontend/src/PdfDownload.jsx) provides the PDF download action and reports export failures in the interface. The browser creates the PDF with jsPDF on a fixed A4 page. Its layout mirrors the preview's centered subject and totals, section banners, question-number column, Bloom-level column, and structured schema/code blocks. Long text wraps within the page, whole questions are kept together where space allows, and page numbers are added. The responsive preview and fixed-size A4 page can still wrap lines and break pages at different points; use **Download PDF** when you want the dedicated paper layout. The bundled Noto Sans font is used when available, with Helvetica as a fallback. Browser print is a separate CSS-based path: it hides navigation, controls and workspace decoration, and its result can vary with browser print settings. Teacher answers remain in data/editing fields and are omitted from student paper exports.

</details>

### A complete marks-and-Bloom example

This is an illustrative **50-mark, 10-question** configuration. Each row's K counts equal its question count.

| Marks each | Questions | K1 | K2 | K3 | K4 | K5 | K6 | Marks subtotal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 5 | 3 | 2 | 0 | 0 | 0 | 0 | 10 |
| 5 | 2 | 0 | 1 | 1 | 0 | 0 | 0 | 10 |
| 10 | 3 | 0 | 0 | 0 | 1 | 1 | 1 | 30 |
| **Total** | **10** | **3** | **3** | **1** | **1** | **1** | **1** | **50** |

This example does not impose a permanent relationship between marks and K level. Difficulty percentages must separately total 100, and the selected source must have enough supported candidates.

## Viva and project explanation

### A short explanation you can practise

> The project manages a subject-based question bank and creates examination papers through manual selection, automatic bank selection or syllabus upload. React manages the interface, Vite handles frontend development/builds, and Express provides the HTTP API on Node.js. PostgreSQL stores subjects, questions, paper snapshots and learning records. Java plans marks and ordinary bank selection. Gemini generates syllabus questions using passages retrieved by local BM25; locally trained Naive Bayes classifiers support topic/Bloom classification. Successful papers are saved automatically, with an explicit button for adding syllabus questions to the reusable bank. Eligible local examples can retrain the classifiers, but faculty review is still needed before real examination use.

<details>
<summary><strong>20 viva questions with concise answers</strong></summary>

| Question | Answer |
| --- | --- |
| What problem does the project solve? | It organises reusable questions and helps assemble balanced examination papers. |
| Why React? | State and reusable components support forms, filters, previews and several paper workflows. |
| Why Vite? | It serves the frontend during development and builds production assets. |
| Are React and Vite the backend? | No. Node.js runs the Express backend. |
| What is JSX? | UI-description syntax used inside JavaScript React components. |
| What are props and state? | Props are passed into a component; state is remembered and updated by that component. |
| How do frontend and backend communicate? | HTTP requests and JSON responses using the configured API URL. |
| Why Express? | It provides routes and middleware around the application logic. |
| Why PostgreSQL? | Persistent records, relational constraints, partitions and JSONB paper snapshots. |
| Why use parameterised queries? | They keep data values separate from SQL instructions. |
| What does Java do? | Plans marks and performs ordinary bank selection through a Node subprocess bridge. |
| What is the local ML algorithm? | Multinomial Naive Bayes classifiers for topic families and Bloom task levels. |
| Is the project a newly trained general-purpose LLM? | No. Learned classification is combined with controlled question composition. |
| Does syllabus question generation require an external AI key? | Yes. Gemini runs through the backend; local BM25 retrieval and classifiers do not need a key. |
| What does automatic learning change? | Eligible examples can update classifier probabilities after evaluation. |
| Does self-training guarantee improvement? | No. Pseudo-labels can reinforce errors, and synthetic tests have limited coverage. |
| How are repeated questions controlled? | Text hashes and known pattern signatures are checked within the subject/syllabus history scope. |
| Where are generated papers stored? | As JSONB snapshots in `saved_papers`; bank insertion is a separate action. |
| What do K1–K6 represent? | Remember, Understand, Apply, Analyze, Evaluate and Create. |
| Is this already deployed on the college server? | Laptop operation is separate from deploying services, data, configuration and access controls on that server. |

</details>

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
| `POST /api/papers/from-syllabus` | Generate from PDF/TXT syllabus content or a syllabus photo |
| `POST /api/papers/save-syllabus` | Explicitly add generated questions to bank |
| `GET /api/papers/saved` | Search/list saved papers |
| `GET /api/papers/saved/:id` | Retrieve a saved paper |
| `PUT /api/papers/saved/:id` | Edit its snapshot |
| `DELETE /api/papers/saved/:id` | Move a complete saved paper to the recycle bin |
| `POST /api/papers/saved/:id/restore` | Restore a deleted saved paper |
| `GET /api/model/status` | Local classifier/training status |
| `GET /api/model/papers/:id` | A paper's learning job |
| `POST /api/model/train` | Retrain from eligible stored labels |

<br/>

<img src="docs/images/section-operate.svg" alt="Verification and development" width="100%" />

## Verification and development

```powershell
# Frontend
cd frontend
npm.cmd run lint
npm.cmd run build
```

Backend tests use a **separate `questionbank_test` database**. Create it first and configure `TEST_DATABASE_URL` with its credentials, then run `npm.cmd test` in `backend`. Never point the test connection at a database containing real college data.

Python trainers and seed datasets are in `backend/ml/`. The topic and Bloom classifiers are our own trained models; no `pip` model package or downloaded foundation weights are required. The background trainer writes candidates and reports automatically. Tests check software behaviour and synthetic classification, not faculty acceptance of exam questions.

## Project boundaries

| Implemented | Boundary to understand |
| --- | --- |
| Local fallback generation | A finite controlled generator for supported patterns only; syllabus question writing uses Gemini. |
| Automatic classifier retraining | Pseudo-labels are not independent faculty validation. |
| Bloom allocation and opening checks | Structural/task rules do not mathematically guarantee cognitive or academic correctness. |
| Numerical factories | Cover supported operations, not arbitrary symbolic mathematics. |
| PDF/TXT extraction | Scanned PDFs use Gemini transcription; clear, high-resolution pages improve OCR quality. |
| Repetition policy | Known signatures do not detect every possible semantic paraphrase. |
| Saved-paper retrieval | Historical unsaved papers cannot be reconstructed automatically. |
| Responsive academic UI | No application authentication/role-permission system is included. |

Gemini generation depends on the configured provider quota, network and API key. For larger syllabus papers, Gemini handles groups of up to ten questions with at most three groups running concurrently; image uploads require an additional Gemini transcription request before question generation. The backend records preparation, generation and persistence durations in its server log to help diagnose slow runs. Current application bounds still include **50 questions**, **1,000 marks**, a **5 MB upload**, available topic/evidence coverage and the historical **20% repeat budget**, rounded down.

## Moving to the college server

```mermaid
flowchart LR
  B["User browser"] --> W["College web server / approved access layer"]
  W --> F["Built frontend dist"]
  W --> E["Express service"]
  E --> D[("PostgreSQL")]
  E --> J["Java runtime"]
  E --> M["Local inference weights"]
  E --> P["Python training process"]
  D --> S["Scheduled backups"]
  M --> S
  P --> M
  classDef sky fill:#edf6fd,stroke:#82aecb,color:#204d6b
  class B,W,F,E sky
```

This is a deployment layout to prepare with the administrator, not a claim that the college installation has already been completed.

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
| No syllabus text found | Use a text-based PDF/TXT with topic lines, or upload a clear JPEG/PNG/WebP photo. For scanned PDFs, check page clarity and that the file contains readable syllabus topics. |
| Not enough fresh questions | Add topics/bank content, reduce the requested count or adjust mark/K allocation. |
| K counts do not match | Sum the six K fields to exactly the question count for each mark value. |
| Paper saved but bank empty | Click **Add to question bank** and select a registered subject. |
| Java/Python unavailable | Verify `java -version` and `python --version` in the backend terminal. |
| Gemini key or quota error | Check `GEMINI_API_KEY` and optional fallback keys in the private backend `.env`, confirm the model is enabled for the keys, and review the Google project quota. Fallback keys in one project share the same project rate limits; see [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits). |
| PDF still looks like the old layout, or the console reports an outdated `jspdf.js` dependency | Reload the app with **Ctrl+F5**. If the Vite terminal reports an outdated optimized dependency, stop the frontend with **Ctrl+C** and restart it from `frontend` using `npm.cmd run dev -- --force`. This rebuilds Vite's local dependency cache; then download the PDF again. |

---

<div align="center">

**Organise → Prepare → Review → Assess**

Built for a clear examination workflow, transparent local ML and college-controlled data.

[Back to top ↑](#top) · [Start the app](#run-on-your-laptop) · [Study the code](#code-walkthrough) · [Read the model card](backend/ml/MODEL_CARD.md)

</div>
