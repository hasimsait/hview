const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),sharp=require('sharp');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),base=path.join(root,'docs/renders/2026-10-30');
(async()=>{
 const source=JSON.parse(fs.readFileSync(path.join(base,'originals/manifest.json'),'utf8')),corrected=JSON.parse(fs.readFileSync(path.join(base,'corrected/manifest.json'),'utf8'));
 assert.equal(source.rooms.length,10);assert.equal(corrected.rooms.length,10);assert.deepEqual(source.errors,[]);assert.deepEqual(corrected.errors,[]);
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public/sample.plan'))).digest('hex');assert.equal(hash,source.sourceSHA256);assert.equal(hash,corrected.sourceSHA256);
 for(const room of source.rooms){const other=corrected.rooms.find(r=>r.id===room.id);assert.equal(room.exposure,other.exposure);assert.equal(room.fov,other.fov);assert.equal(room.files.length,4);assert.deepEqual(room.files.map(f=>[f.kelvin,f.corner,f.camera]),other.files.map(f=>[f.kelvin,f.corner,f.camera]));
  for(const f of room.files){const a=await sharp(path.join(base,'originals',f.file)).metadata(),b=await sharp(path.join(base,'corrected',f.file)).metadata();assert.equal(a.width,1600);assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert(a.height>=1000);}
 }
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url()),rel=u.pathname.replace(/^\/review\//,''),file=path.resolve(base,rel||'index.html');if(u.host!=='hview.local'||!file.startsWith(base+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':'text/plain'});});
  await page.goto('http://hview.local/review/index.html');assert.equal(await page.locator('[data-file]').count(),40);
  await page.getByRole('button',{name:'Corrected materials / white balance',exact:true}).click();assert.equal(await page.locator('[data-file] img').first().getAttribute('src'),'http://hview.local/review/corrected/'+source.rooms.find(r=>r.slug==='living-room-22').files[0].file);
  await page.waitForFunction(()=>[...document.querySelectorAll('.views img')].slice(0,2).every(img=>img.complete&&img.naturalWidth>0));
  await page.screenshot({path:path.join(root,'work/house-gallery-preview.png')});
  assert.equal(await page.locator('.room-study').count(),10);
  await page.getByRole('button',{name:'Realistic material studies',exact:true}).click();await page.locator('.room-study').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const image=document.querySelector('.room-study img');return image.complete&&image.naturalWidth>0;});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 console.log('Verified 80 complete matched POV renders, source checksum, fixed room exposures and offline gallery switching.');
})().catch(error=>{console.error(error);process.exitCode=1;});
