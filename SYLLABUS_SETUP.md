# Syllabus question paper generation

The React frontend uploads a PDF or UTF-8 TXT syllabus (maximum 5 MB). The Express backend sends it to Gemini and returns new questions with topic references. This uses an external generative model; it does not train a local ML model. Generated questions are not automatically saved to the question bank.

## Run

1. In `backend`, run `npm install`, copy `.env.example` to `.env`, and set `GEMINI_API_KEY` to your own valid Google AI Studio key. Never put this key in frontend code. `GEMINI_MODEL` is configurable.
2. Configure PostgreSQL as explained in `backend/README.md`, then run `npm run db:init` and `npm start`.
3. In `frontend`, run `npm install` and `npm run dev`. For a different backend address, copy `.env.example` to `.env.local` and update `VITE_API_URL`.
4. Open the frontend, use **Generate from Syllabus**, choose the file, total marks, question count and difficulty percentages, then generate. Download the result as TXT.

The syllabus endpoint itself does not require PostgreSQL. Existing question bank features do.

## Behavior and limits

- Percentages apply to question counts, rounded using largest remainders. Marks are distributed evenly, with any remainder assigned to the first questions. Total marks are exact.
- Documents are sent to Google Gemini. Files are held in memory for the request and are not saved by this app.
- Every question includes a syllabus reference. Review these for accuracy: structural validation does not prove that every question is grounded in the document.
- Invalid/unreadable documents, quota errors, network errors, incomplete output and exact duplicate questions produce errors rather than partial papers.
- The API has no authentication, like the existing app. Add authentication and rate limits before making a paid Gemini endpoint publicly accessible.
- Model availability and billing depend on your Google account. Set `GEMINI_MODEL` if the default model is unavailable.

## API

`POST /api/papers/from-syllabus` takes JSON:

```json
{
  "fileName": "syllabus.pdf",
  "mimeType": "application/pdf",
  "data": "BASE64_FILE_CONTENTS",
  "totalMarks": 50,
  "count": 10,
  "split": { "easy": 40, "medium": 40, "hard": 20 }
}
```

Tests without a database or live key: `node --test test/syllabus.test.js` from backend. Full existing API tests require a dedicated PostgreSQL test database. Frontend: `npm run build`.
