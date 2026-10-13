import * as THREE from 'three';
import { SurfaceFinishConfig, TileLayoutPattern } from '@core/types/plan';
import { ISurfaceFinishService } from '@core/types/services';
import { ITileCatalogService, TileEntry } from '@services/tile-catalog/TileCatalogService';

const TILE_PATTERN_ENUM: Record<TileLayoutPattern, number> = {
  grid: 0,
  running_bond: 1,
  diagonal_herringbone: 2,
  herringbone: 3,
  french_pattern: 4,
  vertical_stack: 5,
};

// ---------------------------------------------------------------------------
// Missing-asset checkerboard — rendered when a declared texture URL 404s.
// ---------------------------------------------------------------------------
function makeMissingAssetTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  ctx.fillStyle = '#ff00ff'; // magenta
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function ensureLocalMetricBounds(mesh: THREE.Mesh): void {
  const geom = mesh.geometry;
  if (!geom) return;

  // Always preserve original normalized UVs before modifying, if not saved yet
  if (!geom.userData.__originalUvs && geom.attributes.uv) {
    geom.userData.__originalUvs = geom.attributes.uv.clone();
  }

  if (geom.userData?.__metricUvApplied) return;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const min = geom.boundingBox?.min;
  const max = geom.boundingBox?.max;
  if (!min || !max || !geom.attributes.position || !geom.attributes.normal || !geom.attributes.uv) return;

  const uv = geom.attributes.uv;
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const count = uv.count;

  for (let i = 0; i < count; i++) {
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);

    if (ny >= 0.707) {
      // Top or bottom face (e.g. countertop surface) — anchor to corner (0, 0)
      uv.setXY(i, px - min.x, pz - min.z);
    } else if (nz >= 0.707) {
      // Front or back face — anchor to bottom-left corner (0, 0)
      uv.setXY(i, px - min.x, py - min.y);
    } else {
      // Side face — anchor to bottom-front corner (0, 0)
      uv.setXY(i, pz - min.z, py - min.y);
    }
  }
  uv.needsUpdate = true;
  geom.userData.__metricUvApplied = true;
  geom.userData.__stretchedUvApplied = false;

  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = min.x;
    arr[i * 3 + 1] = min.y;
    arr[i * 3 + 2] = min.z;
  }
  geom.setAttribute('localMetricOffset', new THREE.BufferAttribute(arr, 3));
}

export function ensureStretchedUvs(mesh: THREE.Mesh): void {
  const geom = mesh.geometry;
  if (!geom) return;
  if (!geom.attributes.uv || !geom.attributes.position || !geom.attributes.normal) return;

  // 1. If original normalized [0, 1] UVs were saved (e.g. standard Three.js BoxGeometry), restore them
  if (geom.userData?.__originalUvs) {
    geom.setAttribute('uv', geom.userData.__originalUvs.clone());
    geom.userData.__metricUvApplied = false;
    geom.userData.__stretchedUvApplied = true;
    return;
  }

  // 2. Otherwise compute normalized bounding-box UVs [0, 1] across each face to stretch edge-to-edge
  if (!geom.boundingBox) geom.computeBoundingBox();
  const min = geom.boundingBox?.min;
  const max = geom.boundingBox?.max;
  if (!min || !max) return;

  const uv = geom.attributes.uv;
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const count = uv.count;

  const dx = Math.max(0.0001, max.x - min.x);
  const dy = Math.max(0.0001, max.y - min.y);
  const dz = Math.max(0.0001, max.z - min.z);

  for (let i = 0; i < count; i++) {
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);

    if (ny >= 0.707) {
      // Top or bottom face — stretched from 0 to 1 across (X, Z)
      uv.setXY(i, (px - min.x) / dx, (pz - min.z) / dz);
    } else if (nz >= 0.707) {
      // Front or back face — stretched from 0 to 1 across (X, Y)
      uv.setXY(i, (px - min.x) / dx, (py - min.y) / dy);
    } else {
      // Side face — stretched from 0 to 1 across (Z, Y)
      uv.setXY(i, (pz - min.z) / dz, (py - min.y) / dy);
    }
  }
  uv.needsUpdate = true;
  geom.userData.__metricUvApplied = false;
  geom.userData.__stretchedUvApplied = true;
}

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

export class SurfaceFinishService implements ISurfaceFinishService {
  ensureLocalMetricBounds(mesh: THREE.Mesh): void {
    ensureLocalMetricBounds(mesh);
  }

  ensureStretchedUvs(mesh: THREE.Mesh): void {
    ensureStretchedUvs(mesh);
  }

  private textures: Map<string, THREE.Texture> = new Map();
  private materials: Map<string, THREE.Material> = new Map();

  private occlusionUniforms = {
    uOrbitCenter: { value: new THREE.Vector3(0, 0, 0) },
    uCameraDir: { value: new THREE.Vector3(0, 0, 1) },
    uForegroundMode: { value: 1 }, // 0 = off, 1 = transparent, 2 = clip
    uForegroundOpacity: { value: 0.15 },
  };

  constructor(private readonly tileCatalog?: ITileCatalogService) {}

  private getGroutWidthForVariant(variant?: string): number {
    if (!variant) return 2;
    const entry = this.tileCatalog?.getById(variant);
    if (entry && this.tileCatalog) return this.tileCatalog.getDefaultGroutWidth(entry);
    // Fallback for unrecognised variants
    return variant === 'square' || variant === 'subway' ? 1 : 2;
  }

  getMaterial(
    config: SurfaceFinishConfig,
    options?: { side?: THREE.Side; depthWrite?: boolean; projection?: 'world' | 'local' }
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
    const key = `${config.type}_${config.variant || 'default'}_${config.color || 'none'}_${backingColorStr}_${roughnessStr}_${metalnessStr}_${rotation}_${pattern}_${groutWidth}_${groutColor}_${mappingModeStr}_${scaleStr}_${side}_${depthWrite}_${projection}`;

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
      const transmission = preset.transmission;
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
      this.applyOcclusionShader(physMat as any, tilingScale, projection, rotation, groutWidth, groutColor);
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
          const photoInfo = this.resolveFabricPhotoInfo(config.variant, config.color);
          texture = this.getFabricTexture(config.variant, config.color);
          roughness = config.roughness ?? 0.82;
          metalness = config.metalness ?? 0.02;
          defaultColor = photoInfo.isPreColored ? 0xffffff : 0xffffff;
          break;
        }
        case 'ceiling':
          texture = this.getClipInCeilingTexture();
          roughness = 0.3;
          metalness = 0.25;
          defaultColor = 0xf1f5f9;
          break;
        case 'paint':
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
        this.applyOcclusionShader(physMat as any, tilingScale, projection, rotation, groutWidth, groutColor, 1, pattern);
        mat = physMat;
      } else if (config.type === 'fabric') {
        const photoInfo = this.resolveFabricPhotoInfo(config.variant, config.color);
        const isLinen = config.variant?.includes('linen');
        const isVelvet = !config.variant || !isLinen;

        // 1. Explicit config.mappingMode takes highest priority
        // 2. Default: Natural Woven Linen defaults to tiled ('tiled'), Velvet defaults to stretched ('stretched')
        const isStretched = config.mappingMode === 'stretched'
          ? true
          : config.mappingMode === 'tiled'
            ? false
            : !isLinen;

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
        this.applyOcclusionShader(physMat as any, tilingScale, projection, rotation, 0, '#000000', 1, 'grid', new THREE.Vector2(50, 50), isStretched);
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
        this.applyOcclusionShader(stdMat, tilingScale, projection, rotation, groutWidth, groutColor, numVariants, pattern, tileDimsCm);
        mat = stdMat;
      }
    }

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
        const isLinen = config.variant?.includes('linen');
        const isStretched = config.mappingMode === 'stretched'
          ? true
          : config.mappingMode === 'tiled'
            ? false
            : !isLinen;

        if (isStretched) {
          return new THREE.Vector2(1.0, 1.0);
        }
        // Tiled mode: Linen defaults to 3.5 repeats/m (~28cm repeat for fine organic weave)
        // User config.scale overrides default repeat if provided
        const defaultRepeat = isLinen ? 3.5 : 2.0;
        const rep = (config.scale && config.scale > 0) ? config.scale : defaultRepeat;
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

  getTileTexture(variant: string = 'subway'): THREE.Texture {
    const key = `tile_${variant}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    const entry = this.tileCatalog?.getById(variant);

    // ── Catalog entry with declared texture file(s) ──────────────────────────
    if (entry && entry.textures.length > 0) {
      if (entry.textures.length === 1) {
        // Single texture: load directly
        const url = entry.textures[0];
        const loader = new THREE.TextureLoader();
        const tex = loader.load(
          url,
          (loaded) => {
            loaded.wrapS = THREE.RepeatWrapping;
            loaded.wrapT = THREE.RepeatWrapping;
            loaded.repeat.set(1, 1);
            loaded.needsUpdate = true;
          },
          undefined,
          () => {
            console.warn(`[TileCatalogService] Texture not found: ${url}`);
            const cb = makeMissingAssetTexture();
            tex.image = cb.image as any;
            tex.needsUpdate = true;
          }
        );
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 1);
        this.textures.set(key, tex);
        return tex;
      }

      // Multi-variant tile: build horizontal texture atlas
      const atlasTex = this.createTileAtlas(entry);
      this.textures.set(key, atlasTex);
      return atlasTex;
    }

    // ── Procedural / canvas-generated fallback ────────────────────────────────
    // Used for tiles declared in the catalog with textures:[] (subway, square,
    // marble, anthracite) or for any completely unknown variant id.
    if (typeof document === 'undefined') {
      const emptyTex = new THREE.Texture();
      this.textures.set(key, emptyTex);
      return emptyTex;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    if (variant === 'marble') {
      // Calacatta Marble texture
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      // Veins
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 80);
      ctx.bezierCurveTo(120, 160, 280, 40, 512, 220);
      ctx.stroke();

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(80, 0);
      ctx.bezierCurveTo(220, 240, 360, 320, 512, 480);
      ctx.stroke();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 380);
      ctx.bezierCurveTo(200, 300, 340, 440, 512, 360);
      ctx.stroke();
    } else if (variant === 'anthracite') {
      // Dark slate / anthracite natural stone tile
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 512, 512);

      // Natural slate cleft texture & layered mineral grain
      for (let i = 0; i < 30; i++) {
        const y = (i * 17) % 512;
        const h = 4 + (i % 8);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(15, 23, 42, 0.45)' : 'rgba(51, 65, 85, 0.35)';
        ctx.fillRect(0, y, 512, h);
      }
    } else if (variant === 'square') {
      // Clean square ceramic tile (15x15 cm)
      // Smooth porcelain glaze; joint lines rendered via physical grout shader
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      grad.addColorStop(0.5, 'rgba(241, 245, 249, 0.2)');
      grad.addColorStop(1, 'rgba(226, 232, 240, 0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
    } else {
      // Subway / Metro Tile (staggered bricks) — also the ultimate fallback
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      const tileH = 32;
      const tileW = 96;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;

      for (let y = 0; y <= 512; y += tileH) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();

        const offset = ((y / tileH) % 2) * (tileW / 2);
        for (let x = -tileW; x <= 512 + tileW; x += tileW) {
          ctx.beginPath();
          ctx.moveTo(x + offset, y);
          ctx.lineTo(x + offset, y + tileH);
          ctx.stroke();
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this.textures.set(key, tex);
    return tex;
  }

  private createTileAtlas(entry: TileEntry): THREE.Texture {
    const numVariants = entry.textures.length;
    const cellW = 1024;
    const cellH = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = cellW * numVariants;
    canvas.height = cellH;
    const ctx = canvas.getContext('2d')!;

    // Initial background matching tile base color
    ctx.fillStyle = entry.color || '#ded8cc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const atlasTexture = new THREE.CanvasTexture(canvas);
    atlasTexture.wrapS = THREE.RepeatWrapping;
    atlasTexture.wrapT = THREE.RepeatWrapping;
    atlasTexture.repeat.set(1, 1);
    atlasTexture.colorSpace = THREE.SRGBColorSpace;
    atlasTexture.minFilter = THREE.LinearFilter;
    atlasTexture.generateMipmaps = false;

    const loader = new THREE.ImageLoader();
    entry.textures.forEach((url, idx) => {
      loader.load(
        url,
        (image) => {
          ctx.drawImage(image, idx * cellW, 0, cellW, cellH);
          atlasTexture.needsUpdate = true;
        },
        undefined,
        () => {
          console.warn(`[TileCatalogService] Variant texture missing: ${url}`);
          this.drawCheckerboard(ctx, idx * cellW, 0, cellW, cellH);
          atlasTexture.needsUpdate = true;
        }
      );
    });

    return atlasTexture;
  }

  private drawCheckerboard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const cols = 16;
    const rows = 16;
    const stepX = w / cols;
    const stepY = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ff00ff' : '#000000';
        ctx.fillRect(x + c * stepX, y + r * stepY, Math.ceil(stepX), Math.ceil(stepY));
      }
    }
  }

  resolveWoodPhotoInfo(variant?: string): { url: string; name: string } {
    const v = (variant || '').toLowerCase();
    if (v.includes('wenge') || v.includes('black_oak') || v.includes('dark_oak')) {
      return { url: '/textures/wood/wood_dark_wenge.jpg', name: 'Dark Wenge' };
    }
    if (v.includes('walnut') || v.includes('dark_walnut')) {
      if (v.includes('smoked')) {
        return { url: '/textures/wood/wood_smoked_walnut.jpg', name: 'Smoked Walnut' };
      }
      return { url: '/textures/wood/wood_american_walnut.jpg', name: 'American Walnut' };
    }
    if (v.includes('teak') || v.includes('golden_teak')) {
      return { url: '/textures/wood/wood_golden_teak.jpg', name: 'Golden Teak' };
    }
    if (v.includes('birch') || v.includes('white_oak') || v.includes('bleached')) {
      return { url: '/textures/wood/wood_bleached_birch.jpg', name: 'Bleached Birch' };
    }
    if (v.includes('smoked') || v.includes('ash_smoked')) {
      return { url: '/textures/wood/wood_smoked_walnut.jpg', name: 'Smoked Walnut' };
    }
    if (v.includes('ash') || v.includes('light_ash')) {
      return { url: '/textures/wood/wood_light_ash.jpg', name: 'Light Ash' };
    }
    return { url: '/textures/wood/wood_natural_oak.jpg', name: 'Natural Oak' };
  }

  getLambriTexture(
    variant: string = 'oak_slats',
    slatColor?: string,
    backingColor?: string
  ): THREE.Texture {
    const key = `lambri_${variant}_${slatColor || 'def'}_${backingColor || 'def'}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // 1. Acoustic felt backing / background
    const effectiveBackingColor =
      backingColor ||
      (variant === 'fluted_panel' || variant === 'fluted_cabinet' ? '#1c2421' : '#141416');
    ctx.fillStyle = effectiveBackingColor;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle acoustic felt micro-texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let i = 0; i < 280; i++) {
      const rx = (i * 37) % 512;
      const ry = (i * 73) % 512;
      ctx.fillRect(rx, ry, 1.5, 1.5);
    }

    if (variant === 'fluted_panel' || variant === 'fluted_cabinet') {
      // Modern Fluted Vanity Cabinet Panel (Vertical slats with top horizontal accent groove)
      const numFlutes = 14;
      const step = 512 / numFlutes;
      const grooveW = 4;
      const fluteColor = slatColor || '#3a4843';

      ctx.fillStyle = fluteColor;
      ctx.fillRect(0, 0, 512, 512);

      for (let i = 0; i <= numFlutes; i++) {
        const x = i * step;
        ctx.fillStyle = effectiveBackingColor;
        ctx.fillRect(x - grooveW / 2, 0, grooveW, 512);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.fillRect(x + grooveW / 2, 0, 1.5, 512);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x + step - grooveW / 2 - 1.5, 0, 1.5, 512);
      }

      const topGrooveY = 75;
      ctx.fillStyle = effectiveBackingColor;
      ctx.fillRect(0, topGrooveY - 2, 512, 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(0, topGrooveY + 2, 512, 1.5);
    } else if (variant === 'beadboard') {
      // Classic Beadboard Slats
      const step = 32;
      const boardColor = slatColor || '#f8fafc';
      ctx.fillStyle = boardColor;
      ctx.fillRect(0, 0, 512, 512);

      for (let x = 0; x < 512; x += step) {
        ctx.fillStyle = effectiveBackingColor;
        ctx.fillRect(x - 1, 0, 2, 512);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x + 1, 0, 1, 512);
      }
    } else {
      // Modern Architectural Acoustic Timber Slats (Walnut, Oak, Teak, Ash, Wenge, etc.)
      const slatW = 22;
      const gapW = 10;
      const step = slatW + gapW;

      // Determine slat color
      let slatHex = slatColor;
      if (!slatHex) {
        if (variant === 'walnut' || variant === 'walnut_slats') {
          slatHex = '#543f31'; // Rich American Walnut
        } else if (variant === 'teak' || variant === 'teak_slats') {
          slatHex = '#946132'; // Golden Teak
        } else if (variant === 'wenge' || variant === 'wenge_slats' || variant === 'black_oak') {
          slatHex = '#27201b'; // Dark Wenge
        } else if (variant === 'ash' || variant === 'ash_slats' || variant === 'smoked_walnut') {
          slatHex = '#5a4e44'; // Smoked Ash / Walnut
        } else if (variant === 'birch' || variant === 'white_oak' || variant === 'light') {
          slatHex = '#dfcfb6'; // Bleached Birch / White Oak
        } else if (variant === 'white' || variant === 'white_slat') {
          slatHex = '#f8fafc'; // Crisp White Painted Slat
        } else {
          slatHex = '#d4b996'; // Scandinavian Natural Oak
        }
      }

      for (let x = 0; x < 512; x += step) {
        // Drop shadow onto backing felt inside gap
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(x + slatW, 0, 5, 512);

        // Slat solid body
        ctx.fillStyle = slatHex;
        ctx.fillRect(x, 0, slatW, 512);

        // Subtle organic wood grain streaks along slat height
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(x + 5, 0, 2, 512);
        ctx.fillRect(x + 14, 0, 1.5, 512);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(x + 9, 0, 1.5, 512);

        // 3D Bevel Edge Highlights & Shadows
        // Left bevel light reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(x, 0, 2, 512);

        // Right bevel dark corner shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x + slatW - 2, 0, 2, 512);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this.textures.set(key, tex);
    return tex;
  }

  getWoodTexture(variant: string = 'natural_oak'): THREE.Texture {
    if (variant?.startsWith('parquet') || variant === 'parquet') {
      const key = `wood_parquet_${variant}`;
      if (this.textures.has(key)) return this.textures.get(key)!;

      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;

      if (variant === 'parquet_herringbone') {
        // Classic interlocking herringbone oak parquet pattern
        ctx.fillStyle = '#dfcfb8';
        ctx.fillRect(0, 0, 1024, 1024);

        const plankW = 64;
        const plankL = 192;
        ctx.lineWidth = 1.5;

        for (let y = -plankL; y < 1024 + plankL; y += plankW) {
          for (let x = -plankL; x < 1024 + plankL; x += plankL) {
            const row = Math.floor(y / plankW);
            const col = Math.floor(x / plankL);
            const seed = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
            const varTone = Math.floor((seed - Math.floor(seed)) * 24) - 12;

            const r = Math.min(255, Math.max(0, 218 + varTone));
            const g = Math.min(255, Math.max(0, 198 + varTone));
            const b = Math.min(255, Math.max(0, 170 + varTone));
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, plankL, plankW);

            ctx.fillStyle = `rgba(${r - 25}, ${g - 25}, ${b - 25}, 0.25)`;
            for (let gIdx = 0; gIdx < 4; gIdx++) {
              const gy = y + 8 + gIdx * 14;
              ctx.fillRect(x, gy, plankL, 1.5);
            }

            ctx.strokeStyle = 'rgba(120, 95, 70, 0.4)';
            ctx.strokeRect(x, y, plankL, plankW);
          }
        }
      } else {
        // Staggered architectural plank parquet (running bond)
        let baseR = 223, baseG = 207, baseB = 184; // Scandinavian oak
        if (variant === 'parquet_walnut') {
          baseR = 74; baseG = 56; baseB = 42; // Deep dark walnut
        } else if (variant === 'parquet_light') {
          baseR = 240; baseG = 236; baseB = 225; // Bleached ash / white oak
        }

        ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
        ctx.fillRect(0, 0, 1024, 1024);

        const plankHeight = 64; // ~16 planks per meter
        const plankWidth = 256; // 4:1 aspect ratio
        ctx.lineWidth = 1.5;

        for (let y = 0; y < 1024; y += plankHeight) {
          const row = Math.floor(y / plankHeight);
          const offsetX = (row % 3) * (plankWidth / 3);

          for (let x = -plankWidth; x < 1024 + plankWidth; x += plankWidth) {
            const px = x + offsetX;
            const col = Math.floor(px / plankWidth);
            const seed = Math.sin(row * 17.3 + col * 43.7) * 43758.5453;
            const varTone = Math.floor((seed - Math.floor(seed)) * 26) - 13;

            const r = Math.min(255, Math.max(0, baseR + varTone));
            const g = Math.min(255, Math.max(0, baseG + varTone));
            const b = Math.min(255, Math.max(0, baseB + varTone));

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(px, y, plankWidth, plankHeight);

            // Subtle organic wood grain within the plank
            ctx.fillStyle = `rgba(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)}, 0.18)`;
            const numGrains = 5;
            for (let gIdx = 0; gIdx < numGrains; gIdx++) {
              const gy = y + 6 + gIdx * 11;
              const gw = plankWidth * (0.6 + ((seed * (gIdx + 1)) % 0.4));
              const gx = px + (plankWidth - gw) / 2;
              ctx.fillRect(gx, gy, gw, 1.5);
            }

            // Top highlight bevel line
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(px, y, plankWidth, 1);

            // Dark shadow micro-bevel perimeter
            ctx.strokeStyle = variant === 'parquet_walnut'
              ? 'rgba(25, 18, 12, 0.6)'
              : 'rgba(140, 115, 85, 0.45)';
            ctx.strokeRect(px, y, plankWidth, plankHeight);
          }
        }
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      this.textures.set(key, tex);
      return tex;
    }

    // Photographic Wood Veneer for Furniture & Solid Panels
    const photoInfo = this.resolveWoodPhotoInfo(variant);
    const photoUrl = photoInfo.url;
    const key = `wood_photo_${photoUrl}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    if (typeof document !== 'undefined' && typeof (document as any).createElementNS === 'function') {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(
        photoUrl,
        (loaded) => {
          loaded.wrapS = THREE.RepeatWrapping;
          loaded.wrapT = THREE.RepeatWrapping;
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.needsUpdate = true;
        },
        undefined,
        () => {
          console.warn(`[SurfaceFinishService] Wood texture not found: ${photoUrl}`);
        }
      );
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(key, tex);
      return tex;
    }

    // Procedural fallback for headless environments
    const fallbackTex = this.createProceduralWoodTexture(variant);
    this.textures.set(key, fallbackTex);
    return fallbackTex;
  }

  private createProceduralWoodTexture(variant: string = 'natural_oak'): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const baseColor = variant.includes('walnut')
      ? '#3d2f26'
      : variant.includes('teak')
        ? '#7d522a'
        : '#dfcfb8';
    const grainColor = variant.includes('walnut')
      ? '#2a1f18'
      : variant.includes('teak')
        ? '#5e3c1d'
        : '#c8b49b';

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = grainColor;
    for (let i = 0; i < 40; i++) {
      const y = (i * 13) % 512;
      const h = 2 + (i % 6);
      ctx.fillRect(0, y, 512, h);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }

  getPlasterTexture(variant: string = 'stucco'): THREE.Texture {
    const key = `plaster_${variant}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#efede8';
    ctx.fillRect(0, 0, 256, 256);

    // Stucco grain
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const alpha = Math.random() * 0.08;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this.textures.set(key, tex);
    return tex;
  }

  getClipInCeilingTexture(): THREE.Texture {
    const key = 'ceiling_clip_in';
    if (this.textures.has(key)) return this.textures.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Aluminum off-white / light slate ceiling panel color
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 512, 512);

    // 60x60 cm modular grid (4 tiles per 512px)
    const tileSize = 128;
    for (let x = 0; x < 512; x += tileSize) {
      for (let y = 0; y < 512; y += tileSize) {
        // Tile panel body
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

        // Beveled clip-in shadow border
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x, y, tileSize, 2);
        ctx.fillRect(x, y, 2, tileSize);

        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + tileSize - 2, y, 2, tileSize);
        ctx.fillRect(x, y + tileSize - 2, tileSize, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this.textures.set(key, tex);
    return tex;
  }

  resolveFabricPhotoInfo(variant?: string, color?: string): { url: string; isPreColored: boolean } {
    const v = (variant || '').toLowerCase();
    const c = (color || '').toLowerCase();

    // 1. Explicit photographic variant keys
    if (v.includes('ruby')) {
      return { url: '/textures/fabrics/velvet_ruby_red.jpg', isPreColored: true };
    }
    if (v.includes('burgundy') || v.includes('wine')) {
      return { url: '/textures/fabrics/velvet_wine_burgundy.jpg', isPreColored: true };
    }
    if (v.includes('emerald')) {
      return { url: '/textures/fabrics/velvet_emerald_green.jpg', isPreColored: true };
    }
    if (v.includes('forest')) {
      return { url: '/textures/fabrics/velvet_forest_green.jpg', isPreColored: true };
    }
    if (v.includes('navy') || v.includes('sapphire')) {
      return { url: '/textures/fabrics/velvet_royal_navy.jpg', isPreColored: true };
    }
    if (v.includes('champagne') || v.includes('ivory')) {
      return { url: '/textures/fabrics/velvet_champagne.jpg', isPreColored: true };
    }
    if (v.includes('charcoal')) {
      return { url: '/textures/fabrics/velvet_charcoal.jpg', isPreColored: true };
    }
    if (v.includes('linen')) {
      return { url: '/textures/fabrics/fabric_linen_weave.jpg', isPreColored: true };
    }
    if (v.includes('silver')) {
      return { url: '/textures/fabrics/velvet_neutral_silver.jpg', isPreColored: false };
    }

    // 2. Color-based matching for red/green/navy/champagne velvet tones
    if (c === '#8e1624' || c === '#a8202e' || c === '#731728') {
      return { url: '/textures/fabrics/velvet_ruby_red.jpg', isPreColored: true };
    }
    if (c === '#54121d') {
      return { url: '/textures/fabrics/velvet_wine_burgundy.jpg', isPreColored: true };
    }
    if (c === '#0b6654' || c === '#163832') {
      return { url: '/textures/fabrics/velvet_emerald_green.jpg', isPreColored: true };
    }
    if (c === '#1a3d2b' || c === '#234e3e') {
      return { url: '/textures/fabrics/velvet_forest_green.jpg', isPreColored: true };
    }
    if (c === '#1a2639' || c === '#1e3a5f') {
      return { url: '/textures/fabrics/velvet_royal_navy.jpg', isPreColored: true };
    }
    if (c === '#ede6d6') {
      return { url: '/textures/fabrics/velvet_champagne.jpg', isPreColored: true };
    }
    if (c === '#26282d') {
      return { url: '/textures/fabrics/velvet_charcoal.jpg', isPreColored: true };
    }

    // 3. For any other custom tint (e.g. Sage Olive, Terracotta, Greige, or hex picker),
    // use the photographic neutral silver velvet texture which blends the exact tint with photorealistic folds and reflective luster
    return { url: '/textures/fabrics/velvet_neutral_silver.jpg', isPreColored: false };
  }

  getFabricTexture(variant: string = 'velvet_plush', color?: string): THREE.Texture {
    const photoInfo = this.resolveFabricPhotoInfo(variant, color);
    const key = `fabric_photo_${photoInfo.url}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    if (typeof document !== 'undefined' && typeof (document as any).createElementNS === 'function') {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(
        photoInfo.url,
        (loaded) => {
          loaded.wrapS = THREE.RepeatWrapping;
          loaded.wrapT = THREE.RepeatWrapping;
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.needsUpdate = true;
        },
        undefined,
        () => {
          console.warn(`[SurfaceFinishService] Texture not found: ${photoInfo.url}`);
        }
      );
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(key, tex);
      return tex;
    }

    // Fallback for headless environments or canvas test runners
    const fallbackTex = this.createProceduralFabricTexture(variant);
    this.textures.set(key, fallbackTex);
    return fallbackTex;
  }

  private createProceduralFabricTexture(variant: string = 'velvet_plush'): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Neutral white fabric base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);

    if (variant === 'corduroy') {
      // Fine vertical ribbed wales
      const waleWidth = 8;
      for (let x = 0; x < 512; x += waleWidth) {
        const grad = ctx.createLinearGradient(x, 0, x + waleWidth, 0);
        grad.addColorStop(0, '#e5e7eb');
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, '#d1d5db');
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, waleWidth, 512);
      }
      for (let i = 0; i < 2000; i++) {
        const rx = Math.random() * 512;
        const ry = Math.random() * 512;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(rx, ry, 2, 1);
      }
    } else if (variant === 'linen_weave') {
      // Crisp cross-hatch warp & weft threads
      const step = 6;
      for (let x = 0; x < 512; x += step) {
        ctx.fillStyle = x % (step * 2) === 0 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(x, 0, step / 2, 512);
      }
      for (let y = 0; y < 512; y += step) {
        ctx.fillStyle = y % (step * 2) === 0 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, y, 512, step / 2);
      }
      for (let i = 0; i < 600; i++) {
        const sx = Math.random() * 512;
        const sy = Math.random() * 512;
        const slen = 4 + Math.random() * 12;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';
        ctx.fillRect(sx, sy, slen, 2);
      }
    } else if (variant === 'boucle') {
      // Curled nubby yarn clusters / loops
      for (let i = 0; i < 2500; i++) {
        const cx = Math.random() * 512;
        const cy = Math.random() * 512;
        const r = 2 + Math.random() * 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = Math.random() > 0.4 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
        ctx.fill();
      }
    } else if (variant === 'velvet_crushed') {
      // Crushed velvet directional sheen patches
      for (let i = 0; i < 120; i++) {
        const px = Math.random() * 512;
        const py = Math.random() * 512;
        const pw = 30 + Math.random() * 60;
        const ph = 20 + Math.random() * 40;
        const grad = ctx.createRadialGradient(px, py, 2, px, py, pw);
        const isBright = Math.random() > 0.5;
        grad.addColorStop(0, isBright ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(px, py, pw, ph, Math.PI * Math.random(), 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 4000; i++) {
        const rx = Math.random() * 512;
        const ry = Math.random() * 512;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(rx, ry, 1, 1);
      }
    } else {
      // velvet_plush: soft micro velvet grain
      for (let i = 0; i < 6000; i++) {
        const rx = Math.random() * 512;
        const ry = Math.random() * 512;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(rx, ry, 1, 1);
      }
      for (let i = 0; i < 40; i++) {
        const cx = Math.random() * 512;
        const cy = Math.random() * 512;
        const cr = 20 + Math.random() * 50;
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, cr);
        grad.addColorStop(0, 'rgba(255,255,255,0.06)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }

  getGlassTexture(variant: string = 'clear'): THREE.Texture | null {
    if (variant === 'clear' || variant === 'smoked') return null;
    const key = `glass_${variant}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    if (variant === 'frosted_mica') {
      // Classic frosted bathroom mica / stippled shower partition pattern
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      // Fine textured stippling background
      const imgData = ctx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 36;
        data[i] = Math.min(255, Math.max(220, 245 + noise));
        data[i + 1] = Math.min(255, Math.max(225, 248 + noise));
        data[i + 2] = Math.min(255, Math.max(230, 252 + noise));
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      // Dense stippled droplets / pebbled mica facets
      const numDroplets = 900;
      for (let i = 0; i < numDroplets; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = 1.5 + Math.random() * 3.5;

        // Droplet soft shadow
        ctx.beginPath();
        ctx.arc(x + 1, y + 1, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.fill();

        // Droplet base
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fill();

        // Specular highlight on droplet top-left
        ctx.beginPath();
        ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fill();
      }
    } else if (variant === 'frosted') {
      // Acid-etched privacy satin glass
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 512, 512);

      const imgData = ctx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 28;
        data[i] = Math.min(255, Math.max(200, 240 + noise));
        data[i + 1] = Math.min(255, Math.max(205, 243 + noise));
        data[i + 2] = Math.min(255, Math.max(210, 248 + noise));
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (variant === 'fluted') {
      // Reeded / fluted architectural glass with vertical cylindrical ribs
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      const fluteWidth = 32;
      for (let x = 0; x < 512; x += fluteWidth) {
        const grad = ctx.createLinearGradient(x, 0, x + fluteWidth, 0);
        grad.addColorStop(0, 'rgba(148, 163, 184, 0.35)');
        grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.5, 'rgba(241, 245, 249, 0.95)');
        grad.addColorStop(0.85, 'rgba(203, 213, 225, 0.5)');
        grad.addColorStop(1, 'rgba(100, 116, 139, 0.4)');

        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, fluteWidth, 512);

        ctx.fillStyle = 'rgba(71, 85, 105, 0.3)';
        ctx.fillRect(x, 0, 1, 512);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this.textures.set(key, tex);
    return tex;
  }

  updateOrbitPlane(orbitCenter: THREE.Vector3, cameraDir: THREE.Vector3): void {
    this.occlusionUniforms.uOrbitCenter.value.copy(orbitCenter);
    this.occlusionUniforms.uCameraDir.value.copy(cameraDir);
  }

  setForegroundMode(mode: 'off' | 'transparent' | 'clip'): void {
    this.occlusionUniforms.uForegroundMode.value =
      mode === 'transparent' ? 1 : mode === 'clip' ? 2 : 0;
  }

  setForegroundOpacity(opacity: number): void {
    this.occlusionUniforms.uForegroundOpacity.value = opacity < 1.0 ? opacity : 0.15;
  }

  private applyOcclusionShader(
    mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
    tilingScale: THREE.Vector2 = new THREE.Vector2(1.0, 1.0),
    projection: 'world' | 'local' = 'world',
    rotation: number = 0,
    groutWidth: number = 0,
    groutColor: string = '#d1d5db',
    numVariants: number = 1,
    pattern: TileLayoutPattern = 'grid',
    tileDimsCm: THREE.Vector2 = new THREE.Vector2(60, 60),
    isStretched: boolean = false
  ): void {
    const u = this.occlusionUniforms;
    const isLocal = projection === 'local' ? 1 : 0;
    mat.defines = {
      ...(mat.defines || {}),
      PROJECTION_LOCAL: isLocal,
      IS_STRETCHED: isStretched ? 1 : 0,
    };

    mat.customProgramCacheKey = () => {
      return `metric_${projection}_${isStretched ? 'stretched' : 'tiled'}_${tilingScale.x.toFixed(4)}_${tilingScale.y.toFixed(4)}_${rotation}_${pattern}_${groutWidth}_${groutColor}_v${numVariants}_${mat.map ? 'map' : 'nomap'}`;
    };

    mat.onBeforeCompile = (shader) => {
      const rad = (rotation * Math.PI) / 180.0;
      const uTileRot = new THREE.Vector2(Math.cos(rad), Math.sin(rad));
      const groutMeters = Math.max(0, groutWidth) * 0.001;
      const uGroutColor = new THREE.Color(groutColor);

      shader.uniforms.uOrbitCenter = u.uOrbitCenter;
      shader.uniforms.uCameraDir = u.uCameraDir;
      shader.uniforms.uForegroundMode = u.uForegroundMode;
      shader.uniforms.uForegroundOpacity = u.uForegroundOpacity;
      shader.uniforms.uTilingScale = { value: tilingScale };
      shader.uniforms.uTileRot = { value: uTileRot };
      shader.uniforms.uGroutWidth = { value: groutMeters };
      shader.uniforms.uGroutColor = { value: uGroutColor };
      shader.uniforms.uTileAtlasVariants = { value: numVariants };
      shader.uniforms.uTilePattern = { value: TILE_PATTERN_ENUM[pattern] ?? 0 };
      shader.uniforms.uTileDims = { value: new THREE.Vector2(tileDimsCm.x * 0.01, tileDimsCm.y * 0.01) };

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        attribute vec3 localMetricOffset;
        varying vec3 vCustomWorldPos;
        varying vec3 vMetricPos;
        varying vec3 vMetricNormal;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 customWPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          customWPos = instanceMatrix * customWPos;
        #endif
        vCustomWorldPos = (modelMatrix * customWPos).xyz;
        #if (PROJECTION_LOCAL == 1)
          vMetricPos = transformed - localMetricOffset;
          vMetricNormal = normal;
        #else
          vMetricPos = vCustomWorldPos;
          vec4 norm4 = vec4(normal, 0.0);
          #ifdef USE_INSTANCING
            norm4 = instanceMatrix * norm4;
          #endif
          vMetricNormal = normalize((modelMatrix * norm4).xyz);
        #endif`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform vec3  uOrbitCenter;
        uniform vec3  uCameraDir;
        uniform int   uForegroundMode;
        uniform float uForegroundOpacity;
        uniform vec2  uTilingScale;
        uniform vec2  uTileRot;
        uniform float uGroutWidth;
        uniform vec3  uGroutColor;
        uniform float uTileAtlasVariants;
        uniform int   uTilePattern;
        uniform vec2  uTileDims;
        varying vec3  vCustomWorldPos;
        varying vec3  vMetricPos;
        varying vec3  vMetricNormal;

        float hashTile(vec2 p) {
          vec2 s = sin((p + vec2(17.13, 31.41)) * vec2(127.1, 311.7)) * 43758.5453;
          return fract(sin(s.x + s.y) * 43758.5453);
        }`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          #if (IS_STRETCHED == 1)
            vec2 tileUv = clamp(vMapUv, 0.0005, 0.9995);
            vec4 sampledDiffuseColor = texture2D(map, tileUv);
            diffuseColor *= sampledDiffuseColor;
          #else
            vec2 metricUv = vMapUv;

          // If mesh lacks precomputed metric UVs, fall back to triplanar projection
          float dUvLen = length(vec2(dFdx(vMapUv.x), dFdy(vMapUv.x))) + length(vec2(dFdx(vMapUv.y), dFdy(vMapUv.y)));
          if (dUvLen <= 0.000001) {
            vec3 mNorm = normalize(vMetricNormal);
            if (abs(mNorm.y) >= 0.707) {
              metricUv = vMetricPos.xz;
            } else {
              float hLen = length(mNorm.xz);
              if (hLen > 0.001) {
                metricUv.x = (-vMetricPos.x * mNorm.z + vMetricPos.z * mNorm.x) / hLen;
              } else {
                metricUv.x = vMetricPos.x;
              }
              metricUv.y = vMetricPos.y;
            }
          }

          vec2 mPos = metricUv;
          float sRot = abs(uTileRot.y);
          if (sRot > 0.707) {
            mPos = vec2(metricUv.y, metricUv.x);
          }

          vec2 tileUv;
          vec2 hashCell;
          float distToEdge = 1000.0;

          float tileW = min(uTileDims.x, uTileDims.y);
          float tileL = max(uTileDims.x, uTileDims.y);
          if (tileW < 0.001) tileW = 1.0 / max(uTilingScale.x, uTilingScale.y);
          if (tileL < 0.001) tileL = 1.0 / min(uTilingScale.x, uTilingScale.y);
          if (tileL / tileW < 1.05 && (uTilePattern == 2 || uTilePattern == 3)) {
            tileL = tileW * 2.0;
          }

          if (uTilePattern == 1) {
            // ── 1. RUNNING BOND (Staggered 50% Brick) ──────────────────────
            vec2 uv = mPos * uTilingScale;
            float row = floor(uv.y);
            float colShift = step(0.5, mod(abs(row), 2.0)) * 0.5;
            uv.x += colShift;
            hashCell = floor(uv);
            tileUv = fract(uv);
            vec2 ed = min(tileUv, 1.0 - tileUv) / uTilingScale;
            distToEdge = min(ed.x, ed.y);
          } else if (uTilePattern == 5) {
            // ── 5. VERTICAL STACK (Upright Columns) ────────────────────────
            vec2 uv = vec2(mPos.x * uTilingScale.y, mPos.y * uTilingScale.x);
            hashCell = floor(uv);
            tileUv = fract(uv);
            vec2 ed = min(tileUv, 1.0 - tileUv) / vec2(uTilingScale.y, uTilingScale.x);
            distToEdge = min(ed.x, ed.y);
          } else if (uTilePattern == 2 || uTilePattern == 3) {
            // ── 2 & 3. HERRINGBONE (Diagonal 45° or 90°) ───────────────────
            vec2 hp = mPos;
            if (uTilePattern == 2) {
              hp = vec2((mPos.x + mPos.y) * 0.70710678, (mPos.y - mPos.x) * 0.70710678);
            }
            float uH = (hp.x - hp.y) / (2.0 * tileL);
            float vH = (hp.x + hp.y) / (2.0 * tileW);
            float kEst = floor(uH + 0.5);
            float tEst = floor(vH - uH + 0.5);
            bool found = false;
            for (int dk = -1; dk <= 1; dk++) {
              for (int dt = -2; dt <= 2; dt++) {
                if (found) break;
                float k = kEst + float(dk);
                float t = tEst + float(dt);
                float hx = t * tileW + k * (tileL + tileW);
                float hy = t * tileW + k * (tileW - tileL);
                if (hp.x >= hx && hp.x < hx + tileL && hp.y >= hy && hp.y < hy + tileW) {
                  tileUv = vec2((hp.x - hx) / tileL, (hp.y - hy) / tileW);
                  hashCell = vec2(k, t * 2.0);
                  vec2 ed = min(vec2(hp.x - hx, hp.y - hy), vec2(hx + tileL - hp.x, hy + tileW - hp.y));
                  distToEdge = min(ed.x, ed.y);
                  found = true;
                  break;
                }
                float vx = hx + tileL;
                float vy = hy + tileW - tileL;
                if (hp.x >= vx && hp.x < vx + tileW && hp.y >= vy && hp.y < vy + tileL) {
                  tileUv = vec2((hp.x - vx) / tileW, (hp.y - vy) / tileL);
                  hashCell = vec2(k, t * 2.0 + 1.0);
                  vec2 ed = min(vec2(hp.x - vx, hp.y - vy), vec2(vx + tileW - hp.x, vy + tileL - hp.y));
                  distToEdge = min(ed.x, ed.y);
                  found = true;
                  break;
                }
              }
            }
            if (!found) {
              vec2 uv = hp * uTilingScale;
              tileUv = fract(uv);
              hashCell = floor(uv);
              vec2 ed = min(tileUv, 1.0 - tileUv) / uTilingScale;
              distToEdge = min(ed.x, ed.y);
            }
          } else if (uTilePattern == 4) {
            // ── 4. FRENCH PATTERN (Versailles Non-Aligned Modular) ──────────
            float modM = tileW;
            if (modM < 0.08 || modM > 0.45) modM = 0.20;
            float period = 6.0 * modM;
            float blockRow = floor(mPos.y / period);
            vec2 fp = mPos;
            if (mod(abs(blockRow), 2.0) >= 0.5) {
              fp.x += 3.0 * modM;
            }
            vec2 blockId = floor(fp / period);
            vec2 lp = mod(fp, vec2(period, period));
            if (lp.x < 0.0) lp.x += period;
            if (lp.y < 0.0) lp.y += period;

            vec4 fRects[12];
            fRects[0]  = vec4(0.0, 0.0, 3.0, 2.0);
            fRects[1]  = vec4(3.0, 0.0, 3.0, 2.0);
            fRects[2]  = vec4(0.0, 2.0, 2.0, 2.0);
            fRects[3]  = vec4(2.0, 2.0, 2.0, 2.0);
            fRects[4]  = vec4(4.0, 2.0, 2.0, 2.0);
            fRects[5]  = vec4(0.0, 4.0, 2.0, 2.0);
            fRects[6]  = vec4(2.0, 4.0, 2.0, 1.0);
            fRects[7]  = vec4(4.0, 4.0, 1.0, 2.0);
            fRects[8]  = vec4(5.0, 4.0, 1.0, 1.0);
            fRects[9]  = vec4(2.0, 5.0, 1.0, 1.0);
            fRects[10] = vec4(3.0, 5.0, 1.0, 1.0);
            fRects[11] = vec4(5.0, 5.0, 1.0, 1.0);

            bool found = false;
            for (int i = 0; i < 12; i++) {
              vec4 r = fRects[i];
              float rx = r.x * modM;
              float ry = r.y * modM;
              float rw = r.z * modM;
              float rh = r.w * modM;
              if (lp.x >= rx && lp.x < rx + rw && lp.y >= ry && lp.y < ry + rh) {
                tileUv = vec2((lp.x - rx) / rw, (lp.y - ry) / rh);
                hashCell = blockId * 12.0 + vec2(float(i), float(i));
                vec2 ed = min(vec2(lp.x - rx, lp.y - ry), vec2(rx + rw - lp.x, ry + rh - lp.y));
                distToEdge = min(ed.x, ed.y);
                found = true;
                break;
              }
            }
            if (!found) {
              vec2 uv = mPos * uTilingScale;
              tileUv = fract(uv);
              hashCell = floor(uv);
              vec2 ed = min(tileUv, 1.0 - tileUv) / uTilingScale;
              distToEdge = min(ed.x, ed.y);
            }
          } else {
            // ── 0. GRID (Stack Bond Default) ───────────────────────────────
            vec2 uv = mPos * uTilingScale;
            hashCell = floor(uv);
            tileUv = fract(uv);
            vec2 ed = min(tileUv, 1.0 - tileUv) / uTilingScale;
            distToEdge = min(ed.x, ed.y);
          }

          vec4 sampledDiffuseColor;
          if (uTileAtlasVariants > 1.5) {
            #if (PROJECTION_LOCAL == 1)
              hashCell += floor(vCustomWorldPos.xz * uTilingScale);
            #endif
            float h = hashTile(hashCell);
            float variantIndex = floor(h * uTileAtlasVariants);
            variantIndex = clamp(variantIndex, 0.0, uTileAtlasVariants - 1.0);
            float localX = clamp(tileUv.x, 0.001, 0.999);
            float localY = clamp(tileUv.y, 0.001, 0.999);
            vec2 atlasUv = vec2((variantIndex + localX) / uTileAtlasVariants, localY);
            sampledDiffuseColor = texture2D(map, atlasUv);
          } else {
            sampledDiffuseColor = texture2D(map, tileUv);
          }

          if (uGroutWidth > 0.00005) {
            float halfGrout = uGroutWidth * 0.5;
            float fw = max(fwidth(distToEdge), 0.00015);
            float groutFactor = 1.0 - smoothstep(halfGrout - fw, halfGrout + fw, distToEdge);
            if (groutFactor > 0.0) {
              sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, uGroutColor, groutFactor);
            }
          }

          diffuseColor *= sampledDiffuseColor;
          #endif
        #endif`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        if (uForegroundMode > 0) {
          float dist = dot(vCustomWorldPos - uOrbitCenter, uCameraDir);
          if (dist > 0.0) {
            if (uForegroundMode == 1) {
              float fade = smoothstep(0.0, 0.5, dist);
              gl_FragColor.a *= mix(1.0, uForegroundOpacity, fade);
            } else if (uForegroundMode == 2) {
              if (dist > 0.1) discard;
            }
          }
        }`
      );
    };
  }
}
