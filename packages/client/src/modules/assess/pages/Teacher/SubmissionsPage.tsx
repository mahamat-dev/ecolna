import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSubmissions } from '../../hooks';
import type { SubmissionSummary } from '../../types';
import { API_URL } from '@/lib/env';

export default function SubmissionsPage() {
  const { quizId } = useParams();
  const { data, isLoading, isError, refetch } = useSubmissions(quizId!);

  const rows = useMemo<SubmissionSummary[]>(() => (Array.isArray(data) ? data : []), [data]);

  if (isLoading) return <div>Loading submissions...</div>;
  if (isError) return (
    <div className="space-y-4">
      <div className="text-red-600">Error loading submissions</div>
      <Button onClick={() => refetch()}>Retry</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quiz Submissions</h1>
          <p className="text-gray-600">Quiz ID: {quizId}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${API_URL}/assessments/teacher/quizzes/${quizId}/submissions.csv`}
            target="_blank"
            rel="noreferrer"
            className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          >
            Export CSV
          </a>
          <Button onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-4 py-2 text-left">Submission ID</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Student ID</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Score</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Submitted At</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((submission) => (
              <tr key={submission.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">{submission.id.slice(0, 8)}</td>
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">{submission.studentProfileId.slice(0, 8)}</td>
                <td className="border border-gray-300 px-4 py-2">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    submission.status === 'GRADED' ? 'bg-green-100 text-green-800' :
                    submission.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                    submission.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {submission.status}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {submission.score ? `${submission.score}` : '—'}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No submissions yet.
        </div>
      )}

      <div className="text-sm text-gray-500">
        Total submissions: {rows.length}
      </div>
    </div>
  );
}
