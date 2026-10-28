import { useEffect, useMemo, useRef } from 'react';
import type { SurfaceFinishConfig } from '../../domain/model/PlanData';
import { BAUHAUS_PANEL_FINISHES, type BauhausPanelFinish } from '../../domain/catalog/BauhausPanelling';
import { ReferencePanelTextureStrategy } from '../../engine/materials/strategies/ReferencePanelTextureStrategy';
import { BrowserCanvasFactory } from '../../engine/materials/CanvasFactory';
import { TextureSource } from '../../engine/materials/TextureSource';

interface PreviewResources { source: TextureSource; textures: ReferencePanelTextureStrategy; }
function PanelSwatch({ panel, resources }: { panel: BauhausPanelFinish; resources: PreviewResources }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const { source, textures } = resources;
    const texture = textures.get(panel);
    const paint = () => {
      const target = canvas.current;
      if (target) target.getContext('2d')!.drawImage(texture.image as HTMLCanvasElement, 0, 0, target.width, target.height);
    };
    paint(); const unsubscribe = source.subscribe(paint);
    return unsubscribe;
  }, [panel, resources]);
  return <canvas ref={canvas} width={128} height={128} className="h-16 w-16 shrink-0 rounded border border-slate-700" aria-label={`${panel.name} wood grain and felt preview`} />;
}
export function ReferencePanelPicker({ current, onSelect }: { current?: SurfaceFinishConfig; onSelect: (finish: SurfaceFinishConfig) => void }) {
  const resources = useMemo(() => {
    const source = new TextureSource();
    return { source, textures: new ReferencePanelTextureStrategy(new BrowserCanvasFactory(), source) };
  }, []);
  useEffect(() => () => resources.textures.dispose(), [resources]);
  return <section className="space-y-2 rounded-lg border border-slate-700 p-2">
    <div className="text-xs font-semibold text-slate-200">Bauhaus wood panels</div>
    <p className="text-[10px] text-slate-400">Reference-matched tones with photographic grain. 25 mm wood / 15 mm felt. View under your room lighting.</p>
    <div className="grid grid-cols-1 gap-1.5">{BAUHAUS_PANEL_FINISHES.map(panel => <div key={panel.id} className="rounded border border-slate-800 bg-slate-900/60">
      <button type="button" aria-pressed={current?.type === 'lambri' && current.variant === panel.id}
        className="flex w-full items-center gap-2 rounded p-2 text-left aria-pressed:bg-amber-600/20"
        onClick={() => onSelect({ type: 'lambri', variant: panel.id, color: '#ffffff', roughness: .7, backingColor: panel.backingColor, rotation: current?.rotation ?? 0 })}>
        <PanelSwatch panel={panel} resources={resources} />
        <span className="min-w-0 text-[11px] text-slate-200"><span className="block font-medium">{panel.name}</span><span className="block text-[10px] text-slate-400">{Math.round(panel.panelWidth * 100)} × {Math.round(panel.panelHeight * 100)} cm · {panel.sku}</span></span>
      </button>
      <a href={panel.sourceUrl} target="_blank" rel="noreferrer" className="mb-1 ml-2 inline-block text-[10px] text-amber-400">Product reference</a>
    </div>)}</div>
    {current?.type === 'lambri' && current.variant?.startsWith('bauhaus_') && <div className="flex gap-2">{[0, 90].map(rotation => <button type="button" key={rotation} aria-pressed={(current.rotation ?? 0) === rotation} className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 aria-pressed:bg-amber-600" onClick={() => onSelect({ ...current, rotation })}>{rotation === 0 ? 'Vertical slats' : 'Horizontal slats'}</button>)}</div>}
  </section>;
}
