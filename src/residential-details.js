const resourcesByKit = new WeakMap();

export function decorateResidence(kit, parent, { width, depth, height, distant = false }) {
  const { THREE, box, cylinder, mesh, sign, rng } = kit;
  const front = depth / 2 + 0.08;
  const side = width / 2;
  const rear = -depth / 2;
  const doorX = -width * 0.14;
  const metal = '#6d7774';
  const aluminium = '#a4aaa4';
  const warmWood = '#8d7862';
  const brick = '#b88972';
  const options = { outline: false };

  if (!resourcesByKit.has(kit)) {
    resourcesByKit.set(kit, {
      rod: new THREE.CylinderGeometry(1, 1, 1, 6),
      leaf: new THREE.SphereGeometry(1, 6, 4),
      rain: new THREE.MeshBasicMaterial({ color: '#7a8583', transparent: true, opacity: 0.09, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
    });
  }
  const resources = resourcesByKit.get(kit);

  function rod(target, a, b, radius, tint) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const part = mesh(target, resources.rod, tint, options);
    part.position.copy(start.add(end).multiplyScalar(0.5));
    part.scale.set(radius, direction.length(), radius);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return part;
  }

  // 门边设施有各自的使用高度，入口和原有门前台阶保持通畅。
  box(parent, doorX - 0.86, 1.12, front + 0.15, 0.26, 0.46, 0.15, '#71807c', options);
  box(parent, doorX - 0.86, 1.26, front + 0.237, 0.21, 0.045, 0.027, '#465651', options);
  box(parent, doorX - 0.86, 1.04, front + 0.238, 0.08, 0.035, 0.018, '#d3d1bc', options);
  box(parent, doorX + 0.78, 1.49, front + 0.105, 0.105, 0.2, 0.065, '#b4b8ad', options);
  box(parent, doorX + 0.78, 1.47, front + 0.147, 0.055, 0.06, 0.018, '#566663', options);
  box(parent, doorX + 0.78, 2.21, front + 0.16, 0.18, 0.24, 0.15, '#f0d6a4', options);
  box(parent, doorX + 0.78, 2.36, front + 0.17, 0.27, 0.06, 0.24, metal, options);
  box(parent, doorX + 0.78, 2.07, front + 0.16, 0.2, 0.035, 0.17, metal, options);
  box(parent, doorX + 0.78, 2.22, front + 0.077, 0.045, 0.35, 0.035, metal, options);

  if (distant) return;

  const names = ['小森', '日向', '高橋', '青山', '桜井'];
  const name = names[Math.floor(rng() * names.length)];
  box(parent, doorX - 0.86, 1.67, front + 0.067, 0.32, 0.27, 0.045, warmWood, options);
  sign(parent, `${name}\n二丁目 八番`, doorX - 0.86, 1.67, front + 0.093, 0.28, 0.225, { bg: '#ece2cc', fg: '#625b51', fontSize: 175 });

  // 纤细防盗格栅跟着门叶转动，门打开后不会在入口留下隐形栅栏。
  const gateParent = parent.userData.doorLeaf || parent;
  const gateX = parent.userData.doorLeaf ? -0.6 : doorX;
  const gateZ = parent.userData.doorLeaf ? 0.11 : front + 0.19;
  const gateY = parent.userData.doorLeaf ? -0.24 : 0;
  for (const x of [gateX - 0.57, gateX + 0.57]) box(gateParent, x, 1.44 + gateY, gateZ, 0.035, 2.23, 0.035, '#718078', options);
  for (const y of [0.33, 1.05, 2.55]) box(gateParent, gateX, y + gateY, gateZ, 1.17, 0.035, 0.035, '#718078', options);
  for (let i = 0; i < 6; i += 1) box(gateParent, gateX - 0.47 + i * 0.188, 1.44 + gateY, gateZ + 0.008, 0.018, 2.15, 0.02, '#86928a', options);
  box(gateParent, gateX + 0.43, 1.31 + gateY, gateZ + 0.042, 0.028, 0.18, 0.035, '#b4b6a6', options);
  for (const y of [0.62, 2.26]) box(gateParent, gateX - 0.59, y + gateY, gateZ, 0.075, 0.095, 0.047, metal, options);

  // 电表和接线盒靠近侧墙前段，避开现有侧窗和室外机。
  box(parent, side + 0.115, 1.84, 0.13, 0.14, 0.42, 0.3, '#c0c2b5', options);
  const meterFace = mesh(parent, new THREE.CircleGeometry(0.102, 12), '#7e9490', options);
  meterFace.position.set(side + 0.19, 1.89, 0.13);
  meterFace.rotation.y = Math.PI / 2;
  box(parent, side + 0.192, 1.74, 0.13, 0.013, 0.048, 0.15, '#697771', options);
  box(parent, side + 0.086, 2.57, depth / 2 - 0.6, 0.14, 0.22, 0.21, '#aeb5a8', options);
  rod(parent, [side + 0.085, 2.46, depth / 2 - 0.6], [side + 0.085, 2.17, depth / 2 - 0.6], 0.021, metal);
  rod(parent, [side + 0.085, 2.17, depth / 2 - 0.6], [side + 0.085, 2.17, 0.13], 0.021, metal);
  rod(parent, [side + 0.085, 2.17, 0.13], [side + 0.085, 2.04, 0.13], 0.021, metal);
  const supplyPath = [
    [side + 0.08, 1.62, 0.13], [side + 0.08, 1.3, 0.13],
    [side + 0.08, 1.3, depth / 2 + 0.13], [side - 0.31, 1.3, depth / 2 + 0.13],
    [side - 0.31, 0.27, depth / 2 + 0.13],
  ];
  for (let i = 0; i < supplyPath.length - 1; i += 1) rod(parent, supplyPath[i], supplyPath[i + 1], 0.018, '#87918b');
  for (const y of [0.63, 1.04]) box(parent, side - 0.31, y, depth / 2 + 0.13, 0.087, 0.035, 0.044, '#a5aaa0', options);

  const pipeTop = height > 4 ? height - 1.2 : 2.35;
  rod(parent, [side + 0.075, pipeTop, 0.36], [side + 0.075, 1.05, 0.36], 0.035, '#c5bca7');
  rod(parent, [side + 0.075, 1.05, 0.36], [side + 0.42, 0.86, 0.36], 0.035, '#c5bca7');
  for (const y of [1.22, Math.min(2.63, pipeTop - 0.15)]) box(parent, side + 0.078, y, 0.36, 0.065, 0.045, 0.12, metal, options);
  for (const z of [0.28, 1.08]) {
    box(parent, side + 0.255, 0.42, z, 0.48, 0.052, 0.065, metal, options);
    box(parent, side + 0.023, 0.41, z, 0.054, 0.4, 0.065, metal, options);
    rod(parent, [side + 0.035, 0.23, z], [side + 0.46, 0.42, z], 0.024, metal);
  }

  // 折叠梯具有两组真实支腿和横档，收在院后而不占入口。
  const ladder = new THREE.Group();
  ladder.position.set(side + 0.46, 0.045, rear - 0.34);
  ladder.rotation.y = -0.15;
  parent.add(ladder);
  for (const x of [-0.25, 0.25]) {
    rod(ladder, [x, 0, 0.31], [x, 1.5, 0], 0.031, aluminium);
    rod(ladder, [x, 0, -0.27], [x, 1.5, 0], 0.031, aluminium);
    rod(ladder, [x, 0.58, 0.19], [x, 0.58, -0.16], 0.016, metal);
  }
  for (let i = 1; i < 6; i += 1) {
    const y = i * 0.24;
    box(ladder, 0, y, 0.31 * (1 - y / 1.5), 0.53, 0.034, 0.085, aluminium, options);
    if (i % 2 === 1) box(ladder, 0, y, -0.27 * (1 - y / 1.5), 0.53, 0.026, 0.043, metal, options);
  }
  box(ladder, 0, 1.5, 0, 0.57, 0.055, 0.23, '#9aa7a1', options);
  for (const x of [-0.25, 0.25]) for (const z of [-0.27, 0.31]) box(ladder, x, 0.024, z, 0.083, 0.052, 0.095, '#65736b', options);

  // 软管圈挂在墙钩上，尾端自然垂下，保留可辨认的园艺用途。
  const hoseZ = rear + 0.55;
  for (let i = 0; i < 4; i += 1) {
    const coil = mesh(parent, new THREE.TorusGeometry(0.2 + i * 0.052, 0.023, 4, 18), '#829a82', options);
    coil.rotation.y = Math.PI / 2;
    coil.position.set(side + 0.115 + i * 0.012, 0.82, hoseZ);
  }
  box(parent, side + 0.088, 1.21, hoseZ, 0.19, 0.038, 0.1, metal, options);
  const hoseTail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side + 0.15, 0.64, hoseZ + 0.27), new THREE.Vector3(side + 0.18, 0.29, hoseZ + 0.32),
    new THREE.Vector3(side + 0.5, 0.056, hoseZ + 0.47), new THREE.Vector3(side + 0.68, 0.048, hoseZ + 0.12),
  ]);
  mesh(parent, new THREE.TubeGeometry(hoseTail, 14, 0.023, 5, false), '#829a82', options);
  rod(parent, [side + 0.68, 0.05, hoseZ + 0.12], [side + 0.8, 0.05, hoseZ + 0.08], 0.029, '#b6b197');

  const wateringCan = new THREE.Group();
  wateringCan.position.set(side + 1.08, 0.05, rear - 0.3);
  wateringCan.rotation.y = 0.48;
  parent.add(wateringCan);
  const canBody = mesh(wateringCan, new THREE.CylinderGeometry(0.17, 0.21, 0.29, 8), '#83a398', options);
  canBody.position.y = 0.145;
  cylinder(wateringCan, 0, 0.298, 0, 0.125, 0.03, '#a9b7a1', 8);
  const handle = mesh(wateringCan, new THREE.TorusGeometry(0.155, 0.028, 5, 12), '#83a398', options);
  handle.position.set(-0.18, 0.29, 0);
  rod(wateringCan, [0.14, 0.15, 0], [0.4, 0.35, 0], 0.039, '#83a398');
  const spout = mesh(wateringCan, new THREE.CylinderGeometry(0.079, 0.05, 0.05, 7), '#b5bea6', options);
  spout.position.set(0.41, 0.36, 0);
  spout.rotation.z = -0.92;

  function plantPot(x, z, size, tint, flowering = false) {
    const pot = mesh(parent, new THREE.CylinderGeometry(size * 0.65, size * 0.49, size, 8), tint, options);
    pot.position.set(x, 0.05 + size / 2, z);
    cylinder(parent, x, 0.05 + size, z, size * 0.68, 0.055, tint, 8);
    cylinder(parent, x, 0.085 + size, z, size * 0.54, 0.015, '#766956', 8);
    for (let i = 0; i < 5; i += 1) {
      const angle = i / 5 * Math.PI * 2;
      const y = 0.1 + size + (i % 2 ? 0.19 : 0.27);
      const dx = Math.cos(angle) * size * 0.4;
      const dz = Math.sin(angle) * size * 0.4;
      rod(parent, [x, 0.08 + size, z], [x + dx, y, z + dz], 0.008, '#72875d');
      const leaf = mesh(parent, resources.leaf, i % 2 ? '#89a575' : '#6f906e', options);
      leaf.position.set(x + dx, y, z + dz);
      leaf.scale.set(size * 0.25, size * 0.55, size * 0.13);
      leaf.rotation.set(Math.sin(angle) * 0.6, angle, Math.cos(angle) * -0.5);
    }
    if (flowering) {
      const flower = mesh(parent, new THREE.IcosahedronGeometry(size * 0.14, 0), '#deb1b2', options);
      flower.position.set(x, size + 0.45, z);
    }
  }
  plantPot(side + 0.42, rear - 1.02, 0.32, brick);
  plantPot(side + 0.86, rear - 0.95, 0.24, '#bc947e', true);
  plantPot(-width * 0.32, rear - 0.38, 0.29, '#a5856f');

  // 重新粉刷的色差取自现有墙色，只留下整块低频变化。
  const wall = parent.children.find(part => part.isMesh && Math.abs(part.scale.x - width) < 0.01 && Math.abs(part.scale.y - height) < 0.01 && Math.abs(part.scale.z - depth) < 0.01);
  const baseColor = wall?.material?.color?.clone() || new THREE.Color('#d6cbb9');
  const refreshed = baseColor.clone().lerp(new THREE.Color('#f0e9d8'), 0.07);
  box(parent, side + 0.013, 2.16, rear + 0.48, 0.018, 0.72, 0.62, `#${refreshed.getHexString()}`, { outline: false, castShadow: false });
  const mossSpots = [[rear + 0.17, 0.28], [rear + 0.71, 0.19], [depth / 2 - 0.42, 0.23]];
  for (const [z, length] of mossSpots) {
    box(parent, side + 0.018, 0.13, z, 0.018, 0.068, length, '#8c9b7c', { outline: false, castShadow: false });
    box(parent, side + 0.086, 0.057, z, 0.16, 0.009, length * 0.83, '#99a589', { outline: false, castShadow: false });
  }

  // 所有雨痕合成一张透明网格，避免细碎墙面痕迹额外产生大量绘制调用。
  const rainPositions = [];
  const rainNormals = [];
  function rainMark(z, y, w, h) {
    const x = side + 0.027;
    const points = [
      [x, y - h / 2, z - w / 2], [x, y + h / 2, z - w / 2], [x, y + h / 2, z + w / 2],
      [x, y - h / 2, z - w / 2], [x, y + h / 2, z + w / 2], [x, y - h / 2, z + w / 2],
    ];
    for (const point of points) { rainPositions.push(...point); rainNormals.push(1, 0, 0); }
  }
  rainMark(rear + 0.21, height - 0.19, 0.058, 0.76);
  rainMark(rear + 0.38, height - 0.04, 0.035, 0.45);
  rainMark(depth / 2 - 0.29, height - 0.28, 0.063, 0.87);
  rainMark(depth / 2 - 0.51, height - 0.07, 0.028, 0.43);
  rainMark(rear + 0.75, 0.37, 0.51, 0.13);
  rainMark(0.91, 0.31, 0.4, 0.11);
  rainMark(depth / 2 - 0.4, 0.34, 0.3, 0.15);
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rainPositions, 3));
  rainGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(rainNormals, 3));
  const rain = new THREE.Mesh(rainGeometry, resources.rain);
  rain.name = '维护良好的墙面雨痕';
  parent.add(rain);
}
