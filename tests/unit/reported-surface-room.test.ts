import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PlanParserService } from '../../src/services/plan/PlanParserService';
import { PlanExportService } from '../../src/services/plan/PlanExportService';
import { PlanManagerService } from '../../src/services/plan/PlanManagerService';
import { ThreeSceneService } from '../../src/services/rendering/ThreeSceneService';
import { AssetRegistryService } from '../../src/services/rendering/AssetRegistryService';
import { OpeningGeometryService } from '../../src/services/rendering/OpeningGeometryService';
import { rawPlan } from './fixtures';

// Floors are unrelated to opening visibility; their constructor generates a
// canvas texture. Browser tests exercise the full renderer without this mock.
vi.mock('../../src/services/rendering/FloorGeometryService', () => ({ FloorGeometryService: class {} }));

describe('reported surface and bathroom regressions', () => {
  it('notifies the selected-wall subscriber immediately after a paint change', () => {
    const manager = new PlanManagerService(new PlanParserService(), new PlanExportService());
    const plan = manager.loadPlan(rawPlan());
    manager.setSelectedWall(plan.walls[0], 'A');
    const selectedWallChanged = vi.fn();
    manager.onWallSelectionChange(selectedWallChanged);
    manager.setWallFinish('wall', { type: 'paint', color: '#f3f1ea' }, 'A');
    expect(manager.getSelectedWall()!.finishSideA!.color).toBe('#f3f1ea');
    expect(selectedWallChanged).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wall', finishSideA: { type: 'paint', color: '#f3f1ea' } }), 'A',
    );
  });

  function openingScene() {
    const plan = new PlanParserService().parse(readFileSync('public/sample.plan', 'utf8'));
    const finishService = { setForegroundMode: vi.fn(), setForegroundOpacity: vi.fn() };
    const scene = new ThreeSceneService(new AssetRegistryService(), finishService as any);
    // Seed the parsed plan and real opening meshes without initializing WebGL.
    // This exercises the production isolation logic, independently of GPU setup.
    (scene as any).currentPlan = plan;
    const group = scene.getScene().getObjectByName('openingsGroup')!;
    const builder = new OpeningGeometryService();
    for (const wall of plan.walls) for (const opening of wall.openings) group.add(builder.buildOpening(opening, wall));
    return { scene, plan, group };
  }

  it('retains the actual bathroom entry door when isolating the bathroom', () => {
    const { scene, group } = openingScene();
    scene.isolateRooms(['_rscdq']);
    expect(group.getObjectByName('opening__buz1m')!.visible).toBe(true);
  });
  it('hides the hallway-to-bedroom door even though its long wall also borders the bathroom', () => {
    const { scene, group } = openingScene();
    scene.isolateRooms(['_rscdq']);
    expect(group.getObjectByName('opening__87omj')!.visible).toBe(false);
  });
  it('does not add openings to the plan during isolation and restores them on Show All', () => {
    const { scene, plan, group } = openingScene();
    const original = JSON.stringify(plan);
    scene.isolateRooms(['_rscdq']);
    expect(JSON.stringify(plan)).toBe(original);
    scene.isolateRooms([]);
    expect(group.children.every(opening => opening.visible)).toBe(true);
  });
});
