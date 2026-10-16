import { CABINET_HINGE_TYPES, cabinetHinge, type CabinetHinge, type CabinetLayout } from '../../domain/cabinet/CabinetLayout';

export function CabinetHingeControls({ layout, onChange }: { layout: CabinetLayout; onChange: (layout: CabinetLayout) => void }) {
  function update(index: number, hinge: CabinetHinge) {
    const hinges: [CabinetHinge, CabinetHinge] = [{ ...cabinetHinge(layout, 0) }, { ...cabinetHinge(layout, 1) }];
    hinges[index] = hinge;
    onChange({ ...layout, doors: { ...layout.doors, hinges } });
  }
  return <div className="space-y-2">
    {Array.from({ length: layout.doors.count }, (_, index) => {
      const hinge = cabinetHinge(layout, index);
      return <div key={index} className="space-y-1">
        <label className="block">Door {index + 1} hinge
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
        </label>}
      </div>;
    })}
    {layout.doors.count > 0 && <p className="text-[10px] text-slate-400">Concealed hinges move the door inward and outward as it opens. Travel is approximate; use your hinge's clearance dimensions. Arm type alone does not guarantee clearance.</p>}
  </div>;
}
