import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;


public class QuestionBankSystem {

    enum Difficulty { EASY, MEDIUM, HARD }

    record Question(String id, int unit, String topic, String subtopic,
                    Difficulty difficulty, int marks, String text) {
        @Override
        public String toString() {
            String base = String.format("%-5s | Unit %d | %-8s | %-12s | %-6s | %2d marks",
                    id, unit, topic, subtopic, difficulty, marks);
            return text.isEmpty() ? base : base + " | " + text;
        }

        String toFileLine() {
            return String.join("|", id, String.valueOf(unit), topic, subtopic,
                    difficulty.name(), String.valueOf(marks), text);
        }
    }

    private static final Path FILE = Paths.get("questions.txt");
    private static final int FIRST_NUMBER = 101;
    private static final int TOTAL_UNITS = 5;          // units available: 1 to 5
    private static final Comparator<Question> BY_MARKS_DESC = (a, b) -> Integer.compare(b.marks(), a.marks());

    private final List<Question> questions = new ArrayList<>();                 // ArrayList
    private final Map<String, List<Question>> topicIndex = new HashMap<>();     // HashMap
    private final Deque<Question> undoStack = new ArrayDeque<>();               // Stack
    private final Scanner sc = new Scanner(System.in);
    private int nextNumber = FIRST_NUMBER;                                      // auto question number
    private int currentUnit = 0;                                                // 0 = not chosen yet
    private String lastTopic = "";                                              // reused while adding

    // ------------------------------------------------------------ input helpers

    private int toInt(String s) {
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private String readLine(String prompt) {
        System.out.print(prompt);
        return sc.hasNextLine() ? sc.nextLine().trim() : "";
    }

    /** Keeps asking until the user enters a whole number between min and max. */
    private int readInt(String prompt, int min, int max) {
        while (true) {
            int v = toInt(readLine(prompt));
            if (v >= min && v <= max) return v;
            System.out.println("  Please enter a number between " + min + " and " + max + ".");
        }
    }

    /** Topic / subtopic: cannot be empty; spaces become underscores. */
    private String readName(String prompt) {
        while (true) {
            String s = readLine(prompt);
            if (!s.isEmpty()) return s.toUpperCase().replaceAll("\\s+", "_");
            System.out.println("  This field cannot be empty.");
        }
    }

    /** Like readName, but pressing Enter keeps the previous value. */
    private String readNameOrKeep(String prompt, String previous) {
        if (previous.isEmpty()) return readName(prompt);
        String s = readLine(prompt.replace(": ", " [" + previous + "] (Enter to keep): "));
        return s.isEmpty() ? previous : s.toUpperCase().replaceAll("\\s+", "_");
    }

    /** The user CHOOSES the difficulty from a menu. */
    private Difficulty chooseDifficulty() {
        System.out.println("  Choose difficulty level:");
        System.out.println("    1. EASY");
        System.out.println("    2. MEDIUM");
        System.out.println("    3. HARD");
        int c = readInt("  Enter choice (1-3): ", 1, 3);
        return Difficulty.values()[c - 1];
    }

    // ------------------------------------------------------------- bookkeeping

    private String normId(String s) {
        s = s.trim().toUpperCase();
        return s.matches("\\d+") ? "Q" + s : s;
    }

    private int indexOf(String id) {
        id = normId(id);
        for (int i = 0; i < questions.size(); i++) {
            if (questions.get(i).id().equalsIgnoreCase(id)) return i;
        }
        return -1;
    }

    private void rebuildIndex() {
        topicIndex.clear();
        for (Question q : questions) {
            topicIndex.computeIfAbsent(q.topic(), k -> new ArrayList<>()).add(q);
        }
    }

    // ---------------------------------------------------------- file handling

    private void load() {
        if (!Files.exists(FILE)) return;
        try {
            for (String line : Files.readAllLines(FILE)) {
                String[] f = line.split("\\|", 7);
                if (f.length < 6) continue;
                int unit = toInt(f[1]);
                int shift = 0;
                if (unit <= 0) { unit = 1; shift = -1; }          // older file format without unit
                String id = f[0];
                String topic = f[2 + shift];
                String sub = f[3 + shift];
                Difficulty d;
                try {
                    d = Difficulty.valueOf(f[4 + shift]);
                } catch (IllegalArgumentException e) {
                    continue;
                }
                int marks = toInt(f[5 + shift]);
                String text = f.length > 6 + shift ? f[6 + shift] : "";
                if (marks <= 0) continue;
                questions.add(new Question(id, unit, topic, sub, d, marks, text));
                int n = toInt(id.replaceAll("\\D", ""));
                if (n >= nextNumber) nextNumber = n + 1;
            }
        } catch (IOException e) {
            System.out.println("Could not read " + FILE + ": " + e.getMessage());
        }
        rebuildIndex();
    }

    private void save() {
        try {
            Files.write(FILE, questions.stream().map(Question::toFileLine).toList());
        } catch (IOException e) {
            System.out.println("Could not save " + FILE + ": " + e.getMessage());
        }
    }

    // --------------------------------------------------------------- commands

    /** Asks the user for every field of a question (guided prompts). */
    private Question askQuestionDetails(String id, int unit) {
        String topic = readNameOrKeep("  Enter Topic: ", lastTopic);
        lastTopic = topic;
        String subtopic = readName("  Enter Subtopic: ");
        Difficulty diff = chooseDifficulty();
        int marks = readInt("  Enter Marks (1-100): ", 1, 100);
        String text = readLine("  Enter Question text (optional, press Enter to skip): ").replace('|', '/');
        return new Question(id, unit, topic, subtopic, diff, marks, text);
    }

    void changeUnit() {
        currentUnit = readInt("Enter the Unit you want to work on (1-" + TOTAL_UNITS + "): ", 1, TOTAL_UNITS);
        lastTopic = "";
        System.out.println("Current unit set to Unit " + currentUnit + ".");
    }

    /** Adds questions one after another for the current unit (unit is asked only once). */
    void add() {
        if (currentUnit == 0) changeUnit();
        while (true) {
            String id = "Q" + nextNumber;
            System.out.println("\n--- ADD QUESTION (Unit " + currentUnit + ") ---");
            System.out.println("Question number assigned automatically: " + id);
            Question q = askQuestionDetails(id, currentUnit);
            questions.add(q);
            nextNumber++;
            rebuildIndex();
            save();
            System.out.println("Added: " + q);

            String again = readLine("\nAdd another question in Unit " + currentUnit
                    + "? (Y = yes, N = back to menu, U = change unit): ");
            if (again.equalsIgnoreCase("U")) changeUnit();
            else if (!again.equalsIgnoreCase("Y")) return;
        }
    }

    void update() {
        String id = readLine("Enter question number to update (e.g. 101): ");
        int i = indexOf(id);
        if (i < 0) {
            System.out.println("Question " + normId(id) + " not found.");
            return;
        }
        System.out.println("\n--- UPDATE QUESTION ---");
        System.out.println("Current: " + questions.get(i));
        System.out.println("Enter the new details:");
        int unit = readInt("  Enter Unit (1-" + TOTAL_UNITS + "): ", 1, TOTAL_UNITS);
        lastTopic = questions.get(i).topic();      // Enter keeps this question's own topic
        Question q = askQuestionDetails(questions.get(i).id(), unit);
        questions.set(i, q);
        rebuildIndex();
        save();
        System.out.println("Updated: " + q);
    }

    void delete() {
        String id = readLine("Enter question number to delete (e.g. 101): ");
        int i = indexOf(id);
        if (i < 0) {
            System.out.println("Question " + normId(id) + " not found.");
            return;
        }
        Question q = questions.remove(i);
        undoStack.push(q);
        rebuildIndex();
        save();
        System.out.println("Deleted: " + q + "   (use option 5 to undo)");
    }

    void undo() {
        if (undoStack.isEmpty()) {
            System.out.println("Nothing to undo.");
            return;
        }
        Question q = undoStack.pop();
        if (indexOf(q.id()) >= 0) {
            System.out.println("Cannot restore " + q.id() + ": the number is already in use.");
            return;
        }
        questions.add(q);
        rebuildIndex();
        save();
        System.out.println("Restored: " + q);
    }

    void searchTopic() {
        String topic = readLine("Enter topic to search: ");
        List<Question> result = topicIndex.get(topic.toUpperCase().replaceAll("\\s+", "_"));
        if (result == null || result.isEmpty()) {
            System.out.println("No questions found for topic " + topic.toUpperCase() + ".");
            return;
        }
        result.forEach(System.out::println);
    }

    void search() {
        System.out.println("\n--- SEARCH QUESTION ---");
        System.out.println("  1. By Topic");
        System.out.println("  2. By Difficulty level");
        System.out.println("  3. By Unit");
        switch (readInt("  Enter choice (1-3): ", 1, 3)) {
            case 1 -> searchTopic();
            case 2 -> searchLevel();
            case 3 -> searchUnit();
        }
    }

    void searchLevel() {
        Difficulty d = chooseDifficulty();
        List<Question> result = questions.stream().filter(q -> q.difficulty() == d).toList();
        if (result.isEmpty()) System.out.println("No " + d + " questions found.");
        else result.forEach(System.out::println);
    }

    void searchUnit() {
        int unit = readInt("Enter Unit to search (1-" + TOTAL_UNITS + "): ", 1, TOTAL_UNITS);
        List<Question> result = questions.stream().filter(q -> q.unit() == unit).toList();
        if (result.isEmpty()) System.out.println("No questions found in Unit " + unit + ".");
        else result.forEach(System.out::println);
    }

    void display() {
        if (questions.isEmpty()) {
            System.out.println("No questions available. Use ADD to create one.");
            return;
        }
        List<Question> sorted = new ArrayList<>(questions);
        sorted.sort(Comparator.comparingInt(Question::unit)
                .thenComparing(Question::topic)
                .thenComparingInt(Question::marks)
                .thenComparing(Question::id));
        sorted.forEach(System.out::println);
    }

    void statistics() {
        Map<Difficulty, Integer> byDiff = new EnumMap<>(Difficulty.class);
        for (Difficulty d : Difficulty.values()) byDiff.put(d, 0);
        Map<Integer, Integer> byMarks = new TreeMap<>();
        Map<Integer, Integer> byUnit = new TreeMap<>();
        Map<String, Integer> byTopic = new TreeMap<>();
        int totalMarks = 0;

        for (Question q : questions) {
            byDiff.merge(q.difficulty(), 1, Integer::sum);
            byMarks.merge(q.marks(), 1, Integer::sum);
            byUnit.merge(q.unit(), 1, Integer::sum);
            totalMarks += q.marks();
        }
        topicIndex.forEach((topic, list) -> byTopic.put(topic, list.size()));

        System.out.println("Total questions : " + questions.size());
        System.out.println("Total marks     : " + totalMarks);
        System.out.println("By difficulty   : " + byDiff);
        System.out.println("By marks        : " + byMarks + "   (marks=count)");
        System.out.println("By unit         : " + byUnit + "   (unit=count)");
        System.out.println("By topic        : " + byTopic);
    }

    void generatePaper() {
        System.out.println("\n--- GENERATE QUESTION PAPER ---");
        int unit = readInt("Enter Unit (0 for all units, 1-" + TOTAL_UNITS + "): ", 0, TOTAL_UNITS);
        String topic = readLine("Enter Topic (or ALL): ").toUpperCase().replaceAll("\\s+", "_");
        if (topic.isEmpty()) topic = "ALL";
        int total = readInt("Enter total marks for the paper: ", 1, 1000);

        int[] pct = {40, 40, 20};
        String useDefault = readLine("Use default difficulty split EASY 40% / MEDIUM 40% / HARD 20%? (Y/N): ");
        if (!useDefault.equalsIgnoreCase("Y")) {
            pct[0] = readInt("  Easy percentage (0-100): ", 0, 100);
            pct[1] = readInt("  Medium percentage (0-100): ", 0, 100);
            pct[2] = readInt("  Hard percentage (0-100): ", 0, 100);
            if (pct[0] + pct[1] + pct[2] != 100) {
                System.out.println("Error: percentages must add up to 100.");
                return;
            }
        }

        final int fUnit = unit;
        List<Question> pool = (topic.equals("ALL") ? questions : topicIndex.getOrDefault(topic, List.of()))
                .stream().filter(q -> fUnit == 0 || q.unit() == fUnit).toList();
        if (pool.isEmpty()) {
            System.out.println("No questions available for this unit/topic.");
            return;
        }

        int easyT = (int) Math.round(total * pct[0] / 100.0);
        int medT = Math.min((int) Math.round(total * pct[1] / 100.0), total - easyT);
        int hardT = total - easyT - medT;
        int[] target = {easyT, medT, hardT};
        System.out.printf("Marks target -> EASY: %d | MEDIUM: %d | HARD: %d%n", easyT, medT, hardT);

        List<Question> chosen = new ArrayList<>();
        PriorityQueue<Question> rest = new PriorityQueue<>(BY_MARKS_DESC);
        int sum = 0;

        // Pass 1: per difficulty, take high-mark questions that fit the level's target
        for (Difficulty d : Difficulty.values()) {
            List<Question> level = pool.stream()
                    .filter(q -> q.difficulty() == d)
                    .collect(Collectors.toCollection(ArrayList::new));
            Collections.shuffle(level);
            PriorityQueue<Question> pq = new PriorityQueue<>(BY_MARKS_DESC);
            pq.addAll(level);

            int levelSum = 0;
            while (!pq.isEmpty()) {
                Question q = pq.poll();
                if (levelSum + q.marks() <= target[d.ordinal()]) {
                    chosen.add(q);
                    levelSum += q.marks();
                } else {
                    rest.add(q);
                }
            }
            sum += levelSum;
        }

        // Pass 2: fill remaining marks with the largest leftovers that fit
        while (!rest.isEmpty() && sum < total) {
            Question q = rest.poll();
            if (sum + q.marks() <= total) {
                chosen.add(q);
                sum += q.marks();
            }
        }

        chosen.sort(Comparator.comparingInt(Question::marks).thenComparing(Question::id));

        System.out.println("\nQUESTION PAPER  (Unit: " + (unit == 0 ? "ALL" : unit) + ", Topic: " + topic + ")");
        System.out.println("-----------------------------------------");
        int n = 1;
        for (Question q : chosen) {
            String body = q.text().isEmpty() ? q.topic() + " - " + q.subtopic() : q.text();
            System.out.printf("%2d. %s  [%d marks, %s]%n", n++, body, q.marks(), q.difficulty());
        }
        System.out.println("-----------------------------------------");
        System.out.println("Total Marks: " + sum + " / " + total);
        if (sum < total) {
            System.out.println("Warning: not enough suitable questions to reach " + total
                    + " marks. Add more questions to the bank.");
        }
    }

    void printMenu() {
        System.out.println("\n========== QUESTION BANK MENU ==========");
        System.out.println(" 1. Add Question");
        System.out.println(" 2. Display Questions");
        System.out.println(" 3. Search Question");
        System.out.println(" 4. Delete Question");
        System.out.println(" 5. Undo Delete");
        System.out.println(" 6. Generate Question Paper");
        System.out.println(" 7. Update Question");
        System.out.println(" 8. Statistics");
        System.out.println(" 9. Change Unit");
        System.out.println("10. Exit");
        System.out.println("=========================================");
        System.out.println(" Current Unit: " + (currentUnit == 0 ? "not set" : currentUnit)
                + "   (question numbers are automatic)");
    }

    void menu() {
        while (true) {
            printMenu();
            int choice = readInt("Enter your choice (1-10): ", 1, 10);
            switch (choice) {
                case 1 -> add();
                case 2 -> display();
                case 3 -> search();
                case 4 -> delete();
                case 5 -> undo();
                case 6 -> generatePaper();
                case 7 -> update();
                case 8 -> statistics();
                case 9 -> changeUnit();
                case 10 -> {
                    save();
                    System.out.println("Saved. Program ended.");
                    return;
                }
            }
        }
    }

    void run() {
        load();
        System.out.println("=========================================");
        System.out.println("   EXAMINATION QUESTION BANK SYSTEM");
        System.out.println("=========================================");
        System.out.println(questions.size() + " question(s) loaded.");
        menu();
    }

    public static void main(String[] args) {
        new QuestionBankSystem().run();
    }
}