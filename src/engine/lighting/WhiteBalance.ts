import * as THREE from 'three';
import { whiteLightColor } from './WhiteLight';

const rgbToXYZ = new THREE.Matrix3().set(.4124564,.3575761,.1804375, .2126729,.7151522,.072175, .0193339,.119192,.9503041);
// Linear Bradford chromatic adaptation, as specified by the ICC.
// https://www.color.org/newiccspec.pdf, Annex E.1.2
const bradford = new THREE.Matrix3().set(.8951,.2664,-.1614, -.7502,1.7135,.0367, .0389,-.0685,1.0296);

/** Viewing adaptation is separate from physical lamp output. Keep the approved
 * 6500 K rendering unchanged; adapt other viewing whites to that same baseline.
 */
export function whiteBalanceMatrix(kelvin: number): THREE.Matrix3 {
  if (kelvin === 6500) return new THREE.Matrix3();
  const cone = (temperature: number) => {
    const color = whiteLightColor(temperature);
    return new THREE.Vector3(color.r,color.g,color.b).applyMatrix3(rgbToXYZ).applyMatrix3(bradford);
  };
  const source = cone(kelvin), reference = cone(6500);
  const scale = new THREE.Matrix3().set(reference.x/source.x,0,0, 0,reference.y/source.y,0, 0,0,reference.z/source.z);
  return rgbToXYZ.clone().invert().multiply(bradford.clone().invert()).multiply(scale).multiply(bradford).multiply(rgbToXYZ);
}

/** One HDR target, allocated only for non-reference white balance. Adapt linear
 * scene radiance before tone mapping and sRGB encoding, including mixed lights.
 */
export class WhiteBalancePass {
  private target?: THREE.WebGLRenderTarget;
  private temperature?: number;
  private readonly size = new THREE.Vector2();
  private readonly camera = new THREE.Camera();
  private readonly quadScene = new THREE.Scene();
  private readonly material = new THREE.ShaderMaterial({
    uniforms:{ image:{value:null}, balance:{value:new THREE.Matrix3()} },
    depthTest:false, depthWrite:false,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:`uniform sampler2D image; uniform mat3 balance; varying vec2 vUv;
      void main(){
        vec4 pixel=texture2D(image,vUv);
        gl_FragColor=vec4(max(balance*pixel.rgb,vec3(0.0)),pixel.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  private readonly geometry = new THREE.PlaneGeometry(2,2);
  constructor(){ this.quadScene.add(new THREE.Mesh(this.geometry,this.material)); }

  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,kelvin=6500):void {
    if(kelvin===6500){
      this.target?.dispose();this.target=undefined;
      this.material.uniforms.image.value=null;
      renderer.render(scene,camera);return;
    }
    renderer.getDrawingBufferSize(this.size);
    this.target ??= new THREE.WebGLRenderTarget(this.size.x,this.size.y,{
      type:THREE.HalfFloatType, colorSpace:THREE.LinearSRGBColorSpace,
      samples:renderer.getContext().getContextAttributes()?.antialias ? Math.min(4,renderer.capabilities.maxSamples) : 0,
    });
    this.target.setSize(this.size.x,this.size.y);
    this.material.uniforms.image.value=this.target.texture;
    if(this.temperature!==kelvin){this.material.uniforms.balance.value.copy(whiteBalanceMatrix(kelvin));this.temperature=kelvin;}
    const previous=renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(this.target);renderer.render(scene,camera);
      renderer.setRenderTarget(previous);renderer.render(this.quadScene,this.camera);
    } finally {renderer.setRenderTarget(previous);}
  }
  dispose():void {this.target?.dispose();this.material.dispose();this.geometry.dispose();}
}
