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
            if ("PLAN".equals(mode)) {
                if (count < 1 || count > 50 || total < count || total > count * 100) throw new IllegalArgumentException("Invalid question count");
                System.out.println(plan(total, count, split));
            } else if ("SELECT".equals(mode)) {
                List<Question> pool = new ArrayList<>();
                Set<Integer> ids = new HashSet<>();
                for (String line; (line = reader.readLine()) != null;) {
                    String[] q = line.split("\\t");
                    var question = new Question(Integer.parseInt(q[0]), q[1], Integer.parseInt(q[2]));
                    if (question.id < 1 || question.marks < 1 || question.marks > 100 || !List.of(LEVELS).contains(question.difficulty)
                            || !ids.add(question.id)) throw new IllegalArgumentException("Invalid question metadata");
                    pool.add(question);
                }
                System.out.println(select(pool, total, split));
            } else throw new IllegalArgumentException("Unknown operation");
        }
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
