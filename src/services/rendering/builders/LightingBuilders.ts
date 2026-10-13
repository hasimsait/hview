import * as THREE from 'three';
import { AssetBuildContext } from './AssetBuildContext';

export function buildChandelier(context: AssetBuildContext): void {
  const { parent, w, d, materials } = context;
  const radius = Math.min(w, d) / 2 || 0.32;
  const hangHeight = 0.55; // Distance up to ceiling

  // Ceiling mount canopy plate
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 24), materials.metalBlack);
  canopy.position.set(0, hangHeight, 0);
  parent.add(canopy);

  // Central suspension cord / rod from canopy to fixture
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, hangHeight, 8), materials.metalBlack);
  cord.position.set(0, hangHeight / 2, 0);
  parent.add(cord);

  // Modern architectural ring chandelier with warm LED globes
  const mainRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.018, 16, 36),
    materials.metalBlack
  );
  mainRing.rotation.x = Math.PI / 2;
  mainRing.position.set(0, 0, 0);
  parent.add(mainRing);

  // 4 glowing globes
  const globeCount = 4;
  for (let i = 0; i < globeCount; i++) {
    const ang = (i * Math.PI * 2) / globeCount;
    const globeMat = materials.warmLightGlow.clone();
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), globeMat);
    globe.userData.isLightEmissive = true;
    globe.position.set(Math.cos(ang) * radius, 0, Math.sin(ang) * radius);
    parent.add(globe);
  }

  // Warm ambient point light cast into the room
  const light = new THREE.PointLight(0xfff2dc, 0.85, 7.0, 1.8);
  light.name = 'fixtureLight';
  light.userData = {
    isFixtureLight: true,
    fixtureType: 'chandelier',
    baseIntensity: 0.85,
    baseDistance: 7.0,
    baseColor: 0xfff2dc,
  };
  light.position.set(0, -0.1, 0);
  parent.add(light);
}

export function buildCascadingChandelier(context: AssetBuildContext): void {
  const { parent, w, d, materials } = context;
  const radius = Math.min(w, d) / 2 || 0.32;
  const hangHeight = 0.55;

  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 24), materials.metalBlack);
  canopy.position.set(0, hangHeight, 0);
  parent.add(canopy);

  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, hangHeight, 8), materials.metalBlack);
  cord.position.set(0, hangHeight / 2, 0);
  parent.add(cord);

  // Multi-tier cascading luxury chandelier (concentric glowing rings)
  const tiers = [
    { r: radius, y: 0, thick: 0.016 },
    { r: radius * 0.68, y: -0.14, thick: 0.014 },
    { r: radius * 0.38, y: -0.26, thick: 0.012 },
  ];

  for (const tier of tiers) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(tier.r, tier.thick, 16, 36),
      materials.metalBrass
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, tier.y, 0);
    parent.add(ring);

    const glowMat = materials.warmLightGlow.clone();
    const glow = new THREE.Mesh(
      new THREE.TorusGeometry(tier.r * 0.96, tier.thick * 0.8, 12, 36),
      glowMat
    );
    glow.userData.isLightEmissive = true;
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, tier.y, 0);
    parent.add(glow);
  }

  const light = new THREE.PointLight(0xfff2dc, 0.85, 7.0, 1.8);
  light.name = 'fixtureLight';
  light.userData = {
    isFixtureLight: true,
    fixtureType: 'chandelier',
    baseIntensity: 0.85,
    baseDistance: 7.0,
    baseColor: 0xfff2dc,
  };
  light.position.set(0, -0.1, 0);
  parent.add(light);
}

export function buildCylinderSpotlight(context: AssetBuildContext): void {
  const { parent, w, h, d, materials } = context;
  const spotH = h || 0.14;
  const radius = Math.min(w, d) / 2 || 0.045;

  // 1. Ceiling mount base plate (touches ceiling at Y = spotH)
  const basePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, 0.008, 24),
    materials.metalBlack
  );
  basePlate.userData.section = 'Housing';
  basePlate.position.set(0, spotH - 0.004, 0);
  basePlate.castShadow = true;

  // 2. Main cylindrical housing body
  const bodyH = spotH - 0.008;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, bodyH, 28),
    materials.metalBlack
  );
  body.userData.section = 'Housing';
  body.position.set(0, bodyH / 2, 0);
  body.castShadow = true;

  // 3. Deeply recessed anti-glare reflector / bevel at bottom
  const reflectorH = 0.025;
  const reflector = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.82, radius * 0.65, reflectorH, 24, 1, true),
    materials.metalBlack
  );
  reflector.userData.section = 'Reflector';
  reflector.position.set(0, reflectorH / 2 + 0.002, 0);

  // 4. Recessed glowing LED diffuser lens
  const lensRadius = radius * 0.64;
  const lensMat = materials.warmLightGlow.clone();
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(lensRadius, lensRadius, 0.006, 24),
    lensMat
  );
  lens.userData.section = 'Lens';
  lens.userData.isLightEmissive = true;
  lens.position.set(0, reflectorH + 0.003, 0);

  // 5. Downward architectural point light
  const light = new THREE.PointLight(0xfff5ea, 0.75, 5.0, 2);
  light.name = 'fixtureLight';
  light.userData = {
    isFixtureLight: true,
    fixtureType: 'spot',
    baseIntensity: 0.75,
    baseDistance: 5.0,
    baseColor: 0xfff5ea,
  };
  light.position.set(0, 0.01, 0);

  parent.add(basePlate, body, reflector, lens, light);
}

export function buildSpotlight(context: AssetBuildContext): void {
  const { parent, w, d, materials } = context;
  const radius = Math.min(w, d) / 2 || 0.06;

  // Recessed circular bezel flush with ceiling
  const bezel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.015, 24),
    materials.ceramicWhite
  );
  bezel.position.set(0, 0, 0);

  // Glowing diffuser disc
  const lensMat = materials.warmLightGlow.clone();
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, 0.016, 24),
    lensMat
  );
  lens.userData.section = 'Diffuser';
  lens.userData.isLightEmissive = true;
  lens.position.set(0, -0.001, 0);

  // Subtle downlight
  const light = new THREE.PointLight(0xfff5ea, 0.5, 4.0, 2);
  light.name = 'fixtureLight';
  light.userData = {
    isFixtureLight: true,
    fixtureType: 'spot',
    baseIntensity: 0.5,
    baseDistance: 4.0,
    baseColor: 0xfff5ea,
  };
  light.position.set(0, -0.05, 0);

  parent.add(bezel, lens, light);
}

export function buildWallSpot(context: AssetBuildContext): void {
  const { parent, materials } = context;

  // Wall mounting plate
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.015, 20),
    materials.metalBlack
  );
  plate.userData.section = 'Mount';
  plate.rotation.x = Math.PI / 2;
  plate.position.set(0, 0, -0.01);

  // Extension arm
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.06, 12),
    materials.metalBrass
  );
  arm.userData.section = 'Arm';
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, 0, 0.02);

  // Spotlight cylinder head angled downwards
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 0.09, 20),
    materials.metalBlack
  );
  head.userData.section = 'Head';
  head.rotation.x = Math.PI / 4; // 45 deg tilt down
  head.position.set(0, -0.01, 0.06);

  // Glowing bulb
  const bulbMat = materials.warmLightGlow.clone();
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 16), bulbMat);
  bulb.userData.section = 'Bulb';
  bulb.userData.isLightEmissive = true;
  bulb.position.set(0, -0.04, 0.09);

  const light = new THREE.PointLight(0xfff0d0, 0.45, 3.5, 2);
  light.name = 'fixtureLight';
  light.userData = {
    isFixtureLight: true,
    fixtureType: 'spot',
    baseIntensity: 0.45,
    baseDistance: 3.5,
    baseColor: 0xfff0d0,
  };
  light.position.set(0, -0.05, 0.1);

  parent.add(plate, arm, head, bulb, light);
}

export function buildVanitySconce80(context: AssetBuildContext): void {
  const { parent, w, d, materials } = context;
  const sconceW = w || 0.80; // Exactly 80cm default
  const sconceD = d || 0.13; // Forward reach

  // 1. Wall Mounting Stadium/Capsule Base Plate (Section: 'Mount')
  const plateW = 0.16;
  const plateH = 0.038;
  const plateThick = 0.010;

  // Capsule central body
  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(plateW, plateH, plateThick),
    materials.metalChrome
  );
  basePlate.userData.section = 'Mount';
  basePlate.position.set(0, 0, plateThick / 2);
  basePlate.castShadow = true;

  // Capsule rounded end caps
  const capGeom = new THREE.CylinderGeometry(plateH / 2, plateH / 2, plateThick, 16);
  const leftCap = new THREE.Mesh(capGeom, materials.metalChrome);
  leftCap.userData.section = 'Mount';
  leftCap.position.set(-plateW / 2, 0, plateThick / 2);

  const rightCap = new THREE.Mesh(capGeom, materials.metalChrome);
  rightCap.userData.section = 'Mount';
  rightCap.position.set(plateW / 2, 0, plateThick / 2);

  // Central circular rosette / junction cover accent
  const rosette = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.003, 20),
    materials.metalChrome
  );
  rosette.userData.section = 'Mount';
  rosette.rotation.x = Math.PI / 2;
  rosette.position.set(0, 0, plateThick + 0.0015);

  parent.add(basePlate, leftCap, rightCap, rosette);

  // 2. Dual Angled Cantilever Support Arms (Section: 'Arms')
  const armSpacing = 0.36;
  const armReach = sconceD - plateThick - 0.016;
  const armThickness = 0.010;

  for (const sign of [-1, 1]) {
    const armX = (sign * armSpacing) / 2;

    const socket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.008, 16),
      materials.metalChrome
    );
    socket.userData.section = 'Arms';
    socket.rotation.x = Math.PI / 2;
    socket.position.set(armX, 0, plateThick + 0.004);
    socket.castShadow = true;

    const armBar = new THREE.Mesh(
      new THREE.BoxGeometry(armThickness, armThickness, armReach),
      materials.metalChrome
    );
    armBar.userData.section = 'Arms';
    armBar.position.set(armX, 0, plateThick + armReach / 2);
    armBar.castShadow = true;

    const knuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.018, 16),
      materials.metalChrome
    );
    knuckle.userData.section = 'Arms';
    knuckle.rotation.z = Math.PI / 2;
    knuckle.position.set(armX, 0, plateThick + armReach);
    knuckle.castShadow = true;

    parent.add(socket, armBar, knuckle);
  }

  // 3. 80cm Linear Light Bar Chassis (Section: 'Light Bar')
  const chassisZ = plateThick + armReach + 0.014;
  const chassisH = 0.024;
  const chassisD = 0.028;

  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(sconceW, chassisH, chassisD),
    materials.metalChrome
  );
  chassis.userData.section = 'Light Bar';
  chassis.position.set(0, 0, chassisZ);
  chassis.castShadow = true;

  const endCapGeom = new THREE.BoxGeometry(0.003, chassisH * 1.02, chassisD * 1.02);
  const leftEnd = new THREE.Mesh(endCapGeom, materials.metalChrome);
  leftEnd.userData.section = 'Light Bar';
  leftEnd.position.set(-sconceW / 2 - 0.0015, 0, chassisZ);

  const rightEnd = new THREE.Mesh(endCapGeom, materials.metalChrome);
  rightEnd.userData.section = 'Light Bar';
  rightEnd.position.set(sconceW / 2 + 0.0015, 0, chassisZ);

  parent.add(chassis, leftEnd, rightEnd);

  // 4. Downward Recessed Full-Length Frosted LED Diffuser (Section: 'Diffuser')
  const diffuserW = sconceW - 0.016;
  const diffuserD = chassisD - 0.006;
  const diffuserMat = materials.warmLightGlow.clone();
  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(diffuserW, 0.004, diffuserD),
    diffuserMat
  );
  diffuser.userData.section = 'Diffuser';
  diffuser.userData.isLightEmissive = true;
  diffuser.position.set(0, -chassisH / 2 - 0.001, chassisZ);
  parent.add(diffuser);

  // 5. Active Warm Architectural Fixture Light
  const light = new THREE.PointLight(0xfff5ea, 0.75, 4.5, 2);
  light.name = 'fixtureLight';
  light.userData = {
    isFixtureLight: true,
    fixtureType: 'spot',
    baseIntensity: 0.75,
    baseDistance: 4.5,
    baseColor: 0xfff5ea,
  };
  light.position.set(0, -0.04, chassisZ);
  parent.add(light);
}
