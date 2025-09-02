import { useQuery, useMutation } from '@tanstack/react-query';
import { AssessAPI } from '@/modules/shared/api';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { StartAttemptResponse } from '@/modules/assess/types';

export default function StudentAssessPage(){
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['student','assess','available'], queryFn: AssessAPI.available });
  const start = useMutation<StartAttemptResponse, unknown, string>({
    mutationFn: (quizId: string) => AssessAPI.start(quizId),
    onSuccess: (res) => {
      navigate(`/student/assess/attempt/${res.attemptId}`);
    }
  });
  if (isLoading) return <p>Chargement…</p>;
  const quizzes = data || [];
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Évaluations disponibles</h2>
      {!quizzes.length ? <p>Aucun quiz disponible.</p> : (
        <ul className="space-y-2">
          {quizzes.map((q)=> (
            <li key={q.id} className="border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div>
                  <div className="font-medium">{q.title || `Quiz ${q.id.slice(0,8)}`}</div>
                  <div className="text-xs opacity-70">{q.openAt ? `Ouvre: ${new Date(q.openAt).toLocaleString()}` : ''}{q.closeAt ? ` · Ferme: ${new Date(q.closeAt).toLocaleString()}` : ''}</div>
                </div>
                <Button size="sm" className="ml-auto" onClick={()=> start.mutate(q.id)} disabled={start.isPending}>Commencer</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}