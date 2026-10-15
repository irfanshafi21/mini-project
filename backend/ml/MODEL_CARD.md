# Local syllabus question model — version 1

This is a small **trained topic-type classifier plus a template-based question generator**. It is not a newly trained neural language model and does not match the expressive range of Groq's hosted LLM. Local inference uses JavaScript on the CPU, without API keys, cloud calls or Python at runtime.

## How it was built

1. Hand-author and label 64 example topics as `concept`, `process`, `comparison` or `numerical`.
2. Split by unique topic with seed 21: 48 training topics and 16 held-out test topics. No overlap.
3. Extract word tokens and character trigrams.
4. Train multinomial Naive Bayes with add-one smoothing and learned class priors.
5. Save the learned probabilities to `model.json`; `localModel.js` performs inference.
6. The predicted topic family chooses a pool of eight authored question patterns. Java supplies marks and requested difficulty; pattern ordering provides a heuristic complexity preference, not a validated difficulty prediction.
7. Extract topic/unit headings from PDF/TXT and spread questions across topics. Store normalised question hashes per subject and syllabus fingerprint to exclude previous outputs.

## Evaluation

See `evaluation.json` for exact predictions, confusion matrix and macro F1. The initial held-out classification accuracy is **13/16 = 81.25%**, on a small synthetic benchmark. This is **not 81.25% question correctness**, syllabus relevance, examination suitability, or difficulty accuracy. No faculty-reviewed educational evaluation has been completed. More real labelled topics and independently reviewed generated papers are needed before academic deployment.

Automated API tests additionally check multi-unit bank filtering, repeat-upload novelty, inferred save units, no-save behaviour and duplicate-safe saving. These are software checks, not learning metrics.

## Train again

From the repository root, with Python 3 installed:

```powershell
python backend/ml/train.py
```

Training uses only Python's standard library. All training/test records, weights and evaluation results are checked into this folder for reproducibility. Restart the backend after retraining so it reloads weights.

For real faculty labels, create a JSON file with an `examples` array of `{ "topic": "...", "label": "concept" }` records and run:

```powershell
python backend/ml/train.py --dataset faculty-topics.json
```

Use the four supported labels and at least eight unique topics per class. Keep topics from one source group together in a separate external evaluation when assessing generalisation; the simple CLI split is topic-disjoint, not institution-disjoint. Do not repeatedly tune against the same final test set.

## Limits and repetition

There are eight candidate texts per distinct extracted topic. A repeated local-mode upload cannot reuse a previously returned normalised question text for that subject and syllabus while its database history remains intact. No finite generator can promise unlimited new questions. Exhaustion returns HTTP 409 instead of recycling questions or appending meaningless random identifiers. Concurrent conflicts also return 409 for a fresh attempt. API providers are optional alternatives; this local novelty guarantee applies to local mode.

Unit parsing recognises Unit 1–5 and Unit I–V. Unlabelled content defaults to Unit 1; verify and edit bank entries if the document uses another structure. Topic parsing is heuristic. Questions can be generic, awkward, or incorrectly categorised. Faculty must review them. Bloom-level modelling is not implemented in this stage.

Generation history contains hashes and timestamps, not question-bank rows. Choosing No in the save popup leaves the question bank unchanged, but consumes those variations to prevent repetition on the next upload.
