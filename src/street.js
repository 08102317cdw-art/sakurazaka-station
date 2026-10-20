import { roundedPondPath } from './pond-shape.js';

export function createStreet(kit, pondLayout = []) {
  const { THREE, box, cylinder, mesh, line, sign, rng, mat } = kit;
  const group = new THREE.Group();
  group.name = '站前生活街';
  if (pondLayout.length) {
    const land = new THREE.Shape();
    land.moveTo(-130, -120); land.lineTo(180, -120); land.lineTo(180, 120); land.lineTo(-130, 120); land.closePath();
    for (const pond of pondLayout) land.holes.push(roundedPondPath(THREE, pond, 0.012));
    const terrain = mesh(group, new THREE.ShapeGeometry(land, 16), '#9cae85', { outline: false, castShadow: false });
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -0.05;
    terrain.name = '为鱼塘真实开挖的镇外地面';
    group.userData.terrainHoles = pondLayout.map(pond => ({ id: pond.id, x: pond.x, z: pond.z, width: pond.width, depth: pond.depth }));
  } else box(group, 0, -.3, 0, 260, .5, 240, '#9cae85', { outline: false, castShadow: false });

  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#7e8188'; ctx.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 33; i++) {
    ctx.fillStyle = ['#787b83','#85888b','#82848c','#747981'][i % 4];
    const x = rng() * 450, y = rng() * 980, w = 30 + rng() * 140, h = 25 + rng() * 90;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + 4); ctx.lineTo(x + w - 8, y + h); ctx.lineTo(x + 4, y + h - 9); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = '#6e747e'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 17; i++) {
    const x = rng() * 512, y = rng() * 1024;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y + 12); ctx.lineTo(x + 4, y + 26); ctx.lineTo(x + 18, y + 40); ctx.stroke();
  }
  const roadTexture = new THREE.CanvasTexture(canvas);
  roadTexture.colorSpace = THREE.SRGBColorSpace;
  roadTexture.anisotropy = 8;
  const asphalt = mat('#b6b8bd').clone(); asphalt.map = roadTexture;
  box(group, -4, -.005, 14, 6, .1, 50, asphalt, { outline: false, castShadow: false });
  box(group, -8, .012, -4, 50, .08, 5, '#85888c', { outline: false, castShadow: false });
  box(group, -23, .025, -12, 4.6, .08, 20, '#85888c', { outline: false, castShadow: false });
  box(group, 6, .035, -1.6, 19.5, .1, 7.1, '#c4c2b5', { outline: false, castShadow: false });
  // 路缘铺装混合旧水泥、方砖与短小门前坡道。
  for (const x of [-7.65, -.35]) {
    box(group, x, .075, 14, 1.05, .22, 48, '#c9c8bd', { outline: false, castShadow: false });
    for (let z = -6; z < 37; z += .82) {
      box(group, x, .192, z, .88, .015, .025, '#a4a7a2', { outline: false, castShadow: false });
      if (Math.round(z * 100) % 3 === 0) box(group, x, .19, z, .88, .02, .76, '#c0c0b7', { outline: false, castShadow: false });
    }
    for (let z = -5; z < 36; z += 1.05) {
      box(group, x + (x < -4 ? .59 : -.59), .065, z, .28, .1, .99, '#b6b7b0', { outline: false, castShadow: false });
      for (let j = 0; j < 3; j++) box(group, x + (x < -4 ? .59 : -.59), .12, z + (j - 1) * .21, .17, .009, .045, '#71787a', { outline: false, castShadow: false });
    }
  }
  for (let z = -4; z < 37; z += 3.3) {
    for (const x of [-6.63, -1.37]) box(group, x, .057, z, .1, .012, 1.65, '#e8e4d4', { outline: false, castShadow: false });
  }
  for (let x = -6.35; x < -1.5; x += .71) {
    box(group, x, .069, -.3, .39, .013, 2.6, '#e8e3d3', { outline: false, castShadow: false });
    box(group, x + .13, .078, -.85, .11, .01, .26, '#989b98', { outline: false, castShadow: false });
  }
  const stop = sign(group, '止まれ', -4, .069, 4.2, 1.9, 2.2, { bg: 'transparent', fg: '#e9e6d6', fontSize: 220 });
  stop.rotation.x = -Math.PI / 2;
  stop.rotation.z = Math.PI;
  box(group, -4, .07, 2.2, 4.9, .015, .18, '#e8e6d5', { outline: false, castShadow: false });
  for (const z of [9, 25]) {
    cylinder(group, -4.9, .068, z, .43, .025, '#636a74', 28);
    for (let a = 0; a < 5; a++) {
      const ang = a * Math.PI * .4;
      const petal = mesh(group, new THREE.CircleGeometry(.14, 12), '#919498', { castShadow: false });
      petal.rotation.x = -Math.PI / 2;
      petal.position.set(-4.9 + Math.cos(ang) * .18, .084, z + Math.sin(ang) * .18);
    }
    for (let j = -2; j <= 2; j++) line(group, [[-5.22,.085,z+j*.12],[-4.57,.085,z+j*.12]], '#525b65');
  }
  cylinder(group, -1.9, .067, 16, .12, .025, '#63868a', 16);
  for (const [x,z] of [[-7.15,17.2],[-.85,17.5]]) {
    box(group,x,.13,z,.31,.06,1.15,'#788080',{outline:false,castShadow:false});
    for(let i=0;i<9;i++) box(group,x,.165,z-.49+i*.12,.24,.015,.025,'#424c58',{outline:false,castShadow:false});
  }
  for (let i = 0; i < 17; i++) {
    box(group, 15.3, .12, -3.6 + i * .45, .065, .009, .32, '#aeafa4', { outline: false, castShadow: false });
    if (i < 15) box(group, -9.5 + i * 1.55, .115, -5.8, 1.5, .013, .032, '#a3a79f', { outline: false, castShadow: false });
  }
  for (const [x,z] of [[-.1,1],[-7.9,2],[-7.9,23],[-.05,25],[13.9,-2.5]]) {
    cylinder(group, x, .64, z, .07, 1.05, '#f2eee0');
    cylinder(group, x, .87, z, .079, .13, '#d27b56');
    box(group, x, 1.14, z, .16, .06, .16, '#6f7c72', { outline: false });
  }
  for (const z of [11.5, 15]) {
    for (const dz of [-1.2,1.2]) cylinder(group, -.77, .49, z + dz, .065, .8, '#71877f');
    box(group, -.77, .79, z, .065, .07, 2.5, '#80948b', { outline: false });
    box(group, -.77, .41, z, .045, .04, 2.5, '#80948b', { outline: false });
  }
  function pole(x,z,height=10.3) {
    cylinder(group, x, height/2, z, .14, height, '#8e897e', 10);
    cylinder(group, x, .8, z, .16, 1.6, '#656f70', 10);
    box(group, x, height - 1.1, z, 2.2, .12, .14, '#746b66', { outline: false });
    for (const dx of [-.8,.8]) {
      cylinder(group, x+dx, height-.84, z, .09, .35, '#ede7d3');
      cylinder(group, x+dx, height-.61, z, .12, .04, '#d6d4c3');
    }
    const lamp = new THREE.Group(); group.add(lamp);
    const points = [[x,height-2,z],[x+.35,height-1.85,z],[x+1.1,height-1.9,z],[x+1.35,height-2.05,z]].map(p=>new THREE.Vector3(...p));
    mesh(lamp, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 8, .04, 5), '#71797b');
    box(group, x+1.3, height-2.11, z, .68, .11, .28, '#b3b1a1', { outline: false });
    box(group, x+1.3, height-2.17, z, .57, .02, .22, '#f9efd6', { outline: false });
  }
  const polePositions = [[-8.15,26],[-8.15,11],[-8.15,-6],[-24.9,-8],[-25.1,-24]];
  polePositions.forEach(p=>pole(...p));
  for (let i=0;i<2;i++) {
    const z1 = polePositions[i][1], z2=polePositions[i+1][1];
    for (const dx of [-.8,.8]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-8.15+dx,9.7,z1),new THREE.Vector3(-8.15+dx,8.8,(z1+z2)/2),new THREE.Vector3(-8.15+dx,9.7,z2)]);
      line(group,curve.getPoints(28),'#6a6879');
    }
  }
  // 两名放学路上的学生与站前等车的人，保持安静的街道尺度。
  function person(x,z,coat,skirt=false,turn=0) {
    const p = new THREE.Group(); p.position.set(x, .18, z); p.rotation.y=turn; group.add(p);
    cylinder(p, 0, 1.42, 0, .145, .31, '#eac1a3', 10);
    const hair=mesh(p,new THREE.SphereGeometry(.18,10,7,0,Math.PI*2,0,Math.PI*.66),'#473e47'); hair.position.set(0,1.51,-.018);
    box(p,0,1.04,0,.37,.52,.23,coat,{outline:false});
    for(const side of [-1,1]) {
      const arm=cylinder(p,side*.23,1.01,.015,.055,.47,coat); arm.rotation.z=side*.15;
      cylinder(p,side*.25,.73,.02,.048,.12,'#e9bd9e');
      const leg=cylinder(p,side*.1,.39,0,.06,.59,skirt?'#ebc3a5':'#3f465d'); leg.rotation.z=side*.045;
      box(p,side*.1,.09,.075,.13,.1,.26,'#4d4656',{outline:false});
      if(skirt) cylinder(p,side*.1,.25,0,.068,.27,'#3e4359');
    }
    if(skirt) {const s=mesh(p,new THREE.CylinderGeometry(.17,.26,.25,8),'#51536f');s.position.y=.72;}
    box(p,.015,1.06,-.185,.27,.34,.13,'#78644f',{outline:false});
    box(p,0,1.24,.13,.12,.07,.012,'#efe5d3',{outline:false});
    const petal=mesh(p,new THREE.CircleGeometry(.025,5),'#f6ccd6',{castShadow:false});
    petal.position.set(.13,1.318,.035);petal.rotation.x=-Math.PI/2;
    return p;
  }
  person(-1.8,6.3,'#4c5668',true,.18);
  person(-2.45,7.2,'#eee3c9',false,-.2);
  person(9,-3.3,'#b38a63',false,.8);
  return group;
}
