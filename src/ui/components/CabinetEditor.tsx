import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ApplicationRuntime } from '../../application/ApplicationRuntime';
import { ConfigureCabinet } from '../../application/commands/CabinetCommands';
import { cabinetIssues, contentDependsOn, stackContent, defaultCabinet, endpoint, interior, moveCabinetPart, removeCabinetPart, resolvePanel, settleContent, shelfClearances, splitDivider, type CabinetContent, type CabinetLayout, type CabinetPanel } from '../../domain/cabinet/CabinetLayout';
import { cabinetDoorCount } from '../../domain/catalog/Cabinets';
import type { AssetDefinition } from '../../domain/catalog/AssetDefinition';
import { Furniture, Luminaire, StandardFurniture } from '../../domain/elements/Furniture';
import { PlanDocument } from '../../domain/model/PlanDocument';
import type { LightFixtureConfig, SurfaceFinishConfig, Vector3D } from '../../domain/model/PlanData';
import { surfaceSection } from '../../domain/model/SurfaceSections';
import { createElementId } from '../../platform/ElementId';
import { RuntimeContext, useDocument, useRuntime } from '../context/RuntimeContext';
import { AssetReplacementModal } from './AssetReplacementModal';
import { Inspector } from './Inspector';
import { cabinetDrawerTrays, cabinetBasket, cabinetLeaves, setCabinetDoorAngle } from '../../domain/cabinet/CabinetFronts';
import { CabinetInternalDrawers } from './CabinetInternalDrawers';
import { CabinetFrontControls } from './CabinetFrontControls';
import { CabinetPlinthControls } from './CabinetPlinthControls';
import { supportsCabinetPlinth } from '../../domain/cabinet/CabinetPlinth';
import { CabinetHingeControls } from './CabinetHingeControls';
import { Viewport3D } from './Viewport3D';

export function CabinetEditor({ cabinet, onClose }: { cabinet: Furniture; onClose: () => void }) {
  const outer = useRuntime();
  const [session] = useState(() => {
    const runtime = new ApplicationRuntime();
    let layout = structuredClone(cabinet.cabinet ?? defaultCabinet(cabinet.toData(), cabinetDoorCount(outer.catalog.get(cabinet.assetKey)) ?? 2));
    for (const leaf of cabinetLeaves(layout, cabinet.dimensions)) layout = setCabinetDoorAngle(layout, leaf.index, leaf.drawer ? 75 : leaf.tilt ? 40 : 115);
    runtime.editor.load(new PlanDocument([cabinet.withCabinet(layout).withTransform({ x: 0, y: 0, z: 0 }, 0)], Math.max(2.7, cabinet.dimensions.y)));
    return runtime;
  });
  return <RuntimeContext.Provider value={session}><CabinetWorkspace original={cabinet} onCancel={onClose} onDone={layout => {
    let saved = structuredClone(layout);
    saved.doors.angles = [0, 0];
    for (const section of saved.frontSections ?? []) section.doors.angles = [0, 0];
    saved.internalDrawers = saved.internalDrawers?.map(d => ({ ...d, extension: cabinet.cabinet?.internalDrawers?.find(old => old.id === d.id)?.extension ?? 0 }));
    const previous = cabinet.cabinet ? cabinetLeaves(cabinet.cabinet, cabinet.dimensions) : [];
    for (const leaf of cabinetLeaves(saved, cabinet.dimensions)) {
      const old = previous.find(l => l.section?.id === leaf.section?.id && l.localIndex === leaf.localIndex && l.tilt === leaf.tilt && l.drawer === leaf.drawer);
      saved = setCabinetDoorAngle(saved, leaf.index, old?.angle ?? 0);
    }
    outer.editor.execute(new ConfigureCabinet(cabinet.id, saved)); onClose();
  }} /></RuntimeContext.Provider>;
}
function CabinetWorkspace({ original, onCancel, onDone }: { original: Furniture; onCancel: () => void; onDone: (layout: CabinetLayout) => void }) {
  const runtime = useRuntime(), doc = useDocument()!, item = doc.requireFurniture(original.id), layout = item.cabinet!, size = item.dimensions;
  const [selected, setSelected] = useState<string | null>(null), [section, setSection] = useState('all'), [adding, setAdding] = useState(false), [replacing, setReplacing] = useState(false);
  const [supportTarget, setSupportTarget] = useState<string | undefined>();
  const [stackCopies, setStackCopies] = useState(2);
  const [placeOnSelected, setPlaceOnSelected] = useState(false);
  const ref = useRef({ item, selected }); ref.current = { item, selected };
  const panel = layout.panels.find(p => p.id === selected), content = layout.contents.find(o => o.id === selected), inner = interior(size, layout), issues = new Map<string, string[]>(Object.entries(runtime.scene.getRenderObject(item.id)?.userData.cabinetIssues ?? Object.fromEntries(cabinetIssues(layout, size))));
  const update = (next: CabinetLayout, label = 'Edit cabinet layout') => runtime.editor.execute(new ConfigureCabinet(item.id, next, label));
  const select = (id: string | null) => { setSelected(id); setSection('all'); };
  function front(angled = false) {
    const camera = runtime.scene.getCamera() as THREE.PerspectiveCamera, controls = runtime.scene.getControls(); if (!controls) return;
    const distance = Math.max(size.y / 2, size.x / Math.max(.25, camera.aspect) / 2) / Math.tan(camera.fov * Math.PI / 360) * 1.22;
    controls.minDistance = .15; controls.target.set(0, size.y / 2, 0);
    camera.position.set(angled ? distance * .43 : 0, size.y / 2 + (angled ? distance * .15 : 0), size.z / 2 + distance); controls.update(); camera.updateMatrixWorld(true); runtime.scene.invalidate();
  }
  useEffect(() => {
    runtime.scene.updateSettings({ foregroundOcclusionMode: 'off', showFloor: false, showFixtures: true });
    runtime.scene.setCabinetEditing(original.id);
    runtime.interaction.setCabinetEditor({ id: original.id, select, move: (id, position, rotation) => {
      const entity = ref.current.item;
      runtime.editor.execute(new ConfigureCabinet(entity.id, moveCabinetPart(entity.cabinet!, entity.dimensions, id, position, rotation), 'Move cabinet part'));
    } });
    const stop = runtime.scene.subscribeStatus(() => { if (runtime.scene.getStatus().state === 'ready') front(); });
    if (runtime.scene.getStatus().state === 'ready') front();
    return () => { stop(); runtime.interaction.setCabinetEditor(null); };
  }, [runtime, original.id]);
  useEffect(() => { runtime.interaction.attachCabinetPart(item.id, panel || content ? selected : null, panel?.kind === 'shelf' ? 'y' : panel ? 'x' : 'xyz'); }, [item, selected]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement; if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) { event.preventDefault(); event.stopImmediatePropagation(); if (event.shiftKey || event.key.toLowerCase() === 'y') runtime.editor.redo(); else runtime.editor.undo(); }
      if (event.key === 'Delete' && ref.current.selected) { event.preventDefault(); const entity = ref.current.item; runtime.editor.execute(new ConfigureCabinet(entity.id, removeCabinetPart(entity.cabinet!, entity.dimensions, ref.current.selected), 'Delete cabinet part')); select(null); }
    }; window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, [runtime]);
  function addPanel(kind: CabinetPanel['kind']) {
    const id = createElementId();
    const p: CabinetPanel = { id, name: `${kind === 'shelf' ? 'Shelf' : 'Divider'} ${layout.panels.filter(p => p.kind === kind).length + 1}`, kind, at: kind === 'shelf' ? inner.y / 2 : inner.x / 2, start: kind === 'shelf' ? 'left' : panel?.kind === 'shelf' ? panel.id : 'bottom', end: kind === 'shelf' ? panel?.kind === 'divider' ? panel.id : 'right' : 'top', depth: { mode: 'fit', value: .02 } };
    update({ ...layout, panels: [...layout.panels, p] }, `Add ${kind}`); select(id);
  }
  function chooseAsset(asset: AssetDefinition) {
    const previous = replacing ? content : undefined, support = panel?.kind === 'shelf' ? resolvePanel(layout, size, panel) : undefined;
    const value: CabinetContent = { id: previous?.id ?? createElementId(), name: asset.name, assetKey: asset.key, dimensions: { ...asset.defaultDimensions }, rotationY: previous?.rotationY ?? 0, position: previous?.position ?? (placeOnSelected && content ? { x: 0, y: 0, z: 0 } : supportTarget?.startsWith('drawer_') ? { x: .015, y: 0, z: .015 } : { x: .02, y: 0, z: .01 }), supportId: previous?.supportId ?? supportTarget ?? (placeOnSelected ? content?.id : undefined) ?? support?.id ?? 'base' };
    const settled = settleContent(layout, size, value);
    update({ ...layout, contents: previous ? layout.contents.map(o => o.id === previous.id ? settled : o) : [...layout.contents, settled] }, previous ? 'Replace cabinet content' : 'Add cabinet content'); select(value.id); setAdding(false); setReplacing(false); setPlaceOnSelected(false); setSupportTarget(undefined);
  }
  const resolved = panel ? resolvePanel(layout, size, panel) : undefined;
  const ContentType = content && runtime.catalog.behavior(content.assetKey) === 'luminaire' ? Luminaire : StandardFurniture;
  const inspected = content ? new ContentType({ id: content.id, name: content.assetKey, assetKey: content.assetKey, displayName: content.name, category: 'decor', position: content.position, rotationY: content.rotationY, dimensions: content.dimensions, finish: content.finish, sectionFinishes: content.sectionFinishes, lightConfig: content.lightConfig }) : panel && resolved ? new StandardFurniture({ id: panel.id, name: panel.name, assetKey: 'cabinet_open', displayName: panel.name, category: 'storage', position: resolved.position, rotationY: Math.PI, dimensions: resolved.dimensions, finish: panel.finish }) : null;
  function configureLight(config: Partial<LightFixtureConfig>) {
    if (content) update({ ...layout, contents: layout.contents.map(o => o.id === content.id ? { ...o, lightConfig: { ...o.lightConfig, ...config } } : o) }, 'Configure cabinet light');
  }
  function transform(position?: Vector3D, rotation?: number, dimensions?: Vector3D) {
    if (panel && resolved) {
      const next = { ...panel, depth: { ...panel.depth } };
      if (position) { next.at = panel.kind === 'shelf' ? position.y : position.x; if (panel.kind === 'shelf' && position.x !== resolved.position.x) next.start = position.x; if (panel.kind === 'divider' && position.y !== resolved.position.y) next.start = position.y; }
      if (dimensions) {
        if (dimensions.z !== resolved.dimensions.z) next.depth = { mode: 'fixed', value: dimensions.z };
        if (panel.kind === 'shelf') { if (dimensions.x !== resolved.dimensions.x) next.end = endpoint(layout, size, next.start, true) + dimensions.x; if (dimensions.y !== resolved.dimensions.y) next.thickness = dimensions.y; }
        else { if (dimensions.y !== resolved.dimensions.y) next.end = endpoint(layout, size, next.start, true) + dimensions.y; if (dimensions.x !== resolved.dimensions.x) next.thickness = dimensions.x; }
      }
      update({ ...layout, panels: layout.panels.map(p => p.id === panel.id ? next : p) }, 'Transform cabinet panel');
    } else if (content) {
      const next = settleContent(layout, size, { ...content, position: position ?? content.position, dimensions: dimensions ?? content.dimensions, rotationY: rotation ?? content.rotationY });
      update({ ...layout, contents: layout.contents.map(o => o.id === content.id ? next : o) }, 'Transform cabinet content');
    }
  }
  function finish(value?: SurfaceFinishConfig, target?: string) {
    if (panel) update({ ...layout, panels: layout.panels.map(p => p.id === panel.id ? { ...p, finish: value } : p) }, 'Finish cabinet panel');
    else if (content) {
      const next = { ...content, sectionFinishes: { ...content.sectionFinishes } };
      if (target) { if (value) next.sectionFinishes[target] = value; else delete next.sectionFinishes[target]; } else { next.finish = value; next.sectionFinishes = {}; }
      update({ ...layout, contents: layout.contents.map(o => o.id === content.id ? next : o) }, 'Finish cabinet content');
    }
  }
  const sections = new Set<string>();
  if (content) runtime.scene.getCabinetPart(item.id, content.id)?.traverse(o => { if (o instanceof THREE.Mesh && !o.userData.fixedFinish && o.userData.section) sections.add(surfaceSection(o.userData.section)); });
  const editPanel = (patch: Partial<CabinetPanel>) => panel && update({ ...layout, panels: layout.panels.map(p => p.id === panel.id ? { ...p, ...patch } : p) });
  const bounds = panel ? layout.panels.filter(p => p.kind !== panel.kind && p.id !== panel.id) : [];
  const clearance = panel ? shelfClearances(layout, size, panel.id) : { below: 0, above: 0 };
  return <div role="dialog" aria-modal="true" aria-label="Cabinet layout editor" className="fixed inset-0 z-40 flex flex-col bg-slate-950 text-slate-100">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-900 p-3 text-xs">
      <strong className="mr-auto">Cabinet layout · {original.displayName}</strong>
      <button className="rounded bg-slate-700 px-3 py-2 disabled:opacity-40" disabled={!runtime.editor.history.canUndo} onClick={() => runtime.editor.undo()}>Undo layout</button>
      <button className="rounded bg-slate-700 px-3 py-2 disabled:opacity-40" disabled={!runtime.editor.history.canRedo} onClick={() => runtime.editor.redo()}>Redo layout</button>
      <button className="rounded bg-slate-700 px-3 py-2" onClick={() => front()}>Front view</button><button className="rounded bg-slate-700 px-3 py-2" onClick={() => front(true)}>3D view</button>
      <button className="rounded border border-slate-600 px-3 py-2" onClick={onCancel}>Cancel layout</button><button className="rounded bg-sky-600 px-4 py-2 font-semibold" onClick={() => onDone(layout)}>Done</button>
    </div>
    <div className="flex min-h-0 flex-1">
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-900 p-3 text-xs space-y-3">
        <p>Usable interior: {[inner.x, inner.y, inner.z].map(n => +(n * 100).toFixed(1)).join(' × ')} cm (W × H × D)</p>
        <p className="text-slate-400">Origin: inside left, bottom and back. Red means penetration or missing support. Touching is allowed.</p>
        <div className="grid grid-cols-2 gap-2"><button className="rounded bg-sky-700 p-2" onClick={() => addPanel('shelf')}>Add shelf</button><button className="rounded bg-sky-700 p-2" onClick={() => addPanel('divider')}>Add divider</button></div>
        <button className="w-full rounded bg-emerald-700 p-2" onClick={() => { setReplacing(false); setSupportTarget(undefined); setAdding(true); }}>Place object</button>
        <label className="block">Panel thickness (mm)<input aria-label="Panel thickness (mm)" className="w-full bg-slate-800 p-1" type="number" min="1" max="100" step="1" value={+(layout.panelThickness * 1000).toFixed(2)} onChange={e => { const n = +e.target.value / 1000; if (n > 0 && n <= .1) update({ ...layout, panelThickness: n }); }} /></label>
        <label className="block">Back thickness (mm)<input aria-label="Back thickness (mm)" className="w-full bg-slate-800 p-1" type="number" min="1" max="100" step="1" value={+(layout.backThickness * 1000).toFixed(2)} onChange={e => { const n = +e.target.value / 1000; if (n > 0 && n <= .1) update({ ...layout, backThickness: n }); }} /></label>
        {!layout.frontSections && <label className="block">Doors<select aria-label="Cabinet door count" className="w-full bg-slate-800 p-1" value={layout.doors.count} onChange={e => update({ ...layout, doors: { ...layout.doors, count: +e.target.value as 0 | 1 | 2 } })}><option value="0">Open cabinet</option><option value="1">One door</option><option value="2">Two doors</option></select></label>}
        {!layout.frontSections && layout.doors.count === 1 && <label className="block">Hinge side<select aria-label="Cabinet hinge side" className="w-full bg-slate-800 p-1" value={layout.doors.hinge} onChange={e => update({ ...layout, doors: { ...layout.doors, hinge: e.target.value as 'left' | 'right' } })}><option value="left">Left</option><option value="right">Right</option></select></label>}
        {(supportsCabinetPlinth(item.assetKey) || layout.plinth) && <CabinetPlinthControls layout={layout} size={size} onChange={next => update(next, 'Configure cabinet plinth')} />}
        <CabinetInternalDrawers layout={layout} size={size} onChange={next => update(next, 'Configure internal drawers')} onPlace={support => { setSupportTarget(support); setPlaceOnSelected(false); setReplacing(false); setAdding(true); }} />
        <CabinetFrontControls layout={layout} size={size} onPlace={support => { setSupportTarget(support); setPlaceOnSelected(false); setReplacing(false); setAdding(true); }} onChange={next => update(next, 'Configure cabinet fronts')} />
        <CabinetHingeControls showAngles layout={layout} onChange={next => update(next, 'Configure cabinet hinge')} />
        <p role="status" className={issues.size ? 'text-red-300' : 'text-emerald-300'}>{issues.size ? `${issues.size} parts need attention` : 'No collisions or unsupported objects'}</p>
        <div className="space-y-1" aria-label="Cabinet parts">{[...layout.panels, ...layout.contents].map(p => <button key={p.id} aria-label={p.name} aria-pressed={p.id === selected} className={`block w-full rounded border p-2 text-left ${p.id === selected ? 'border-sky-400 bg-sky-900/40' : 'border-slate-700'} ${issues.has(p.id) ? 'text-red-300' : ''}`} onClick={() => select(p.id)}>{p.name}{issues.has(p.id) && <small className="block">{issues.get(p.id)!.join(', ')}</small>}</button>)}</div>
      </aside>
      <div className="relative min-w-0 flex-1"><Viewport3D />{!inspected && <p className="absolute top-20 left-4 right-4 pointer-events-none text-xs text-slate-300">Select a shelf, divider or object to edit it. Drag its handle or enter exact measurements.</p>}</div>
      {inspected && <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-700 bg-slate-900 text-xs">
        {selected && issues.has(selected) && <p role="alert" className="p-3 text-red-300">{issues.get(selected)!.join(' · ')}</p>}
        {panel && <div className="space-y-2 p-3 border-b border-slate-700">
          {panel.kind === 'shelf' && <p>Clear below: {(clearance.below * 100).toFixed(1)} cm · above: {(clearance.above * 100).toFixed(1)} cm</p>}
          {(['start', 'end'] as const).map(key => <label key={key} className="block">{key === 'start' ? 'Span starts at' : 'Span ends at'}<select aria-label={`Panel ${key} boundary`} className="block w-full bg-slate-800 p-1" value={typeof panel[key] === 'number' ? 'custom' : panel[key]} onChange={e => editPanel({ [key]: e.target.value === 'custom' ? endpoint(layout, size, panel[key], key === 'start') : e.target.value })}>
            {(panel.kind === 'shelf' ? ['left', 'right'] : ['bottom', 'top']).map(edge => <option key={edge} value={edge}>{edge}</option>)}{bounds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="custom">Fixed coordinate</option>
          </select>{typeof panel[key] === 'number' && <input aria-label={`Panel ${key} coordinate (cm)`} className="w-full bg-slate-800 p-1" type="number" step=".1" value={+((panel[key] as number) * 100).toFixed(2)} onChange={e => editPanel({ [key]: +e.target.value / 100 })} />}</label>)}
          <label className="block">Depth sizing<select aria-label="Panel depth sizing" className="w-full bg-slate-800 p-1" value={panel.depth.mode} onChange={e => editPanel({ depth: { mode: e.target.value as 'fit' | 'fixed', value: e.target.value === 'fit' ? .02 : resolved!.dimensions.z } })}><option value="fit">Follow cabinet depth</option><option value="fixed">Fixed depth</option></select></label>
          <label className="block">{panel.depth.mode === 'fit' ? 'Front setback (cm)' : 'Fixed depth (cm)'}<input aria-label={panel.depth.mode === 'fit' ? 'Front setback (cm)' : 'Fixed depth (cm)'} className="w-full bg-slate-800 p-1" type="number" min="0" step=".1" value={+(panel.depth.value * 100).toFixed(2)} onChange={e => editPanel({ depth: { ...panel.depth, value: Math.max(0, +e.target.value / 100) } })} /></label>
          {panel.kind === 'divider' && <button className="w-full rounded bg-sky-700 p-2" onClick={() => update(splitDivider(layout, size, panel.id), 'Split divider at shelves')}>Split divider at shelves</button>}
        </div>}
        {content && <div className="p-3 border-b border-slate-700"><label>Supporting surface<select aria-label="Supporting shelf" className="w-full bg-slate-800 p-1" value={content.supportId ?? 'none'} onChange={e => update({ ...layout, contents: layout.contents.map(o => o.id === content.id ? { ...o, supportId: e.target.value === 'none' ? undefined : e.target.value, position: { ...o.position, y: 0, ...(e.target.value.startsWith('drawer_') ? { x: Math.max(.015, o.position.x), z: Math.max(.015, o.position.z) } : {}) } } : o) })}><option value="none">No attachment</option><option value="base">Cabinet base</option>{layout.panels.filter(p => p.kind === 'shelf').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}{cabinetDrawerTrays(layout, size).map(d => <option key={d.floor.id} value={d.floor.id}>{d.floor.name}</option>)}{layout.contents.filter(o => !contentDependsOn(layout, o.id, content.id)).map(o => <option key={o.id} value={o.id}>On top of {o.name}</option>)}{cabinetLeaves(layout, size).map(l => cabinetBasket(layout, size, l)?.floor).filter(Boolean).map(b => <option key={b!.id} value={b!.id}>{b!.name}</option>)}</select></label>
          <div className="mt-3 space-y-2">
            <label className="block">Copies to stack<input aria-label="Copies to stack" type="number" min="1" max={Math.min(20, 256 - layout.contents.length)} step="1" value={stackCopies} className="w-full bg-slate-800 p-1" onChange={e => setStackCopies(Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 1))))} /></label>
            <button className="w-full rounded bg-sky-700 p-2 disabled:opacity-40" disabled={layout.contents.length + stackCopies > 256} onClick={() => { const ids = Array.from({ length: stackCopies }, () => createElementId()); update(stackContent(layout, content.id, ids), 'Stack cabinet objects'); select(ids[ids.length - 1]); }}>Stack copies above</button>
            <button className="w-full rounded bg-slate-700 p-2" onClick={() => { setPlaceOnSelected(true); setReplacing(false); setAdding(true); }}>Place another object on top</button>
            <p className="text-slate-400">Copies stay individually editable and follow their supporting object. Red warnings show stacks that do not fit.</p>
          </div>
        </div>}
        <Inspector item={inspected} className="w-full bg-slate-900 p-4 text-xs" onClose={() => select(null)} onOpenReplaceModal={() => { setReplacing(true); setAdding(true); }} interior={{ panel: !!panel, sections: [...sections], section, selectSection: setSection, transform, finish, configureLight,
          duplicate: content && layout.contents.length < 256 ? () => {
            const copy = structuredClone(content); copy.id = createElementId(); copy.position.x += .05;
            update({ ...layout, contents: [...layout.contents, copy] }, 'Duplicate cabinet asset'); select(copy.id);
          } : undefined,
          remove: () => { update(removeCabinetPart(layout, size, inspected.id), 'Delete cabinet part'); select(null); } }} />
      </aside>}
    </div>
    <AssetReplacementModal isOpen={adding} mode="add" onClose={() => { setAdding(false); setPlaceOnSelected(false); setSupportTarget(undefined); }} onSelectAsset={chooseAsset} filterAsset={asset => cabinetDoorCount(asset) === undefined} />
  </div>;
}
