import * as THREE from 'three';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import { FixtureRooms } from './FixtureRooms';

const declarations = `
uniform sampler2D uFixtureRooms;
uniform vec4 uFixtureRoomBounds;
#if NUM_POINT_LIGHTS > 0
uniform float uPointFixtureRooms[NUM_POINT_LIGHTS];
#endif
#if NUM_SPOT_LIGHTS > 0
uniform float uSpotFixtureRooms[NUM_SPOT_LIGHTS];
#endif
#if NUM_RECT_AREA_LIGHTS > 0
uniform float uAreaFixtureRooms[NUM_RECT_AREA_LIGHTS];
#endif
`;
const roomLookup = `
vec3 fixtureWorldPosition = ((vec4(geometryPosition, 1.0) - viewMatrix[3]) * viewMatrix).xyz;
vec3 fixtureWorldNormal = inverseTransformDirection(geometryNormal, viewMatrix);
vec2 fixtureRoomUv = (fixtureWorldPosition.xz + fixtureWorldNormal.xz * .06 - uFixtureRoomBounds.xy) / uFixtureRoomBounds.zw;
float fixtureRoom = 0.0;
if (all(greaterThanEqual(fixtureRoomUv, vec2(0.0))) && all(lessThanEqual(fixtureRoomUv, vec2(1.0)))) fixtureRoom = texture2D(uFixtureRooms, fixtureRoomUv).r;
`;
const lightChunk = THREE.ShaderChunk.lights_fragment_begin
  .replace('IncidentLight directLight;', roomLookup + '\nIncidentLight directLight;')
  .replace(/(pointLight = pointLights\[ i \];[\s\S]*?RE_Direct\([^\n]+\);)/, 'if (fixtureRoom == uPointFixtureRooms[i]) {\n$1\n}')
  .replace(/(spotLight = spotLights\[ i \];[\s\S]*?RE_Direct\([^\n]+\);)/, 'if (fixtureRoom == uSpotFixtureRooms[i]) {\n$1\n}')
  .replace(/(rectAreaLight = rectAreaLights\[ i \];[\s\S]*?RE_Direct_RectArea\([^\n]+\);)/, 'if (fixtureRoom == uAreaFixtureRooms[i]) {\n$1\n}');

/** Fixtures illuminate only their own room. Door angles and wall geometry are
 * deliberately irrelevant: no rays, wall loops, shadow maps or cross-room spill. */
export class RoomFixtureLighting {
  private rooms = new FixtureRooms([], 1);
  private plan?: PlanDocument;
  private layout = '';
  private sources: (THREE.PointLight | THREE.SpotLight | THREE.RectAreaLight)[] = [];
  private readonly uniforms = {
    uFixtureRooms: { value: this.rooms.texture }, uFixtureRoomBounds: { value: this.rooms.bounds },
    uPointFixtureRooms: { value: [] as number[] }, uSpotFixtureRooms: { value: [] as number[] }, uAreaFixtureRooms: { value: [] as number[] },
  };
  private readonly originals = new Map<THREE.Material, { compile: THREE.Material['onBeforeCompile']; key: THREE.Material['customProgramCacheKey']; disposed: () => void }>();
  rebuild(plan: PlanDocument): void {
    this.plan = plan;
    const layout = JSON.stringify(plan.rooms.map(room => [room.id, room.polygon]));
    if (layout === this.layout) return;
    this.layout = layout; this.rooms.dispose(); this.rooms = new FixtureRooms(plan.rooms);
    this.uniforms.uFixtureRooms.value = this.rooms.texture; this.uniforms.uFixtureRoomBounds.value = this.rooms.bounds;
  }
  update(scene: THREE.Object3D, refreshMaterials = true): void {
    if (refreshMaterials) {
      this.sources = [];
      scene.traverse(object => { if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight || object instanceof THREE.RectAreaLight) this.sources.push(object); });
    }
    const lights = this.sources.filter(light => {
      let object: THREE.Object3D | null = light;
      while (object) { if (!object.visible) return false; object = object.parent; }
      return true;
    });
    // Match Three's stable light order, including shadow/map priority.
    const priority = (light: typeof lights[number]) => (light.castShadow ? 2 : 0) + (light instanceof THREE.SpotLight && light.map ? 1 : 0);
    lights.sort((a, b) => priority(b) - priority(a));
    const point: number[] = [], spot: number[] = [], area: number[] = [], position = new THREE.Vector3();
    for (const light of lights) {
      light.getWorldPosition(position);
      let room = this.rooms.at(position.x, position.z);
      if (!room) {
        let host: THREE.Object3D | null = light, roomId: string | undefined;
        while (host && !roomId) { roomId = this.plan?.furniture.find(item => item.id === host!.userData.id)?.roomId; host = host.parent; }
        room = this.rooms.at(position.x, position.z, roomId);
      }
      (light instanceof THREE.SpotLight ? spot : light instanceof THREE.RectAreaLight ? area : point).push(room);
    }
    this.uniforms.uPointFixtureRooms.value = point; this.uniforms.uSpotFixtureRooms.value = spot; this.uniforms.uAreaFixtureRooms.value = area;
    if (!refreshMaterials) return;
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || this.originals.has(material)) continue;
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey, programKey = key.call(material), uniforms = this.uniforms;
        material.onBeforeCompile = function(shader, renderer) {
          compile.call(this, shader, renderer); Object.assign(shader.uniforms, uniforms);
          if (shader.fragmentShader.includes('uniform sampler2D uFixtureRooms;')) return;
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + declarations).replace('#include <lights_fragment_begin>', lightChunk);
        };
        material.customProgramCacheKey = () => programKey.includes('_fixture-rooms-v1') ? programKey : `${programKey}_fixture-rooms-v1`;
        const disposed = () => { this.originals.delete(material); material.removeEventListener('dispose', disposed); };
        this.originals.set(material, { compile, key, disposed }); material.addEventListener('dispose', disposed); material.needsUpdate = true;
      }
    });
  }
  dispose(): void {
    this.rooms.dispose();
    for (const [material, original] of this.originals) {
      material.onBeforeCompile = original.compile; material.customProgramCacheKey = original.key;
      material.removeEventListener('dispose', original.disposed); material.needsUpdate = true;
    }
    this.originals.clear();
  }
}
