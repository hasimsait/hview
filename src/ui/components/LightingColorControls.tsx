import { useSyncExternalStore } from 'react';
import type { ViewportSettings } from '../../core/types/services';
import { useRuntime } from '../context/RuntimeContext';
import { lightingExposure } from '../../engine/lighting/Exposure';

export function LightingColorControls() {
  const { scene } = useRuntime();
  const settings = useSyncExternalStore(scene.subscribeSettings, scene.getSettingsSnapshot);
  const update = (next: Partial<ViewportSettings>) => {
    scene.updateSettings(next);
  };
  return <section aria-label="Lighting color controls" className="border-t border-slate-800 pt-2 space-y-2">
    <button type="button" aria-pressed={settings.surfaceColors ?? false} onClick={() => update({ surfaceColors: !settings.surfaceColors })}
      className="w-full rounded border border-sky-600 px-2 py-1.5 text-xs text-sky-300 aria-pressed:bg-sky-700 aria-pressed:text-white">Compare surface colors</button>
    <p className="text-[10px] text-slate-400">Compare paint and wood without room lights, shadows or exposure shifts. Turn off to judge them under room lighting.</p>
    <fieldset disabled={settings.surfaceColors} className="space-y-2 disabled:opacity-50">
    <label className="flex justify-between items-center gap-2 text-[11px] text-slate-300">
      Color rendering
      <select aria-label="Color rendering" value={settings.toneMapping ?? 'neutral'} onChange={event => update({ toneMapping: event.target.value as 'neutral' | 'aces' })}
        className="bg-slate-800 border border-slate-700 rounded px-1 py-1">
        <option value="neutral">PBR Neutral</option><option value="aces">ACES comparison</option>
      </select>
    </label>
    <label className="flex justify-between items-center gap-2 text-[11px] text-slate-300">
      White balance
      <select aria-label="Viewing white balance" value={settings.whiteBalanceKelvin ?? 6500}
        onChange={event => update({whiteBalanceKelvin:Number(event.target.value)})}
        className="bg-slate-800 border border-slate-700 rounded px-1 py-1">
        {[6500,5500,4000,3500,3000,2700].map(kelvin=><option key={kelvin} value={kelvin}>{kelvin} K{kelvin===6500?' (reference)':''}</option>)}
      </select>
    </label>
    <button type="button" onClick={()=>update({whiteBalanceKelvin:settings.fixtureTemperatureKelvin || 6500})}
      className="text-[11px] text-sky-400 hover:text-sky-300">Adapt to preview light</button>
    <label className="block text-[11px] text-slate-300">
      <span className="flex justify-between">Viewing adaptation <span>{Math.round((settings.whiteBalanceAdaptation ?? .5) * 100)}%</span></span>
      <input aria-label="Viewing adaptation" type="range" min="0" max="1" step="0.05" value={settings.whiteBalanceAdaptation ?? .5}
        onChange={event => update({whiteBalanceAdaptation:Number(event.target.value)})} className="w-full accent-sky-400" />
    </label>
    <p className="text-[10px] text-slate-500">0% keeps the unadapted tint; 100% neutralizes the selected white. Start at 50% to retain warmth. This viewing adjustment affects mixed lights too; lamp Kelvin and lumens stay unchanged.</p>
    <label className="block text-[11px] text-slate-300">
      <span className="flex justify-between">Exposure <span>{Math.log2(lightingExposure(settings)).toFixed(1)} EV</span></span>
      <input aria-label="Lighting exposure" type="range" min="-6" max="2" step="0.1" value={Math.log2(lightingExposure(settings))}
        onChange={event => update({ exposure: 2 ** Number(event.target.value) })} className="w-full accent-sky-400" />
    </label>
    <label className="flex justify-between items-center gap-2 text-[11px] text-slate-300">
      White light preview
      <select aria-label="White light preview" value={settings.fixtureTemperatureKelvin ?? 0} onChange={event => update({ fixtureTemperatureKelvin: Number(event.target.value) })}
        className="bg-slate-800 border border-slate-700 rounded px-1 py-1">
        <option value="0">Use fixture settings</option>
        {[2700,3000,3500,6500].map(kelvin => <option key={kelvin} value={kelvin}>{kelvin} K</option>)}
      </select>
    </label>
    <p className="text-[10px] text-slate-500">Preview overrides every fixture's temperature without editing the plan. Night exposure defaults to a fixed 100 lux reference; it stays fixed when lamps dim or switch off. Paint previews approximate real samples and LED spectra.</p>
    <button type="button" onClick={() => update({ exposure: undefined, toneMapping: 'neutral', fixtureTemperatureKelvin: 0, whiteBalanceKelvin:6500, whiteBalanceAdaptation:.5 })}
      className="text-[11px] text-sky-400 hover:text-sky-300">Reset color controls</button>
    </fieldset>
  </section>;
}
