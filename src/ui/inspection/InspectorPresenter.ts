import type { Column } from '../../domain/elements/Column';
import type { BasinCabinet,Furniture,Luminaire,Shelving,StandardFurniture } from '../../domain/elements/Furniture';
import type { Door,SlidingDoor,WindowOpening } from '../../domain/elements/Opening';
import type { PlanElementVisitor } from '../../domain/elements/PlanElement';
import type { Room } from '../../domain/elements/Room';
import type { Wall } from '../../domain/elements/Wall';
import type { WallRecess } from '../../domain/elements/WallRecess';
import type { SurfaceFinishConfig } from '../../domain/model/PlanData';

export type InspectorSection =
  | 'transform'
  | 'surfaces'
  | 'wall'
  | 'column'
  | 'floor'
  | 'door'
  | 'window'
  | 'luminaire'
  | 'shelving'
  | 'replacement';

export interface InspectorPresentation {
  readonly title: string;
  readonly sections: readonly InspectorSection[];
}

const METAL_OR_CERAMIC_SECTIONS = new Set([
  'metal',
  'ceramic',
  'faucet',
  'handle',
  'handles',
  'holder',
  'cistern',
  'lid',
  'bowl',
  'seat',
  'basin',
  'flush_button',
  'flush button',
  'hooks',
  'hook',
  'rail',
  'bar',
  'mounts',
  'mount',
  'arms',
  'light_bar',
  'light bar',
  'bezel',
  'grille',
  'fan_blades',
  'fan blades',
  'fan_hub',
  'fan hub',
  'housing',
]);

const FABRIC_SECTIONS = new Set([
  'fabric',
  'cushion',
  'cushions',
  'upholstery',
  'seat',
  'backrest',
  'armrests',
  'duvet',
  'pillow',
  'pillows',
  'mattress',
  'headboard',
  'towel',
]);

/** UI decisions are explicit per domain behavior, without asset-name heuristics. */
export class InspectorPresenter implements PlanElementVisitor<InspectorPresentation> {
  static defaultFinishTabFor(
    item: Furniture,
    activeSection: string,
    currentFinish?: SurfaceFinishConfig
  ): 'metal' | 'fabric' | undefined {
    const sectionKey = activeSection.toLowerCase();
    if (
      currentFinish?.type === 'metal' ||
      currentFinish?.type === 'porcelain' ||
      (sectionKey === 'seat' ? item.category === 'bathroom' : METAL_OR_CERAMIC_SECTIONS.has(sectionKey))
    ) {
      return 'metal';
    }
    if (
      currentFinish?.type === 'fabric' ||
      FABRIC_SECTIONS.has(sectionKey) ||
      item.category === 'seating' ||
      item.category === 'bed'
    ) {
      return 'fabric';
    }
    return undefined;
  }

  visitWall(element: Wall): InspectorPresentation {
    return { title: element.displayName, sections: ['wall', 'surfaces'] };
  }
  visitColumn(element: Column): InspectorPresentation {
    return { title: element.displayName, sections: ['column', 'surfaces'] };
  }
  visitRoom(element: Room): InspectorPresentation {
    return { title: element.displayName, sections: ['floor', 'surfaces'] };
  }
  visitDoor(element: Door): InspectorPresentation {
    return { title: element.displayName, sections: ['door', 'surfaces'] };
  }
  visitSlidingDoor(element: SlidingDoor): InspectorPresentation {
    return { title: element.displayName, sections: ['door', 'surfaces'] };
  }
  visitWindow(element: WindowOpening): InspectorPresentation {
    return { title: element.displayName, sections: ['window', 'surfaces'] };
  }
  visitRecess(element: WallRecess): InspectorPresentation {
    return { title: element.displayName, sections: ['transform', 'surfaces', 'replacement'] };
  }
  visitFurniture(element: StandardFurniture): InspectorPresentation {
    return { title: element.displayName, sections: ['transform', 'surfaces', 'replacement'] };
  }
  visitLuminaire(element: Luminaire): InspectorPresentation {
    return { title: element.displayName, sections: ['transform', 'luminaire', 'surfaces', 'replacement'] };
  }
  visitShelving(element: Shelving): InspectorPresentation {
    return { title: element.displayName, sections: ['transform', 'shelving', 'surfaces', 'replacement'] };
  }
  visitBasinCabinet(element: BasinCabinet): InspectorPresentation {
    return { title: element.displayName, sections: ['transform', 'surfaces', 'replacement'] };
  }
}
