import { SurfaceFinishConfig } from '@core/types/plan';
import type { TileEntry } from '@core/types/services';
import { preserveSurfaceLayer } from '@core/types/surfaceLayer';
import { useRuntime } from '@ui/context/RuntimeContext';
import { Check,Disc,EyeOff,Grid,Layers,Paintbrush,Palette,Pipette,RotateCcw,RotateCw,Search,Sparkles } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { getFabricScale,isFabricStretched } from '../../engine/materials/SurfaceMaterialFactory';
import { resolveEmbeddedTextureUrl } from '../../engine/materials/TextureSource';
import {
  ACOUSTIC_BACKING_COLORS,
  ACOUSTIC_SLAT_VARIANTS,
  ALL_CURATED_PAINTS,
  CEILING_FINISHES,
  FABRIC_CATEGORIES,
  FURNITURE_WOOD_FINISHES,
  GLASS_FINISHES,
  GROUT_COLORS,
  METAL_FINISHES,
  PAINT_CATEGORIES,
  PARQUET_FINISHES,
  PHOTOGRAPHIC_FABRIC_COLLECTIONS,
  PLASTER_FINISHES,
  PORCELAIN_FINISHES,
  TILE_LAYOUT_PATTERNS,
  type PhotographicFabricItem,
  type SurfaceFinishPickerProps,
  type TabType,
} from './SurfaceFinishCatalog';
import { SurfaceLayerControl } from './SurfaceLayerControl';

export { PHOTOGRAPHIC_FABRIC_COLLECTIONS,type PhotographicFabricItem };

const normalizePaintSearch = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ı/g, 'i').trim();

export const SurfaceFinishPicker: React.FC<SurfaceFinishPickerProps> = ({
  currentFinish,
  onSelectFinish: selectFinish,
  onClearFinish,
  showCeilingsTab = false,
  defaultTab,
}) => {
  const runtime = useRuntime();
  const onSelectFinish = (finish: SurfaceFinishConfig) => selectFinish(preserveSurfaceLayer(finish, currentFinish));
  const [activeTab, setActiveTab] = useState<TabType>(
    defaultTab ||
    (currentFinish?.type === 'metal' || currentFinish?.type === 'porcelain'
      ? 'metal'
      : currentFinish?.type === 'fabric'
        ? 'fabric'
        : currentFinish?.type === 'tile'
          ? 'tile'
          : currentFinish?.type === 'wood' || currentFinish?.type === 'lambri'
            ? 'lambri'
            : 'paint')
  );
  const [selectedFabricCategory, setSelectedFabricCategory] = useState<string>('velvet_reds');
  const [selectedPaletteCategory, setSelectedPaletteCategory] = useState<string>('all');
  const [customHex, setCustomHex] = useState(
    currentFinish?.type === 'paint' && currentFinish.color ? currentFinish.color : '#efede8'
  );
  const [paintSearchQuery, setPaintSearchQuery] = useState<string>('');
  const [paintLimit, setPaintLimit] = useState(120);
  const [selectedLambriSlat, setSelectedLambriSlat] = useState<string>(
    currentFinish?.type === 'lambri' && currentFinish.variant ? currentFinish.variant : 'oak_slats'
  );
  const [selectedLambriBacking, setSelectedLambriBacking] = useState<string>(
    currentFinish?.type === 'lambri' && currentFinish.backingColor ? currentFinish.backingColor : '#121212'
  );
  const [customBackingHex, setCustomBackingHex] = useState<string>(selectedLambriBacking);

  useEffect(() => {
    if (currentFinish?.type === 'lambri') {
      if (currentFinish.variant) setSelectedLambriSlat(currentFinish.variant);
      if (currentFinish.backingColor) {
        setSelectedLambriBacking(currentFinish.backingColor);
        setCustomBackingHex(currentFinish.backingColor);
      }
    }
  }, [currentFinish]);

  // Tile catalog — loaded async from public/textures/tiles/tiles.json
  const tileCatalogService = runtime.tiles;
  const [tileEntries, setTileEntries] = useState<TileEntry[]>(() => tileCatalogService.getAll());

  useEffect(() => {
    return tileCatalogService.onCatalogLoaded((entries) => {
      setTileEntries(entries);
    });
  }, [tileCatalogService]);

  const getGroutWidthForVariant = (variant?: string): number => {
    if (!variant) return 2;
    const entry = tileCatalogService.getById(variant);
    if (entry) return tileCatalogService.getDefaultGroutWidth(entry);
    return 2;
  };

  const currentGroutWidth =
    currentFinish?.type === 'tile'
      ? (currentFinish.groutWidth ?? getGroutWidthForVariant(currentFinish.variant))
      : 2;
  const currentGroutColor = currentFinish?.groutColor || '#d1d5db';
  const [customGroutHex, setCustomGroutHex] = useState(currentGroutColor);

  useEffect(() => {
    setCustomGroutHex(currentGroutColor);
  }, [currentGroutColor]);

  const handleGroutColorChange = (hex: string) => {
    setCustomGroutHex(hex);
    const newWidth = currentGroutWidth === 0 ? 1 : currentGroutWidth;
    if (currentFinish && currentFinish.type === 'tile') {
      onSelectFinish({ ...currentFinish, groutColor: hex, groutWidth: newWidth });
    } else {
      const first = tileEntries[0];
      if (first) {
        onSelectFinish({
          type: 'tile',
          variant: first.id,
          color: first.color,
          roughness: first.roughness,
          rotation: currentFinish?.rotation || 0,
          pattern: tileCatalogService.getDefaultPattern(first),
          groutWidth: newWidth,
          groutColor: hex,
        });
      }
    }
  };

  const isInvisible =
    currentFinish?.type === 'invisible' ||
    currentFinish?.color === 'invisible' ||
    currentFinish?.variant === 'invisible';

  const isCurrent = (type: string, variant?: string, color?: string, backingColor?: string) => {
    if (!currentFinish) return false;
    if (isInvisible) {
      return type === 'invisible' || color === 'invisible';
    }
    if (currentFinish.type !== type) return false;
    if (variant && currentFinish.variant !== variant) return false;
    if (color && currentFinish.color?.toLowerCase() !== color.toLowerCase()) return false;
    if (backingColor && currentFinish.backingColor?.toLowerCase() !== backingColor.toLowerCase()) return false;
    return true;
  };

  return (
    <div className="space-y-3">
      <SurfaceLayerControl layer={currentFinish?.layer} disabled={!currentFinish}
        onChange={(layer) => { if (currentFinish) onSelectFinish({ ...currentFinish, layer }); }} />
      {/* Universal Invisible Option Button */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg border border-slate-800 bg-slate-900/60">
        <button
          type="button"
          onClick={() => onSelectFinish({ type: 'invisible', color: 'invisible' })}
          className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${isInvisible
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent'
            }`}
        >
          <div className="flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
            <span>Invisible</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {isInvisible ? 'Part / Surface Hidden' : 'Hide Part or Surface'}
          </span>
          {isInvisible && <Check className="w-3.5 h-3.5 text-indigo-400 ml-1" />}
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap border-b border-slate-800 gap-1 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('paint')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${activeTab === 'paint'
            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
        >
          <Paintbrush className="w-3 h-3" />
          Paint & Plaster
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lambri')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${activeTab === 'lambri'
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
        >
          <Layers className="w-3 h-3" />
          Wood & Parquet
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tile')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${activeTab === 'tile'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
        >
          <Grid className="w-3 h-3" />
          Tile & Marble
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('glass')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${activeTab === 'glass'
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
        >
          <Sparkles className="w-3 h-3" />
          Glass
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('metal')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${activeTab === 'metal'
            ? 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
        >
          <Disc className="w-3 h-3 text-zinc-400" />
          Metal &amp; Fixtures
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fabric')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${activeTab === 'fabric'
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
        >
          <Sparkles className="w-3 h-3 text-rose-400" />
          Velvet &amp; Fabric
        </button>

        {showCeilingsTab && (
          <button
            type="button"
            onClick={() => setActiveTab('ceiling')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${activeTab === 'ceiling'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
          >
            <Grid className="w-3 h-3" />
            Ceiling
          </button>
        )}
      </div>

      {/* Tab 1: Paint & Plaster */}
      {activeTab === 'paint' && (
        <div className="space-y-3">
          {/* Curated Paint Colors */}
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-slate-400 mb-1.5">
              <span>Architectural Wall Paint</span>
              <span className="text-[9px] text-sky-400 font-normal">{ALL_CURATED_PAINTS.length} wall colors</span>
            </div>

            {/* Search all bundled paint palettes. */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                aria-label="Search wall colors"
                placeholder="Search wall colors by name or hex code"
                value={paintSearchQuery}
                onChange={(e) => { setPaintSearchQuery(e.target.value); setPaintLimit(120); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              {paintSearchQuery && (
                <button
                  type="button"
                  onClick={() => { setPaintSearchQuery(''); setPaintLimit(120); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category filter pills (shown when not searching) */}
            {!paintSearchQuery && (
              <div className="flex flex-wrap gap-1 mb-2">
                {PAINT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { setSelectedPaletteCategory(cat.id); setPaintLimit(120); }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${selectedPaletteCategory === cat.id
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                  >
                    {cat.id === 'all' ? `All (${ALL_CURATED_PAINTS.length})` : cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Swatch grid */}
            {(() => {
              let displayColors =
                selectedPaletteCategory === 'all'
                  ? ALL_CURATED_PAINTS
                  : PAINT_CATEGORIES.find((c) => c.id === selectedPaletteCategory)?.colors || [];

              if (paintSearchQuery.trim()) {
                const q = normalizePaintSearch(paintSearchQuery);
                const allPaintsWithMetals = PAINT_CATEGORIES.filter((c) => c.id !== 'all').flatMap((c) => c.colors);
                displayColors = allPaintsWithMetals.filter(
                  (p) => normalizePaintSearch(p.name).includes(q) || p.hex.toLowerCase().includes(q)
                );
              }

              if (displayColors.length === 0) {
                return (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/60">
                    No wall colors matching "{paintSearchQuery}"
                  </div>
                );
              }

              return (
                <div>
                  <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-0.5" role="region" aria-label="Paint colors">
                    {displayColors.slice(0, paintLimit).map((p) => {
                      const active = isCurrent('paint', undefined, p.hex);
                      return (
                        <button
                          key={`${p.name}_${p.hex}`}
                          type="button"
                          onClick={() => {
                            setCustomHex(p.hex);
                            onSelectFinish({
                              type: 'paint',
                              color: p.hex,
                              roughness: 0.85,
                            });
                          }}
                          className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${active
                            ? 'border-sky-500 bg-sky-500/10 shadow-sm'
                            : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                            }`}
                          title={`${p.name} (${p.hex})`}
                        >
                          <div
                            className="w-4 h-4 rounded-full border border-slate-700/60 shadow-inner shrink-0"
                            style={{ backgroundColor: p.hex }}
                          />
                          <span className="text-[10px] text-slate-300 truncate font-medium flex-1">
                            {p.name}
                          </span>
                          {active && <Check className="w-3 h-3 text-sky-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {displayColors.length > paintLimit && <button type="button" onClick={() => setPaintLimit(limit => limit + 120)} className="mt-2 text-xs text-sky-400 hover:text-sky-300">
                    Show more colors ({paintLimit} of {displayColors.length})
                  </button>}
                  {(selectedPaletteCategory === 'filli_momento_silan' || paintSearchQuery.trim()) && <p className="mt-2 text-[10px] text-slate-500">Digital swatches are approximate. Check a physical paint sample for the final color.</p>}
                </div>
              );
            })()}
          </div>

          {/* Custom Hex Color Picker */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
            <input
              type="color"
              value={customHex}
              onChange={(e) => {
                const hex = e.target.value;
                setCustomHex(hex);
                onSelectFinish({
                  type: 'paint',
                  color: hex,
                  roughness: 0.85,
                });
              }}
              className="w-7 h-7 rounded border border-slate-700 bg-slate-800 cursor-pointer p-0.5"
            />
            <div className="flex-1">
              <input
                type="text"
                value={customHex}
                onChange={(e) => {
                  const hex = e.target.value;
                  setCustomHex(hex);
                  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    onSelectFinish({
                      type: 'paint',
                      color: hex,
                      roughness: 0.85,
                    });
                  }
                }}
                placeholder="#RRGGBB"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Textured Plasters */}
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5">
              Textured Plaster &amp; Microcement
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {PLASTER_FINISHES.map((pl) => {
                const active = isCurrent('plaster', pl.variant);
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'plaster',
                        variant: pl.variant,
                        color: pl.color,
                        roughness: pl.roughness,
                      })
                    }
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${active
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                  >
                    <div
                      className="w-5 h-5 rounded border border-slate-700 shadow-inner shrink-0"
                      style={{ backgroundColor: pl.color }}
                    />
                    <div className="flex-1">
                      <div className="text-xs text-slate-200 font-medium">{pl.name}</div>
                      <div className="text-[10px] text-slate-400">Micro-textured architectural mineral finish</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Wood & Parquet (Furniture Hardwoods, Flooring, and Dual-Tone Lambri) */}
      {activeTab === 'lambri' && (
        <div className="space-y-4">
          {currentFinish?.type === 'wood' && (
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                <RotateCw className="h-3.5 w-3.5 text-amber-400" />
                Grain direction
              </div>
              <div className="grid grid-cols-2 gap-1">
                {[0, 90].map((rotation) => (
                  <button
                    key={rotation}
                    type="button"
                    aria-pressed={(Math.abs(Math.sin((currentFinish.rotation || 0) * Math.PI / 180)) > 0.707) === (rotation === 90)}
                    onClick={() => onSelectFinish({ ...currentFinish, rotation })}
                    className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:bg-slate-700 aria-pressed:bg-amber-600 aria-pressed:text-white"
                  >
                    {rotation === 0 ? 'Horizontal grain (0°)' : 'Vertical grain (90°)'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Section 1: Solid Hardwood & Furniture Veneers */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-slate-400">
              <span>Wood, Veneers &amp; Laminates</span>
              <span className="text-[9px] text-amber-400 font-normal">Photographic PBR</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {FURNITURE_WOOD_FINISHES.map((w) => {
                const active = currentFinish?.type === 'wood' && currentFinish?.variant === w.variant;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'wood',
                        variant: w.variant,
                        color: w.color,
                        roughness: w.roughness,
                        rotation: currentFinish?.type === 'wood' ? currentFinish.rotation : 0,
                      })
                    }
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${active
                      ? 'border-amber-500 bg-amber-500/15 shadow-sm'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                  >
                    <div
                      className="w-10 h-10 rounded-md border border-slate-700 shadow-inner shrink-0 bg-cover bg-center overflow-hidden"
                      style={{
                        backgroundImage: `url(${resolveEmbeddedTextureUrl(w.imageUrl)})`,
                        backgroundColor: w.color,
                        transform: active ? `rotate(${currentFinish?.rotation || 0}deg)` : undefined,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-200 font-semibold truncate">{w.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{w.subtitle}</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Parquet & Wood Plank Flooring */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold text-slate-400">
              Flooring &amp; Parquet Patterns
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PARQUET_FINISHES.map((p) => {
                const active = currentFinish?.type === 'wood' && currentFinish?.variant === p.variant;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'wood',
                        variant: p.variant,
                        color: p.color,
                        roughness: p.roughness,
                        rotation: currentFinish?.type === 'wood' ? currentFinish.rotation : 0,
                      })
                    }
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${active
                      ? 'border-amber-500 bg-amber-500/15'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                  >
                    <div
                      className="w-6 h-6 rounded border border-slate-700 shadow-inner shrink-0 flex items-center justify-center font-bold text-[8px] text-slate-900"
                      style={{ backgroundColor: p.color }}
                    >
                      #
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-slate-200 font-medium truncate">{p.name}</div>
                    </div>
                    {active && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Dual-Tone Acoustic Lambri (Slats + Felt Backing) */}
          <div className="space-y-2.5 p-2.5 rounded-xl border border-amber-500/20 bg-amber-950/10">
            <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-amber-400">
              <span>Acoustic Slats &amp; Lambri</span>
              <span className="text-[9px] text-slate-400 font-normal">Dual-Tone Backing</span>
            </div>

            {/* Preview of Slat on Backing */}
            {(() => {
              const currentSlat =
                ACOUSTIC_SLAT_VARIANTS.find((s) => s.variant === selectedLambriSlat) ||
                ACOUSTIC_SLAT_VARIANTS[0];
              const effectiveBacking = selectedLambriBacking || '#121212';
              const backingInfo = ACOUSTIC_BACKING_COLORS.find(
                (b) => b.hex.toLowerCase() === effectiveBacking.toLowerCase()
              );
              const backingLabel = backingInfo ? backingInfo.name : effectiveBacking;

              return (
                <div className="flex items-center gap-3 p-2 rounded-lg border border-slate-800 bg-slate-950/80">
                  <div
                    className="w-12 h-10 rounded border border-slate-700 shadow-inner shrink-0 flex items-center justify-around px-1"
                    style={{ backgroundColor: effectiveBacking }}
                  >
                    <div className="w-1.5 h-8 rounded-sm shadow-sm" style={{ backgroundColor: currentSlat.color }} />
                    <div className="w-1.5 h-8 rounded-sm shadow-sm" style={{ backgroundColor: currentSlat.color }} />
                    <div className="w-1.5 h-8 rounded-sm shadow-sm" style={{ backgroundColor: currentSlat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-amber-200 font-semibold truncate">
                      {currentSlat.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Backing: <span className="text-slate-300 font-medium">{backingLabel}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'lambri',
                        variant: currentSlat.variant,
                        color: currentSlat.color,
                        backingColor: effectiveBacking,
                        roughness: 0.55,
                      })
                    }
                    className="px-2 py-1 rounded bg-amber-500 text-slate-950 text-[10px] font-semibold hover:bg-amber-400 transition-colors shrink-0"
                  >
                    Apply Lambri
                  </button>
                </div>
              );
            })()}

            {/* Step A: Slat Finish Selection */}
            <div>
              <div className="text-[9px] uppercase font-medium text-slate-400 mb-1">
                1. Select Slat Finish (Protrusion)
              </div>
              <div className="grid grid-cols-3 gap-1">
                {ACOUSTIC_SLAT_VARIANTS.map((slat) => {
                  const active =
                    currentFinish?.type === 'lambri'
                      ? currentFinish.variant === slat.variant
                      : selectedLambriSlat === slat.variant;
                  return (
                    <button
                      key={slat.id}
                      type="button"
                      onClick={() => {
                        setSelectedLambriSlat(slat.variant);
                        onSelectFinish({
                          type: 'lambri',
                          variant: slat.variant,
                          color: slat.color,
                          backingColor: selectedLambriBacking,
                          roughness: 0.55,
                        });
                      }}
                      className={`flex items-center gap-1.5 p-1.5 rounded border text-left transition-all ${active
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300'
                        }`}
                      title={slat.name}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded border border-slate-700 shadow-inner shrink-0"
                        style={{ backgroundColor: slat.color }}
                      />
                      <span className="text-[10px] truncate font-medium flex-1">
                        {slat.woodName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step B: Acoustic Backing Felt Selection */}
            <div>
              <div className="text-[9px] uppercase font-medium text-slate-400 mb-1">
                2. Select Acoustic Felt Backing (Background)
              </div>
              <div className="grid grid-cols-5 gap-1 mb-1.5">
                {ACOUSTIC_BACKING_COLORS.map((b) => {
                  const active =
                    currentFinish?.type === 'lambri' && currentFinish.backingColor
                      ? currentFinish.backingColor.toLowerCase() === b.hex.toLowerCase()
                      : selectedLambriBacking.toLowerCase() === b.hex.toLowerCase();
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedLambriBacking(b.hex);
                        setCustomBackingHex(b.hex);
                        const currentSlatObj =
                          ACOUSTIC_SLAT_VARIANTS.find((s) => s.variant === selectedLambriSlat) ||
                          ACOUSTIC_SLAT_VARIANTS[0];
                        onSelectFinish({
                          type: 'lambri',
                          variant: currentSlatObj.variant,
                          color: currentSlatObj.color,
                          backingColor: b.hex,
                          roughness: 0.55,
                        });
                      }}
                      className={`flex flex-col items-center gap-1 p-1 rounded border text-center transition-all ${active
                        ? 'border-amber-400 bg-amber-500/20 shadow-sm'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                        }`}
                      title={`${b.name} (${b.subtitle})`}
                    >
                      <div
                        className="w-4 h-4 rounded border border-slate-700 shadow-inner"
                        style={{ backgroundColor: b.hex }}
                      />
                      <span className="text-[8px] text-slate-300 leading-tight truncate w-full">
                        {b.name.replace(' Felt', '')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Backing Color Picker */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                <span className="text-[9px] text-slate-400 shrink-0">Custom Felt Hex:</span>
                <input
                  type="color"
                  value={
                    customBackingHex.startsWith('#') && customBackingHex.length === 7
                      ? customBackingHex
                      : '#121212'
                  }
                  onChange={(e) => {
                    const hex = e.target.value;
                    setCustomBackingHex(hex);
                    setSelectedLambriBacking(hex);
                    const currentSlatObj =
                      ACOUSTIC_SLAT_VARIANTS.find((s) => s.variant === selectedLambriSlat) ||
                      ACOUSTIC_SLAT_VARIANTS[0];
                    onSelectFinish({
                      type: 'lambri',
                      variant: currentSlatObj.variant,
                      color: currentSlatObj.color,
                      backingColor: hex,
                      roughness: 0.55,
                    });
                  }}
                  className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={customBackingHex}
                  onChange={(e) => {
                    const hex = e.target.value;
                    setCustomBackingHex(hex);
                    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                      setSelectedLambriBacking(hex);
                      const currentSlatObj =
                        ACOUSTIC_SLAT_VARIANTS.find((s) => s.variant === selectedLambriSlat) ||
                        ACOUSTIC_SLAT_VARIANTS[0];
                      onSelectFinish({
                        type: 'lambri',
                        variant: currentSlatObj.variant,
                        color: currentSlatObj.color,
                        backingColor: hex,
                        roughness: 0.55,
                      });
                    }
                  }}
                  className="w-20 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  placeholder="#121212"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Tile & Stone */}
      {activeTab === 'tile' && (
        <div className="space-y-2">
          {/* Orientation / Flip Control Bar */}
          <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-300">
              <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium">Orientation:</span>
              <span className="text-[11px] text-emerald-400 font-semibold">
                {(currentFinish?.rotation || 0) % 180 === 90 ? 'Vertical (90°)' : 'Horizontal (0°)'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (currentFinish && currentFinish.type === 'tile') {
                    onSelectFinish({ ...currentFinish, rotation: 0 });
                  } else {
                    const first = tileEntries[0];
                    if (first) onSelectFinish({ type: 'tile', variant: first.id, color: first.color, roughness: first.roughness, rotation: 0 });
                  }
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${(currentFinish?.rotation || 0) === 0
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                title="Horizontal layout (brick layout, long side parallel to ground)"
              >
                Horizontal (0°)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentFinish && currentFinish.type === 'tile') {
                    onSelectFinish({ ...currentFinish, rotation: 90 });
                  } else {
                    const first = tileEntries[0];
                    if (first) onSelectFinish({ type: 'tile', variant: first.id, color: first.color, roughness: first.roughness, rotation: 90 });
                  }
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${(currentFinish?.rotation || 0) === 90
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                title="Vertical layout (upright layout)"
              >
                Vertical (90°)
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentRot = currentFinish?.rotation || 0;
                  const nextRot = (currentRot + 90) % 360;
                  if (currentFinish && currentFinish.type === 'tile') {
                    onSelectFinish({ ...currentFinish, rotation: nextRot });
                  } else {
                    const first = tileEntries[0];
                    if (first) onSelectFinish({ type: 'tile', variant: first.id, color: first.color, roughness: first.roughness, rotation: nextRot });
                  }
                }}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Rotate +90°"
              >
                <RotateCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Layout Pattern Selector Bar */}
          <div className="space-y-1.5 bg-slate-950 p-2 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-1.5">
                <Grid className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-medium">Layout Pattern:</span>
              </div>
              <span className="text-[11px] text-amber-400 font-semibold">
                {TILE_LAYOUT_PATTERNS.find((p) => p.id === (currentFinish?.pattern || 'grid'))?.label || 'Grid'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {TILE_LAYOUT_PATTERNS.map((p) => {
                const isSelected = (currentFinish?.pattern || 'grid') === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (currentFinish && currentFinish.type === 'tile') {
                        onSelectFinish({ ...currentFinish, pattern: p.id });
                      } else {
                        const first = tileEntries[0];
                        if (first) {
                          onSelectFinish({
                            type: 'tile',
                            variant: first.id,
                            color: first.color,
                            roughness: first.roughness,
                            rotation: currentFinish?.rotation || 0,
                            pattern: p.id,
                            groutWidth: currentGroutWidth,
                            groutColor: currentGroutColor,
                          });
                        }
                      }
                    }}
                    className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors text-center truncate ${isSelected
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    title={p.description}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grout Specifications: Joint Width & Joint Color */}
          <div className="space-y-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            {/* Grout Width Header & Width Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="text-[11px] font-medium">Grout Joint Width:</span>
                <span className="text-[11px] text-sky-400 font-semibold">
                  {currentGroutWidth === 0 ? 'None (0 mm)' : `${currentGroutWidth} mm`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[
                  { value: 0, label: 'None' },
                  { value: 1, label: '1 mm' },
                  { value: 2, label: '2 mm' },
                  { value: 3, label: '3 mm' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (currentFinish && currentFinish.type === 'tile') {
                        onSelectFinish({ ...currentFinish, groutWidth: opt.value });
                      } else {
                        const first = tileEntries[0];
                        if (first) {
                          onSelectFinish({
                            type: 'tile',
                            variant: first.id,
                            color: first.color,
                            roughness: first.roughness,
                            rotation: 0,
                            pattern: tileCatalogService.getDefaultPattern(first),
                            groutWidth: opt.value,
                            groutColor: currentGroutColor,
                          });
                        }
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${currentGroutWidth === opt.value
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    title={`${opt.label} grout width`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grout Color Header, Custom Picker, and Hex Input */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Palette className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="text-[11px] font-medium shrink-0">Grout Color:</span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-slate-600 shadow-inner shrink-0"
                    style={{ backgroundColor: currentGroutColor }}
                    title={`Active grout color: ${currentGroutColor}`}
                  />
                  <span className="text-[11px] text-sky-400 font-semibold truncate">
                    {GROUT_COLORS.find((c) => c.hex.toLowerCase() === currentGroutColor.toLowerCase())?.name || currentGroutColor}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <label
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer border border-slate-700 text-[10px] font-medium transition-colors"
                    title="Click to open color picker palette or eyedropper"
                  >
                    <Pipette className="w-3 h-3 text-sky-400" />
                    <span>Picker</span>
                    <input
                      type="color"
                      value={currentGroutColor.startsWith('#') && currentGroutColor.length === 7 ? currentGroutColor : '#d1d5db'}
                      onChange={(e) => handleGroutColorChange(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                  <input
                    type="text"
                    value={customGroutHex}
                    onChange={(e) => {
                      setCustomGroutHex(e.target.value);
                      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                        handleGroutColorChange(e.target.value);
                      }
                    }}
                    onBlur={() => {
                      if (/^#[0-9A-Fa-f]{6}$/.test(customGroutHex)) {
                        handleGroutColorChange(customGroutHex);
                      } else {
                        setCustomGroutHex(currentGroutColor);
                      }
                    }}
                    placeholder="#d1d5db"
                    className="w-16 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-200 text-center uppercase focus:outline-none focus:border-sky-500"
                    title="Hex color code (e.g. #d1d5db)"
                  />
                </div>
              </div>

              {currentGroutWidth === 0 && (
                <div className="text-[9px] text-amber-400/90 italic">
                  Note: Joint width is currently None (0 mm). Selecting a color will set width to 1 mm.
                </div>
              )}

              {/* Architectural Preset Color Palette */}
              <div className="grid grid-cols-4 gap-1 pt-0.5">
                {GROUT_COLORS.map((gc) => {
                  const isSelected = currentGroutColor.toLowerCase() === gc.hex.toLowerCase();
                  return (
                    <button
                      key={gc.id}
                      type="button"
                      onClick={() => handleGroutColorChange(gc.hex)}
                      className={`flex items-center gap-1.5 p-1 rounded border text-left transition-all ${isSelected
                        ? 'border-sky-500 bg-sky-500/20 shadow-sm ring-1 ring-sky-500/50'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                        }`}
                      title={`${gc.name} (${gc.hex})`}
                    >
                      <div
                        className="w-3 h-3 rounded-full border border-slate-700/80 shadow-inner shrink-0"
                        style={{ backgroundColor: gc.hex }}
                      />
                      <span className="text-[9px] text-slate-300 truncate font-medium flex-1">
                        {gc.name}
                      </span>
                      {isSelected && <Check className="w-2.5 h-2.5 text-sky-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between">
            <span>Ceramic, Porcelain &amp; Natural Stone</span>
            <span className="text-emerald-400 text-[9px] lowercase font-normal">brick horizontal default</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {tileEntries.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-3 animate-pulse">Loading tile catalog…</div>
            ) : (
              tileEntries.map((t) => {
                const active = isCurrent('tile', t.id);
                const swatchUrl = t.textures[0] ?? null;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const defPattern = tileCatalogService.getDefaultPattern(t);
                      const pattern = (t.name.toLowerCase().includes('decor') || t.name.toLowerCase().includes('sage'))
                        ? defPattern
                        : (currentFinish?.pattern || defPattern);
                      onSelectFinish({
                        type: 'tile',
                        variant: t.id,
                        color: t.color,
                        roughness: t.roughness,
                        metalness: t.metalness,
                        rotation: currentFinish?.rotation || 0,
                        pattern,
                        groutWidth: currentFinish?.groutWidth ?? tileCatalogService.getDefaultGroutWidth(t),
                        groutColor: currentGroutColor,
                      });
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${active
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                  >
                    {/* Swatch: real image (textures[0]) or colour square for procedural */}
                    <div
                      className="relative w-7 h-7 rounded border border-slate-700 shadow-inner shrink-0 overflow-hidden flex items-center justify-center"
                      style={
                        swatchUrl
                          ? {
                            backgroundImage: `url(${resolveEmbeddedTextureUrl(swatchUrl)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                          : { backgroundColor: t.color }
                      }
                    >
                      {!swatchUrl && (
                        <span className="text-[10px] text-slate-700">⊞</span>
                      )}
                      {/* Multi-variant badge */}
                      {t.textures.length > 1 && (
                        <span
                          className="absolute bottom-0.5 right-0.5 bg-emerald-600 text-white text-[7px] font-bold rounded px-0.5 leading-none"
                          title={`${t.textures.length} variants`}
                        >
                          {t.textures.length}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-slate-200 font-medium">{t.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {t.textures.length === 0
                          ? 'Procedural / synthetic tile pattern'
                          : t.textures.length > 1
                            ? `${t.textures.length} variants · wet-area architectural tile`
                            : 'Wet-area architectural tile & grout grid'}
                      </div>
                    </div>
                    {active && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Glass */}
      {activeTab === 'glass' && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-semibold text-slate-400">
            Architectural Glass & Shower Partitions
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {GLASS_FINISHES.map((g) => {
              const active = isCurrent('glass', g.variant);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    onSelectFinish({
                      type: 'glass',
                      variant: g.variant,
                      color: g.color,
                      roughness: 0.1,
                    })
                  }
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${active
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                >
                  <div
                    className="w-7 h-7 rounded border border-cyan-400/40 shadow-inner shrink-0 flex items-center justify-center text-[10px] text-cyan-200 bg-cyan-500/20 backdrop-blur-sm"
                  >
                    ✧
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-200 font-medium">{g.name}</div>
                    <div className="text-[10px] text-slate-400">{g.subtitle || 'Physically-based transmission shader'}</div>
                  </div>
                  {active && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 5: Metal & Fixtures */}
      {activeTab === 'metal' && (
        <div className="space-y-3">
          {/* Section 1: Architectural Metals & Hardware */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Disc className="w-3 h-3 text-slate-400" />
              Metals &amp; Powder Coated Hardware
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {METAL_FINISHES.map((m) => {
                const active = isCurrent('metal', m.variant);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'metal',
                        variant: m.variant,
                        color: m.color,
                        roughness: m.roughness,
                        metalness: m.metalness,
                      })
                    }
                    className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${active
                      ? 'border-sky-500 bg-sky-500/10 shadow-sm ring-1 ring-sky-500/30'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                  >
                    <div
                      className="w-6 h-6 rounded-md border border-slate-700/80 shadow-sm shrink-0 flex items-center justify-center"
                      style={{ background: m.swatchBackground }}
                    >
                      {active && (
                        <Check className="w-3.5 h-3.5 text-sky-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-200 font-medium truncate">{m.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{m.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Vitreous Porcelain & Sanitary Ware */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-slate-400" />
              Vitreous China &amp; Sanitary Porcelain
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {PORCELAIN_FINISHES.map((p) => {
                const active = isCurrent('porcelain', p.variant);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'porcelain',
                        variant: p.variant,
                        color: p.color,
                        roughness: p.roughness,
                        metalness: p.metalness,
                      })
                    }
                    className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${active
                      ? 'border-sky-500 bg-sky-500/10 shadow-sm ring-1 ring-sky-500/30'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                  >
                    <div
                      className="w-6 h-6 rounded-md border border-slate-700/80 shadow-sm shrink-0 flex items-center justify-center"
                      style={{ background: p.swatchBackground }}
                    >
                      {active && (
                        <Check className="w-3.5 h-3.5 text-sky-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-200 font-medium truncate">{p.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{p.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Ceiling (if enabled) */}
      {showCeilingsTab && activeTab === 'ceiling' && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-semibold text-slate-400">
            Ceiling Finishes &amp; Systems
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {CEILING_FINISHES.map((c) => {
              const active = isCurrent('ceiling', c.variant);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    onSelectFinish({
                      type: 'ceiling',
                      variant: c.variant,
                      color: c.color,
                      roughness: c.roughness,
                    })
                  }
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${active
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                >
                  <div
                    className="w-7 h-7 rounded border border-slate-700 shadow-inner shrink-0 flex items-center justify-center text-[10px] text-purple-300"
                    style={{ backgroundColor: c.color }}
                  >
                    ▦
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-200 font-medium">{c.name}</div>
                    <div className="text-[10px] text-slate-400">Suspended ceiling tile grid at room height</div>
                  </div>
                  {active && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Fabric & Velvet */}
      {activeTab === 'fabric' && (
        <div className="space-y-3.5">
          {/* Section 1: Real Photographic Velvet Collections */}
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Photographic Velvet Collections</span>
              <span className="text-[9px] text-rose-400 font-normal">Real Reflections &amp; Folds</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
              {PHOTOGRAPHIC_FABRIC_COLLECTIONS.map((item) => {
                const active =
                  currentFinish?.type === 'fabric' &&
                  (currentFinish.variant === item.variant ||
                    (!currentFinish.variant && currentFinish.color?.toLowerCase() === item.color.toLowerCase()));
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const isLinenItem = item.variant?.includes('linen');
                      onSelectFinish({
                        type: 'fabric',
                        variant: item.variant,
                        color: item.color,
                        roughness: 0.82,
                        metalness: 0.02,
                        mappingMode: item.mappingMode || (isLinenItem ? 'tiled' : 'stretched'),
                        scale: item.scale || (isLinenItem ? 3.5 : 1.0),
                      });
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${active
                      ? 'border-rose-500 bg-rose-500/10 shadow-sm ring-1 ring-rose-500/30'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                  >
                    <div
                      className="w-10 h-10 rounded-md border border-slate-700/80 shadow-md shrink-0 bg-cover bg-center overflow-hidden"
                      style={{ backgroundImage: `url(${resolveEmbeddedTextureUrl(item.photoUrl)})` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-slate-200 font-medium truncate">{item.name}</span>
                        {item.tag && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">{item.subtitle}</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-rose-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Velvet Color Palette with Photographic Base */}
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Velvet Color Palette</span>
              <span className="text-[9px] text-slate-500">Photographic Tints</span>
            </div>
            {/* Category Pills */}
            <div className="flex flex-wrap gap-1 mb-2">
              {FABRIC_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedFabricCategory(cat.id)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${selectedFabricCategory === cat.id
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Colors Grid */}
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
              {(FABRIC_CATEGORIES.find((c) => c.id === selectedFabricCategory)?.colors || []).map((col) => {
                const active =
                  currentFinish?.type === 'fabric' &&
                  currentFinish.color?.toLowerCase() === col.hex.toLowerCase();
                return (
                  <button
                    key={`${col.name}_${col.hex}`}
                    type="button"
                    onClick={() => {
                      onSelectFinish({
                        type: 'fabric',
                        variant: col.variant || 'velvet_neutral_silver',
                        color: col.hex,
                        roughness: 0.82,
                        metalness: 0.02,
                        mappingMode: currentFinish?.mappingMode || 'stretched',
                        scale: currentFinish?.scale || 1.0,
                      });
                    }}
                    className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${active
                      ? 'border-rose-500 bg-rose-500/10 shadow-sm ring-1 ring-rose-500/30'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                    title={`${col.name} (${col.hex})`}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-slate-700/60 shadow-inner shrink-0 relative overflow-hidden"
                      style={{
                        backgroundColor: col.hex,
                        backgroundImage:
                          'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.3) 0%, rgba(0,0,0,0.2) 100%)',
                      }}
                    />
                    <div className="truncate flex-1 min-w-0">
                      <div className="text-[10px] text-slate-200 truncate font-medium">{col.name}</div>
                      <div className="text-[8px] text-slate-500 font-mono">{col.hex}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Texture Mapping & Weave Scale Options */}
          {currentFinish?.type === 'fabric' && (
            <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Fabric Texture Mapping</span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {!isFabricStretched(currentFinish)
                    ? `Tiled (${getFabricScale(currentFinish).toFixed(1)}x)`
                    : 'Stretched (Fitted)'}
                </span>
              </div>

              {/* Mode Toggle Buttons: Stretched vs Tiled */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onSelectFinish({
                      ...currentFinish,
                      mappingMode: 'stretched',
                      scale: 1.0,
                    });
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10px] font-medium border transition-all ${isFabricStretched(currentFinish)
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300 shadow-sm'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                >
                  <Layers className="w-3 h-3" />
                  Stretched (Fitted)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const isLinen = currentFinish.variant?.includes('linen');
                    onSelectFinish({
                      ...currentFinish,
                      mappingMode: 'tiled',
                      scale: currentFinish.scale || (isLinen ? 3.5 : 2.0),
                    });
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10px] font-medium border transition-all ${!isFabricStretched(currentFinish)
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300 shadow-sm'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                >
                  <Grid className="w-3 h-3" />
                  Tiled (Repeating)
                </button>
              </div>

              {/* Weave / Pattern Density Options (Active when Tiled) */}
              {!isFabricStretched(currentFinish) && (
                <div className="pt-1 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] text-slate-400">
                    <span>Pattern Weave Density</span>
                    <span className="text-slate-500 font-mono">
                      {getFabricScale(currentFinish).toFixed(1)} repeats/m
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Fine (4x)', value: 4.0 },
                      { label: 'Standard (3.5x)', value: 3.5 },
                      { label: 'Medium (2.5x)', value: 2.5 },
                      { label: 'Coarse (1.5x)', value: 1.5 },
                    ].map((preset) => {
                      const currentScale = getFabricScale(currentFinish);
                      const isPresetActive = Math.abs(currentScale - preset.value) < 0.1;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            onSelectFinish({
                              ...currentFinish,
                              mappingMode: 'tiled',
                              scale: preset.value,
                            });
                          }}
                          className={`py-1 px-1 rounded text-[8.5px] font-medium border text-center transition-all ${isPresetActive
                            ? 'border-rose-500/60 bg-rose-500/20 text-rose-200 font-semibold'
                            : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-300 hover:border-slate-700'
                            }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* Reset / Clear Button */}
      {onClearFinish && currentFinish && (
        <button
          type="button"
          onClick={onClearFinish}
          className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Default Finish
        </button>
      )}
    </div>
  );
};
