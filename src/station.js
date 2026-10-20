// 桜坂駅：站房、站台、电车与平交道口。
export function createStation(kit) {
  const { THREE, box, cylinder, mesh, line, sign, roof, mat } = kit;
  const group = new THREE.Group();
  group.name = '桜坂駅';
  const interactions = [];
  const dynamicRoots = [];
  const colors = {
    cream: '#eadbc1', plaster: '#f0e4cd', wood: '#725c52', dark: '#454758',
    roof: '#687981', roofLight: '#84939a', mint: '#79aaa2', mintDark: '#548b85',
    glass: '#758e9b', glassLight: '#a6b7bb', yellow: '#e8bd66', metal: '#798388',
  };
  const B = (p, x, y, z, w, h, d, color, opts = {}) => box(p, x, y, z, w, h, d, color, opts);
  const C = (p, x, y, z, r, h, color, segments = 8) => cylinder(p, x, y, z, r, h, color, segments);
  const plain = { outline: false };
  const stationGlass = new THREE.MeshBasicMaterial({ color: '#b6d1ca', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const entranceX = 5;
  const entranceWidth = 3.9;
  const gateCenters = [3.4, 4.85, 6.3];
  const passageCenters = [4.125, 5.575];
  const tactileX = passageCenters[0];
  const clockHourAngle = (4 + 20 / 60) * Math.PI / 6;
  const clockMinuteAngle = 20 * Math.PI / 30;
  group.userData.passageCenters = passageCenters;
  group.userData.gateCenters = gateCenters;
  group.userData.frontOpening = { centerX: entranceX, width: entranceWidth };
  group.userData.rearOpening = { centerX: entranceX, width: entranceWidth };
  group.userData.tactilePathX = tactileX;
  group.userData.clock = { hour: 16, minute: 20, hourAngle: clockHourAngle, minuteAngle: clockMinuteAngle };
  const label = (p, text, x, y, z, w, h, opts = {}) => sign(p, text, x, y, z, w, h, {
    ...opts, bg: opts.background ?? opts.bg, fg: opts.color ?? opts.fg,
  });
  function tube(parent, from, to, radius, color) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const beam = C(parent, ...a.clone().add(b).multiplyScalar(0.5).toArray(), radius, a.distanceTo(b), color);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return beam;
  }
  function repeatedBoxes(parent, positions, size, color, shadows = false) {
    const geometry = new THREE.BoxGeometry(...size);
    const objects = new THREE.InstancedMesh(geometry, mat(color), positions.length);
    const transform = new THREE.Object3D();
    positions.forEach((position, i) => {
      transform.position.set(...position);
      transform.updateMatrix();
      objects.setMatrixAt(i, transform.matrix);
    });
    objects.castShadow = shadows;
    objects.receiveShadow = true;
    parent.add(objects);
    return objects;
  }

  // 两道铁轨的轨枕与道床保留独立的结构层次。
  for (const z of [-16, -20.5]) {
    B(group, 0, -0.055, z, 130, 0.17, 3.65, '#98958b', plain);
    B(group, 0, 0.025, z, 130, 0.16, 3.1, '#aaa49a', plain);
    const sleepers = [];
    const bolts = [];
    for (let x = -64.4; x < 65; x += 0.7) {
      sleepers.push([x, 0.15, z]);
      bolts.push([x, 0.265, z - 0.74], [x, 0.265, z + 0.74]);
    }
    repeatedBoxes(group, sleepers, [0.21, 0.16, 2.48], '#77786e');
    repeatedBoxes(group, bolts, [0.28, 0.075, 0.26], '#676768');
    for (const side of [-1, 1]) {
      B(group, 0, 0.265, z + side * 0.75, 130, 0.16, 0.09, '#626779', plain);
      B(group, 0, 0.355, z + side * 0.75, 130, 0.035, 0.14, '#a0a7ac', plain);
    }
    // 大颗粒色块表达碎石，避免照片般的高频噪点。
    const stonePositions = [];
    for (let i = 0; i < 245; i++) {
      const x = -64 + (i / 244) * 128;
      stonePositions.push([x, 0.13, z + Math.sin(i * 6.7) * 1.55]);
    }
    repeatedBoxes(group, stonePositions, [0.18, 0.08, 0.22], '#beb9ac');
  }

  // 站房前侧由两间小房与中央通道组成，入口留出真实可通行的空间。
  B(group, 5, 0.1, -8, 12.25, 0.2, 5.35, '#b7b1a5');
  for (const x of [1.025, 8.975]) B(group, x, 1.65, -10.4, 4.05, 3.1, 0.22, colors.plaster);
  B(group, 5, 2.975, -10.4, 3.9, 0.45, 0.22, colors.plaster);
  B(group, -0.9, 1.65, -8, 0.23, 3.1, 4.95, colors.cream);
  B(group, 10.9, 1.65, -9.85, 0.23, 3.1, 1.25, colors.cream);
  B(group, 10.9, 1.65, -6.7625, 0.23, 3.1, 2.475, colors.cream);
  B(group, 10.9, 2.8, -8.625, 0.23, 0.8, 1.2, colors.cream);
  // 前墙同样按窗洞拆分，透明售票玻璃后可读到室内台面。
  B(group, 1.025, 0.6925, -5.62, 4.05, 1.185, 0.24, colors.plaster);
  B(group, 1.025, 2.83, -5.62, 4.05, 0.74, 0.24, colors.plaster);
  B(group, -0.8225, 1.87, -5.62, 0.355, 1.18, 0.24, colors.plaster);
  B(group, 2.2475, 1.87, -5.62, 1.605, 1.18, 0.24, colors.plaster);
  B(group, 8.975, 0.6775, -5.62, 4.05, 1.155, 0.24, colors.plaster);
  B(group, 8.975, 2.8475, -5.62, 4.05, 0.705, 0.24, colors.plaster);
  B(group, 7.19, 1.87, -5.62, 0.48, 1.27, 0.24, colors.plaster);
  B(group, 10.585, 1.87, -5.62, 0.83, 1.27, 0.24, colors.plaster);
  B(group, 5, 2.94, -5.56, 12, 0.57, 0.32, colors.cream);
  for (const x of [1.025, 8.975]) B(group, x, 0.28, -5.46, 4.05, 0.34, 0.2, '#9c9181');
  // 入口的门槛与缓坡。
  B(group, 5, 0.19, -5.36, 3.9, 0.16, 0.74, '#cfc4ac');
  const rampGeometry = new THREE.BufferGeometry();
  rampGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    3.05, 0.0, -4.5, 6.95, 0.0, -4.5, 6.95, 0.26, -5.72,
    3.05, 0.0, -4.5, 6.95, 0.26, -5.72, 3.05, 0.26, -5.72,
  ], 3));
  rampGeometry.computeVertexNormals();
  mesh(group, rampGeometry, '#d2c8b5', plain);
  for (const x of [-0.93, 2.97, 7.03, 10.93]) {
    B(group, x, 1.75, -5.37, 0.18, 3.25, 0.18, colors.wood);
    B(group, x, 0.45, -5.34, 0.29, 0.37, 0.28, '#a0988c');
  }
  for (const x of [1.025, 8.975]) B(group, x, 0.72, -5.46, 4.05, 0.11, 0.15, colors.wood);
  B(group, 5, 2.52, -5.46, 12.12, 0.11, 0.15, colors.wood);
  // 长年使用的暖棕木护墙，让站房与乳白色住宅具有不同的轮廓和表情。
  for (const [center, width] of [[1.025, 3.9], [8.975, 3.9]]) {
    B(group, center, 0.63, -5.43, width, 0.68, 0.1, '#a18468');
    for (let x = center - width / 2 + 0.13; x < center + width / 2; x += 0.24) {
      B(group, x, 0.62, -5.36, 0.015, 0.6, 0.02, '#80674f', plain);
    }
    B(group, center, 1.015, -5.38, width + 0.08, 0.07, 0.16, '#95775b');
  }
  B(group, -0.94, 0.69, -8.04, 0.15, 0.81, 4.91, '#aa8b6b');
  B(group, -0.94, 1.12, -8.04, 0.17, 0.07, 4.91, '#8e7058', plain);
  for (const [z, depth] of [[-9.85, 1.25], [-6.7625, 2.475]]) {
    B(group, 10.94, 0.69, z, 0.15, 0.81, depth, '#aa8b6b');
    B(group, 10.94, 1.12, z, 0.17, 0.07, depth, '#8e7058', plain);
  }
  B(group, 5, 3.2, -8, 12.35, 0.19, 5.28, '#8d7965');
  roof(group, 5, 3.18, -8, 13.5, 6.1, 1.38, colors.roof);
  // 瓦垄、屋脊与檐口均用柔和灰色细线呈现。
  for (let x = -1.65; x <= 11.65; x += 0.43) {
    line(group, [[x, 3.24, -4.94], [x, 4.58, -8], [x, 3.24, -11.06]], '#84939a');
  }
  for (let i = 1; i <= 5; i++) {
    const distance = i * 0.5;
    const y = 4.58 - distance * 1.38 / 3.05 + 0.014;
    line(group, [[-1.7, y, -8 + distance], [11.7, y, -8 + distance]], '#647580');
    line(group, [[-1.7, y, -8 - distance], [11.7, y, -8 - distance]], '#647580');
  }
  B(group, 5, 4.59, -8, 13.55, 0.12, 0.16, '#536872');
  for (const z of [-4.94, -11.06]) {
    B(group, 5, 3.21, z, 13.52, 0.12, 0.14, '#536872');
    B(group, 5, 3.12, z, 13.52, 0.08, 0.13, '#938677', plain);
    // 檐沟是有底板与两侧边的开口金属槽。
    B(group, 5, 3.064, z, 13.58, 0.025, 0.21, '#7b8a8c', plain);
    for (const dz of [-0.095, 0.095]) B(group, 5, 3.109, z + dz, 13.58, 0.1, 0.026, '#6e7e82', plain);
  }
  for (let x = -1.3; x <= 11.3; x += 0.61) {
    B(group, x, 3.025, -5.2, 0.095, 0.1, 0.91, '#866b51', plain);
    B(group, x, 3.025, -10.82, 0.095, 0.1, 0.69, '#866b51', plain);
  }
  for (const x of [-1.25, 11.25]) {
    C(group, x, 1.53, -5.04, 0.055, 3.0, '#74848a');
    B(group, x, 0.09, -4.92, 0.35, 0.1, 0.32, '#a8a79c');
    tube(group, [x, 3.06, -4.94], [x, 2.92, -5.04], 0.055, '#74848a');
    tube(group, [x, 0.17, -5.04], [x, 0.1, -4.87], 0.055, '#74848a');
    C(group, x, 1.53, -10.97, 0.052, 3.0, '#79898b');
    tube(group, [x, 3.06, -11.06], [x, 2.93, -10.97], 0.052, '#79898b');
    tube(group, [x, 0.18, -10.97], [x, 0.1, -10.78], 0.052, '#79898b');
    for (const y of [0.62, 2.37]) B(group, x, y, -5.03, 0.16, 0.05, 0.13, '#99a09a', plain);
  }
  // 独立山墙门廊，两个深棕柱、檐下梁及斜撑清楚落到柱础上。
  const porch = new THREE.Group();
  porch.name = '入口山墙门廊';
  group.add(porch);
  const porchRoof = roof(porch, 5, 3.34, -4.82, 3.4, 5.1, 0.94, colors.roof);
  porchRoof.rotation.y = Math.PI / 2;
  for (const x of [2.83, 7.17]) {
    B(porch, x, 1.765, -3.43, 0.2, 3.13, 0.2, '#644d3d');
    B(porch, x, 0.16, -3.43, 0.37, 0.29, 0.36, '#aaa38f');
    tube(porch, [x, 2.69, -3.43], [x + (x < 5 ? 0.51 : -0.51), 3.23, -3.43], 0.042, '#80634b');
  }
  B(porch, 5, 3.255, -3.43, 4.61, 0.16, 0.19, '#71543f');
  for (const x of [2.83, 7.17]) B(porch, x, 3.21, -4.5, 0.14, 0.13, 2.38, '#796047');
  for (let z = -6.22; z <= -3.18; z += 0.41) {
    tube(porch, [2.47, 3.29, z], [5, 4.21, z], 0.029, '#927353');
    tube(porch, [5, 4.21, z], [7.53, 3.29, z], 0.029, '#927353');
  }
  const gable = new THREE.BufferGeometry();
  gable.setAttribute('position', new THREE.Float32BufferAttribute([2.45, 3.34, -3.112, 7.55, 3.34, -3.112, 5, 4.28, -3.112], 3));
  gable.computeVertexNormals();
  mesh(porch, gable, colors.cream, plain);
  tube(porch, [2.45, 3.35, -3.079], [5, 4.27, -3.079], 0.039, '#846750');
  tube(porch, [5, 4.27, -3.079], [7.55, 3.35, -3.079], 0.039, '#846750');
  B(porch, 5, 3.77, -3.07, 0.065, 0.81, 0.06, '#a98c69', plain);
  for (const x of [2.45, 7.55]) {
    B(porch, x, 3.31, -4.82, 0.16, 0.045, 3.45, '#7c8b8b', plain);
    B(porch, x, 3.35, -4.82, 0.035, 0.11, 3.45, '#7c8b8b', plain);
  }
  // 售票窗口与站务室。
  function stationWindow(x, z, width, height, y = 1.87) {
    for (const dx of [-width / 2 - 0.035, width / 2 + 0.035]) B(group, x + dx, y, z, 0.07, height + 0.14, 0.1, '#68513f');
    for (const dy of [-height / 2 - 0.035, height / 2 + 0.035]) B(group, x, y + dy, z, width + 0.14, 0.07, 0.1, '#68513f');
    const glassPane = mesh(group, new THREE.PlaneGeometry(width, height), stationGlass, { ...plain, castShadow: false, receiveShadow: false });
    glassPane.position.set(x, y, z + 0.033);
    B(group, x, y, z + 0.079, 0.055, height, 0.035, '#ddcfb7', plain);
    B(group, x, y - 0.07, z + 0.081, width, 0.055, 0.04, '#ddcfb7', plain);
    B(group, x - width * 0.28, y + 0.12, z + 0.084, 0.045, height * 0.76, 0.015, '#aec1c2', { ...plain, rotation: [0, 0, -0.14] });
  }
  stationWindow(0.4, -5.41, 1.95, 1.18);
  stationWindow(8.8, -5.41, 2.6, 1.27);
  B(group, 0.4, 1.24, -5.24, 2.12, 0.11, 0.39, '#88756a');
  B(group, 0.4, 1.307, -5.13, 1.52, 0.025, 0.27, '#aab3ad', plain);
  B(group, 0.4, 1.325, -5.006, 1.52, 0.032, 0.024, '#81918d', plain);
  B(group, 0.35, 0.92, -6.65, 2.08, 0.07, 0.74, '#a78a65');
  for (const x of [-0.47, 1.17]) B(group, x, 0.56, -6.65, 0.065, 0.67, 0.49, '#7f705a', plain);
  B(group, -0.22, 0.979, -6.42, 0.43, 0.02, 0.29, '#e9e2c9', plain);
  B(group, 0.89, 1.124, -6.6, 0.41, 0.32, 0.16, '#8d9d91');
  label(group, '窓口  7:00–19:00', 1.91, 1.86, -5.455, 0.68, 0.42, { background: '#efe7d0', color: '#6d7060' });
  label(group, 'きっぷ・ご案内', 0.4, 2.64, -5.24, 2.54, 0.3, { background: '#ece3cf', color: '#586963' });
  label(group, '駅務室', 8.8, 2.68, -5.24, 1.1, 0.27, { background: '#e9e2cf', color: '#5f6d66' });
  B(group, 5, 3.055, -3.015, 4.55, 0.8, 0.12, '#795f4d');
  label(group, '桜坂駅', 5, 3.125, -2.946, 4.32, 0.53, { background: '#f1ecda', color: '#385f5b', fontWeight: 700 });
  label(group, 'Sakurazaka Station', 5, 2.786, -2.945, 4.32, 0.16, { background: '#f1ecda', color: '#697a73' });
  // 老车站的机械时钟。
  const clockFace = mesh(group, new THREE.CircleGeometry(0.35, 32), '#f8efd6', plain);
  clockFace.position.set(10.25, 3.04, -4.95);
  const clockRing = mesh(group, new THREE.TorusGeometry(0.36, 0.04, 5, 32), '#586c73', plain);
  clockRing.position.set(10.25, 3.04, -4.92);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const tick = B(group, 10.25 + Math.sin(angle) * 0.275, 3.04 + Math.cos(angle) * 0.275, -4.912, 0.027, 0.059, 0.009, '#637079', plain);
    tick.rotation.z = -angle;
  }
  const clockHands = [];
  for (const [angle, length] of [[clockHourAngle, 0.185], [clockMinuteAngle, 0.265]]) {
    const hand = B(group, 10.25 + Math.sin(angle) * length / 2, 3.04 + Math.cos(angle) * length / 2, -4.89, 0.024, length, 0.018, '#52656d', plain);
    hand.rotation.z = -angle;
    hand.userData.dynamic = true;
    clockHands.push({ hand, length });
  }
  const clockPin = mesh(group, new THREE.CircleGeometry(0.031, 12), '#64737b', plain);
  clockPin.position.set(10.25, 3.04, -4.871);
  // 墙面的补丁和一块旧公告栏。
  B(group, -0.18, 0.97, -5.466, 0.65, 0.17, 0.012, '#ded0b5', plain);
  B(group, 9.6, 0.99, -5.466, 1.13, 0.2, 0.012, '#e0d1b7', plain);
  B(group, 10.1, 1.33, -5.25, 0.9, 1.05, 0.1, colors.wood);
  B(group, 10.1, 1.33, -5.18, 0.81, 0.95, 0.03, '#b9b09b', plain);
  label(group, '春の沿線だより', 10.1, 1.6, -5.156, 0.66, 0.23, { background: '#f0e6cb', color: '#78635a' });
  label(group, '桜まつり\n4.12 — 4.19', 10.1, 1.19, -5.153, 0.67, 0.47, { background: '#efd4ce', color: '#805d63' });
  for (const x of [9.61, 10.59]) B(group, x, 1.33, -5.122, 0.035, 1.13, 0.05, '#89958f', plain);
  for (const y of [0.775, 1.885]) B(group, 10.1, y, -5.122, 1.015, 0.035, 0.05, '#89958f', plain);
  const noticeCover = mesh(group, new THREE.PlaneGeometry(0.92, 1.025), stationGlass, { ...plain, castShadow: false, receiveShadow: false });
  noticeCover.position.set(10.1, 1.33, -5.091);
  B(group, 10.1, 0.974, -5.117, 0.65, 0.045, 0.009, '#f2d9ce', { ...plain, rotation: [0.24, 0, 0] });
  // 后墙右侧的玻璃罩公告、地区地图和春季海报，不悬在出口里。
  B(group, 8.9, 1.75, -10.247, 3.3, 1.9, 0.09, '#98a196');
  B(group, 8.9, 1.75, -10.192, 3.16, 1.77, 0.025, '#c8c1ad', plain);
  label(group, 'ご案内・桜坂のまち', 8.9, 2.44, -10.17, 2.93, 0.24, { background: '#e8e3cf', color: '#5c7367' });
  label(group, '発車時刻\n16:24  さくら野\n16:39  海辺\n16:54  さくら野', 7.84, 1.74, -10.166, 0.96, 1.05, { background: '#eee9d5', color: '#68776a' });
  label(group, '春の桜さんぽ\n4月  沿線の小さな旅', 9.06, 1.78, -10.166, 1.1, 0.95, { background: '#ead2c7', color: '#916c66' });
  B(group, 9.06, 1.306, -10.138, 1.04, 0.044, 0.014, '#f3ddd0', { ...plain, rotation: [0.3, 0, 0] });
  label(group, '桜坂周辺図', 10.07, 2.14, -10.165, 0.78, 0.23, { background: '#e5e7ce', color: '#6d7d62' });
  B(group, 10.07, 1.675, -10.171, 0.84, 0.64, 0.015, '#dde2c6', plain);
  line(group, [[9.7, 1.45, -10.154], [9.92, 1.63, -10.154], [10.32, 1.64, -10.154], [10.43, 1.88, -10.154]], '#91a499');
  line(group, [[9.72, 1.88, -10.153], [10.01, 1.75, -10.153], [10.33, 1.43, -10.153]], '#c2a889');
  for (const [x, y] of [[9.89, 1.54], [10.17, 1.8], [10.35, 1.69]]) B(group, x, y, -10.146, 0.075, 0.058, 0.01, '#b48b77', plain);
  const rearNoticeCover = mesh(group, new THREE.PlaneGeometry(3.13, 1.735), stationGlass, { ...plain, castShadow: false, receiveShadow: false });
  rearNoticeCover.position.set(8.9, 1.75, -10.119);
  // 米灰旧方砖用两组实例色块铺满室内，地面留出两条真正的通道。
  for (const parity of [0, 1]) {
    const tiles = [];
    for (let ix = 0; ix < 27; ix++) for (let iz = 0; iz < 11; iz++) {
      if ((ix + iz) % 2 === parity) tiles.push([-0.73 + ix * 0.44, 0.22, -5.63 - iz * 0.44]);
    }
    repeatedBoxes(group, tiles, [0.431, 0.025, 0.431], parity ? '#c7c1ad' : '#d4cfbd');
  }
  B(group, tactileX, 0.257, -7.795, 0.3, 0.028, 5.11, '#e4be68', plain);
  for (const dx of [-0.095, 0, 0.095]) B(group, tactileX + dx, 0.279, -7.795, 0.024, 0.015, 5.1, '#edcc80', plain);
  B(group, tactileX, 0.018, -3.835, 0.3, 0.031, 1.33, '#dfbb68', plain);
  const tactileRamp = new THREE.BufferGeometry();
  tactileRamp.setAttribute('position', new THREE.Float32BufferAttribute([
    tactileX - 0.15, 0.025, -4.5, tactileX + 0.15, 0.025, -4.5, tactileX + 0.15, 0.285, -5.72,
    tactileX - 0.15, 0.025, -4.5, tactileX + 0.15, 0.285, -5.72, tactileX - 0.15, 0.285, -5.72,
  ], 3));
  tactileRamp.computeVertexNormals();
  mesh(group, tactileRamp, '#e6c16e', plain);
  for (const x of [3.7, 6.2]) {
    B(group, x, 2.89, -6.05, 1.17, 0.095, 0.24, '#858b80');
    B(group, x, 2.832, -6.05, 1.04, 0.028, 0.19, '#fbebbd', plain);
  }
  for (const x of [3.48, 6.53]) C(group, x, 2.75, -8.74, 0.012, 0.46, '#809084');
  label(group, '1番線  →  さくら野・海辺', 5, 2.48, -8.73, 3.15, 0.36, { background: '#e9e7cf', color: '#47746b' });
  // 三座窄闸机形成两条净宽约 90 厘米的通道，盲道走左侧通道中央。
  for (const x of gateCenters) {
    B(group, x, 0.71, -7.15, 0.55, 1.0, 1.45, '#899b97');
    B(group, x, 1.23, -7.15, 0.61, 0.08, 1.5, '#d7d9c8');
    B(group, x, 1.283, -6.62, 0.3, 0.018, 0.3, '#516963', plain);
    B(group, x + 0.305, 0.78, -7.06, 0.055, 0.44, 0.35, '#6b9d97', plain);
    label(group, 'IC', x, 1.294, -6.34, 0.22, 0.15, { background: '#d6e3cb', color: '#456f61' });
  }
  const ticketMachine = new THREE.Group();
  ticketMachine.name = '入口自动售票机';
  ticketMachine.position.set(1.32, 0, 0.55);
  group.add(ticketMachine);
  group.userData.ticketMachinePosition = [3.48, 1.03, -5.8];
  B(ticketMachine, 2.16, 1.03, -6.35, 0.82, 1.61, 0.62, '#bbcbc1');
  B(ticketMachine, 2.16, 1.78, -5.995, 0.72, 0.29, 0.07, '#50776c');
  label(ticketMachine, 'きっぷ', 2.16, 1.78, -5.942, 0.67, 0.23, { background: '#50776c', color: '#f3efcf' });
  B(ticketMachine, 2.16, 1.27, -5.979, 0.5, 0.42, 0.035, '#a5b7ae', plain);
  label(ticketMachine, '160  210  280', 2.16, 1.31, -5.947, 0.45, 0.2, { background: '#e9edcc', color: '#58736a' });
  B(ticketMachine, 2.16, 0.76, -5.977, 0.41, 0.07, 0.06, '#4d6663', plain);
  B(ticketMachine, 2.4, 1.02, -5.966, 0.08, 0.12, 0.02, '#787f78', plain);
  const printedTicket = new THREE.Group();
  printedTicket.name = '售票机吐出的桜坂线车票';
  printedTicket.userData.dynamic = true;
  printedTicket.visible = false;
  printedTicket.position.set(3.48, 0.793, -5.368);
  group.add(printedTicket);
  B(printedTicket, 0, 0, 0, 0.24, 0.01, 0.17, '#eedec1', plain);
  const ticketWriting = label(printedTicket, '桜坂 → さくら野\n160円', 0, 0.009, 0, 0.205, 0.11, { background: '#efdfc0', color: '#687168' });
  ticketWriting.rotation.x = -Math.PI / 2;
  interactions.push({
    id: 'station-ticket', label: () => printedTicket.visible ? '取走桜坂线车票' : '购买桜坂线车票 · ¥160', position: new THREE.Vector3(3.48, 1.38, -5.39), radius: 1.8,
    action({ inspect, toast }) {
      printedTicket.visible = !printedTicket.visible;
      if (printedTicket.visible) inspect('桜坂駅 · 桜坂线', '售票机轻轻一响，车票从下方票口伸出来了。桜坂 → さくら野，160 円。再按一次互动取票，然后沿黄色盲道穿过检票通道前往站台。');
      else toast('车票已经收好：桜坂 → さくら野。下一班电车就在樱花树旁。');
    },
  });
  label(group, '桜坂線 路線図', 1.01, 2.2, -10.23, 2.95, 0.67, { background: '#f0edda', color: '#657d77' });
  B(group, 1.01, 1.6, -10.15, 2.92, 0.05, 0.03, '#bd9585', plain);
  for (const x of [-0.14, 0.43, 1.0, 1.57, 2.14]) {
    const point = mesh(group, new THREE.CircleGeometry(0.045, 12), '#816f6d', plain);
    point.position.set(x, 1.6, -10.11);
  }

  // 站台沿线路展开，盲道与黄色安全线均可辨认。
  B(group, 4.5, 0.4, -12.58, 31, 0.8, 3.12, '#b2ada2');
  B(group, 4.5, 0.81, -12.58, 31, 0.07, 3.12, '#d1c8b5');
  B(group, 4.5, 0.86, -13.73, 30.7, 0.025, 0.24, '#e9c56e', plain);
  B(group, 4.5, 0.86, -13.98, 31, 0.025, 0.09, '#f4df9e', plain);
  for (let x = -10.6; x < 20; x += 0.58) {
    B(group, x, 0.887, -13.73, 0.03, 0.015, 0.14, '#cfa651', plain);
  }
  for (let x = -10.8; x < 20; x += 1.35) {
    line(group, [[x, 0.852, -11.05], [x, 0.852, -13.42]], '#b3ad9f');
  }
  // 出口开口与四级台阶同轴，盲道每一级都有实际踏面。
  for (let i = 0; i < 4; i++) {
    const z = -10.25 - i * 0.27;
    B(group, 5, 0.14 + i * 0.2, z, 3.9, 0.21, 0.34, '#c0b6a3');
    B(group, tactileX, 0.264 + i * 0.2, z, 0.3, 0.026, 0.34, '#e6c16e', plain);
  }
  B(group, tactileX, 0.878, -12.39, 0.3, 0.025, 2.77, '#e8c373', plain);
  for (const dx of [-0.09, 0, 0.09]) B(group, tactileX + dx, 0.898, -12.39, 0.023, 0.014, 2.77, '#edcd89', plain);
  const canopy = new THREE.Group();
  group.add(canopy);
  for (const x of [-6.6, -2.2, 2.2, 6.6]) {
    B(canopy, x, 2.35, -11.95, 0.16, 3.0, 0.16, '#718882');
    B(canopy, x, 0.98, -11.95, 0.36, 0.25, 0.37, '#9c9d8f');
    tube(canopy, [x, 3.04, -11.95], [x, 3.67, -12.65], 0.042, '#738781');
    tube(canopy, [x, 3.04, -11.95], [x, 3.67, -11.35], 0.042, '#738781');
    B(canopy, x, 3.67, -12.2, 0.1, 0.15, 2.05, '#6e817a');
  }
  // 顶棚只覆盖西侧半站台，右侧车厢和车头在日光下完整显露。
  B(canopy, 0.5, 3.76, -12.2, 15, 0.19, 2.03, '#84938c');
  B(canopy, 0.5, 3.875, -12.2, 15.25, 0.05, 2.18, '#a6aca0', plain);
  for (const z of [-13.29, -11.11]) B(canopy, 0.5, 3.77, z, 15.35, 0.23, 0.13, '#667d76');
  for (let x = -6.85; x < 8; x += 0.65) line(canopy, [[x, 3.91, -13.22], [x, 3.91, -11.18]], '#8f9e93');
  for (const x of [-5.6, 0.6, 6.2]) {
    B(canopy, x, 3.59, -12.16, 1.08, 0.07, 0.23, '#ece7c8', plain);
    B(canopy, x, 3.57, -12.16, 0.9, 0.035, 0.15, '#fff0bf', plain);
  }
  label(group, '1  桜坂線 ／ さくら野・海辺方面', 1.0, 3.26, -10.97, 4.2, 0.48, { background: '#eee8d2', color: '#3d776f' });
  label(group, '桜坂駅', 16.5, 2.72, -11.77, 2.5, 0.52, { background: '#e9ecdb', color: '#456e63' });
  label(group, 'さくらざか  SAKURAZAKA', 16.5, 2.34, -11.76, 2.5, 0.22, { background: '#e9ecdb', color: '#5e7f72' });
  for (const x of [15.27, 17.73]) B(group, x, 1.75, -11.9, 0.065, 1.8, 0.065, '#7a8b7d', plain);
  label(group, '時刻表', -6.9, 2.48, -11.76, 0.8, 0.2, { background: '#e7dec9', color: '#716e61' });
  label(group, '16:24  さくら野\n16:39  海辺\n16:54  さくら野', -6.9, 2.03, -11.75, 0.92, 0.6, { background: '#e9e5d1', color: '#6c736d' });
  // 站台木长椅。
  function bench(x, z, width = 2.4) {
    for (const dx of [-width * 0.34, width * 0.34]) {
      B(group, x + dx, 1.06, z, 0.085, 0.4, 0.56, '#727c77');
      B(group, x + dx, 1.38, z - 0.2, 0.07, 0.87, 0.09, '#727c77');
    }
    for (const dz of [-0.18, 0, 0.18]) B(group, x, 1.29, z + dz, width, 0.06, 0.16, '#ad8c69');
    for (const y of [1.53, 1.69]) B(group, x, y, z - 0.24, width, 0.12, 0.065, '#b79971');
  }
  bench(-3.5, -11.8);
  bench(10.1, -11.8, 2.6);
  for (const x of [-10.8, 19.8]) {
    for (let z = -13.8; z < -11; z += 0.6) C(group, x, 1.22, z, 0.033, 0.8, '#738277');
    tube(group, [x, 1.6, -13.9], [x, 1.6, -11.05], 0.033, '#849382');
    tube(group, [x, 1.23, -13.9], [x, 1.23, -11.05], 0.026, '#849382');
  }
  for (const x of [-8.3, 18.6]) {
    C(group, x, 1.11, -11.48, 0.21, 0.53, '#809386');
    C(group, x, 1.39, -11.48, 0.23, 0.06, '#bbc5ae');
    B(group, x, 1.41, -11.45, 0.2, 0.045, 0.09, '#52675d', plain);
  }
  // 平台西端的低矮栏杆与指示牌。
  for (let x = -10.9; x <= -2; x += 1.45) C(group, x, 1.26, -11.02, 0.035, 0.82, '#849082');
  tube(group, [-10.95, 1.66, -11.02], [-2.1, 1.66, -11.02], 0.035, '#919a8c');

  // 站前木长椅保留通向门廊的中间空地。
  for (const x of [-0.57, 1.07]) {
    B(group, x, 0.26, -3.89, 0.085, 0.46, 0.51, '#776955');
    B(group, x, 0.55, -4.1, 0.07, 0.93, 0.09, '#79644c');
  }
  for (const z of [-4.04, -3.87, -3.7]) B(group, 0.25, 0.52, z, 2.43, 0.065, 0.145, '#b08f69');
  for (const y of [0.79, 0.96]) B(group, 0.25, y, -4.11, 2.43, 0.125, 0.065, '#b59871');
  // 独立旅游地图牌落在两个支脚上，手绘道路与樱花景点为低频色块。
  for (const x of [8.16, 9.84]) B(group, x, 0.93, -3.66, 0.09, 1.84, 0.09, '#718875');
  B(group, 9, 1.54, -3.66, 1.93, 1.46, 0.13, '#809480');
  B(group, 9, 1.54, -3.577, 1.79, 1.31, 0.025, '#e3e1c5', plain);
  label(group, '桜坂  おさんぽ案内', 9, 2.032, -3.557, 1.66, 0.24, { background: '#f0e7ce', color: '#55725e' });
  line(group, [[8.28, 1.07, -3.55], [8.74, 1.31, -3.55], [9.01, 1.74, -3.55], [9.51, 1.62, -3.55], [9.79, 1.84, -3.55]], '#9fa38a');
  line(group, [[8.38, 1.82, -3.548], [8.81, 1.55, -3.548], [9.11, 1.2, -3.548], [9.74, 1.09, -3.548]], '#a6b6a4');
  line(group, [[8.31, 1.43, -3.546], [9.72, 1.43, -3.546]], '#b79b80');
  for (const [x, y] of [[8.54, 1.28], [9.12, 1.69], [9.47, 1.16]]) {
    const dot = mesh(group, new THREE.CircleGeometry(0.059, 8), '#d5a1a7', plain);
    dot.position.set(x, y, -3.536);
  }
  label(group, '駅前  /  桜並木  /  川の小径', 9, 0.999, -3.541, 1.67, 0.16, { background: '#e3e1c5', color: '#6b7963' });
  // 东侧员工门与维护小院均止于站台前方，不占用铁轨。
  const staffDoor = new THREE.Group();
  staffDoor.position.set(11.054, 0, -8.625);
  staffDoor.rotation.y = Math.PI / 2;
  group.add(staffDoor);
  for (const x of [-0.59, 0.59]) B(staffDoor, x, 1.36, 0, 0.07, 2.32, 0.13, '#66756a');
  B(staffDoor, 0, 2.55, 0, 1.25, 0.08, 0.13, '#66756a');
  const staffLeaf = new THREE.Group();
  staffLeaf.name = '可进入的站务室门';
  staffLeaf.position.x = -0.56;
  staffLeaf.rotation.y = -Math.PI * 0.47;
  staffLeaf.userData.dynamic = true;
  staffDoor.add(staffLeaf);
  dynamicRoots.push(staffLeaf);
  B(staffLeaf, 0.56, 0.88, 0, 1.11, 1.25, 0.085, '#8c9a86');
  B(staffLeaf, 0.56, 2.35, 0, 1.18, 0.23, 0.085, '#8c9a86');
  B(staffLeaf, 0.56, 1.551, 0, 1.18, 0.11, 0.085, '#74806e');
  const doorGlass = mesh(staffLeaf, new THREE.PlaneGeometry(1.08, 0.65), stationGlass, { ...plain, castShadow: false, receiveShadow: false });
  doorGlass.position.set(0.56, 1.924, 0.04);
  B(staffLeaf, 1.01, 1.27, 0.078, 0.08, 0.035, 0.1, '#c3c3ad', plain);
  label(staffLeaf, '駅務室', 0.56, 1.017, 0.058, 0.59, 0.23, { background: '#d2d7bf', color: '#61735f' });
  let staffOpen = true;
  interactions.push({
    id: 'station-office-door', label: () => `${staffOpen ? '关上' : '打开'}站务室侧门`, position: new THREE.Vector3(11.28, 1.31, -8.625), radius: 1.7,
    action({ walk, toast, refreshShadows }) {
      const player = walk.position;
      if (staffOpen && Math.hypot(player.x - 11.054, player.z + 8.625) < 0.75) { toast('请先离开门扇，再关上站务室门。'); return; }
      staffOpen = !staffOpen;
      staffLeaf.rotation.y = staffOpen ? -Math.PI * 0.47 : 0;
      refreshShadows();
      toast(staffOpen ? '站务室门打开了，桌上还放着沿线工作日志。' : '站务室门已经轻轻合上。');
    },
  });
  // 站務室是可以走进去的房间，家具只占侧部，不挤进原有两条检票通道。
  B(group, 8.8, 0.88, -6.83, 1.85, 0.08, 0.76, '#a88f6b');
  for (const x of [8.08, 9.52]) B(group, x, 0.53, -6.83, 0.07, 0.63, 0.62, '#826e53', plain);
  B(group, 8.76, 0.939, -6.84, 0.43, 0.025, 0.3, '#ded8bc', plain);
  B(group, 8.78, 0.956, -6.84, 0.38, 0.007, 0.25, '#aebcaf', plain);
  C(group, 9.24, 1.0, -6.65, 0.055, 0.13, '#d5d6bf', 10);
  B(group, 7.4, 1.18, -9.35, 0.63, 1.87, 0.54, '#a9b19b');
  for (let i = 0; i < 4; i++) {
    B(group, 7.4, 0.55 + i * 0.41, -9.068, 0.56, 0.35, 0.026, '#bdc2ac', plain);
    B(group, 7.4, 0.58 + i * 0.41, -9.048, 0.15, 0.038, 0.02, '#7e8d7a', plain);
  }
  C(group, 8.65, 0.54, -7.72, 0.24, 0.06, '#a49173', 10);
  for (const dx of [-0.15, 0.15]) for (const dz of [-0.15, 0.15]) B(group, 8.65 + dx, 0.39, -7.72 + dz, 0.045, 0.26, 0.045, '#8c7a5e', plain);
  B(group, 8.65, 0.84, -7.94, 0.45, 0.48, 0.07, '#a89878', plain);
  interactions.push({
    id: 'station-work-log', label: '翻看桜坂线工作日志', position: new THREE.Vector3(8.78, 1.13, -6.84), radius: 1.6,
    action({ inspect }) { inspect('站务室 · 四月工作日志', '16:20，天气晴。站前樱花已满开；清扫站台时留下墙角的花瓣。放学时段增加一班电车。下次检修：平交道口铃声、候车长椅和站前自行车架。'); },
  });
  B(group, 11.27, 0.13, -8.625, 0.6, 0.18, 1.29, '#b6b09c');
  B(group, 12.3, 0.035, -9.05, 2.47, 0.055, 3.32, '#c4bfae', plain);
  B(group, 11.68, 0.54, -6.14, 0.66, 0.91, 1.01, '#d2d5c2');
  B(group, 11.69, 0.08, -6.14, 0.82, 0.06, 1.07, '#969d90', plain);
  const fanRing = mesh(group, new THREE.TorusGeometry(0.275, 0.015, 5, 24), '#9aa99b', plain);
  fanRing.position.set(12.027, 0.53, -6.14);
  fanRing.rotation.y = Math.PI / 2;
  for (let z = -6.47; z < -5.8; z += 0.09) B(group, 12.029, 0.54, z, 0.02, 0.63, 0.015, '#a5b1a0', plain);
  tube(group, [11.4, 0.76, -6.5], [11.19, 0.95, -6.66], 0.028, '#aab4a1');
  B(group, 12.59, 0.91, -10.2, 1.03, 1.71, 0.56, '#929d8b');
  for (const x of [12.35, 12.83]) B(group, x, 0.93, -9.901, 0.47, 1.5, 0.035, '#a9b29e', plain);
  for (const x of [12.51, 12.68]) B(group, x, 0.93, -9.872, 0.022, 0.13, 0.027, '#6f806d', plain);
  B(group, 12.59, 1.794, -10.2, 1.1, 0.065, 0.65, '#7c8d7c', plain);
  label(group, '備品・清掃用具', 12.59, 1.35, -9.874, 0.83, 0.21, { background: '#bdc5ad', color: '#667762' });
  for (let x = 11.32; x <= 13.48; x += 0.3) B(group, x, 0.52, -10.78, 0.055, 1.02, 0.06, '#a9ac90', plain);
  for (const y of [0.31, 0.83]) B(group, 12.4, y, -10.78, 2.29, 0.045, 0.065, '#b8b79b', plain);
  for (let z = -10.65; z <= -7.47; z += 0.31) B(group, 13.52, 0.52, z, 0.06, 1.02, 0.055, '#a9ac90', plain);
  for (const y of [0.31, 0.83]) B(group, 13.52, y, -9.0, 0.065, 0.045, 3.4, '#b8b79b', plain);
  // 四辆日常自行车沿侧墙整齐错开，轮胎、车架和车把有真实空间关系。
  group.userData.bicycleCount = 4;
  const wheelGeometry = new THREE.TorusGeometry(0.32, 0.033, 6, 20);
  const rimGeometry = new THREE.TorusGeometry(0.285, 0.012, 5, 20);
  for (const [index, frameColor] of ['#849e9f', '#b88b83', '#b1ab82', '#749589'].entries()) {
    const z = -6.1 + index * 1.7;
    const bike = new THREE.Group();
    bike.name = `车站自行车${index + 1}`;
    bike.position.set(12.48, 0, z);
    bike.rotation.y = Math.PI / 2;
    group.add(bike);
    for (const x of [-0.62, 0.65]) {
      const tire = mesh(bike, wheelGeometry, '#59615d', plain);
      tire.position.set(x, 0.35, 0);
      const rim = mesh(bike, rimGeometry, '#afb7a9', plain);
      rim.position.set(x, 0.35, 0.015);
      for (let j = 0; j < 8; j++) {
        const angle = j * Math.PI / 4;
        line(bike, [[x, 0.35, 0.017], [x + Math.cos(angle) * 0.277, 0.35 + Math.sin(angle) * 0.277, 0.017]], '#a5b1a5');
      }
      const fender = mesh(bike, new THREE.TorusGeometry(0.368, 0.015, 5, 16, Math.PI), '#b8c1af', plain);
      fender.position.set(x, 0.35, 0.014);
    }
    for (const [a, b] of [
      [[-0.62, 0.35, 0], [-0.18, 0.89, 0]], [[-0.18, 0.89, 0], [0, 0.37, 0]],
      [[0, 0.37, 0], [-0.62, 0.35, 0]], [[-0.18, 0.89, 0], [0.45, 0.86, 0]],
      [[0.45, 0.86, 0], [0, 0.37, 0]], [[0.45, 0.86, 0], [0.65, 0.35, 0]],
    ]) tube(bike, a, b, 0.021, frameColor);
    tube(bike, [-0.18, 0.83, 0], [-0.2, 1.015, 0], 0.019, '#96a799');
    B(bike, -0.2, 1.022, 0, 0.3, 0.045, 0.18, '#796651', plain);
    tube(bike, [0.45, 0.86, 0], [0.41, 1.12, 0], 0.019, '#a4b2a4');
    tube(bike, [0.41, 1.12, -0.2], [0.41, 1.12, 0.2], 0.02, '#a8b4a4');
    for (const side of [-1, 1]) B(bike, 0.41, 1.12, side * 0.19, 0.12, 0.036, 0.066, '#706c5b', plain);
    const gear = mesh(bike, new THREE.CircleGeometry(0.085, 12), '#9aa697', plain);
    gear.position.set(0, 0.37, 0.033);
    line(bike, [[-0.62, 0.35, 0.041], [0, 0.29, 0.041], [0.08, 0.4, 0.041], [-0.62, 0.35, 0.041]], '#647467');
    for (const side of [-1, 1]) B(bike, side * 0.087, 0.36 + side * 0.045, side * 0.11, 0.095, 0.033, 0.075, '#6c786c', plain);
    tube(bike, [-0.1, 0.39, -0.04], [-0.3, 0.025, -0.14], 0.012, '#8b9887');
    B(bike, -0.61, 0.87, 0, 0.43, 0.027, 0.18, '#a1b09f', plain);
    tube(bike, [-0.77, 0.82, 0], [-0.62, 0.38, 0], 0.012, '#8e9e8e');
    if (index === 3) {
      B(bike, 0.68, 0.95, 0, 0.34, 0.024, 0.38, '#b9ad8f', plain);
      for (const x of [0.51, 0.85]) for (const dz of [-0.19, 0.19]) tube(bike, [x, 0.95, dz], [x, 1.2, dz], 0.014, '#b8b495');
      for (const y of [1.05, 1.18]) {
        for (const dz of [-0.19, 0.19]) tube(bike, [0.51, y, dz], [0.85, y, dz], 0.012, '#bec0a3');
        for (const x of [0.51, 0.85]) tube(bike, [x, y, -0.19], [x, y, 0.19], 0.012, '#bec0a3');
      }
    }
    const rackZ = z - 0.65;
    tube(group, [12.09, 0.02, rackZ], [12.09, 0.41, rackZ], 0.023, '#8c9c8e');
    tube(group, [12.09, 0.41, rackZ], [12.83, 0.41, rackZ], 0.023, '#8c9c8e');
    tube(group, [12.83, 0.41, rackZ], [12.83, 0.02, rackZ], 0.023, '#8c9c8e');
  }

  const train = new THREE.Group();
  train.name = '桜坂線・二両編成';
  train.userData.dynamic = true;
  const dockX = 7.5;
  train.position.set(dockX, 0, -16);
  group.add(train);
  function makeCar(center, front) {
    const car = new THREE.Group();
    car.position.x = center;
    train.add(car);
    // 车体色块：乳白车身、薄荷绿腰线、深色裙板。
    B(car, 0, 2.64, 0, 9.8, 2.55, 2.58, '#e8e8d2');
    B(car, 0, 1.64, 0, 9.85, 0.54, 2.63, colors.mint);
    B(car, 0, 1.25, 0, 9.7, 0.26, 2.49, '#677e7c');
    B(car, 0, 3.86, 0, 9.88, 0.18, 2.6, '#c9d3c6');
    B(car, 0, 3.99, 0, 9.55, 0.13, 2.42, '#bbc8bd');
    B(car, 0, 3.24, 0, 9.87, 0.07, 2.63, '#c8d5c7', plain);
    for (const side of [-1, 1]) {
      const z = side * 1.32;
      // 门的位置与乘客窗之间有可信的实体立柱。
      for (const x of [-3.45, 0, 3.45]) {
        B(car, x, 2.56, z, 1.07, 2.26, 0.035, '#b5c6ba');
        B(car, x, 2.54, z + side * 0.024, 0.018, 2.15, 0.016, '#5f7974', plain);
        for (const dx of [-0.27, 0.27]) {
          B(car, x + dx, 2.98, z + side * 0.027, 0.36, 0.84, 0.035, '#688593');
          B(car, x + dx, 2.92, z + side * 0.052, 0.018, 0.66, 0.013, '#abc2c1', plain);
          B(car, x + dx, 2.1, z + side * 0.058, 0.036, 0.13, 0.012, '#84978c', plain);
        }
        B(car, x, 1.51, z + side * 0.035, 1.02, 0.045, 0.14, '#819187', plain);
      }
      for (const x of [-1.74, 1.74]) {
        B(car, x, 2.98, z + side * 0.018, 2.12, 1.01, 0.052, '#5b727d');
        B(car, x, 2.98, z + side * 0.052, 1.97, 0.84, 0.035, colors.glass);
        B(car, x, 2.97, z + side * 0.081, 0.055, 0.86, 0.018, '#ced7c7', plain);
        B(car, x - 0.65, 3.07, z + side * 0.073, 0.28, 0.55, 0.014, '#9bb6bc', { ...plain, rotation: [0, 0, -0.14] });
        B(car, x + 0.36, 2.59, z + side * 0.075, 1.04, 0.035, 0.012, '#d6dcbf', plain);
      }
      for (const x of [-4.51, 4.51]) {
        B(car, x, 2.97, z + side * 0.025, 0.55, 0.93, 0.055, '#687f8c');
        B(car, x - 0.1, 3.01, z + side * 0.055, 0.09, 0.69, 0.016, '#a3bbbc', plain);
      }
      // 两侧腰线不同宽度的细边。
      B(car, 0, 1.94, z + side * 0.044, 9.8, 0.065, 0.012, '#d1deb8', plain);
      B(car, 0, 1.39, z + side * 0.044, 9.73, 0.045, 0.012, '#507873', plain);
      if (side === 1) {
        label(car, '桜坂線', -1.7, 2.06, 1.39, 1.2, 0.23, { background: '#e6e8ce', color: '#52786d' });
        label(car, front ? 'さくら野' : '海辺', 1.7, 3.62, 1.37, 1.03, 0.2, { background: '#506b63', color: '#f1e5ad' });
        label(car, front ? '1302' : '1301', -4.05, 1.67, 1.39, 0.38, 0.13, { background: '#7aaaa0', color: '#e3ead2' });
      }
    }
    // 每节车厢拥有两个转向架，每个车轴对应两只轮。
    for (const x of [-3.08, 3.08]) {
      B(car, x, 0.86, 0, 1.9, 0.45, 1.68, '#4f5d65');
      B(car, x, 0.68, 0, 1.95, 0.15, 1.84, '#667278', plain);
      for (const dx of [-0.57, 0.57]) {
        for (const side of [-1, 1]) {
          const wheel = C(car, x + dx, 0.66, side * 1.06, 0.31, 0.16, '#465462', 16);
          wheel.rotation.x = Math.PI / 2;
          const hub = C(car, x + dx, 0.66, side * 1.15, 0.13, 0.04, '#899293', 12);
          hub.rotation.x = Math.PI / 2;
        }
      }
    }
    B(car, -0.6, 0.97, 0, 2.2, 0.38, 1.47, '#6b7879');
    B(car, 1.01, 1.0, 0, 0.6, 0.37, 1.18, '#7e8581');
    // 屋顶设备有排风鳍片、接线与绝缘子。
    for (const x of [-2.5, 2.5]) {
      B(car, x, 4.16, 0, 1.5, 0.23, 1.42, '#a0b2aa');
      B(car, x, 4.31, 0, 1.26, 0.08, 1.21, '#c3cec0');
      for (let dx = -0.53; dx <= 0.53; dx += 0.14) B(car, x + dx, 4.36, 0, 0.045, 0.022, 0.91, '#7f9691', plain);
    }
    const end = front ? 4.92 : -4.92;
    B(car, end, 2.52, 0, 0.12, 2.35, 2.43, '#bad3c2');
    B(car, end + (front ? 0.072 : -0.072), 2.96, 0, 0.018, 0.94, 2.1, '#66808b');
    B(car, end + (front ? 0.094 : -0.094), 2.95, 0, 0.016, 0.97, 0.09, '#d4ddc8', plain);
    B(car, end, 1.76, 0, 0.17, 0.68, 2.54, '#71a59b');
    B(car, end + (front ? 0.095 : -0.095), 2.17, 0, 0.04, 0.12, 1.42, '#d6dfb4', plain);
    for (const z of [-0.83, 0.83]) {
      const light = mesh(car, new THREE.SphereGeometry(0.115, 12, 8), '#ffedb1', plain);
      light.position.set(end + (front ? 0.12 : -0.12), 2.15, z);
      light.scale.x = 0.25;
      B(car, end + (front ? 0.07 : -0.07), 1.45, z, 0.035, 0.08, 0.16, '#a3736f', plain);
    }
    B(car, end, 1.09, 0, 0.18, 0.21, 2.52, '#6b817b');
    // 车头的雨刷几何，而非反射材质。
    tube(car, [end + (front ? 0.11 : -0.11), 2.67, -0.66], [end + (front ? 0.11 : -0.11), 3.05, -0.92], 0.015, '#445d67');
    tube(car, [end + (front ? 0.11 : -0.11), 2.67, 0.5], [end + (front ? 0.11 : -0.11), 3.05, 0.24], 0.015, '#445d67');
    return car;
  }
  const carA = makeCar(-5.08, false);
  const carB = makeCar(5.08, true);
  B(train, 0, 2.52, 0, 0.34, 2.09, 1.88, '#657376');
  for (let x = -0.16; x <= 0.17; x += 0.065) B(train, x, 2.53, 0, 0.028, 2.15, 1.93, '#7b8882', plain);
  B(train, 0, 0.92, 0, 0.7, 0.17, 0.22, '#536571', plain);
  // 菱形受电弓与架空接触线。
  for (const car of [carA, carB]) {
    for (const z of [-0.42, 0.42]) {
      C(car, 0.5, 4.23, z, 0.09, 0.29, '#b8bbaa');
      tube(car, [-0.55, 4.32, z], [0.6, 4.92, z], 0.035, '#66716d');
      tube(car, [0.6, 4.92, z], [-0.05, 5.32, z], 0.035, '#66716d');
      tube(car, [-0.55, 4.32, z], [-0.95, 4.92, z], 0.035, '#66716d');
      tube(car, [-0.95, 4.92, z], [-0.05, 5.32, z], 0.035, '#66716d');
    }
    B(car, -0.05, 5.33, 0, 0.08, 0.045, 1.26, '#686c6c', plain);
  }
  for (const x of [-47, -10, 26, 58]) {
    for (const z of [-12.8, -23.4]) {
      C(group, x, 3.05, z, 0.075, 6.1, '#82918d');
      B(group, x, 0.23, z, 0.35, 0.42, 0.36, '#a9aba0');
    }
    tube(group, [x, 6.05, -12.8], [x, 6.05, -23.4], 0.045, '#869590');
    for (const z of [-16, -20.5]) {
      tube(group, [x, 6.05, z], [x, 5.35, z], 0.025, '#788983');
      C(group, x, 5.68, z, 0.07, 0.21, '#c0bdb0');
    }
  }
  for (const z of [-16, -20.5]) {
    line(group, [[-65, 5.35, z], [-47, 5.35, z], [-28, 5.16, z], [-10, 5.35, z], [8, 5.17, z], [26, 5.35, z], [42, 5.18, z], [58, 5.35, z], [65, 5.31, z]], '#77858b');
    line(group, [[-65, 6.02, z], [65, 6.02, z]], '#839092');
  }

  // 西侧平交道口，公路从街区跨越两条线路。
  B(group, -23, 0.13, -18.1, 5.8, 0.16, 12.3, '#8b8a81', plain);
  for (const z of [-16, -20.5]) {
    for (const side of [-1, 1]) B(group, -23, 0.205, z + side * 1.2, 5.65, 0.07, 0.7, '#687273', plain);
    B(group, -23, 0.218, z, 5.68, 0.1, 1.28, '#757d76', plain);
    for (let x = -25.7; x < -20.3; x += 0.6) line(group, [[x, 0.274, z - 0.61], [x, 0.274, z + 0.61]], '#909388');
    // 道口橡胶板上的钢轨连续可见。
    for (const side of [-1, 1]) B(group, -23, 0.35, z + side * 0.75, 5.83, 0.04, 0.14, '#aab0ac', plain);
  }
  const crossingArms = [];
  const signalLights = [];
  for (const [x, z, direction] of [[-26.05, -11.5, 1], [-19.96, -24.2, -1]]) {
    const pole = new THREE.Group();
    pole.position.set(x, 0, z);
    group.add(pole);
    C(pole, 0, 1.8, 0, 0.082, 3.6, '#696f68');
    for (let y = 0.42; y < 3.6; y += 0.46) C(pole, 0, y, 0, 0.087, 0.24, '#e8bc53');
    B(pole, 0, 0.64, 0, 0.62, 1.1, 0.57, '#c7b779');
    label(pole, '踏切\nとまれ', 0, 1.74, 0.1, 0.41, 0.44, { background: '#e4c462', color: '#665d4f' });
    for (const rotation of [-Math.PI / 4, Math.PI / 4]) {
      const cross = new THREE.Group();
      cross.position.set(0, 3.07, 0);
      cross.rotation.z = rotation;
      pole.add(cross);
      B(cross, 0, 0, 0, 1.5, 0.19, 0.09, '#e2b754');
      for (const dx of [-0.51, 0, 0.51]) B(cross, dx, 0, 0.054, 0.25, 0.195, 0.015, '#6a6255', plain);
    }
    for (const dx of [-0.36, 0.36]) {
      const hood = mesh(pole, new THREE.CylinderGeometry(0.19, 0.19, 0.25, 12), '#4f5963');
      hood.rotation.x = Math.PI / 2;
      hood.position.set(dx, 2.58, 0.12);
      const light = mesh(pole, new THREE.CircleGeometry(0.145, 16), '#a46d63', plain);
      light.position.set(dx, 2.58, 0.255);
      light.userData.dynamic = true;
      signalLights.push(light);
    }
    const arm = new THREE.Group();
    arm.userData.dynamic = true;
    arm.position.set(0, 1.17, 0.11);
    arm.rotation.z = direction * 1.12;
    pole.add(arm);
    B(arm, direction * 2.67, 0, 0, 5.5, 0.105, 0.095, '#e7bd5a');
    for (let dx = 0.43; dx < 5.5; dx += 0.64) B(arm, direction * dx, 0, 0.057, 0.25, 0.11, 0.022, '#665f53', plain);
    crossingArms.push({ arm, direction });
  }
  for (const z of [-10.4, -25.25]) {
    B(group, -23, 0.017, z, 4.42, 0.03, 0.22, '#e5dfca', plain);
    for (const x of [-25.3, -20.7]) B(group, x, 0.021, z + 0.76, 0.12, 0.03, 1.45, '#e4dcc1', plain);
  }
  // 线路边界上的旧木栅栏。
  for (let x = -62; x <= -29; x += 1.4) {
    B(group, x, 0.7, -12.3, 0.1, 1.4, 0.1, '#a09a83');
    B(group, x, 1.06, -12.3, 1.46, 0.11, 0.085, '#b8ac8e', plain);
    B(group, x, 0.61, -12.3, 1.46, 0.11, 0.085, '#b8ac8e', plain);
  }

  let previousTime;
  let speed = 0;
  let wasMoving = false;
  let arriving = false;
  let dwellUntil = 0;
  const brightSignal = mat('#df765f');
  const dimSignal = mat('#955f58');
  const stationNightLight = new THREE.PointLight('#ffe0ae', 1.0, 8, 2);
  stationNightLight.position.set(5, 2.58, -7.15);
  group.add(stationNightLight);
  function setNight(night) {
    const strength = typeof night === 'number' ? THREE.MathUtils.clamp(night, 0, 1) : night ? 1 : 0;
    stationNightLight.intensity = 1.0 + strength * 2.5;
  }
  function setTime(hoursDecimal) {
    const hours = THREE.MathUtils.euclideanModulo(Number(hoursDecimal) || 0, 24);
    const hour = Math.floor(hours);
    const minute = Math.floor(hours * 60 + 1e-7) % 60;
    const hourAngle = (hours % 12) * Math.PI / 6;
    const minuteAngle = (hours % 1) * Math.PI * 2;
    [hourAngle, minuteAngle].forEach((angle, i) => {
      const { hand, length } = clockHands[i];
      hand.position.set(10.25 + Math.sin(angle) * length / 2, 3.04 + Math.cos(angle) * length / 2, -4.89);
      hand.rotation.z = -angle;
    });
    group.userData.clock = { hour, minute, hourAngle, minuteAngle };
  }
  group.userData.interactions = interactions;
  group.userData.dynamicRoots = dynamicRoots;
  group.userData.enterableBuildings = [
    { id: 'station', name: '桜坂駅', entry: [4.125, 0.07, -3.0], inside: [4.125, 0.3, -9.0], route: [[4.125, 0.07, -3], [4.125, 0.3, -9], [4.125, 0.905, -12.5]] },
    { id: 'station-office', name: '桜坂駅站务室', entry: [11.75, 0.22, -8.625], inside: [9.65, 0.233, -8.625] },
    { id: 'station-ticket-office', name: '桜坂駅售票窗口', entry: [4.125, 0.3, -8.6], inside: [1.7, 0.233, -8.6] },
  ];
  function update(t, { trainMoving = false } = {}) {
    const delta = previousTime === undefined ? 0 : Math.min(Math.max(t - previousTime, 0), 0.08);
    previousTime = t;
    if (!trainMoving && wasMoving) {
      train.position.x = dockX;
      speed = 0;
      arriving = false;
      dwellUntil = 0;
    }
    wasMoving = trainMoving;
    const waiting = t < dwellUntil;
    const target = trainMoving && !waiting ? 5.8 : 0;
    speed += (target - speed) * Math.min(delta * 1.1, 1);
    train.position.x += speed * delta;
    if (train.position.x > 82) {
      train.position.x = -82;
      arriving = true;
    }
    if (arriving && train.position.x >= dockX) {
      train.position.x = dockX;
      speed = 0;
      arriving = false;
      dwellUntil = t + 6;
    }
    const crossingActive = trainMoving && !waiting;
    for (const { arm, direction } of crossingArms) {
      const targetAngle = direction * (crossingActive ? 0.035 : 1.12);
      arm.rotation.z += (targetAngle - arm.rotation.z) * Math.min(delta * 1.8, 1);
    }
    signalLights.forEach((light, i) => {
      const active = crossingActive && (Math.floor(t * 2.4) + i) % 2 === 0;
      light.material = active ? brightSignal : dimSignal;
    });
    return {
      phase: !trainMoving || t < dwellUntil ? '停靠' : arriving ? '进站' : '行驶',
      isDocked: Math.abs(train.position.x - dockX) < 0.15 && speed < 0.3,
      position: train.position.x,
      speed,
    };
  }
  return { group, train, update, setTime, setNight };
}
