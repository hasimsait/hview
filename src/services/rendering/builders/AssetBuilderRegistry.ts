import { AssetBuildContext, AssetBuilderFn } from './AssetBuildContext';
import { IAssetStrategy, FunctionalAssetStrategy, ShelvingStrategy } from './AssetStrategy';
import * as Lighting from './LightingBuilders';
import * as Bathroom from './BathroomBuilders';
import * as Furniture from './FurnitureBuilders';

export class AssetBuilderRegistry {
  private strategies = new Map<string, IAssetStrategy>();
  private defaultStrategy: IAssetStrategy = new FunctionalAssetStrategy(
    'generic_cabinet',
    [],
    Furniture.buildGenericCabinet
  );

  constructor() {
    this.registerDefaults();
  }

  registerStrategy(strategy: IAssetStrategy): void {
    this.strategies.set(strategy.key.toLowerCase(), strategy);
    if (strategy.aliases) {
      for (const alias of strategy.aliases) {
        this.strategies.set(alias.toLowerCase(), strategy);
      }
    }
  }

  register(key: string, builder: AssetBuilderFn, aliases: string[] = []): void {
    this.registerStrategy(new FunctionalAssetStrategy(key, aliases, builder));
  }

  getStrategy(key: string): IAssetStrategy {
    const k = key.toLowerCase();
    const strategy = this.strategies.get(k);
    if (strategy) return strategy;

    // Direct key prefix / category fallbacks if not directly mapped:
    if (k.includes('fixture') || k.includes('socket') || k.includes('switch')) {
      return new FunctionalAssetStrategy('fixture', [], Furniture.buildFixture);
    }

    return this.defaultStrategy;
  }

  getBuilder(key: string): AssetBuilderFn {
    const strategy = this.getStrategy(key);
    return (ctx) => strategy.build(ctx);
  }

  build(key: string, context: AssetBuildContext): void {
    const strategy = this.getStrategy(key);
    strategy.build(context);
  }

  private registerDefaults(): void {
    // Lighting Strategies
    this.register('chandelier', Lighting.buildChandelier, ['chandelier_ring']);
    this.register('chandelier_cascading', Lighting.buildCascadingChandelier);
    this.register('ceiling_spot', Lighting.buildCylinderSpotlight, [
      'cylinder_spot',
      'surface_spot',
      'spot_cylinder',
    ]);
    this.register('spotlight', Lighting.buildSpotlight, [
      'recessed_spot',
      'lightspot',
      'led_lamp',
      'ceiling_lamp',
    ]);
    this.register('wall_spot', Lighting.buildWallSpot, ['sconce']);
    this.register('vanity_sconce_80', Lighting.buildVanitySconce80, [
      'aplik_80',
      'vanity_sconce',
      'aplik',
      'vanity_light',
    ]);

    // Bathroom Strategies
    this.register('toilet', Bathroom.buildToilet);
    this.register('basin_cabinet_lower', Bathroom.buildLowerBasinCabinet, [
      'lower_basin_cabinet',
      'sink_box_floor',
    ]);
    this.register('mirror_cabinet_upper', Bathroom.buildUpperMirrorCabinet, [
      'upper_mirror_cabinet',
    ]);
    this.register('sink_susp', Bathroom.buildBathroomSink, ['sink']);
    this.register('shower_system', Bathroom.buildShower, ['shower']);
    this.register('fan_wall', Bathroom.buildBathroomVentFan, ['fan', 'ventilation']);
    this.register('towel_rack', Bathroom.buildTowelRack, ['towel_hooks']);
    this.register('single_towel_hook', Bathroom.buildSingleTowelHook, [
      'towel_hook',
      'hook_towel',
      'single_hook',
    ]);
    this.register('towel_bar', Bathroom.buildTowelBar, ['towel_rail_single']);
    this.register('mirror', Bathroom.buildMirror, ['backlit_mirror']);
    this.register('toilet_paper', Bathroom.buildToiletPaper);
    this.register('toilet_brush', Bathroom.buildToiletBrush);
    this.register('wastebin', Bathroom.buildWastebin, ['urn', 'trash']);
    this.register('wall_recess', Bathroom.buildWallRecess, [
      'recess',
      'girinti',
      'niche',
      'wall_niche',
      'shower_niche',
    ]);

    // Furniture & Seating Strategies
    this.register('bed_double', Furniture.buildBedDouble, ['bed']);
    this.register('bed_single', Furniture.buildBedSingle);
    this.register('sofa', Furniture.buildSofa, [
      'sofa_triple',
      'sofa_double',
      'ottoman',
      'ottoman_module_armrest',
    ]);
    this.register('chair', Furniture.buildDiningChair, ['dining_chair']);
    this.register('office_chair', Furniture.buildOfficeChair);

    // Tables
    this.register('table', Furniture.buildTable, ['work_table', 'desk', 'coffee_table']);
    this.register('table_round', Furniture.buildRoundTable);

    // Storage: Dedicated Polymorphic Shelving Strategy
    this.register('wardrobe', Furniture.buildWardrobe, ['ward_double', 'ward_single', 'closet']);
    this.registerStrategy(new ShelvingStrategy());

    // Kitchen Strategies
    this.register('kitchen_box', Furniture.buildKitchenBox, [
      'kitchen_box_door_double',
      'kitchen_box_floor',
    ]);
    this.register('kitchen_box_wall', Furniture.buildKitchenWallBox);
    this.register('kitchen_sink', Furniture.buildKitchenSink);
    this.register('fridge', Furniture.buildFridge, ['refrigerator']);
    this.register('suspended_hood', Furniture.buildRangeHood, ['range_hood']);

    // Appliances & Decor
    this.register('tv', Furniture.buildTV, ['smart_tv']);
    this.register('washing_machine', Furniture.buildWashingMachine, [
      'dryer_over_washing',
      'washer',
      'dryer',
    ]);
    this.register('fixture', Furniture.buildFixture);
    this.register('generic_cabinet', Furniture.buildGenericCabinet);
  }
}
