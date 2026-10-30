const { chromium } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), sharp = require('sharp');
const root = path.resolve(__dirname, '..'), dest = path.join(root, 'docs/renders/2026-10-30-focus');
const sourceSHA256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'public/sample.plan'))).digest('hex');
const reference = JSON.parse(fs.readFileSync(path.join(root, 'docs/renders/2026-10-30/originals/manifest.json')));
const rooms = [
  { id: '_elc1j', slug: 'salon', name: 'Salon', fov: 102, cameras: [[-4.62,1.95,-2.72,-2.9,1.15,.7],[-1.96,1.95,3.30,-3.65,1.15,-.6]] },
  { id: '_y0oj2', slug: 'living-work', name: 'Living / work room', fov: 104, cameras: [[-1.36,1.9,-2.85,.55,1,-.65],[1.59,1.9,.46,-.55,1,-1.8]] },
  { id: '_3h613', slug: 'master-bedroom', name: 'Master bedroom', fov: 105, cameras: [[-.20,1.85,5.91,2,1.2,7.2],[2.95,1.85,7.66,.5,1.2,6.35]] },
].map(r => ({ ...r, exposure: reference.rooms.find(x => x.id === r.id).exposure }));
const billy = (variant, color) => ({ type: variant === 'billy_white' ? 'paint' : 'wood', variant, color, roughness: .65, metalness: 0 });
const oak = billy('billy_oak_effect','#c0b099'), black = billy('billy_black_oak_effect','#24211e'), walnut = billy('billy_walnut_effect','#9d7b5b'), white = billy('billy_white','#f3f1eb');
const studies = [
  { id:'salon-fabric', title:'Salon sofa fabric', room:'salon', corner:1, kind:'fabric', note:'Only seat and back upholstery changes. Wood arms, Jotun 1876 walls and furniture positions stay fixed.', options:[
    {id:'current',label:'Current burgundy / champagne',swatches:['#54121d','#ede6d6']},
    {id:'olive-oat',label:'Muted olive / oat',colors:['#62634d','#c9bcaa'],swatches:['#62634d','#c9bcaa']},
    {id:'tobacco-flax',label:'Tobacco / flax',colors:['#88644c','#c8b9a0'],swatches:['#88644c','#c8b9a0']},
    {id:'petrol-stone',label:'Deep petrol / warm stone',colors:['#405957','#b4aa98'],swatches:['#405957','#b4aa98']},
  ]},
  { id:'billy-combinations', title:'BILLY body and door combinations', room:'salon', camera:[-2.9,1.45,1.45,-2.9,1.25,3.75], fov:78, kind:'billy', note:'Body includes shelves and backs. Door finish includes frames and knobs, including the extensions. Glass stays clear. The room door is temporarily closed for this close-up; the saved plan keeps it at 90 degrees.', options:[
    {id:'walnut-black',label:'Current walnut body / black doors',body:walnut,door:black,swatches:[walnut.color,black.color]},
    {id:'oak-black',label:'Oak body / black doors',body:oak,door:black,swatches:[oak.color,black.color]},
    {id:'oak-oak',label:'Oak body / oak doors',body:oak,door:oak,swatches:[oak.color,oak.color]},
    {id:'white-oak',label:'White body / oak doors',body:white,door:oak,swatches:[white.color,oak.color]},
  ]},
  { id:'bedroom-accent', title:'Master bedroom accent wall', room:'master-bedroom', corner:0, kind:'accent', note:'Only the window-side accent wall changes. Pale long wall, cream joinery, brass handles, mirror, door and headboard remain fixed. Neutral bedding is a styling prop.', options:[
    {id:'current',label:'Current muted terracotta',color:'#764a40',swatches:['#764a40']},
    {id:'olive',label:'Deep muted olive',color:'#59604c',swatches:['#59604c']},
    {id:'clay',label:'Soft clay brown',color:'#927365',swatches:['#927365']},
    {id:'mushroom',label:'Warm mushroom',color:'#83796c',swatches:['#83796c']},
  ]},
  { id:'desk-finishes', title:'Living / work room desks', room:'living-work', corner:0, kind:'desk', note:'Both desk tops change together. Legs, chairs, sectional sofa and desk placements remain fixed.', options:[
    {id:'birch',label:'Current bleached birch',finish:{type:'wood',variant:'bleached_birch',color:'#dfcfb6',roughness:.45},swatches:['#dfcfb6']},
    {id:'oak',label:'Natural oak',finish:{type:'wood',variant:'natural_oak',color:'#dfcbaf',roughness:.45},swatches:['#dfcbaf']},
    {id:'walnut',label:'American walnut',finish:{type:'wood',variant:'american_walnut',color:'#543f31',roughness:.45},swatches:['#543f31']},
    {id:'warm-white',label:'Warm white',finish:{type:'paint',color:'#e5dfd3',roughness:.65},swatches:['#e5dfd3']},
  ]},
  ...[
    ['salon-curtains','Salon curtains','salon','_eukwd',1,[['current','Current muted blue','#8aa6cc'],['flax','Flax','#b7a58d'],['olive','Muted olive','#6b7053']]],
    ['living-curtains','Living / work room curtains','living-work','_j0bn8',1,[['current','Current burgundy','#370101'],['oat','Warm oat','#b7aa95'],['petrol','Muted petrol','#4f6262']]],
    ['bedroom-curtains','Master bedroom curtains','master-bedroom','_v72ul',0,[['flax','Flax','#b8a48a'],['olive','Muted olive','#6b7053'],['stone','Warm stone','#a89e91']]],
  ].map(([id,title,room,window,corner,options]) => ({ id,title,room,window,corner,kind:'curtain',note:'Only curtain colour changes. Bedroom curtains are shown temporarily for this comparison; their saved hidden state is retained.',options:options.map(([id,label,color])=>({id,label,color,swatches:[color]})) })),
];
const preview = process.argv.includes('--preview'), only = process.argv.find(a=>a.startsWith('--only='))?.slice(7), errors = [];
async function settle(page) {
  await page.waitForFunction(()=>!window.focusReview.scene.preparing&&!window.focusReview.scene.needsPreparation&&window.focusReview.scene.getStatus().state==='ready',null,{timeout:120000});
  await page.evaluate(async()=>{ await window.focusReview.materials.textures.ready(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); window.focusReview.scene.renderFrame(0); });
}
(async()=>{
  fs.mkdirSync(path.join(dest,'views'),{recursive:true}); fs.mkdirSync(path.join(dest,'comparisons'),{recursive:true});
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS/.test(m.text()))errors.push(m.text());});
    await page.route('**/*',route=>route.request().url()==='http://hview.local/focus'?route.fulfill({body:fs.readFileSync(path.join(root,'hview_editor.html')),contentType:'text/html'}):route.abort());
    await page.goto('http://hview.local/focus');
    await page.waitForFunction(()=>{const root=document.getElementById('root'),key=root&&Object.keys(root).find(k=>k.startsWith('__reactContainer$'));const r=key&&root[key].stateNode.current.memoizedState.element.props.value;if(!r)return false;window.focusReview=r;return r.scene.getStatus().state==='ready';},null,{timeout:120000});
    const verification=await page.evaluate(()=>{
      const r=window.focusReview,d=r.editor.getDocument(),s=r.scene; r.editor.selection.set(null);s.helpersGroup.visible=false;
      const sofa=d.requireFurniture('_gf38l');if(sofa.assetKey!=='sofa_sectional_left'||d.get('_3h4u6'))throw Error('Offline editor contains the previous sofa');
      s.getScene().background.set('#111110');
      const canvas=s.renderer.domElement;canvas.dataset.focusCapture='true';for(const el of document.querySelectorAll('body *'))if(el!==canvas&&!el.contains(canvas))el.style.visibility='hidden';
      s.updateSettings({globalLighting:false,globalLightIntensity:0,showFixtures:true,showCeiling:true,showWalls:true,showFurniture:true,showFloor:true,foregroundOcclusionMode:'off',wallCutaway:false,wallOpacity:1,surfaceColors:false,toneMapping:'neutral',fixtureTemperatureKelvin:6500,whiteBalanceKelvin:6500,whiteBalanceAdaptation:.55,exposure:.06});
      r.editor.execute({label:'Temporary comparison fixture output and styling props',execute:d=>{
        let out=d;for(const f of d.furniture)if(f.kind==='furniture.luminaire')out=out.replace(f.withEmission({...f.lightConfig,lumens:f.lightConfig?.lumens??806,intensity:f.lightConfig?.enabled===false?0:1}));
        const bed=out.requireFurniture('_09swo');out=out.replace(bed.withSectionFinish('duvet',{type:'paint',color:'#d6cbb9',roughness:.95}).withSectionFinish('pillows',{type:'paint',color:'#ddd3c3',roughness:.95}));return out;
      }});
      window.focusBaseline=r.editor.getDocument();
      window.focusFill=new s.lighting.ambientLight.constructor(0xffffff,.75);window.focusFill.name='Capture-only indirect fill';s.getScene().add(window.focusFill);
      // Bump-only neutral weave adds textile detail without multiplying the chosen colour by a coloured photograph.
      let weave;s.getScene().traverse(o=>{if(!weave&&o.isMesh&&o.material?.bumpMap&&o.name.includes('curtain'))weave=o.material.bumpMap;});window.focusWeave=weave;
      return {sofa:{assetKey:sofa.assetKey,dimensions:sofa.dimensions},windows:d.walls.flatMap(w=>w.openings).filter(o=>o.type==='window'||o.type==='french_window').map(o=>({id:o.id,width:o.width,height:o.height,wallId:o.wallId,distanceAlongWall:o.distanceAlongWall})),billy:d.furniture.filter(f=>f.assetKey.startsWith('ikea_billy')).map(f=>({id:f.id,finish:f.finish,sectionFinishes:f.sectionFinishes}))};
    });
    await settle(page);
    verification.meshes=await page.evaluate(()=>{
      const r=window.focusReview;const sofa=r.scene.getRenderObject('_gf38l'),arms=[];sofa.traverse(o=>{if(o.userData.section==='Armrests')arms.push(o.name);});
      const windows=r.editor.getDocument().walls.flatMap(w=>w.openings).filter(o=>o.type==='window'||o.type==='french_window').map(o=>{const root=r.scene.getRenderObject(o.id),panes=[];root.traverse(p=>{if(p.userData.isGlazing)panes.push(p.name);});return {id:o.id,panes,mullion:!!root.getObjectByName(`windowFixedMullion_${o.id}`)};});return {arms,windows};
    });
    if(verification.meshes.arms.length!==2||verification.meshes.windows.some(w=>w.panes.length!==2||!w.mullion))throw Error('Incorrect sectional or window mesh');
    const canvas=page.locator('canvas[data-focus-capture]');
    const manifest={sourceSHA256,settings:{night:true,foreground:'solid',sockets:true,ceilings:true,wallCutaway:false,whiteBalanceAdaptation:.55,indirectFill:.75,background:'#111110'},rooms,studies:[],baseline:[],verification,errors};
    const pose=async(room,camera,fov,kelvin)=>{
      await page.evaluate(({room,camera,fov,kelvin})=>{const s=window.focusReview.scene,c=s.getCamera();s.updateSettings({fixtureTemperatureKelvin:kelvin,whiteBalanceKelvin:kelvin,whiteBalanceAdaptation:.55,exposure:room.exposure});c.position.set(...camera.slice(0,3));c.fov=fov;c.updateProjectionMatrix();s.getControls().target.set(...camera.slice(3));s.getControls().update();let light;s.getScene().traverseVisible(o=>{if(o.userData.isFixtureLight&&o.isLight)light=o;});if(light)window.focusFill.color.copy(light.color);s.invalidate();},{room,camera,fov,kelvin}); await settle(page);
    };
    if(!only||only==='baseline')for(const room of rooms){
      await page.evaluate(id=>window.focusReview.scene.isolateRooms([id]),room.id);
      for(const kelvin of preview?[6500]:[6500,2700])for(let corner=0;corner<2;corner++){
        await pose(room,room.cameras[corner],room.fov,kelvin);const file=`${room.slug}--corner-${corner+1}--${kelvin}k.jpg`;
        await sharp(await canvas.screenshot()).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(path.join(dest,'views',file));manifest.baseline.push({room:room.slug,corner:corner+1,kelvin,file:`views/${file}`});console.log(`Baseline ${file}`);
      }
    }
    if(!preview)for(const study of studies){
      if(only&&only!==study.id)continue;
      const room=rooms.find(r=>r.slug===study.room),result={...study,files:[]};
      for(const option of study.options){
        await page.evaluate(({study,option,room})=>{
          const r=window.focusReview;r.editor.load(window.focusBaseline);
          r.editor.execute({label:`Compare ${study.title}: ${option.label}`,execute:d=>{
            let out=d;
            if(study.kind==='billy')for(const f of d.furniture.filter(f=>f.assetKey.startsWith('ikea_billy')&&f.roomId===room.id)){
              let next=f.withFinish(option.body);for(const key of ['door_1','door_2','handles'])next=next.withSectionFinish(key,option.door);out=out.replace(next);
            }
            if(study.kind==='billy')out=out.replace(out.get('_5w0ui').withOpenAngle(0));
            if(study.kind==='fabric'&&option.colors)for(const f of d.furniture.filter(f=>['_ouz7e','_vso7v','_3qv7o','_ti80j'].includes(f.id))){
              const color=option.colors[['_vso7v','_ti80j'].includes(f.id)?0:1],finish={type:'paint',color,roughness:.92,metalness:0};out=out.replace(f.withSectionFinish('seat',finish).withSectionFinish('backrest',finish));
            }
            if(study.kind==='accent')out=out.replace(d.requireWall('_0jsab').withFinish('B',{type:'paint',color:option.color,roughness:.85}));
            if(study.kind==='desk')for(const id of ['_vsovw','_vsxdk'])out=out.replace(d.requireFurniture(id).withSectionFinish('tabletop',option.finish));
            if(study.kind==='curtain'){const w=d.get(study.window);out=out.replace(w.withCurtainState('visible').withWindowDressing({...w.windowDressing,style:w.windowDressing?.style??'blackout',color:option.color}));}
            return out;
          }});
          r.scene.isolateRooms([room.id]);
        },{study,option,room});await settle(page);
        if(study.kind==='fabric'&&option.colors)await page.evaluate(()=>{
          const r=window.focusReview;for(const id of ['_ouz7e','_vso7v','_3qv7o','_ti80j'])r.scene.getRenderObject(id).traverse(o=>{if(o.isMesh&&['Seat','Backrest'].includes(o.userData.section)){const m=o.material.clone();m.bumpMap=window.focusWeave;m.bumpScale=.0008;o.material=m;}});r.scene.invalidate();
        });
        for(const kelvin of [6500,2700]){
          await pose(room,study.camera??room.cameras[study.corner],study.fov??room.fov,kelvin);const file=`${study.id}--${option.id}--${kelvin}k.jpg`;
          await sharp(await canvas.screenshot()).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toFile(path.join(dest,'comparisons',file));result.files.push({option:option.id,kelvin,file:`comparisons/${file}`});console.log(`Compare ${file}`);
        }
      }
      manifest.studies.push(result);
    }
    if(errors.length)throw Error(JSON.stringify(errors));
    const file=path.join(dest,'manifest.json');
    if(only&&fs.existsSync(file)){
      const previous=JSON.parse(fs.readFileSync(file));if(previous.sourceSHA256!==sourceSHA256)throw Error('Cannot mix source plans in one focused study');
      manifest.baseline=only==='baseline'?manifest.baseline:previous.baseline;manifest.studies=[...previous.studies.filter(s=>s.id!==only),...manifest.studies];
    }
    fs.writeFileSync(preview?path.join(root,'work/focus-preview-manifest.json'):file,JSON.stringify(manifest,null,2)+'\n');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
