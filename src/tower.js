// 升降舱实际沿导轨运行，乘客的位置跟随舱底；视角始终由漫步控制器管理。
export function createTower(kit) {
  const { THREE, box, cylinder, mesh, line, sign, roof } = kit;
  const group = new THREE.Group();
  group.name = '桜坂观光塔';
  group.position.set(27, 0, 3);
  const baseHeight = 0.18;
  const deckHeight = 17.82;
  const liftTravel = deckHeight - baseHeight;
  const palette = { steel: '#78968b', dark: '#536e68', wood: '#a38a69', cream: '#efe1c5', metal: '#989d97', roof: '#6e7f88' };
  const plain = { outline: false };
  const glass = new THREE.MeshBasicMaterial({ color: '#b5d5ce', transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const dynamicRoots = [];
  const surface = (parent, x, y, z, w, h, d, color) => {
    const item = box(parent, x, y, z, w, h, d, color, { ...plain, castShadow: false });
    item.userData.walkSurface = true;
    return item;
  };
  function beam(parent, from, to, radius = 0.07, color = palette.steel) {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const part = cylinder(parent, ...start.clone().add(end).multiplyScalar(0.5).toArray(), radius, start.distanceTo(end), color, 8);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return part;
  }
  function glassBox(parent, x, y, z, w, h, d) {
    return box(parent, x, y, z, w, h, d, glass, { ...plain, castShadow: false, receiveShadow: false });
  }
  function worldPosition(x, y, z) { return new THREE.Vector3(x + 27, y, z + 3); }

  // 步道绕过站前樱花树，从既有广场自然接到西面的塔门。
  surface(group, -9.4, 0.045, -2, 5.4, 0.09, 2.2, '#ccc8b7');
  surface(group, -7, 0.045, -1, 2.2, 0.09, 4.2, '#ccc8b7');
  surface(group, -5.1, 0.045, 0, 4.8, 0.09, 2.2, '#ccc8b7');
  for (let x = -11.7; x < -3.1; x += 0.76) {
    line(group, [[x, 0.095, x < -7.9 ? -3.08 : -1.08], [x, 0.095, x < -7.9 ? -0.92 : 1.08]], '#afa99d');
  }
  surface(group, -3.25, 0.102, 0, 1.0, 0.15, 1.75, '#c0baa6');
  surface(group, 0, 0.09, 0, 6.18, 0.18, 6.18, '#b7b3a3');
  for (let z = -2.82; z < 3; z += 0.47) line(group, [[-2.9, 0.186, z], [2.9, 0.186, z]], '#b1a999');

  // 四根落地钢柱与逐层斜撑，首层西侧留出完整入口。
  for (const x of [-2.38, 2.38]) for (const z of [-2.38, 2.38]) {
    box(group, x, 0.26, z, 0.83, 0.52, 0.83, '#b0ad9d');
    box(group, x, 0.53, z, 0.56, 0.035, 0.56, palette.dark, plain);
    box(group, x, 8.91, z, 0.24, 17.82, 0.24, palette.steel);
    box(group, x, 8.91, z + 0.12, 0.065, 17.82, 0.035, '#abc0a7', plain);
    for (const dx of [-0.21, 0.21]) for (const dz of [-0.21, 0.21]) cylinder(group, x + dx, 0.56, z + dz, 0.036, 0.07, '#a0a293', 6);
  }
  for (let y = 3.4; y < deckHeight; y += 3.55) {
    for (const side of [-1, 1]) {
      box(group, side * 2.38, y, 0, 0.18, 0.19, 4.95, palette.dark);
      box(group, 0, y, side * 2.38, 4.95, 0.19, 0.18, palette.dark);
      const top = Math.min(y + 3.55, deckHeight - 0.15);
      beam(group, [side * 2.38, y, -2.38], [side * 2.38, top, 2.38], 0.065);
      beam(group, [side * 2.38, y, 2.38], [side * 2.38, top, -2.38], 0.065);
      beam(group, [-2.38, y, side * 2.38], [2.38, top, side * 2.38], 0.065);
      beam(group, [2.38, y, side * 2.38], [-2.38, top, side * 2.38], 0.065);
    }
  }

  // 一层接待厅是空心建筑，玻璃上窗与木护墙保留日常小站的尺度。
  for (const z of [-3, 3]) {
    box(group, 0, 0.68, z, 6, 1.0, 0.14, palette.wood);
    box(group, 0, 2.79, z, 6, 0.56, 0.14, palette.cream);
    glassBox(group, 0, 1.91, z, 5.73, 1.52, 0.024);
    for (const x of [-2.92, -1.5, 0, 1.5, 2.92]) box(group, x, 1.92, z, 0.075, 1.52, 0.1, palette.dark, plain);
  }
  box(group, 3, 1.61, 0, 0.16, 2.86, 6, palette.cream);
  for (const z of [-1.98, 1.98]) {
    box(group, -3, 0.67, z, 0.16, 0.98, 2.04, palette.wood);
    box(group, -3, 2.78, z, 0.16, 0.58, 2.04, palette.cream);
    glassBox(group, -3, 1.91, z, 0.025, 1.52, 1.87);
    for (const dz of [-0.94, 0.94]) box(group, -3.025, 1.91, z + dz, 0.095, 1.57, 0.065, palette.dark, plain);
  }
  box(group, -3, 2.91, 0, 0.18, 0.34, 1.94, palette.wood);
  box(group, 0, 3.12, 0, 6.55, 0.18, 6.5, palette.roof);
  box(group, -3.14, 2.47, 0, 0.17, 0.54, 2.14, palette.cream);
  const entranceSign = sign(group, '桜坂展望塔', -3.245, 2.48, 0, 2.0, 0.36, { bg: palette.cream, fg: '#4f756a', rotationY: -Math.PI / 2 });
  entranceSign.userData.walkCollision = false;
  sign(group, '桜坂展望塔\n17.8 m  パノラマ', -7.2, 1.3, -2.95, 1.86, 0.84, { bg: '#e9dbc0', fg: '#526e64', rotationY: -Math.PI / 2 });
  box(group, -7.16, 0.64, -3.05, 0.08, 1.18, 0.08, palette.dark, plain);
  // 售票台与票价表靠后布置，门到升降舱之间留出通路。
  box(group, 2.22, 0.71, -1.56, 1.06, 1.06, 1.54, '#ad9372');
  box(group, 2.15, 1.27, -1.56, 1.2, 0.1, 1.64, '#725f50');
  box(group, 2.2, 1.46, -1.48, 0.25, 0.29, 0.3, '#83978b');
  sign(group, '展望リフト\nおとな ¥200\nこども ¥100', 2.875, 1.91, -1.28, 1.31, 1.05, { bg: '#f4e8cc', fg: '#657768', rotationY: -Math.PI / 2 });
  sign(group, 'ご案内\n樱花观景 · 往返升降', -1.77, 1.68, 2.875, 1.8, 0.63, { bg: '#eadbc1', fg: '#687867', rotationY: Math.PI });
  box(group, -2.45, 0.52, 2.1, 0.46, 0.14, 1.25, '#aa916f');
  for (const z of [1.67, 2.53]) box(group, -2.45, 0.31, z, 0.33, 0.44, 0.08, '#7f715d', plain);

  // 三面透明井道保护候乘者，导轨与牵引装置具有真实连续结构。
  glassBox(group, 1.48, 9.54, 0, 0.026, 18.7, 3.05);
  for (const z of [-1.52, 1.52]) glassBox(group, 0, 9.54, z, 2.97, 18.7, 0.026);
  glassBox(group, -1.48, 10.12, 0, 0.026, 14.85, 3.05);
  for (const x of [-1.48, 1.48]) for (const z of [-1.52, 1.52]) box(group, x, 9.69, z, 0.085, 19.4, 0.085, '#8fa398', plain);
  for (const z of [-1.12, 1.12]) {
    box(group, 1.35, 9.64, z, 0.085, 19.25, 0.13, '#879991', plain);
    box(group, 1.42, 9.64, z, 0.04, 19.25, 0.08, '#c3c6ad', plain);
  }
  for (let y = 3.2; y < 19.8; y += 2.4) {
    box(group, 1.51, y, 0, 0.1, 0.08, 3.13, palette.dark, plain);
    for (const z of [-1.52, 1.52]) box(group, 0, y, z, 3.05, 0.065, 0.07, '#899f93', plain);
  }
  box(group, 0.8, 20.25, 0, 1.05, 0.7, 1.48, '#8b968a');
  const pulley = mesh(group, new THREE.TorusGeometry(0.31, 0.065, 6, 16), '#697c75', plain);
  pulley.position.set(0.62, 20.24, 0);
  pulley.rotation.y = Math.PI / 2;

  // 顶层地板围绕井道铺设，西侧候乘区与四周观景步道连成一圈。
  surface(group, -2.6, deckHeight - 0.09, 0, 1.8, 0.18, 7, '#b69b76');
  surface(group, 2.6, deckHeight - 0.09, 0, 1.8, 0.18, 7, '#b69b76');
  for (const z of [-2.6, 2.6]) surface(group, 0, deckHeight - 0.09, z, 3.4, 0.18, 1.8, '#b69b76');
  for (const x of [-1.6, 1.6]) surface(group, x, deckHeight - 0.06, 0, 0.27, 0.12, 3.1, '#aa9475');
  for (const z of [-1.6, 1.6]) surface(group, 0, deckHeight - 0.06, z, 2.96, 0.12, 0.27, '#aa9475');
  // 停靠时，舱底就是井道中央的踏面；隐形索引面保持跨越舱门时的连续脚高。
  const landingIndexMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const landingIndex = surface(group, 0, deckHeight - 0.04, 0, 3.0, 0.08, 3.06, landingIndexMaterial);
  landingIndex.name = '停靠舱底步行索引';
  for (let x = -3.32; x < 3.4; x += 0.25) {
    line(group, [[x, deckHeight + 0.005, -3.45], [x, deckHeight + 0.005, -1.73]], '#9a8265');
    line(group, [[x, deckHeight + 0.005, 1.73], [x, deckHeight + 0.005, 3.45]], '#9a8265');
    if (Math.abs(x) > 1.76) line(group, [[x, deckHeight + 0.005, -1.73], [x, deckHeight + 0.005, 1.73]], '#9a8265');
  }
  for (const side of [-1, 1]) {
    for (const y of [deckHeight + 0.48, deckHeight + 1.12]) {
      box(group, side * 3.35, y, 0, 0.065, 0.075, 6.7, palette.dark, plain);
      box(group, 0, y, side * 3.35, 6.7, 0.075, 0.065, palette.dark, plain);
    }
    for (const along of [-3.35, -2.24, -1.12, 0, 1.12, 2.24, 3.35]) {
      box(group, side * 3.35, deckHeight + 0.57, along, 0.075, 1.14, 0.075, palette.steel, plain);
      box(group, along, deckHeight + 0.57, side * 3.35, 0.075, 1.14, 0.075, palette.steel, plain);
    }
  }
  // 短木凳、定点望远镜和方向牌让平台适合停留观察。
  for (const z of [-2.9, 2.9]) {
    box(group, 0, deckHeight + 0.47, z, 1.8, 0.12, 0.43, '#a89171');
    for (const x of [-0.65, 0.65]) box(group, x, deckHeight + 0.22, z, 0.09, 0.44, 0.33, palette.dark, plain);
    box(group, 0, deckHeight + 0.88, z + Math.sign(z) * 0.18, 1.8, 0.23, 0.08, '#9b8266');
  }
  const telescope = new THREE.Group();
  telescope.position.set(-2.77, deckHeight, -1.7);
  group.add(telescope);
  cylinder(telescope, 0, 0.65, 0, 0.065, 1.3, '#889b91', 10);
  cylinder(telescope, 0, 0.065, 0, 0.25, 0.13, '#788d83', 12);
  const scope = cylinder(telescope, -0.1, 1.32, 0, 0.14, 0.65, '#a1b9a9', 12);
  scope.rotation.z = Math.PI / 2 + 0.15;
  const lens = cylinder(telescope, -0.42, 1.37, 0, 0.13, 0.04, '#516d76', 12);
  lens.rotation.z = Math.PI / 2 + 0.15;
  for (const z of [-0.22, 0.22]) beam(telescope, [-0.15, 1.27, 0], [-0.2, 1.18, z], 0.025, '#73897c');
  sign(group, '桜坂のまち  ←\n樱花、站台与放学的街道', -3.22, deckHeight + 0.87, 1.64, 1.65, 0.38, { bg: '#ebdfc8', fg: '#617c70', rotationY: Math.PI / 2 });
  for (const x of [-3.2, 3.2]) for (const z of [-3.2, 3.2]) box(group, x, deckHeight + 1.71, z, 0.14, 3.42, 0.14, palette.wood);
  box(group, 0, 21.22, 0, 7.3, 0.17, 7.3, '#8c7862');
  roof(group, 0, 21.28, 0, 7.65, 7.65, 0.88, palette.roof);
  for (const z of [-3.8, 3.8]) box(group, 0, 21.23, z, 7.65, 0.075, 0.1, '#81918c', plain);
  sign(group, '桜坂', 0, 20.65, 3.28, 2.01, 0.56, { bg: '#eee3cd', fg: '#63786a' });

  function slidingDoor(parent, x, y, z, width, name) {
    const leaves = [];
    for (const side of [-1, 1]) {
      const leaf = new THREE.Group();
      leaf.name = `${name}${side < 0 ? '左' : '右'}门叶`;
      leaf.position.set(x, y, z + side * width / 4);
      leaf.userData.dynamic = true;
      parent.add(leaf);
      dynamicRoots.push(leaf);
      glassBox(leaf, 0, 1.15, 0, 0.035, 2.3, width / 2 - 0.028);
      for (const dz of [-width / 4 + 0.018, width / 4 - 0.018]) box(leaf, 0, 1.15, dz, 0.055, 2.3, 0.033, palette.dark, plain);
      for (const dy of [0.03, 0.79, 2.27]) box(leaf, 0, dy, 0, 0.055, 0.048, width / 2 - 0.025, palette.dark, plain);
      box(leaf, -0.027, 0.76, 0, 0.024, 0.075, width / 2 - 0.035, '#eee5cb', plain);
      leaves.push({ leaf, side, z: z + side * width / 4 });
    }
    return { set(value) { for (const item of leaves) item.leaf.position.z = item.z + item.side * (width / 2 + 0.08) * value; } };
  }
  function landingDoor(y, label) {
    for (const z of [-0.88, 0.88]) box(group, -1.48, y + 1.22, z, 0.11, 2.44, 0.11, palette.dark, plain);
    box(group, -1.48, y + 2.46, 0, 0.17, 0.18, 1.87, palette.dark);
    sign(group, label, -1.588, y + 2.44, 0, 1.62, 0.15, { bg: '#e9dfc7', fg: '#647c6d', rotationY: -Math.PI / 2 });
    // 门洞之外的短玻璃栏封住井道，只能通过开启的门进入。
    for (const z of [-1.21, 1.21]) glassBox(group, -1.48, y + 1.15, z, 0.025, 2.3, 0.65);
    return slidingDoor(group, -1.51, y, 0, 1.5, label);
  }
  const groundDoor = landingDoor(baseHeight, 'G  接待厅');
  const upperDoor = landingDoor(deckHeight, '1  展望台');

  const cabin = new THREE.Group();
  cabin.name = '真实运行的玻璃观光升降舱';
  cabin.userData.dynamic = true;
  cabin.userData.walkCollision = false;
  group.add(cabin);
  box(cabin, 0, baseHeight - 0.07, 0, 2.63, 0.14, 2.82, '#899b8f').userData.walkSurface = true;
  box(cabin, 0, baseHeight + 0.015, 0, 2.43, 0.027, 2.58, '#c9bc9d', plain).userData.walkSurface = true;
  glassBox(cabin, 1.24, 1.52, 0, 0.025, 2.62, 2.7);
  for (const z of [-1.35, 1.35]) glassBox(cabin, 0, 1.52, z, 2.5, 2.62, 0.025);
  for (const x of [-1.24, 1.24]) for (const z of [-1.35, 1.35]) box(cabin, x, 1.53, z, 0.075, 2.7, 0.075, palette.dark, plain);
  for (const z of [-1.03, 1.03]) glassBox(cabin, -1.24, 1.53, z, 0.025, 2.55, 0.64);
  for (const y of [0.36, 1.01, 2.85]) {
    box(cabin, 1.24, y, 0, 0.05, 0.065, 2.7, palette.dark, plain);
    for (const z of [-1.35, 1.35]) box(cabin, 0, y, z, 2.55, 0.065, 0.065, palette.dark, plain);
  }
  box(cabin, 0, 2.94, 0, 2.65, 0.18, 2.84, palette.cream);
  box(cabin, 0, 2.842, 0, 0.84, 0.025, 0.32, '#f8ecc8', plain);
  sign(cabin, 'ゆっくり上へ\n窗外是四月的桜坂', 1.17, 1.89, 0, 1.44, 0.49, { bg: '#ede3ca', fg: '#647e71', rotationY: -Math.PI / 2 });
  const cabinDoor = slidingDoor(cabin, -1.28, baseHeight, 0, 1.36, '升降舱');
  const cable = box(group, 0.63, 10.23, 0, 0.025, 19.75, 0.025, '#5e756d', plain);
  cable.userData.dynamic = true;
  cable.userData.walkCollision = false;
  groundDoor.set(1);
  upperDoor.set(0);
  cabinDoor.set(1);

  let floor = 'ground';
  let phase = 'idle';
  let progress = 0;
  let doorOpen = 1;
  let sourceFloor = floor;
  let targetFloor = 'upper';
  let passenger = false;
  let passengerStart = new THREE.Vector3();
  let approachStart = new THREE.Vector3();
  let lastContext;
  let shadowTime = 0;
  let rideNumber = 0;
  const smooth = value => value * value * (3 - 2 * value);
  const floorOffset = value => value === 'upper' ? liftTravel : 0;
  function updateDoors() {
    cabinDoor.set(doorOpen);
    groundDoor.set((phase === 'idle' ? floor : phase === 'opening' ? targetFloor : sourceFloor) === 'ground' ? doorOpen : 0);
    upperDoor.set((phase === 'idle' ? floor : phase === 'opening' ? targetFloor : sourceFloor) === 'upper' ? doorOpen : 0);
    group.updateMatrixWorld(true);
  }
  function begin(ctx, from, to, carriesPassenger) {
    if (phase !== 'idle' || !ctx.walk.active) return;
    lastContext = ctx;
    sourceFloor = from;
    targetFloor = to;
    passenger = carriesPassenger;
    progress = 0;
    rideNumber += 1;
    if (passenger) {
      passengerStart.copy(ctx.walk.position);
      approachStart.set(25.28, baseHeight + floorOffset(from), 3);
      ctx.walk.setMotionEnabled(false);
      phase = 'boarding';
      ctx.toast?.(to === 'upper' ? '请入舱，升降舱即将上行。沿途可以自由环顾。' : '请入舱，升降舱即将返回接待厅。');
    } else {
      phase = 'closing';
      ctx.toast?.(to === 'ground' ? '升降舱正在下降，请在门外稍候。' : '升降舱正在上升，请在门外稍候。');
    }
  }
  function callFrom(ctx, at) {
    const to = at === 'ground' ? 'upper' : 'ground';
    if (floor === at) begin(ctx, floor, to, true);
    else begin(ctx, floor, at, false);
  }
  function tick(delta, ctx = lastContext) {
    if (!ctx) return;
    lastContext = ctx;
    const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 0.12));
    shadowTime += dt;
    if (phase !== 'idle' && shadowTime > 0.4) { ctx.refreshShadows?.(); shadowTime = 0; }
    if (phase === 'idle') return;
    if (passenger && !ctx.walk.active) { cancelRide(ctx); return; }
    progress += dt;
    if (phase === 'boarding') {
      const t = Math.min(1, progress / 1.8);
      const place = t < 0.48
        ? passengerStart.clone().lerp(approachStart, smooth(t / 0.48))
        : approachStart.clone().lerp(worldPosition(0, baseHeight + floorOffset(sourceFloor), 0), smooth((t - 0.48) / 0.52));
      ctx.walk.setPosition(place);
      if (t === 1) { progress = 0; phase = 'closing'; }
    } else if (phase === 'closing') {
      doorOpen = 1 - Math.min(1, progress / 0.9);
      updateDoors();
      if (doorOpen === 0) { progress = 0; phase = 'moving'; }
    } else if (phase === 'moving') {
      const t = Math.min(1, progress / 10);
      const eased = 0.5 - Math.cos(t * Math.PI) * 0.5;
      cabin.position.y = THREE.MathUtils.lerp(floorOffset(sourceFloor), floorOffset(targetFloor), eased);
      cable.position.y = (20.11 + cabin.position.y + 3.01) / 2;
      cable.scale.y = Math.max(0.1, 20.11 - cabin.position.y - 3.01);
      if (passenger) ctx.walk.setPosition(worldPosition(0, baseHeight + cabin.position.y, 0));
      group.updateMatrixWorld(true);
      if (t === 1) { progress = 0; phase = 'opening'; }
    } else if (phase === 'opening') {
      doorOpen = Math.min(1, progress / 0.9);
      updateDoors();
      if (doorOpen === 1) {
        floor = targetFloor;
        phase = 'idle';
        ctx.walk.setMotionEnabled(true);
        ctx.refreshShadows?.();
        ctx.toast?.(floor === 'upper' ? '已抵达 17.8 米展望台。走出舱门，沿平台自由漫步。' : '已抵达接待厅。走出舱门，继续探索小镇。');
        passenger = false;
        progress = 0;
      }
    }
  }
  function cancelRide(ctx = lastContext) {
    if (!ctx) return;
    if (phase !== 'idle') {
      floor = cabin.position.y > liftTravel / 2 ? 'upper' : 'ground';
      cabin.position.y = floorOffset(floor);
      if (passenger && ctx.walk.active) ctx.walk.setPosition([24.7, baseHeight + floorOffset(floor), 3]);
      passenger = false;
      phase = 'idle';
      progress = 0;
      sourceFloor = floor;
      targetFloor = floor;
      doorOpen = 1;
      updateDoors();
      ctx.refreshShadows?.();
    }
    ctx.walk.setMotionEnabled(true);
  }
  const groundButtonPosition = worldPosition(-1.69, baseHeight + 1.35, -0.95);
  const upperButtonPosition = worldPosition(-1.69, deckHeight + 1.35, -0.95);
  for (const [y, upper] of [[baseHeight, false], [deckHeight, true]]) {
    box(group, -1.62, y + 1.3, -0.95, 0.1, 0.38, 0.21, '#97a697', plain);
    const button = cylinder(group, -1.687, y + 1.32, -0.95, 0.06, 0.04, '#e0bf77', 12);
    button.rotation.z = Math.PI / 2;
    sign(group, upper ? '下へ ↓' : '展望台 ↑', -1.69, y + 1.62, -0.95, 0.48, 0.18, { bg: '#ecdec3', fg: '#637e6d', rotationY: -Math.PI / 2 });
  }
  group.userData.dynamicRoots = dynamicRoots;
  group.userData.enterableBuildings = [{ id: 'tower', name: '桜坂观光塔', entry: [23.45, baseHeight, 3], inside: [24.9, baseHeight, 3], upper: [24.7, deckHeight, 3] }];
  group.userData.lift = { ground: [27, baseHeight, 3], upper: [27, deckHeight, 3], travel: liftTravel, duration: 10, platform: { center: [27, deckHeight, 3], width: 7, depth: 7 }, approach: [[15.2, 0.09, 1], [20, 0.09, 1], [20, 0.09, 3], [23.4, baseHeight, 3]] };
  group.userData.interactions = [
    { id: 'tower-up', label: () => floor === 'ground' ? '乘坐观光升降舱 · 上行' : '呼叫升降舱 · 下降', position: groundButtonPosition, radius: 2.2, enabled: ctx => phase === 'idle' && ctx.walk.position.y < 3, action: ctx => callFrom(ctx, 'ground') },
    { id: 'tower-down', label: () => floor === 'upper' ? '乘坐观光升降舱 · 下行' : '呼叫升降舱 · 上升', position: upperButtonPosition, radius: 2.2, enabled: ctx => phase === 'idle' && ctx.walk.position.y > 16, action: ctx => callFrom(ctx, 'upper') },
    { id: 'tower-telescope', label: '眺望桜坂小镇', position: worldPosition(-2.77, deckHeight + 1.28, -1.7), radius: 1.5, enabled: ctx => phase === 'idle' && ctx.walk.position.y > 16, action: ctx => ctx.inspect?.('桜坂的四月', '从 17.8 米的展望台望下去，灰蓝色瓦屋顶、樱花树与站台连成一幅安静的春日地图。西边是放学的生活街，北边是驶向海边的电车。沿着栏杆漫步，每个方向都有不同的景色。') },
    { id: 'tower-tickets', label: '查看展望塔票价', position: worldPosition(2.15, 1.5, -0.65), radius: 1.6, enabled: ctx => ctx.walk.position.y < 3, action: ctx => ctx.inspect?.('桜坂展望塔', '建于昭和时期的小镇观光塔。展望台高 17.8 米，玻璃升降舱约 10 秒抵达。成人 200 日元、儿童 100 日元，往返均可乘坐。请在升降舱完全停稳、舱门开启后进出。') },
  ];
  group.updateMatrixWorld(true);
  return {
    group, cabin, update: tick, cancelRide,
    get snapshot() {
      const statuses = { idle: floor === 'upper' ? '展望台 · 舱门开启' : '接待厅 · 舱门开启', boarding: '请入舱', closing: '舱门关闭中', moving: targetFloor === 'upper' ? '正在上行' : '正在下行', opening: '已到站 · 舱门开启中' };
      return { riding: passenger && phase !== 'idle', busy: phase !== 'idle', floor, phase, height: Number((baseHeight + cabin.position.y).toFixed(2)), status: statuses[phase], targetFloor, rideNumber };
    },
  };
}
