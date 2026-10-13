export function rawPlan() {
  return {
    metadata: { project: 'regression fixture', keep: true },
    plan: {
      v: 3, total_height: 300,
      walls: {
        wall: {
          p1: { x: 0, y: 0 }, p2: { x: 400, y: 0 }, depth: 20, height: 300,
          material: 'a_block',
          holes: {
            window: { group: 'windows', type: 'window', width: 100, height: 120, floor_height: 90, pc: { x: 300, y: 0 } },
            door: { type: 'door', width: 80, height: 210, pc: { x: 100, y: 0 }, opening: 'l-r' },
          },
        },
      },
      rooms2: {
        room: { title: 'Living room', area: 12, polygon: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }] },
      },
      items: {
        sofa: { name: 'sofa', pc: { x: 150, y: 200 }, width: 180, height: 80, self_height: 75, f0offset: 25, angle: 90, id_room: 'room', vendorData: 'preserve me' },
      },
    },
  };
}
