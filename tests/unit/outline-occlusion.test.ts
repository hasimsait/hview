import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { StandardFurniture } from '../../src/domain/elements/Furniture';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { CeilingMeshBuilder } from '../../src/engine/geometry/CeilingMeshBuilder';
import { WallSurfacePalette } from '../../src/engine/materials/WallSurfacePalette';
import { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';

function compile(material: THREE.Material) {
  const source = material instanceof THREE.LineBasicMaterial ? THREE.ShaderLib.basic : THREE.ShaderLib.standard;
  const shader = { vertexShader: source.vertexShader, fragmentShader: source.fragmentShader, uniforms: {} as Record<string, { value: any }> };
  material.onBeforeCompile(shader as any, {} as THREE.WebGLRenderer);
  return shader;
}

describe('outlines follow foreground visibility', () => {
  it('uses live wall and ceiling planes/modes for both surfaces and their outlines', () => {
    const finishes = new SurfaceMaterialFactory(), walls = new WallSurfacePalette(finishes), ceilings = new CeilingMeshBuilder(finishes);
    const wall = compile(walls.getMaterial()), edge = compile(walls.getEdgeMaterial());
    const ceiling = compile(finishes.getMaterial({ type: 'paint', color: '#ffffff' })), ceilingEdge = compile(ceilings.palette[0]);
    expect(edge.uniforms.uForegroundMode).toBe(wall.uniforms.uForegroundMode);
    expect(edge.uniforms.uOrbitCenter).toBe(wall.uniforms.uOrbitCenter);
    expect(ceilingEdge.uniforms.uForegroundMode).toBe(ceiling.uniforms.uForegroundMode);
    expect(ceilingEdge.uniforms.uCameraDir).toBe(ceiling.uniforms.uCameraDir);
    for (const shader of [edge, ceilingEdge]) {
      expect(shader.vertexShader).toContain('vCustomWorldPos = (modelMatrix * customWPos).xyz');
      expect(shader.fragmentShader).toContain('if (dist > 0.1) discard');
      expect(shader.fragmentShader).toContain('gl_FragColor.a *= mix');
    }
    walls.updateOrbitPlane(new THREE.Vector3(2, 3, 4), new THREE.Vector3(1, 0, 0));
    expect(edge.uniforms.uOrbitCenter.value.toArray()).toEqual([2, 3, 4]);
    expect(ceilingEdge.uniforms.uOrbitCenter.value.toArray()).toEqual([2, 3, 4]);
    for (const [mode, value] of [['clip', 2], ['transparent', 1], ['off', 0]] as const) {
      walls.setForegroundMode(mode);
      expect(edge.uniforms.uForegroundMode.value).toBe(value);
      expect(ceilingEdge.uniforms.uForegroundMode.value).toBe(value);
    }
    walls.setWallOpacity(.25);
    expect(edge.uniforms.uForegroundOpacity.value).toBe(.25);
    expect(ceilingEdge.uniforms.uForegroundOpacity.value).toBe(.25);
    finishes.dispose();
  });

  it('clips furniture outlines with their bodies while keeping independent worktop outlines visible', () => {
    const builder = new FurnitureMeshBuilder();
    const item = (assetKey: string) => new StandardFurniture({ id: assetKey, assetKey, name: assetKey, displayName: assetKey, category: 'kitchen', dimensions: { x: 1, y: .04, z: .6 }, position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
    const outlines = (assetKey: string) => {
      const result: THREE.LineSegments[] = [];
      builder.build(item(assetKey)).traverse(object => { if (object instanceof THREE.LineSegments && object.name === 'celOutline') result.push(object); });
      return result;
    };
    const furniture = outlines('kitchen_box_door_double'), worktop = outlines('kitchen_worktop');
    expect(furniture.length).toBeGreaterThan(0); expect(worktop).toHaveLength(1);
    const edge = compile(furniture[0].material as THREE.Material), body = compile((furniture[0].parent as THREE.Mesh).material as THREE.Material);
    const topEdge = compile(worktop[0].material as THREE.Material), top = compile((worktop[0].parent as THREE.Mesh).material as THREE.Material);
    expect(edge.uniforms.uForegroundMode).toBe(body.uniforms.uForegroundMode);
    builder.setForegroundMode('clip');
    expect(edge.uniforms.uForegroundMode.value).toBe(2);
    expect(top.uniforms.uForegroundMode.value).toBe(0);
    expect(topEdge.uniforms.uForegroundMode).toBeUndefined();
    expect(worktop[0].material).not.toBe(furniture[0].material);
    builder.setCelShading(true);
    expect((worktop[0].material as THREE.LineBasicMaterial).opacity).toBe(1);
    builder.setForegroundMode('off'); expect(edge.uniforms.uForegroundMode.value).toBe(0);
  });
});
