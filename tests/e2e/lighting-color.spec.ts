import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { workflowPlan, selectSofa, offlineDocument } from './workflow-helpers';
import { standaloneBlockText } from '../../src/services/export/StandaloneHtml';

let original: string;
function fixture() {
  const raw=workflowPlan();raw.plan.walls.wall.holes={} as typeof raw.plan.walls.wall.holes;
  Object.assign(raw.plan.items.sofa,{name:'chandelier',assetKey:'chandelier',position:{x:2,y:1,z:2},rotationY:0,dimensions:{x:.8,y:.6,z:.8}});
  return raw;
}
async function state(page: Page) {
  return page.evaluate(()=>{
    const root=document.getElementById('root') as any, key=Object.keys(root).find(k=>k.startsWith('__reactContainer$'))!;
    const runtime=root[key].stateNode.current.memoizedState.element.props.value,scene=runtime.scene;
    const lights:any[]=[], geometries:string[]=[];
    scene.getRenderObject('sofa')?.traverse((o:any)=>{
      if(o.isMesh)geometries.push(o.geometry.uuid);
      if(o.userData.isFixtureLight) lights.push({power:o.power,intensity:o.intensity,color:o.color.toArray(),distance:o.distance,visible:o.visible});
    });
    return {status:scene.getStatus().state,config:runtime.editor.getDocument().requireLuminaire('sofa').lightConfig,lights,geometries,
      exposure:scene.renderer.toneMappingExposure,tone:scene.renderer.toneMapping,settings:scene.getSettings(),plan:JSON.stringify(runtime.editor.getDocument().elements.map((element:any)=>({kind:element.kind,data:element.toData()})))};
  });
}
async function ready(page:Page) {
  await expect(page.getByRole('button',{name:'Move',exact:true})).toBeVisible();
  await expect.poll(async()=>(await state(page)).status).toBe('ready');
}
test.beforeEach(async({page,request})=>{
  original=await(await request.get('/sample.plan')).text();
  await request.post('/api/save-plan',{data:fixture()});
  await page.route(/^https:\/\/fonts\./,route=>route.abort());await page.goto('/');await ready(page);
});
test.afterEach(async({page,request})=>{
  await page.close();await request.post('/api/save-plan',{data:Buffer.from(original),headers:{'Content-Type':'application/json'}});
});

test('white-light output, preview and exposure work without geometry rebuilds and survive offline touch export',async({page,browser},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await selectSofa(page);const before=await state(page);
  await page.getByRole('button',{name:/2700K/}).click();
  await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await state(page)).config?.temperatureKelvin).toBeUndefined();
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await page.getByRole('button',{name:'Use 806 lm',exact:true}).click();
  await page.getByRole('slider',{name:'Fixture brightness',exact:true}).fill('0.5');
  const configured=await state(page);
  expect(configured.config).toMatchObject({temperatureKelvin:2700,lumens:806,intensity:.5});
  expect(configured.geometries).toEqual(before.geometries);
  expect(configured.lights.reduce((sum,light)=>sum+light.power,0)).toBeCloseTo(403,6);
  expect(configured.lights.map(light=>light.distance)).toEqual(before.lights.map(light=>light.distance));
  await page.getByRole('button',{name:/3D Orbit/}).click();
  await page.getByRole('button',{name:/Lighting: Daylight/}).click();
  await page.getByRole('button',{name:'ON',exact:true}).click();
  await page.getByLabel('White light preview',{exact:true}).selectOption('6500');
  const cool=await state(page), warm=configured.lights[0].color;
  expect(cool.lights[0].color[0]/cool.lights[0].color[2]).toBeLessThan(warm[0]/warm[2]/2);
  expect(cool.config).toEqual(configured.config);expect(cool.plan).toBe(configured.plan);expect(cool.exposure).toBe(1);
  await page.getByRole('slider',{name:'Lighting exposure',exact:true}).fill('1');expect((await state(page)).exposure).toBe(2);
  await page.getByLabel('Color rendering',{exact:true}).selectOption('aces');expect((await state(page)).tone).toBe(4);
  await page.getByRole('button',{name:'Reset color controls',exact:true}).click();expect((await state(page)).tone).toBe(7);
  await page.getByRole('button',{name:/Lighting: Night/}).click();
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Full Editor (.html)',exact:true}).click();
  const path=info.outputPath('white-light-editor.html');await(await downloading).saveAs(path);
  const saved=JSON.parse(standaloneBlockText(readFileSync(path,'utf8'),'plan-data'));
  expect(saved.document.elements.find((element:any)=>element.data.id==='sofa').data.lightConfig).toEqual(configured.config);
  const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,isMobile:true});
  try {
    const url=await offlineDocument(context,path,'white-light'),touch=await context.newPage();
    touch.on('pageerror',error=>errors.push(error.message));await touch.goto(url);await ready(touch);
    expect((await state(touch)).config).toEqual(configured.config);
    await touch.getByRole('button',{name:/Lighting: Daylight/}).tap();
    await touch.getByLabel('White light preview',{exact:true}).selectOption('2700');
    await touch.getByRole('slider',{name:'Lighting exposure',exact:true}).fill('0.5');
    expect((await state(touch)).exposure).toBeCloseTo(Math.SQRT2,6);
    await touch.screenshot({path:info.outputPath('touch-lighting-controls.png')});
    await touch.reload();await ready(touch);expect((await state(touch)).config).toEqual(configured.config);
  } finally {await context.close();}
  expect(errors).toEqual([]);
});

test('reference red and green paints respond to warm and cool white light with unchanged material colors',async({page},info)=>{
  const errors:string[]=[];page.on('console',message=>{if(message.type()==='error'&&/THREE|shader|WebGLProgram/.test(message.text()))errors.push(message.text());});
  await page.getByRole('button',{name:/Lighting: Daylight/}).click();
  await page.getByRole('button',{name:'ON',exact:true}).click();
  await page.getByRole('button',{name:/Lighting: Night/}).click();
  for(const [name,color] of [['gunbatimi','#864954'],['kaktus-60','#82a686']]) {
    const patch=await page.evaluate(async color=>{
      const path='/src/main.tsx',commands='/src/application/commands/StructuralCommands.ts',lightCommands='/src/application/commands/FurnitureCommands.ts';
      const {runtime}=await import(path),{FinishWall}=await import(commands),{ConfigureLuminaire,TransformFurniture}=await import(lightCommands);
      runtime.editor.execute(new FinishWall('wall',{type:'paint',color}));
      runtime.editor.execute(new TransformFurniture('sofa',{x:2,y:2.4,z:1.5},0));
      runtime.editor.execute(new ConfigureLuminaire('sofa',{lumens:806,temperatureKelvin:2700}));
      const scene=runtime.scene;scene.updateSettings({foregroundOcclusionMode:'off',exposure:1/8});
      const camera=scene.getCamera();camera.position.set(2,1.5,5);scene.getControls().target.set(2,1.5,0);scene.getControls().update();
      camera.updateMatrixWorld(true);const p=camera.position.clone().set(2,1.5,.11).project(camera),rect=scene.getDomElement().getBoundingClientRect();
      return {x:Math.round(rect.left+(p.x+1)*rect.width/2-20),y:Math.round(rect.top+(1-p.y)*rect.height/2-20),width:40,height:40};
    },color);
    const samples:number[][]=[];
    for(const temperature of [2700,6500]) {
      const frame=await page.evaluate(async temperature=>{
        const path='/src/main.tsx';const {runtime}=await import(path);const frame=runtime.scene.renderer.info.render.frame;
        runtime.scene.updateSettings({fixtureTemperatureKelvin:temperature});return frame;
      },temperature);
      await page.waitForFunction(async frame=>{const path='/src/main.tsx';const {runtime}=await import(path);return !runtime.scene.preparing&&runtime.scene.renderer.info.render.frame>frame;},frame);
      const stats=await sharp(await page.screenshot({clip:patch})).stats();samples.push(stats.channels.slice(0,3).map(channel=>channel.mean));
      await page.screenshot({path:info.outputPath(`${name}-${temperature}.png`)});
    }
    expect(samples[0][0]/samples[0][2]).toBeGreaterThan(samples[1][0]/samples[1][2]*1.3);
    if(name==='kaktus-60')expect(samples[1][1]).toBeGreaterThan(samples[1][2]);
    const plan=JSON.parse((await state(page)).plan);expect(plan.find((element:any)=>element.data.id==='wall').data.finishSideA.color).toBe(color);
  }
  expect(errors).toEqual([]);
});
