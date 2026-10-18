import type { WallEntity } from '../../../core/types/plan';
import { useRuntime } from '../../context/RuntimeContext';
import { ConfigureWallCornice, SetWallSkirting } from '../../../application/commands/StructuralCommands';
import { CORNICE_PROFILES, defaultWallCornice, type WallCorniceConfig } from '../../../domain/model/WallCornice';
import { CorniceSideControls } from './CorniceSideControls';

export function WallTrimControls({ wall, target }: { wall: WallEntity; target: string }) {
  const { editor } = useRuntime();
  if (target === 'baseboard' || target === 'edge_bottom') return <section aria-label="Skirting boards" className="space-y-2 rounded border border-slate-700 p-3 mt-3">
    <strong>Skirting boards</strong>
    <label className="flex items-center gap-2"><input aria-label="Skirting boards enabled" type="checkbox" checked={!!wall.finishBaseboard} onChange={e => editor.execute(new SetWallSkirting(wall.id, e.target.checked))} />Enable skirting boards</label>
    <p className="text-slate-400">Runs along the floor and stops at door openings. Choose its finish below.</p>
  </section>;
  if (target !== 'cornice') return null;
  const config = wall.cornice ?? { ...defaultWallCornice(wall.openings.some(o => o.type === 'window' || o.type === 'french_window')), profile: 'none' as const };
  const update = (patch: Partial<WallCorniceConfig>) => editor.execute(new ConfigureWallCornice(wall.id, { ...config, ...patch }));
  return <section aria-label="Wall cornice" className="space-y-2 rounded border border-slate-700 p-3 mt-3">
    <strong>Wall-to-wall ceiling cornice</strong>
    <label className="block">Cornice profile<select aria-label="Cornice profile" className="mt-1 w-full rounded bg-slate-800 p-1.5" value={config.profile} onChange={e => update({ profile: e.target.value as WallCorniceConfig['profile'] })}>
      {Object.entries(CORNICE_PROFILES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    {config.profile !== 'none' && <>
      <CorniceSideControls wall={wall} />
      {([['height', 'Height'], ['depth', 'Projection'], ['offset', 'Clearance from wall']] as const).map(([key, label]) => <label key={key} className="block">{label} (cm)<input aria-label={`Cornice ${label.toLowerCase()} (cm)`} className="mt-1 w-full rounded bg-slate-800 p-1.5" type="number" min={key === 'offset' ? 0 : .1} max={key === 'offset' ? 200 : 100} step=".1" value={+(config[key] * 100).toFixed(2)} onChange={e => {
        if (e.target.value === '') return;
        const value = +e.target.value / 100;
        if (Number.isFinite(value) && value >= (key === 'offset' ? 0 : .001) && value <= (key === 'offset' ? 2 : 1)) update({ [key]: value });
      }} /></label>)}
      <label className="flex items-center gap-2"><input aria-label="Cornice visible" type="checkbox" checked={!config.hidden} onChange={e => update({ hidden: !e.target.checked })} />Visible</label>
    </>}
    <p className="text-slate-400">Spans the whole wall at the finished ceiling height. Clearance leaves room for curtain tracks behind it. The finish below affects only the cornice.</p>
  </section>;
}
