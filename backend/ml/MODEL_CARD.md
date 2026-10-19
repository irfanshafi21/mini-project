# Local question-generation models

This project does not use a hosted AI service or a downloaded foundation model. Python trains compact Naive Bayes classifiers, and JavaScript uses the saved weights. Question wording still comes from authored task grammars, checked objective facts and numerical factories. The classifier does not learn to write arbitrary new prose like an LLM.

## Training from the supplied exam archive

`train_from_archive.py` reads the user's ZIP in place and uses only the GATE Computer Science papers. The text-based 2022 paper supplies training examples; 2023 is held out by year. The archive's 2020–21 CS papers do not provide enough extractable question text for this run. The syllabus PDF is useful as topic reference but does not contain labeled question examples.

The archive has no Bloom labels. To make a small candidate dataset, the trainer labels only questions containing a unique action verb from the college's `bloom-verbs.json` chart. The archive added 45 weakly labeled 2022 questions to 36 authored examples. It found 46 weakly labeled 2023 questions for the held-out check. GATE's multiple-choice wording yielded no clear K2 training examples and very few K3/K4/K6 examples.

On those chart-derived 2023 labels, the previous classifier reached 19.6% accuracy and 0.135 macro-F1; the archive-trained candidate reached 73.9% accuracy and 0.250 macro-F1. This is agreement with the verb-based labels, not validated Bloom-level accuracy. The labels are imbalanced and are not faculty annotations. The paper set is small, so these numbers should not be used to claim academic correctness. The built-in 24-question synthetic benchmark reaches 24/24 when the clear opening-verb rule is applied; that benchmark checks that the app respects the selected K level, not that a question is educationally sound.

The source ZIP and extracted question text are not copied into this repository. The training report contains counts and aggregate metrics only. To reproduce training on Windows from the `backend` folder:

```powershell
python -m pip install -r ml/requirements-training.txt
python ml/train_from_archive.py --archive "C:\Users\YOUR_NAME\Downloads\All_Past_Exam_Papers_with_Syllabi.zip" --integrate
```

The trainer evaluates the new weights before promotion. It leaves the current model intact if the held-out macro-F1 or the authored benchmark check regresses. `archive-evaluation.json` records the run. The selected model is saved in both `bloom-model.json` and the embedded `bloomModel` in `model.json`.

## Generation limits and validation

Java plans marks and difficulty slots. Syllabus topics are expanded through authored grammars; Bloom task predictions rank candidates, and selected opening verbs are checked against the college chart. MCQ and fill-in-the-blank generation needs checked facts or numerical factories. Repetition checking uses normalized hashes and known signatures with the configured 20% historical pattern budget. This is a finite local candidate system, not an unlimited paraphrase model.

Automatically generated examples and chart-inferred labels are not independent validation. Faculty-labelled questions, a separate real-paper evaluation set and subject-matter review are required to establish educational accuracy. Numerical answers and technical correctness need their own tests.

The runtime classifier now recognizes an unambiguous college-chart task verb after common prompt lead-ins such as "Using the diagram," or "Given the input values,". Shared verbs and questions without a clear task opener still use the trained text classifier. This improves rule coverage for those phrased prompts; it does not establish a higher real-world accuracy score.

## Model files

- `dataset.json`, `supplemental.json`: topic classifier's authored training, validation and synthetic evaluation data.
- `bloom-dataset.json`, `bloom-verbs.json`: authored Bloom tasks and the college's verb chart.
- `train.py`, `train_bloom.py`, `train_reviewed.py`: topic and Bloom training routines.
- `train_from_archive.py`: guarded GATE CS PDF extraction, weak-label training and held-out evaluation.
- `requirements-training.txt`: PDF text extraction dependency used only when training from an archive.
- `model.json`, `bloom-model.json`, `evaluation.json`, `archive-evaluation.json`: trained weights and aggregate reports.
