import { pondDistance } from './pond-shape.js';

// 在静态合并前保存真实池底三角形，涉水与波速都从同一地形读取水深。
export function prepareWaterBeds(THREE, waters) {
  for (const water of waters) {
    if (water.bottomAt) continue;
    let basin;
    water.root.traverse(object => { if (object.name === '有深度的土石池底和缓斜岸坡') basin = object; });
    if (!basin) { water.bottomAt = () => water.bottomY; continue; }
    basin.updateWorldMatrix(true, false);
    const positions = basin.geometry.getAttribute('position'), indices = basin.geometry.index;
    const count = indices?.count ?? positions.count;
    const cells = new Map(), cellSize = 1.5;
    const key = (x,z) => `${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`;
    const vertices = [new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
    for (let i=0;i<count;i+=3) {
      vertices.forEach((vertex,j)=>vertex.fromBufferAttribute(positions,indices?indices.getX(i+j):i+j).applyMatrix4(basin.matrixWorld));
      const [a,b,c]=vertices;
      const bx=b.x-a.x,bz=b.z-a.z,cx=c.x-a.x,cz=c.z-a.z,denominator=bx*cz-bz*cx;
      if(Math.abs(denominator)<1e-10)continue;
      const triangle={x:a.x,y:a.y,z:a.z,bx,bz,cx,cz,by:b.y-a.y,cy:c.y-a.y,denominator};
      for(let ix=Math.floor(Math.min(a.x,b.x,c.x)/cellSize);ix<=Math.floor(Math.max(a.x,b.x,c.x)/cellSize);ix++)
        for(let iz=Math.floor(Math.min(a.z,b.z,c.z)/cellSize);iz<=Math.floor(Math.max(a.z,b.z,c.z)/cellSize);iz++){
          const cell=`${ix},${iz}`;
          if(!cells.has(cell))cells.set(cell,[]);
          cells.get(cell).push(triangle);
        }
    }
    water.bottomAt=(x,z)=>{
      for(const t of cells.get(key(x,z))??[]){
        const dx=x-t.x,dz=z-t.z;
        const u=(dx*t.cz-dz*t.cx)/t.denominator,v=(t.bx*dz-t.bz*dx)/t.denominator;
        if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001)return t.y+u*t.by+v*t.cy;
      }
      return pondDistance(x,z,water)>=-.015?.135:water.bottomY;
    };
  }
}

export function createWaterWorld({ waters, renderer }) {
  return {
    sampleWater(x,z){
      if(!Number.isFinite(x+z))return null;
      const water=waters.find(item=>pondDistance(x,z,item)<=0);
      if(!water)return null;
      const u=(x-water.x)/water.width+.5,v=(z-water.z)/water.depth+.5;
      const surface=renderer.sampleSurface(water.id,u,v);
      return {id:water.id,name:water.name,waterY:water.waterY,height:water.waterY+surface.height,
        slopeX:surface.slopeX,slopeZ:surface.slopeZ,bottomY:water.bottomAt(x,z),
        shoreDistance:pondDistance(x,z,water),u,v,width:water.width,depth:water.depth};
    },
    sampleSurface:renderer.sampleSurface,
    sampleHeight:renderer.sampleHeight,
    disturb:renderer.disturb,
  };
}
