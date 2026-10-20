// 商住楼的二层由真实楼板、楼梯与生活空间组成，楼梯上方始终留有净空。
export function addShopUpperFloor(kit, parent, { width, height, kind }) {
  const { THREE, box, cylinder, mesh, line, sign } = kit;
  const plain = { outline: false };
  // 室内抹灰墙用干净的三渲二明暗，避免倾斜日光的阴影贴图在近距离形成条纹。
  const innerWall = { receiveShadow: false };
  const floorY = 3.195;
  const stairX = width / 2 - 0.64;
  const stairWidth = 0.94;
  const holeLeft = stairX - stairWidth / 2 - 0.06;
  const holeRight = stairX + stairWidth / 2 + 0.06;
  const floor = (x, z, w, d) => box(parent, x, floorY - 0.08, z, w, 0.16, d, '#ab9274');
  floor((-width / 2 + holeLeft) / 2, 0, holeLeft + width / 2, 5.22);
  if (width / 2 - holeRight > 0.01) floor((holeRight + width / 2) / 2, 0, width / 2 - holeRight, 5.22);
  floor(stairX, -2.435, holeRight - holeLeft, 0.35);
  floor(stairX, 2.465, holeRight - holeLeft, 0.29);
  const wallY = (height + floorY) / 2;
  const wallHeight = height - floorY;
  for (const side of [-1, 1]) {
    box(parent, side * (width / 2 - 0.08), wallY, 0, 0.16, wallHeight, 5.2, '#e8dcc4', innerWall);
  }
  box(parent, 0, wallY, -2.5, width, wallHeight, 0.2, '#e8dcc4', innerWall);
  box(parent, 0, height - 0.055, 0, width - 0.2, 0.065, 5.01, '#e7dbc4', { ...plain, receiveShadow: false });
  for (const x of [-1.47, 1.37]) box(parent, x, height - 0.135, 0, 0.09, 0.11, 4.98, '#bca68b', plain);
  box(parent, 0, (floorY + 3.79) / 2, 2.5, width, 3.79 - floorY, 0.2, '#e8dcc4', innerWall);
  box(parent, 0, (height + 5.51) / 2, 2.5, width, height - 5.51, 0.2, '#e8dcc4', innerWall);
  for (const [left, right] of [[-width / 2, -2.28], [-0.42, 0.48], [2.19, width / 2]]) box(parent, (left + right) / 2, 4.65, 2.5, right - left, 1.72, 0.2, '#e8dcc4', innerWall);
  // 十六级踏步的宽度和净空足以正常步行，不使用瞬移代替楼梯。
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const top = 0.275 + (floorY - 0.275) * (i + 1) / steps;
    const z = 2.17 - i * 0.28;
    const tread = box(parent, stairX, (top + 0.24) / 2, z, stairWidth, top - 0.24, 0.28, i % 2 ? '#b7a087' : '#ad9479', plain);
    tread.name = `${kind}二层楼梯第${i + 1}级`;
    tread.userData.walkSurface = true;
    box(parent, stairX, top - 0.02, z + 0.131, stairWidth, 0.04, 0.018, '#c8b294', plain);
    if (i > 0 && i < 14 && i % 3 === 0) cylinder(parent, stairX - stairWidth / 2 - 0.035, top + 0.44, z, 0.022, 0.87, '#7d6956', 7);
  }
  const rail = mesh(parent, new THREE.CylinderGeometry(0.024, 0.024, 1, 7), '#816d57', plain);
  const a = new THREE.Vector3(stairX - stairWidth / 2 - 0.035, 1.3, 2.17);
  const b = new THREE.Vector3(stairX - stairWidth / 2 - 0.035, 3.67, -1.47);
  rail.position.copy(a).add(b).multiplyScalar(0.5);
  rail.scale.y = a.distanceTo(b);
  rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  // 线型扶手的轴向包围盒会覆盖踏面，碰撞以独立的扶手柱为准。
  rail.userData.walkCollision = false;
  for (let x = -width / 2 + 0.3; x < holeLeft; x += 0.36) line(parent, [[x, floorY + 0.004, -2.35], [x, floorY + 0.004, 2.35]], '#b69a79');
  box(parent, -0.45, floorY + 0.012, 0.12, 2.0, 0.018, 1.55, kind === '咖啡店' ? '#abb3a0' : '#b79c86', plain);
  // 面向街道的窗边座位、书架、家庭收音机和未完成的手作。
  box(parent, -1.38, floorY + 0.33, -0.65, 1.96, 0.58, 0.74, kind === '咖啡店' ? '#8d9c89' : '#b49b82');
  box(parent, -1.38, floorY + 0.72, -0.97, 1.96, 0.48, 0.19, '#b1b4a0');
  for (const dx of [-0.92, 0.92]) box(parent, -1.38 + dx, floorY + 0.53, -0.65, 0.16, 0.65, 0.81, '#84907c');
  for (const x of [-1.95, -1.36, -0.78]) box(parent, x, floorY + 0.65, -0.66, 0.53, 0.09, 0.53, '#c5c8b3', plain);
  box(parent, -0.77, floorY + 0.4, 0.3, 1.31, 0.09, 0.67, '#b39470');
  for (const dx of [-0.53, 0.53]) for (const dz of [-0.25, 0.25]) box(parent, -0.77 + dx, floorY + 0.21, 0.3 + dz, 0.055, 0.34, 0.055, '#806d55', plain);
  box(parent, -1.07, floorY + 0.465, 0.28, 0.35, 0.024, 0.25, '#e9dcc4', plain);
  box(parent, -1.04, floorY + 0.483, 0.29, 0.3, 0.01, 0.2, '#bfb9a1', plain);
  cylinder(parent, -0.35, floorY + 0.51, 0.3, 0.06, 0.14, '#dbd7bf', 10);
  for (const y of [floorY + 0.28, floorY + 0.79, floorY + 1.3, floorY + 1.81]) box(parent, -2.62, y, -1.83, 0.35, 0.07, 1.08, '#9b8064', plain);
  for (const z of [-2.34, -1.32]) box(parent, -2.62, floorY + 1.03, z, 0.35, 1.59, 0.065, '#8f785e', plain);
  for (let i = 0; i < 9; i++) box(parent, -2.61, floorY + 1.5, -2.17 + i * 0.085, 0.25, 0.33 + i % 3 * 0.028, 0.07, ['#9badab', '#b8a994', '#b6a4a6'][i % 3], plain);
  box(parent, 0.46, floorY + 0.47, 1.75, 0.95, 0.8, 0.53, '#b2a17d');
  box(parent, 0.46, floorY + 0.88, 1.75, 1.03, 0.06, 0.61, '#816e55');
  box(parent, 0.54, floorY + 1.1, 1.76, 0.43, 0.38, 0.2, '#b8af8d', plain);
  for (let i = 0; i < 6; i++) box(parent, 0.43 + i * 0.028, floorY + 1.1, 1.87, 0.009, 0.26, 0.01, '#80755f', plain);
  cylinder(parent, 0.69, floorY + 1.1, 1.89, 0.025, 0.018, '#786e5d', 8).rotation.x = Math.PI / 2;
  box(parent, -0.08, floorY + 0.943, 1.75, 0.38, 0.05, 0.24, '#d7c8a9', plain);
  sign(parent, kind === '咖啡店' ? '二階・窓辺の読書室' : '二階・小さな休憩室', -0.35, floorY + 2.06, -2.382, 2.53, 0.27, { bg: '#f1e7cf', fg: '#788374' });
  const roomLamp = new THREE.Group();
  roomLamp.name = `${kind}二层阅读灯`;
  roomLamp.userData.dynamic = true;
  roomLamp.position.set(-1.95, floorY, 1.59);
  parent.add(roomLamp);
  cylinder(roomLamp, 0, 0.025, 0, 0.14, 0.035, '#8f8469', 10);
  cylinder(roomLamp, 0, 0.78, 0, 0.018, 1.52, '#958d74', 7);
  const shade = mesh(roomLamp, new THREE.ConeGeometry(0.25, 0.31, 12, 1, true), '#e5d5ad', plain);
  shade.position.y = 1.53;
  const bulb = mesh(roomLamp, new THREE.SphereGeometry(0.065, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff0b4', toneMapped: false }), plain);
  bulb.position.y = 1.49;
  let lampOn = true;
  const lampPosition = () => { parent.updateWorldMatrix(true, false); return parent.localToWorld(new THREE.Vector3(-1.95, floorY + 1.44, 1.59)); };
  const worldPoint = (x, y, z) => { parent.updateWorldMatrix(true, false); return parent.localToWorld(new THREE.Vector3(x, y, z)).toArray(); };
  return {
    interaction: {
      id: `${kind}-reading-lamp`, label: () => lampOn ? '关掉阅读灯' : '打开阅读灯', position: lampPosition, radius: 1.8,
      action({ toast }) { lampOn = !lampOn; bulb.material.color.set(lampOn ? '#fff0b4' : '#bdb7a2'); shade.material = kit.mat(lampOn ? '#e5d5ad' : '#b8b5a4'); toast(lampOn ? '阅读灯亮起，窗边又暖了一点。' : '阅读灯关好了，留下樱花映进来的日光。'); },
    },
    route: [worldPoint(1.51, kind === '咖啡店' ? 0.07 : 0.3, 3.35), worldPoint(1.51, 0.275, 2.28), worldPoint(stairX, 0.4575, 2.28), worldPoint(stairX, floorY, -2.05), worldPoint(1.43, floorY, -2.05)],
    upper: worldPoint(1.32, floorY, -1.74),
    floorY, stairX,
  };
}
