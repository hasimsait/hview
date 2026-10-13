import React, { useState, useEffect } from 'react';
import { SceneObject, SurfaceDescriptor, PropertyDescriptor } from '../../domain/entities/SceneObject';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';
import { SurfaceFinishConfig } from '@core/types/plan';
import { IPlanManagerService, ISceneService } from '@core/types/services';
import { Sliders, Layers } from 'lucide-react';

interface UniversalObjectInspectorProps {
  object: SceneObject;
  planManager: IPlanManagerService;
  sceneService?: ISceneService;
  onClose?: () => void;
}

export const UniversalObjectInspector: React.FC<UniversalObjectInspectorProps> = ({
  object,
  planManager,
}) => {
  const [activeSurfaceKey, setActiveSurfaceKey] = useState<string>('');
  const [, setRenderTick] = useState<number>(0);

  const surfaces: SurfaceDescriptor[] = object.getSurfaces();
  const properties: PropertyDescriptor[] = object.getInspectableProperties();

  // Ensure valid active surface
  useEffect(() => {
    if (surfaces.length > 0) {
      if (!surfaces.some((s) => s.key === activeSurfaceKey)) {
        setActiveSurfaceKey(surfaces[0].key);
      }
    } else {
      setActiveSurfaceKey('');
    }
  }, [object.id, surfaces]);

  const currentFinish: SurfaceFinishConfig | undefined = activeSurfaceKey
    ? object.getSurfaceFinish(activeSurfaceKey)
    : undefined;

  const handleApplyFinish = (finish: SurfaceFinishConfig) => {
    object.setSurfaceFinish(activeSurfaceKey, finish);
    setRenderTick((t) => t + 1);

    // Notify domain manager
    if (object.objectType === 'wall') {
      planManager.setWallFinish(object.id, finish, activeSurfaceKey as any);
    } else if (object.objectType === 'furniture') {
      if (activeSurfaceKey === 'all') {
        planManager.setFurnitureFinish(object.id, finish);
      } else {
        planManager.setFurnitureSectionFinish(object.id, activeSurfaceKey, finish);
      }
    }
  };

  const handleClearFinish = () => {
    object.setSurfaceFinish(activeSurfaceKey, undefined);
    setRenderTick((t) => t + 1);

    if (object.objectType === 'wall') {
      planManager.setWallFinish(object.id, { type: 'plaster', variant: 'smooth', color: '#efede8' }, activeSurfaceKey as any);
    } else if (object.objectType === 'furniture') {
      if (activeSurfaceKey === 'all') {
        planManager.setFurnitureFinish(object.id, undefined);
      } else {
        planManager.setFurnitureSectionFinish(object.id, activeSurfaceKey, undefined);
      }
    }
  };

  const handlePropertyChange = (key: string, value: any) => {
    object.setPropertyValue(key, value);
    setRenderTick((t) => t + 1);

    if (object.objectType === 'furniture') {
      planManager.updateFurniture(object.id, {
        position: { ...object.position },
        rotationY: object.rotation.y,
        dimensions: { ...object.dimensions },
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-100 overflow-y-auto w-80">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white truncate">{object.name}</h2>
          <span className="text-[10px] uppercase font-bold text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/40">
            {object.objectType}
          </span>
        </div>
      </div>

      {/* Polymorphic Surface Selector */}
      {surfaces.length > 0 && (
        <div className="p-3 border-b border-slate-800">
          <div className="text-[10px] uppercase font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Select Surface / Component</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
            {surfaces.map((s) => {
              const isSelected = activeSurfaceKey === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveSurfaceKey(s.key)}
                  className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all text-center truncate ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={s.description || s.label}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Universal Surface Finish Picker */}
      {activeSurfaceKey && (
        <div className="p-3 border-b border-slate-800">
          <SurfaceFinishPicker
            currentFinish={currentFinish}
            onSelectFinish={handleApplyFinish}
            onClearFinish={handleClearFinish}
          />
        </div>
      )}

      {/* Polymorphic Property Descriptors */}
      {properties.length > 0 && (
        <div className="p-3 space-y-3">
          <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Object Properties</span>
          </div>
          <div className="space-y-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            {properties.map((prop) => (
              <div key={prop.key} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{prop.label}</span>
                {prop.type === 'number' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={prop.value}
                      min={prop.min}
                      max={prop.max}
                      step={prop.step || 1}
                      onChange={(e) => handlePropertyChange(prop.key, e.target.value)}
                      className="w-16 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-right text-xs text-white"
                    />
                    {prop.unit && <span className="text-[10px] text-slate-500">{prop.unit}</span>}
                  </div>
                )}
                {prop.type === 'boolean' && (
                  <input
                    type="checkbox"
                    checked={Boolean(prop.value)}
                    onChange={(e) => handlePropertyChange(prop.key, e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-sky-600 focus:ring-sky-500"
                  />
                )}
                {prop.type === 'color' && (
                  <input
                    type="color"
                    value={prop.value}
                    onChange={(e) => handlePropertyChange(prop.key, e.target.value)}
                    className="w-7 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
