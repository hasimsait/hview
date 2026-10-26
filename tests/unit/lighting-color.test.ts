import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Luminaire } from '../../src/domain/elements/Furniture';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { addFixtureLight, addStripAreaLight } from '../../src/engine/lighting/FixtureLight';
import { whiteLightColor } from '../../src/engine/lighting/WhiteLight';
import { whiteBalanceMatrix } from '../../src/engine/lighting/WhiteBalance';
import { emitterSurfaceArea } from '../../src/engine/lighting/EmitterSurface';
import { FurnitureAppearance } from '../../src/engine/materials/FurnitureAppearance';
import { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import type { ViewportSettings } from '../../src/core/types/services';

function lamp() {
  return new Luminaire({ id:'lamp',name:'Lamp',displayName:'Lamp',assetKey:'chandelier',category:'decor',
    position:{x:0,y:0,z:0},dimensions:{x:.6,y:.6,z:.6},rotationY:0,
    lightConfig:{temperatureKelvin:2700,lumens:806,intensity:1,color:'#123456'} });
}

describe('white-light color and photometric controls', () => {
  it('keeps the approved 6500 K view unchanged and adapts a warm neutral surface to that reference',()=>{
    expect(whiteBalanceMatrix(6500).elements).toEqual(new THREE.Matrix3().elements);
    const reference=whiteLightColor(6500);
    for(const kelvin of [2700,3000,3500,4000,5500]){
      const source=whiteLightColor(kelvin);
      const adapted=new THREE.Vector3(source.r,source.g,source.b).applyMatrix3(whiteBalanceMatrix(kelvin));
      expect(adapted.x).toBeCloseTo(reference.r,6);expect(adapted.y).toBeCloseTo(reference.g,6);expect(adapted.z).toBeCloseTo(reference.b,6);
    }
  });
  it.each([[2700,.45931,.41066],[6500,.31349,.32366]])('approximates the %i K locus independently of display gamma', (kelvin,x,y) => {
    const c=whiteLightColor(kelvin);
    const X=.4124564*c.r+.3575761*c.g+.1804375*c.b;
    const Y=.2126729*c.r+.7151522*c.g+.072175*c.b;
    const Z=.0193339*c.r+.119192*c.g+.9503041*c.b;
    expect(X/(X+Y+Z)).toBeCloseTo(x,4);expect(Y/(X+Y+Z)).toBeCloseTo(y,4);
    expect(Y).toBeCloseTo(1,6);
  });

  it('retains a warm neutral at partial adaptation without changing luminance or the cool reference', () => {
    const source = whiteLightColor(2700), reference = whiteLightColor(6500);
    const unadapted = new THREE.Vector3(source.r, source.g, source.b);
    expect(unadapted.clone().applyMatrix3(whiteBalanceMatrix(2700, 0)).toArray()).toEqual(unadapted.toArray());
    const partial = unadapted.clone().applyMatrix3(whiteBalanceMatrix(2700, .75));
    const expected = unadapted.clone().lerp(new THREE.Vector3(reference.r, reference.g, reference.b), .75);
    expect(partial.distanceTo(expected)).toBeLessThan(1e-6);
    expect(partial.x / partial.z).toBeGreaterThan(1.3);
    expect(.2126729 * partial.x + .7151522 * partial.y + .072175 * partial.z).toBeCloseTo(1, 6);
    expect(whiteBalanceMatrix(6500, .75).elements).toEqual(new THREE.Matrix3().elements);
  });

  it('makes visible emitters follow physical output, dimming and resized surface area', () => {
    const root = new THREE.Group(), settings = { chandelierIntensity: 1 } as ViewportSettings;
    addFixtureLight(root, [0, 1, 0], 20, 9, 'chandelier');
    const panels = [1, 2].map(width => {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, 1), new THREE.MeshBasicMaterial());
      panel.userData.isLightEmissive = true; root.add(panel); return panel;
    });
    const resources = new ResourcePool();
    const appearance = new FurnitureAppearance({} as SurfaceMaterialFactory, resources, () => settings, () => undefined);
    const entity = lamp();
    const luminance = (panel: typeof panels[number]) => {
      const c = panel.material.color; return .2126729 * c.r + .7151522 * c.g + .072175 * c.b;
    };
    const power = () => panels.reduce((sum, panel) => sum + Math.PI * emitterSurfaceArea(panel) * luminance(panel), 0);
    appearance.applyLighting(root, entity);
    expect(power()).toBeCloseTo(806, 6);
    expect(panels[0].material.color.r / panels[0].material.color.b).toBeCloseTo(whiteLightColor(2700).r / whiteLightColor(2700).b, 6);
    panels[0].scale.set(2, 3, 1); root.scale.set(2, 1, 1);
    appearance.applyLighting(root, entity);
    expect(emitterSurfaceArea(panels[0])).toBeCloseTo(12, 6);
    expect(power()).toBeCloseTo(806, 6);
    settings.chandelierIntensity = .5;
    appearance.applyLighting(root, entity.withEmission({ intensity: .25 }));
    expect(power()).toBeCloseTo(806 / 8, 6);
    appearance.applyLighting(root, entity.withEmission({ lumens: 0 }));
    expect(panels[0].material.color.getHex()).toBe(0x334155);
    resources.ownTree(root).dispose();
  });

  it('invalidates emitting area after geometry edits and index replacement', () => {
    const geometry = new THREE.BufferGeometry();
    const position = new THREE.Float32BufferAttribute([0,0,0, 2,0,0, 0,1,0, 0,2,0], 3);
    geometry.setAttribute('position', position); geometry.setIndex([0,1,2]);
    const panel = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    expect(emitterSurfaceArea(panel)).toBe(1);
    geometry.setIndex([0,1,3]); expect(emitterSurfaceArea(panel)).toBe(2);
    position.setY(3, 3); position.needsUpdate = true; expect(emitterSurfaceArea(panel)).toBe(3);
    geometry.dispose(); panel.material.dispose();
  });

  it('keeps nominal luminance constant across the supported temperatures', () => {
    for (const temperature of [2700,3000,3500,4000,5500,6500]) {
      const c=whiteLightColor(temperature);
      expect(.2126729*c.r+.7151522*c.g+.072175*c.b).toBeCloseTo(1,6);
      expect(Math.min(c.r,c.g,c.b)).toBeGreaterThan(0);
    }
  });

  it('shares total lumens across point, spot and area emitters and dims without changing range', () => {
    const root=new THREE.Group(), settings={spotLightIntensity:1,chandelierIntensity:1} as ViewportSettings;
    const emitters=[addFixtureLight(root,[0,1,0],20,9),addFixtureLight(root,[1,1,0],30,8,'spot',[0,-1,0]),addStripAreaLight(root,[0,2,0],1,.1)];
    const resources=new ResourcePool();
    const appearance=new FurnitureAppearance({} as SurfaceMaterialFactory,resources,()=>settings,()=>undefined);
    const entity=lamp(), original=entity.toData();
    appearance.applyLighting(root,entity);
    expect(emitters.reduce((sum,light)=>sum+light.power,0)).toBeCloseTo(806,8);
    const warmRatio=emitters[0].color.r/emitters[0].color.b;
    appearance.applyLighting(root,entity.withEmission({intensity:.25}));
    expect(emitters.reduce((sum,light)=>sum+light.power,0)).toBeCloseTo(201.5,8);
    expect((emitters[0] as THREE.PointLight).distance).toBe(9);
    expect((emitters[1] as THREE.SpotLight).distance).toBe(8);
    settings.fixtureTemperatureKelvin=6500;appearance.applyLighting(root,entity);
    expect(emitters[0].color.r/emitters[0].color.b).toBeLessThan(warmRatio/2);
    expect(entity.toData()).toEqual(original);
    settings.fixtureTemperatureKelvin=0;appearance.applyLighting(root,entity);
    expect(emitters[0].color.r/emitters[0].color.b).toBeCloseTo(warmRatio,8);
    appearance.applyLighting(root,entity.withEmission({lumens:0}));
    expect(emitters.every(light=>light.intensity===0)).toBe(true);
    appearance.applyLighting(root,entity.withEmission({enabled:false}));
    expect(emitters.every(light=>!light.visible)).toBe(true);
    resources.ownTree(root).dispose();
  });

  it('preserves Kelvin and output through both plan formats while retaining legacy color data', () => {
    const codec=new PlanCodec(), document=new PlanDocument([lamp()]);
    for (const text of [codec.encode(document),new LegacyPlanWriter().encode(document)]) {
      expect(codec.decode(text).requireLuminaire('lamp').lightConfig).toEqual(lamp().lightConfig);
    }
  });

  it.each([{temperatureKelvin:2699},{temperatureKelvin:6501},{temperatureKelvin:NaN},{lumens:-1},{lumens:100001},{lumens:Infinity}])('rejects invalid physical settings: %j', config => {
    expect(()=>lamp().withEmission(config)).toThrow();
  });

  it('uses a nonmetallic paint default while respecting explicit finishes', () => {
    const factory=new SurfaceMaterialFactory();
    const plain=factory.getMaterial({type:'paint',color:'#864954'}) as THREE.MeshStandardMaterial;
    expect(plain.metalness).toBe(0);expect(plain.roughness).toBe(.85);
    const explicit=factory.getMaterial({type:'paint',color:'#864954',metalness:.1,roughness:.4}) as THREE.MeshStandardMaterial;
    expect(explicit.metalness).toBe(.1);expect(explicit.roughness).toBe(.4);
    factory.dispose();
  });
});
