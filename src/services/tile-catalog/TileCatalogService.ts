import { TileLayoutPattern } from '@core/types/plan';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Public types (re-exported from services.ts)
// ---------------------------------------------------------------------------

export interface TileEntry {
  id: string;
  name: string;
  /** Physical width in centimetres (drives tiling scale). */
  widthCm: number;
  /** Physical height in centimetres (drives tiling scale). */
  heightCm: number;
  /** Fallback swatch / PBR base colour (hex). */
  color: string;
  roughness: number;
  metalness?: number;
  /**
   * Override the default grout width (mm). When absent, derived from tile size:
   * smallestDimension ≤ 20 cm → 1 mm, otherwise → 2 mm.
   */
  defaultGroutWidth?: number;
  /**
   * Default layout pattern (e.g. 'diagonal_herringbone' for decor / subway tiles).
   * Defaults to 'grid' if not specified.
   */
  defaultPattern?: TileLayoutPattern;
  /**
   * Ordered array of texture URL paths (relative to the web root).
   * - Empty array → procedural / canvas-generated texture.
   * - Length > 1 → tile has variants; the 3-D renderer picks a random one per
   *   surface so potential grout-line mismatch is visible.
   */
  textures: string[];
}

export interface ITileCatalogService {
  /** All entries in catalog order. Empty until the catalog has loaded. */
  getAll(): TileEntry[];
  /** Look up an entry by its id (= SurfaceFinishConfig.variant). */
  getById(id: string): TileEntry | undefined;
  /**
   * Derive Three.js tiling repeat (repeats per metre) from physical dimensions.
   *
   * For a tile laid with its width along the X axis:
   *   scaleX = 1 / (widthCm / 100)
   *   scaleY = 1 / (heightCm / 100)
   */
  getTilingScale(entry: TileEntry): THREE.Vector2;
  /** Returns the physical dimensions in cm. */
  getDimensionsCm(entry: TileEntry): THREE.Vector2;
  /** Returns the effective grout width in mm for an entry. */
  getDefaultGroutWidth(entry: TileEntry): number;
  /** Returns the default layout pattern for an entry. */
  getDefaultPattern(entry: TileEntry): TileLayoutPattern;
  /**
   * Register a callback that fires once the catalog has loaded (or immediately
   * if it already has). Returns an unsubscribe function.
   */
  onCatalogLoaded(cb: (entries: TileEntry[]) => void): () => void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class TileCatalogService implements ITileCatalogService {
  private entries: TileEntry[] = [];
  private loaded = false;
  private listeners: Array<(entries: TileEntry[]) => void> = [];

  constructor() {
    void this.load();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getAll(): TileEntry[] {
    return this.entries;
  }

  getById(id: string): TileEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  getTilingScale(entry: TileEntry): THREE.Vector2 {
    const wm = entry.widthCm / 100;
    const hm = entry.heightCm / 100;
    // Tiles are laid horizontally by default: the longer physical dimension
    // goes along the X axis (horizontal), shorter along Y (vertical).
    // This matches the old per-tile switch behaviour:
    //   34x111 → scaleX = 1/1.11, scaleY = 1/0.34
    //   30x60  → scaleX = 1/0.60, scaleY = 1/0.30
    //   60x60  → scaleX = 1/0.60, scaleY = 1/0.60
    const horizontal = Math.max(wm, hm);
    const vertical = Math.min(wm, hm);
    return new THREE.Vector2(1 / horizontal, 1 / vertical);
  }

  getDimensionsCm(entry: TileEntry): THREE.Vector2 {
    return new THREE.Vector2(entry.widthCm, entry.heightCm);
  }

  getDefaultGroutWidth(entry: TileEntry): number {
    if (entry.defaultGroutWidth !== undefined) return entry.defaultGroutWidth;
    return Math.min(entry.widthCm, entry.heightCm) <= 20 ? 1 : 2;
  }

  getDefaultPattern(entry: TileEntry): TileLayoutPattern {
    if (entry.defaultPattern) return entry.defaultPattern;
    const lower = entry.name.toLowerCase();
    if (lower.includes('decor') || lower.includes('sage') || lower.includes('subway')) {
      return 'diagonal_herringbone';
    }
    return 'grid';
  }

  onCatalogLoaded(cb: (entries: TileEntry[]) => void): () => void {
    if (this.loaded) {
      cb(this.entries);
      return () => { };
    }
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async load(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.__TILE_CATALOG__) {
        this.entries = window.__TILE_CATALOG__;
        return;
      }
      const res = await fetch('/textures/tiles/tiles.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: TileEntry[] = await res.json();
      this.entries = raw;
    } catch (err) {
      if (typeof window !== 'undefined' && window.__TILE_CATALOG__) {
        this.entries = window.__TILE_CATALOG__;
      } else {
        console.warn('[TileCatalogService] Failed to load tiles.json (running offline):', err);
        this.entries = [];
      }
    } finally {
      this.loaded = true;
      this.listeners.forEach((cb) => cb(this.entries));
      this.listeners = [];
    }
  }
}
