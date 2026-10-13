import { Container, defaultContainer } from './container';
import { TOKENS } from './tokens';
import { PlanParserService } from '@services/plan/PlanParserService';
import { PlanExportService } from '@services/plan/PlanExportService';
import { PlanManagerService } from '@services/plan/PlanManagerService';
import { PlanPersistenceService } from '@services/plan/PlanPersistenceService';
import { AssetRegistryService } from '@services/rendering/AssetRegistryService';
import { ThreeSceneService } from '@services/rendering/ThreeSceneService';
import { InteractionService } from '@services/interaction/InteractionService';
import { SurfaceFinishService } from '@services/rendering/SurfaceFinishService';
import { TileCatalogService } from '@services/tile-catalog/TileCatalogService';
import { StandaloneViewerExportService } from '@services/export/StandaloneViewerExportService';

export function setupContainer(container: Container = defaultContainer): Container {
  // Plan Parser & Exporter & Persistence
  container.registerSingleton(
    TOKENS.PlanParserService,
    (c) => new PlanParserService(c.resolve(TOKENS.AssetRegistryService))
  );
  container.registerSingleton(TOKENS.PlanExportService, () => new PlanExportService());
  container.registerSingleton(TOKENS.PlanPersistenceService, () => new PlanPersistenceService());

  // Plan Manager
  container.registerSingleton(
    TOKENS.PlanManagerService,
    (c) =>
      new PlanManagerService(
        c.resolve(TOKENS.PlanParserService),
        c.resolve(TOKENS.PlanExportService),
        c.resolve(TOKENS.PlanPersistenceService)
      )
  );

  // Tile Catalog (loaded async from public/textures/tiles/tiles.json)
  container.registerSingleton(TOKENS.TileCatalogService, () => new TileCatalogService());

  // Asset Registry & Surface Finish Service
  container.registerSingleton(TOKENS.AssetRegistryService, () => new AssetRegistryService());
  container.registerSingleton(
    TOKENS.SurfaceFinishService,
    (c) => new SurfaceFinishService(c.resolve(TOKENS.TileCatalogService))
  );

  // Scene Service
  container.registerSingleton(
    TOKENS.SceneService,
    (c) =>
      new ThreeSceneService(
        c.resolve(TOKENS.AssetRegistryService),
        c.resolve(TOKENS.SurfaceFinishService)
      )
  );

  // Interaction Service
  container.registerSingleton(TOKENS.InteractionService, () => new InteractionService());

  // Standalone Viewer Export Service
  container.registerSingleton(
    TOKENS.StandaloneViewerExportService,
    (c) =>
      new StandaloneViewerExportService(
        c.resolve(TOKENS.PlanManagerService),
        c.resolve(TOKENS.PlanExportService)
      )
  );

  return container;
}
