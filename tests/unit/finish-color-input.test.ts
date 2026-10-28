// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurfaceFinishPicker } from '../../src/ui/components/SurfaceFinishPicker';
import type { SurfaceFinishConfig } from '../../src/domain/model/PlanData';

vi.mock('../../src/ui/context/RuntimeContext', () => ({ useRuntime: () => ({ tiles: { getAll: () => [], onCatalogLoaded: () => () => {} } }) }));
vi.mock('../../src/ui/components/ReferencePanelPicker', () => ({ ReferencePanelPicker: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => { if (root) act(() => root!.unmount()); document.body.innerHTML = ''; });

describe('selected surface colour', () => {
  it('shows the actual new wall colour when switching from accent wall to long wall without applying another edit', () => {
    const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    const select = vi.fn();
    act(() => root!.render(createElement(SurfaceFinishPicker, { currentFinish: { type: 'paint', color: '#864954' }, onSelectFinish: select })));
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Paint color hex"]')!.value).toBe('#864954');
    act(() => root!.render(createElement(SurfaceFinishPicker, { currentFinish: { type: 'paint', color: '#ece5d4' }, onSelectFinish: select })));
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Paint color hex"]')!.value).toBe('#ece5d4');
    expect(select).not.toHaveBeenCalled();
  });
  it.each(['oak_slats', 'bauhaus_61598007'])('changes only felt when recolouring %s', variant => {
    const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    const select = vi.fn(), finish: SurfaceFinishConfig = { type: 'lambri', variant, color: '#864954', woodColor: '#bda078', backingColor: '#121212', rotation: 90, roughness: .8, layer: 3 };
    act(() => root!.render(createElement(SurfaceFinishPicker, { currentFinish: finish, onSelectFinish: select })));
    act(() => host.querySelector<HTMLButtonElement>('button[title^="Warm Greige Felt"]')!.click());
    expect(select).toHaveBeenLastCalledWith({ ...finish, backingColor: '#d8d2c9' });
    act(() => root!.render(createElement(SurfaceFinishPicker, { currentFinish: { ...finish, backingColor: '#d8d2c9' }, onSelectFinish: select })));
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Custom felt color hex"]')!.value).toBe('#d8d2c9');
  });
});
