import { FinishColorInput } from './FinishColorInput';
import { useEffect, useMemo, useRef } from 'react';
import type { SurfaceFinishConfig } from '../../domain/model/PlanData';
import { BAUHAUS_PANEL_FINISHES, bauhausPanel, type BauhausPanelFinish } from '../../domain/catalog/BauhausPanelling';
import { ReferencePanelTextureStrategy } from '../../engine/materials/strategies/ReferencePanelTextureStrategy';
import { BrowserCanvasFactory } from '../../engine/materials/CanvasFactory';
import { TextureSource } from '../../engine/materials/TextureSource';

interface PreviewResources { source: TextureSource; textures: ReferencePanelTextureStrategy; }
function PanelSwatch({ panel, resources, finish }: { panel: BauhausPanelFinish; resources: PreviewResources; finish?: SurfaceFinishConfig }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const { source, textures } = resources;
    const texture = textures.get(panel, finish?.woodColor, finish?.backingColor);
    const paint = () => {
      const target = canvas.current;
      if (target) target.getContext('2d')!.drawImage(texture.image as HTMLCanvasElement, 0, 0, target.width, target.height);
    };
    paint(); const unsubscribe = source.subscribe(paint);
    return () => { unsubscribe(); texture.dispose(); };
  }, [panel, resources, finish?.woodColor, finish?.backingColor]);
  return <canvas ref={canvas} width={128} height={128} className="h-16 w-16 shrink-0 rounded border border-slate-700" aria-label={`${panel.name} wood grain and felt preview`} />;
}
export function ReferencePanelPicker({ current, onSelect }: { current?: SurfaceFinishConfig; onSelect: (finish: SurfaceFinishConfig) => void }) {
  const resources = useMemo(() => {
    const source = new TextureSource();
    return { source, textures: new ReferencePanelTextureStrategy(new BrowserCanvasFactory(), source) };
  }, []);
  useEffect(() => () => resources.textures.dispose(), [resources]);
  const selected = current?.type === 'lambri' ? bauhausPanel(current.variant) : undefined;
  return <section className="space-y-2 rounded-lg border border-slate-700 p-2">
    <div className="text-xs font-semibold text-slate-200">Bauhaus wood panels</div>
    <p className="text-[10px] text-slate-400">Reference-matched tones with photographic grain. 25 mm wood / 15 mm felt. View under your room lighting.</p>
    {selected && current && <div className="space-y-2 rounded border border-slate-700 bg-slate-950 p-2">
      <div className="text-[11px] font-medium text-slate-200">Adjust {selected.name}</div>
      <FinishColorInput label="Wood color" value={current.woodColor ?? selected.color} onChange={woodColor => onSelect({ ...current, woodColor })} />
      <FinishColorInput label="Felt color" value={current.backingColor ?? selected.backingColor} onChange={backingColor => onSelect({ ...current, backingColor })} />
      <p className="text-[10px] text-slate-400">Wood color sets the grain's base tone. Felt stays independent. Use Compare surface colors in Lighting to compare against wall paint.</p>
      <button type="button" className="text-[10px] text-sky-400" onClick={() => { const { woodColor: _override, ...finish } = current; onSelect({ ...finish, backingColor: selected.backingColor }); }}>Restore reference colors</button>
    </div>}
    <details open={!selected}><summary className="cursor-pointer text-[11px] text-slate-300">Choose a panel ({BAUHAUS_PANEL_FINISHES.length} finishes)</summary>
    <div className="mt-2 grid grid-cols-1 gap-1.5">{BAUHAUS_PANEL_FINISHES.map(panel => <div key={panel.id} className="rounded border border-slate-800 bg-slate-900/60">
      <button type="button" aria-pressed={current?.type === 'lambri' && current.variant === panel.id}
        className="flex w-full items-center gap-2 rounded p-2 text-left aria-pressed:bg-amber-600/20"
        onClick={() => onSelect({ type: 'lambri', variant: panel.id, color: '#ffffff', roughness: .7, backingColor: panel.backingColor, rotation: current?.rotation ?? 0 })}>
        <PanelSwatch panel={panel} resources={resources} finish={current?.variant === panel.id ? current : undefined} />
        <span className="min-w-0 text-[11px] text-slate-200"><span className="block font-medium">{panel.name}</span><span className="block text-[10px] text-slate-400">{Math.round(panel.panelWidth * 100)} × {Math.round(panel.panelHeight * 100)} cm · {panel.sku}</span></span>
      </button>
      <a href={panel.sourceUrl} target="_blank" rel="noreferrer" className="mb-1 ml-2 inline-block text-[10px] text-amber-400">Product reference</a>
    </div>)}</div></details>
    {current?.type === 'lambri' && current.variant?.startsWith('bauhaus_') && <div className="flex gap-2">{[0, 90].map(rotation => <button type="button" key={rotation} aria-pressed={(current.rotation ?? 0) === rotation} className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 aria-pressed:bg-amber-600" onClick={() => onSelect({ ...current, rotation })}>{rotation === 0 ? 'Vertical slats' : 'Horizontal slats'}</button>)}</div>}
  </section>;
}
