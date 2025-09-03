import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCreateQuestion, useQuestions, useUpdateQuestion } from '../../hooks';
import type { QuestionSummary } from '../../types';
import { Edit, Save, X } from 'lucide-react';

export default function QuestionBankPage() {
  const { data, isLoading, isError } = useQuestions();
  const createQ = useCreateQuestion();
  const updateQ = useUpdateQuestion();

  const [newStem, setNewStem] = useState('');
  const [newOptionA, setNewOptionA] = useState('');
  const [newOptionB, setNewOptionB] = useState('');
  const [newCorrect, setNewCorrect] = useState<'A'|'B'>('A');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStem, setEditStem] = useState('');
  const [editOptionA, setEditOptionA] = useState('');
  const [editOptionB, setEditOptionB] = useState('');
  const [editCorrect, setEditCorrect] = useState<'A'|'B'>('A');

  const handleCreate = async () => {
    if (!newStem || !newOptionA || !newOptionB) return;
    await createQ.mutateAsync({
      type: 'MCQ_SINGLE',
      translations: [
        { locale: 'fr', stemMd: newStem },
      ],
      options: [
        {
          isCorrect: newCorrect === 'A',
          orderIndex: 0,
          translations: [{ locale: 'fr', text: newOptionA }],
        },
        {
          isCorrect: newCorrect === 'B',
          orderIndex: 1,
          translations: [{ locale: 'fr', text: newOptionB }],
        },
      ],
    });
    setNewStem('');
    setNewOptionA('');
    setNewOptionB('');
  };

  const startEdit = (question: QuestionSummary) => {
    setEditingId(question.id);
    // For now, we'll use placeholder values since we don't have full question details
    setEditStem(question.id.slice(0, 8) + ' - Edit this question');
    setEditOptionA('Option A');
    setEditOptionB('Option B');
    setEditCorrect('A');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditStem('');
    setEditOptionA('');
    setEditOptionB('');
    setEditCorrect('A');
  };

  const handleUpdate = async (questionId: string) => {
    if (!editStem || !editOptionA || !editOptionB) return;
    await updateQ.mutateAsync({
      id: questionId,
      payload: {
        type: 'MCQ_SINGLE',
        translations: [
          { locale: 'fr', stemMd: editStem },
        ],
        options: [
          {
            isCorrect: editCorrect === 'A',
            orderIndex: 0,
            translations: [{ locale: 'fr', text: editOptionA }],
          },
          {
            isCorrect: editCorrect === 'B',
            orderIndex: 1,
            translations: [{ locale: 'fr', text: editOptionB }],
          },
        ],
      }
    });
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Question Bank</h1>
        <p className="text-gray-600">Create and manage questions.</p>
      </div>

      <div className="rounded border p-4 space-y-3">
        <h2 className="font-medium">Quick create (FR)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Stem (Markdown)</label>
            <textarea value={newStem} onChange={e=>setNewStem(e.target.value)} className="w-full border rounded p-2" rows={3} placeholder="Ex: Quelle est la capitale du Sénégal ?" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Option A</label>
            <input value={newOptionA} onChange={e=>setNewOptionA(e.target.value)} className="w-full border rounded p-2" placeholder="Dakar" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Option B</label>
            <input value={newOptionB} onChange={e=>setNewOptionB(e.target.value)} className="w-full border rounded p-2" placeholder="Thiès" />
          </div>
          <div className="flex items-center gap-4 md:col-span-2">
            <label className="text-sm text-gray-600">Correct:</label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="correct" checked={newCorrect==='A'} onChange={()=>setNewCorrect('A')} /> A
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="correct" checked={newCorrect==='B'} onChange={()=>setNewCorrect('B')} /> B
            </label>
            <Button onClick={handleCreate} disabled={createQ.isPending}>Create</Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Questions</h2>
          {isLoading && <span className="text-sm text-gray-500">Loading...</span>}
          {isError && <span className="text-sm text-red-600">Failed to load</span>}
        </div>
        <ul className="divide-y">
          {(data ?? []).map((q: QuestionSummary)=> (
            <li key={q.id} className="py-3">
              {editingId === q.id ? (
                <div className="space-y-3 border rounded p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Edit Question</h3>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleUpdate(q.id)} disabled={updateQ.isPending}>
                        <Save className="w-4 h-4 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        <X className="w-4 h-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-600 mb-1">Stem (Markdown)</label>
                      <textarea value={editStem} onChange={e=>setEditStem(e.target.value)} className="w-full border rounded p-2" rows={3} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Option A</label>
                      <input value={editOptionA} onChange={e=>setEditOptionA(e.target.value)} className="w-full border rounded p-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Option B</label>
                      <input value={editOptionB} onChange={e=>setEditOptionB(e.target.value)} className="w-full border rounded p-2" />
                    </div>
                    <div className="flex items-center gap-4 md:col-span-2">
                      <label className="text-sm text-gray-600">Correct:</label>
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name={`edit-correct-${q.id}`} checked={editCorrect==='A'} onChange={()=>setEditCorrect('A')} /> A
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name={`edit-correct-${q.id}`} checked={editCorrect==='B'} onChange={()=>setEditCorrect('B')} /> B
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium">{q.id.slice(0, 8)}</div>
                    <div className="text-sm text-gray-500">Type: {q.type}</div>
                    <div className="text-sm text-gray-600 mt-1">Created: {new Date().toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(q)}>
                      <Edit className="w-4 h-4 mr-1" /> Edit
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}