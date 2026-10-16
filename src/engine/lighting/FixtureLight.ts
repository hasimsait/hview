import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export type FixtureLight = THREE.PointLight | THREE.SpotLight | THREE.RectAreaLight;
export type FixtureType = 'chandelier' | 'spot';
let areaLightsReady = false;

/** Visible sources use the same metadata for per-fixture controls and the mobile light budget. */
export function addFixtureLight(parent: THREE.Object3D, position: [number, number, number], intensity: number,
  distance = 8, fixtureType: FixtureType = 'spot', direction?: [number, number, number], angle = Math.PI / 3): FixtureLight {
  const color = 0xfff2dc;
  const light = direction ? new THREE.SpotLight(color, intensity, distance, angle, .5, 2) : new THREE.PointLight(color, intensity, distance, 2);
  light.name = 'fixtureLight'; light.position.set(...position);
  light.userData = { isFixtureLight: true, fixtureType, baseIntensity: intensity, baseDistance: distance, baseColor: color };
  if (light instanceof THREE.SpotLight && direction) {
    light.target.position.copy(light.position).add(new THREE.Vector3(...direction)); parent.add(light.target);
  }
  parent.add(light); return light;
}

export function isFixtureLight(object: THREE.Object3D): object is FixtureLight {
  return (object instanceof THREE.PointLight || object instanceof THREE.SpotLight || object instanceof THREE.RectAreaLight) && object.userData.isFixtureLight === true;
}

/** A continuous strip emitter avoids separate spotlight pools on a nearby ceiling. */
export function addStripAreaLight(parent: THREE.Object3D, position: [number, number, number], width: number, depth: number): THREE.RectAreaLight {
  if (!areaLightsReady) { RectAreaLightUniformsLib.init(); areaLightsReady = true; }
  const light = new THREE.RectAreaLight(0xfff2dc, 150, width, depth);
  light.name = 'fixtureLight'; light.position.set(...position); light.rotation.x = Math.PI / 2;
  light.userData = { isFixtureLight: true, fixtureType: 'spot', baseIntensity: 150, baseColor: 0xfff2dc };
  parent.add(light); return light;
}
