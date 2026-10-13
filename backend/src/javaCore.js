import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HttpError } from './errors.js';

const source = fileURLToPath(new URL('../../core/src/PaperEngine.java', import.meta.url));

function runCore(mode, total, count, split, pool = [], markCounts) {
  return new Promise((resolve, reject) => {
    // Source-file launch requires JDK 17+. No shell, server port or Java dependency is needed.
    const child = spawn(process.env.JAVA_COMMAND || 'java', [source], { windowsHide: true });
    const input = [mode, [total, count, split.easy, split.medium, split.hard, ...(markCounts ? [2, 5, 10, 16].map(m => markCounts[m]) : [])].join('\t'),
      ...pool.map(q => [q.id, q.difficulty, q.marks].join('\t'))].join('\n') + '\n';
    let output = '';
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new HttpError(503, 'Java paper engine timed out. Please try again.'));
    }, 15000);
    child.on('error', () => finish(new HttpError(503, 'Java core is unavailable. Install JDK 17+ and make java available on PATH.')));
    child.stdin.on('error', () => {}); // A failed launch is reported through child error/close.
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.length > 1_000_000) {
        child.kill();
        finish(new HttpError(502, 'Java core returned too much output'));
      }
    });
    child.stderr.resume();
    child.on('close', code => {
      if (code === 2) return finish(new HttpError(400, 'Cannot build this marks pattern. Use a total achievable with 2, 5, 10 or 16 marks, at most 50 questions, and check bank availability.'));
      if (code !== 0) return finish(new HttpError(503, 'Java core failed. Check your JDK installation and paper parameters.'));
      try { finish(null, JSON.parse(output)); }
      catch { finish(new HttpError(502, 'Java core returned an invalid result')); }
    });
    child.stdin.end(input);
  });
}

export const planPaper = (total, count, split, markCounts) => runCore(markCounts ? 'PLAN_FIXED' : 'PLAN', total, count, split, [], markCounts);

export async function generatePaper(pool, total, split, markCounts, count = 0) {
  const result = await runCore(markCounts ? 'SELECT_FIXED' : 'SELECT', total, count, split, pool, markCounts);
  const byId = new Map(pool.map(q => [q.id, q]));
  return { questions: result.ids.map(id => byId.get(id)), totalMarks: result.totalMarks, targets: result.targets };
}
