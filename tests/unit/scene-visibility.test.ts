import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ViewportSettings } from '../../src/core/types/services';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { SceneVisibility } from '../../src/engine/visibility/SceneVisibility';

const document = new PlanCodec().decode(readFileSync('public/sample.plan', 'utf8'));
const policy = new SceneVisibility();
const settings = { isolatedRoomIds: ['_rscdq'], showWalls: true, showFurniture: true, showFixtures: true, showFloor: true, wallCutaway: false } as ViewportSettings;
describe('room visibility at the actual opening location', () => {
  it('loads the production plan into behavioral classes', () => {
    expect(document.walls.length).toBeGreaterThan(10);
    expect(document.furniture.every(element => typeof element.withTransform === 'function')).toBe(true);
  });
  it('keeps the bathroom entry and hides the other door on its long shared wall', () => {
    expect(policy.isVisible(document.require('_buz1m'), document, settings)).toBe(true);
    expect(policy.isVisible(document.require('_87omj'), document, settings)).toBe(false);
  });
  it('restores all openings on Show All without changing the document', () => {
    const codec = new PlanCodec(), before = codec.encode(document);
    expect(document.walls.flatMap(wall => wall.openings).every(opening => policy.isVisible(opening, document, { ...settings, isolatedRoomIds: [] }))).toBe(true);
    expect(codec.encode(document)).toBe(before);
  });
});
