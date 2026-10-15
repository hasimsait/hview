import type { AssetDefinition } from './AssetDefinition';

const viko = 'https://viko.panasonic.com/en/products/switch-socket/karre/';
function fitting(key: string, name: string, series: 'karre' | 'bubble', control: NonNullable<AssetDefinition['electrical']>['control'], frameColor: string, insertColor: string): AssetDefinition {
  const socket = control.includes('socket'), double = control === 'double_socket';
  return {
    key, name, category: 'fixture', collection: socket ? 'Electrical sockets' : 'Electrical switches', recipe: 'electrical_fitting',
    description: `${series === 'bubble' ? 'Glossy rounded Bubble frame' : 'Square Karre frame'} with ${socket ? 'recessed earthed socket wells, pin holes and grounding contacts' : control === 'double_switch' ? 'two separate rocker switches' : 'a single rocker switch'}. Frame and insert finishes are independently editable.`,
    defaultDimensions: { x: series === 'bubble' ? .1 : double ? .1254 : .082, y: series === 'bubble' ? .1 : double ? .0816 : .082, z: series === 'bubble' ? .024 : socket ? .02 : .014 },
    placement: { mount: 'wall', defaultElevation: socket ? .3 : 1.1, wallOffset: (series === 'bubble' ? .024 : socket ? .02 : .014) / 2 + .001 },
    electrical: { series, control, frameColor, insertColor },
    source: {
      retailer: series === 'karre' ? 'VIKO' : 'VRC', dimensions: 'estimated',
      url: series === 'karre' ? `${viko}${socket ? 'sockets' : 'switches'}` : control === 'socket'
        ? 'https://www.trendyol.com/vrc-ticaret/ozel-tasarim-bubble-serisi-dis-krem-ic-haki-dekoratif-priz-a-kalite-plastik-mekanizma-dahildir-p-1164465592' : undefined,
      dimensionNotes: series === 'bubble' ? 'Photo-based planning model: estimated 10 cm diameter and 2.4 cm visible projection.'
        : double ? 'Published face size 12.54 × 8.16 cm; visible wall projection estimated at 2 cm, excluding the concealed mechanism.'
          : 'Approximate 8.2 cm square face; visible wall projection is estimated, excluding the concealed mechanism.',
    },
  };
}

export const ELECTRICAL_ASSETS: readonly AssetDefinition[] = [
  fitting('viko_karre_single_switch_white', 'VIKO Karre Single Rocker Switch — White', 'karre', 'single_switch', '#f5f5f2', '#f5f5f2'),
  fitting('viko_karre_double_switch_white', 'VIKO Karre Double Rocker Switch — White', 'karre', 'double_switch', '#f5f5f2', '#f5f5f2'),
  fitting('viko_karre_socket_white', 'VIKO Karre Earthed Socket — White', 'karre', 'socket', '#f5f5f2', '#f5f5f2'),
  fitting('viko_karre_double_socket_white', 'VIKO Karre Double Earthed Socket — White', 'karre', 'double_socket', '#f5f5f2', '#f5f5f2'),
  fitting('vrc_bubble_single_switch_burgundy', 'VRC Bubble Single Rocker Switch — Burgundy', 'bubble', 'single_switch', '#671b2e', '#671b2e'),
  fitting('vrc_bubble_double_switch_burgundy', 'VRC Bubble Double Rocker Switch — Burgundy', 'bubble', 'double_switch', '#671b2e', '#671b2e'),
  fitting('vrc_bubble_socket_cream_khaki', 'VRC Bubble Earthed Socket — Cream / Khaki', 'bubble', 'socket', '#e9dec5', '#555541'),
];
