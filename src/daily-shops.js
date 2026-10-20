export function createDailyShops(kit) {
  const { THREE, box, cylinder, mesh, sign, roof, mat } = kit;
  const group = new THREE.Group();
  group.name = '青葉文具与こはる食堂';
  const interactions = [];
  const dynamicRoots = [];
  const enterableBuildings = [];
  const paneMaterial = new THREE.MeshBasicMaterial({ color: '#b7cdcc', transparent: true, opacity: 0.19, depthWrite: false, side: THREE.DoubleSide });
  const bottleMaterial = new THREE.MeshBasicMaterial({ color: '#8ea897', transparent: true, opacity: 0.76, depthWrite: false, side: THREE.DoubleSide });
  const fabricMaterials = new Map();
  const plain = { outline: false, castShadow: false };

  function node(parent, x = 0, y = 0, z = 0, rotation = 0) {
    const value = new THREE.Group();
    value.position.set(x, y, z);
    value.rotation.y = rotation;
    parent.add(value);
    return value;
  }

  function rod(parent, start, end, radius, color) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const item = mesh(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), 7), color, plain);
    item.position.copy(a.add(b).multiplyScalar(0.5));
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return item;
  }

  function glass(parent, x, y, z, width, height, rotation = 0) {
    const item = mesh(parent, new THREE.PlaneGeometry(width, height), paneMaterial, plain);
    item.position.set(x, y, z);
    item.rotation.y = rotation;
    return item;
  }

  function frame(parent, x, y, z, width, height, color, rotation = 0) {
    const value = node(parent, x, y, z, rotation);
    for (const side of [-1, 1]) {
      box(value, side * width / 2, 0, 0, 0.058, height + 0.065, 0.09, color, plain);
      box(value, 0, side * height / 2, 0, width + 0.058, 0.058, 0.09, color, plain);
    }
    glass(value, 0, 0, 0.015, width - 0.02, height - 0.02);
    return value;
  }

  function openDoor(parent, door, width, height, color, name) {
    const center = door.position.clone();
    for (const side of [-1, 1]) box(parent, center.x + side * width / 2, center.y, center.z, 0.058, height + 0.065, 0.095, color, plain);
    box(parent, center.x, center.y + height / 2, center.z, width + 0.058, 0.058, 0.095, color, plain);
    door.position.x = center.x - width / 2;
    for (const part of door.children) part.position.x += width / 2;
    door.rotation.y = -THREE.MathUtils.degToRad(85);
    door.name = name;
    door.userData.dynamic = true;
    dynamicRoots.push(door);
    parent.userData.entrance = { localPosition: [center.x, 0.29, center.z], nominalWidth: width };
    let open = true;
    interactions.push({
      id: `${name}-door`, label: () => `${open ? '关上' : '打开'}店门`, radius: 1.5,
      position: () => worldPoint(parent, center.x, 1.3, center.z),
      action({ walk, toast, refreshShadows }) {
        const entrance = worldPoint(parent, center.x, 0.29, center.z);
        const player = walk.position;
        if (open && Math.hypot(player.x - entrance.x, player.z - entrance.z) < 0.68) { toast('站到门扇旁边，再轻轻关门。'); return; }
        open = !open;
        door.rotation.y = open ? -THREE.MathUtils.degToRad(85) : 0;
        refreshShadows();
        toast(open ? '店门开了，请进。' : '店门合上了，门上的小铃轻轻一晃。');
      },
    });
  }

  function worldPoint(parent, x, y, z) {
    parent.updateWorldMatrix(true, false);
    return parent.localToWorld(new THREE.Vector3(x, y, z));
  }

  function cloth(parent, x, y, z, width, height, color) {
    if (!fabricMaterials.has(color)) {
      const material = mat(color).clone();
      material.side = THREE.DoubleSide;
      fabricMaterials.set(color, material);
    }
    const geometry = new THREE.PlaneGeometry(width, height, 6, 3);
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 1) positions.setZ(i, Math.sin(positions.getX(i) / width * Math.PI * 5) * 0.023);
    geometry.computeVertexNormals();
    const item = mesh(parent, geometry, fabricMaterials.get(color), plain);
    item.position.set(x, y, z);
    box(parent, x, y - height / 2 + 0.014, z + 0.025, width - 0.01, 0.012, 0.012, '#b2b4a6', plain);
    return item;
  }

  function shell({ x, z, width, depth, height, wallColor, trimColor, roofColor }) {
    const shop = node(group, x, 0, z, -Math.PI / 2);
    const innerWidth = width - 0.14;
    const front = depth / 2;
    box(shop, 0, 0.12, 0, width, 0.24, depth, '#a9a89b');
    box(shop, 0, 0.28, 0, innerWidth - 0.2, 0.075, depth - 0.2, '#bbad91', plain);
    for (const side of [-1, 1]) {
      box(shop, side * (innerWidth / 2 - 0.09), height / 2 + 0.24, 0, 0.18, height, depth, wallColor);
      box(shop, side * (innerWidth / 2 - 0.085), height / 2 + 0.24, front + 0.01, 0.17, height, 0.17, trimColor);
    }
    // 后窗也由上下墙与两侧墙围成开口，玻璃后能看到真正的货架。
    const rearOpening = { left: -0.65, right: 1.15, bottom: 1.21, top: 2.33 };
    const rearZ = -front + 0.08;
    box(shop, (-innerWidth / 2 + rearOpening.left) / 2, height / 2 + 0.24, rearZ, innerWidth / 2 + rearOpening.left, height, 0.18, wallColor);
    box(shop, (innerWidth / 2 + rearOpening.right) / 2, height / 2 + 0.24, rearZ, innerWidth / 2 - rearOpening.right, height, 0.18, wallColor);
    box(shop, 0, (rearOpening.bottom + 0.24) / 2, rearZ, innerWidth, rearOpening.bottom - 0.24, 0.18, wallColor);
    box(shop, 0, (height + 0.24 + rearOpening.top) / 2, rearZ, innerWidth, height + 0.24 - rearOpening.top, 0.18, wallColor);
    frame(shop, 0.25, 1.77, -front - 0.025, 1.8, 1.12, trimColor, Math.PI);
    box(shop, 0.25, 1.77, -front - 0.078, 0.05, 1.12, 0.045, trimColor, plain);
    box(shop, 0, height + 0.12, 0, width - 0.1, 0.18, depth + 0.09, '#99826b');
    box(shop, 0, height - 0.035, front + 0.015, innerWidth, 0.39, 0.19, wallColor);
    box(shop, 0, height + 0.02, front + 0.1, width - 0.09, 0.115, 0.24, trimColor);
    roof(shop, 0, height + 0.22, 0, width - 0.14, depth + 0.35, 0.72, roofColor);
    for (const side of [-1, 1]) {
      rod(shop, [-width / 2 + 0.05, height + 0.14, side * (front + 0.17)], [width / 2 - 0.05, height + 0.14, side * (front + 0.17)], 0.049, '#707f7a');
      cylinder(shop, side * (innerWidth / 2 - 0.015), height / 2 + 0.1, front + 0.105, 0.043, height, '#84968d', 7);
    }
    box(shop, 0, 0.37, -front - 0.035, innerWidth, 0.18, 0.14, '#b9b3a1', plain);
    return { shop, width, depth, front, height };
  }

  function paintWear(parent, x, y, z, width, height, background) {
    for (const [dx, dy, size] of [[-0.46, 0.39, 0.09], [0.47, -0.41, 0.07], [0.42, 0.42, 0.045], [-0.37, -0.43, 0.065]]) {
      box(parent, x + dx * width, y + dy * height, z, size, size * 0.4, 0.006, background, plain);
      box(parent, x + dx * width + size * 0.28, y + dy * height - 0.01, z + 0.003, size * 0.46, size * 0.32, 0.006, '#a6a58d', plain);
    }
  }

  function deepEave(parent, front, width, height, color) {
    box(parent, 0, height, front + 0.4, width, 0.09, 0.97, color, { ...plain, rotation: [0.07, 0, 0] });
    box(parent, 0, height - 0.04, front + 0.88, width + 0.04, 0.11, 0.075, '#707d70', plain);
    for (const side of [-1, 1]) rod(parent, [side * (width / 2 - 0.05), height - 0.07, front + 0.79], [side * (width / 2 - 0.05), height - 0.42, front + 0.085], 0.021, '#88907c');
  }

  function signBrackets(parent, front, width, eaveY, boardY, boardHeight) {
    for (const side of [-1, 1]) {
      const x = side * width * 0.37;
      const anchorY = boardY - boardHeight * 0.32;
      rod(parent, [x, eaveY + 0.035, front + 0.62], [x, anchorY, front + 0.925], 0.018, '#778675');
      rod(parent, [x, anchorY, front + 0.925], [x, anchorY, front + 0.14], 0.018, '#778675');
    }
  }

  function book(parent, x, y, z, color, height = 0.34) {
    box(parent, x, y, z, 0.18, height, 0.11, color, plain);
    box(parent, x + 0.013, y, z + 0.058, 0.14, height - 0.04, 0.009, '#ded9c3', plain);
    box(parent, x, y + height * 0.28, z + 0.066, 0.095, 0.03, 0.009, color, plain);
  }

  function sodaBottle(parent, x, y, z) {
    const profile = [[0, 0], [0.039, 0.008], [0.042, 0.04], [0.042, 0.145], [0.025, 0.175], [0.021, 0.225], [0.027, 0.235], [0.026, 0.247]].map(([r, h]) => new THREE.Vector2(r, h));
    const bottle = mesh(parent, new THREE.LatheGeometry(profile, 10), bottleMaterial, plain);
    bottle.position.set(x, y, z);
    cylinder(parent, x, y + 0.112, z, 0.043, 0.053, '#dad6bb', 10);
    cylinder(parent, x, y + 0.248, z, 0.028, 0.013, '#aeb7a6', 8);
  }

  function bottleCrate(parent, x, z) {
    const crate = node(parent, x, 0.25, z);
    box(crate, 0, 0.03, 0, 0.66, 0.06, 0.45, '#809681', plain);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        box(crate, 0, 0.06 + i * 0.064, side * 0.215, 0.66, 0.034, 0.033, '#809681', plain);
        box(crate, side * 0.32, 0.06 + i * 0.064, 0, 0.032, 0.034, 0.45, '#809681', plain);
      }
      for (const dx of [-0.32, 0.32]) box(crate, dx, 0.12, side * 0.215, 0.031, 0.24, 0.035, '#759079', plain);
    }
    for (let column = 0; column < 4; column += 1) for (let row = 0; row < 2; row += 1) sodaBottle(crate, -0.235 + column * 0.155, 0.055, -0.115 + row * 0.23);
    sign(crate, 'ラムネ', 0, 0.16, 0.235, 0.37, 0.1, { bg: '#dcd8b9', fg: '#5a7b73' });
  }

  function umbrellaRack(parent, x, z) {
    const rack = node(parent, x, 0.24, z);
    box(rack, 0, 0.08, 0, 0.35, 0.1, 0.34, '#81918a', plain);
    for (const side of [-1, 1]) {
      box(rack, side * 0.16, 0.26, 0, 0.03, 0.42, 0.34, '#83958c', plain);
      box(rack, 0, 0.47, side * 0.155, 0.35, 0.045, 0.03, '#83958c', plain);
    }
    for (let i = 0; i < 3; i += 1) {
      const value = node(rack, -0.085 + i * 0.085, 0.08, (i % 2 ? -0.05 : 0.065));
      value.rotation.z = (i - 1) * 0.055;
      cylinder(value, 0, 0.35, 0, 0.012, 0.7, '#a9ac9d', 6);
      const folded = mesh(value, new THREE.ConeGeometry(0.052, 0.48, 6), ['#79879b', '#aba395', '#889784'][i], plain);
      folded.position.y = 0.35;
      const handle = mesh(value, new THREE.TorusGeometry(0.048, 0.011, 5, 9, Math.PI * 1.2), '#a9ac9d', plain);
      handle.position.set(-0.047, 0.716, 0);
    }
  }

  function postcardRack(parent, x, z) {
    const rack = node(parent, x, 0.24, z);
    cylinder(rack, 0, 0.72, 0, 0.018, 1.44, '#929a90', 6);
    cylinder(rack, 0, 0.06, 0, 0.16, 0.065, '#969c8f', 8);
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const side = node(rack, 0, 0, 0, angle);
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 2; column += 1) {
          const cardX = column ? 0.085 : -0.085;
          const cardY = 0.62 + row * 0.22;
          box(side, cardX, cardY, 0.115, 0.15, 0.188, 0.012, '#e8dfc9', plain);
          box(side, cardX, cardY + 0.028, 0.124, 0.124, 0.076, 0.008, row % 2 ? '#a9bcb5' : '#c5b4b4', plain);
          box(side, cardX - 0.031, cardY + 0.042, 0.131, 0.038, 0.042, 0.006, '#b6c6b2', { ...plain, rotation: [0, 0, 0.3] });
          rod(side, [cardX - 0.078, cardY - 0.076, 0.14], [cardX + 0.078, cardY - 0.076, 0.14], 0.008, '#889389');
        }
      }
    }
    sign(rack, '絵はがき', 0, 1.35, 0.08, 0.36, 0.14, { bg: '#e2d7b7', fg: '#65796e' });
    return rack;
  }

  function oldRegister(parent, x, y, z) {
    const register = node(parent, x, y, z);
    box(register, 0, 0.06, 0, 0.42, 0.12, 0.36, '#a7aaa1', plain);
    box(register, 0, 0.17, -0.012, 0.39, 0.13, 0.31, '#b7b8ab', { ...plain, rotation: [-0.16, 0, 0] });
    box(register, 0.033, 0.32, -0.1, 0.22, 0.115, 0.115, '#8f9c91', plain);
    sign(register, '¥ 120', 0.033, 0.326, -0.035, 0.18, 0.07, { bg: '#546a61', fg: '#d2d4b8' });
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 4; column += 1) box(register, -0.125 + column * 0.077, 0.25 + row * 0.008, 0.107 - row * 0.065, 0.045, 0.018, 0.04, column === 3 ? '#aea183' : '#686e6c', plain);
    box(register, 0, 0.071, 0.187, 0.13, 0.018, 0.012, '#657970', plain);
  }

  function stationery() {
    const { shop, front, height } = shell({ x: 4.6, z: 10, width: 4.8, depth: 4.3, height: 3.23, wallColor: '#d5d1bd', trimColor: '#557c78', roofColor: '#6d7e84' });
    box(shop, 0.49, 0.65, front + 0.03, 3.45, 0.75, 0.15, '#7e9790');
    frame(shop, 0.47, 1.89, front + 0.075, 2.82, 1.74, '#527a77');
    box(shop, 0.47, 1.89, front + 0.092, 0.046, 1.74, 0.075, '#6b9087', plain);
    const door = frame(shop, -1.65, 1.45, front + 0.09, 0.91, 2.39, '#557e7a');
    box(door, 0, -0.74, 0.035, 0.85, 0.55, 0.045, '#81998d', plain);
    box(door, 0.34, -0.06, 0.078, 0.027, 0.24, 0.034, '#c3c2ac', plain);
    openDoor(shop, door, 0.91, 2.39, '#557e7a', '青葉文具・外开85度的门');
    box(shop, -1.65, 0.165, front + 0.51, 1.09, 0.1, 0.75, '#bcb7a2', { ...plain, rotation: [-0.045, 0, 0] });
    box(shop, 0, height + 0.05, front + 0.974, 4.47, 0.43, 0.08, '#718980');
    sign(shop, '青葉文具・雑貨', 0, height + 0.05, front + 1.022, 4.4, 0.37, { bg: '#dcd7bc', fg: '#527c75', border: '#728e82', fontFamily: '"Yu Gothic", "Microsoft YaHei", sans-serif', fontWeight: 600 });
    paintWear(shop, 0, height + 0.05, front + 1.026, 4.4, 0.37, '#8c8c74');
    signBrackets(shop, front, 4.47, 2.965, height + 0.05, 0.43);
    deepEave(shop, front, 4.45, 2.965, '#849b90');
    sign(shop, '青葉文具・雑貨', 0, 2.78, -front - 0.112, 3.5, 0.38, { bg: '#d5cfb0', fg: '#617e73', rotationY: Math.PI });
    rod(shop, [-2.14, 2.8, front + 0.175], [-1.16, 2.8, front + 0.175], 0.015, '#879586');
    for (let i = 0; i < 3; i += 1) cloth(shop, -1.97 + i * 0.32, 2.615, front + 0.205, 0.3, 0.35, i === 1 ? '#b1bbaa' : '#a1b2a0');

    const roller = cylinder(shop, 0.47, 2.95, front + 0.035, 0.112, 2.93, '#98a89b', 12);
    roller.rotation.z = Math.PI / 2;
    for (let i = 0; i < 8; i += 1) box(shop, 0.47, 2.849 - i * 0.066, front + 0.143 + (i % 2) * 0.013, 2.87, 0.059, 0.036, i % 3 === 0 ? '#9aaba0' : '#adb8a9', plain);
    box(shop, 0.47, 2.343, front + 0.172, 2.93, 0.06, 0.065, '#748b81', plain);
    for (const side of [-1, 1]) {
      const coil = mesh(shop, new THREE.TorusGeometry(0.106, 0.009, 5, 15), '#6d8379', plain);
      coil.rotation.y = Math.PI / 2;
      coil.position.set(0.47 + side * 1.47, 2.95, front + 0.035);
    }

    const paperColors = ['#9bb4ba', '#c6b5a2', '#a5b49b', '#c4b2b3', '#dbcca5', '#b7c0b1'];
    for (const shelfY of [0.79, 1.47, 2.05]) box(shop, 0.17, shelfY, -1.4, 3.68, 0.07, 0.45, '#a49679', plain);
    for (const side of [-1, 1]) box(shop, 0.17 + side * 1.81, 1.38, -1.4, 0.066, 1.53, 0.45, '#8a8d79', plain);
    for (let i = 0; i < 9; i += 1) book(shop, -1.18 + i * 0.29, 1.69, -1.37, paperColors[i % paperColors.length], 0.33 + i % 3 * 0.025);
    for (let i = 0; i < 5; i += 1) box(shop, -1.1 + i * 0.58, 2.17, -1.39, 0.42, 0.18, 0.34, paperColors[(i + 2) % paperColors.length], plain);
    box(shop, 0.7, 0.64, front - 0.7, 2.25, 1.02, 0.52, '#a69c80', plain);
    box(shop, 0.7, 1.19, front - 0.7, 2.38, 0.075, 0.61, '#c2baa1', plain);
    for (let i = 0; i < 4; i += 1) book(shop, -0.1 + i * 0.24, 1.4, front - 0.49, paperColors[i], 0.33);
    for (let i = 0; i < 3; i += 1) box(shop, -0.1, 1.24 + i * 0.082, front - 0.85, 0.48, 0.075, 0.35, paperColors[(i + 3) % paperColors.length], plain);
    cylinder(shop, 0.83, 1.31, front - 0.61, 0.077, 0.19, '#789082', 8);
    for (let i = 0; i < 6; i += 1) {
      const pencil = cylinder(shop, 0.79 + i % 3 * 0.035, 1.43, front - 0.63 + Math.floor(i / 3) * 0.034, 0.009, 0.25 + i % 2 * 0.022, ['#c6ab75', '#9eaaa3', '#be9582'][i % 3], 5);
      pencil.rotation.z = (i - 2.5) * 0.045;
    }
    oldRegister(shop, 1.51, 1.225, front - 0.72);
    const display = node(shop, 0.86, 0.26, front + 0.53);
    for (const side of [-1, 1]) box(display, side * 0.37, 0.59, 0, 0.034, 1.17, 0.034, '#839585', plain);
    for (let row = 0; row < 3; row += 1) {
      const y = 0.18 + row * 0.37;
      box(display, 0, y, 0, 0.79, 0.045, 0.35, '#a8ab95', plain);
      for (let i = 0; i < 4; i += 1) {
        const bagX = -0.285 + i * 0.19;
        box(display, bagX, y + 0.12, 0.018, 0.135, 0.21, 0.06, paperColors[(row + i) % 6], { ...plain, rotation: [0, 0, (i % 2 ? -0.035 : 0.04)] });
        box(display, bagX, y + 0.14, 0.052, 0.075, 0.039, 0.009, '#e8dfc5', plain);
      }
    }
    sign(display, 'お菓子', 0, 1.1, 0.055, 0.56, 0.14, { bg: '#ded4b6', fg: '#6c7c68' });
    bottleCrate(shop, -0.35, front + 0.65);
    umbrellaRack(shop, -2.1, front + 1.36);
    const cards = postcardRack(shop, 1.98, front + 0.68);
    cards.userData.dynamic = true;
    dynamicRoots.push(cards);
    const purchasedCard = node(shop, 0.9, 1.247, front - 0.74);
    purchasedCard.name = '选好的樱花明信片';
    purchasedCard.userData.dynamic = true;
    purchasedCard.visible = false;
    box(purchasedCard, 0, 0, 0, 0.31, 0.009, 0.21, '#eee3cb', plain);
    box(purchasedCard, 0, 0.006, -0.02, 0.27, 0.008, 0.13, '#c9b3bd', plain);
    for (const dx of [-0.08, 0.03]) box(purchasedCard, dx, 0.011, -0.03, 0.071, 0.005, 0.048, '#ecdee2', { ...plain, rotation: [0, 0.27, 0] });
    interactions.push({
      id: 'stationery-postcard', label: '挑一张樱花明信片 · ¥120', position: () => worldPoint(shop, 1.98, 1.33, front + 0.68), radius: 1.7,
      action({ inspect, refreshShadows }) {
        cards.rotation.y += Math.PI / 2;
        purchasedCard.visible = true;
        refreshShadows();
        inspect('青葉文具 · 桜坂の絵はがき', '明信片转架轻轻转了一面。你选了一张粉色的樱花站台，120 円，店员已放在柜台上。背面可以写：四月的桜坂，风里都是花瓣。');
      },
    });
    box(shop, 1.5, 0.71, -0.38, 0.74, 0.07, 0.61, '#aa9579', plain);
    for (const dx of [-0.28, 0.28]) box(shop, 1.5 + dx, 0.51, -0.38, 0.052, 0.37, 0.51, '#8b7a63', plain);
    for (let i = 0; i < 3; i++) box(shop, 1.46, 0.762 + i * 0.025, -0.38, 0.43, 0.024, 0.3, ['#c7bea7', '#aebcae', '#c6b5b8'][i], plain);
    sign(shop, '包み紙・便せん', 1.51, 1.21, -front + 0.13, 0.9, 0.23, { bg: '#e5dac0', fg: '#7b816b' });
    enterableBuildings.push({ id: 'stationery', name: '青葉文具・雑貨', entry: worldPoint(shop, -1.65, 0.215, front + 0.84).toArray(), inside: worldPoint(shop, -1.65, 0.318, 0.1).toArray() });
    sign(shop, 'ノート・便せん\n日用品もあります', 1.2, 1.03, -front - 0.106, 1.15, 0.49, { bg: '#d9ceb4', fg: '#617b72', rotationY: Math.PI });
    return shop;
  }

  function dish(parent, x, y, z, variant) {
    cylinder(parent, x, y + 0.016, z, 0.135, 0.032, '#d7d7c5', 12);
    if (variant === 'curry') {
      const rice = mesh(parent, new THREE.SphereGeometry(0.087, 9, 5), '#e5dfc7', plain);
      rice.position.set(x - 0.04, y + 0.055, z);
      rice.scale.set(0.8, 0.56, 1.03);
      const curry = mesh(parent, new THREE.SphereGeometry(0.083, 9, 5), '#ac9065', plain);
      curry.position.set(x + 0.049, y + 0.038, z);
      curry.scale.set(0.77, 0.3, 1.02);
      for (const [dx, dz] of [[0.03, -0.037], [0.063, 0.017]]) box(parent, x + dx, y + 0.061, z + dz, 0.031, 0.024, 0.036, '#ba926a', plain);
    } else {
      cylinder(parent, x, y + 0.042, z, 0.105, 0.065, '#b2c3bd', 12);
      cylinder(parent, x, y + 0.077, z, 0.092, 0.014, '#ba9e70', 12);
      for (let i = 0; i < 3; i += 1) {
        const noodle = mesh(parent, new THREE.TorusGeometry(0.048 - i * 0.01, 0.009, 4, 9), '#ddd4af', plain);
        noodle.rotation.x = Math.PI / 2;
        noodle.position.set(x, y + 0.09, z);
      }
      box(parent, x + 0.035, y + 0.098, z - 0.019, 0.052, 0.025, 0.026, '#82946c', plain);
    }
  }

  function menuCase(parent, x, z) {
    const display = node(parent, x, 0.25, z);
    box(display, 0, 0.08, 0, 1.35, 0.16, 0.55, '#8d7d63');
    box(display, 0, 1.07, 0, 1.36, 0.065, 0.58, '#b3ab91', plain);
    box(display, 0, 0.49, 0, 1.27, 0.045, 0.51, '#d1c5a6', plain);
    for (const side of [-1, 1]) box(display, side * 0.652, 0.615, 0, 0.045, 0.91, 0.54, '#7d897b', plain);
    glass(display, 0, 0.615, 0.28, 1.26, 0.875);
    glass(display, -0.655, 0.615, 0, 0.54, 0.875, Math.PI / 2);
    glass(display, 0.655, 0.615, 0, 0.54, 0.875, Math.PI / 2);
    for (const [x, variant, label] of [[-0.31, 'curry', 'カレー 650円'], [0.31, 'udon', 'うどん 500円']]) {
      dish(display, x, 0.52, 0.035, variant);
      sign(display, label, x, 0.39, 0.247, 0.52, 0.105, { bg: '#eadfc3', fg: '#786850' });
    }
    dish(display, -0.27, 0.2, 0.045, 'udon');
    dish(display, 0.3, 0.2, 0.045, 'curry');
    sign(display, '本日のおすすめ', 0, 1.135, 0.301, 1.26, 0.145, { bg: '#d9cbb0', fg: '#687868' });
  }

  function paperLantern(parent, x, y, z) {
    const lantern = node(parent, x, y, z);
    const profile = [[0.095, -0.3], [0.16, -0.24], [0.19, -0.12], [0.197, 0.06], [0.171, 0.2], [0.102, 0.28]].map(([r, h]) => new THREE.Vector2(r, h));
    mesh(lantern, new THREE.LatheGeometry(profile, 16), '#e5d9ba', plain);
    for (const [radius, h] of [[0.14, -0.26], [0.177, -0.18], [0.194, -0.08], [0.197, 0.035], [0.184, 0.14], [0.137, 0.24]]) {
      const rib = mesh(lantern, new THREE.TorusGeometry(radius, 0.0045, 4, 16), '#c0b49b', plain);
      rib.rotation.x = Math.PI / 2;
      rib.position.y = h;
    }
    for (const h of [-0.305, 0.29]) cylinder(lantern, 0, h, 0, 0.102, 0.028, '#817560', 12);
    rod(lantern, [0, 0.304, 0], [0, 0.62, 0], 0.009, '#8a8771');
    sign(lantern, '御\n食\n事', 0, -0.008, 0.2, 0.095, 0.355, { bg: 'transparent', fg: '#817567' });
  }

  function diner() {
    const { shop, front, height } = shell({ x: 4.5, z: 3.65, width: 4.5, depth: 4.1, height: 3.05, wallColor: '#d6c9ad', trimColor: '#816d56', roofColor: '#7c8075' });
    box(shop, 0.9, 0.7, front + 0.025, 2.35, 0.88, 0.13, '#aa9677');
    frame(shop, 0.9, 1.88, front + 0.084, 2.18, 1.44, '#8c7b61');
    box(shop, 0.9, 1.88, front + 0.108, 0.052, 1.44, 0.04, '#9d8b70', plain);
    const door = frame(shop, -0.95, 1.42, front + 0.075, 1.09, 2.32, '#796b54');
    box(door, 0, -0.89, 0.041, 1.01, 0.5, 0.035, '#a18b6c', plain);
    box(door, 0.41, -0.13, 0.083, 0.028, 0.19, 0.027, '#c3b99d', plain);
    openDoor(shop, door, 1.09, 2.32, '#796b54', 'こはる食堂・外开85度的门');
    box(shop, -0.95, 0.16, front + 0.46, 1.22, 0.09, 0.67, '#b7ac92', { ...plain, rotation: [-0.045, 0, 0] });
    box(shop, 0, height + 0.12, front + 0.974, 4.15, 0.47, 0.09, '#9e8463');
    sign(shop, 'こはる食堂', 0, height + 0.12, front + 1.029, 4.04, 0.39, { bg: '#dfd0ad', fg: '#5d706a', border: '#ad9d7c', fontWeight: 500 });
    signBrackets(shop, front, 4.15, 2.88, height + 0.12, 0.47);
    deepEave(shop, front, 4.17, 2.88, '#918e7b');
    sign(shop, 'こはる食堂', 0, 2.75, -front - 0.108, 3.55, 0.36, { bg: '#dbcbaa', fg: '#6b7661', rotationY: Math.PI });
    rod(shop, [-1.82, 2.74, front + 0.215], [0.28, 2.74, front + 0.215], 0.02, '#908975');
    for (let i = 0; i < 4; i += 1) {
      const curtainX = -1.55 + i * 0.52;
      cloth(shop, curtainX, 2.42, front + 0.249, 0.495, 0.6, i % 2 ? '#566c80' : '#52697e');
      if (i < 3) sign(shop, ['こ', 'は', 'る'][i], curtainX, 2.38, front + 0.281, 0.26, 0.31, { bg: 'transparent', fg: '#dad8c3', fontWeight: 400 });
    }
    box(shop, 0.6, 0.92, front - 0.96, 2.55, 1.2, 0.6, '#9a8b6f', plain);
    box(shop, 0.6, 1.56, front - 0.96, 2.71, 0.09, 0.7, '#c8baa0', plain);
    for (let i = 0; i < 4; i += 1) cylinder(shop, -0.13 + i * 0.23, 1.68, front - 0.98, 0.057, 0.15, '#c3c9b2', 8);
    box(shop, 0.65, 1.89, -1.42, 2.85, 0.09, 0.47, '#9e8e70', plain);
    for (let i = 0; i < 5; i += 1) {
      cylinder(shop, -0.44 + i * 0.4, 2.07, -1.42, 0.105, 0.28, ['#b7bb9c', '#c5b9a1', '#9faeaa'][i % 3], 8);
      cylinder(shop, -0.44 + i * 0.4, 2.219, -1.42, 0.113, 0.018, '#d1cbb4', 8);
    }
    sign(shop, '日替わり定食\nお茶・うどん', 0.1, 2.58, -front + 0.2, 1.28, 0.42, { bg: '#e3d6b6', fg: '#727c65' });
    const bench = node(shop, -1.88, 0.24, front + 0.9, Math.PI / 2);
    box(bench, 0, 0.26, 0, 1.57, 0.085, 0.37, '#a58b6a');
    for (const dx of [-0.61, 0.61]) for (const dz of [-0.12, 0.12]) box(bench, dx, 0.12, dz, 0.067, 0.25, 0.067, '#7f745a', plain);
    box(bench, 0, 0.304, 0.025, 1.55, 0.01, 0.045, '#bda887', plain);
    menuCase(shop, 1.3, front + 0.55);
    paperLantern(shop, -1.92, 2.38, front + 0.49);
    rod(shop, [-1.92, 3.0, front + 0.49], [-1.92, 3.2, front + 0.1], 0.015, '#8f8770');
    sign(shop, '本日も営業中', -1.7, 1.63, front + 0.173, 0.19, 0.55, { bg: '#dad1b3', fg: '#74816c' });
    // 店内后侧的双人小桌与厨房用具，都能从入口左侧真实走近。
    box(shop, 0.42, 0.91, -0.52, 1.18, 0.08, 0.77, '#b99b75');
    for (const dx of [-0.48, 0.48]) for (const dz of [-0.27, 0.27]) box(shop, 0.42 + dx, 0.6, -0.52 + dz, 0.06, 0.55, 0.06, '#816f56', plain);
    for (const x of [-0.5, 1.34]) {
      cylinder(shop, x, 0.58, -0.5, 0.23, 0.08, '#9b8b6e', 10);
      for (const dx of [-0.13, 0.13]) for (const dz of [-0.13, 0.13]) box(shop, x + dx, 0.44, -0.5 + dz, 0.036, 0.21, 0.036, '#85765e', plain);
    }
    const lunch = node(shop, 0.43, 0.962, -0.52);
    lunch.name = '刚端上的咖喱饭';
    lunch.userData.dynamic = true;
    lunch.visible = false;
    dish(lunch, 0, 0, 0, 'curry');
    cylinder(lunch, 0.33, 0.08, 0.11, 0.055, 0.13, '#b8c7b9', 9);
    interactions.push({
      id: 'diner-menu', label: () => lunch.visible ? '看看刚端来的咖喱饭' : '点今日咖喱饭 · ¥650', position: () => worldPoint(shop, -0.15, 1.2, 0.55), radius: 2.0,
      action({ inspect }) {
        lunch.visible = true;
        inspect('こはる食堂 · 今日的菜单', '一盘热咖喱和麦茶已摆在店内的小桌上，650 円。胡萝卜、软软的土豆和温热米饭，是街坊放学后常点的一份。也有 500 円的乌冬面。');
      },
    });
    enterableBuildings.push({ id: 'diner', name: 'こはる食堂', entry: worldPoint(shop, -0.95, 0.205, front + 0.84).toArray(), inside: worldPoint(shop, -1.1, 0.318, 0.35).toArray() });
    return shop;
  }

  const stationer = stationery();
  const eatery = diner();
  group.userData.interactions = interactions;
  group.userData.dynamicRoots = dynamicRoots;
  group.userData.enterableBuildings = enterableBuildings;
  const lights = [stationer, eatery].map(parent => {
    const light = new THREE.PointLight('#ffdfa8', 1.5, 5.0, 2);
    light.position.set(0, 2.33, 0);
    parent.add(light);
    const bulb = mesh(parent, new THREE.SphereGeometry(0.068, 8, 6), new THREE.MeshBasicMaterial({ color: '#ede2c6', toneMapped: false }), plain);
    bulb.position.set(0, 2.63, 0);
    bulb.userData.dynamic = true;
    const shade = mesh(parent, new THREE.ConeGeometry(0.19, 0.16, 12, 1, true), '#c3b696', plain);
    shade.position.set(0, 2.71, 0);
    return { light, bulb };
  });
  function setNight(night) {
    const strength = typeof night === 'number' ? THREE.MathUtils.clamp(night, 0, 1) : night ? 1 : 0;
    lights.forEach(({ light, bulb }) => { light.intensity = 1.5 + strength * 2.0; bulb.material.color.set(strength > 0.4 ? '#ffe3aa' : '#ede2c6'); });
  }
  return { group, setNight };
}
