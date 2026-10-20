// 室内与门叶使用真实几何，入口、双跑楼梯和二层楼板洞口都保留步行尺度。
export function createHomeDoor(kit, root, building, { id, name, x, front, floor = 0.24, width = 1.2, height = 2.38, color = '#8c7055', openAngle = -Math.PI * 0.48 }) {
  const { THREE, box, mesh } = kit;
  const leaf = new THREE.Group();
  leaf.name = `${name}可开关的门叶`;
  leaf.userData.dynamic = true;
  leaf.position.set(x + width / 2, floor, front + 0.09);
  building.add(leaf);
  const center = -width / 2;
  box(leaf, center, 0.48, 0, width, 0.94, 0.065, color);
  for (const dx of [0, -width]) box(leaf, dx, height / 2, 0, 0.055, height, 0.065, color);
  for (const y of [0.025, 0.94, height - 0.035]) box(leaf, center, y, 0, width, 0.055, 0.065, color);
  const glass = mesh(leaf, new THREE.PlaneGeometry(width - 0.12, height - 1.06), new THREE.MeshBasicMaterial({ color: '#bdd1c9', transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }), { outline: false });
  glass.position.set(center, (height + 0.94) / 2, 0.02);
  for (let i = 1; i < 4; i++) box(leaf, -width + i * width / 4, (height + 0.94) / 2, 0.05, 0.022, height - 1.02, 0.025, '#a48c70', { outline: false });
  box(leaf, -width + 0.14, 1.08, 0.082, 0.032, 0.19, 0.065, '#d3c7a5', { outline: false });
  for (const dx of [x - width / 2 - 0.055, x + width / 2 + 0.055]) box(building, dx, floor + height / 2, front + 0.045, 0.085, height + 0.08, 0.15, '#6f6050');
  box(building, x, floor + height + 0.025, front + 0.045, width + 0.17, 0.09, 0.15, '#6f6050');
  let opened = true;
  leaf.rotation.y = openAngle;
  root.userData.dynamicRoots.push(leaf);
  root.userData.interactions.push({
    id: `${id}-door`,
    label: () => `${opened ? '关上' : '打开'}${name}的门`,
    position: () => building.localToWorld(new THREE.Vector3(x, floor + 1.1, front + 0.4)),
    radius: 2.2,
    action(ctx) {
      const point = ctx.walk?.position;
      if (opened && point) {
        const local = building.worldToLocal(point.clone());
        if (Math.abs(local.x - x) < width / 2 + 0.24 && Math.abs(local.z - front) < 0.38) {
          ctx.toast('先离开门口，再关上门。');
          return;
        }
      }
      opened = !opened;
      leaf.rotation.y = opened ? openAngle : 0;
      leaf.updateWorldMatrix(true, true);
      ctx.refreshShadows?.();
      ctx.toast(opened ? '门打开了，可以进屋看看。' : '轻轻关上了门。');
    },
  });
  building.userData.doorLeaf = leaf;
  return leaf;
}

export function buildHomeInterior(kit, root, building, { id, name, width, depth, height, floors = 2, floor = 0.24, distant = false }) {
  const { THREE, box, cylinder, mesh, line, sign } = kit;
  const front = depth / 2;
  const upper = height / 2 + 0.38;
  const doorX = -width * 0.14;
  const plank = '#c0a780';
  const trim = '#897155';
  const wall = '#e9dfc9';
  const right = width / 2 - 0.2;
  const rear = -front + 0.2;
  const ceiling = height + 0.18;
  const firstX = -width / 2 + 0.67;
  const secondX = firstX + 1.08;
  const startZ = front - 0.65;
  const treadDepth = 0.28;
  const flightEnd = startZ - 9 * treadDepth;
  const landingZ = flightEnd - 0.31;
  const wellRight = secondX + 0.49;
  const wellRear = landingZ - 0.33;
  const interior = new THREE.Group();
  interior.name = `${name}的日常生活室内`;
  building.add(interior);

  function slab(x, z, w, d, y) {
    if (w < 0.03 || d < 0.03) return;
    const value = box(interior, x, y - 0.06, z, w, 0.12, d, plank, { receiveShadow: false });
    value.userData.walkSurface = true;
    return value;
  }
  slab(0, 0, width - 0.16, depth - 0.16, floor);
  // 深浅木板缝只作细线，家具与室内光线仍是画面的主体。
  for (let x = -width / 2 + 0.38; x < width / 2 - 0.12; x += 0.42) line(interior, [[x, floor + 0.004, rear], [x, floor + 0.004, front - 0.12]], '#a48968');
  box(interior, 0, ceiling - 0.025, 0, width - 0.14, 0.06, depth - 0.14, '#e2d4b9', { receiveShadow: false });
  for (const side of [-1, 1]) box(interior, side * (width / 2 - 0.11), floor + 0.085, 0, 0.045, 0.15, depth - 0.23, trim, { outline: false });
  box(interior, 0, floor + 0.085, rear + 0.025, width - 0.2, 0.15, 0.045, trim, { outline: false });

  // 玄关鞋柜靠右墙，通向楼梯的左侧入口始终空着。
  box(interior, right - 0.3, floor + 0.42, front - 0.72, 0.48, 0.84, 0.88, '#aa906e');
  for (let i = 0; i < 3; i++) box(interior, right - 0.546, floor + 0.2 + i * 0.22, front - 0.72, 0.019, 0.15, 0.77, '#d0b997', { outline: false });
  box(interior, doorX + 0.6, floor + 0.012, front - 0.43, 0.62, 0.025, 0.51, '#8f8b73', { outline: false });
  for (const sx of [-0.15, 0.15]) {
    const shoe = mesh(interior, new THREE.SphereGeometry(1, 6, 4), '#857765', { outline: false });
    shoe.position.set(right - 0.33 + sx, floor + 0.075, front - 1.28);
    shoe.scale.set(0.095, 0.06, 0.21);
  }

  // 小厨房与榻榻米客厅共处一楼，桌边留出绕行空间。
  const kitchenX = right - 0.8;
  box(interior, kitchenX, floor + 0.43, rear + 0.38, 1.55, 0.86, 0.58, '#b29c7c');
  box(interior, kitchenX, floor + 0.89, rear + 0.38, 1.62, 0.075, 0.66, '#ddd6c3');
  box(interior, kitchenX - 0.45, floor + 0.933, rear + 0.38, 0.42, 0.013, 0.33, '#849999', { outline: false });
  cylinder(interior, kitchenX + 0.33, floor + 0.947, rear + 0.38, 0.115, 0.016, '#6f7578', 10);
  cylinder(interior, kitchenX + 0.56, floor + 0.947, rear + 0.38, 0.085, 0.016, '#6f7578', 10);
  box(interior, right - 0.24, floor + 0.84, rear + 1.12, 0.44, 1.68, 0.56, '#ced1c2');
  box(interior, right - 0.47, floor + 1.26, rear + 1.12, 0.023, 0.33, 0.041, '#879386', { outline: false });
  const roomX = Math.max(0.55, wellRight + 0.7);
  box(interior, roomX, floor + 0.01, -0.04, Math.max(1.1, right - wellRight - 0.7), 0.02, 1.52, '#b4b78d', { outline: false });
  box(interior, roomX, floor + 0.34, -0.1, 0.94, 0.065, 0.67, '#977657');
  for (const dx of [-0.35, 0.35]) for (const dz of [-0.22, 0.22]) box(interior, roomX + dx, floor + 0.17, -0.1 + dz, 0.045, 0.31, 0.045, trim, { outline: false });
  for (const dz of [-0.68, 0.57]) box(interior, roomX, floor + 0.075, dz, 0.42, 0.12, 0.35, dz > 0 ? '#bdb5a2' : '#aaa9b2', { outline: false });
  cylinder(interior, roomX + 0.19, floor + 0.402, -0.12, 0.065, 0.07, '#ded5b5', 8);
  box(interior, roomX - 0.19, floor + 0.384, -0.14, 0.24, 0.018, 0.18, '#c5cfbd', { outline: false });
  sign(interior, '四月の散歩', roomX - 0.19, floor + 0.394, -0.14, 0.2, 0.14, { bg: '#c5cfbd', fg: '#686f63' }).rotation.x = -Math.PI / 2;
  box(interior, right - 0.16, floor + 1.38, 0.12, 0.07, 0.56, 0.72, '#af9a7d');
  sign(interior, '春の便り\n桜坂の暮らし', right - 0.205, floor + 1.38, 0.12, 0.62, 0.44, { bg: '#e8ddc4', fg: '#617661', rotationY: -Math.PI / 2 });

  let route = [[doorX, floor, front + 0.78], [doorX, floor, front - 0.48]];
  if (floors === 2) {
    // 两跑各九级，平台和右侧房间连接；上层楼板没有遮住楼梯井。
    const rise = (upper - floor) / 18;
    route.push([firstX, floor, startZ + 0.22]);
    for (let i = 0; i < 9; i++) {
      const z = startZ - (i + 0.5) * treadDepth;
      const y = floor + (i + 1) * rise;
      slab(firstX, z, 0.94, treadDepth + 0.015, y);
      box(interior, firstX, y - rise / 2, z + treadDepth / 2 - 0.018, 0.94, rise, 0.028, '#a48a69', { outline: false });
      route.push([firstX, y, z]);
    }
    slab((firstX + secondX) / 2, landingZ, 2.03, 0.64, floor + 9 * rise);
    route.push([firstX, floor + 9 * rise, landingZ], [secondX, floor + 9 * rise, landingZ]);
    for (let i = 0; i < 9; i++) {
      const z = flightEnd + (i + 0.5) * treadDepth;
      const y = floor + (10 + i) * rise;
      slab(secondX, z, 0.94, treadDepth + 0.015, y);
      box(interior, secondX, y - rise / 2, z - treadDepth / 2 + 0.018, 0.94, rise, 0.028, '#a48a69', { outline: false });
      route.push([secondX, y, z]);
    }
    // 木质斜梁承托踏板，两侧梁不占据脚下的净行走宽度。
    const slope = Math.atan2(rise, treadDepth);
    const stringerLength = 9 * Math.hypot(rise, treadDepth);
    for (const side of [-1, 1]) {
      const lowerBeam = box(interior, firstX + side * 0.445, floor + rise * 5 - 0.13, startZ - 4.5 * treadDepth, 0.055, 0.11, stringerLength, '#8e7456', { rotation: [slope, 0, 0] });
      const upperBeam = box(interior, secondX + side * 0.445, floor + rise * 14 - 0.13, flightEnd + 4.5 * treadDepth, 0.055, 0.11, stringerLength, '#8e7456', { rotation: [-slope, 0, 0] });
      // 踏板和立板承担碰撞；斜梁不生成覆盖整段楼梯的保守包围盒。
      lowerBeam.userData.walkCollision = false;
      upperBeam.userData.walkCollision = false;
    }
    const roomWidth = width / 2 - 0.08 - wellRight;
    slab(wellRight + roomWidth / 2, 0, roomWidth, depth - 0.16, upper);
    const backDepth = wellRear - (-front + 0.08);
    slab((-width / 2 + 0.08 + wellRight) / 2, -front + 0.08 + backDepth / 2, wellRight + width / 2 - 0.08, backDepth, upper);
    const frontDepth = front - 0.08 - (startZ + 0.075);
    slab((-width / 2 + 0.08 + wellRight) / 2, startZ + 0.075 + frontDepth / 2, wellRight + width / 2 - 0.08, frontDepth, upper);
    // 细木扶手沿两跑的中缝，后平台与上层出口不横穿扶手。
    for (let i = 0; i < 8; i += 2) {
      const z = startZ - (i + 0.5) * treadDepth;
      const y = floor + (i + 1) * rise;
      box(interior, firstX + 0.52, y + 0.41, z, 0.025, 0.82, 0.025, '#897557', { outline: false });
    }
    line(interior, [[firstX + 0.52, floor + 0.86, startZ - 0.05], [firstX + 0.52, floor + 9 * rise + 0.86, flightEnd + 0.1]], '#715b47');
    box(interior, (wellRight + right) / 2, upper + 0.15, rear + 1.1, Math.min(1.3, roomWidth - 0.38), 0.3, 1.73, '#ad9272');
    box(interior, (wellRight + right) / 2, upper + 0.35, rear + 1.1, Math.min(1.23, roomWidth - 0.45), 0.12, 1.64, '#e2d8c3');
    box(interior, (wellRight + right) / 2, upper + 0.44, rear + 0.55, Math.min(1.12, roomWidth - 0.56), 0.08, 0.3, '#eeead8', { outline: false });
    box(interior, (wellRight + right) / 2, upper + 0.44, rear + 1.41, Math.min(1.13, roomWidth - 0.55), 0.06, 0.91, '#9baeb0', { outline: false });
    const deskX = right - 0.27;
    box(interior, deskX, upper + 0.75, front - 0.82, 0.59, 0.075, 1.1, '#af9979');
    for (const dz of [-0.41, 0.41]) box(interior, deskX, upper + 0.37, front - 0.82 + dz, 0.42, 0.69, 0.035, trim, { outline: false });
    for (let i = 0; i < 5; i++) box(interior, deskX, upper + 0.86 + (i % 2) * 0.015, front - 0.97 + i * 0.075, 0.18, 0.17, 0.047, ['#9eaa8c', '#a09bb0', '#c1a88d'][i % 3], { outline: false });
    box(interior, deskX - 0.66, upper + 0.4, front - 0.81, 0.37, 0.07, 0.4, '#a98e6b');
    for (const dz of [-0.15, 0.15]) box(interior, deskX - 0.66, upper + 0.2, front - 0.81 + dz, 0.035, 0.36, 0.035, trim, { outline: false });
    box(interior, deskX - 0.82, upper + 0.71, front - 0.81, 0.035, 0.55, 0.38, trim, { outline: false });
    route.push([Math.max(wellRight + 0.28, secondX + 0.69), upper, startZ - 0.12]);
  }

  // 挂灯的乳白灯罩与收音机旋钮是真实物件，轻量材质避免高光和夸张光晕。
  cylinder(interior, roomX, ceiling - 0.46, 0.35, 0.012, 0.75, '#786c5d', 6);
  const lamp = mesh(interior, new THREE.ConeGeometry(0.24, 0.16, 12), new THREE.MeshBasicMaterial({ color: '#f4e3b6' }), { outline: false });
  lamp.rotation.z = Math.PI;
  lamp.position.set(roomX, ceiling - 0.81, 0.35);
  cylinder(interior, roomX, ceiling - 0.89, 0.35, 0.23, 0.018, '#fff2d3', 12);
  const nightBulb = mesh(interior, new THREE.SphereGeometry(0.055, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffe0a0' }), { outline: false, castShadow: false });
  nightBulb.position.set(roomX, ceiling - 0.875, 0.35);
  nightBulb.userData.dynamic = true;
  nightBulb.visible = false;
  root.userData.nightLights.push(nightBulb);
  const radioX = Math.max(wellRight + 0.24, 0.25);
  box(interior, radioX, floor + 0.73, rear + 0.25, 0.55, 0.72, 0.25, '#aa9676');
  box(interior, radioX, floor + 1.15, rear + 0.25, 0.44, 0.22, 0.21, '#8e7257');
  box(interior, radioX - 0.065, floor + 1.15, rear + 0.36, 0.19, 0.13, 0.008, '#c5b68f', { outline: false });
  cylinder(interior, radioX + 0.125, floor + 1.11, rear + 0.362, 0.022, 0.03, '#6b625c', 8).rotation.x = Math.PI / 2;
  let tuned = false;
  root.userData.interactions.push({
    id: `${id}-radio`, label: () => tuned ? '关掉窗边收音机' : '调一调窗边收音机',
    position: () => building.localToWorld(new THREE.Vector3(radioX, floor + 1.15, rear + 0.3)), radius: 1.7,
    action(ctx) {
      tuned = !tuned;
      ctx.inspect?.('桜坂的下午广播', tuned ? '「现在是四点二十分。桜坂的樱花正开得很好。放学归来的各位，过平交道口时请留意电车。」\n窗边的旧收音机亮起了温柔的小灯。' : '轻轻旋回音量旋钮，屋子又恢复了安静。');
      ctx.toast(tuned ? '收音机传来小镇的春日广播。' : '收音机已关闭。');
      radioLight.material.color.set(tuned ? '#edc778' : '#a2a595');
    },
  });
  const radioLight = mesh(interior, new THREE.PlaneGeometry(0.034, 0.014), new THREE.MeshBasicMaterial({ color: '#a2a595' }), { outline: false });
  radioLight.position.set(radioX + 0.12, floor + 1.19, rear + 0.366);
  radioLight.userData.dynamic = true;
  // 近距离室内保留法线色阶，免去薄家具上的阴影自遮蔽条纹。
  interior.traverse(object => { if (object.isMesh) object.receiveShadow = false; });

  building.updateWorldMatrix(true, true);
  const worldPoint = point => building.localToWorld(new THREE.Vector3(...point)).toArray();
  root.userData.enterableBuildings.push({ id, name, entry: worldPoint(route[0]), inside: worldPoint([doorX, floor, front - 0.48]), ...(floors === 2 ? { upper: worldPoint(route.at(-1)) } : {}), route: route.map(worldPoint) });
}
