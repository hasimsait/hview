import { ensureLocalMetricBounds,ensureStretchedUvs } from '../geometry/UVProjector';
import { BrowserCanvasFactory,type CanvasFactory } from './CanvasFactory';
import { OcclusionShader, keepForegroundVisible } from './OcclusionShader';
import { CoatingTextureStrategy } from './strategies/CoatingTextureStrategy';
import { FabricTextureStrategy } from './strategies/FabricTextureStrategy';
import { GlassTextureStrategy } from './strategies/GlassTextureStrategy';
import { SlatTextureStrategy } from './strategies/SlatTextureStrategy';
import { TileTextureStrategy } from './strategies/TileTextureStrategy';
import { WoodTextureStrategy } from './strategies/WoodTextureStrategy';
import { TextureSource } from './TextureSource';
import { mobileRendering } from '../RenderQuality';
export { ensureLocalMetricBounds,ensureStretchedUvs } from '../geometry/UVProjector';

export function isFabricStretched(config?: Pick<SurfaceFinishConfig, 'variant' | 'mappingMode'>): boolean {
  if (!config) return true;
  if (config.mappingMode === 'stretched') return true;
  if (config.mappingMode === 'tiled') return false;
  return !config.variant?.includes('linen');
}

export function getFabricScale(config?: Pick<SurfaceFinishConfig, 'variant' | 'scale'>): number {
  if (config?.scale && config.scale > 0) return config.scale;
  return config?.variant?.includes('linen') ? 3.5 : 2.0;
}

import { SurfaceFinishConfig,TileLayoutPattern } from '@core/types/plan';
import { ISurfaceFinishService } from '@core/types/services';
import { normalizeSurfaceLayer } from '@core/types/surfaceLayer';
import * as THREE from 'three';
import { ITileCatalogService } from "../../services/tile-catalog/TileCatalogService";

// ---------------------------------------------------------------------------
// Declarative Material Presets (replaces hardcoded if-else-if cascades)
// ---------------------------------------------------------------------------
interface MetalPreset {
  roughness: number;
  metalness: number;
  defaultColor: number;
}

const METAL_PRESETS: Record<string, MetalPreset> = {
  chrome_shiny: { roughness: 0.06, metalness: 0.96, defaultColor: 0xf1f5f9 },
  chrome: { roughness: 0.06, metalness: 0.96, defaultColor: 0xf1f5f9 },
  chrome_satin: { roughness: 0.20, metalness: 0.90, defaultColor: 0xe2e8f0 },
  satin: { roughness: 0.20, metalness: 0.90, defaultColor: 0xe2e8f0 },
  brass_shiny: { roughness: 0.08, metalness: 0.92, defaultColor: 0xebd48e },
  brass: { roughness: 0.08, metalness: 0.92, defaultColor: 0xebd48e },
  brass_brushed: { roughness: 0.26, metalness: 0.88, defaultColor: 0xd4b359 },
  matte_black_powder: { roughness: 0.70, metalness: 0.15, defaultColor: 0x18181b },
  black: { roughness: 0.70, metalness: 0.15, defaultColor: 0x18181b },
  matte_white_powder: { roughness: 0.70, metalness: 0.05, defaultColor: 0xf8fafc },
  white_metal: { roughness: 0.70, metalness: 0.05, defaultColor: 0xf8fafc },
  gunmetal: { roughness: 0.24, metalness: 0.88, defaultColor: 0x334155 },
  copper_brushed: { roughness: 0.26, metalness: 0.88, defaultColor: 0xc27852 },
  copper: { roughness: 0.26, metalness: 0.88, defaultColor: 0xc27852 },
};
const DEFAULT_METAL_PRESET: MetalPreset = { roughness: 0.06, metalness: 0.96, defaultColor: 0xf1f5f9 };

interface GlassPreset {
  defaultColor: number;
  opacity: number;
  roughness: number;
  metalness: number;
  transmission: number;
  depthWrite: boolean;
}

const GLASS_PRESETS: Record<string, GlassPreset> = {
  frosted_mica: {
    defaultColor: 0xf8fafc,
    opacity: 0.82,
    roughness: 0.65,
    metalness: 0.04,
    transmission: 0.30,
    depthWrite: true,
  },
  frosted: {
    defaultColor: 0xf1f5f9,
    opacity: 0.75,
    roughness: 0.55,
    metalness: 0.05,
    transmission: 0.40,
    depthWrite: true,
  },
  fluted: {
    defaultColor: 0xe2e8f0,
    opacity: 0.70,
    roughness: 0.30,
    metalness: 0.08,
    transmission: 0.50,
    depthWrite: true,
  },
  smoked: {
    defaultColor: 0x334155,
    opacity: 0.60,
    roughness: 0.12,
    metalness: 0.10,
    transmission: 0.45,
    depthWrite: false,
  },
  clear: {
    defaultColor: 0xd8eeff,
    opacity: 0.35,
    roughness: 0.05,
    metalness: 0.10,
    transmission: 0.85,
    depthWrite: false,
  },
};
const DEFAULT_GLASS_PRESET: GlassPreset = GLASS_PRESETS.clear;

const PORCELAIN_PRESETS: Record<string, { roughness: number; metalness: number; defaultColor: number }> = {
  porcelain_matte: { roughness: 0.45, metalness: 0.02, defaultColor: 0xf8fafc },
  ceramic_white: { roughness: 0.04, metalness: 0.02, defaultColor: 0xffffff },
};

export class SurfaceMaterialFactory implements ISurfaceFinishService {
  private readonly mobile = mobileRendering();
  private layerMaterials = new Map<THREE.Material, number>();
  ensureLocalMetricBounds(mesh: THREE.Mesh): void {
    ensureLocalMetricBounds(mesh);
  }

  ensureStretchedUvs(mesh: THREE.Mesh): void {
    ensureStretchedUvs(mesh);
  }


  private materials: Map<string, THREE.Material> = new Map();

  private readonly tileTextureStrategy: TileTextureStrategy;
  private readonly slatTextureStrategy: SlatTextureStrategy;
  private readonly woodTextureStrategy: WoodTextureStrategy;
  private readonly coatingTextureStrategy: CoatingTextureStrategy;
  private readonly fabricTextureStrategy: FabricTextureStrategy;
  private readonly glassTextureStrategy: GlassTextureStrategy;

  private readonly shader = new OcclusionShader();
  private unsubscribeCatalog?: () => void;

  constructor(private readonly tileCatalog?: ITileCatalogService, canvas: CanvasFactory = new BrowserCanvasFactory(), readonly textures = new TextureSource()) {
    this.tileTextureStrategy = new TileTextureStrategy(canvas, tileCatalog, textures);
    this.slatTextureStrategy = new SlatTextureStrategy(canvas);
    this.woodTextureStrategy = new WoodTextureStrategy(canvas, textures);
    this.coatingTextureStrategy = new CoatingTextureStrategy(canvas);
    this.fabricTextureStrategy = new FabricTextureStrategy(canvas, textures);
    this.glassTextureStrategy = new GlassTextureStrategy(canvas);
    this.unsubscribeCatalog = this.tileCatalog?.onCatalogLoaded(() => {
      let evicted = false;
      for (const [key, mat] of [...this.materials.entries()]) {
        if (key.startsWith('tile_')) {
          this.materials.delete(key);
          this.layerMaterials.delete(mat);
          evicted = true;
        }
      }
      if (evicted) this.textures.notify();
    });
  }

  getTileTexture(variant: string = 'subway'): THREE.Texture { return this.tileTextureStrategy.getTileTexture(variant); }
  getLambriTexture(variant: string = 'oak_slats', slatColor?: string, backingColor?: string): THREE.Texture { return this.slatTextureStrategy.getLambriTexture(variant, slatColor, backingColor); }
  resolveWoodPhotoInfo(variant?: string): { url: string; name: string } { return this.woodTextureStrategy.resolveWoodPhotoInfo(variant); }
  getWoodTexture(variant: string = 'natural_oak'): THREE.Texture { return this.woodTextureStrategy.getWoodTexture(variant); }
  getPlasterTexture(variant: string = 'stucco'): THREE.Texture { return this.coatingTextureStrategy.getPlasterTexture(variant); }
  getClipInCeilingTexture(): THREE.Texture { return this.coatingTextureStrategy.getClipInCeilingTexture(); }
  resolveFabricPhotoInfo(variant?: string, color?: string): { url: string; isPreColored: boolean } { return this.fabricTextureStrategy.resolveFabricPhotoInfo(variant, color); }
  getFabricTexture(variant: string = 'velvet_plush', color?: string): THREE.Texture { return this.fabricTextureStrategy.getFabricTexture(variant, color); }
  getGlassTexture(variant: string = 'clear'): THREE.Texture | null { return this.glassTextureStrategy.getGlassTexture(variant); }

  updateOrbitPlane(center: THREE.Vector3, direction: THREE.Vector3): void { this.shader.updateOrbitPlane(center, direction); }
  setForegroundMode(mode: 'off' | 'transparent' | 'clip'): void { this.shader.setForegroundMode(mode); }
  setForegroundOpacity(value: number): void { this.shader.setForegroundOpacity(value); }
  dispose(): void {
    this.unsubscribeCatalog?.();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear(); this.layerMaterials.clear();
    this.tileTextureStrategy.dispose();
    this.slatTextureStrategy.dispose();
    this.woodTextureStrategy.dispose();
    this.coatingTextureStrategy.dispose();
    this.fabricTextureStrategy.dispose();
    this.glassTextureStrategy.dispose();
  }

  private getGroutWidthForVariant(variant?: string): number {
    if (!variant) return 2;
    const entry = this.tileCatalog?.getById(variant);
    if (entry && this.tileCatalog) return this.tileCatalog.getDefaultGroutWidth(entry);
    // Fallback for unrecognised variants
    return variant === 'square' || variant === 'subway' ? 1 : 2;
  }

  applyOutlineOcclusion(material: THREE.LineBasicMaterial): void {
    this.shader.applyOutline(material);
  }

  getMaterial(
    config: SurfaceFinishConfig,
    options?: { side?: THREE.Side; depthWrite?: boolean; projection?: 'world' | 'local'; foregroundOcclusion?: boolean }
  ): THREE.Material {
    const side = options?.side ?? THREE.FrontSide;
    const depthWrite = options?.depthWrite ?? true;
    const projection = options?.projection ?? 'world';
    const rotation = config.rotation || 0;
    const tileEntry = config.type === 'tile' ? this.tileCatalog?.getById(config.variant ?? '') : undefined;
    const pattern: TileLayoutPattern = config.pattern || (tileEntry && this.tileCatalog ? this.tileCatalog.getDefaultPattern(tileEntry) : 'grid');
    const groutWidth = config.type === 'tile' ? (config.groutWidth ?? this.getGroutWidthForVariant(config.variant)) : 0;
    const groutColor = config.type === 'tile' ? (config.groutColor || '#d1d5db') : '#000000';
    const roughnessStr = config.roughness !== undefined ? `r${config.roughness}` : 'rdef';
    const metalnessStr = config.metalness !== undefined ? `m${config.metalness}` : 'mdef';
    const mappingModeStr = config.mappingMode || 'def';
    const scaleStr = config.scale !== undefined ? `s${config.scale}` : 'sdef';
    const backingColorStr = config.backingColor ? `b${config.backingColor}` : 'bdef';
    const layer = normalizeSurfaceLayer(config.layer);
    const key = `${config.type}_${config.variant || 'default'}_${config.color || 'none'}_${backingColorStr}_${roughnessStr}_${metalnessStr}_${rotation}_${pattern}_${groutWidth}_${groutColor}_${mappingModeStr}_${scaleStr}_${side}_${depthWrite}_${projection}_${layer}_${options?.foregroundOcclusion !== false}`;

    if (this.materials.has(key)) {
      return this.materials.get(key)!;
    }

    let mat: THREE.Material;

    if (config.type === 'invisible' || config.color === 'invisible' || config.variant === 'invisible') {
      mat = new THREE.MeshBasicMaterial({
        visible: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      });
      (mat as any).isInvisible = true;
    } else if (config.type === 'glass') {
      const variant = config.variant || 'clear';
      const texture = this.getGlassTexture(variant);
      const preset = GLASS_PRESETS[variant] || DEFAULT_GLASS_PRESET;

      const colorVal = config.color ? new THREE.Color(config.color).getHex() : preset.defaultColor;
      const opacity = preset.opacity;
      const roughness = config.roughness ?? preset.roughness;
      const metalness = config.metalness ?? preset.metalness;
      // Apply the budget at creation as well as initial scene preparation, so
      // choosing a new glass finish cannot re-enable a transmission render pass.
      const transmission = this.mobile ? 0 : preset.transmission;
      const depthWrite = options?.depthWrite ?? preset.depthWrite;

      const physParams: THREE.MeshPhysicalMaterialParameters = {
        color: new THREE.Color(colorVal),
        transparent: true,
        opacity,
        roughness,
        metalness,
        transmission,
        ior: 1.52,
        side,
        depthWrite,
      };

      if (texture) {
        physParams.map = texture;
        physParams.roughnessMap = texture;
      }

      const physMat = new THREE.MeshPhysicalMaterial(physParams);
      const tilingScale = this.getTilingScale(config);
      this.shader.apply(physMat as any, tilingScale, projection, rotation, groutWidth, groutColor);
      mat = physMat;
    } else {
      let texture: THREE.Texture | null = null;
      let roughness = config.roughness ?? 0.85;
      let metalness = config.metalness ?? 0.05;
      let defaultColor = 0xefede8;

      switch (config.type) {
        case 'metal': {
          const preset = METAL_PRESETS[config.variant || ''] || DEFAULT_METAL_PRESET;
          roughness = config.roughness ?? preset.roughness;
          metalness = config.metalness ?? preset.metalness;
          defaultColor = preset.defaultColor;
          break;
        }
        case 'porcelain': {
          const preset = PORCELAIN_PRESETS[config.variant || ''] || PORCELAIN_PRESETS.ceramic_white;
          roughness = config.roughness ?? preset.roughness;
          metalness = config.metalness ?? preset.metalness;
          defaultColor = preset.defaultColor;
          break;
        }
        case 'tile': {
          texture = this.getTileTexture(config.variant);
          const tileEntry = this.tileCatalog?.getById(config.variant ?? '');
          if (tileEntry) {
            roughness = config.roughness ?? tileEntry.roughness;
            metalness = config.metalness ?? (tileEntry.metalness ?? 0.05);
          } else {
            roughness = config.roughness ?? 0.2;
            metalness = config.metalness ?? 0.1;
          }
          defaultColor = 0xffffff;
          break;
        }
        case 'lambri':
          texture = this.getLambriTexture(config.variant, config.color, config.backingColor);
          roughness = 0.55;
          metalness = 0.02;
          defaultColor = 0xffffff;
          break;
        case 'wood':
          texture = this.getWoodTexture(config.variant);
          roughness = config.variant?.startsWith('parquet') ? (config.roughness ?? 0.35) : (config.roughness ?? 0.45);
          metalness = config.variant?.startsWith('parquet') ? 0.05 : 0.02;
          defaultColor = 0xffffff;
          break;
        case 'plaster':
          texture = this.getPlasterTexture(config.variant);
          roughness = 0.9;
          break;
        case 'fabric': {
          texture = this.getFabricTexture(config.variant, config.color);
          roughness = config.roughness ?? 0.82;
          metalness = config.metalness ?? 0.02;
          defaultColor = 0xffffff;
          break;
        }
        case 'ceiling':
          texture = this.getClipInCeilingTexture();
          roughness = 0.3;
          metalness = 0.25;
          defaultColor = 0xf1f5f9;
          break;
        case 'paint':
          metalness = config.metalness ?? 0;
          roughness = config.roughness ?? 0.85;
          break;
        default:
          roughness = 0.85;
          break;
      }

      const color = config.color ? new THREE.Color(config.color) : new THREE.Color(defaultColor);

      if (config.type === 'porcelain') {
        const physMat = new THREE.MeshPhysicalMaterial({
          color,
          roughness,
          metalness,
          clearcoat: 1.0,
          clearcoatRoughness: 0.02,
          side,
          transparent: true,
          depthWrite,
        });
        const tilingScale = this.getTilingScale(config);
        this.shader.apply(physMat as any, tilingScale, projection, rotation, groutWidth, groutColor, 1, pattern);
        mat = physMat;
      } else if (config.type === 'fabric') {
        const photoInfo = this.resolveFabricPhotoInfo(config.variant, config.color);
        const isLinen = config.variant?.includes('linen');
        const isVelvet = !config.variant || !isLinen;
        const isStretched = isFabricStretched(config);

        // When pre-colored (e.g. ruby red, emerald green), use pure white so the photograph's rich saturated colors & baked reflections are uncrushed.
        // Otherwise, tint with the requested color.
        const effectiveColor = photoInfo.isPreColored
          ? new THREE.Color(0xffffff)
          : (config.color ? new THREE.Color(config.color) : new THREE.Color(0xffffff));

        const sheenColor = isVelvet
          ? (config.color && !photoInfo.isPreColored ? new THREE.Color(config.color).offsetHSL(0, 0.05, 0.15) : new THREE.Color(0xffffff))
          : new THREE.Color(0xd1d5db);

        const physMat = new THREE.MeshPhysicalMaterial({
          color: effectiveColor,
          map: texture,
          roughness,
          metalness,
          sheen: isVelvet ? 0.75 : 0.25,
          sheenColor,
          sheenRoughness: isVelvet ? 0.4 : 0.6,
          side,
          transparent: true,
          depthWrite,
        });
        if (texture) {
          physMat.roughnessMap = texture;
        }
        const tilingScale = this.getTilingScale(config);
        this.shader.apply(physMat as any, tilingScale, projection, rotation, 0, '#000000', 1, 'grid', new THREE.Vector2(50, 50), isStretched);
        mat = physMat;
      } else {
        const stdMat = new THREE.MeshStandardMaterial({
          color,
          map: texture,
          roughness,
          metalness,
          side,
          transparent: true,
          depthWrite,
        });
        const tilingScale = this.getTilingScale(config);
        const entry = config.type === 'tile' ? this.tileCatalog?.getById(config.variant ?? '') : undefined;
        const numVariants = entry && entry.textures.length > 0 ? entry.textures.length : 1;
        const tileDimsCm = entry && this.tileCatalog ? this.tileCatalog.getDimensionsCm(entry) : new THREE.Vector2(60, 60);
        this.shader.apply(stdMat, tilingScale, projection, rotation, groutWidth, groutColor, numVariants, pattern, tileDimsCm);
        mat = stdMat;
      }
    }

    // Compress the layer labels into adjacent ranks. Large integer gaps must
    // not create large depth shifts that hide physically nearer geometry.
    this.layerMaterials.set(mat, layer);
    const layers = [...new Set([0, ...this.layerMaterials.values()])].sort((a, b) => a - b);
    const zero = layers.indexOf(0);
    for (const [material, priority] of this.layerMaterials) {
      const rank = layers.indexOf(priority) - zero;
      material.polygonOffset = rank !== 0;
      material.polygonOffsetFactor = -rank;
      material.polygonOffsetUnits = -4 * rank;
    }
    mat.addEventListener('dispose', () => {
      if (this.materials.get(key) === mat) this.materials.delete(key);
      this.layerMaterials.delete(mat);
    });
    if (options?.foregroundOcclusion === false) keepForegroundVisible(mat);
    this.materials.set(key, mat);
    return mat;
  }

  private getTilingScale(config: SurfaceFinishConfig): THREE.Vector2 {
    switch (config.type) {
      case 'metal':
      case 'porcelain':
        return new THREE.Vector2(1.0, 1.0);
      case 'glass':
        if (config.variant === 'fluted') {
          return new THREE.Vector2(4.0, 1.0);
        }
        if (config.variant === 'frosted_mica' || config.variant === 'frosted') {
          return new THREE.Vector2(2.5, 2.5);
        }
        return new THREE.Vector2(1.0, 1.0);
      case 'lambri':
        if (config.variant === 'fluted_panel' || config.variant === 'fluted_cabinet') {
          return new THREE.Vector2(1.0 / 0.8, 1.0 / 0.8); // 14 flutes across 0.8m cabinet width
        }
        // Standard acoustic slat panel: 16 slats per 0.5m panel (each slat ~2.5-3cm)
        return new THREE.Vector2(2.0, 2.0); // 1 repeat per 0.5m = 2.0 repeats/m
      case 'tile': {
        // Derive scale directly from catalog dimensions — no per-tile hardcoding.
        const entry = this.tileCatalog?.getById(config.variant ?? '');
        if (entry && this.tileCatalog) return this.tileCatalog.getTilingScale(entry);
        // Unknown variant: fall back to 60x60 cm
        return new THREE.Vector2(1.0 / 0.60, 1.0 / 0.60);
      }
      case 'ceiling':
        // 4 x 60cm clip-in ceiling tiles per 2.4m
        return new THREE.Vector2(1.0 / 2.4, 1.0 / 2.4); // 60x60cm panels
      case 'fabric': {
        if (isFabricStretched(config)) {
          return new THREE.Vector2(1.0, 1.0);
        }
        const rep = getFabricScale(config);
        return new THREE.Vector2(rep, rep);
      }
      case 'wood':
        return new THREE.Vector2(1.0, 1.0); // 1m plank pattern repeat
      case 'plaster':
        return new THREE.Vector2(1.25, 1.25); // 0.8m stucco texture repeat
      default:
        return new THREE.Vector2(1.0, 1.0);
    }
  }
}
