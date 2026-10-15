import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Java owns paper planning and selection. Node supplies validated metadata over stdin. */
public class PaperEngine {
    private static final String[] LEVELS = { "EASY", "MEDIUM", "HARD" };
    private record Question(int id, String difficulty, int marks) {}

    public static void main(String[] args) throws Exception {
        try (var reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8))) {
            String mode = reader.readLine();
            String[] fields = Objects.requireNonNull(reader.readLine(), "Missing parameters").split("\\t");
            int total = Integer.parseInt(fields[0]);
            int count = Integer.parseInt(fields[1]);
            double[] split = { Double.parseDouble(fields[2]), Double.parseDouble(fields[3]), Double.parseDouble(fields[4]) };
            if (total < 1 || total > 1000 || Arrays.stream(split).anyMatch(n -> !Double.isFinite(n) || n < 0 || n > 100)
                    || Math.abs(Arrays.stream(split).sum() - 100) >= 0.001) throw new IllegalArgumentException("Invalid paper parameters");
            int[] pattern = fields.length == 10 ? new int[] { Integer.parseInt(fields[5]), Integer.parseInt(fields[6]), Integer.parseInt(fields[7]), Integer.parseInt(fields[8]), Integer.parseInt(fields[9]) } : null;
            if (pattern != null && Arrays.stream(pattern).anyMatch(n -> n < 0 || n > 50)) throw new IllegalArgumentException("Invalid marks counts");
            if ("PLAN_FIXED".equals(mode)) {
                List<Integer> marks = marksPlan(total, count, pattern);
                if (marks == null) { System.exit(2); return; }
                System.out.println(fixedPlan(marks, split));
            } else if ("PLAN".equals(mode)) {
                if (count < 1 || count > 50 || total < count || total > count * 100) throw new IllegalArgumentException("Invalid question count");
                System.out.println(plan(total, count, split));
            } else if (("SELECT".equals(mode) || "SELECT_FIXED".equals(mode))) {
                List<Question> pool = new ArrayList<>();
                Set<Integer> ids = new HashSet<>();
                for (String line; (line = reader.readLine()) != null;) {
                    String[] q = line.split("\\t");
                    var question = new Question(Integer.parseInt(q[0]), q[1], Integer.parseInt(q[2]));
                    if (question.id < 1 || question.marks < 1 || question.marks > 100 || !List.of(LEVELS).contains(question.difficulty)
                            || !ids.add(question.id)) throw new IllegalArgumentException("Invalid question metadata");
                    pool.add(question);
                }
                if ("SELECT_FIXED".equals(mode)) {
                    String result = fixedSelect(pool, total, count, split, pattern);
                    if (result == null) { System.exit(2); return; }
                    System.out.println(result);
                } else System.out.println(select(pool, total, split));
            } else throw new IllegalArgumentException("Unknown operation");
        }
    }

    private static final int[] MARKS = { 1, 2, 5, 10, 16 };
    static List<Integer> marksPlan(int total, int count, int[] pattern) {
        if (count < 0 || count > 50 || pattern == null) return null;
        List<Integer> manual = new ArrayList<>();
        for (int i = 0; i < MARKS.length; i++) for (int j = 0; j < pattern[i]; j++) manual.add(MARKS[i]);
        if (!manual.isEmpty()) return manual.size() <= 50 && (count == 0 || count == manual.size()) && manual.stream().mapToInt(Integer::intValue).sum() == total ? manual : null;
        int[][] prev = new int[51][total + 1];
        for (int[] row : prev) Arrays.fill(row, -1);
        prev[0][0] = 0;
        for (int n = 1; n <= 50; n++) for (int sum = 1; sum <= total; sum++)
            for (int m : MARKS) if (sum >= m && prev[n - 1][sum - m] >= 0) { prev[n][sum] = m; break; }
        int n = count;
        if (n == 0) { for (n = 1; n <= 50 && prev[n][total] < 0; n++); }
        if (n > 50 || prev[n][total] < 0) return null;
        List<Integer> result = new ArrayList<>();
        for (int sum = total; n > 0; n--) { int m = prev[n][sum]; result.add(m); sum -= m; }
        Collections.sort(result); return result;
    }
    static String fixedPlan(List<Integer> marks, double[] split) {
        int[] counts = new int[3]; double[] fractions = new double[3];
        for (int i = 0; i < 3; i++) { double raw = marks.size() * split[i] / 100; counts[i] = (int)Math.floor(raw); fractions[i] = raw - counts[i]; }
        Integer[] order = {0,1,2}; Arrays.sort(order, Comparator.comparingDouble((Integer i) -> fractions[i]).reversed());
        for (int i = 0, left = marks.size() - Arrays.stream(counts).sum(); i < left; i++) counts[order[i]]++;
        StringJoiner json = new StringJoiner(",", "[", "]"); int number = 0;
        for (int level = 0; level < 3; level++) for (int j = 0; j < counts[level]; j++) {
            int m = marks.get(number++);
            json.add("{\"number\":" + number + ",\"difficulty\":\"" + LEVELS[level] + "\",\"marks\":" + m + "}");
        }
        return json.toString();
    }
    static String fixedSelect(List<Question> pool, int total, int count, double[] split, int[] pattern) {
        if (pattern == null || count < 0 || count > 50) return null;
        List<Question> chosen = new ArrayList<>();
        if (Arrays.stream(pattern).sum() > 0) {
            if (marksPlan(total, count, pattern) == null) return null;
            int[] actual = new int[3];
            for (int i = 0; i < MARKS.length; i++) for (int j = 0; j < pattern[i]; j++) {
                final int mark = MARKS[i];
                Question best = pool.stream().filter(q -> q.marks == mark && !chosen.contains(q))
                    .max(Comparator.comparingDouble(q -> { int level = List.of(LEVELS).indexOf(q.difficulty); return total * split[level] / 100 - actual[level]; })).orElse(null);
                if (best == null) return null;
                chosen.add(best); actual[List.of(LEVELS).indexOf(best.difficulty)] += best.marks;
            }
        } else {
            // Bounded subset-sum: each active question can be used once.
            record Path(Question question, Path previous) {}
            Path[][] dp = new Path[51][total + 1];
            List<Question> sorted = new ArrayList<>(pool);
            sorted.sort(Comparator.comparingDouble((Question q) -> split[List.of(LEVELS).indexOf(q.difficulty)]).reversed());
            for (Question q : sorted) {
                if (Arrays.stream(MARKS).noneMatch(m -> m == q.marks)) continue;
                for (int n = 50; n >= 1; n--) for (int sum = total; sum >= q.marks; sum--)
                    if (dp[n][sum] == null && ((n == 1 && sum == q.marks) || dp[n - 1][sum - q.marks] != null))
                        dp[n][sum] = new Path(q, dp[n - 1][sum - q.marks]);
            }
            int n = count;
            if (n == 0) for (n = 1; n <= 50 && dp[n][total] == null; n++);
            if (n > 50 || dp[n][total] == null) return null;
            for (Path path = dp[n][total]; path != null; path = path.previous) chosen.add(path.question);
        }
        chosen.sort(Comparator.comparingInt(Question::marks).thenComparingInt(Question::id));
        StringJoiner ids = new StringJoiner(",", "[", "]"); for (Question q : chosen) ids.add("" + q.id);
        int easy = (int)Math.round(total * split[0] / 100), medium = Math.min((int)Math.round(total * split[1] / 100), total - easy);
        return "{\"ids\":" + ids + ",\"totalMarks\":" + total + ",\"targets\":{\"EASY\":" + easy + ",\"MEDIUM\":" + medium + ",\"HARD\":" + (total-easy-medium) + "}}";
    }

    static String plan(int total, int count, double[] split) {
        int[] counts = new int[3];
        double[] fractions = new double[3];
        for (int i = 0; i < 3; i++) {
            double raw = count * split[i] / 100;
            counts[i] = (int) Math.floor(raw);
            fractions[i] = raw - counts[i];
        }
        Integer[] order = { 0, 1, 2 };
        Arrays.sort(order, Comparator.comparingDouble((Integer i) -> fractions[i]).reversed());
        int remainder = count - Arrays.stream(counts).sum();
        for (int i = 0; i < remainder; i++) counts[order[i]]++;
        StringJoiner json = new StringJoiner(",", "[", "]");
        int number = 0;
        for (int level = 0; level < 3; level++) {
            for (int i = 0; i < counts[level]; i++) {
                int marks = total / count + (number < total % count ? 1 : 0);
                json.add("{\"number\":" + (++number) + ",\"difficulty\":\"" + LEVELS[level] + "\",\"marks\":" + marks + "}");
            }
        }
        return json.toString();
    }

    static String select(List<Question> pool, int total, double[] split) {
        int easy = (int) Math.round(total * split[0] / 100);
        int medium = Math.min((int) Math.round(total * split[1] / 100), total - easy);
        int[] targets = { easy, medium, total - easy - medium };
        List<Question> chosen = new ArrayList<>(), rest = new ArrayList<>();
        Comparator<Question> byMarks = Comparator.comparingInt(Question::marks).reversed();
        int sum = 0;
        for (int level = 0; level < 3; level++) {
            List<Question> queue = new ArrayList<>();
            for (Question q : pool) if (q.difficulty.equals(LEVELS[level])) queue.add(q);
            Collections.shuffle(queue);
            queue.sort(byMarks);
            int levelSum = 0;
            for (Question q : queue) {
                if (levelSum + q.marks <= targets[level]) { chosen.add(q); levelSum += q.marks; }
                else rest.add(q);
            }
            sum += levelSum;
        }
        rest.sort(byMarks);
        for (Question q : rest) if (sum + q.marks <= total) { chosen.add(q); sum += q.marks; }
        chosen.sort(Comparator.comparingInt(Question::marks).thenComparingInt(Question::id));
        StringJoiner ids = new StringJoiner(",", "[", "]");
        for (Question q : chosen) ids.add(Integer.toString(q.id));
        return "{\"ids\":" + ids + ",\"totalMarks\":" + sum + ",\"targets\":{\"EASY\":" + targets[0]
                + ",\"MEDIUM\":" + targets[1] + ",\"HARD\":" + targets[2] + "}}";
    }
}
