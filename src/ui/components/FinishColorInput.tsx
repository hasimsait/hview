import { useEffect, useState } from 'react';

/** A hex value can be copied between wall paint, slats and felt without rounding. */
export function FinishColorInput({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const change = (next: string) => { setDraft(next); if (/^#[a-f\d]{6}$/i.test(next)) onChange(next.toLowerCase()); };
  return <label className="flex items-center gap-2 text-[11px] text-slate-300">
    <span className="mr-auto">{label}</span>
    <input type="color" aria-label={`${label} picker`} value={value} onChange={e => change(e.target.value)} className="h-7 w-8 rounded border border-slate-600 bg-transparent" />
    <input type="text" aria-label={`${label} hex`} value={draft} spellCheck={false} onChange={e => change(e.target.value)} onBlur={() => setDraft(value)} className="w-20 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 font-mono" />
  </label>;
}
