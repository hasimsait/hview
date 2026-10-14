import React, { useEffect, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { MIN_SURFACE_LAYER, MAX_SURFACE_LAYER, normalizeSurfaceLayer } from '@core/types/surfaceLayer';

interface Props {
  layer?: number;
  disabled?: boolean;
  onChange: (layer: number) => void;
}

export const SurfaceLayerControl: React.FC<Props> = ({ layer, disabled, onChange }) => {
  const value = normalizeSurfaceLayer(layer);
  const [draft, setDraft] = useState(String(value));
  const id = useId();
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() && Number.isInteger(parsed)) {
      const next = normalizeSurfaceLayer(parsed);
      setDraft(String(next));
      if (next !== value) onChange(next);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-slate-200">Surface layer</label>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Decrease surface layer" disabled={disabled || value <= MIN_SURFACE_LAYER}
            onClick={() => onChange(value - 1)} className="p-1.5 rounded bg-slate-800 text-slate-300 disabled:opacity-40">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <input id={id} aria-label="Surface layer" type="number" step={1} min={MIN_SURFACE_LAYER} max={MAX_SURFACE_LAYER}
            value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') { event.preventDefault(); setDraft(String(value)); }
            }}
            className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center text-xs text-slate-100 disabled:opacity-40" />
          <button type="button" aria-label="Increase surface layer" disabled={disabled || value >= MAX_SURFACE_LAYER}
            onClick={() => onChange(value + 1)} className="p-1.5 rounded bg-slate-800 text-slate-300 disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-slate-400">
        {disabled ? 'Choose a finish to set its layer.' : 'Higher layers cover lower layers on the same plane. Default: 0.'}
      </p>
    </div>
  );
};
