// 街角咖啡店与对街面包店：透明橱窗后的内饰也是完整的三维空间。
import { addShopUpperFloor } from './shop-interiors.js';

export function createShops(kit) {
  const { THREE, box, cylinder, mesh, line, sign, roof, mat } = kit;
  const group = new THREE.Group();
  group.name = '街角的咖啡与面包';
  const interactions = [];
  const dynamicRoots = [];
  const enterableBuildings = [];
  const plain = { outline: false };
  const clothEdges = [];
  const laundry = [];
  const glass = new THREE.MeshBasicMaterial({ color: '#c6d7cf', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const roseReflection = new THREE.MeshBasicMaterial({ color: '#e9bfc8', transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const frostedGlass = new THREE.MeshBasicMaterial({ color: '#c6d2c6', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const bottleGlass = new THREE.MeshToonMaterial({ color: '#acc3a9', transparent: true, opacity: 0.75 });
  const warmBulb = new THREE.MeshBasicMaterial({ color: '#fff0b5', toneMapped: false });
  function B(p, x, y, z, w, h, d, c, options = {}) { return box(p, x, y, z, w, h, d, c, options); }
  function C(p, x, y, z, r, h, c, segments = 12) { return cylinder(p, x, y, z, r, h, c, segments); }
  function tube(parent, points, radius, color, segments = 12) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(parent, new THREE.TubeGeometry(curve, segments, radius, 5, false), color, plain);
  }
  function sphere(p, x, y, z, radius, color, scale = [1, 1, 1]) {
    const object = mesh(p, new THREE.SphereGeometry(radius, 10, 7), color, plain);
    object.position.set(x, y, z);
    object.scale.set(...scale);
    return object;
  }
  function pane(p, x, y, z, w, h, material = glass) {
    const object = mesh(p, new THREE.PlaneGeometry(w, h), material, { ...plain, castShadow: false, receiveShadow: false });
    object.position.set(x, y, z);
    return object;
  }
  function windowFrame(p, x, y, z, w, h, color = '#725548') {
    for (const dx of [-w / 2, w / 2]) B(p, x + dx, y, z, 0.09, h + 0.1, 0.12, color);
    for (const dy of [-h / 2, h / 2]) B(p, x, y + dy, z, w + 0.1, 0.09, 0.12, color);
    B(p, x, y - h / 2 - 0.075, z + 0.06, w + 0.22, 0.12, 0.24, '#9d7c5d');
    pane(p, x, y, z + 0.016, w - 0.03, h - 0.035);
  }
  function plant(p, x, z, size = 1, potColor = '#a77964') {
    C(p, x, 0.25 * size, z, 0.23 * size, 0.41 * size, potColor);
    C(p, x, 0.46 * size, z, 0.25 * size, 0.06 * size, '#bd967a');
    C(p, x, 0.465 * size, z, 0.21 * size, 0.015, '#706950');
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      const leaf = sphere(p, x + Math.cos(angle) * 0.17 * size, (0.63 + i % 3 * 0.07) * size, z + Math.sin(angle) * 0.16 * size, 0.18 * size, i % 2 ? '#91a880' : '#6f906b', [0.7, 1.5, 0.6]);
      leaf.rotation.z = Math.cos(angle) * 0.6;
    }
  }
  function bench(p, x, z, width = 1.55) {
    for (const dx of [-width * 0.35, width * 0.35]) {
      B(p, x + dx, 0.3, z, 0.09, 0.47, 0.36, '#74644f');
      B(p, x + dx, 0.58, z - 0.12, 0.065, 0.62, 0.075, '#81694f');
    }
    for (const dz of [-0.1, 0.08]) B(p, x, 0.52, z + dz, width, 0.065, 0.16, '#b29876');
    B(p, x, 0.78, z - 0.16, width, 0.15, 0.07, '#ac8d68');
    line(p, [[x - width * 0.4, 0.817, z - 0.114], [x + width * 0.14, 0.817, z - 0.114]], '#c2ad86');
  }
  function lamp(p, x, z, color = '#dec492') {
    C(p, x, 2.76, z, 0.019, 0.64, '#746a59');
    const shade = mesh(p, new THREE.ConeGeometry(0.24, 0.22, 12, 1, true), color, plain);
    shade.position.set(x, 2.45, z);
    sphere(p, x, 2.36, z, 0.086, warmBulb);
    C(p, x, 2.355, z, 0.2, 0.014, '#f4e6b1');
  }
  function stripedAwning(p, width, colors, name) {
    const stripeCount = 20;
    const stripeWidth = width / stripeCount;
    const edge = new THREE.Group();
    edge.name = `${name}轻动的布沿`;
    edge.userData.dynamic = true;
    edge.position.set(0, 2.71, 3.69);
    p.add(edge);
    clothEdges.push(edge);
    for (let i = 0; i < stripeCount; i++) {
      const left = -width / 2 + stripeWidth * i;
      const right = left + stripeWidth;
      const points = [];
      const indices = [];
      for (let j = 0; j <= 5; j++) {
        const t = j / 5;
        const y = 3.15 - t * 0.44 + Math.sin(t * Math.PI) * 0.055;
        const z = 2.61 + t * 1.08;
        points.push(left, y, z, right, y, z);
        if (j < 5) {
          const k = j * 2;
          indices.push(k, k + 3, k + 1, k, k + 2, k + 3);
        }
      }
      const fabric = new THREE.BufferGeometry();
      fabric.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      fabric.setIndex(indices);
      fabric.computeVertexNormals();
      mesh(p, fabric, colors[i % colors.length], { ...plain, castShadow: true });
      // 每条布沿有柔和的下垂弧，避免整齐的硬塑料边缘。
      const flap = new THREE.Shape();
      flap.moveTo(left, 0.015);
      flap.lineTo(right, 0.015);
      flap.lineTo(right, -0.19);
      flap.quadraticCurveTo((left + right) / 2, -0.265 - (i % 3) * 0.006, left, -0.19);
      flap.closePath();
      mesh(edge, new THREE.ShapeGeometry(flap, 5), colors[i % colors.length], plain);
    }
    for (const x of [-width / 2 + 0.19, width / 2 - 0.19]) {
      tube(p, [[x, 2.65, 2.67], [x, 2.88, 3.16], [x, 2.72, 3.69]], 0.025, '#67756d');
      tube(p, [[x, 3.15, 2.61], [x, 2.72, 3.69]], 0.023, '#697b73');
      B(p, x, 2.82, 2.69, 0.09, 0.41, 0.055, '#65776e', plain);
    }
    tube(p, [[-width / 2, 2.715, 3.68], [width / 2, 2.715, 3.68]], 0.023, '#718174');
  }
  function upperWindow(p, x, y, width, curtainColor, frameColor = '#6f594c') {
    for (const side of [-1, 1]) {
      B(p, x + side * (width / 2 + 0.025), y, 2.59, 0.09, 1.78, 0.08, frameColor);
      B(p, x, y + side * 0.845, 2.59, width + 0.15, 0.09, 0.08, frameColor);
    }
    pane(p, x, y, 2.636, width, 1.6);
    for (const side of [-1, 1]) {
      B(p, x + side * width * 0.3, y - 0.03, 2.658, width * 0.32, 1.48, 0.016, curtainColor, plain);
      for (let i = 0; i < 3; i++) B(p, x + side * width * 0.3 + (i - 1) * width * 0.075, y - 0.03, 2.67, 0.018, 1.45, 0.009, '#d5c9b2', plain);
    }
    B(p, x, y, 2.683, 0.055, 1.66, 0.04, frameColor, plain);
    B(p, x, y - 0.1, 2.68, width, 0.042, 0.035, frameColor, plain);
  }
  function buildingShell(p, width, height, plaster, trim) {
    B(p, 0, 0.12, 0, width + 0.16, 0.24, 5.4, '#b5b2a0');
    B(p, 0, 0.255, 0, width - 0.3, 0.04, 4.96, '#c3aa84', plain);
    B(p, 0, 1.66, -2.5, width, 2.95, 0.2, plaster);
    for (const side of [-1, 1]) B(p, side * (width / 2 - 0.08), 1.67, 0, 0.16, 3.0, 5.2, plaster);
    for (const x of [-width / 2 + 0.12, width / 2 - 0.12]) B(p, x, height / 2, 2.65, 0.11, height - 0.22, 0.11, trim);
    B(p, 0, 3.18, 2.66, width + 0.12, 0.16, 0.17, trim);
    B(p, 0, height - 0.05, 2.68, width + 0.2, 0.13, 0.17, trim);
    const roofColor = '#777e87';
    roof(p, 0, height, 0, width + 0.7, 5.91, 1.2, roofColor);
    for (let x = -width / 2 - 0.2; x <= width / 2 + 0.2; x += 0.4) line(p, [[x, height + 0.03, 2.91], [x, height + 1.225, 0], [x, height + 0.03, -2.91]], '#91959b');
    for (const side of [-1, 1]) {
      C(p, side * (width / 2 + 0.11), height / 2, 2.74, 0.04, height, '#88918a');
      B(p, side * (width / 2 - 0.13), 0.045, 2.88, 0.38, 0.06, 0.32, '#9a9c90', plain);
    }
    // 抹灰补丁与短木纹只保留低频的人工痕迹。
    B(p, -width * 0.28, 5.82, 2.606, 0.45, 0.13, 0.015, '#e4d5bb', plain);
    B(p, width / 2 - 0.04, 0.61, 2.688, 0.12, 0.26, 0.012, '#aa9071', plain);
  }

  const cafe = new THREE.Group();
  cafe.name = '喫茶こもれび';
  cafe.position.set(-12.4, 0, 17.2);
  cafe.rotation.y = Math.PI / 2;
  group.add(cafe);
  buildingShell(cafe, 6.5, 6.1, '#e8dcc4', '#8b755d');
  const cafeUpper = addShopUpperFloor(kit, cafe, { width: 6.5, height: 6.1, kind: '咖啡店' });
  interactions.push(cafeUpper.interaction);
  // 橱窗与门所在的整块前墙是镂空结构。
  for (const [x, width] of [[-3.1, 0.3], [0.65, 0.26], [2.37, 0.34], [3.1, 0.3]]) B(cafe, x, 1.61, 2.58, width, 2.85, 0.2, '#e7d8bd');
  B(cafe, -1.24, 0.56, 2.59, 3.48, 0.57, 0.19, '#b09878');
  B(cafe, 0, 2.91, 2.6, 6.25, 0.43, 0.19, '#c6b497');
  windowFrame(cafe, -1.24, 1.76, 2.67, 3.4, 1.82, '#6d5243');
  B(cafe, -1.24, 1.76, 2.726, 0.055, 1.78, 0.04, '#856749', plain);
  // 淡粉半透明笔触暗示窗外樱花，仍透出桌椅与吧台。
  const reflection = pane(cafe, -2.34, 2.08, 2.744, 0.76, 0.42, roseReflection);
  reflection.rotation.z = -0.17;
  pane(cafe, -0.42, 1.51, 2.745, 0.59, 0.13, roseReflection);
  line(cafe, [[-2.86, 2.51, 2.75], [-2.34, 2.16, 2.75], [-2.02, 2.13, 2.75]], '#d4dad0');
  // 门叶向街侧打开，入口与右侧楼梯之间保留一条真实通行路线。
  const doorX = 1.51;
  for (const x of [doorX - 0.61, doorX + 0.61]) B(cafe, x, 1.49, 2.665, 0.09, 2.49, 0.14, '#5e453a');
  for (const y of [0.29, 2.69]) B(cafe, doorX, y, 2.665, 1.31, 0.09, 0.14, '#5e453a');
  const cafeDoor = new THREE.Group();
  cafeDoor.name = '敞开的咖啡店木门';
  cafeDoor.position.set(doorX + 0.56, 0, 2.665);
  cafeDoor.rotation.y = Math.PI * 0.46;
  cafeDoor.userData.dynamic = true;
  cafe.add(cafeDoor);
  dynamicRoots.push(cafeDoor);
  for (const x of [-1.12, 0]) B(cafeDoor, x, 1.49, 0.07, 0.065, 2.39, 0.09, '#5e453a');
  for (const y of [0.32, 1.43, 2.66]) B(cafeDoor, -0.56, y, 0.07, 1.15, 0.07, 0.09, '#5e453a');
  B(cafeDoor, -0.56, 0.84, 0.084, 1.12, 1.1, 0.08, '#765540');
  for (const dx of [-0.38, 0, 0.38]) B(cafeDoor, -0.56 + dx, 0.84, 0.128, 0.018, 0.97, 0.008, '#9e7757', plain);
  pane(cafeDoor, -0.56, 2.04, 0.099, 1.11, 1.17);
  // 门玻璃背后同样镂空，白色店名直接落在透光的玻璃上。
  sign(cafeDoor, '喫茶\nこもれび', -0.56, 2.01, 0.125, 0.91, 0.43, { bg: 'transparent', fg: '#fff9e6', fontWeight: 500 });
  tube(cafeDoor, [[-1.0, 1.23, 0.19], [-1.0, 1.43, 0.19]], 0.025, '#c5b48a', 3);
  B(cafeDoor, -1.0, 1.21, 0.12, 0.064, 0.16, 0.015, '#ac906b', plain);
  B(cafe, doorX, 0.29, 2.86, 1.39, 0.11, 0.52, '#b7aa8e');
  // 玻璃后的两张小圆桌与弯木椅。
  function roundTable(x, z) {
    C(cafe, x, 0.57, z, 0.047, 0.66, '#806b54');
    C(cafe, x, 0.28, z, 0.22, 0.045, '#8d775c');
    C(cafe, x, 0.935, z, 0.37, 0.07, '#bc9b71');
    C(cafe, x + 0.07, 0.988, z, 0.105, 0.015, '#f0e5c9');
    C(cafe, x + 0.07, 1.055, z, 0.062, 0.12, '#f2e8d1');
    C(cafe, x + 0.07, 1.115, z, 0.049, 0.006, '#80634d');
  }
  function bentChair(x, z, rotation = 0) {
    const chair = new THREE.Group();
    chair.position.set(x, 0, z);
    chair.rotation.y = rotation;
    cafe.add(chair);
    C(chair, 0, 0.56, 0, 0.205, 0.06, '#a98a66');
    for (const dx of [-0.145, 0.145]) for (const dz of [-0.145, 0.145]) C(chair, dx, 0.385, dz, 0.023, 0.39, '#826848');
    tube(chair, [[-0.19, 0.52, -0.14], [-0.19, 0.88, -0.16], [0, 1.12, -0.18], [0.19, 0.88, -0.16], [0.19, 0.52, -0.14]], 0.026, '#916e4e', 18);
    tube(chair, [[-0.14, 0.71, -0.16], [0, 0.96, -0.18], [0.14, 0.71, -0.16]], 0.02, '#b29066', 10);
  }
  roundTable(-2.03, 1.81);
  roundTable(-0.55, 1.66);
  bentChair(-2.57, 1.61, -Math.PI / 2);
  bentChair(-1.57, 1.36, Math.PI / 3);
  bentChair(-0.86, 1.05, -Math.PI / 6);
  bentChair(0.06, 1.46, Math.PI / 2);
  lamp(cafe, -2.0, 1.8, '#b7a482');
  lamp(cafe, -0.48, 1.62, '#c6ad85');
  // 吧台杯具与玻璃瓶按照实际台面高度摆放。
  B(cafe, -0.45, 0.69, -0.57, 3.91, 0.84, 0.68, '#936c4f');
  B(cafe, -0.45, 1.13, -0.57, 4.09, 0.09, 0.79, '#654b3d');
  for (let x = -2.15; x < 1.5; x += 0.36) B(cafe, x, 0.66, -0.205, 0.016, 0.72, 0.015, '#b38f66', plain);
  B(cafe, -1.71, 1.405, -0.63, 0.61, 0.48, 0.47, '#a2a499');
  B(cafe, -1.71, 1.38, -0.36, 0.52, 0.12, 0.11, '#65756c', plain);
  for (const x of [-1.19, -0.88, -0.55]) {
    C(cafe, x, 1.185, -0.33, 0.115, 0.014, '#f3e5c7');
    C(cafe, x, 1.26, -0.33, 0.075, 0.145, '#e7ddc7');
    tube(cafe, [[x + 0.07, 1.32, -0.33], [x + 0.145, 1.285, -0.33], [x + 0.07, 1.23, -0.33]], 0.015, '#ede2c9', 7);
  }
  for (let i = 0; i < 6; i++) {
    const x = 0.34 + i * 0.22;
    const height = 0.28 + i % 3 * 0.055;
    C(cafe, x, 1.175 + height / 2, -0.58, 0.07, height, i % 2 ? bottleGlass : '#80988b');
    C(cafe, x, 1.175 + height + 0.04, -0.58, 0.036, 0.1, bottleGlass);
    C(cafe, x, 1.175 + height + 0.101, -0.58, 0.039, 0.027, '#937b56');
    B(cafe, x, 1.285, -0.495, 0.085, 0.11, 0.01, '#e6dfc6', plain);
  }
  B(cafe, 0.1, 1.93, -2.28, 4.8, 0.09, 0.32, '#a88a65');
  sign(cafe, 'ひと休み、しませんか。', -1.25, 2.3, -2.376, 2.08, 0.49, { bg: '#f3ead4', fg: '#7d7d63' });
  stripedAwning(cafe, 6.2, ['#355e50', '#e5dec7'], '咖啡店');
  sign(cafe, '喫茶こもれび', 0, 3.41, 2.721, 4.46, 0.35, { bg: '#eee2ca', fg: '#52694e', fontWeight: 500 });
  // 粉笔菜单板有可辨认的杯形、手写短字与支脚。
  const menu = new THREE.Group();
  menu.position.set(-1.78, 0.93, 3.53);
  menu.rotation.x = -0.11;
  cafe.add(menu);
  B(menu, 0, 0, 0, 0.84, 1.18, 0.09, '#8f7354');
  B(menu, 0, 0, 0.06, 0.73, 1.055, 0.025, '#344942', plain);
  sign(menu, '本日のケーキ', 0, 0.31, 0.079, 0.64, 0.14, { bg: 'transparent', fg: '#f0e7c9', fontWeight: 400 });
  sign(menu, '珈琲  ¥420\nいちごケーキ  ¥580', 0, -0.25, 0.079, 0.64, 0.27, { bg: 'transparent', fg: '#e4dfc2', fontWeight: 400 });
  line(menu, [[-0.16, 0.08, 0.082], [-0.11, -0.07, 0.082], [0.08, -0.07, 0.082], [0.14, 0.08, 0.082], [-0.16, 0.08, 0.082]], '#efe6c7');
  line(menu, [[0.14, 0.06, 0.082], [0.24, 0.065, 0.082], [0.23, -0.025, 0.082], [0.1, -0.025, 0.082]], '#efe6c7');
  line(menu, [[-0.18, -0.11, 0.082], [0.19, -0.11, 0.082]], '#efe6c7');
  for (const x of [-0.08, 0.02]) line(menu, [[x, 0.13, 0.083], [x - 0.025, 0.2, 0.083], [x + 0.012, 0.26, 0.083]], '#e5dec1');
  for (const x of [-0.33, 0.33]) {
    B(cafe, -1.78 + x, 0.46, 3.49, 0.055, 0.91, 0.06, '#8e7554', { ...plain, rotation: [-0.11, 0, 0] });
    B(cafe, -1.78 + x, 0.46, 3.85, 0.055, 0.91, 0.06, '#8e7554', { ...plain, rotation: [0.37, 0, 0] });
  }
  plant(cafe, -2.91, 3.05, 0.9, '#698873');
  plant(cafe, 2.8, 3.12, 0.95, '#97785a');
  bench(cafe, -0.13, 3.0, 1.43);
  line(cafe, [[-2.8, 0.816, 2.788], [-2.27, 0.816, 2.788]], '#c1a17d');
  line(cafe, [[0.92, 2.51, 2.785], [1.18, 2.51, 2.785]], '#a58362');
  upperWindow(cafe, -1.35, 4.63, 1.75, '#d9d3bd');
  upperWindow(cafe, 1.32, 4.63, 1.59, '#e4ddc6');
  // 二层窄阳台的磨砂栏板与晾衣杆都锚固于阳台楼板。
  B(cafe, 0, 3.255, 2.96, 4.9, 0.16, 0.78, '#aaa594');
  for (const x of [-2.35, -0.82, 0.82, 2.35]) B(cafe, x, 3.89, 3.34, 0.055, 1.15, 0.055, '#79897c', plain);
  B(cafe, 0, 4.455, 3.34, 4.87, 0.055, 0.06, '#8b9787', plain);
  for (const x of [-1.59, 0, 1.59]) pane(cafe, x, 3.97, 3.344, 1.47, 0.83, frostedGlass);
  for (const x of [-2.19, 2.19]) C(cafe, x, 4.3, 3.15, 0.022, 2.05, '#8c9887');
  tube(cafe, [[-2.23, 5.29, 3.16], [2.23, 5.29, 3.16]], 0.026, '#94a08e');
  const shirt = new THREE.Shape();
  shirt.moveTo(-0.12, 0.31); shirt.lineTo(-0.33, 0.22); shirt.lineTo(-0.42, 0.02);
  shirt.lineTo(-0.24, -0.035); shirt.lineTo(-0.18, 0.035); shirt.lineTo(-0.19, -0.41);
  shirt.lineTo(0.19, -0.41); shirt.lineTo(0.18, 0.035); shirt.lineTo(0.24, -0.035);
  shirt.lineTo(0.42, 0.02); shirt.lineTo(0.33, 0.22); shirt.lineTo(0.12, 0.31);
  shirt.quadraticCurveTo(0, 0.2, -0.12, 0.31);
  const shirtMesh = mesh(cafe, new THREE.ShapeGeometry(shirt), new THREE.MeshToonMaterial({ color: '#f1e7d3', side: THREE.DoubleSide }), plain);
  shirtMesh.position.set(-0.9, 4.86, 3.2);
  shirtMesh.userData.dynamic = true;
  laundry.push(shirtMesh);
  tube(cafe, [[-1.12, 5.13, 3.2], [-0.9, 5.23, 3.2], [-0.68, 5.13, 3.2]], 0.013, '#9f9982');
  const towel = pane(cafe, 0.48, 4.87, 3.2, 0.43, 0.77, new THREE.MeshToonMaterial({ color: '#d7e2cc', side: THREE.DoubleSide }));
  towel.userData.dynamic = true;
  laundry.push(towel);
  for (const x of [0.3, 0.66]) B(cafe, x, 5.27, 3.22, 0.035, 0.07, 0.04, '#c2aa7f', plain);

  const bakery = new THREE.Group();
  bakery.name = '小镇面包店';
  bakery.position.set(5, 0, 17.5);
  bakery.rotation.y = -Math.PI / 2;
  group.add(bakery);
  buildingShell(bakery, 6.3, 6.2, '#e7d5b8', '#8e6d50');
  const bakeryUpper = addShopUpperFloor(kit, bakery, { width: 6.3, height: 6.2, kind: '面包店' });
  interactions.push(bakeryUpper.interaction);
  for (const [x, width] of [[-3.04, 0.22], [0.65, 0.22], [2.4, 0.3], [3.04, 0.22]]) B(bakery, x, 1.6, 2.61, width, 2.85, 0.18, '#bc9971');
  B(bakery, -1.22, 0.5, 2.61, 3.52, 0.46, 0.18, '#c09f75');
  B(bakery, 0, 2.93, 2.61, 6.11, 0.45, 0.18, '#bc9871');
  for (let x = -3; x <= 3; x += 0.18) B(bakery, x, 2.94, 2.711, 0.012, 0.38, 0.012, '#a98561', plain);
  windowFrame(bakery, -1.24, 1.62, 2.69, 3.38, 1.79, '#a07853');
  B(bakery, -1.24, 2.63, 2.615, 3.54, 0.18, 0.18, '#bd9a71');
  B(bakery, -1.24, 1.62, 2.736, 0.047, 1.75, 0.037, '#ae875e', plain);
  stripedAwning(bakery, 6.07, ['#b77669', '#c08475', '#b77669', '#bf8271'], '面包店');
  sign(bakery, 'パンと日々', -0.34, 3.41, 2.72, 3.65, 0.33, { bg: '#efe3c9', fg: '#886b55', fontWeight: 500 });
  // 面包店地砖：格子始终在真正的室内地面上。
  const tileGeometry = new THREE.BoxGeometry(0.375, 0.012, 0.375);
  for (const parity of [0, 1]) {
    const positions = [];
    for (let ix = 0; ix < 16; ix++) for (let iz = 0; iz < 13; iz++) if ((ix + iz) % 2 === parity) positions.push([-2.815 + ix * 0.375, 0.28, -2.24 + iz * 0.375]);
    const tiles = new THREE.InstancedMesh(tileGeometry, mat(parity ? '#f0dfbb' : '#c8ab86'), positions.length);
    const transform = new THREE.Object3D();
    positions.forEach((position, i) => { transform.position.set(...position); transform.updateMatrix(); tiles.setMatrixAt(i, transform.matrix); });
    tiles.receiveShadow = true;
    bakery.add(tiles);
  }
  // 半开的木门：旋转轴是门框右侧，玻璃后没有实体挡板。
  for (const x of [0.88, 2.24]) B(bakery, x, 1.52, 2.66, 0.12, 2.46, 0.2, '#9d774f');
  B(bakery, 1.56, 2.76, 2.66, 1.45, 0.11, 0.2, '#9d774f');
  const breadDoor = new THREE.Group();
  breadDoor.position.set(2.2, 0.31, 2.71);
  breadDoor.rotation.y = Math.PI * 0.47;
  breadDoor.name = '面包店可以开合的玻璃木门';
  breadDoor.userData.dynamic = true;
  bakery.add(breadDoor);
  dynamicRoots.push(breadDoor);
  for (const x of [-1.2, 0]) B(breadDoor, x, 1.2, 0, 0.09, 2.37, 0.09, '#ad875d');
  for (const y of [0.035, 1.1, 2.36]) B(breadDoor, -0.6, y, 0, 1.26, 0.09, 0.09, '#ad875d');
  B(breadDoor, -0.6, 0.56, 0, 1.12, 0.95, 0.06, '#c5a477');
  for (const x of [-0.97, -0.65, -0.31]) B(breadDoor, x, 0.56, 0.035, 0.02, 0.84, 0.01, '#a88158', plain);
  pane(breadDoor, -0.6, 1.72, 0.013, 1.12, 1.16);
  tube(breadDoor, [[-1.06, 1.03, 0.105], [-1.06, 1.22, 0.105]], 0.025, '#8c7855', 3);
  sign(breadDoor, 'OPEN', -0.6, 1.74, 0.041, 0.52, 0.23, { bg: 'transparent', fg: '#f8ead0' });
  B(bakery, 1.57, 0.255, 2.91, 1.51, 0.09, 0.62, '#c2b092');
  lamp(bakery, 1.43, 1.29, '#d6b17e');
  lamp(bakery, -1.41, 1.7, '#e2bd83');
  const glow = pane(bakery, 1.58, 1.65, -2.37, 1.67, 2.12, new THREE.MeshBasicMaterial({ color: '#e8cf94', toneMapped: false }));
  glow.name = '门内的暖黄光';
  // 橱窗木托盘与三层面包架。
  for (const x of [-2.8, 0.31]) B(bakery, x, 1.3, 2.13, 0.065, 1.66, 0.08, '#9f7b53');
  const shelfHeights = [0.73, 1.27, 1.81];
  shelfHeights.forEach(y => {
    B(bakery, -1.24, y, 2.14, 3.18, 0.065, 0.58, '#b68a58');
    B(bakery, -1.24, y + 0.045, 2.4, 3.22, 0.09, 0.05, '#c5a371', plain);
    B(bakery, -1.24, y + 0.04, 1.87, 3.22, 0.08, 0.05, '#a57f56', plain);
    for (const x of [-2.76, 0.27]) B(bakery, x, y + 0.065, 2.15, 0.055, 0.14, 0.55, '#b8976c', plain);
  });
  function toast(x, y, z) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.13, 0); shape.lineTo(0.13, 0); shape.lineTo(0.13, 0.18);
    shape.quadraticCurveTo(0.19, 0.35, 0, 0.36); shape.quadraticCurveTo(-0.19, 0.35, -0.13, 0.18); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.115, bevelEnabled: false, curveSegments: 6 });
    const crust = mesh(bakery, geometry, '#b18450', plain);
    crust.position.set(x, y, z);
    const crumb = mesh(bakery, new THREE.ShapeGeometry(shape), '#e9cb8e', plain);
    crumb.position.set(x, y + 0.021, z + 0.119);
    crumb.scale.set(0.84, 0.85, 1);
    line(bakery, [[x - 0.085, y + 0.13, z + 0.124], [x + 0.07, y + 0.18, z + 0.124]], '#e2ba7c');
  }
  for (let i = 0; i < 5; i++) toast(-2.5 + i * 0.32, 0.765, 2.04 + i % 2 * 0.035);
  function bun(x, y, z) {
    sphere(bakery, x, y + 0.105, z, 0.16, '#d6ae6d', [1.1, 0.7, 0.97]);
    line(bakery, [[x - 0.07, y + 0.16, z + 0.088], [x + 0.055, y + 0.17, z + 0.104]], '#f1d39a');
    line(bakery, [[x - 0.035, y + 0.12, z + 0.137], [x + 0.086, y + 0.135, z + 0.105]], '#edce91');
  }
  for (let i = 0; i < 6; i++) bun(-2.46 + i * 0.42, 1.315, 2.13);
  function croissant(x, y, z) {
    const crescent = new THREE.Shape();
    crescent.moveTo(-0.19, 0.02);
    crescent.quadraticCurveTo(-0.25, 0.24, 0, 0.26);
    crescent.quadraticCurveTo(0.25, 0.24, 0.19, 0.02);
    crescent.quadraticCurveTo(0.1, 0.17, 0, 0.145);
    crescent.quadraticCurveTo(-0.1, 0.17, -0.19, 0.02);
    const bread = mesh(bakery, new THREE.ExtrudeGeometry(crescent, { depth: 0.13, bevelEnabled: false, curveSegments: 6 }), '#c99b59', plain);
    bread.position.set(x, y, z);
    for (const dx of [-0.1, 0, 0.1]) line(bakery, [[x + dx * 0.8, y + 0.155, z + 0.135], [x + dx, y + 0.233, z + 0.135]], '#edd09a');
  }
  for (const x of [-2.45, -1.89, -1.34]) croissant(x, 1.845, 2.07);
  for (const [x, y] of [[-0.36, 0.765], [0.03, 0.765], [-0.73, 1.845], [-0.27, 1.845], [0.12, 1.845]]) {
    B(bakery, x, y + 0.2, 2.11, 0.24, 0.38, 0.17, '#dec69b');
    B(bakery, x, y + 0.36, 2.11, 0.25, 0.048, 0.185, '#c3a777', plain);
    sign(bakery, 'パン', x, y + 0.23, 2.204, 0.15, 0.08, { bg: 'transparent', fg: '#a58a68' });
  }
  // 三层托盘价格签贴在木边上。
  for (const [y, text] of [[0.79, '食パン  ¥280'], [1.33, 'まるパン  ¥160'], [1.87, 'クロワッサン  ¥220']]) sign(bakery, text, -1.22, y, 2.44, 0.77, 0.14, { bg: '#f1e3be', fg: '#826649' });
  function basket(x, z) {
    C(bakery, x, 0.49, z, 0.31, 0.39, '#b9915e');
    C(bakery, x, 0.69, z, 0.325, 0.043, '#c6a371');
    C(bakery, x, 0.695, z, 0.278, 0.016, '#9e7e51');
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      tube(bakery, [[x + Math.cos(angle) * 0.29, 0.3, z + Math.sin(angle) * 0.29], [x + Math.cos(angle) * 0.307, 0.67, z + Math.sin(angle) * 0.307]], 0.012, '#d5b783', 3);
    }
    tube(bakery, [[x - 0.31, 0.67, z], [x - 0.23, 0.92, z], [x, 1.01, z], [x + 0.23, 0.92, z], [x + 0.31, 0.67, z]], 0.025, '#c4a372');
    bun(x - 0.11, 0.71, z - 0.07); bun(x + 0.12, 0.71, z + 0.04);
  }
  basket(0.65, 1.39);
  basket(2.32, 1.0);
  bench(bakery, -1.77, 3.09, 1.5);
  // 圆形面包招牌挂在金属托臂下。
  tube(bakery, [[2.79, 3.12, 2.73], [2.79, 3.12, 3.21]], 0.026, '#82725b');
  C(bakery, 2.79, 2.92, 3.2, 0.02, 0.39, '#927d5b');
  const roundSign = mesh(bakery, new THREE.CircleGeometry(0.4, 32), '#eee0be', plain);
  roundSign.position.set(2.79, 2.61, 3.21);
  const signRing = mesh(bakery, new THREE.TorusGeometry(0.405, 0.025, 5, 32), '#96734f', plain);
  signRing.position.set(2.79, 2.61, 3.224);
  sphere(bakery, 2.79, 2.66, 3.239, 0.24, '#c79d60', [1.16, 0.6, 0.09]);
  for (const dx of [-0.11, 0.01, 0.13]) line(bakery, [[2.79 + dx - 0.035, 2.64, 3.268], [2.79 + dx + 0.025, 2.73, 3.268]], '#f4dfac');
  sign(bakery, 'BAKERY', 2.79, 2.44, 3.265, 0.57, 0.105, { bg: 'transparent', fg: '#886544' });
  B(bakery, 2.81, 1.68, 2.759, 0.5, 0.59, 0.06, '#a68763');
  sign(bakery, '営業時間\n8:00 — 18:00\n水曜定休', 2.81, 1.68, 2.796, 0.43, 0.51, { bg: '#efe4c9', fg: '#826e51', fontWeight: 500 });
  // 小铃铛在门框上固定，门边的配送箱整齐叠放在地面。
  tube(bakery, [[2.26, 2.55, 2.74], [2.43, 2.55, 2.88], [2.43, 2.42, 2.88]], 0.013, '#8d7651');
  const bell = mesh(bakery, new THREE.ConeGeometry(0.07, 0.11, 10, 1, true), '#c2a465', plain);
  bell.position.set(2.43, 2.4, 2.88);
  sphere(bakery, 2.43, 2.337, 2.88, 0.026, '#917c54');
  for (let i = 0; i < 3; i++) {
    const y = 0.135 + i * 0.29;
    B(bakery, 2.64, y, 3.14, 0.78, 0.27, 0.64, '#e1d8be');
    B(bakery, 2.64, y + 0.142, 3.14, 0.84, 0.036, 0.69, '#c3b795', plain);
    for (const x of [2.36, 2.54, 2.73, 2.91]) B(bakery, x, y + 0.01, 3.471, 0.093, 0.07, 0.015, '#b3a68b', plain);
    B(bakery, 2.64, y + 0.075, 3.478, 0.23, 0.035, 0.011, '#aa9d82', plain);
  }
  upperWindow(bakery, -1.34, 4.69, 1.76, '#e6d6b7', '#79553e');
  upperWindow(bakery, 1.34, 4.69, 1.61, '#dfcaa8', '#79553e');
  for (let x = -2.95; x <= 2.95; x += 0.3) B(bakery, x, 3.57, 2.616, 0.012, 0.49, 0.02, '#b5946d', plain);
  B(bakery, 0, 3.855, 2.635, 6.1, 0.055, 0.07, '#a4825c', plain);

  function worldPoint(parent, x, y, z) {
    parent.updateWorldMatrix(true, false);
    return parent.localToWorld(new THREE.Vector3(x, y, z));
  }
  function doorInteraction(parent, door, id, name, x, z, openedAngle) {
    let open = true;
    interactions.push({
      id, label: () => `${open ? '关上' : '打开'}${name}`, radius: 1.7,
      position: () => worldPoint(parent, x, 1.3, z),
      action({ walk, toast, refreshShadows }) {
        const doorway = worldPoint(parent, x, 0.275, z);
        const player = walk.position;
        if (open && Math.hypot(player.x - doorway.x, player.z - doorway.z) < 0.69) { toast('请先离开门扇范围，再轻轻关门。'); return; }
        open = !open;
        door.rotation.y = open ? openedAngle : 0;
        refreshShadows();
        toast(open ? `${name}开了，可以进去慢慢看看。` : `${name}轻轻合上，玻璃映着街角的樱花。`);
      },
    });
  }
  doorInteraction(cafe, cafeDoor, 'cafe-door', '咖啡店木门', 1.51, 2.665, Math.PI * 0.46);
  doorInteraction(bakery, breadDoor, 'bakery-door', '面包店木门', 1.56, 2.71, Math.PI * 0.47);
  // 两次动作分别呈现递上商品与拿走商品，柜台上的物件会真实变化。
  const takeaway = new THREE.Group();
  takeaway.name = '刚做好的樱花拿铁';
  takeaway.userData.dynamic = true;
  takeaway.position.set(0.8, 1.18, -0.25);
  takeaway.visible = false;
  cafe.add(takeaway);
  const paperCup = mesh(takeaway, new THREE.CylinderGeometry(0.094, 0.072, 0.19, 12), '#ede0c6', plain);
  paperCup.position.y = 0.1;
  C(takeaway, 0, 0.199, 0, 0.1, 0.02, '#f5ead3', 12);
  B(takeaway, 0, 0.11, 0.09, 0.14, 0.068, 0.005, '#c5a0a5', plain);
  sign(takeaway, 'こもれび', 0, 0.111, 0.094, 0.12, 0.035, { bg: 'transparent', fg: '#7c6868' });
  interactions.push({
    id: 'cafe-coffee', label: () => takeaway.visible ? '拿起樱花拿铁' : '点一杯樱花拿铁 · ¥420', position: () => worldPoint(cafe, 0.8, 1.48, -0.23), radius: 2.0,
    action({ toast, inspect }) {
      takeaway.visible = !takeaway.visible;
      if (takeaway.visible) inspect('喫茶こもれび · 樱花拿铁', '温热的咖啡已经放在柜台上。奶泡上带着一点樱花糖的淡香，420 円。再按一次互动即可拿起；二层是安静的窗边阅读室。');
      else toast('拿起樱花拿铁，掌心暖暖的。沿右侧木楼梯可以上二层。');
    },
  });
  const breadBag = new THREE.Group();
  breadBag.name = '新鲜牛角包的纸袋';
  breadBag.userData.dynamic = true;
  breadBag.position.set(0.18, 1.865, 2.14);
  breadBag.visible = false;
  bakery.add(breadBag);
  B(breadBag, 0, 0.17, 0, 0.3, 0.34, 0.2, '#dec7a0', plain);
  B(breadBag, 0, 0.345, 0, 0.31, 0.035, 0.22, '#c5ac81', plain);
  sign(breadBag, 'パンと日々', 0, 0.19, 0.108, 0.22, 0.06, { bg: 'transparent', fg: '#8c775d' });
  interactions.push({
    id: 'bakery-bread', label: () => breadBag.visible ? '拿起牛角包纸袋' : '选一份牛角包 · ¥220', position: () => worldPoint(bakery, 0.18, 1.98, 1.98), radius: 2.1,
    action({ toast, inspect }) {
      breadBag.visible = !breadBag.visible;
      if (breadBag.visible) inspect('パンと日々 · 今日刚出炉', '店员把牛角包装进了浅色纸袋，220 円。再按一次互动拿走。橱窗下层还有食パン和圆面包，沿店内右侧楼梯可上二层小休息室。');
      else toast('纸袋里传来黄油香，牛角包还温热着。');
    },
  });
  enterableBuildings.push({ id: 'cafe', name: '喫茶こもれび', entry: worldPoint(cafe, 1.51, 0.07, 3.35).toArray(), inside: worldPoint(cafe, 1.51, 0.275, 0.7).toArray(), upper: cafeUpper.upper, route: cafeUpper.route });
  enterableBuildings.push({ id: 'bakery', name: 'パンと日々', entry: worldPoint(bakery, 1.56, 0.3, 3.35).toArray(), inside: worldPoint(bakery, 1.5, 0.286, 0.7).toArray(), upper: bakeryUpper.upper, route: bakeryUpper.route });
  group.userData.interactions = interactions;
  group.userData.dynamicRoots = dynamicRoots;
  group.userData.enterableBuildings = enterableBuildings;
  const interiorLights = [];
  for (const parent of [cafe, bakery]) for (const y of [2.2, 5.25]) {
    const light = new THREE.PointLight('#ffdca2', 1.5, 5.4, 2);
    light.position.set(-0.5, y, 0.3);
    parent.add(light);
    interiorLights.push(light);
  }
  function setNight(night) {
    const strength = typeof night === 'number' ? THREE.MathUtils.clamp(night, 0, 1) : night ? 1 : 0;
    interiorLights.forEach(light => { light.intensity = 1.5 + strength * 2.0; });
    warmBulb.color.set(strength > 0.4 ? '#ffdea4' : '#fff0b5');
  }

  function update(t, windStrength = 1) {
    const breeze = 0.7 + THREE.MathUtils.clamp(Number(windStrength) || 0, 0, 3) * 0.3;
    clothEdges.forEach((edge, i) => { edge.rotation.x = Math.sin(t * 1.3 + i) * 0.018 * breeze; });
    laundry.forEach((item, i) => {
      item.rotation.x = Math.sin(t * 1.12 + i * 1.8) * 0.055 * breeze;
      item.rotation.z = Math.sin(t * 0.8 + i) * 0.015 * breeze;
    });
  }
  return { group, update, setNight };
}
