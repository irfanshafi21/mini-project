import { useEffect, useState } from 'react'
import './App.css'

const API_URL = 'http://localhost:4000/api'

function App() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [unit, setUnit] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [marks, setMarks] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)

  const [newQuestion, setNewQuestion] = useState({
    unit: '1',
    topic: '',
    subtopic: '',
    difficulty: 'EASY',
    marks: '5',
    text: '',
  })

  const [showPaperForm, setShowPaperForm] = useState(false)
  const [generatingPaper, setGeneratingPaper] = useState(false)
  const [generatedPaper, setGeneratedPaper] = useState(null)

  const [paperForm, setPaperForm] = useState({
    unit: '0',
    topic: '',
    subtopic: '',
    totalMarks: '25',
    easy: '40',
    medium: '40',
    hard: '20',
  })

  const loadQuestions = async () => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams()

      if (search) params.append('q', search)
      if (unit) params.append('unit', unit)
      if (difficulty) params.append('difficulty', difficulty)
      if (marks) params.append('marks', marks)

      const response = await fetch(
        `${API_URL}/questions?${params.toString()}`
      )

      if (!response.ok) {
        throw new Error('Failed to load questions')
      }

      const data = await response.json()
      setQuestions(data.items)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuestions()
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target

    setNewQuestion((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handlePaperInputChange = (e) => {
    const { name, value } = e.target

    setPaperForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const addQuestion = async (e) => {
    e.preventDefault()

    try {
      setError('')

      const response = await fetch(`${API_URL}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newQuestion,
          unit: Number(newQuestion.unit),
          marks: Number(newQuestion.marks),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add question')
      }

      alert(`Question Q${data.id} added successfully!`)

      setNewQuestion({
        unit: '1',
        topic: '',
        subtopic: '',
        difficulty: 'EASY',
        marks: '5',
        text: '',
      })

      setShowAddForm(false)

      loadQuestions()
    } catch (err) {
      setError(err.message)
    }
  }

  const generatePaper = async (e) => {
    e.preventDefault()

    const totalPercentage =
      Number(paperForm.easy) +
      Number(paperForm.medium) +
      Number(paperForm.hard)

    if (totalPercentage !== 100) {
      setError('Easy %, Medium % and Hard % must add up to 100.')
      return
    }

    try {
      setError('')
      setGeneratingPaper(true)
      setGeneratedPaper(null)

      const body = {
        unit: Number(paperForm.unit),
        totalMarks: Number(paperForm.totalMarks),
        split: {
          easy: Number(paperForm.easy),
          medium: Number(paperForm.medium),
          hard: Number(paperForm.hard),
        },
      }

      if (paperForm.topic.trim()) {
        body.topic = paperForm.topic.trim()
      }

      if (paperForm.subtopic.trim()) {
        body.subtopic = paperForm.subtopic.trim()
      }

      const response = await fetch(`${API_URL}/papers/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate question paper')
      }

      setGeneratedPaper(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setGeneratingPaper(false)
    }
  }

  return (
    <div className="app">

      <header className="header">
        <div>
          <h1>Question Bank</h1>
          <p>Manage and search your questions</p>
        </div>

        <div>
          <button
            className="add-button"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Close Add Form' : '+ Add Question'}
          </button>

          <button
            className="add-button"
            onClick={() => setShowPaperForm(!showPaperForm)}
            style={{ marginLeft: '10px' }}
          >
            {showPaperForm ? 'Close Paper Generator' : 'Generate Question Paper'}
          </button>
        </div>
      </header>

      <main className="container">

        {showAddForm && (
          <section className="add-section">

            <h2>Add New Question</h2>

            <form onSubmit={addQuestion}>

              <div className="form-row">

                <div className="form-group">
                  <label>Unit</label>

                  <select
                    name="unit"
                    value={newQuestion.unit}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="1">Unit 1</option>
                    <option value="2">Unit 2</option>
                    <option value="3">Unit 3</option>
                    <option value="4">Unit 4</option>
                    <option value="5">Unit 5</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Difficulty</label>

                  <select
                    name="difficulty"
                    value={newQuestion.difficulty}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Marks</label>

                  <input
                    type="number"
                    name="marks"
                    min="1"
                    max="100"
                    value={newQuestion.marks}
                    onChange={handleInputChange}
                    required
                  />
                </div>

              </div>

              <div className="form-row">

                <div className="form-group">
                  <label>Topic</label>

                  <input
                    type="text"
                    name="topic"
                    placeholder="Example: Java"
                    value={newQuestion.topic}
                    onChange={handleInputChange}
                    maxLength="60"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Subtopic</label>

                  <input
                    type="text"
                    name="subtopic"
                    placeholder="Example: OOP"
                    value={newQuestion.subtopic}
                    onChange={handleInputChange}
                    maxLength="60"
                    required
                  />
                </div>

              </div>

              <div className="form-group">

                <label>Question</label>

                <textarea
                  name="text"
                  placeholder="Enter the question..."
                  value={newQuestion.text}
                  onChange={handleInputChange}
                  maxLength="2000"
                  rows="5"
                />

              </div>

              <button
                type="submit"
                className="save-button"
              >
                Save Question
              </button>

            </form>

          </section>
        )}

        {showPaperForm && (
          <section className="add-section">

            <h2>Generate Question Paper</h2>

            <form onSubmit={generatePaper}>

              <div className="form-row">

                <div className="form-group">
                  <label>Unit</label>

                  <select
                    name="unit"
                    value={paperForm.unit}
                    onChange={handlePaperInputChange}
                  >
                    <option value="0">All Units</option>
                    <option value="1">Unit 1</option>
                    <option value="2">Unit 2</option>
                    <option value="3">Unit 3</option>
                    <option value="4">Unit 4</option>
                    <option value="5">Unit 5</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Total Marks</label>

                  <input
                    type="number"
                    name="totalMarks"
                    min="1"
                    max="1000"
                    value={paperForm.totalMarks}
                    onChange={handlePaperInputChange}
                    required
                  />
                </div>

              </div>

              <div className="form-row">

                <div className="form-group">
                  <label>Topic (Optional)</label>

                  <input
                    type="text"
                    name="topic"
                    placeholder="Example: Java"
                    maxLength="60"
                    value={paperForm.topic}
                    onChange={handlePaperInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Subtopic (Optional)</label>

                  <input
                    type="text"
                    name="subtopic"
                    placeholder="Example: OOP"
                    maxLength="60"
                    value={paperForm.subtopic}
                    onChange={handlePaperInputChange}
                  />
                </div>

              </div>

              <h3>Difficulty Distribution</h3>

              <div className="form-row">

                <div className="form-group">
                  <label>Easy %</label>

                  <input
                    type="number"
                    name="easy"
                    min="0"
                    max="100"
                    value={paperForm.easy}
                    onChange={handlePaperInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Medium %</label>

                  <input
                    type="number"
                    name="medium"
                    min="0"
                    max="100"
                    value={paperForm.medium}
                    onChange={handlePaperInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Hard %</label>

                  <input
                    type="number"
                    name="hard"
                    min="0"
                    max="100"
                    value={paperForm.hard}
                    onChange={handlePaperInputChange}
                    required
                  />
                </div>

              </div>

              <p>
                Total: {
                  Number(paperForm.easy) +
                  Number(paperForm.medium) +
                  Number(paperForm.hard)
                }%
              </p>

              <button
                type="submit"
                className="save-button"
                disabled={generatingPaper}
              >
                {generatingPaper
                  ? 'Generating...'
                  : 'Generate Paper'}
              </button>

            </form>

          </section>
        )}

        {error && (
          <p className="error">{error}</p>
        )}

        {generatedPaper && (
          <section className="questions-section">

            <div className="section-header">
              <h2>Generated Question Paper</h2>

              <span>
                {generatedPaper.paper.totalMarks} Marks
              </span>
            </div>

            <div className="question-details">

              <span>
                Unit: {generatedPaper.paper.unit}
              </span>

              <span>
                Topic: {generatedPaper.paper.topic}
              </span>

              {generatedPaper.paper.subtopic && (
                <span>
                  Subtopic: {generatedPaper.paper.subtopic}
                </span>
              )}

              <span>
                Requested: {generatedPaper.paper.requestedMarks} Marks
              </span>

              <span>
                Generated: {generatedPaper.paper.totalMarks} Marks
              </span>

            </div>

            {!generatedPaper.paper.complete && (
              <p className="error">
                {generatedPaper.warning ||
                  'The requested total marks could not be reached.'}
              </p>
            )}

            <div className="question-list">

              {generatedPaper.paper.questions.map(
                (question, index) => (

                  <div
                    className="question-card"
                    key={`${question.id}-${index}`}
                  >

                    <div className="question-top">

                      <strong>
                        {index + 1}. Q{question.id}
                      </strong>

                      <span className="badge">
                        {question.difficulty}
                      </span>

                    </div>

                    <p className="question-text">
                      {question.text || 'No question text'}
                    </p>

                    <div className="question-details">

                      <span>
                        Unit {question.unit}
                      </span>

                      <span>
                        {question.topic}
                      </span>

                      <span>
                        {question.subtopic}
                      </span>

                      <span>
                        {question.marks} Marks
                      </span>

                    </div>

                  </div>

                )
              )}

            </div>

          </section>
        )}

        <section className="filters">

          <h2>Search Questions</h2>

          <div className="filter-row">

            <input
              type="text"
              placeholder="Search question..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="">All Units</option>
              <option value="1">Unit 1</option>
              <option value="2">Unit 2</option>
              <option value="3">Unit 3</option>
              <option value="4">Unit 4</option>
              <option value="5">Unit 5</option>
            </select>

            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>

            <select
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
            >
              <option value="">All Marks</option>
              <option value="2">2 Marks</option>
              <option value="5">5 Marks</option>
              <option value="10">10 Marks</option>
              <option value="15">15 Marks</option>
              <option value="16">16 Marks</option>
            </select>

            <button onClick={loadQuestions}>
              Search
            </button>

          </div>

        </section>

        <section className="questions-section">

          <div className="section-header">
            <h2>Questions</h2>

            <span>
              {questions.length} questions
            </span>
          </div>

          {loading && (
            <p className="message">
              Loading questions...
            </p>
          )}

          {!loading && !error && questions.length === 0 && (
            <p className="message">
              No questions found.
            </p>
          )}

          <div className="question-list">

            {questions.map((question) => (

              <div
                className="question-card"
                key={question.id}
              >

                <div className="question-top">

                  <strong>
                    Q{question.id}
                  </strong>

                  <span className="badge">
                    {question.difficulty}
                  </span>

                </div>

                <p className="question-text">
                  {question.text || 'No question text'}
                </p>

                <div className="question-details">

                  <span>
                    Unit {question.unit}
                  </span>

                  <span>
                    {question.topic}
                  </span>

                  <span>
                    {question.subtopic}
                  </span>

                  <span>
                    {question.marks} Marks
                  </span>

                </div>

              </div>

            ))}

          </div>

        </section>

      </main>

    </div>
  )
}

export default App