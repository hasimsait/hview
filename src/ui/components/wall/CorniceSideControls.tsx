import type { WallEntity } from '../../../core/types/plan';
import { ConfigureWallCornice } from '../../../application/commands/StructuralCommands';
import { defaultWallCornice, wallCorniceSides, type WallCorniceConfig } from '../../../domain/model/WallCornice';
import { useDocument, useRuntime } from '../../context/RuntimeContext';

/** Cornices belong to wall faces; window and wall inspectors edit the same saved setting. */
export function CorniceSideControls({ wall }: { wall: WallEntity }) {
  const { editor } = useRuntime(), document = useDocument();
  const config = wall.cornice ?? { ...defaultWallCornice(wall.openings.some(o => o.type === 'window' || o.type === 'french_window')), profile: 'none' as const };
  const sides = config.profile === 'none' || config.hidden ? [] : wallCorniceSides(wall);
  const update = (patch: Partial<WallCorniceConfig>) => editor.execute(new ConfigureWallCornice(wall.id, { ...config, ...patch }));
  return <fieldset className="space-y-2 text-xs text-slate-300">
    <legend className="mb-2 font-semibold">Cornice sides</legend>
    {(['A', 'B'] as const).map(side => {
      const roomId = side === 'A' ? wall.roomSideA : wall.roomSideB;
      const room = document?.rooms.find(room => room.id === roomId);
      return <label key={side} className="flex items-center gap-2">
        <input type="checkbox" aria-label={`Cornice on side ${side}`} checked={sides.includes(side)} onChange={event => {
          const next = event.target.checked ? [...sides, side] : sides.filter(value => value !== side);
          update(next.length ? { side: next.length === 2 ? 'both' : next[0], hidden: false, profile: config.profile === 'none' ? 'cove' : config.profile } : { hidden: true });
        }} />Side {side} — {room?.displayName || 'Outside / unassigned'}
      </label>;
    })}
    <button type="button" className="text-sky-300 hover:text-sky-200" onClick={() => update({ side: 'interior', hidden: false, profile: config.profile === 'none' ? 'cove' : config.profile })}>Use room-facing sides</button>
  </fieldset>;
}
