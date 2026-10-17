import { useState } from 'react';
import { splitCabinetFront, type CabinetFrontSection } from '../../domain/cabinet/CabinetFronts';
import { withCabinetFrontSections, type CabinetLayout } from '../../domain/cabinet/CabinetLayout';
import type { Vector3D } from '../../domain/model/PlanData';
import { createElementId } from '../../platform/ElementId';

export function CabinetFrontControls({ layout, size, onChange }: { layout: CabinetLayout; size: Vector3D; onChange: (layout: CabinetLayout) => void }) {
  const [selected, setSelected] = useState(''), [cut, setCut] = useState<number | undefined>();
  const section = layout.frontSections?.find(s => s.id === selected) ?? layout.frontSections?.[0];
  const bottom = section?.bottom ?? 0, top = section?.top === 'top' || !section ? size.y : section.top;
  const height = cut ?? (bottom + top) / 2;
  const update = (patch: Partial<CabinetFrontSection>) => section && onChange(withCabinetFrontSections(layout, size, layout.frontSections!.map(s => s.id === section.id ? { ...s, ...patch } : s)));
  return <section aria-label="Cabinet front sections" className="space-y-2 border-t border-slate-700 pt-3">
    <strong>Stacked front sections</strong>
    {section && <>
      <label className="block">Section<select aria-label="Cabinet front section" className="w-full bg-slate-800 p-1" value={section.id} onChange={e => { setSelected(e.target.value); setCut(undefined); }}>
        {layout.frontSections!.map((s, i) => <option key={s.id} value={s.id}>Section {i + 1} · {+(s.bottom * 100).toFixed(1)}–{+((s.top === 'top' ? size.y : s.top) * 100).toFixed(1)} cm</option>)}
      </select></label>
      <label className="block">Opening<select aria-label="Front section opening" className="w-full bg-slate-800 p-1" value={section.opening} onChange={e => {
        const opening = e.target.value as CabinetFrontSection['opening'];
        update({ opening, doors: { ...section.doors, angles: opening === 'tilt-out' ? [40, 40] : [115, 115] } });
      }}><option value="swing">Side-hinged doors</option><option value="tilt-out">Tilt-out laundry basket</option></select></label>
      <label className="block">Panels across<select aria-label="Front section panel count" className="w-full bg-slate-800 p-1" value={section.doors.count} onChange={e => update({ doors: { ...section.doors, count: +e.target.value as 0 | 1 | 2 } })}><option value="0">Open section</option><option value="1">One panel</option><option value="2">Two panels</option></select></label>
      {section.opening === 'swing' && section.doors.count === 1 && <label className="block">Hinge side<select aria-label="Front section hinge side" className="w-full bg-slate-800 p-1" value={section.doors.hinge} onChange={e => update({ doors: { ...section.doors, hinge: e.target.value as 'left' | 'right' } })}><option value="left">Left</option><option value="right">Right</option></select></label>}
      {section.opening === 'tilt-out' && <label className="block">Basket depth (cm)<input aria-label="Laundry basket depth (cm)" type="number" min="1" step="0.1" className="w-full bg-slate-800 p-1" value={+((section.basketDepth ?? size.z - layout.backThickness - layout.panelThickness - .025) * 100).toFixed(1)} onChange={e => { const depth = +e.target.value / 100; if (depth > 0) update({ basketDepth: depth }); }} /></label>}
      <label className="block">Section bottom (cm)<input aria-label="Front section bottom (cm)" type="number" step="0.1" className="w-full bg-slate-800 p-1" value={+(bottom * 100).toFixed(2)} onChange={e => { if (e.target.value !== '') update({ bottom: +e.target.value / 100 }); }} /></label>
      <label className="block">Section top (cm)<input aria-label="Front section top (cm)" type="number" step="0.1" className="w-full bg-slate-800 p-1" value={+(top * 100).toFixed(2)} onChange={e => { if (e.target.value !== '') update({ top: +e.target.value / 100 }); }} /></label>
      <button className="text-sky-300" onClick={() => update({ top: 'top' })}>Fit section top to cabinet</button>
      {layout.frontSections!.length > 1 && <button className="block text-red-300" onClick={() => { onChange(withCabinetFrontSections(layout, size, layout.frontSections!.filter(s => s.id !== section.id))); setSelected(''); setCut(undefined); }}>Remove front section</button>}
    </>}
    <label className="block">Split height from floor (cm)<input aria-label="Front split height (cm)" type="number" step="0.1" className="w-full bg-slate-800 p-1" value={+(height * 100).toFixed(2)} onChange={e => setCut(+e.target.value / 100)} /></label>
    <button className="w-full rounded bg-sky-700 p-2 disabled:opacity-40" disabled={height <= bottom + .04 || height >= top - .04 || (layout.frontSections?.length ?? 1) >= 16} onClick={() => {
      const next = splitCabinetFront(layout, size, section?.id, height, createElementId());
      onChange(next); setSelected(next.frontSections?.find(s => s.bottom === height)?.id ?? ''); setCut(undefined);
    }}>Split front vertically</button>
    <p className="text-slate-400">Creates sections stacked up the cabinet. Each section has at most two panels across. Internal shelves remain independent.</p>
  </section>;
}
