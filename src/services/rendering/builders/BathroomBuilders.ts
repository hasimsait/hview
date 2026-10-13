import * as THREE from 'three';
import { AssetBuildContext } from './AssetBuildContext';

export function buildWastebin(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const binH = h > 0.15 ? h : 0.36;
  const radius = Math.min(w, d) / 2 || 0.12;

  // Stainless steel cylinder bin body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.95, binH, 24),
    materials.metalChrome
  );
  body.userData.section = 'Body';
  body.position.set(0, binH / 2, 0);
  body.castShadow = true;

  // Lid
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, 0.02, 24),
    materials.metalBlack
  );
  lid.userData.section = 'Lid';
  lid.position.set(0, binH + 0.01, 0);

  // Foot pedal
  const pedal = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.015, 0.05),
    materials.metalBlack
  );
  pedal.userData.section = 'Pedal';
  pedal.position.set(0, 0.01, radius + 0.02);

  parent.add(body, lid, pedal);
}

export function buildToiletBrush(context: AssetBuildContext): void {
  const { parent, w, d, materials } = context;
  const holderH = 0.25;
  const radius = Math.min(w, d) / 2 || 0.06;
  const holder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, holderH, 16),
    materials.ceramicWhite
  );
  holder.userData.section = 'Holder';
  holder.position.set(0, holderH / 2, 0);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.25, 12),
    materials.metalChrome
  );
  handle.userData.section = 'Handle';
  handle.position.set(0, holderH + 0.1, 0);

  parent.add(holder, handle);
}

export function buildToiletPaper(context: AssetBuildContext): void {
  const { parent, w, d, materials } = context;
  const holder = new THREE.Mesh(
    new THREE.BoxGeometry(w || 0.14, 0.08, d || 0.1),
    materials.metalChrome
  );
  holder.userData.section = 'Holder';
  holder.position.set(0, 0.04, 0);
  const roll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, (w || 0.14) * 0.8, 16),
    materials.ceramicWhite
  );
  roll.userData.section = 'Paper Roll';
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.04, 0.02);
  parent.add(holder, roll);
}

export function buildBathroomVentFan(context: AssetBuildContext): void {
  const { parent, w, h, materials } = context;
  const fanW = Math.max(w || 0.23, 0.20);
  const fanH = Math.max(h || 0.23, fanW); // Keep square faceplate
  const halfW = fanW / 2;
  const halfH = fanH / 2;

  // 1. Recessed Duct Housing (-Z into wall cavity)
  const ductRadius = Math.min(fanW, fanH) * 0.38;
  const ductDepth = 0.045;
  const ductGeom = new THREE.CylinderGeometry(ductRadius, ductRadius, ductDepth, 32);
  const duct = new THREE.Mesh(ductGeom, materials.metalBlack);
  duct.userData.section = 'Housing';
  duct.rotation.x = Math.PI / 2;
  duct.position.set(0, fanH / 2, -ductDepth / 2);
  duct.castShadow = true;
  duct.receiveShadow = true;
  parent.add(duct);

  // 2. Beveled Square Outer Faceplate / Bezel
  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(fanW, fanH, 0.008),
    materials.metalChrome
  );
  basePlate.userData.section = 'Bezel';
  basePlate.position.set(0, fanH / 2, 0.004);
  basePlate.castShadow = true;
  parent.add(basePlate);

  const frameBorder = 0.024;
  const borderThick = 0.014;

  const horizGeom = new THREE.BoxGeometry(fanW, frameBorder, borderThick);
  const topBorder = new THREE.Mesh(horizGeom, materials.metalChrome);
  topBorder.userData.section = 'Bezel';
  topBorder.position.set(0, fanH / 2 + halfH - frameBorder / 2, 0.008 + borderThick / 2);
  topBorder.castShadow = true;

  const botBorder = new THREE.Mesh(horizGeom, materials.metalChrome);
  botBorder.userData.section = 'Bezel';
  botBorder.position.set(0, fanH / 2 - halfH + frameBorder / 2, 0.008 + borderThick / 2);
  botBorder.castShadow = true;

  const vertGeom = new THREE.BoxGeometry(frameBorder, fanH - frameBorder * 2, borderThick);
  const leftBorder = new THREE.Mesh(vertGeom, materials.metalChrome);
  leftBorder.userData.section = 'Bezel';
  leftBorder.position.set(-halfW + frameBorder / 2, fanH / 2, 0.008 + borderThick / 2);
  leftBorder.castShadow = true;

  const rightBorder = new THREE.Mesh(vertGeom, materials.metalChrome);
  rightBorder.userData.section = 'Bezel';
  rightBorder.position.set(halfW - frameBorder / 2, fanH / 2, 0.008 + borderThick / 2);
  rightBorder.castShadow = true;

  const innerRingGeom = new THREE.TorusGeometry(ductRadius, 0.0055, 16, 36);
  const innerRing = new THREE.Mesh(innerRingGeom, materials.metalChrome);
  innerRing.userData.section = 'Bezel';
  innerRing.position.set(0, fanH / 2, 0.008 + borderThick);
  innerRing.castShadow = true;

  parent.add(topBorder, botBorder, leftBorder, rightBorder, innerRing);

  // 3. Internal Fan Impeller
  const fanCenterZ = 0.002;
  const hubRadius = ductRadius * 0.28;
  const hubDepth = 0.016;
  const hubGeom = new THREE.CylinderGeometry(hubRadius, hubRadius * 0.9, hubDepth, 24);
  const hub = new THREE.Mesh(hubGeom, materials.metalChrome);
  hub.userData.section = 'Fan Hub';
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, fanH / 2, fanCenterZ);
  hub.castShadow = true;

  const domeGeom = new THREE.SphereGeometry(hubRadius * 0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeom, materials.metalChrome);
  dome.userData.section = 'Fan Hub';
  dome.rotation.x = Math.PI / 2;
  dome.position.set(0, fanH / 2, fanCenterZ + hubDepth / 2);
  parent.add(hub, dome);

  // 7 Aerodynamic Curved Fan Blades
  const numBlades = 7;
  const bladeSpan = ductRadius - hubRadius - 0.004;
  for (let i = 0; i < numBlades; i++) {
    const angle = (i / numBlades) * Math.PI * 2;
    const bladeGeom = new THREE.BoxGeometry(0.003, bladeSpan, 0.012);
    const blade = new THREE.Mesh(bladeGeom, materials.metalChrome);
    blade.userData.section = 'Fan Blades';
    const rMid = hubRadius + bladeSpan / 2;
    blade.position.set(
      Math.cos(angle) * rMid,
      fanH / 2 + Math.sin(angle) * rMid,
      fanCenterZ
    );
    blade.rotation.z = angle - Math.PI / 2;
    blade.rotation.x = 0.45;
    blade.castShadow = true;
    parent.add(blade);
  }

  // Concentric diffuser guide ring around blades
  const diffuserRingGeom = new THREE.TorusGeometry(ductRadius * 0.62, 0.0025, 12, 32);
  const diffuserRing = new THREE.Mesh(diffuserRingGeom, materials.metalChrome);
  diffuserRing.userData.section = 'Fan Blades';
  diffuserRing.position.set(0, fanH / 2, fanCenterZ + 0.004);
  parent.add(diffuserRing);

  // 4. Front Horizontal Grille / Louvre Slats
  const grilleZ = 0.008 + borderThick + 0.003;
  const numSlats = 13;
  const slatStep = (ductRadius * 1.8) / (numSlats + 1);

  for (let i = 1; i <= numSlats; i++) {
    const yRel = -ductRadius * 0.9 + i * slatStep;
    const radSq = ductRadius * ductRadius;
    const ySq = yRel * yRel;
    if (ySq >= radSq) continue;
    const slatLen = 2 * Math.sqrt(radSq - ySq) * 0.98;
    if (slatLen < 0.02) continue;

    const slatGeom = new THREE.CylinderGeometry(0.0025, 0.0025, slatLen, 8);
    const slat = new THREE.Mesh(slatGeom, materials.metalChrome);
    slat.userData.section = 'Grille';
    slat.rotation.z = Math.PI / 2;
    slat.position.set(0, fanH / 2 + yRel, grilleZ);
    slat.castShadow = true;
    parent.add(slat);
  }

  // Vertical center stabilizer strut
  const strutGeom = new THREE.CylinderGeometry(0.002, 0.002, ductRadius * 1.82, 8);
  const strut = new THREE.Mesh(strutGeom, materials.metalChrome);
  strut.userData.section = 'Grille';
  strut.position.set(0, fanH / 2, grilleZ + 0.001);
  strut.castShadow = true;
  parent.add(strut);
}

export function buildTowelRack(context: AssetBuildContext): void {
  const { parent, w, materials } = context;
  const rackW = Math.max(w || 0.55, 0.50);
  const rackH = 0.045;
  const barW = rackW - 0.04;
  const wallPlateSize = 0.042;
  const wallPlateThick = 0.012;

  const plateGeom = new THREE.BoxGeometry(wallPlateSize, wallPlateSize, wallPlateThick);

  const leftPlate = new THREE.Mesh(plateGeom, materials.metalChrome);
  leftPlate.userData.section = 'Mounts';
  leftPlate.position.set(-rackW / 2 + wallPlateSize / 2, rackH / 2, wallPlateThick / 2);
  leftPlate.castShadow = true;
  leftPlate.receiveShadow = true;

  const rightPlate = new THREE.Mesh(plateGeom, materials.metalChrome);
  rightPlate.userData.section = 'Mounts';
  rightPlate.position.set(rackW / 2 - wallPlateSize / 2, rackH / 2, wallPlateThick / 2);
  rightPlate.castShadow = true;
  rightPlate.receiveShadow = true;

  const screwGeom = new THREE.CylinderGeometry(0.006, 0.006, 0.002, 16);
  const leftScrew = new THREE.Mesh(screwGeom, materials.metalChrome);
  leftScrew.userData.section = 'Mounts';
  leftScrew.rotation.x = Math.PI / 2;
  leftScrew.position.set(-rackW / 2 + wallPlateSize / 2, rackH / 2, wallPlateThick + 0.001);

  const rightScrew = new THREE.Mesh(screwGeom, materials.metalChrome);
  rightScrew.userData.section = 'Mounts';
  rightScrew.rotation.x = Math.PI / 2;
  rightScrew.position.set(rackW / 2 - wallPlateSize / 2, rackH / 2, wallPlateThick + 0.001);

  parent.add(leftPlate, rightPlate, leftScrew, rightScrew);

  const railThick = 0.008;
  const railHeight = 0.018;
  const railZ = wallPlateThick + railThick / 2;
  const railGeom = new THREE.BoxGeometry(barW, railHeight, railThick);
  const rail = new THREE.Mesh(railGeom, materials.metalChrome);
  rail.userData.section = 'Rail';
  rail.position.set(0, rackH / 2, railZ);
  rail.castShadow = true;
  parent.add(rail);

  const numHooks = 5;
  const hookCollarRadius = 0.010;
  const hookCollarDepth = 0.008;
  const pegRadius = 0.0075;
  const pegLength = 0.045;
  const pinRadius = 0.0065;
  const pinHeight = 0.024;

  const collarGeom = new THREE.CylinderGeometry(hookCollarRadius, hookCollarRadius, hookCollarDepth, 16);
  const pegGeom = new THREE.CylinderGeometry(pegRadius, pegRadius, pegLength, 16);
  const pinGeom = new THREE.CylinderGeometry(pinRadius, pinRadius, pinHeight, 16);
  const pinCapGeom = new THREE.SphereGeometry(pinRadius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);

  for (let i = 0; i < numHooks; i++) {
    const hx = -barW / 2 + (barW / (numHooks + 1)) * (i + 1);

    const collar = new THREE.Mesh(collarGeom, materials.metalChrome);
    collar.userData.section = 'Hooks';
    collar.rotation.x = Math.PI / 2;
    collar.position.set(hx, rackH / 2, railZ + railThick / 2 + hookCollarDepth / 2);
    collar.castShadow = true;

    const peg = new THREE.Mesh(pegGeom, materials.metalChrome);
    peg.userData.section = 'Hooks';
    peg.rotation.x = Math.PI / 2;
    peg.position.set(hx, rackH / 2, railZ + railThick / 2 + hookCollarDepth + pegLength / 2);
    peg.castShadow = true;

    const pin = new THREE.Mesh(pinGeom, materials.metalChrome);
    pin.userData.section = 'Hooks';
    const pinZ = railZ + railThick / 2 + hookCollarDepth + pegLength - pinRadius;
    const pinY = rackH / 2 + pinHeight / 2 - 0.002;
    pin.position.set(hx, pinY, pinZ);
    pin.castShadow = true;

    const cap = new THREE.Mesh(pinCapGeom, materials.metalChrome);
    cap.userData.section = 'Hooks';
    cap.position.set(hx, pinY + pinHeight / 2, pinZ);
    cap.castShadow = true;

    parent.add(collar, peg, pin, cap);
  }
}

export function buildSingleTowelHook(context: AssetBuildContext): void {
  const { parent, w, h, materials } = context;
  const hookH = h || 0.60;
  const hookW = w || 0.25;
  const hookY = Math.max(0.20, hookH - 0.08);

  const baseRadius = 0.024;
  const baseThick = 0.008;
  const escutcheon = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius, baseRadius, baseThick, 24),
    materials.metalChrome
  );
  escutcheon.userData.section = 'Hook';
  escutcheon.rotation.x = Math.PI / 2;
  escutcheon.position.set(0, hookY, baseThick / 2);
  escutcheon.castShadow = true;
  escutcheon.receiveShadow = true;

  const bevelRing = new THREE.Mesh(
    new THREE.TorusGeometry(baseRadius * 0.75, 0.002, 12, 24),
    materials.metalChrome
  );
  bevelRing.userData.section = 'Hook';
  bevelRing.position.set(0, hookY, baseThick + 0.001);

  const pegRadius = 0.007;
  const pegLength = 0.052;
  const peg = new THREE.Mesh(
    new THREE.CylinderGeometry(pegRadius, pegRadius, pegLength, 20),
    materials.metalChrome
  );
  peg.userData.section = 'Hook';
  peg.rotation.x = Math.PI / 2;
  peg.position.set(0, hookY, baseThick + pegLength / 2);
  peg.castShadow = true;

  const pinRadius = 0.0055;
  const pinHeight = 0.026;
  const pinZ = baseThick + pegLength - pinRadius;
  const pinY = hookY + pinHeight / 2 - 0.004;

  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(pinRadius, pinRadius, pinHeight, 16),
    materials.metalChrome
  );
  pin.userData.section = 'Hook';
  pin.position.set(0, pinY, pinZ);
  pin.castShadow = true;

  const domeCap = new THREE.Mesh(
    new THREE.SphereGeometry(pinRadius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.metalChrome
  );
  domeCap.userData.section = 'Hook';
  domeCap.position.set(0, pinY + pinHeight / 2, pinZ);
  domeCap.castShadow = true;

  parent.add(escutcheon, bevelRing, peg, pin, domeCap);

  // Towel fabric
  const towelW = Math.max(0.20, hookW * 0.88);
  const towelMat = materials.fabricLight;

  const loopZ = baseThick + pegLength * 0.50;
  const loopArch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, towelW, 16, 1, false, 0, Math.PI),
    towelMat
  );
  loopArch.userData.section = 'Towel';
  loopArch.rotation.z = Math.PI / 2;
  loopArch.position.set(0, hookY + 0.007, loopZ);
  loopArch.castShadow = true;
  loopArch.receiveShadow = true;

  const frontPanelH = hookY - 0.04;
  const frontPanel = new THREE.Mesh(
    new THREE.BoxGeometry(towelW, frontPanelH, 0.007),
    towelMat
  );
  frontPanel.userData.section = 'Towel';
  frontPanel.position.set(0, hookY - frontPanelH / 2 + 0.005, loopZ + 0.015);
  frontPanel.castShadow = true;
  frontPanel.receiveShadow = true;

  const pleatPanel = new THREE.Mesh(
    new THREE.BoxGeometry(towelW * 0.55, frontPanelH * 0.94, 0.004),
    towelMat
  );
  pleatPanel.userData.section = 'Towel';
  pleatPanel.position.set(0, hookY - frontPanelH / 2 + 0.008, loopZ + 0.019);
  pleatPanel.castShadow = true;
  pleatPanel.receiveShadow = true;

  const frontHem = new THREE.Mesh(
    new THREE.BoxGeometry(towelW * 1.01, 0.035, 0.009),
    towelMat
  );
  frontHem.userData.section = 'Towel';
  frontHem.position.set(0, hookY - frontPanelH + 0.018, loopZ + 0.016);
  frontHem.castShadow = true;

  const rearPanelH = hookY - 0.02;
  const rearPanel = new THREE.Mesh(
    new THREE.BoxGeometry(towelW, rearPanelH, 0.006),
    towelMat
  );
  rearPanel.userData.section = 'Towel';
  rearPanel.position.set(0, hookY - rearPanelH / 2 + 0.005, loopZ - 0.014);
  rearPanel.castShadow = true;
  rearPanel.receiveShadow = true;

  const rearHem = new THREE.Mesh(
    new THREE.BoxGeometry(towelW * 1.01, 0.035, 0.008),
    towelMat
  );
  rearHem.userData.section = 'Towel';
  rearHem.position.set(0, hookY - rearPanelH + 0.018, loopZ - 0.014);
  rearHem.castShadow = true;

  parent.add(loopArch, frontPanel, pleatPanel, frontHem, rearPanel, rearHem);
}

export function buildTowelBar(context: AssetBuildContext): void {
  const { parent, w, materials } = context;
  const barW = Math.max(w || 0.60, 0.40);
  const escutcheonRadius = 0.026;
  const escutcheonThick = 0.008;
  const stemLength = 0.065;
  const barRadius = 0.008;
  const spacing = barW - 0.08;

  for (const sign of [-1, 1]) {
    const esc = new THREE.Mesh(
      new THREE.CylinderGeometry(escutcheonRadius, escutcheonRadius, escutcheonThick, 20),
      materials.metalChrome
    );
    esc.userData.section = 'Mounts';
    esc.rotation.x = Math.PI / 2;
    esc.position.set((sign * spacing) / 2, 0.025, escutcheonThick / 2);
    esc.castShadow = true;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, stemLength, 16),
      materials.metalChrome
    );
    stem.userData.section = 'Mounts';
    stem.rotation.x = Math.PI / 2;
    stem.position.set((sign * spacing) / 2, 0.025, escutcheonThick + stemLength / 2);
    stem.castShadow = true;

    parent.add(esc, stem);
  }

  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(barRadius, barRadius, barW, 24),
    materials.metalChrome
  );
  bar.userData.section = 'Bar';
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.025, escutcheonThick + stemLength - barRadius);
  bar.castShadow = true;
  parent.add(bar);
}

export function buildToilet(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const toiletW = w || 0.38;
  const toiletH = h || 0.79;
  const toiletD = d || 0.65;
  const rimH = Math.min(0.42, toiletH * 0.53);

  // 1. Back Cistern Tank
  const tankW = toiletW * 0.94;
  const tankD = Math.min(0.18, toiletD * 0.28);
  const tankH = toiletH - rimH;
  const tankZ = -toiletD / 2 + tankD / 2;

  const tank = new THREE.Mesh(
    new THREE.BoxGeometry(tankW, tankH - 0.03, tankD),
    materials.ceramicWhite
  );
  tank.userData.section = 'Cistern';
  tank.position.set(0, rimH + (tankH - 0.03) / 2, tankZ);
  tank.castShadow = true;
  tank.receiveShadow = true;

  const lidH = 0.03;
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(tankW + 0.012, lidH, tankD + 0.012),
    materials.ceramicWhite
  );
  lid.userData.section = 'Lid';
  lid.position.set(0, toiletH - lidH / 2, tankZ);
  lid.castShadow = true;

  const btnGeom = new THREE.CylinderGeometry(0.024, 0.024, 0.005, 24);
  const flushBtn = new THREE.Mesh(btnGeom, materials.metalChrome);
  flushBtn.userData.section = 'Flush Button';
  flushBtn.position.set(0, toiletH + 0.002, tankZ);
  parent.add(tank, lid, flushBtn);

  // 2. Skirted Ceramic Bowl
  const bowlShape = new THREE.Shape();
  const halfW = (toiletW * 0.92) / 2;
  const backZ = -toiletD / 2;
  const frontZ = toiletD / 2 - halfW;

  bowlShape.moveTo(-halfW, backZ);
  bowlShape.lineTo(halfW, backZ);
  bowlShape.lineTo(halfW, frontZ);
  bowlShape.absarc(0, frontZ, halfW, 0, Math.PI, false);
  bowlShape.lineTo(-halfW, backZ);

  const extrudeSettings = {
    depth: rimH,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  };
  const bowlGeom = new THREE.ExtrudeGeometry(bowlShape, extrudeSettings);
  bowlGeom.rotateX(-Math.PI / 2);
  bowlGeom.translate(0, 0.008, 0);

  const bowl = new THREE.Mesh(bowlGeom, materials.ceramicWhite);
  bowl.userData.section = 'Bowl';
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  parent.add(bowl);

  const cavityRadius = halfW * 0.72;
  const cavityDepth = 0.16;
  const cavity = new THREE.Mesh(
    new THREE.CylinderGeometry(cavityRadius, cavityRadius * 0.65, cavityDepth, 24),
    materials.ceramicWhite
  );
  cavity.userData.section = 'Bowl';
  cavity.position.set(0, rimH - cavityDepth / 2 + 0.005, frontZ * 0.7);
  cavity.scale.set(1, 1, 1.25);
  parent.add(cavity);

  // 3. Seat and Lid
  const seatShape = new THREE.Shape();
  const seatHalfW = halfW * 0.98;
  const seatBackZ = tankZ + tankD / 2 + 0.01;
  const seatFrontZ = toiletD / 2 - seatHalfW;

  seatShape.moveTo(-seatHalfW, seatBackZ);
  seatShape.lineTo(seatHalfW, seatBackZ);
  seatShape.lineTo(seatHalfW, seatFrontZ);
  seatShape.absarc(0, seatFrontZ, seatHalfW, 0, Math.PI, false);
  seatShape.lineTo(-seatHalfW, seatBackZ);

  const seatGeom = new THREE.ExtrudeGeometry(seatShape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.004,
    bevelThickness: 0.004,
  });
  seatGeom.rotateX(-Math.PI / 2);
  seatGeom.translate(0, rimH + 0.006, 0);

  const seat = new THREE.Mesh(seatGeom, materials.ceramicWhite);
  seat.userData.section = 'Seat';
  seat.castShadow = true;
  parent.add(seat);

  const hingeL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.015, 12),
    materials.metalChrome
  );
  hingeL.userData.section = 'Hinges';
  hingeL.position.set(-0.07, rimH + 0.015, seatBackZ + 0.015);

  const hingeR = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.015, 12),
    materials.metalChrome
  );
  hingeR.userData.section = 'Hinges';
  hingeR.position.set(0.07, rimH + 0.015, seatBackZ + 0.015);
  parent.add(hingeL, hingeR);
}

export function buildLowerBasinCabinet(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const cabW = w || 0.80;
  const cabD = d || 0.42;
  const totalH = h || 0.52;
  const basinH = 0.08;
  const carcassH = totalH - basinH;

  // 1. Integrated Porcelain Basin Top
  const basinTopW = cabW + 0.01;
  const basinTopD = cabD + 0.01;
  const basinRim = new THREE.Mesh(
    new THREE.BoxGeometry(basinTopW, basinH, basinTopD),
    materials.ceramicWhite
  );
  basinRim.userData.section = 'Basin';
  basinRim.position.set(0, totalH - basinH / 2, 0.005);
  basinRim.castShadow = true;
  basinRim.receiveShadow = true;
  parent.add(basinRim);

  const sinkCavityW = Math.min(0.50, cabW * 0.65);
  const sinkCavityD = Math.min(0.28, cabD * 0.70);
  const sinkCavityH = 0.05;
  const sinkCavity = new THREE.Mesh(
    new THREE.BoxGeometry(sinkCavityW, sinkCavityH, sinkCavityD),
    materials.ceramicWhite
  );
  sinkCavity.userData.section = 'Basin';
  sinkCavity.position.set(0, totalH - basinH + sinkCavityH / 2 + 0.005, 0.02);
  parent.add(sinkCavity);

  const drain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16),
    materials.metalChrome
  );
  drain.userData.section = 'Basin';
  drain.position.set(0, totalH - basinH + 0.009, 0.02);
  parent.add(drain);

  // 2. Mixer Faucet
  const tapZ = -cabD / 2 + 0.07;
  const tapBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.02, 0.12, 16),
    materials.metalBlack
  );
  tapBase.userData.section = 'Faucet';
  tapBase.position.set(0, totalH + 0.06, tapZ);
  tapBase.castShadow = true;

  const tapSpout = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.016, 0.09),
    materials.metalBlack
  );
  tapSpout.userData.section = 'Faucet';
  tapSpout.position.set(0, totalH + 0.11, tapZ + 0.045);
  tapSpout.castShadow = true;

  const tapLever = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.008, 0.06),
    materials.metalBlack
  );
  tapLever.userData.section = 'Faucet';
  tapLever.position.set(0, totalH + 0.125, tapZ - 0.01);
  tapLever.rotation.x = -0.15;
  parent.add(tapBase, tapSpout, tapLever);

  // 3. Amber Glass Soap Bottle
  const bottleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.08, 16),
    materials.woodDark
  );
  bottleBody.userData.section = 'Bottle';
  bottleBody.position.set(cabW * 0.26, totalH + 0.04, tapZ + 0.02);
  const bottlePump = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.03, 12),
    materials.metalBlack
  );
  bottlePump.userData.section = 'Bottle';
  bottlePump.position.set(cabW * 0.26, totalH + 0.09, tapZ + 0.02);
  parent.add(bottleBody, bottlePump);

  // 4. Cabinet Carcass
  const carcassD = cabD - 0.02;
  const carcass = new THREE.Mesh(
    new THREE.BoxGeometry(cabW, carcassH, carcassD),
    materials.cabinetSage
  );
  carcass.userData.section = 'Cabinet';
  carcass.position.set(0, carcassH / 2, -0.01);
  carcass.castShadow = true;
  carcass.receiveShadow = true;
  parent.add(carcass);

  // 5. Fluted Doors
  const doorW = cabW / 2 - 0.002;
  const doorH = carcassH;
  const doorThick = 0.02;
  const doorZ = cabD / 2 - doorThick / 2;

  const leftDoor = new THREE.Mesh(
    new THREE.BoxGeometry(doorW, doorH, doorThick),
    materials.cabinetSage
  );
  leftDoor.userData.section = 'Doors';
  leftDoor.position.set(-cabW / 4, carcassH / 2, doorZ);
  leftDoor.castShadow = true;

  const rightDoor = new THREE.Mesh(
    new THREE.BoxGeometry(doorW, doorH, doorThick),
    materials.cabinetSage
  );
  rightDoor.userData.section = 'Doors';
  rightDoor.position.set(cabW / 4, carcassH / 2, doorZ);
  rightDoor.castShadow = true;

  const numSlats = 14;
  const slatStep = cabW / numSlats;
  const slatGroup = new THREE.Group();
  for (let i = 1; i < numSlats; i++) {
    if (i === numSlats / 2) continue;
    const sx = -cabW / 2 + i * slatStep;
    const slatLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.003, doorH * 0.98, 0.003),
      materials.metalBlack
    );
    slatLine.userData.section = 'Doors';
    slatLine.position.set(sx, carcassH / 2, doorZ + doorThick / 2 + 0.001);
    slatGroup.add(slatLine);
  }

  const topGrooveY = carcassH * 0.83;
  const topGroove = new THREE.Mesh(
    new THREE.BoxGeometry(cabW * 0.99, 0.004, 0.003),
    materials.metalBlack
  );
  topGroove.userData.section = 'Doors';
  topGroove.position.set(0, topGrooveY, doorZ + doorThick / 2 + 0.001);
  slatGroup.add(topGroove);

  parent.add(leftDoor, rightDoor, slatGroup);

  // 6. Handles
  const handleGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.14, 12);
  const handleY = carcassH * 0.62;
  const handleZ = doorZ + doorThick / 2 + 0.015;

  const leftHandle = new THREE.Mesh(handleGeom, materials.metalBlack);
  leftHandle.userData.section = 'Handles';
  leftHandle.position.set(-0.025, handleY, handleZ);
  leftHandle.castShadow = true;

  const rightHandle = new THREE.Mesh(handleGeom, materials.metalBlack);
  rightHandle.userData.section = 'Handles';
  rightHandle.position.set(0.025, handleY, handleZ);
  rightHandle.castShadow = true;

  parent.add(leftHandle, rightHandle);
}

export function buildUpperMirrorCabinet(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const cabW = w || 0.80;
  const cabH = h || 0.70;
  const cabD = d || 0.16;
  const doorThick = 0.015;
  const frameD = cabD - doorThick;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(cabW, cabH, frameD),
    materials.cabinetSage
  );
  frame.userData.section = 'Frame';
  frame.position.set(0, cabH / 2, -doorThick / 2);
  frame.castShadow = true;
  frame.receiveShadow = true;
  parent.add(frame);

  const leftDoorW = cabW * 0.625 - 0.002;
  const rightDoorW = cabW * 0.375 - 0.002;
  const mirrorZ = cabD / 2 - doorThick / 2;

  const leftMirror = new THREE.Mesh(
    new THREE.BoxGeometry(leftDoorW, cabH, doorThick),
    materials.mirrorNonReflective
  );
  leftMirror.userData.section = 'Mirrors';
  leftMirror.position.set(-cabW / 2 + leftDoorW / 2, cabH / 2, mirrorZ);
  leftMirror.castShadow = true;

  const rightMirror = new THREE.Mesh(
    new THREE.BoxGeometry(rightDoorW, cabH, doorThick),
    materials.mirrorNonReflective
  );
  rightMirror.userData.section = 'Mirrors';
  rightMirror.position.set(cabW / 2 - rightDoorW / 2, cabH / 2, mirrorZ);
  rightMirror.castShadow = true;

  const seamGap = new THREE.Mesh(
    new THREE.BoxGeometry(0.003, cabH, doorThick * 1.05),
    materials.metalBlack
  );
  seamGap.userData.section = 'Mirrors';
  seamGap.position.set(-cabW / 2 + leftDoorW + 0.0015, cabH / 2, mirrorZ);

  parent.add(leftMirror, rightMirror, seamGap);
}

export function buildBathroomSink(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const sinkH = h || 0.85;
  const vanity = new THREE.Mesh(new THREE.BoxGeometry(w, sinkH - 0.1, d), materials.woodLight);
  vanity.userData.section = 'Vanity';
  vanity.position.set(0, (sinkH - 0.1) / 2, 0);
  const basin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.1, d * 0.9), materials.ceramicWhite);
  basin.userData.section = 'Basin';
  basin.position.set(0, sinkH - 0.05, 0);
  parent.add(vanity, basin);
}

export function buildShower(context: AssetBuildContext): void {
  const { parent, w, d, materials } = context;
  const wallZ = -d / 2;
  const fixtureZ = wallZ + 0.055;

  const inletSpacing = 0.075;
  const mixerY = 1.05;

  for (const side of [-1, 1]) {
    const inletX = side * inletSpacing;

    const escutcheon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.012, 20),
      materials.metalChrome
    );
    escutcheon.userData.section = 'Mixer Faucet';
    escutcheon.rotation.x = Math.PI / 2;
    escutcheon.position.set(inletX, mixerY, wallZ + 0.006);
    escutcheon.castShadow = true;

    const connector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.045, 16),
      materials.metalChrome
    );
    connector.userData.section = 'Mixer Faucet';
    connector.rotation.x = Math.PI / 2;
    connector.position.set(inletX, mixerY, wallZ + 0.03);
    connector.castShadow = true;

    parent.add(escutcheon, connector);
  }

  const mixerBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.28, 24),
    materials.metalChrome
  );
  mixerBar.userData.section = 'Mixer Faucet';
  mixerBar.rotation.z = Math.PI / 2;
  mixerBar.position.set(0, mixerY, fixtureZ);
  mixerBar.castShadow = true;

  const leftKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.023, 0.045, 20),
    materials.metalChrome
  );
  leftKnob.userData.section = 'Mixer Faucet';
  leftKnob.rotation.z = Math.PI / 2;
  leftKnob.position.set(-0.16, mixerY, fixtureZ);
  leftKnob.castShadow = true;

  const rightKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.023, 0.045, 20),
    materials.metalChrome
  );
  rightKnob.userData.section = 'Mixer Faucet';
  rightKnob.rotation.z = Math.PI / 2;
  rightKnob.position.set(0.16, mixerY, fixtureZ);
  rightKnob.castShadow = true;

  const hoseOutlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.03, 14),
    materials.metalChrome
  );
  hoseOutlet.userData.section = 'Mixer Faucet';
  hoseOutlet.position.set(0, mixerY - 0.022, fixtureZ);
  hoseOutlet.castShadow = true;

  parent.add(mixerBar, leftKnob, rightKnob, hoseOutlet);

  const columnBaseY = mixerY + 0.022;
  const columnTopY = 2.15;
  const columnLength = columnTopY - columnBaseY;

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, columnLength, 18),
    materials.metalChrome
  );
  column.userData.section = 'Column';
  column.position.set(0, columnBaseY + columnLength / 2, fixtureZ);
  column.castShadow = true;

  const anchorY = 2.05;
  const topAnchorEscutcheon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16),
    materials.metalChrome
  );
  topAnchorEscutcheon.userData.section = 'Column';
  topAnchorEscutcheon.rotation.x = Math.PI / 2;
  topAnchorEscutcheon.position.set(0, anchorY, wallZ + 0.005);

  const topAnchorStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.05, 12),
    materials.metalChrome
  );
  topAnchorStem.userData.section = 'Column';
  topAnchorStem.rotation.x = Math.PI / 2;
  topAnchorStem.position.set(0, anchorY, wallZ + 0.03);

  const topAnchorCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.025, 16),
    materials.metalChrome
  );
  topAnchorCollar.userData.section = 'Column';
  topAnchorCollar.position.set(0, anchorY, fixtureZ);

  parent.add(column, topAnchorEscutcheon, topAnchorStem, topAnchorCollar);

  const armReach = Math.min(0.38, Math.max(0.25, d * 0.45));
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, armReach, 18),
    materials.metalChrome
  );
  arm.userData.section = 'Rain Shower';
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, columnTopY, fixtureZ + armReach / 2);
  arm.castShadow = true;

  const elbow = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 14, 14),
    materials.metalChrome
  );
  elbow.userData.section = 'Rain Shower';
  elbow.position.set(0, columnTopY, fixtureZ);

  const rainHeadZ = fixtureZ + armReach;
  const dropTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.04, 12),
    materials.metalChrome
  );
  dropTube.userData.section = 'Rain Shower';
  dropTube.position.set(0, columnTopY - 0.02, rainHeadZ);

  const swivelBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 14, 14),
    materials.metalChrome
  );
  swivelBall.userData.section = 'Rain Shower';
  swivelBall.position.set(0, columnTopY - 0.045, rainHeadZ);

  const headSize = 0.24;
  const headThickness = 0.012;
  const headY = columnTopY - 0.055;

  const rainPlate = new THREE.Mesh(
    new THREE.BoxGeometry(headSize, headThickness, headSize),
    materials.metalChrome
  );
  rainPlate.userData.section = 'Rain Shower';
  rainPlate.position.set(0, headY, rainHeadZ);
  rainPlate.castShadow = true;

  const nozzleFace = new THREE.Mesh(
    new THREE.BoxGeometry(headSize * 0.92, 0.003, headSize * 0.92),
    materials.ceramicWhite
  );
  nozzleFace.userData.section = 'Rain Shower';
  nozzleFace.position.set(0, headY - headThickness / 2 - 0.001, rainHeadZ);

  parent.add(arm, elbow, dropTube, swivelBall, rainPlate, nozzleFace);

  const wandSliderY = 1.38;
  const wandX = 0.07;
  const wandZ = fixtureZ + 0.02;

  const sliderSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.035, 14),
    materials.metalChrome
  );
  sliderSleeve.userData.section = 'Hand Shower';
  sliderSleeve.position.set(0, wandSliderY, fixtureZ);

  const bracketArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, wandX, 10),
    materials.metalChrome
  );
  bracketArm.userData.section = 'Hand Shower';
  bracketArm.rotation.z = Math.PI / 2;
  bracketArm.position.set(wandX / 2, wandSliderY, fixtureZ);

  const wandCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.011, 0.035, 14),
    materials.metalChrome
  );
  wandCup.userData.section = 'Hand Shower';
  wandCup.rotation.x = -Math.PI / 10;
  wandCup.position.set(wandX, wandSliderY, wandZ);

  const wand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.18, 16),
    materials.metalChrome
  );
  wand.userData.section = 'Hand Shower';
  wand.rotation.x = -Math.PI / 10;
  wand.position.set(wandX, wandSliderY + 0.06, wandZ + 0.015);
  wand.castShadow = true;

  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, mixerY - 0.03, fixtureZ),
    new THREE.Vector3(0.01, mixerY - 0.15, fixtureZ + 0.03),
    new THREE.Vector3(0.025, 0.72, fixtureZ + 0.04),
    new THREE.Vector3(0.05, 0.74, fixtureZ + 0.04),
    new THREE.Vector3(0.07, mixerY - 0.10, fixtureZ + 0.03),
    new THREE.Vector3(wandX, wandSliderY - 0.02, wandZ - 0.01),
  ]);
  const hoseGeom = new THREE.TubeGeometry(hoseCurve, 20, 0.006, 8, false);
  const hose = new THREE.Mesh(hoseGeom, materials.metalChrome);
  hose.userData.section = 'Hand Shower';
  hose.castShadow = true;

  parent.add(sliderSleeve, bracketArm, wandCup, wand, hose);

  if (w >= 0.65 && d >= 0.65) {
    const trayH = 0.035;
    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(w, trayH, d),
      materials.ceramicWhite
    );
    tray.userData.section = 'Shower Tray';
    tray.position.set(0, trayH / 2, 0);
    tray.receiveShadow = true;

    const drain = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.003, 0.10),
      materials.metalChrome
    );
    drain.userData.section = 'Shower Tray';
    drain.position.set(w / 2 - 0.15, trayH + 0.001, wallZ + 0.15);

    const glassThick = 0.008;
    const glassH = 2.0;
    const glassD = d * 0.72;
    const screenX = -w / 2 + 0.02;
    const screenCenterZ = wallZ + glassD / 2;

    const glassScreen = new THREE.Mesh(
      new THREE.BoxGeometry(glassThick, glassH, glassD),
      materials.glass
    );
    glassScreen.userData.section = 'Glass Screen';
    glassScreen.position.set(screenX, glassH / 2, screenCenterZ);

    const wallProfile = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, glassH, 0.016),
      materials.metalChrome
    );
    wallProfile.userData.section = 'Column';
    wallProfile.position.set(screenX, glassH / 2, wallZ + 0.008);

    const floorProfile = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.016, glassD),
      materials.metalChrome
    );
    floorProfile.userData.section = 'Column';
    floorProfile.position.set(screenX, trayH + 0.008, screenCenterZ);

    const stabilizerBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, glassD, 12),
      materials.metalChrome
    );
    stabilizerBar.userData.section = 'Column';
    stabilizerBar.rotation.x = Math.PI / 2;
    stabilizerBar.position.set(screenX, glassH, screenCenterZ);

    parent.add(tray, drain, glassScreen, wallProfile, floorProfile, stabilizerBar);
  }
}

export function buildMirror(context: AssetBuildContext): void {
  const { parent, w, h, materials } = context;
  const mirrorH = h || 0.9;
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(w, mirrorH, 0.03), materials.mirror);
  mirror.userData.section = 'Mirror Glass';
  mirror.position.set(0, mirrorH / 2, 0);
  parent.add(mirror);
}

export function buildWallRecess(context: AssetBuildContext): void {
  const { parent, entity, w, h, d, materials } = context;
  const recessW = Math.max(0.1, w || 1.2);
  const recessH = Math.max(0.1, h || 1.7);

  // Recess depth MUST cleanly match or exceed wall thickness so the cutout is fully sleeved without any hollow gaps
  const wallT = Math.max(
    0.05,
    (entity.rawItem?.wallThickness as number) ||
    (entity.rawItem?.depth ? entity.rawItem.depth / 100 : 0) ||
    0.10
  );
  const recessD = Math.max(wallT, (d && d > 0.05 ? d : wallT));

  const halfW = recessW / 2;
  const zFront = wallT / 2;
  const zBack = zFront - recessD;
  const zCover = Math.min(-wallT / 2, zBack);

  // 1. Back Wall Panel of the niche (faces +Z towards room / viewer)
  const backGeom = new THREE.PlaneGeometry(recessW, recessH);
  const backPanel = new THREE.Mesh(backGeom, materials.ceramicWhite);
  backPanel.userData.section = 'Recess Wall';
  backPanel.position.set(0, recessH / 2, zBack);
  backPanel.castShadow = false;
  backPanel.receiveShadow = true;

  // 2. Shelf (Bottom horizontal return, faces +Y upwards)
  const shelfGeom = new THREE.PlaneGeometry(recessW, recessD);
  const shelf = new THREE.Mesh(shelfGeom, materials.ceramicWhite);
  shelf.userData.section = 'Sides';
  shelf.rotation.x = -Math.PI / 2;
  shelf.position.set(0, 0, zFront - recessD / 2);
  shelf.castShadow = false;
  shelf.receiveShadow = true;

  // 3. Soffit (Top horizontal return, faces -Y downwards)
  const soffitGeom = new THREE.PlaneGeometry(recessW, recessD);
  const soffit = new THREE.Mesh(soffitGeom, materials.ceramicWhite);
  soffit.userData.section = 'Sides';
  soffit.rotation.x = Math.PI / 2;
  soffit.position.set(0, recessH, zFront - recessD / 2);
  soffit.castShadow = false;
  soffit.receiveShadow = true;

  // 4. Left Jamb (Left vertical return, faces +X inward)
  const leftJambGeom = new THREE.PlaneGeometry(recessD, recessH);
  const leftJamb = new THREE.Mesh(leftJambGeom, materials.ceramicWhite);
  leftJamb.userData.section = 'Sides';
  leftJamb.rotation.y = Math.PI / 2;
  leftJamb.position.set(-halfW, recessH / 2, zFront - recessD / 2);
  leftJamb.castShadow = false;
  leftJamb.receiveShadow = true;

  // 5. Right Jamb (Right vertical return, faces -X inward)
  const rightJambGeom = new THREE.PlaneGeometry(recessD, recessH);
  const rightJamb = new THREE.Mesh(rightJambGeom, materials.ceramicWhite);
  rightJamb.userData.section = 'Sides';
  rightJamb.rotation.y = -Math.PI / 2;
  rightJamb.position.set(halfW, recessH / 2, zFront - recessD / 2);
  rightJamb.castShadow = false;
  rightJamb.receiveShadow = true;

  // 6. Back Cover Panel (seals the cutout on Side B / adjacent room, faces -Z)
  const coverGeom = new THREE.PlaneGeometry(recessW, recessH);
  const backCover = new THREE.Mesh(coverGeom, materials.ceramicWhite);
  backCover.userData.section = 'Back';
  backCover.rotation.y = Math.PI;
  backCover.position.set(0, recessH / 2, zCover);
  backCover.castShadow = true;
  backCover.receiveShadow = true;

  parent.add(backPanel, shelf, soffit, leftJamb, rightJamb, backCover);
}

