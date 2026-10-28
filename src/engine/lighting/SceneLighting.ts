import * as THREE from 'three';
import type { ViewportSettings } from '../../core/types/services';
export class SceneLighting {
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private topLight!: THREE.DirectionalLight;
  constructor(private readonly scene: THREE.Scene) { this.install(); }
  private install(): void {
    // Soft Ambient
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    // Hemisphere sky/ground
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.4);
    this.hemiLight.position.set(0, 30, 0);
    this.scene.add(this.hemiLight);

    // Directional Sun Light
    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    this.sunLight.position.set(15, 25, 12);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 70;
    const d = 16;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.scene.add(this.sunLight);

    // Flat overhead fill light for 2D plan mode
    this.topLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.topLight.position.set(0, 30, 0);
    this.topLight.visible = false;
    this.scene.add(this.topLight);


  }
  update(settings: ViewportSettings): void {
    if (!this.ambientLight || !this.sunLight || !this.hemiLight || !this.topLight) return;

    const isTopDown = settings.viewMode === 'topDown';
    const globalOn = settings.globalLighting;
    const globalMultiplier = settings.globalLightIntensity ?? 1.0;

    if (!globalOn || globalMultiplier <= 0.001) {
      // Global lighting turned OFF (Night Interior Mode):
      this.sunLight.intensity = 0.0;
      this.sunLight.castShadow = false;
      this.hemiLight.intensity = 0.0;
      this.topLight.visible = false;
      // Night has no artificial fill: only enabled fixtures illuminate surfaces.
      this.ambientLight.intensity = 0;
      if ('environmentIntensity' in this.scene) {
        (this.scene as any).environmentIntensity = 0;
      }
    } else {
      // Global lighting ON:
      if (isTopDown) {
        this.sunLight.castShadow = false;
        this.sunLight.intensity = 0.0;
        this.ambientLight.intensity = 1.6 * globalMultiplier;
        this.hemiLight.intensity = 0.8 * globalMultiplier;
        this.topLight.visible = true;
        this.topLight.intensity = 0.8 * globalMultiplier;
      } else {
        this.sunLight.castShadow = true;
        this.sunLight.intensity = 1.4 * globalMultiplier;
        this.ambientLight.intensity = 0.7 * globalMultiplier;
        this.hemiLight.intensity = 0.4 * globalMultiplier;
        this.topLight.visible = false;
      }
      if ('environmentIntensity' in this.scene) {
        (this.scene as any).environmentIntensity = 0.8 * globalMultiplier;
      }
    }

  }
  dispose(): void { this.sunLight.shadow.dispose(); this.topLight.shadow.dispose(); for (const light of [this.ambientLight, this.hemiLight, this.sunLight, this.topLight]) light.removeFromParent(); }
}
