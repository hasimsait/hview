import { CABINET_HINGE_TYPES, cabinetHinge, type CabinetHinge, type CabinetLayout } from '../../domain/cabinet/CabinetLayout';

import { cabinetLeafSettings, setCabinetDoorAngle, updateCabinetLeaf } from '../../domain/cabinet/CabinetFronts';

export function CabinetHingeControls({ layout, onChange, showAngles = false }: { layout: CabinetLayout; onChange: (layout: CabinetLayout) => void; showAngles?: boolean }) {
  function update(index: number, hinge: CabinetHinge) {
    onChange(updateCabinetLeaf(layout, index, (doors, localIndex) => {
      const hinges: [CabinetHinge, CabinetHinge] = [{ ...(doors.hinges?.[0] ?? { type: 'pivot', travel: 0 }) }, { ...(doors.hinges?.[1] ?? { type: 'pivot', travel: 0 }) }];
      hinges[localIndex] = hinge; return { ...doors, hinges };
    }));
  }
  const leaves = cabinetLeafSettings(layout);
  return <div className="space-y-2">
    {leaves.map((leaf, index) => {
      const drawer = leaf.section?.opening === 'drawer';
      const tilt = leaf.section?.opening === 'tilt-out', angle = drawer ? (leaf.section?.drawerExtensions?.[leaf.localIndex] ?? 0) * 100 : leaf.doors.angles[leaf.localIndex];
      const hinge = cabinetHinge(layout, index);
      return <div key={index} className="space-y-1">
        {showAngles && <div><span className="flex items-center justify-between">{drawer ? 'Drawer' : tilt ? 'Laundry front' : 'Door'} {index + 1}: {Math.round(angle)}{drawer ? '%' : '°'}<button type="button" className="rounded bg-slate-700 px-2 py-1" onClick={() => onChange(setCabinetDoorAngle(layout, index, angle > 0 ? 0 : drawer ? 90 : tilt ? 40 : 110))}>{angle > 0 ? 'Close' : 'Open'} {drawer ? 'drawer' : 'door'} {index + 1}</button></span>
          <input aria-label={drawer ? `Cabinet drawer ${index + 1} extension` : `Cabinet door ${index + 1} angle`} type="range" min="0" max={drawer ? 100 : tilt ? 60 : 170} step="1" value={angle} className="w-full accent-sky-400" onChange={e => onChange(setCabinetDoorAngle(layout, index, +e.target.value))} /></div>}
        {drawer ? <p className="text-slate-400">Telescopic slides · box and contents extend together</p> : tilt ? <p className="text-slate-400">Bottom hinge · basket tilts with the front</p> : <><label className="block">Door {index + 1} hinge
          <select aria-label={`Cabinet door ${index + 1} hinge type`} className="w-full rounded bg-slate-800 p-1" value={hinge.type} onChange={e => {
            const type = e.target.value as CabinetHinge['type'];
            update(index, { type, travel: hinge.type === 'pivot' && type !== 'pivot' ? .02 : hinge.travel });
          }}>
            {Object.entries(CABINET_HINGE_TYPES).map(([type, name]) => <option key={type} value={type}>{name}</option>)}
          </select>
        </label>
        {hinge.type !== 'pivot' && <label className="block">Clearance travel (mm)
          <input aria-label={`Cabinet door ${index + 1} hinge travel (mm)`} type="number" min="0" max="50" step="1" className="w-full rounded bg-slate-800 p-1" value={+(hinge.travel * 1000).toFixed(2)} onChange={e => {
            if (e.target.value === '') return;
            const travel = +e.target.value / 1000;
            if (Number.isFinite(travel) && travel >= 0 && travel <= .05) update(index, { ...hinge, travel });
          }} />
        </label>}</>}
      </div>;
    })}
    {leaves.some(l => !['tilt-out', 'drawer'].includes(l.section?.opening ?? 'swing')) && <p className="text-[10px] text-slate-400">Concealed hinges move the door inward and outward as it opens. Travel is approximate; use your hinge's clearance dimensions. Arm type alone does not guarantee clearance.</p>}
  </div>;
}
