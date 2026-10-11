/**
 * Balanced paper generation - same idea as the Java version.
 *
 * Pass 1: for each difficulty level, take the highest-mark questions that still fit that level's
 *         marks target (a priority queue by marks = "sort descending and take from the front").
 * Pass 2: fill the remaining marks from the leftovers, largest first.
 */
export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const byMarksDesc = (a, b) => b.marks - a.marks;

export function generatePaper(pool, totalMarks, split, rng = Math.random) {
  const easyT = Math.round((totalMarks * split.easy) / 100);
  const medT = Math.min(Math.round((totalMarks * split.medium) / 100), totalMarks - easyT);
  const hardT = totalMarks - easyT - medT;
  const targets = { EASY: easyT, MEDIUM: medT, HARD: hardT };

  const chosen = [];
  const rest = [];
  let sum = 0;

  for (const level of ['EASY', 'MEDIUM', 'HARD']) {
    const queue = shuffle(pool.filter((q) => q.difficulty === level), rng).sort(byMarksDesc);
    let levelSum = 0;
    for (const q of queue) {
      if (levelSum + q.marks <= targets[level]) {
        chosen.push(q);
        levelSum += q.marks;
      } else {
        rest.push(q);
      }
    }
    sum += levelSum;
  }

  rest.sort(byMarksDesc);
  for (const q of rest) {
    if (sum >= totalMarks) break;
    if (sum + q.marks <= totalMarks) {
      chosen.push(q);
      sum += q.marks;
    }
  }

  chosen.sort((a, b) => a.marks - b.marks || a.id - b.id);
  return { questions: chosen, totalMarks: sum, targets };
}
