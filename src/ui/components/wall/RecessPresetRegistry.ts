import { SurfaceFinishConfig,WallEntity } from '@core/types/plan';

export interface RecessPreset {
  id: string;
  title: string;
  subtitle: string;
  resolveFinish(wall: WallEntity): SurfaceFinishConfig;
}

export const RECESS_PRESETS: Record<string, RecessPreset> = {
  kale_sage: {
    id: 'kale_sage',
    title: 'Kale Sage 10x30',
    subtitle: 'Glossy Decor Tile',
    resolveFinish: () => ({
      type: 'tile',
      variant: 'kale_parlak_sage_10x30',
      color: '#9aa397',
      roughness: 0.12,
      rotation: 0,
      pattern: 'diagonal_herringbone',
      groutWidth: 1,
      groutColor: '#d1d5db',
    }),
  },
  wabi_maburu: {
    id: 'wabi_maburu',
    title: 'Wabi Maburu',
    subtitle: '34x111 Beige',
    resolveFinish: () => ({
      type: 'tile',
      variant: 'canakkale_wabi_maburu_bej_34x111',
      color: '#cec8ba',
      roughness: 0.22,
      rotation: 0,
      groutWidth: 2,
      groutColor: '#d1d5db',
    }),
  },
  diadem: {
    id: 'diadem',
    title: 'Diadem 59x59',
    subtitle: '59x59 Beige Porcelain',
    resolveFinish: () => ({
      type: 'tile',
      variant: 'canakkale_diadem_bej_59x59',
      color: '#d3c7b8',
      roughness: 0.76,
      rotation: 0,
      groutWidth: 2,
      groutColor: '#d1d5db',
    }),
  },
  wall: {
    id: 'wall',
    title: 'Match Wall',
    subtitle: 'Same as Wall Finish',
    resolveFinish: (wall: WallEntity) => {
      const active = wall.finishSideA || wall.finish;
      if (active) return { ...active };
      return {
        type: 'plaster',
        variant: 'smooth',
        color: '#efede8',
        roughness: 0.85,
      };
    },
  },
};

export const CORNER_DEFAULT_FINISH: SurfaceFinishConfig = {
  type: 'tile',
  variant: 'canakkale_diadem_bej_59x59',
  color: '#d3c7b8',
  roughness: 0.76,
  rotation: 0,
  groutWidth: 2,
  groutColor: '#d1d5db',
};
