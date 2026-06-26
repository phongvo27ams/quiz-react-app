import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCirclePlus, faCopy, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import { apiGet, apiSend } from './api';
import { RichText } from './richText';
import type { Exercise, Question, Section } from './types';

type View =
  | { name: 'home' }
  | { name: 'sections' }
  | { name: 'section'; sectionId: string }
  | { name: 'exercise'; exerciseId: string }
  | { name: 'create' };

type RouteView =
  | { name: 'home' }
  | { name: 'sections' }
  | { name: 'section'; sectionId: string }
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

type MediaItem = {
  name: string;
  url: string;
  type?: 'image' | 'audio';
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

function getViewFromPath(pathname: string): RouteView {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return { name: 'home' };
  if (segments[0] === 'sections' && segments.length === 1) return { name: 'sections' };
  if (segments[0] === 'sections' && segments[1]) return { name: 'section', sectionId: decodeURIComponent(segments[1]) };
  if (segments[0] === 'exercises' && segments[1]) return { name: 'exercise', exerciseId: decodeURIComponent(segments[1]) };
  if (segments[0] === 'create') return { name: 'create' };
  return { name: 'home' };
}

function pathForView(view: RouteView) {
  switch (view.name) {
    case 'home':
      return '/';
    case 'sections':
      return '/sections';
    case 'section':
      return `/sections/${encodeURIComponent(view.sectionId)}`;
    case 'exercise':
      return `/exercises/${encodeURIComponent(view.exerciseId)}`;
    case 'create':
      return '/create';
    default:
      return '/';
  }
}

async function uploadMedia(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/media', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error('Upload failed.');
  }
  return response.json() as Promise<MediaItem & { mimeType: string }>;
}

async function deleteMedia(name: string) {
  const response = await fetch(`/api/media/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    throw new Error('Delete failed.');
  }
}

function App() {
  const [view, setView] = useState<View>(() => getViewFromPath(window.location.pathname));
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

  useEffect(() => {
    const onPopState = () => {
      setView(getViewFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextView: RouteView) => {
    const nextPath = pathForView(nextView);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setView(nextView);
  };

  const flatExercises = useMemo(() => sections.flatMap((section) => section.exercises), [sections]);
  const activeExercise = useMemo(
    () => (view.name === 'exercise' ? flatExercises.find((item) => item.id === view.exerciseId) : undefined),
    [flatExercises, view],
  );
  const activeSection = useMemo(
    () => (view.name === 'section' ? sections.find((item) => item.id === view.sectionId) : undefined),
    [sections, view],
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate({ name: 'home' })}>
          Software Testing
        </button>
        <nav className="nav">
          <button onClick={() => navigate({ name: 'sections' })}>Manage Sections</button>
          <button onClick={() => navigate({ name: 'create' })}>Create Exercise</button>
        </nav>
      </header>

      <main className="container">
        {view.name === 'home' && (
          <HomePage
            sections={sections}
            loading={loading}
            error={error}
            onOpenSectionList={() => navigate({ name: 'sections' })}
            onRefresh={loadSections}
          />
        )}

        {view.name === 'sections' && (
          <SectionsPage
            sections={sections}
            onBack={() => navigate({ name: 'home' })}
            onOpenSection={(sectionId) => navigate({ name: 'section', sectionId })}
            onRefresh={loadSections}
          />
        )}

        {view.name === 'section' && activeSection && (
          <SectionPage
            section={activeSection}
            onBack={() => navigate({ name: 'home' })}
            onOpenExercise={(exerciseId) => navigate({ name: 'exercise', exerciseId })}
          />
        )}

        {view.name === 'exercise' && activeExercise && (
          <ExercisePage
            sections={sections}
            exercise={activeExercise}
            onBack={() => {
              const section = sections.find((item) => item.title === activeExercise.sectionTitle);
              navigate({ name: 'section', sectionId: section?.id || '' });
            }}
            onOpenSection={(sectionId) => navigate({ name: 'section', sectionId })}
            onRefresh={loadSections}
          />
        )}

        {view.name === 'create' && (
          <CreatePage
            sections={sections}
            onBack={() => navigate({ name: 'home' })}
            onCreate={async (payload) => {
              await apiSend('/api/exercises', 'POST', payload);
              await loadSections();
              navigate({ name: 'home' });
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
  onOpenSectionList,
  onRefresh,
}: {
  sections: Section[];
  loading: boolean;
  error: string;
  onOpenSectionList: () => void;
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
            <button className="primary" onClick={onOpenSectionList}>
              Manage sections
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

function SectionsPage({
  sections,
  onBack,
  onOpenSection,
  onRefresh,
}: {
  sections: Section[];
  onBack: () => void;
  onOpenSection: (sectionId: string) => void;
  onRefresh: () => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const cancel = () => {
    setIsCreating(false);
    setEditingSectionId(null);
    setDraftTitle('');
    setDraftDescription('');
    setMessage('');
  };

  const startCreate = () => {
    cancel();
    setIsCreating(true);
  };

  const startEdit = (section: Section) => {
    setIsCreating(false);
    setEditingSectionId(section.id);
    setDraftTitle(section.title);
    setDraftDescription(section.description);
    setMessage('');
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      if (!draftTitle.trim()) {
        setMessage('Section title is required.');
        return;
      }
      if (isCreating) {
        await apiSend('/api/sections', 'POST', {
          title: draftTitle.trim(),
          description: draftDescription.trim(),
        });
      } else if (editingSectionId) {
        await apiSend(`/api/sections/${editingSectionId}`, 'PUT', {
          title: draftTitle.trim(),
          description: draftDescription.trim(),
        });
      }
      await onRefresh();
      cancel();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save section.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <Breadcrumb items={[{ label: 'Home', onClick: onBack }, { label: 'Sections' }]} />
      <div className="page-head">
        <div>
          <p className="eyebrow">Sections</p>
          <h1>Manage Sections</h1>
          <p>Create, edit, and delete sections. A section cannot be deleted while it still has exercises.</p>
        </div>
        <div className="actions">
          <button className="primary" onClick={startCreate}>
            New Section
          </button>
          <button className="ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </div>

      {(isCreating || editingSectionId) && (
        <section className="card">
          <div className="form-grid">
            <label className="full">
              Section title
              <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
            </label>
            <label className="full">
              Description
              <input value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} />
            </label>
          </div>
          <div className="actions">
            <button className="primary" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save Section'}
            </button>
            <button className="ghost" onClick={cancel}>
              Cancel
            </button>
            {message && <div className="result">{message}</div>}
          </div>
        </section>
      )}

      <div className="stack">
        {sections.map((section) => (
          <article className="card" key={section.id}>
            <p className="eyebrow">Section</p>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <p className="meta">{section.exercises.length} exercises</p>
            <div className="actions">
              <button className="primary" onClick={() => onOpenSection(section.id)}>
                Open
              </button>
              <button className="ghost" onClick={() => startEdit(section)}>
                Edit
              </button>
              <button
                className="ghost danger"
                onClick={async () => {
                  const confirmed = window.confirm('Delete this section? This cannot be undone.');
                  if (!confirmed) return;
                  try {
                    await apiSend(`/api/sections/${section.id}`, 'DELETE');
                    await onRefresh();
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : 'Delete failed.');
                  }
                }}
              >
                Delete
              </button>
            </div>
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
  onOpenSection: (sectionId: string) => void;
  onRefresh: () => void;
}) {
  const [answers, setAnswers] = useState<AnswerState>({});
  const [optionOrder, setOptionOrder] = useState<OptionOrderState>({});
  const [submitted, setSubmitted] = useState(false);
  const [isEditingExercise, setIsEditingExercise] = useState(false);
  const [editSectionTitle, setEditSectionTitle] = useState(exercise.sectionTitle);
  const [editTitle, setEditTitle] = useState(exercise.title);
  const [editDescription, setEditDescription] = useState(exercise.description);
  const [savingExercise, setSavingExercise] = useState(false);
  const [exerciseSaveMessage, setExerciseSaveMessage] = useState('');
  const [questionEditId, setQuestionEditId] = useState<string | null>(null);

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
    setIsEditingExercise(false);
    setEditSectionTitle(exercise.sectionTitle);
    setEditTitle(exercise.title);
    setEditDescription(exercise.description);
    setQuestionEditId(null);
    setExerciseSaveMessage('');
  }, [exercise.id, exercise.questions]);

  const correctCount = exercise.questions.reduce((count, question) => {
    return count + (answers[question.id] === question.correctOptionId ? 1 : 0);
  }, 0);
  const total = exercise.questions.length;
  const percent = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  const currentSection = sections.find((item) => item.title === exercise.sectionTitle);

  return (
    <section>
      <Breadcrumb
        items={[
          { label: 'Home', onClick: onBack },
          {
            label: exercise.sectionTitle,
            onClick: () => {
              if (currentSection) {
                onOpenSection(currentSection.id);
              }
            },
          },
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
              setIsEditingExercise((current) => !current);
              setExerciseSaveMessage('');
            }}
          >
            {isEditingExercise ? 'Cancel edit' : 'Edit Exercise'}
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

      {isEditingExercise ? (
        <ExerciseMetaEditor
          sections={sections}
          sectionTitle={editSectionTitle}
          title={editTitle}
          description={editDescription}
          onChangeSectionTitle={setEditSectionTitle}
          onChangeTitle={setEditTitle}
          onChangeDescription={setEditDescription}
          onSave={async () => {
            setSavingExercise(true);
            setExerciseSaveMessage('');
            try {
              if (!editTitle.trim()) {
                setExerciseSaveMessage('Please complete the exercise title before saving.');
                return;
              }

              await apiSend(`/api/exercises/${exercise.id}`, 'PUT', {
                title: editTitle.trim(),
                description: editDescription.trim(),
                sectionTitle: editSectionTitle,
              });

              setExerciseSaveMessage('Saved successfully.');
              await onRefresh();
              setIsEditingExercise(false);
            } finally {
              setSavingExercise(false);
            }
          }}
          saving={savingExercise}
          saveMessage={exerciseSaveMessage}
        />
      ) : (
        <>
          <div className="stack">
            {exercise.questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                questionNumber={index + 1}
                isEditing={questionEditId === question.id}
                onOpenEdit={() => setQuestionEditId(question.id)}
                onCancelEdit={() => setQuestionEditId(null)}
                onSave={async (payload) => {
                  await apiSend(`/api/questions/${question.id}`, 'PUT', payload);
                  await onRefresh();
                  setQuestionEditId(null);
                }}
                onAddBelow={async () => {
                  const created = await apiSend<Question>(`/api/exercises/${exercise.id}/questions`, 'POST', {
                    afterQuestionId: question.id,
                  });
                  await onRefresh();
                  setQuestionEditId(created.id);
                }}
                onCopy={async () => {
                  const created = await apiSend<Question>(`/api/exercises/${exercise.id}/questions`, 'POST', {
                    afterQuestionId: question.id,
                    copyQuestionId: question.id,
                  });
                  await onRefresh();
                  setQuestionEditId(created.id);
                }}
                onDelete={async () => {
                  const confirmed = window.confirm('Delete this question?');
                  if (!confirmed) return;
                  await apiSend(`/api/questions/${question.id}`, 'DELETE');
                  await onRefresh();
                }}
                optionOrder={optionOrder[question.id] ?? ['A', 'B', 'C', 'D']}
                answer={answers[question.id]}
                submitted={submitted}
                onSelectAnswer={(optionId) => setAnswers((current) => ({ ...current, [question.id]: optionId }))}
              />
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

function ExerciseMetaEditor({
  sections,
  sectionTitle,
  title,
  description,
  onChangeSectionTitle,
  onChangeTitle,
  onChangeDescription,
  onSave,
  saving,
  saveMessage,
}: {
  sections: Section[];
  sectionTitle: string;
  title: string;
  description: string;
  onChangeSectionTitle: (value: string) => void;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
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

      <div className="actions">
        <button className="primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Exercise'}
        </button>
        {saveMessage && <div className="result">{saveMessage}</div>}
      </div>
    </section>
  );
}

function QuestionCard({
  question,
  questionNumber,
  isEditing,
  onOpenEdit,
  onCancelEdit,
  onSave,
  onAddBelow,
  onCopy,
  onDelete,
  optionOrder,
  answer,
  submitted,
  onSelectAnswer,
}: {
  question: Question;
  questionNumber: number;
  isEditing: boolean;
  onOpenEdit: () => void;
  onCancelEdit: () => void;
  onSave: (payload: DraftQuestion) => Promise<void>;
  onAddBelow: () => Promise<void>;
  onCopy: () => Promise<void>;
  onDelete: () => Promise<void>;
  optionOrder: string[];
  answer?: string;
  submitted: boolean;
  onSelectAnswer: (optionId: string) => void;
}) {
  const [draft, setDraft] = useState<DraftQuestion>(() => questionToDraft(question));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    setDraft(questionToDraft(question));
    setSaveMessage('');
  }, [question]);

  if (isEditing) {
    return (
      <article className="question">
        <div className="page-head compact">
          <div className="question-title-row">
            <h3>Question {questionNumber}</h3>
            <div className="question-icon-actions">
              <button className="icon-btn add" onClick={onAddBelow} title="Add question below" aria-label="Add question below">
                <FontAwesomeIcon icon={faCirclePlus} />
              </button>
              <button className="icon-btn copy" onClick={onCopy} title="Copy question" aria-label="Copy question">
                <FontAwesomeIcon icon={faCopy} />
              </button>
              <button className="icon-btn edit" onClick={onOpenEdit} title="Edit question" aria-label="Edit question">
                <FontAwesomeIcon icon={faPenToSquare} />
              </button>
              <button className="icon-btn delete" onClick={onDelete} title="Delete question" aria-label="Delete question">
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          </div>
          <div className="actions">
            <button className="ghost" onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
        </div>

        <QuestionEditorPanel
          draft={draft}
          onChangeDraft={setDraft}
          onSave={async () => {
            setSaving(true);
            setSaveMessage('');
            try {
              if (!draft.prompt.trim() || !draft.explanation.trim() || !draft.options.every((option) => option.text.trim())) {
                setSaveMessage('Please complete the question before saving.');
                return;
              }
              await onSave(draft);
            } finally {
              setSaving(false);
            }
          }}
          saving={saving}
          saveMessage={saveMessage}
        />
      </article>
    );
  }

  return (
    <article className="question">
      <div className="question-head">
        <div className="question-title">
          <div className="question-title-row">
            <div className="question-number">Question {questionNumber}</div>
            <div className="question-icon-actions">
              <button className="icon-btn add" onClick={onAddBelow} title="Add question below" aria-label="Add question below">
                <FontAwesomeIcon icon={faCirclePlus} />
              </button>
              <button className="icon-btn copy" onClick={onCopy} title="Copy question" aria-label="Copy question">
                <FontAwesomeIcon icon={faCopy} />
              </button>
              <button className="icon-btn edit" onClick={onOpenEdit} title="Edit question" aria-label="Edit question">
                <FontAwesomeIcon icon={faPenToSquare} />
              </button>
              <button className="icon-btn delete" onClick={onDelete} title="Delete question" aria-label="Delete question">
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          </div>
          <RichText value={question.prompt} />
        </div>
      </div>

      <div className="options">
        {['A', 'B', 'C', 'D'].map((label, index) => {
          const orderedOptionId = optionOrder[index] ?? question.options[index]?.id;
          const option = question.options.find((item) => item.id === orderedOptionId);
          if (!option) {
            return null;
          }
          const selected = option.id === answer;
          const correct = option.id === question.correctOptionId;
          const hasAnswer = Boolean(answer);
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
              onClick={() => onSelectAnswer(option.id)}
            >
              <span className="circle">{label}</span>
              <span className="option-text">
                <RichText value={option.text} />
              </span>
            </button>
          );
        })}
      </div>

      {answer && (
        <div className={`feedback ${answer === question.correctOptionId ? 'good' : 'bad'}`}>
          {answer === question.correctOptionId ? 'Correct.' : 'Incorrect.'}{' '}
          <RichText value={question.explanation} />
        </div>
      )}
    </article>
  );
}

function QuestionEditorPanel({
  draft,
  onChangeDraft,
  onSave,
  saving,
  saveMessage,
}: {
  draft: DraftQuestion;
  onChangeDraft: React.Dispatch<React.SetStateAction<DraftQuestion>>;
  onSave: () => Promise<void>;
  saving: boolean;
  saveMessage: string;
}) {
  return (
    <div className="question-editor">
      <label>
        Question prompt
        <textarea value={draft.prompt} onChange={(e) => onChangeDraft((current) => ({ ...current, prompt: e.target.value }))} rows={5} />
      </label>

      <div className="editor-grid">
        {draft.options.map((option, optionIndex) => (
          <div className="editor-option" key={optionIndex}>
            <label>
              Option {String.fromCharCode(65 + optionIndex)}
              <textarea
                value={option.text}
                onChange={(e) =>
                  onChangeDraft((current) => ({
                    ...current,
                    options: current.options.map((opt, j) => (j === optionIndex ? { ...opt, text: e.target.value } : opt)),
                  }))
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
            value={draft.explanation}
            onChange={(e) => onChangeDraft((current) => ({ ...current, explanation: e.target.value }))}
            rows={4}
          />
        </label>
      </div>

      <div className="form-grid">
        <label className="full">
          Correct answer
          <select
            value={draft.correctOptionIndex}
            onChange={(e) =>
              onChangeDraft((current) => ({
                ...current,
                correctOptionIndex: Number(e.target.value),
              }))
            }
          >
            {draft.options.map((option, optionIndex) => (
              <option key={optionIndex} value={optionIndex}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <MediaLibrary />

      <div className="actions">
        <button className="primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Question'}
        </button>
        {saveMessage && <div className="result">{saveMessage}</div>}
      </div>
    </div>
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
  onAddQuestionAtEnd,
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
  onAddQuestion: (questionIndex: number) => void;
  onAddQuestionAtEnd: () => void;
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
                <button className="ghost" onClick={() => onAddQuestion(questionIndex)}>
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
        <button className="ghost" onClick={onAddQuestionAtEnd}>
          Add question
        </button>
        {saveMessage && <div className="result">{saveMessage}</div>}
      </div>

      <MediaLibrary />
    </section>
  );
}

function MediaLibrary() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadMedia = async () => {
    setLoadingMedia(true);
    setMediaError('');
    try {
      const items = await apiGet<MediaItem[]>('/api/media');
      setMediaItems(items);
    } catch {
      setMediaError('Failed to load media files.');
    } finally {
      setLoadingMedia(false);
    }
  };

  useEffect(() => {
    void loadMedia();
  }, []);

  return (
    <section className="card media-library">
      <div className="page-head compact">
        <div>
          <h3>Media Library</h3>
          <p className="meta">Upload an image or audio file, then copy the URL into Markdown.</p>
        </div>
      </div>

      <MediaUpload
        uploading={uploading}
        onUpload={async (file) => {
          setUploading(true);
          setMediaError('');
          try {
            await uploadMedia(file);
            await loadMedia();
          } catch {
            setMediaError('Failed to upload media.');
          } finally {
            setUploading(false);
          }
        }}
      />

      {mediaError && <p className="error">{mediaError}</p>}
      {loadingMedia ? (
        <p>Loading media...</p>
      ) : (
        <div className="media-list">
          {mediaItems.map((item) => (
            <article className="media-item" key={item.name}>
              {item.type === 'image' || item.url.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? (
                <img className="media-preview" src={item.url} alt={item.name} />
              ) : (
                <audio controls src={item.url} className="media-audio" />
              )}
              <div className="media-meta">
                <code className="media-url">{item.url}</code>
                <div className="actions">
                  <button
                    className="ghost"
                    onClick={async () => {
                      const isAudio = item.type === 'audio' || item.url.match(/\.(mp3|wav|ogg)$/i);
                      const snippet = isAudio
                        ? `<audio controls src="${item.url}"></audio>`
                        : `![](${item.url})`;
                      await navigator.clipboard.writeText(snippet);
                    }}
                  >
                    Copy Snippet
                  </button>
                  <button
                    className="ghost danger"
                    onClick={async () => {
                      await deleteMedia(item.name);
                      await loadMedia();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MediaUpload({
  uploading,
  onUpload,
}: {
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  return (
    <div className="form-grid">
      <label className="full">
        Upload image or audio
        <input
          type="file"
          accept="image/*,audio/*"
          disabled={uploading}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await onUpload(file);
            event.target.value = '';
          }}
        />
      </label>
    </div>
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
    sectionId: string;
    title: string;
    description: string;
    questions: DraftQuestion[];
  }) => Promise<void>;
}) {
  const [sectionId, setSectionId] = useState(sections[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([createEmptyDraftQuestion()]);

  useEffect(() => {
    if (!sectionId && sections[0]?.id) {
      setSectionId(sections[0].id);
    }
  }, [sections, sectionId]);

  const submit = async () => {
    const cleanQuestions = questions.filter(
      (question) =>
        question.prompt.trim() &&
        question.explanation.trim() &&
        question.options.every((option) => option.text.trim()),
    );
    if (!title.trim() || cleanQuestions.length === 0) return;
    await onCreate({
      sectionId,
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
        sectionTitle={sections.find((section) => section.id === sectionId)?.title || ''}
        title={title}
        description={description}
        questions={questions}
        onChangeSectionTitle={(value) => {
          const matched = sections.find((section) => section.title === value);
          setSectionId(matched?.id || '');
        }}
        onChangeTitle={setTitle}
        onChangeDescription={setDescription}
        onChangeQuestions={setQuestions}
        onAddQuestion={(questionIndex) =>
          setQuestions((current) => {
            const next = [...current];
            next.splice(questionIndex + 1, 0, createEmptyDraftQuestion());
            return next;
          })
        }
        onAddQuestionAtEnd={() => setQuestions((current) => [...current, createEmptyDraftQuestion()])}
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
