# Our local question-generation ML system

No pretrained language model or external AI service is used. Python trains our own topic-type and Bloom-task Naive Bayes classifiers; JavaScript performs inference from the saved weights. Question writing is constrained composition from authored grammars, curated objective facts and numerical factories. It is not a learned free-form neural language model.

## Data and measured results

The bundled topic model uses 176 curated training examples, with a separate 32-topic validation set for choosing feature settings. It scores 13/16 (81.25%) on the original synthetic topic holdout and 47/48 (97.92%) on the expanded synthetic benchmark. The Bloom model starts with 36 authored training examples and scores 24/24 on a small synthetic holdout with shared wording templates. These figures measure classification only. They do not measure question correctness, syllabus relevance, realistic difficulty or faculty acceptance.

## Generation and bounds

Java plans marks/difficulty slots. Extracted syllabus topics produce candidate tasks scoped to marks and the requested K1–K6 allocation. Learned Bloom predictions rank candidates. Opening verbs must match the college list. MCQ/blank generation requires supported checked facts or numerical factories; unavailable K/mark combinations fail clearly. Repetition is checked through normalised hashes and known signatures, with a 20% historical pattern budget rounded down. This is a finite candidate system, not an unlimited paraphrase model.

## Training after generation

Locally generated examples can become pseudo-labelled training records when structural checks pass and the model agrees with the assigned K level. Manual/faculty examples require their own review path. New local training excludes historical cloud-labelled records. Held-out rows and conflicting labels are excluded. Candidates activate only when the configured classification checks do not regress; the previous model otherwise remains active.

Self-training is not independent validation and cannot guarantee improving accuracy. Classifier agreement is not proof of correct subject knowledge. Real faculty-labelled data, a separate real-question evaluation set and periodic question-quality audits remain necessary. The runtime model is in ignored `.runtime/active-model.json`; training reports are stored in PostgreSQL.

## Files

- `dataset.json`, `supplemental.json`: topic train/validation/test records.
- `bloom-dataset.json`, `bloom-verbs.json`: cognitive-task examples and college verbs.
- `train_reviewed.py`: current balanced trainer and evaluation/promotion inputs.
- `train_bloom.py`: Bloom training implementation.
- `model.json`, `bloom-model.json`, `evaluation.json`: locally trained weights and reproducible synthetic evaluation.
- `train.py`: underlying topic feature extraction and baseline trainer. Running its command-line entry point rebuilds the smaller original baseline, not the expanded current model.

No Python libraries outside the standard library are required.
