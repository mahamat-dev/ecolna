import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Locale, NoteTranslation } from '../types';

const LOCALES: Locale[] = ['fr','en','ar'];

export function TranslationFields({ value, onChange }: { value: NoteTranslation[]; onChange: (v: NoteTranslation[]) => void }) {
  function setItem(loc: Locale, patch: Partial<NoteTranslation>) {
    const next = [...value];
    const idx = next.findIndex(t => t.locale === loc);
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...patch } as NoteTranslation;
    } else {
      next.push({ locale: loc, title: '', bodyMd: '', ...patch } as NoteTranslation);
    }
    onChange(next);
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {LOCALES.map(loc => (
        <div key={loc} className="space-y-2 border p-3 rounded-xl">
          <div className="text-xs uppercase opacity-70">{loc}</div>
          <Input 
            placeholder="Titre" 
            value={value.find(v=>v.locale===loc)?.title || ''} 
            onChange={e=>setItem(loc,{ title: e.target.value })} 
          />
          <Textarea 
            placeholder="Corps (Markdown)" 
            rows={8} 
            value={value.find(v=>v.locale===loc)?.bodyMd || ''} 
            onChange={e=>setItem(loc,{ bodyMd: e.target.value })} 
          />
        </div>
      ))}
    </div>
  );
}