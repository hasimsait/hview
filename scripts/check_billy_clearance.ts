import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { PlanCodec } from '../src/domain/codec/PlanCodec';
import { FurnitureMeshBuilder } from '../src/engine/assets/FurnitureMeshBuilder';
import { WallMeshBuilder } from '../src/engine/geometry/WallMeshBuilder';
import { OpeningMeshBuilder } from '../src/engine/geometry/OpeningMeshBuilder';
import { CollisionFeedback } from '../src/engine/cabinet/CollisionFeedback';
import type { SurfaceMaterialFactory } from '../src/engine/materials/SurfaceMaterialFactory';
const source=fs.readFileSync('public/sample.plan','utf8'),codec=new PlanCodec(),doc=codec.decode(source),scene=new THREE.Group();
// Geometry uses the normal production builders; colour textures are unnecessary for a clearance query.
const neutral=new THREE.MeshStandardMaterial(),finishes={getMaterial:()=>neutral} as unknown as SurfaceMaterialFactory;
const walls=new WallMeshBuilder(finishes),furniture=new FurnitureMeshBuilder(codec.factory.catalog),openings=new OpeningMeshBuilder();
const staticRoots=[...doc.walls.map(w=>walls.buildWall(w)),...doc.columns.map(c=>walls.buildWall(c.wallShape(doc.totalHeight)))];
const doorRoots=doc.walls.filter(w=>w.roomIds?.includes('_elc1j')).flatMap(w=>w.openings.filter(o=>o.type==='door'||o.type==='door_coupe').map(o=>openings.buildOpening(o,w)));
scene.add(...staticRoots,...doorRoots);const obstacleMeshes:THREE.Mesh[]=[];for(const root of [...staticRoots,...doorRoots])root.traverse(o=>{if(o instanceof THREE.Mesh)obstacleMeshes.push(o);});
const billy=doc.furniture.filter(f=>f.assetKey.startsWith('ikea_billy')&&f.roomId==='_elc1j');
const rows=billy.map(f=>{const root=furniture.build(f);root.position.set(f.position.x,f.position.y,f.position.z);root.rotation.y=f.rotationY;scene.add(root);return {item:f,root};});scene.updateMatrixWorld(true);
const collision=new CollisionFeedback();
const hits:unknown[]=[];
for(const {item,root} of rows){const moving:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)moving.push(o);});for(const mesh of moving)for(const obstacle of obstacleMeshes)if(collision.intersects(mesh,obstacle))hits.push({id:item.id,part:mesh.userData.cabinetPart??mesh.name,obstacle:obstacle.userData.openingId??obstacle.userData.wall?.id??obstacle.userData.id,name:obstacle.name,obstacleBounds:new THREE.Box3().setFromObject(obstacle),section:obstacle.userData.section??'wall body'});}
const bounds=new THREE.Box3();for(const {root} of rows)bounds.union(new THREE.Box3().setFromObject(root));
const wallFaceBounds=(id:string)=>{const root=staticRoots.find(r=>r.userData.id===id)!,box=new THREE.Box3();root.traverse(o=>{if(o instanceof THREE.Mesh){const b=new THREE.Box3().setFromObject(o);if(b.min.y<bounds.max.y)box.union(b);}});return box;};
const leftWall=wallFaceBounds('_hr4kt'),rightWall=wallFaceBounds('_k2vy1_b'),rearWall=wallFaceBounds('_kmn82');
const clearances={leftSideMetres:bounds.min.x-leftWall.max.x,rightSideMetres:rightWall.min.x-bounds.max.x,rearMetres:rearWall.min.z-bounds.max.z};
const report={sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),bookcases:rows.map(({item})=>({id:item.id,position:item.position,dimensions:item.dimensions})),checked:'Actual cabinet bodies, doors and projecting knobs against all wall, column and skirting meshes plus the salon door at its saved angle',collisionToleranceMetres:.0005,clearances,hits,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'work/billy-clearance.json';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({hits:hits.length,clearances,bounds:report.bounds,output}));if(hits.length){console.log(JSON.stringify(hits.slice(0,12)));process.exitCode=1;}collision.dispose();
