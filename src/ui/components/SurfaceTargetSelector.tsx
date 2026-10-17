import { Split } from 'lucide-react';
import { WALL_TARGET_STRATEGIES } from './wall/WallTargetStrategy';

interface SurfaceTarget {
  id: string;
  label: string;
  title: string;
}

interface TargetGroup {
  label: string;
  hint?: string;
  tone: 'sky' | 'indigo' | 'amber';
  targets: readonly SurfaceTarget[];
}

interface SurfaceTargetSelectorProps {
  kind: 'wall' | 'column';
  activeTarget: string;
  roomA?: { readonly name: string } | null;
  roomB?: { readonly name: string } | null;
  hasRecesses: boolean;
  onSelectTarget: (targetId: string) => void;
}

const COLUMN_FACES: readonly SurfaceTarget[] = [
  { id: 'front', label: 'Front', title: 'Front face of the column' },
  { id: 'back', label: 'Back', title: 'Back face of the column' },
  { id: 'all', label: 'All Faces', title: 'Apply finish to all faces of the column' },
];
const COLUMN_ENDS: readonly SurfaceTarget[] = [
  { id: 'left', label: 'Left', title: 'Left face of the column' },
  { id: 'right', label: 'Right', title: 'Right face of the column' },
];
const SELECTED_STYLES = {
  sky: 'bg-sky-600 text-white shadow-sm',
  indigo: 'bg-indigo-600 text-white shadow-sm',
  amber: 'bg-amber-600 text-white shadow-sm',
};

export function SurfaceTargetSelector({
  kind, activeTarget, roomA, roomB, hasRecesses, onSelectTarget,
}: SurfaceTargetSelectorProps) {
  const groups: TargetGroup[] = kind === 'wall' ? [
    {
      label: 'Wall Faces', hint: 'independent side finishes', tone: 'sky',
      targets: ['A', 'B', 'both'].map((id) => {
        const room = id === 'A' ? roomA : id === 'B' ? roomB : undefined;
        const target = WALL_TARGET_STRATEGIES[id];
        return { id, title: target.title, label: target.label + (room ? ` (${room.name})` : '') };
      }),
    },
    {
      label: 'Ends, Edges & Sills', tone: 'indigo',
      targets: ['edge_start', 'edge_end', 'edge_top', 'sill', 'edges'].map((id) => WALL_TARGET_STRATEGIES[id]),
    },
    {
      label: 'Wall Framing', hint: 'full-wall trims', tone: 'indigo',
      targets: ['baseboard', 'cornice'].map(id => WALL_TARGET_STRATEGIES[id]),
    },
  ] : [
    { label: 'Column Faces', hint: 'independent side finishes', tone: 'sky', targets: COLUMN_FACES },
    { label: 'End Faces', tone: 'indigo', targets: COLUMN_ENDS },
  ];
  if (hasRecesses) groups.push({
    label: 'Wall Recess Niche', tone: 'amber',
    targets: ['recess_wall', 'corners'].map((id) => WALL_TARGET_STRATEGIES[id]),
  });
  const selectedTarget = activeTarget === 'sides' ? 'corners'
    : activeTarget === 'edge_bottom' ? 'baseboard' : activeTarget;

  return (
    <div className="py-2.5 border-b border-slate-800 space-y-2">
      {groups.map((group) => (
        <div key={group.label} role="group" aria-label={group.label} className="space-y-2">
          <div className={`text-[10px] uppercase font-semibold flex items-center justify-between ${group.tone === 'amber' ? 'text-amber-400' : 'text-slate-400'}`}>
            <span className="flex items-center gap-1">
              {group.tone === 'sky' && <Split className="w-3 h-3 text-sky-400" />}
              {group.label}
            </span>
            {group.hint && <span className="text-[9px] text-slate-500 lowercase">{group.hint}</span>}
          </div>
          <div className={`grid ${group.tone === 'sky' ? 'grid-cols-3' : 'grid-cols-2'} gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800`}>
            {group.targets.map((target) => (
              <button
                key={target.id}
                type="button"
                title={target.title}
                aria-pressed={selectedTarget === target.id}
                onClick={() => onSelectTarget(target.id)}
                className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all text-center truncate ${selectedTarget === target.id
                  ? SELECTED_STYLES[group.tone]
                  : group.tone === 'amber'
                    ? 'text-amber-300 hover:text-white hover:bg-amber-500/20 border border-amber-500/40 bg-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
              >
                {target.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
