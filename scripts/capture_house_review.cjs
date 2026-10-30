const { chromium } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path'), sharp = require('sharp'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), dest = path.join(root, 'docs/renders/2026-10-30');
const audit = JSON.parse(fs.readFileSync(path.join(dest, 'plan-audit.json'), 'utf8'));
if(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public/sample.plan'))).digest('hex')!==audit.sha256)throw new Error('The working plan differs from this dated review; restore its source before recapturing.');
// Interior POVs approved after the initial isometric request; no walls or roofs are removed.
const rooms = [
  ['_elc1j','living-room-22',[[ -4.62,1.95,-2.72,-2.9,1.15,.7],[-1.96,1.95,3.30,-3.65,1.15,-.6]],102],
  ['_y0oj2','living-room-13',[[ -1.36,1.9,-2.85,.55,1.0,-.65],[1.59,1.9,.46,-.55,1.0,-1.8]],104],
  ['_3h613','master-bedroom',[[ -.20,1.85,5.91,2.0,1.2,7.2],[2.95,1.85,7.66,.5,1.2,6.35]],105],
  ['_v7m0m','bedroom',[[ -.20,1.85,3.47,1.9,1.0,4.6],[2.87,1.85,5.19,.45,1.0,3.95]],105],
  ['_vzdza','kitchen',[[ -.12,1.7,1.40,1.8,1.25,2.3],[2.94,1.7,2.32,.55,1.2,1.55]],108],
  ['_8m0m9','dining-office',[[ 3.22,1.85,-2.88,2.37,1.1,-.75],[2.14,1.85,.22,2.85,1.1,-1.95]],108],
  ['_4wyay','hallway-entry',[[ -4.60,1.8,5.38,-1.62,1.25,4.75],[-.79,1.8,1.12,-1.2,1.25,4.7]],108],
  ['_qb2a4','guest-wc',[[ -3.21,1.65,5.94,-2.1,1.0,6.63],[-1.84,1.65,6.79,-2.95,1.0,6.1]],112],
  ['_rscdq','bathroom',[[ -2.29,1.7,8.86,-1.03,1.1,7.50],[-.84,1.7,7.18,-1.9,1.1,8.55]],110],
  ['_v2u5b','shower',[[ -2.73,1.7,7.76,-3.17,1.1,8.78],[-3.30,1.7,8.93,-2.83,1.1,7.98]],114],
];
const args = new Set(process.argv.slice(2)), preview = args.has('--preview');
const stage = args.has('--corrected') ? 'corrected' : 'originals';
const requested = process.argv.find(value => value.startsWith('--room='))?.split('=')[1];
const results = [], errors = [];
async function settle(page) {
  await page.waitForFunction(() => !window.houseReview.scene.preparing && !window.houseReview.scene.needsPreparation && window.houseReview.scene.getStatus().state === 'ready', null, { timeout: 120000 });
  await page.evaluate(async () => { await window.houseReview.materials.textures.ready(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); window.houseReview.scene.renderFrame(0); });
}
async function histogram(buffer) {
  const { data, info } = await sharp(buffer).resize(256,160).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const luma = []; let clipped = 0, black = 0;
  for(let i=0;i<data.length;i+=info.channels){ const l = .2126*data[i]+.7152*data[i+1]+.0722*data[i+2]; luma.push(l); if(data[i]>248&&data[i+1]>248&&data[i+2]>248)clipped++; if(l<8)black++; }
  luma.sort((a,b)=>a-b); return {median:luma[Math.floor(luma.length*.5)],p75:luma[Math.floor(luma.length*.75)],p95:luma[Math.floor(luma.length*.95)],clipped:clipped/luma.length,black:black/luma.length};
}
(async()=>{
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({ viewport:{width:1600,height:1140}, deviceScaleFactor:1 });
    page.on('pageerror', e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS/.test(m.text()))errors.push(m.text());});
    await page.route('**/*',route=>route.request().url()==='http://hview.local/review'?route.fulfill({body:fs.readFileSync(path.join(root,'hview_editor.html'),'utf8'),contentType:'text/html'}):route.abort());
    await page.goto('http://hview.local/review');
    await page.waitForFunction(()=>{const root=document.getElementById('root'),key=root&&Object.keys(root).find(k=>k.startsWith('__reactContainer$')); const r=key&&root[key].stateNode.current.memoizedState.element.props.value;if(!r)return false;window.houseReview=r;return r.scene.getStatus().state==='ready';},null,{timeout:120000});
    await page.evaluate(({corrected})=>{
      const r=window.houseReview,s=r.scene;r.editor.selection.set(null);s.helpersGroup.visible=false;
      s.renderer.domElement.setAttribute('data-house-capture','true');
      const canvas=s.renderer.domElement;
      for(const element of document.querySelectorAll('body *'))if(element!==canvas&&!element.contains(canvas))element.style.visibility='hidden';
      s.updateSettings({globalLighting:false,globalLightIntensity:0,showFixtures:true,showCeiling:true,showWalls:true,showFurniture:true,showFloor:true,foregroundOcclusionMode:'off',wallCutaway:false,wallOpacity:1,surfaceColors:false,toneMapping:'neutral',fixtureTemperatureKelvin:6500,whiteBalanceKelvin:6500,whiteBalanceAdaptation:corrected ? .55 : 0,exposure:.08});
      // The shower compartment has no fixture in the source; a temporary ceiling
      // light makes its night comparison possible without rewriting the saved plan.
      const key='render_shower_light',asset=r.catalog.get('ceiling_spot');
      window.captureLightAdjustments=[];
      r.editor.execute({label:'Set review fixture output and ceiling clearance',execute:d=>{
        let out=d;
        for(const f of d.furniture)if(f.kind==='furniture.luminaire'){
          const room=d.rooms.find(room=>room.id===f.roomId),ceiling=room?.ceilingHeight??room?.height??d.totalHeight;
          let next=f.withEmission({...f.lightConfig,lumens:f.lightConfig?.lumens??806,intensity:f.lightConfig?.enabled===false?0:1});
          if(['ceiling_spot','spotlight'].includes(f.assetKey)&&f.position.y+f.dimensions.y>ceiling-.01)next=next.withTransform({...f.position,y:ceiling-f.dimensions.y-.02});
          window.captureLightAdjustments.push({id:f.id,roomId:f.roomId,before:{position:f.position,lightConfig:f.lightConfig},after:{position:next.position,lightConfig:next.lightConfig}});
          out=out.replace(next);
        }
        return out;
      }});
      r.editor.execute({label:'Temporary review light',execute:(d,{factory})=>d.addFurniture(factory.furniture({id:key,name:key,displayName:'Temporary shower review light',assetKey:asset.key,category:'decor',roomId:'_v2u5b',position:{x:-3.01,y:2.35,z:8.35},rotationY:0,dimensions:{x:.12,y:.03,z:.12},lightConfig:{enabled:true,intensity:1,lumens:806,temperatureKelvin:6500}}))});
      if(corrected){
        r.editor.execute({label:'Interpret review materials',execute:d=>{
          let out=d;
          for(const f of d.furniture){
            if(f.assetKey.includes('billy_')){
              let next=f.withFinish({type:'wood',variant:'billy_oak_effect',color:'#c0b099',roughness:.65,metalness:0});
              for(const name of ['door_1','door_2','handles'])next=next.withSectionFinish(name,{type:'paint',color:'#18181b',roughness:.65,metalness:0});
              out=out.replace(next);
            }
          }
          return out;
        }});
        // Capture-only soft bounce proxy. The editor has no indirect lighting;
        // this modest room-isolated fill also reveals the recessed tile cavity.
        window.captureFill=new s.lighting.ambientLight.constructor(0xffffff,.75);
        window.captureFill.name='Review indirect-light proxy';s.getScene().add(window.captureFill);
      }
    },{corrected:stage==='corrected'});
    const canvas = page.locator('canvas[data-house-capture]');
    const exposures = fs.existsSync(path.join(dest,'originals/manifest.json'))?JSON.parse(fs.readFileSync(path.join(dest,'originals/manifest.json'),'utf8')).rooms:[];
    const previousRooms = requested && fs.existsSync(path.join(dest,stage,'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(dest,stage,'manifest.json'),'utf8')).rooms.filter(room=>room.slug!==requested) : [];
    for(const [id,slug,cameras,fov] of rooms){
      if(requested && requested!==slug)continue;
      await page.evaluate(id=>window.houseReview.scene.isolateRooms([id]),id);
      let exposure=stage==='originals' ? .08 : exposures.find(r=>r.id===id)?.exposure ?? .08;
      const pose=async(v,kelvin)=>{
        await page.evaluate(({v,kelvin,exposure,fov,corrected})=>{const s=window.houseReview.scene,c=s.getCamera();s.updateSettings({fixtureTemperatureKelvin:kelvin,whiteBalanceKelvin:corrected?kelvin:6500,whiteBalanceAdaptation:corrected ? .55 : 0,exposure});c.position.set(v[0],v[1],v[2]);c.fov=fov;c.updateProjectionMatrix();s.getControls().target.set(v[3],v[4],v[5]);s.getControls().update();if(window.captureFill){let source;s.getScene().traverseVisible(o=>{if(o.userData.isFixtureLight&&o.isLight)source=o;});if(source)window.captureFill.color.copy(source.color);}s.invalidate();},{v,kelvin,exposure,fov,corrected:stage==='corrected'});await settle(page);
      };
      // Choose one restrained exposure per room at the neutral temperature;
      // retain it for both corners and both temperatures so comparisons are stable.
      if(stage==='originals'){
        await pose(cameras[0],6500);let probe=await canvas.screenshot(),h=await histogram(probe);
        const ratio=Math.max(.35,Math.min(4,130/Math.max(24,h.p75)));
        exposure=Math.max(.025,Math.min(.28,exposure*Math.pow(ratio,1.65)));
        await pose(cameras[0],6500);h=await histogram(await canvas.screenshot());
        if(h.clipped>.08)exposure*=.7;
        await pose(cameras[1],6500);const other=await histogram(await canvas.screenshot());
        if(other.p75>205)exposure*=Math.pow(185/other.p75,2);
      }
      const files=[];
      for(const kelvin of preview?[6500]:[6500,2700])for(let corner=0;corner<2;corner++){
        await pose(cameras[corner],kelvin);
        const buffer=await canvas.screenshot(),file=`${slug}--corner-${corner+1}--${kelvin}k.png`;
        const output=preview?path.join(root,'work',`preview-${file}`):path.join(dest,stage,file);
        await sharp(buffer).png({compressionLevel:9}).toFile(output);
        const h=await histogram(buffer);files.push({file:path.basename(output),kelvin,corner:corner+1,camera:cameras[corner],histogram:h});
        process.stdout.write(`${stage} ${slug} corner ${corner+1} ${kelvin}K exposure ${exposure.toFixed(4)} p75 ${h.p75.toFixed(0)} clip ${(h.clipped*100).toFixed(1)}%\n`);
      }
      results.push({id,slug,name:audit.rooms.find(r=>r.id===id).name,exposure,fov,files});
      if(!preview)fs.writeFileSync(path.join(dest,stage,'manifest.json'),JSON.stringify({sourceSHA256:audit.sha256,stage,settings:{night:true,foreground:'solid',sockets:true,ceilings:true,wallCutaway:false,whiteBalanceAdaptation:stage==='corrected' ? .55 : 0,indirectLightProxy:stage==='corrected' ? .75 : 0},temporaryLighting:['render_shower_light: 806 lm, ceiling-only review light below the 2.4 m shower ceiling'],lightAdjustments:await page.evaluate(()=>window.captureLightAdjustments),rooms:[...previousRooms,...results],errors},null,2)+'\n');
    }
    if(errors.length)throw new Error(JSON.stringify(errors));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
