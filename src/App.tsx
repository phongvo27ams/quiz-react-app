import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiSend } from './api';
import { RichText } from './richText';
import type { Exercise, Question, Section } from './types';

type View =
  | { name: 'home' }
  | { name: 'section'; sectionTitle: string }
  | { name: 'exercise'; exerciseId: string }
  | { name: 'create' };

type AnswerState = Record<string, string>;
type OptionOrderState = Record<string, string[]>;

type DraftQuestion = {
  prompt: string;
  explanation: string;
  correctOptionIndex: number;
  options: { label: string; text: string }[];
};

async function loadSectionsData() {
  try {
    return await apiGet<Section[]>('/api/sections');
  } catch {
    const fallbackUrl = `${import.meta.env.BASE_URL}quiz-data.json`;
    const response = await fetch(fallbackUrl);
    if (!response.ok) {
      throw new Error('Failed to load sections.');
    }
    return response.json() as Promise<Section[]>;
  }
}

function createEmptyDraftQuestion(): DraftQuestion {
  return {
    prompt: '',
    explanation: '',
    correctOptionIndex: 0,
    options: [
      { label: 'A', text: '' },
      { label: 'B', text: '' },
      { label: 'C', text: '' },
      { label: 'D', text: '' },
    ],
  };
}

function questionToDraft(question: Question): DraftQuestion {
  return {
    prompt: question.prompt,
    explanation: question.explanation,
    correctOptionIndex: Math.max(
      0,
      question.options.findIndex((option) => option.id === question.correctOptionId),
    ),
    options: question.options.map((option) => ({ label: option.label, text: option.text })),
  };
}

function exerciseToDraftQuestions(exercise: Exercise) {
  return exercise.questions.map(questionToDraft);
}

function blankOptionOrder(questionCount: number) {
  return Object.fromEntries(
    Array.from({ length: questionCount }, (_, index) => [
      String(index),
      ['A', 'B', 'C', 'D'],
    ]),
  );
}

function shuffleArray<T>(items: T[]) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSections = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadSectionsData();
      setSections(data);
    } catch {
      setError('Failed to load sections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSections();
  }, []);

  const flatExercises = useMemo(() => sections.flatMap((section) => section.exercises), [sections]);
  const activeExercise = useMemo(
    () => (view.name === 'exercise' ? flatExercises.find((item) => item.id === view.exerciseId) : undefined),
    [flatExercises, view],
  );
  const activeSection = useMemo(
    () => (view.name === 'section' ? sections.find((item) => item.title === view.sectionTitle) : undefined),
    [sections, view],
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: 'home' })}>
          Software Testing
        </button>
        <nav className="nav">
          <button onClick={() => setView({ name: 'home' })}>Sections</button>
          <button onClick={() => setView({ name: 'create' })}>Create Exercise</button>
        </nav>
      </header>

      <main className="container">
        {view.name === 'home' && (
          <HomePage
            sections={sections}
            loading={loading}
            error={error}
            onOpenSection={(sectionTitle) => setView({ name: 'section', sectionTitle })}
            onRefresh={loadSections}
          />
        )}

        {view.name === 'section' && activeSection && (
          <SectionPage
            section={activeSection}
            onBack={() => setView({ name: 'home' })}
            onOpenExercise={(exerciseId) => setView({ name: 'exercise', exerciseId })}
          />
        )}

        {view.name === 'exercise' && activeExercise && (
          <ExercisePage
            sections={sections}
            exercise={activeExercise}
            onBack={() => setView({ name: 'section', sectionTitle: activeExercise.sectionTitle })}
            onOpenSection={(sectionTitle) => setView({ name: 'section', sectionTitle })}
            onRefresh={loadSections}
          />
        )}

        {view.name === 'create' && (
          <CreatePage
            sections={sections}
            onBack={() => setView({ name: 'home' })}
            onCreate={async (payload) => {
              await apiSend('/api/exercises', 'POST', payload);
              await loadSections();
              setView({ name: 'home' });
            }}
          />
        )}
      </main>
    </div>
  );
}

function Breadcrumb({
  items,
}: {
  items: Array<{ label: string; onClick?: () => void }>;
}) {
  return (
    <div className="breadcrumb">
      {items.map((item, index) => (
        <span className="breadcrumb-item" key={`${item.label}-${index}`}>
          {item.onClick ? (
            <button className="breadcrumb-link" onClick={item.onClick}>
              {item.label}
            </button>
          ) : (
            <span>{item.label}</span>
          )}
          {index < items.length - 1 && <span className="breadcrumb-sep">/</span>}
        </span>
      ))}
    </div>
  );
}

function HomePage({
  sections,
  loading,
  error,
  onOpenSection,
  onRefresh,
}: {
  sections: Section[];
  loading: boolean;
  error: string;
  onOpenSection: (sectionTitle: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section>
      <div className="hero">
        <p className="eyebrow">Software Testing</p>
        <h1>Quiz System</h1>
        <p>Choose a main section to browse the exercises inside it.</p>
        <button className="ghost" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      <div className="grid">
        {sections.map((section) => (
          <article className="card" key={section.id}>
            <p className="eyebrow">Section</p>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <p className="meta">{section.exercises.length} exercises</p>
            <button className="primary" onClick={() => onOpenSection(section.title)}>
              View exercises
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function SectionPage({
  section,
  onBack,
  onOpenExercise,
}: {
  section: Section;
  onBack: () => void;
  onOpenExercise: (exerciseId: string) => void;
}) {
  return (
    <section>
      <Breadcrumb items={[{ label: 'Home', onClick: onBack }, { label: section.title }]} />
      <div className="page-head">
        <div>
          <p className="eyebrow">Section</p>
          <h1>{section.title}</h1>
          <p>{section.description}</p>
        </div>
        <button className="ghost" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="stack">
        {section.exercises.map((exercise, index) => (
          <article className="card" key={exercise.id}>
            <p className="meta">Exercise {index + 1}</p>
            <h2>{exercise.title}</h2>
            <p>{exercise.description}</p>
            <p className="meta">{exercise.questions.length} questions</p>
            <button className="primary" onClick={() => onOpenExercise(exercise.id)}>
              Start exercise
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExercisePage({
  sections,
  exercise,
  onBack,
  onOpenSection,
  onRefresh,
}: {
  sections: Section[];
  exercise: Exercise;
  onBack: () => void;
  onOpenSection: (sectionTitle: string) => void;
  onRefresh: () => void;
}) {
  const [answers, setAnswers] = useState<AnswerState>({});
  const [optionOrder, setOptionOrder] = useState<OptionOrderState>({});
  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editSectionTitle, setEditSectionTitle] = useState(exercise.sectionTitle);
  const [editTitle, setEditTitle] = useState(exercise.title);
  const [editDescription, setEditDescription] = useState(exercise.description);
  const [editQuestions, setEditQuestions] = useState<DraftQuestion[]>(() => exerciseToDraftQuestions(exercise));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const nextOrder = Object.fromEntries(
      exercise.questions.map((question) => [
        question.id,
        shuffleArray(question.options.map((option) => option.id)),
      ]),
    );

    setAnswers({});
    setSubmitted(false);
    setOptionOrder(nextOrder);
    setIsEditing(false);
    setEditSectionTitle(exercise.sectionTitle);
    setEditTitle(exercise.title);
    setEditDescription(exercise.description);
    setEditQuestions(exerciseToDraftQuestions(exercise));
    setSaveMessage('');
  }, [exercise.id]);

  const correctCount = exercise.questions.reduce((count, question) => {
    return count + (answers[question.id] === question.correctOptionId ? 1 : 0);
  }, 0);
  const total = exercise.questions.length;
  const percent = total === 0 ? 0 : Math.round((correctCount / total) * 100);

  return (
    <section>
      <Breadcrumb
        items={[
          { label: 'Home', onClick: onBack },
          { label: exercise.sectionTitle, onClick: () => onOpenSection(exercise.sectionTitle) },
          { label: exercise.title },
        ]}
      />
      <div className="page-head">
        <div>
          <p className="eyebrow">{exercise.sectionTitle}</p>
          <h1>{exercise.title}</h1>
          <p>{exercise.description}</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={onBack}>
            Back
          </button>
          <button
            className="ghost"
            onClick={() => {
              setIsEditing((current) => !current);
              setSaveMessage('');
            }}
          >
            {isEditing ? 'Cancel edit' : 'Edit'}
          </button>
          <button
            className="ghost"
            onClick={() => {
              setSubmitted(false);
              setAnswers({});
              onRefresh();
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {isEditing ? (
        <ExerciseEditor
          sections={sections}
          sectionTitle={editSectionTitle}
          title={editTitle}
          description={editDescription}
          questions={editQuestions}
          onChangeSectionTitle={setEditSectionTitle}
          onChangeTitle={setEditTitle}
          onChangeDescription={setEditDescription}
          onChangeQuestions={setEditQuestions}
          onAddQuestion={() => setEditQuestions((current) => [...current, createEmptyDraftQuestion()])}
          onRemoveQuestion={(questionIndex) =>
            setEditQuestions((current) => current.filter((_, index) => index !== questionIndex))
          }
          onSave={async () => {
            setSaving(true);
            setSaveMessage('');
            try {
              const cleanQuestions = editQuestions.filter(
                (question) =>
                  question.prompt.trim() &&
                  question.explanation.trim() &&
                  question.options.every((option) => option.text.trim()),
              );
              if (!editTitle.trim() || cleanQuestions.length === 0) {
                setSaveMessage('Please complete the title and all questions before saving.');
                return;
              }

              await apiSend(`/api/exercises/${exercise.id}`, 'PUT', {
                title: editTitle.trim(),
                description: editDescription.trim(),
                sectionTitle: editSectionTitle,
              });

              for (const [index, question] of cleanQuestions.entries()) {
                const existing = exercise.questions[index];
                if (!existing) break;
                await apiSend(`/api/questions/${existing.id}`, 'PUT', {
                  prompt: question.prompt,
                  explanation: question.explanation,
                  correctOptionIndex: question.correctOptionIndex,
                  options: question.options,
                });
              }

              setSaveMessage('Saved successfully.');
              await onRefresh();
              setIsEditing(false);
            } finally {
              setSaving(false);
            }
          }}
          saving={saving}
          saveMessage={saveMessage}
        />
      ) : (
        <>
          <div className="stack">
            {exercise.questions.map((question, index) => (
              <article className="question" key={question.id}>
                <div className="question-head">
                  <div className="question-title">
                    <div className="question-number">Question {index + 1}</div>
                    <RichText value={question.prompt} />
                  </div>
                </div>

                <div className="options">
                  {['A', 'B', 'C', 'D'].map((label, index) => {
                    const orderedOptionId = optionOrder[question.id]?.[index] ?? question.options[index]?.id;
                    const option = question.options.find((item) => item.id === orderedOptionId);
                    if (!option) {
                      return null;
                    }
                    const selected = option.id === answers[question.id];
                    const correct = option.id === question.correctOptionId;
                    const hasAnswer = Boolean(answers[question.id]);
                    const showFeedback = submitted || hasAnswer;
                    const stateClass = showFeedback
                      ? correct
                        ? 'option correct'
                        : selected
                          ? 'option wrong'
                          : 'option'
                      : selected
                        ? 'option selected'
                        : 'option';

                    return (
                      <button
                        key={option.id}
                        className={stateClass}
                        disabled={hasAnswer}
                        onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                      >
                        <span className="circle">{label}</span>
                        <span className="option-text">
                          <RichText value={option.text} />
                        </span>
                      </button>
                    );
                  })}
                </div>

                {answers[question.id] && (
                  <div className={`feedback ${answers[question.id] === question.correctOptionId ? 'good' : 'bad'}`}>
                    {answers[question.id] === question.correctOptionId ? 'Correct.' : 'Incorrect.'}{' '}
                    <RichText value={question.explanation} />
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="actions">
            <button className="primary" onClick={() => setSubmitted(true)}>
              Submit
            </button>
            <button
              className="ghost"
              onClick={() => {
                setSubmitted(false);
                setAnswers({});
                setOptionOrder(
                  Object.fromEntries(
                    exercise.questions.map((question) => [
                      question.id,
                      shuffleArray(question.options.map((option) => option.id)),
                    ]),
                  ),
                );
              }}
            >
              Reset
            </button>
            {submitted && (
              <div className="result">
                <strong>Result:</strong> {correctCount}/{total} correct, {percent}%.
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ExerciseEditor({
  sections,
  sectionTitle,
  title,
  description,
  questions,
  onChangeSectionTitle,
  onChangeTitle,
  onChangeDescription,
  onChangeQuestions,
  onAddQuestion,
  onRemoveQuestion,
  onSave,
  saving,
  saveMessage,
}: {
  sections: Section[];
  sectionTitle: string;
  title: string;
  description: string;
  questions: DraftQuestion[];
  onChangeSectionTitle: (value: string) => void;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeQuestions: React.Dispatch<React.SetStateAction<DraftQuestion[]>>;
  onAddQuestion: () => void;
  onRemoveQuestion: (questionIndex: number) => void;
  onSave: () => Promise<void>;
  saving?: boolean;
  saveMessage?: string;
}) {
  return (
    <section className="form-page">
      <div className="form-grid">
        <label>
          Section
          <select value={sectionTitle} onChange={(e) => onChangeSectionTitle(e.target.value)}>
            {sections.map((section) => (
              <option key={section.id} value={section.title}>
                {section.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Exercise title
          <input value={title} onChange={(e) => onChangeTitle(e.target.value)} />
        </label>
        <label className="full">
          Description
          <input value={description} onChange={(e) => onChangeDescription(e.target.value)} />
        </label>
      </div>

      <div className="stack">
        {questions.map((question, questionIndex) => (
          <article className="question" key={questionIndex}>
            <div className="page-head compact">
              <h3>Question {questionIndex + 1}</h3>
              <div className="actions">
                <button className="ghost" onClick={onAddQuestion}>
                  Add question
                </button>
                {questions.length > 1 && (
                  <button className="ghost danger" onClick={() => onRemoveQuestion(questionIndex)}>
                    Remove question
                  </button>
                )}
              </div>
            </div>

            <label>
              Question prompt
              <textarea
                value={question.prompt}
                onChange={(e) => updateQuestion(onChangeQuestions, questionIndex, { prompt: e.target.value })}
                rows={5}
              />
            </label>

            <div className="editor-grid">
              {question.options.map((option, optionIndex) => (
                <div className="editor-option" key={optionIndex}>
                  <label>
                    Option {String.fromCharCode(65 + optionIndex)}
                    <textarea
                      value={option.text}
                      onChange={(e) =>
                        onChangeQuestions((current) =>
                          current.map((item, i) =>
                            i === questionIndex
                              ? {
                                  ...item,
                                  options: item.options.map((opt, j) => (j === optionIndex ? { ...opt, text: e.target.value } : opt)),
                                }
                              : item,
                          ),
                        )
                      }
                      rows={4}
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="form-grid">
              <label className="full">
                Explanation
                <textarea
                  value={question.explanation}
                  onChange={(e) => updateQuestion(onChangeQuestions, questionIndex, { explanation: e.target.value })}
                  rows={4}
                />
              </label>
            </div>

            <div className="form-grid">
              <label className="full">
                Correct answer
                <select
                  value={question.correctOptionIndex}
                  onChange={(e) =>
                    updateQuestion(onChangeQuestions, questionIndex, {
                      correctOptionIndex: Number(e.target.value),
                    })
                  }
                >
                  {question.options.map((option, optionIndex) => (
                    <option key={optionIndex} value={optionIndex}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="actions">
        <button className="primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button className="ghost" onClick={onAddQuestion}>
          Add question
        </button>
        {saveMessage && <div className="result">{saveMessage}</div>}
      </div>
    </section>
  );
}

function CreatePage({
  sections,
  onBack,
  onCreate,
}: {
  sections: Section[];
  onBack: () => void;
  onCreate: (payload: {
    sectionTitle: string;
    title: string;
    description: string;
    questions: DraftQuestion[];
  }) => Promise<void>;
}) {
  const [sectionTitle, setSectionTitle] = useState(sections[0]?.title || 'Black Box Testing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([createEmptyDraftQuestion()]);

  const submit = async () => {
    const cleanQuestions = questions.filter(
      (question) =>
        question.prompt.trim() &&
        question.explanation.trim() &&
        question.options.every((option) => option.text.trim()),
    );
    if (!title.trim() || cleanQuestions.length === 0) return;
    await onCreate({
      sectionTitle,
      title: title.trim(),
      description: description.trim(),
      questions: cleanQuestions,
    });
  };

  return (
    <section className="form-page">
      <Breadcrumb items={[{ label: 'Home', onClick: onBack }, { label: 'Create Exercise' }]} />
      <div className="page-head">
        <div>
          <p className="eyebrow">Create</p>
          <h1>Create exercise inside a section</h1>
          <p>Each exercise is grouped under a main section and the exercise number is auto-managed by the UI.</p>
        </div>
        <button className="ghost" onClick={onBack}>
          Back
        </button>
      </div>

      <ExerciseEditor
        sections={sections}
        sectionTitle={sectionTitle}
        title={title}
        description={description}
        questions={questions}
        onChangeSectionTitle={setSectionTitle}
        onChangeTitle={setTitle}
        onChangeDescription={setDescription}
        onChangeQuestions={setQuestions}
        onAddQuestion={() => setQuestions((current) => [...current, createEmptyDraftQuestion()])}
        onRemoveQuestion={(questionIndex) => setQuestions((current) => current.filter((_, i) => i !== questionIndex))}
        onSave={submit}
      />
    </section>
  );
}

function updateQuestion(
  setQuestions: React.Dispatch<React.SetStateAction<DraftQuestion[]>>,
  index: number,
  patch: Partial<DraftQuestion>,
) {
  setQuestions((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
}

export default App;
