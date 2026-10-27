<a id="top"></a>

<div align="center">

<img src="docs/images/readme-cover.svg" alt="Question Bank and Paper Generator" width="100%" />

# Question Bank & Paper Generator

### Turn a syllabus into a draft exam paper you can review, edit and print.

**A plain-language guide to using the app and understanding how it works.**

<p align="center">
  <a href="#run-the-project"><img src="https://img.shields.io/badge/Run%20it-Start%20here-2f789e?style=for-the-badge" alt="Run the project" /></a>
  <a href="#how-a-paper-is-made"><img src="https://img.shields.io/badge/See%20the%20workflow-How%20it%20works-416f8b?style=for-the-badge" alt="See the workflow" /></a>
  <a href="#how-the-question-maker-works"><img src="https://img.shields.io/badge/Question%20maker-How%20it%20works-416f8b?style=for-the-badge" alt="Understand the question maker" /></a>
  <a href="#learn-the-project"><img src="https://img.shields.io/badge/Study%20the%20code-Learn%20the%20project-17364b?style=for-the-badge" alt="Study the code" /></a>
</p>

</div>

> **In one sentence:** Upload a syllabus, choose units and question settings, then review and export the draft paper. A teacher should check questions before using them in an exam.

## The project, at a glance

~~~mermaid
flowchart LR
  A[Choose a syllabus or saved questions] --> B[Choose units, marks and K levels]
  B --> C[Create a draft paper]
  C --> D[Review and edit questions]
  D --> E[Save, print or download PDF]
~~~

### Where do I go in the website?

~~~mermaid
flowchart LR
  Welcome[Welcome page] -->|Open workspace| Home[Dashboard]
  Home --> Create[Create a paper]
  Home --> Bank[Question bank]
  Home --> Subjects[Subjects]
  Home --> Saved[Stored papers]
  Create -->|Syllabus paper| Upload[Upload and inspect syllabus]
  Create -->|Reuse saved questions| Select[Select bank questions]
  Upload --> Configure[Choose units and paper settings]
  Select --> Configure
  Configure --> Preview[Review generated paper]
  Preview --> Saved
~~~

The dashboard is the starting point. **Create a paper** has two routes: generate from a syllabus, or build from questions already saved in the question bank. A finished draft appears in the preview and is also saved under **Stored papers**.

### What can I do?

| I want to… | The app lets me… |
| --- | --- |
| Make questions from my course | Upload a readable PDF, TXT file or clear syllabus photo, then choose units. |
| Choose question difficulty | Set marks, question style and Bloom K1–K6 levels for each marks section. |
| Reuse questions | Add generated questions to the bank and use them in another paper. |
| Keep my papers | Open, edit, print or download saved papers. |

## How a paper is made

~~~mermaid
flowchart TB
  subgraph Browser[What you do in the website]
    A[Choose PDF, TXT or syllabus photo] --> B[App reads the file and finds unit headings]
    B --> C[Choose all units or selected units]
    C --> D[Set marks, question style and K1 to K6 counts]
    D --> E[Press Generate]
    K[Review and edit the draft] --> L[Print or download PDF or TXT]
    K --> M[Optionally add questions to the question bank]
  end
  subgraph Server[What the backend does]
    F[Check the request and paper totals] --> G[Java plans marks and Bloom fills each slot]
    G --> H[Round-robin assign each slot to a selected unit and syllabus topic]
    H --> I[Find supporting syllabus lines]
    I --> J[Ask the configured AI provider to draft questions]
    J --> N[Check the returned questions]
    N --> O[Save the complete paper]
  end
  E --> F
  O --> K
~~~

The selected syllabus content guides question generation. The app skips book names, authors and other document details as exam topics. A blurry scan may be hard to read, so use a clear PDF or photo.

### What happens at each stage?

| Stage | In everyday words | What the app prepares |
| --- | --- | --- |
| **1. Inspect** | The website sends the selected file to the backend. | Readable text, detected unit numbers and topics. The unit choices are based on the uploaded syllabus. |
| **2. Configure** | You choose units and paper requirements. | A list of question slots, each with its marks, question style, Bloom level and difficulty. |
| **3. Find evidence** | The question maker looks up the assigned topic. | BM25 ranks passages from that unit so the prompt has relevant syllabus wording to use. |
| **4. Draft** | Gemini or Groq writes the question text. | Structured question data, including the topic, subtopic and any needed problem data. |
| **5. Check** | The backend checks the draft against the request. | Question count, marks, units, topic wording, Bloom level, question style, and objective-question fields. |
| **6. Save and review** | The website displays the paper. | A stored-paper record, followed by the preview where you can review, edit and export. |

If a generated batch fails its checks, the generator makes one correction attempt. If it still fails, the backend returns an error instead of saving an incomplete paper. Separate whole-paper checks can also stop saving when unit balance or the repeat limit is not met. A passed format check still cannot prove every technical fact or calculation, so a subject expert should review the paper.

## How the question maker works

~~~mermaid
flowchart TB
  Syllabus[Uploaded syllabus text] --> Parse[Split text into unit passages and topics]
  Settings[Marks, styles and Bloom counts] --> Planner[Create exact question slots]
  Parse --> Scope[Keep topics from selected units]
  Planner --> Scope
  Scope --> Search[BM25 ranks passages inside the assigned unit]
  Search --> Prompt[Build one structured request using topic, evidence and slot rules]
  Prompt --> Provider{Which provider is configured?}
  Provider -->|Primary| AI[Gemini or Groq API]
  Provider -. configured fallback if the primary service fails .-> Backup[Optional fallback API]
  AI --> Normalize[Parse and normalize the response]
  Backup --> Normalize
  Normalize --> Review[Run question and whole-paper checks]
  Review -->|Pass| Paper[Save and show the draft paper]
  Review -->|Needs correction| Repair[Ask provider to correct the draft]
  Repair --> Normalize
  Local[Small local ML classifiers] -. assist topic and Bloom classification .-> Review
~~~

- **BM25** is built-in text search. It finds syllabus lines related to a question topic.
- **Gemini or Groq** is the online AI service that writes the question wording. Its key belongs in the backend settings, never in the website code or GitHub.
- **Local ML** means small classifiers included in this project. They help label topic types and Bloom levels. They are not a local ChatGPT-style writer.
- **Checks** look for things such as question count, marks, selected units, Bloom words, required numerical data and repeated wording. Passing these checks does not prove that every question is factually correct. A teacher still needs to review the paper.

### How unit distribution works: round robin

Round robin means the planner takes turns through the selected units when assigning question slots. The AI receives each slot with its unit and topic already assigned; it does not choose a unit at random. Within a unit, the planner also moves through the topics found in that unit.

~~~mermaid
flowchart LR
  Q1[Question 1] --> U1[Unit 1]
  Q2[Question 2] --> U2[Unit 2]
  Q3[Question 3] --> U3[Unit 3]
  Q4[Question 4] --> U1
  Q5[Question 5] --> U2
  Q6[Question 6] --> U3
~~~

For example, with 3 selected units and 8 questions in one marks section, the cycle assigns **3 questions to Unit 1, 3 to Unit 2, and 2 to Unit 3**. The starting unit can shift between marks sections so sections do not all begin with the same unit. The app checks the finished paper and each marks section; where there are enough questions, unit counts must differ by no more than one. If the selected units or available topics cannot meet that balance, generation reports the issue instead of silently claiming even coverage.

~~~mermaid
flowchart LR
  Request[Question slot] --> Prompt[Question prompt]
  Evidence[Relevant lines from selected unit] --> Prompt
  Topic[Exact syllabus topic and subtopic] --> Prompt
  Bloom[Requested Bloom action and difficulty] --> Prompt
  Style[Theory, problem or mixed style] --> Prompt
  Prompt --> Draft[AI draft]
  Draft --> Check1{Correct count and marks?}
  Check1 -->|Yes| Check2{Right unit, topic and Bloom level?}
  Check1 -->|No| Fix[Correction attempt]
  Check2 -->|Yes| Check3{Matches style and has enough data?}
  Check2 -->|No| Fix
  Check3 -->|Yes| Accept[Include in paper]
  Check3 -->|No| Fix
  Fix --> Draft
~~~

This is why a Bloom label is only one part of the check. The question must also ask students to do the kind of thinking expected at that level, and its facts and task should stay connected to the selected syllabus topic.

### What does “training” mean here?

~~~mermaid
flowchart LR
  A[Saved paper] --> B[Local review checks it]
  B --> C[Eligible examples are collected]
  C --> D[Python updates small classifiers]
  D --> E[New classifier is kept if checks pass]
~~~

This learning can update the small classifiers in this project. It does **not** train Gemini or Groq, and it does not automatically make every question more accurate. Questions reviewed by subject teachers are more useful learning examples.

## Bloom levels and difficulty

| Level | Plain meaning | Expected difficulty |
| --- | --- | --- |
| **K1 — Remember** | Recall a fact or name | Easy |
| **K2 — Understand** | Explain an idea | Easy |
| **K3 — Apply** | Use a rule or method on a given case | Medium |
| **K4 — Analyze** | Break something down and explain how parts relate | Medium |
| **K5 — Evaluate** | Judge choices using technical reasons | Hard |
| **K6 — Create** | Design a solution that follows stated limits | Hard |

The system checks the requested K level and its opening word. The word alone cannot prove the thinking level, so review what the question actually asks students to do.

## Units and the CO label

~~~mermaid
flowchart LR
  A[Uploaded syllabus] --> B[Find Unit 1, Unit 2…]
  B --> C[Teacher selects units]
  C --> D[Questions are spread across selected units]
  D --> E[Paper shows CO1, CO2…]
~~~

The unit choices come from headings found in the uploaded syllabus. The app accepts numbered and Roman-numbered headings. When all units are selected, it tries to spread questions across them. Each marks section is checked separately when there are enough questions.

The paper displays **CO1**, **CO2**, and similar labels beside Bloom levels, as requested. The number comes from the syllabus unit number. The app does not check whether this matches the college’s official Course Outcome mapping.

### A look inside the app

<table>
  <tr>
    <td align="center" width="50%"><img src="docs/images/readme-workspace.svg" alt="Question Bank workspace dashboard" width="100%" /><br /><b>Workspace</b></td>
    <td align="center" width="50%"><img src="docs/images/readme-builder.svg" alt="Question paper builder with syllabus, units and Bloom levels" width="100%" /><br /><b>Paper builder</b></td>
  </tr>
</table>

The paper preview below shows a **CO1** course-outcome label beside each Bloom level. In the real app, the CO number follows the detected syllabus unit.

<img src="docs/images/readme-paper.svg" alt="Example question paper layout" width="100%" />

## Run the project

### What you need

- **Node.js** to run the website and backend.
- **PostgreSQL** to store subjects, questions and saved papers.
- **Java JDK 17 or newer** for marks and paper planning.
- **A Gemini or Groq API key** and internet access to write syllabus questions.
- **Python 3** only when retraining the small local classifiers.

### 1. Get the code and create a database

Open the project folder in VS Code. In pgAdmin, create a database named **questionbank**.

~~~powershell
git clone https://github.com/irfanshafi21/mini-project.git
cd mini-project
~~~

### 2. Start the backend

Open a VS Code terminal:

~~~powershell
cd backend
npm.cmd install
Copy-Item .env.example .env
~~~

Open **backend/.env** and fill in your own private values:

~~~dotenv
DATABASE_URL=postgresql://postgres:YOUR_DATABASE_PASSWORD@localhost:5432/questionbank
PORT=4000
AI_PROVIDER=gemini
AI_FALLBACK_PROVIDER=
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=gemini-3.8-flash
~~~

For Groq, set **AI_PROVIDER=groq** and add **GROQ_API_KEY** and **GROQ_MODEL**. Optional extra keys are listed in **backend/.env.example**. Never share or commit the real **.env** file.

Initialize the database and start the backend:

~~~powershell
npm.cmd run db:init
npm.cmd start
~~~

Keep this terminal open. The backend should answer at [localhost:4000/api/health](http://localhost:4000/api/health).

### 3. Start the website

Open a second VS Code terminal at the project folder:

~~~powershell
cd frontend
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
~~~

Open the local address Vite prints, usually [localhost:5173](http://localhost:5173).

~~~mermaid
flowchart LR
  A[Terminal 1: backend] --> C[Browser: localhost:5173]
  B[Terminal 2: website] --> C
  D[(PostgreSQL)] --> A
~~~

## Follow one example

~~~mermaid
flowchart TD
  A[Upload a course syllabus] --> B[Select Unit 1 and Unit 2]
  B --> C[Choose ten 2-mark questions]
  C --> D[Set K counts that add up to ten]
  D --> E[Generate a draft]
  E --> F[Check units, topics and wording]
  F --> G[Edit, save or download]
~~~

The K counts for each marks section must add up to that section’s question count. The question marks must add up to the paper total. When enough questions are requested, a marks section is checked for balanced unit coverage; its unit counts should differ by no more than one. A paper can contain up to **100 questions** and **1,000 marks**. The syllabus repeat policy allows up to **20%** of earlier questions, rounded down.

## Learn the project

Read these files in order. Each one answers a simple question.

| Step | Question | File |
| --- | --- | --- |
| **1. Website** | What do I see and click? | [![App.jsx](https://img.shields.io/badge/App.jsx-Open-2f789e?style=for-the-badge)](frontend/src/App.jsx) [![SyllabusPaper.jsx](https://img.shields.io/badge/SyllabusPaper.jsx-Open-416f8b?style=for-the-badge)](frontend/src/SyllabusPaper.jsx) |
| **2. Backend** | How does the website ask the server to work? | [![app.js](https://img.shields.io/badge/app.js-Open-2f789e?style=for-the-badge)](backend/src/app.js) [![syllabus.js](https://img.shields.io/badge/syllabus.js-Open-416f8b?style=for-the-badge)](backend/src/routes/syllabus.js) |
| **3. Syllabus search** | How does it find useful lines? | [![syllabusRetrieval.js](https://img.shields.io/badge/syllabusRetrieval.js-Open-2f789e?style=for-the-badge)](backend/src/syllabusRetrieval.js) |
| **4. Question writing** | How are questions requested and checked? | [![groqQuestionGenerator.js](https://img.shields.io/badge/groqQuestionGenerator.js-Open-2f789e?style=for-the-badge)](backend/src/groqQuestionGenerator.js) |
| **5. Paper plan** | How are marks and questions arranged? | [![PaperEngine.java](https://img.shields.io/badge/PaperEngine.java-Open-2f789e?style=for-the-badge)](core/src/PaperEngine.java) [![javaCore.js](https://img.shields.io/badge/javaCore.js-Open-416f8b?style=for-the-badge)](backend/src/javaCore.js) |
| **6. Bloom levels** | How does it use K1–K6? | [![blooms.js](https://img.shields.io/badge/blooms.js-Open-2f789e?style=for-the-badge)](backend/src/blooms.js) [![bloom-verbs.json](https://img.shields.io/badge/bloom--verbs.json-Open-416f8b?style=for-the-badge)](backend/ml/bloom-verbs.json) |
| **7. Saved papers** | Where are papers and bank questions stored? | [![schema.sql](https://img.shields.io/badge/schema.sql-Open-2f789e?style=for-the-badge)](backend/sql/schema.sql) [![db.js](https://img.shields.io/badge/db.js-Open-416f8b?style=for-the-badge)](backend/src/db.js) |
| **8. PDF output** | How is the PDF laid out? | [![paperPdf.js](https://img.shields.io/badge/paperPdf.js-Open-2f789e?style=for-the-badge)](frontend/src/paperPdf.js) |
| **9. Local learning** | How are the small classifiers updated? | [![automaticLearning.js](https://img.shields.io/badge/automaticLearning.js-Open-2f789e?style=for-the-badge)](backend/src/automaticLearning.js) [![train_reviewed.py](https://img.shields.io/badge/train__reviewed.py-Open-416f8b?style=for-the-badge)](backend/ml/train_reviewed.py) |

### Project map

~~~text
mini-project/
├── frontend/       Website pages, forms and PDF download
├── backend/        Server, question rules, syllabus search and database connection
├── core/           Java marks and paper planner
├── docs/images/    README diagrams and illustrations
└── README.md       This guide
~~~

### One request, in everyday words

~~~mermaid
sequenceDiagram
  actor Teacher
  participant Web as Website
  participant Server as Backend
  participant Search as Syllabus search
  participant AI as Gemini or Groq
  participant DB as PostgreSQL
  Teacher->>Web: Upload syllabus and choose settings
  Web->>Server: Send the syllabus and settings
  Server->>Search: Find lines about each topic
  Search-->>Server: Return matching syllabus lines
  Server->>AI: Ask for questions using those lines
  AI-->>Server: Return a draft
  Server->>Server: Check marks, units and K levels
  Server->>DB: Save the paper
  Server-->>Web: Show the paper for review
~~~

## Where information is saved

~~~mermaid
erDiagram
  SUBJECTS ||--o{ QUESTIONS : groups
  SUBJECTS ||--o{ SAVED_PAPERS : owns
  SAVED_PAPERS ||--o{ REVIEWED_EXAMPLES : may_have
  SAVED_PAPERS ||--o| AUTOMATIC_LEARNING_JOBS : may_queue
~~~

~~~mermaid
flowchart LR
  File[Your syllabus file] -->|Sent for inspection and generation| Backend[Backend]
  Backend -->|Extracted text kept briefly for the current flow| Cache[Short-lived server cache]
  Backend -->|Topic evidence and question instructions| AI[Configured Gemini or Groq service]
  Backend -->|Finished paper and questions| DB[(PostgreSQL)]
  DB --> Stored[Stored papers]
  DB --> Bank[Question bank only when you choose Add to question bank]
  Browser[Website request] --> Backend
  Secret[Provider API key stays in backend environment] --> Backend
~~~

- **Question bank:** questions that can be reused, grouped by subject and unit.
- **Stored papers:** saved copies of complete papers. Saving a paper does not automatically add questions to the bank.
- **Learning records:** review and training status; these are not bank questions.
- **Syllabus file:** sent to the backend for processing. Extracted text may be kept in a short-lived memory cache to avoid reading the same upload twice; the app does not keep a permanent syllabus library.

## If something goes wrong

| Problem | Try this |
| --- | --- |
| Website cannot reach the backend | Keep both terminals open and check the health link above. |
| Database password error | Check **DATABASE_URL** in **backend/.env**, then restart the backend. |
| No units appear | Check for headings such as **Unit I** or **Unit 1**; try a clearer scan. |
| Syllabus text is missing | Use a text PDF/TXT or a clear JPG/PNG/WebP photo. |
| API generation fails | Check the provider key, model name, internet connection and API quota. |
| Questions are not evenly spread | Select all units and request enough questions in each marks section. |
| A question needs correction | Edit it in the preview and ask a subject teacher to review it. |
| PDF looks old after an update | Refresh with **Ctrl+F5**, then download again. |

## Important to remember

- AI can make factual or calculation mistakes. Ask a subject teacher to review the paper.
- Bloom and format checks help organize questions; they cannot guarantee academic correctness.
- CO labels use the detected unit number; they are not an official outcome-mapping report.
- Local learning updates small classifiers only. It does not train the online question-writing AI.
- This project does not include user login or college-server hosting.

---

<div align="center">

**Upload → Choose → Generate → Review → Export**

<p align="center">
  <a href="#top"><img src="https://img.shields.io/badge/Back%20to%20top-↑-416f8b?style=for-the-badge" alt="Back to top" /></a>
  <a href="#run-the-project"><img src="https://img.shields.io/badge/Run%20the%20project-Start%20here-2f789e?style=for-the-badge" alt="Run the project" /></a>
  <a href="#learn-the-project"><img src="https://img.shields.io/badge/Study%20the%20code-Learn%20the%20project-17364b?style=for-the-badge" alt="Study the code" /></a>
</p>

</div>
