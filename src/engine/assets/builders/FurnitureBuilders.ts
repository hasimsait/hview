import * as THREE from 'three';
import { Shelving } from '../../../domain/elements/Furniture';
import { AssetBuildContext } from "./AssetBuildContext";

export function buildBed(context: AssetBuildContext, isSingle = false): void {
  const { parent, w, h, d, materials } = context;
  const frameH = 0.25;
  const headboardH = h || 0.85;
  const headboardThick = 0.08;

  const isHorizontal = w > d;
  const bedW = isHorizontal ? d : w;
  const bedL = isHorizontal ? w : d;

  const bedGroup = new THREE.Group();

  // Platform Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(bedW, frameH, bedL - headboardThick), materials.woodLight);
  frame.userData.section = 'Frame';
  frame.position.set(0, frameH / 2, headboardThick / 2);
  frame.castShadow = true;
  bedGroup.add(frame);

  // Headboard on the narrower side (bedW)
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(bedW, headboardH, headboardThick), materials.fabricBeige);
  headboard.userData.section = 'Headboard';
  headboard.position.set(0, headboardH / 2, -bedL / 2 + headboardThick / 2);
  headboard.castShadow = true;
  bedGroup.add(headboard);

  // Mattress
  const matW = bedW * 0.94;
  const matL = (bedL - headboardThick) * 0.95;
  const matH = 0.22;
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(matW, matH, matL), materials.fabricLight);
  mattress.userData.section = 'Mattress';
  mattress.position.set(0, frameH + matH / 2, headboardThick / 2);
  bedGroup.add(mattress);

  // Duvet / Bedspread
  const duvetL = matL * 0.65;
  const duvet = new THREE.Mesh(new THREE.BoxGeometry(matW * 1.02, matH * 0.3, duvetL), materials.fabricBlue);
  duvet.userData.section = 'Duvet';
  duvet.position.set(0, frameH + matH + 0.02, headboardThick / 2 + (matL - duvetL) / 2);
  duvet.castShadow = true;
  bedGroup.add(duvet);

  // Pillows
  const pillowCount = isSingle ? 1 : 2;
  const pillowW = matW / (pillowCount + 0.6);
  const pillowL = 0.38;
  const pillowH = 0.12;

  for (let i = 0; i < pillowCount; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(pillowW, pillowH, pillowL), materials.fabricLight);
    p.userData.section = 'Pillows';
    const xOffset = pillowCount === 1 ? 0 : (i === 0 ? -matW / 4 : matW / 4);
    p.position.set(xOffset, frameH + matH + pillowH / 2, -bedL / 2 + headboardThick + pillowL / 2 + 0.05);
    p.rotation.x = 0.15;
    bedGroup.add(p);
  }

  if (isHorizontal) {
    bedGroup.rotation.y = Math.PI / 2;
  }

  parent.add(bedGroup);
}

export function buildBedSingle(context: AssetBuildContext): void {
  buildBed(context, true);
}

export function buildBedDouble(context: AssetBuildContext): void {
  buildBed(context, false);
}

export function buildSofa(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const seatH = 0.42;
  const backH = h || 0.8;
  const backD = d * 0.25;
  const armW = Math.min(0.18, w * 0.15);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(w, seatH * 0.8, d), materials.fabricDark);
  seat.userData.section = 'Seat';
  seat.position.set(0, (seatH * 0.8) / 2, 0);
  seat.castShadow = true;
  parent.add(seat);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(w, backH - seatH * 0.5, backD), materials.fabricDark);
  backrest.userData.section = 'Backrest';
  backrest.position.set(0, seatH + (backH - seatH) / 2, -d / 2 + backD / 2);
  backrest.castShadow = true;
  parent.add(backrest);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(armW, backH * 0.75, d), materials.fabricDark);
  leftArm.userData.section = 'Armrests';
  leftArm.position.set(-w / 2 + armW / 2, (backH * 0.75) / 2, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(armW, backH * 0.75, d), materials.fabricDark);
  rightArm.userData.section = 'Armrests';
  rightArm.position.set(w / 2 - armW / 2, (backH * 0.75) / 2, 0);
  parent.add(leftArm, rightArm);
}

export function buildTable(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const tableH = h || 0.75;
  const topThick = 0.04;

  const top = new THREE.Mesh(new THREE.BoxGeometry(w, topThick, d), materials.woodLight);
  top.userData.section = 'Tabletop';
  top.position.set(0, tableH - topThick / 2, 0);
  top.castShadow = true;
  parent.add(top);

  const legRadius = 0.025;
  const legH = tableH - topThick;
  const legGeom = new THREE.CylinderGeometry(legRadius, legRadius, legH, 16);

  const positions = [
    [-w / 2 + 0.08, -d / 2 + 0.08],
    [w / 2 - 0.08, -d / 2 + 0.08],
    [-w / 2 + 0.08, d / 2 - 0.08],
    [w / 2 - 0.08, d / 2 - 0.08],
  ];

  for (const [lx, lz] of positions) {
    const leg = new THREE.Mesh(legGeom, materials.metalBlack);
    leg.userData.section = 'Legs';
    leg.position.set(lx, legH / 2, lz);
    leg.castShadow = true;
    parent.add(leg);
  }
}

export function buildRoundTable(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const tableH = h || 0.75;
  const radius = Math.min(w, d) / 2;
  const topThick = 0.035;

  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, topThick, 32), materials.woodLight);
  top.userData.section = 'Tabletop';
  top.position.set(0, tableH - topThick / 2, 0);
  top.castShadow = true;
  parent.add(top);

  const columnH = tableH - topThick;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, columnH, 24), materials.metalBlack);
  column.userData.section = 'Pedestal Column';
  column.position.set(0, columnH / 2, 0);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, 0.02, 32), materials.metalBlack);
  base.userData.section = 'Base';
  base.position.set(0, 0.01, 0);
  parent.add(column, base);
}

export function buildDiningChair(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const seatH = 0.45;
  const chairH = h || 0.85;

  const seat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.04, d * 0.9), materials.fabricBeige);
  seat.userData.section = 'Seat';
  seat.position.set(0, seatH, 0);
  parent.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, chairH - seatH, 0.03), materials.woodDark);
  back.userData.section = 'Backrest';
  back.position.set(0, seatH + (chairH - seatH) / 2, -d * 0.4);
  parent.add(back);

  const legGeom = new THREE.CylinderGeometry(0.015, 0.012, seatH, 12);
  const legOffsets = [
    [-w * 0.38, -d * 0.38],
    [w * 0.38, -d * 0.38],
    [-w * 0.38, d * 0.38],
    [w * 0.38, d * 0.38],
  ];
  for (const [lx, lz] of legOffsets) {
    const leg = new THREE.Mesh(legGeom, materials.metalBlack);
    leg.userData.section = 'Legs';
    leg.position.set(lx, seatH / 2, lz);
    parent.add(leg);
  }
}

export function buildOfficeChair(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const seatH = 0.48;
  const chairH = h || 0.95;

  const seat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.08, d * 0.85), materials.fabricDark);
  seat.userData.section = 'Seat';
  seat.position.set(0, seatH, 0);
  parent.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, chairH - seatH, 0.06), materials.fabricDark);
  back.userData.section = 'Backrest';
  back.position.set(0, seatH + (chairH - seatH) / 2, -d * 0.35);
  parent.add(back);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, seatH - 0.1, 16), materials.metalChrome);
  column.userData.section = 'Base';
  column.position.set(0, (seatH - 0.1) / 2 + 0.1, 0);
  parent.add(column);

  const baseGroup = new THREE.Group();
  baseGroup.position.set(0, 0.05, 0);
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.28), materials.metalBlack);
    arm.userData.section = 'Base';
    arm.rotation.y = (i * Math.PI * 2) / 5;
    arm.position.set(0, 0, 0.14);
    baseGroup.add(arm);
  }
  parent.add(baseGroup);
}

export function buildWardrobe(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const wardH = h || 2.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, wardH, d), materials.woodLight);
  body.userData.section = 'Body';
  body.position.set(0, wardH / 2, 0);
  body.castShadow = true;
  parent.add(body);

  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.005, wardH * 0.96, 0.002), materials.metalBlack);
  seam.userData.section = 'Trim';
  seam.position.set(0, wardH / 2, d / 2 + 0.002);
  parent.add(seam);

  const handleGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.4, 12);
  const leftH = new THREE.Mesh(handleGeom, materials.metalBlack);
  leftH.userData.section = 'Handles';
  leftH.position.set(-0.04, wardH * 0.5, d / 2 + 0.02);
  const rightH = new THREE.Mesh(handleGeom, materials.metalBlack);
  rightH.userData.section = 'Handles';
  rightH.position.set(0.04, wardH * 0.5, d / 2 + 0.02);
  parent.add(leftH, rightH);
}

export function buildKitchenBox(context: AssetBuildContext, isWallCabinet = false): void {
  const { parent, w, h, d, materials } = context;
  const boxH = h > 0 ? h : (isWallCabinet ? 0.8 : 0.85);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, boxH, d), materials.fabricLight);
  body.userData.section = 'Cabinet';
  body.position.set(0, boxH / 2, 0);
  body.castShadow = true;
  parent.add(body);

  if (!isWallCabinet) {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.04), materials.graniteCounter);
    counter.userData.section = 'Countertop';
    counter.position.set(0, boxH + 0.02, 0.01);
    counter.castShadow = true;
    parent.add(counter);
  }
}

export function buildKitchenWallBox(context: AssetBuildContext): void {
  buildKitchenBox(context, true);
}

export function buildKitchenSink(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const boxH = h > 0 ? h : 0.85;
  buildKitchenBox(context, false);

  const basin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.01, d * 0.6), materials.metalChrome);
  basin.userData.section = 'Basin';
  basin.position.set(0, boxH + 0.041, 0);
  parent.add(basin);

  const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 16), materials.metalChrome);
  faucet.userData.section = 'Faucet';
  faucet.position.set(0, boxH + 0.16, -d * 0.25);
  parent.add(faucet);
}

export function buildFridge(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const fridgeH = h || 1.9;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, fridgeH, d), materials.metalChrome);
  body.userData.section = 'Body';
  body.position.set(0, fridgeH / 2, 0);
  body.castShadow = true;
  parent.add(body);

  const div = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, 0.005), materials.metalBlack);
  div.userData.section = 'Trim';
  div.position.set(0, fridgeH * 0.65, d / 2 + 0.003);
  parent.add(div);
}

export function buildRangeHood(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const hoodH = h || 0.6;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), materials.metalChrome);
  canopy.userData.section = 'Canopy';
  canopy.position.set(0, 0.05, 0);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, hoodH, d * 0.5), materials.metalChrome);
  chimney.userData.section = 'Duct';
  chimney.position.set(0, hoodH / 2, 0);
  parent.add(canopy, chimney);
}

export function buildWashingMachine(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const wmWidth = w || 0.60;
  const wmDepth = d || 0.60;
  const isStacked = (h || 0.85) > 1.30;
  const totalH = h || (isStacked ? 1.70 : 0.85);
  const unitH = isStacked ? totalH / 2 : totalH;

  const buildSingleUnit = (baseY: number, _isDryer: boolean) => {
    const unitGroup = new THREE.Group();
    unitGroup.position.set(0, baseY, 0);

    const bodyH = unitH - 0.03;
    const frontZ = wmDepth / 2;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(wmWidth - 0.006, bodyH, wmDepth - 0.02),
      materials.ceramicWhite
    );
    body.userData.section = 'Body';
    body.position.set(0, 0.03 + bodyH / 2, -0.01);
    body.castShadow = true;
    body.receiveShadow = true;

    const topLid = new THREE.Mesh(
      new THREE.BoxGeometry(wmWidth, 0.025, wmDepth),
      materials.ceramicWhite
    );
    topLid.userData.section = 'Body';
    topLid.position.set(0, unitH - 0.0125, 0);
    topLid.castShadow = true;

    const fasciaH = 0.14;
    const fasciaY = unitH - 0.025 - fasciaH / 2;
    const fasciaD = 0.025;
    const fasciaZ = frontZ - fasciaD / 2;

    const fascia = new THREE.Mesh(
      new THREE.BoxGeometry(wmWidth - 0.01, fasciaH, fasciaD),
      materials.ceramicWhite
    );
    fascia.userData.section = 'Control Panel';
    fascia.position.set(0, fasciaY, fasciaZ);

    const drawerW = wmWidth * 0.32;
    const drawerH = fasciaH * 0.72;
    const drawerX = -wmWidth / 2 + drawerW / 2 + 0.02;
    const drawer = new THREE.Mesh(
      new THREE.BoxGeometry(drawerW, drawerH, 0.008),
      materials.ceramicWhite
    );
    drawer.userData.section = 'Drawer';
    drawer.position.set(drawerX, fasciaY, frontZ + 0.002);

    const drawerHandle = new THREE.Mesh(
      new THREE.BoxGeometry(drawerW * 0.75, 0.012, 0.006),
      materials.metalBlack
    );
    drawerHandle.userData.section = 'Drawer';
    drawerHandle.position.set(drawerX, fasciaY - drawerH / 2 + 0.012, frontZ + 0.003);

    const knobRadius = 0.026;
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(knobRadius, knobRadius, 0.022, 24),
      materials.metalChrome
    );
    knob.userData.section = 'Dial';
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0, fasciaY, frontZ + 0.01);
    knob.castShadow = true;

    const dispW = wmWidth * 0.36;
    const dispH = fasciaH * 0.68;
    const dispX = wmWidth / 2 - dispW / 2 - 0.02;

    const displayPanel = new THREE.Mesh(
      new THREE.BoxGeometry(dispW, dispH, 0.005),
      materials.metalBlack
    );
    displayPanel.userData.section = 'Display';
    displayPanel.position.set(dispX, fasciaY, frontZ + 0.002);

    const ledScreen = new THREE.Mesh(
      new THREE.BoxGeometry(dispW * 0.65, dispH * 0.50, 0.002),
      materials.ledGlow
    );
    ledScreen.userData.section = 'Display';
    ledScreen.position.set(dispX - dispW * 0.12, fasciaY, frontZ + 0.005);

    const doorRadius = Math.min(wmWidth, bodyH) * 0.34;
    const doorY = (unitH - fasciaH - 0.06) / 2 + 0.05;
    const doorZ = frontZ;

    const drumCavity = new THREE.Mesh(
      new THREE.CylinderGeometry(doorRadius * 0.82, doorRadius * 0.72, 0.06, 32, 1, true),
      materials.metalChrome
    );
    drumCavity.userData.section = 'Drum';
    drumCavity.rotation.x = Math.PI / 2;
    drumCavity.position.set(0, doorY, frontZ - 0.03);

    const drumBack = new THREE.Mesh(
      new THREE.CylinderGeometry(doorRadius * 0.72, doorRadius * 0.72, 0.005, 32),
      materials.metalChrome
    );
    drumBack.userData.section = 'Drum';
    drumBack.rotation.x = Math.PI / 2;
    drumBack.position.set(0, doorY, frontZ - 0.06);

    const doorBezel = new THREE.Mesh(
      new THREE.TorusGeometry(doorRadius, 0.022, 16, 40),
      materials.metalChrome
    );
    doorBezel.userData.section = 'Door';
    doorBezel.position.set(0, doorY, doorZ + 0.015);
    doorBezel.castShadow = true;

    const doorGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(doorRadius * 0.88, doorRadius * 0.88, 0.015, 32),
      materials.glass
    );
    doorGlass.userData.section = 'Glass';
    doorGlass.rotation.x = Math.PI / 2;
    doorGlass.position.set(0, doorY, doorZ + 0.008);

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.07, 0.022),
      materials.metalChrome
    );
    handle.userData.section = 'Door';
    handle.position.set(doorRadius + 0.006, doorY, doorZ + 0.02);

    const hinge = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.05, 0.02),
      materials.metalChrome
    );
    hinge.userData.section = 'Door';
    hinge.position.set(-doorRadius - 0.006, doorY, doorZ + 0.015);

    const plinthH = 0.065;
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(wmWidth - 0.01, plinthH, 0.015),
      materials.ceramicWhite
    );
    plinth.userData.section = 'Plinth';
    plinth.position.set(0, plinthH / 2 + 0.015, frontZ - 0.01);

    const filterFlap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.006, 20),
      materials.ceramicWhite
    );
    filterFlap.userData.section = 'Plinth';
    filterFlap.rotation.x = Math.PI / 2;
    filterFlap.position.set(wmWidth / 2 - 0.08, plinthH / 2 + 0.015, frontZ - 0.002);

    unitGroup.add(
      body, topLid,
      fascia, drawer, drawerHandle, knob, displayPanel, ledScreen,
      drumCavity, drumBack, doorBezel, doorGlass, handle, hinge,
      plinth, filterFlap
    );

    if (baseY === 0) {
      const footRadius = 0.02;
      const footH = 0.02;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const foot = new THREE.Mesh(
            new THREE.CylinderGeometry(footRadius, footRadius, footH, 12),
            materials.metalBlack
          );
          foot.position.set(
            sx * (wmWidth / 2 - 0.05),
            footH / 2,
            sz * (wmDepth / 2 - 0.05)
          );
          unitGroup.add(foot);
        }
      }
    }

    return unitGroup;
  };

  const washer = buildSingleUnit(0, false);
  parent.add(washer);

  if (isStacked) {
    const stackingKit = new THREE.Mesh(
      new THREE.BoxGeometry(wmWidth, 0.02, wmDepth),
      materials.metalBlack
    );
    stackingKit.userData.section = 'Body';
    stackingKit.position.set(0, unitH, 0);
    parent.add(stackingKit);

    const dryer = buildSingleUnit(unitH + 0.02, true);
    parent.add(dryer);
  }
}

export function buildTV(context: AssetBuildContext): void {
  const { parent, w, h, materials } = context;
  const tvW = w || 1.1;
  const tvH = h || 0.65;

  const screen = new THREE.Mesh(new THREE.BoxGeometry(tvW, tvH, 0.03), materials.screen);
  screen.userData.section = 'Screen';
  screen.position.set(0, tvH / 2 + 0.1, 0);

  const stand = new THREE.Mesh(new THREE.BoxGeometry(tvW * 0.4, 0.015, 0.25), materials.metalBlack);
  stand.userData.section = 'Stand';
  stand.position.set(0, 0.01, 0);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.04), materials.metalBlack);
  stem.userData.section = 'Stand';
  stem.position.set(0, 0.06, 0);

  parent.add(screen, stand, stem);
}

export function buildFixture(context: AssetBuildContext): void {
  const { parent, w, h, materials } = context;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(w || 0.15, h || 0.08, 0.02), materials.ceramicWhite);
  plate.position.set(0, (h || 0.08) / 2, 0);
  parent.add(plate);
}

export function buildGenericCabinet(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(w, h || 0.75, d), materials.woodLight);
  cabinet.position.set(0, (h || 0.75) / 2, 0);
  cabinet.castShadow = true;
  parent.add(cabinet);
}

function resolveShelfDimension(value: number | undefined, fallback: number, minimum = 0.01) {
  return value !== undefined && Number.isFinite(value) && value >= minimum ? value : fallback;
}

export function buildShelving(context: AssetBuildContext): void {
  if (!(context.entity instanceof Shelving)) throw new Error('Shelving geometry requires shelving behavior');
  const { parent, w, h, d, materials } = context;
  const shelfW = resolveShelfDimension(w, 1.0);
  const shelfH = resolveShelfDimension(h, 1.8);
  const shelfD = resolveShelfDimension(d, 0.35);

  const group = new THREE.Group();
  const frameMat = materials.woodDark;
  const shelfMat = materials.woodDark;

  const uprightThick = 0.025;
  const shelfThick = 0.022;

  // Left upright panel
  const leftUpright = new THREE.Mesh(
    new THREE.BoxGeometry(uprightThick, shelfH, shelfD),
    frameMat
  );
  leftUpright.userData.section = 'Frame';
  leftUpright.position.set(-shelfW / 2 + uprightThick / 2, shelfH / 2, 0);
  leftUpright.castShadow = true;
  leftUpright.receiveShadow = true;
  group.add(leftUpright);

  // Right upright panel
  const rightUpright = new THREE.Mesh(
    new THREE.BoxGeometry(uprightThick, shelfH, shelfD),
    frameMat
  );
  rightUpright.userData.section = 'Frame';
  rightUpright.position.set(shelfW / 2 - uprightThick / 2, shelfH / 2, 0);
  rightUpright.castShadow = true;
  rightUpright.receiveShadow = true;
  group.add(rightUpright);

  // Back panel (structural back)
  const backW = Math.max(0.05, shelfW - uprightThick * 2);
  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(backW, shelfH, 0.008),
    frameMat
  );
  backPanel.userData.section = 'Frame';
  backPanel.position.set(0, shelfH / 2, -shelfD / 2 + 0.004);
  backPanel.castShadow = true;
  group.add(backPanel);

  // Dynamic shelf tiers calculated proportionally from actual height
  const innerW = Math.max(0.05, shelfW - uprightThick * 2);
  const innerD = Math.max(0.05, shelfD - 0.012);
  const numTiers = context.entity.shelfCount;
  const tierSpacing = (shelfH - shelfThick) / (numTiers - 1);

  for (let i = 0; i < numTiers; i++) {
    const tierY = shelfThick / 2 + i * tierSpacing;
    const shelfMesh = new THREE.Mesh(
      new THREE.BoxGeometry(innerW, shelfThick, innerD),
      shelfMat
    );
    shelfMesh.userData.section = 'Shelves';
    shelfMesh.position.set(0, tierY, 0.004);
    shelfMesh.castShadow = true;
    shelfMesh.receiveShadow = true;
    group.add(shelfMesh);
  }

  // Optional front lids / cabinet doors
  const hasLids = context.entity.hasLids ?? false;
  if (hasLids) {
    const doorThick = 0.018;
    const doorH = Math.max(0.2, shelfH - 0.02);
    const doorZ = shelfD / 2 + doorThick / 2;
    const isDoubleDoor = shelfW >= 0.70;

    if (isDoubleDoor) {
      const doorW = (shelfW - 0.008) / 2;
      const leftDoor = new THREE.Mesh(
        new THREE.BoxGeometry(doorW, doorH, doorThick),
        frameMat
      );
      leftDoor.userData.section = 'Lids';
      leftDoor.position.set(-doorW / 2 - 0.002, shelfH / 2, doorZ);
      leftDoor.castShadow = true;
      leftDoor.receiveShadow = true;

      const rightDoor = new THREE.Mesh(
        new THREE.BoxGeometry(doorW, doorH, doorThick),
        frameMat
      );
      rightDoor.userData.section = 'Lids';
      rightDoor.position.set(doorW / 2 + 0.002, shelfH / 2, doorZ);
      rightDoor.castShadow = true;
      rightDoor.receiveShadow = true;

      // Vertical handles
      const handleGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.12, 12);
      const leftHandle = new THREE.Mesh(handleGeom, materials.metalChrome);
      leftHandle.userData.section = 'Handles';
      leftHandle.position.set(-0.025, shelfH / 2, doorZ + doorThick / 2 + 0.006);
      leftHandle.castShadow = true;

      const rightHandle = new THREE.Mesh(handleGeom, materials.metalChrome);
      rightHandle.userData.section = 'Handles';
      rightHandle.position.set(0.025, shelfH / 2, doorZ + doorThick / 2 + 0.006);
      rightHandle.castShadow = true;

      group.add(leftDoor, rightDoor, leftHandle, rightHandle);
    } else {
      const doorW = shelfW - 0.004;
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(doorW, doorH, doorThick),
        frameMat
      );
      door.userData.section = 'Lids';
      door.position.set(0, shelfH / 2, doorZ);
      door.castShadow = true;
      door.receiveShadow = true;

      const handleGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.12, 12);
      const handle = new THREE.Mesh(handleGeom, materials.metalChrome);
      handle.userData.section = 'Handles';
      handle.position.set(doorW / 2 - 0.04, shelfH / 2, doorZ + doorThick / 2 + 0.006);
      handle.castShadow = true;

      group.add(door, handle);
    }
  }

  parent.add(group);
}
