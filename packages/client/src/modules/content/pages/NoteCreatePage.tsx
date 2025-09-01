import { useNavigate } from 'react-router-dom';
import { useCreateNote } from '../hooks';
import { NoteForm } from '../components/NoteForm';

export default function NoteCreatePage(){
  const nav = useNavigate();
  const create = useCreateNote();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Nouvelle note</h2>
      <NoteForm 
        onSubmit={(val)=>create.mutate(val, { 
          onSuccess: (data)=> {
            const n = data as { id: string };
            nav(`/content/notes/${n.id}`);
          }
        })} 
        submitting={create.isPending} 
      />
    </div>
  );
}