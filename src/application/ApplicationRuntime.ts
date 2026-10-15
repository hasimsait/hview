import { AssetCatalog } from '../domain/catalog/AssetCatalog';
import { PlanCodec } from '../domain/codec/PlanCodec';
import { FurnitureMeshBuilder } from '../engine/assets/FurnitureMeshBuilder';
import { SurfaceMaterialFactory } from '../engine/materials/SurfaceMaterialFactory';
import { SceneEngine } from '../engine/SceneEngine';
import { DocumentStorage } from '../platform/persistence/DocumentStorage';
import { InteractionService } from '../services/interaction/InteractionService';
import { TileCatalogService } from '../services/tile-catalog/TileCatalogService';
import { DocumentController } from './DocumentController';
import { DocumentExports } from './DocumentExports';
import { EditorSession } from './EditorSession';

/** The editor's explicit composition root. No token lookup or ambient service container. */
export class ApplicationRuntime {
  readonly catalog = new AssetCatalog();
  readonly codec = new PlanCodec(this.catalog);
  readonly editor = new EditorSession(this.codec.factory);
  readonly storage = new DocumentStorage();
  readonly documents = new DocumentController(this.editor, this.codec, this.storage);
  readonly tiles = new TileCatalogService();
  readonly materials = new SurfaceMaterialFactory(this.tiles);
  readonly meshes = new FurnitureMeshBuilder(this.catalog, this.materials.textures);
  readonly scene = new SceneEngine(this.meshes, this.materials);
  readonly interaction = new InteractionService();
  readonly exports = new DocumentExports(this.editor, this.codec);
}
