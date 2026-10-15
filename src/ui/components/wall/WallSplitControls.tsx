import { Point2D,WallEntity } from '@core/types/plan';
import { ISceneService } from '@core/types/services';
import { Scissors } from 'lucide-react';
import React,{ useEffect } from 'react';
import { SplitWall } from '../../../application/commands/StructuralCommands';
import type { EditorSession } from '../../../application/EditorSession';
import { wallSplitCandidates } from '../../../application/queries/WallQueries';

interface SplitCandidate {
  distance: number;
  point: Point2D;
  description: string;
}

interface WallSplitControlsProps {
  wall: WallEntity;
  wallLength: number;
  editor: EditorSession;
  sceneService: ISceneService;
}

export const WallSplitControls: React.FC<WallSplitControlsProps> = ({
  wall,
  wallLength,
  editor,
  sceneService,
}) => {
  useEffect(() => {
    return () => {
      sceneService.hideWallSplitPreview?.();
    };
  }, [wall.id, sceneService]);

  if (wallLength <= 0.6) return null;

  const splitCandidates: SplitCandidate[] =
    wallSplitCandidates(editor.getSnapshot(), wall.id) || [];
  if (splitCandidates.length === 0) return null;

  const handleSplit = (dist: number) => {
    sceneService.hideWallSplitPreview?.();
    editor.execute(new SplitWall(wall.id, dist));
  };

  return (
    <div className="py-3 border-t border-slate-800 space-y-2">
      <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Scissors className="w-3 h-3 text-sky-400" />
          Split Wall (Paint Parts Separately)
        </span>
      </div>
      <p className="text-[10px] text-slate-500">
        Split continuous wall into segments to paint rooms or areas independently:
      </p>
      <div className="space-y-1.5">
        {splitCandidates.map((c, idx) => (
          <div
            key={idx}
            onMouseEnter={() => sceneService.showWallSplitPreview?.(wall, c.distance)}
            onMouseLeave={() => sceneService.hideWallSplitPreview?.()}
            className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800/80 hover:border-sky-500/50 hover:bg-slate-900 transition-colors cursor-pointer group"
          >
            <div className="truncate mr-2">
              <div className="text-xs text-slate-200 font-medium">
                At {c.distance.toFixed(2)}m
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {c.description}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSplit(c.distance)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white font-medium text-[11px] transition-colors shrink-0 flex items-center gap-1"
              title={`Split wall at ${c.distance.toFixed(2)}m`}
            >
              <Scissors className="w-3 h-3" />
              Split
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
