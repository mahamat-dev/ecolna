import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/FormField';
import { TranslationFields } from './TranslationFields';
import { AudienceSelector } from './AudienceSelector';
import { FileUploader } from './FileUploader';
import { get } from '@/lib/api';
import type { AudienceInput, CreateNoteInput, NoteTranslation } from '../types';

interface AcademicYear {
  id: string;
  code: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
}

interface Term {
  id: string;
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  orderIndex: number;
}

export function NoteForm({ initial, onSubmit, submitting }:{ initial?: Partial<CreateNoteInput>; submitting?: boolean; onSubmit: (val: CreateNoteInput) => void }) {
  const [translations, setTranslations] = useState<NoteTranslation[]>(initial?.translations || [{ locale:'fr', title:'', bodyMd:'' }]);
  const [audiences, setAudiences] = useState<AudienceInput[]>(initial?.audiences || [{ scope:'ALL' } as AudienceInput]);
  const [attachments, setAttachments] = useState<string[]>(initial?.attachments || []);
  const [pinUntil, setPinUntil] = useState<string>((initial?.pinUntil as string) || '');
  const [academicYearId, setAcademicYearId] = useState<string>((initial as CreateNoteInput & { academicYearId?: string })?.academicYearId || '');
  const [termId, setTermId] = useState<string>((initial as CreateNoteInput & { termId?: string })?.termId || '');

  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => get<AcademicYear[]>('academics/academic-years'),
  });

  const { data: terms = [] } = useQuery({
    queryKey: ['terms', academicYearId],
    queryFn: () => academicYearId ? get<Term[]>(`academics/terms?academicYearId=${academicYearId}`) : Promise.resolve([]),
    enabled: !!academicYearId,
  });

  function addFile(fileId: string){ 
    setAttachments(prev => [...prev, fileId]); 
  }

  function submit(){
    onSubmit({ 
      translations, 
      audiences, 
      attachments, 
      pinUntil: pinUntil || null,
      academicYearId: academicYearId || null,
      termId: termId || null
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-semibold">Traductions</h3>
        <TranslationFields value={translations} onChange={setTranslations} />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Fichiers</h3>
        <FileUploader onUploaded={addFile} />
        <div className="text-sm opacity-70">Fichiers joints: {attachments.length}</div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Audience</h3>
        <AudienceSelector value={audiences} onChange={setAudiences} />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Contexte académique</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Année scolaire</label>
            <Select 
               value={academicYearId} 
               onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                 setAcademicYearId(e.target.value);
                 setTermId(''); // Reset term when year changes
               }}
             >
              <option value="">Sélectionner une année</option>
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>
                  {year.code} {year.isActive && '(Active)'}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Trimestre/Semestre</label>
            <Select 
               value={termId} 
               onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTermId(e.target.value)}
               disabled={!academicYearId}
             >
              <option value="">Sélectionner un trimestre</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Épinglage</h3>
        <Input type="datetime-local" value={pinUntil} onChange={e=>setPinUntil(e.target.value)} />
      </section>

      <Button onClick={submit} disabled={submitting}>Enregistrer</Button>
    </div>
  );
}