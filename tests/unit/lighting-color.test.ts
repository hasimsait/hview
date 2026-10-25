import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Luminaire } from '../../src/domain/elements/Furniture';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { addFixtureLight, addStripAreaLight } from '../../src/engine/lighting/FixtureLight';
import { whiteLightColor } from '../../src/engine/lighting/WhiteLight';
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
  it.each([[2700,.45931,.41066],[6500,.31349,.32366]])('approximates the %i K locus independently of display gamma', (kelvin,x,y) => {
    const c=whiteLightColor(kelvin);
    const X=.4124564*c.r+.3575761*c.g+.1804375*c.b;
    const Y=.2126729*c.r+.7151522*c.g+.072175*c.b;
    const Z=.0193339*c.r+.119192*c.g+.9503041*c.b;
    expect(X/(X+Y+Z)).toBeCloseTo(x,4);expect(Y/(X+Y+Z)).toBeCloseTo(y,4);
    expect(Y).toBeCloseTo(1,6);
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
