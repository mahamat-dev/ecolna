import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCreateQuiz, useQuestions } from '../../hooks';
import type { CreateQuizDto, QuestionSummary } from '../../types';
import { useQuery } from '@tanstack/react-query';
import { AcademicsAPI } from '@/modules/shared/api';
import { useMe } from '@/modules/auth/hooks';

export default function QuizCreatePage() {
  const navigate = useNavigate();
  const { data: questions, isLoading: loadingQuestions, isError: errorQuestions } = useQuestions();
  const createQuiz = useCreateQuiz();

  // Basic info (FR-only for now)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitSec, setTimeLimitSec] = useState<string>('');
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);

  // Selection of questions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pointsById, setPointsById] = useState<Record<string, string>>({});

  // User role check
  const me = useMe();
  const roles: string[] = me.data?.user?.roles ?? [];
  const isTeacherOnly = roles.includes('TEACHER') && !roles.includes('ADMIN') && !roles.includes('STAFF');

  // Audience builder (from assignments for teachers)
  const { data: assignments } = useQuery({ queryKey: ['teaching','assignments','me'], queryFn: AcademicsAPI.mySectionsTaught });
  type AudienceItem = { scope: 'SUBJECT'|'CLASS_SECTION'|'GRADE_LEVEL'|'ALL'; subjectId?: string; classSectionId?: string; gradeLevelId?: string };
  type Assignment = { subjectId?: string; classSectionId?: string; classSectionName?: string; gradeLevelId?: string };
  const [audience, setAudience] = useState<AudienceItem[]>([]);

  const subjects = useMemo(() => {
    const set = new Map<string, { id: string }>();
    (assignments as Assignment[] ?? []).forEach((a: Assignment) => { if (a.subjectId) set.set(a.subjectId, { id: a.subjectId }); });
    return Array.from(set.values());
  }, [assignments]);
  const sections = useMemo(() => {
    const map = new Map<string, { id: string; name?: string|null }>();
    (assignments as Assignment[] ?? []).forEach((a: Assignment) => { if (a.classSectionId) map.set(a.classSectionId, { id: a.classSectionId, name: a.classSectionName }); });
    return Array.from(map.values());
  }, [assignments]);
  const grades = useMemo(() => {
    const set = new Map<string, { id: string }>();
    (assignments as Assignment[] ?? []).forEach((a: Assignment) => { if (a.gradeLevelId) set.set(a.gradeLevelId, { id: a.gradeLevelId }); });
    return Array.from(set.values());
  }, [assignments]);

  const addAudience = (item: AudienceItem) => {
    setAudience(prev => {
      // prevent duplicates of same scope+id
      const key = (x: AudienceItem) => `${x.scope}:${x.subjectId||x.classSectionId||x.gradeLevelId||''}`;
      if (prev.some(p => key(p) === key(item))) return prev;
      return [...prev, item];
    });
  };
  const removeAudience = (idx: number) => setAudience(prev => prev.filter((_, i) => i !== idx));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const orderedSelected = useMemo(() => selectedIds.map((id, idx) => ({ id, orderIndex: idx })), [selectedIds]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    if (orderedSelected.length === 0) return;

    const payload: CreateQuizDto = {
      subjectId: undefined,
      translations: [
        { locale: 'fr', title: title.trim(), description: description.trim() || undefined },
      ],
      timeLimitSec: timeLimitSec ? Number(timeLimitSec) : null,
      maxAttempts: maxAttempts || 1,
      shuffleQuestions,
      shuffleOptions,
      // openAt/closeAt omitted in client for now
      audience: audience.length ? audience : [ { scope: 'ALL' } ],
      questions: orderedSelected.map(({ id, orderIndex }) => ({
        questionId: id,
        orderIndex,
        points: Number(pointsById[id] ?? '1'),
      })),
    };

    if (isTeacherOnly && audience.length === 0) return; // enforce audience for teachers
    const res = await createQuiz.mutateAsync(payload);
    const newId = res?.id;
    if (newId) {
      navigate(`/teacher/assess/quizzes/${newId}/submissions`);
    }
  };

  type QuestionWithTranslations = QuestionSummary & { translations?: Array<{ title?: string; stemMd?: string }> };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Quiz</h1>
        <p className="text-gray-600">Define quiz details and pick questions from the bank.</p>
      </div>

      <div className="rounded border p-4 space-y-4">
        <h2 className="font-medium">Basic Info (FR)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Title</label>
            <input className="w-full border rounded p-2" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Chapitre 1: Quiz" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Description (Markdown)</label>
            <textarea className="w-full border rounded p-2" rows={3} value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Instructions du quiz..." />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Time limit (seconds)</label>
            <input type="number" className="w-full border rounded p-2" value={timeLimitSec} onChange={(e)=>setTimeLimitSec(e.target.value)} placeholder="ex: 600" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Max attempts (1-10)</label>
            <input type="number" min={1} max={10} className="w-full border rounded p-2" value={maxAttempts} onChange={(e)=>setMaxAttempts(Number(e.target.value || 1))} />
          </div>
          <div className="flex items-center gap-6 md:col-span-2">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={shuffleQuestions} onChange={(e)=>setShuffleQuestions(e.target.checked)} />
              <span className="text-sm text-gray-700">Shuffle questions</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={shuffleOptions} onChange={(e)=>setShuffleOptions(e.target.checked)} />
              <span className="text-sm text-gray-700">Shuffle options</span>
            </label>
          </div>
          <div className="md:col-span-2">
            <h3 className="font-medium">Audience</h3>
            <div className="text-sm text-gray-700">Define who can see this quiz. Teachers should pick from their subjects/sections/grades.</div>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">By Subject</div>
                <div className="space-y-2">
                  {subjects.map(s => (
                    <button key={s.id} className="text-sm underline" onClick={()=> addAudience({ scope: 'SUBJECT', subjectId: s.id })}>
                      Add subject {s.id.slice(0,8)}
                    </button>
                  ))}
                  {!subjects.length && <div className="text-xs text-gray-500">No subjects found</div>}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">By Section</div>
                <div className="space-y-2">
                  {sections.map(s => (
                    <button key={s.id} className="text-sm underline" onClick={()=> addAudience({ scope: 'CLASS_SECTION', classSectionId: s.id })}>
                      Add section {s.name || s.id.slice(0,8)}
                    </button>
                  ))}
                  {!sections.length && <div className="text-xs text-gray-500">No sections found</div>}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">By Grade</div>
                <div className="space-y-2">
                  {grades.map(g => (
                    <button key={g.id} className="text-sm underline" onClick={()=> addAudience({ scope: 'GRADE_LEVEL', gradeLevelId: g.id })}>
                      Add grade {g.id.slice(0,8)}
                    </button>
                  ))}
                  {!grades.length && <div className="text-xs text-gray-500">No grades found</div>}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-sm font-medium mb-1">Selected audience</div>
              {!audience.length && <div className="text-xs text-gray-500">None — will default to ALL (if permitted)</div>}
              <ul className="flex flex-wrap gap-2">
                {audience.map((a, idx) => (
                  <li key={idx} className="px-2 py-1 rounded-full border text-xs flex items-center gap-2">
                    <span>{a.scope}</span>
                    {a.subjectId && <span>{a.subjectId.slice(0,8)}</span>}
                    {a.classSectionId && <span>{a.classSectionId.slice(0,8)}</span>}
                    {a.gradeLevelId && <span>{a.gradeLevelId.slice(0,8)}</span>}
                    <button onClick={()=> removeAudience(idx)} className="opacity-70 hover:opacity-100">×</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Pick Questions</h2>
          {loadingQuestions && <span className="text-sm text-gray-500">Loading…</span>}
          {errorQuestions && <span className="text-sm text-red-600">Failed to load questions</span>}
        </div>
        <div className="space-y-2 max-h-80 overflow-auto pr-2">
          {(Array.isArray(questions) ? (questions as QuestionSummary[]) : []).map((q) => {
            const checked = selectedIds.includes(q.id);
            const qx = q as QuestionWithTranslations;
            return (
              <div key={q.id} className="flex items-start justify-between gap-4 py-2 border-b">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={checked} onChange={() => toggleSelect(q.id)} />
                  <div>
                    <div className="font-medium">{qx.translations?.[0]?.title || qx.translations?.[0]?.stemMd?.slice(0, 120) || q.id}</div>
                    <div className="text-xs text-gray-500">Type: {q.type}</div>
                  </div>
                </label>
                {checked && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Points</label>
                    <input
                      type="number"
                      min={0}
                      className="w-24 border rounded p-1"
                      value={pointsById[q.id] ?? '1'}
                      onChange={(e)=> setPointsById((p)=> ({ ...p, [q.id]: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {(!Array.isArray(questions) || questions.length === 0) && (
            <div className="text-sm text-gray-600">No questions yet. Create some in the Question Bank.</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleCreate} disabled={createQuiz.isPending || !title.trim() || orderedSelected.length === 0 || (isTeacherOnly && audience.length === 0)}>Create quiz</Button>
        <div className="text-sm text-gray-500">{orderedSelected.length} question(s) selected</div>
      </div>
      {isTeacherOnly && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          Teachers must target a specific audience (Subject/Section/Grade). "ALL" is not allowed.
        </div>
      )}
    </div>
  );
}
