import { useMemo } from 'react';
import { useMyQuizzes, usePublishQuiz } from '../../hooks';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function QuizListPage() {
  const { data, isLoading, isError, refetch } = useMyQuizzes();
  const publish = usePublishQuiz();
  const rows = useMemo(() => Array.isArray(data) ? data : [], [data]);

  const onToggle = async (id: string, status: string) => {
    const to = status === 'PUBLISHED' ? false : true;
    await publish.mutateAsync({ id, publish: to });
    await refetch();
  };

  if (isLoading) return <div>Loading quizzes…</div>;
  if (isError) return (
    <div className="space-y-3">
      <div className="text-red-600">Failed to load quizzes.</div>
      <Button onClick={()=>refetch()}>Retry</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Quizzes</h1>
        <Link to="/teacher/assess/quizzes/new" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">New Quiz</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-3 py-2 text-left">Title</th>
              <th className="border px-3 py-2 text-left">Status</th>
              <th className="border px-3 py-2 text-left">Window</th>
              <th className="border px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q: any) => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{q.title || q.id.slice(0,8)}</td>
                <td className="border px-3 py-2">{q.status}</td>
                <td className="border px-3 py-2 text-sm text-gray-600">
                  {(q.openAt ? new Date(q.openAt).toLocaleString() : '—')} – {(q.closeAt ? new Date(q.closeAt).toLocaleString() : '—')}
                </td>
                <td className="border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Link to={`/teacher/assess/quizzes/${q.id}/submissions`} className="rounded border px-3 py-1 text-sm">Submissions</Link>
                    <Button size="sm" onClick={()=> onToggle(q.id, q.status)} disabled={publish.isPending}>
                      {q.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="text-sm text-gray-600">No quizzes yet.</div>}
    </div>
  );
}

