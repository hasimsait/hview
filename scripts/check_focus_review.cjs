const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),sharp=require('sharp');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),base=path.join(root,'docs/renders/2026-10-30-focus');
(async()=>{
 const m=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'))),changes=JSON.parse(fs.readFileSync(path.join(base,'plan-changes.json')));
 assert.equal(m.sourceSHA256,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public/sample.plan'))).digest('hex'));
 assert.equal(m.sourceSHA256,changes.workingPlanSHA256);assert.equal(changes.allOtherPlanElementsUnchanged,true);assert.equal(changes.windowOpeningDataUnchanged,true);
 const clearance=JSON.parse(fs.readFileSync(path.join(base,'clearance-check.json')));assert.equal(clearance.sourceSHA256,m.sourceSHA256);assert.deepEqual(clearance.hits,[]);
 assert.deepEqual(m.errors,[]);assert.equal(m.rooms.length,3);assert.equal(m.baseline.length,12);assert.equal(m.studies.length,7);
 assert.equal(m.verification.billy.length,8);assert(m.verification.billy.every(f=>f.finish.variant==='billy_walnut_effect'&&f.sectionFinishes.door_1.variant==='billy_black_oak_effect')); assert(m.verification.billy.some(f=>f.id==='salon_billy_40'));
 assert.equal(m.verification.meshes.arms.length,2);assert.equal(m.verification.meshes.windows.length,6);
 assert(m.verification.meshes.windows.every(w=>w.panes.length===2&&w.mullion));
 for(const room of m.rooms){const files=m.baseline.filter(f=>f.room===room.slug);assert.deepEqual(files.map(f=>[f.corner,f.kelvin]).sort(),[[1,2700],[1,6500],[2,2700],[2,6500]].sort());}
 for(const study of m.studies){
  assert.equal(study.files.length,study.options.length*2);
  const files=study.files.filter(f=>f.kelvin===6500),checksums=files.map(f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f.file))).digest('hex'));assert.equal(new Set(checksums).size,study.options.length,`${study.id} has duplicate choices`);
 }
 for(const file of [...m.baseline,...m.studies.flatMap(s=>s.files)]){const meta=await sharp(path.join(base,file.file)).metadata();assert.equal(meta.width,1440);assert(meta.height>=900);}
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(base,u.pathname.slice(1)||'index.html');if(u.host!=='focus.local'||!file.startsWith(base+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.jpg')?'image/jpeg':'text/plain'});});
  await page.goto('http://focus.local/index.html');assert.equal(await page.locator('[data-temp="6500"]:visible').count(),31);assert.equal(await page.locator('[data-temp="2700"]:visible').count(),0);
  await page.getByRole('button',{name:'2700 K',exact:true}).click();assert.equal(await page.locator('[data-temp="2700"]:visible').count(),31);assert.equal(await page.locator('[data-temp="6500"]:visible').count(),0);
  await page.getByRole('button',{name:'Both temperatures'}).click();assert.equal(await page.locator('[data-temp]:visible').count(),62);
  await page.evaluate(()=>document.querySelectorAll('img').forEach(i=>i.loading='eager'));await page.waitForFunction(()=>[...document.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.getByRole('button',{name:'6500 K',exact:true}).click();await page.locator('#billy-combinations').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,'work/focus-gallery-preview.jpg')});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 console.log('Verified 12 baseline views, 50 distinct comparison views, six double-sash windows, two outside sofa arms, source hash and offline desktop/mobile gallery.');
})().catch(e=>{console.error(e);process.exitCode=1;});
