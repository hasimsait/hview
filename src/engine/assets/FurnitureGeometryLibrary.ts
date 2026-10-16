import type { AssetRecipeId } from '../../domain/catalog/AssetRecipes';
import type { AssetBuilderFn } from "./builders/AssetBuildContext";
import * as Bathroom from "./builders/BathroomBuilders";
import * as Furniture from "./builders/FurnitureBuilders";
import * as Lighting from "./builders/LightingBuilders";
import * as Catalogue from './builders/CatalogueBuilders';
import { buildIkeaAccessory } from './builders/IkeaAccessoryBuilder';
import { buildBathroomAccessory } from './builders/BathroomAccessoryBuilder';
import { buildFurnitureProduct } from './builders/FurnitureProductBuilder';
import { buildElectricalFitting } from './builders/ElectricalBuilders';
import { buildAirPurifier, buildRobotVacuum } from './builders/HouseholdBuilders';
import { buildArchitecturalFinish } from './builders/ArchitecturalFinishBuilder';
import { buildLightingComponent } from './builders/LightingComponentBuilder';
import { buildFloorDrain } from './builders/FloorDrainBuilder';
import { buildSoftFurnishing } from './builders/SoftFurnishingBuilder';

export const FURNITURE_GEOMETRY: Readonly<Record<AssetRecipeId, AssetBuilderFn>> = {
  soft_furnishing: buildSoftFurnishing,
  lighting_component: buildLightingComponent,
  floor_drain: buildFloorDrain,
  architectural_finish: buildArchitecturalFinish,
  retail_furniture: buildFurnitureProduct,
  bathroom_accessory: buildBathroomAccessory,
  electrical_fitting: buildElectricalFitting,
  robot_vacuum: buildRobotVacuum,
  air_purifier: buildAirPurifier,
  ikea_accessory: buildIkeaAccessory,
  angled_range_hood: Catalogue.buildAngledHood,
  gas_cooktop: Catalogue.buildGasCooktop,
  built_in_oven: Catalogue.buildBuiltInOven,
  soap_dispenser: Catalogue.buildSoapDispenser,
  toothbrush_tumbler: Catalogue.buildTumbler,
  soap_dish: Catalogue.buildSoapDish,
  pedal_bin: Catalogue.buildPedalBin,
  brush_set: Catalogue.buildBrushSet,
  paper_towel_holder: Catalogue.buildPaperTowelHolder,
  curtain_pelmet: Catalogue.buildCurtainPelmet,
  hemnes_bookcase: Catalogue.buildHemnesBookcase,
  billy_bookcase: Catalogue.buildBillyBookcase,
  'chandelier': Lighting.buildChandelier,
  'chandelier_cascading': Lighting.buildCascadingChandelier,
  'ceiling_spot': Lighting.buildCylinderSpotlight,
  'spotlight': Lighting.buildSpotlight,
  'wall_spot': Lighting.buildWallSpot,
  'vanity_sconce_80': Lighting.buildVanitySconce80,
  'toilet': Bathroom.buildToilet,
  'basin_cabinet_lower': Bathroom.buildLowerBasinCabinet,
  'mirror_cabinet_upper': Bathroom.buildUpperMirrorCabinet,
  'sink_susp': Bathroom.buildBathroomSink,
  'shower_system': Bathroom.buildShower,
  'fan_wall': Bathroom.buildBathroomVentFan,
  'towel_rack': Bathroom.buildTowelRack,
  'single_towel_hook': Bathroom.buildSingleTowelHook,
  'towel_bar': Bathroom.buildTowelBar,
  'mirror': Bathroom.buildMirror,
  'toilet_paper': Bathroom.buildToiletPaper,
  'toilet_brush': Bathroom.buildToiletBrush,
  'wastebin': Bathroom.buildWastebin,
  'wall_recess': Bathroom.buildWallRecess,
  'bed_double': Furniture.buildBedDouble,
  'bed_single': Furniture.buildBedSingle,
  'sofa': Furniture.buildSofa,
  'chair': Furniture.buildDiningChair,
  'office_chair': Furniture.buildOfficeChair,
  'table': Furniture.buildTable,
  'table_round': Furniture.buildRoundTable,
  'wardrobe': Furniture.buildWardrobe,
  'kitchen_box': Furniture.buildKitchenBox,
  'kitchen_box_wall': Furniture.buildKitchenWallBox,
  'kitchen_sink': Furniture.buildKitchenSink,
  'fridge': Furniture.buildFridge,
  'suspended_hood': Furniture.buildRangeHood,
  'tv': Furniture.buildTV,
  'washing_machine': Furniture.buildWashingMachine,
  'fixture': Furniture.buildFixture,
  'generic_cabinet': Furniture.buildGenericCabinet,
  'open_shelving': Furniture.buildShelving,
};
