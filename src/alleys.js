import { createHomeDoor } from './home-interiors.js';

export function createAlleys(kit) {
  const { THREE, box, cylinder, mesh, line, sign, rng } = kit;
  const group = new THREE.Group();
  group.name = '通往小后院的三条生活巷道';
  group.userData.dynamicRoots = [];
  group.userData.interactions = [];
  group.userData.enterableBuildings = [];
  let storageCount = 0;
  group.userData.alleyWidths = [1.6, 1.5, 1.6];
  group.userData.laneBounds = [
    { start: -0.2, end: 13, z: 6.75, width: 1.6 },
    { start: -8, end: -21, z: 13.175, width: 1.5 },
    { start: -8, end: -21, z: 0, width: 1.6 },
  ];
  const options = { outline: false };
  const rodGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);
  const leafGeometry = new THREE.SphereGeometry(1, 6, 4);
  const wallColor = '#9eaaa8';
  const metal = '#738582';
  const blueShadow = new THREE.MeshBasicMaterial({ color: '#506d89', transparent: true, opacity: 0.17, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const random = (min, max) => min + rng() * (max - min);

  function rod(parent, a, b, radius, color) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const part = mesh(parent, rodGeometry, color, options);
    part.position.copy(start.add(end).multiplyScalar(0.5));
    part.scale.set(radius, direction.length(), radius);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return part;
  }

  function shade(start, end, z, width) {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(end - start), width), blueShadow);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set((start + end) / 2, 0.083, z);
    patch.name = '巷内偏蓝的深阴影';
    group.add(patch);
  }

  function pave(start, end, z, width) {
    const length = Math.abs(end - start);
    const count = Math.ceil(length / 1.05);
    const slab = length / count;
    const min = Math.min(start, end);
    const colors = ['#afb8ad', '#a9b3aa', '#b4bbb0', '#a8b0a6'];
    box(group, (start + end) / 2, 0.034, z, length, 0.068, width, '#9eaaa4', { outline: false, castShadow: false });
    for (let i = 0; i < count; i += 1) {
      const x = min + (i + 0.5) * slab;
      box(group, x, 0.063, z + 0.04, slab - 0.02, 0.026, width - 0.15, colors[i % colors.length], { outline: false, castShadow: false });
      if (i % 4 === 1) {
        box(group, x + slab * 0.19, 0.079, z - width * 0.13, slab * 0.27, 0.009, width * 0.29, '#a0aba5', { outline: false, castShadow: false });
        line(group, [[x - slab * 0.35, 0.084, z + width * 0.26], [x - slab * 0.12, 0.084, z + width * 0.1], [x + slab * 0.01, 0.084, z + width * 0.19]], '#879693');
      }
    }
    const gutterZ = z - width / 2 + 0.054;
    box(group, (start + end) / 2, 0.062, gutterZ, length, 0.031, 0.074, '#738982', { outline: false, castShadow: false });
    for (let i = 0; i < Math.ceil(length / 2.2); i += 1) {
      const x = min + 0.6 + i * 2.2;
      if (x > min + length - 0.25) continue;
      box(group, x, 0.082, gutterZ, 0.4, 0.023, 0.088, '#a6b0a7', { outline: false, castShadow: false });
      for (let slot = 0; slot < 4; slot += 1) box(group, x - 0.13 + slot * 0.087, 0.096, gutterZ, 0.026, 0.008, 0.054, '#627771', { outline: false, castShadow: false });
    }
  }

  function boundary(start, end, z, height = 1.45) {
    const length = Math.abs(end - start);
    const center = (start + end) / 2;
    box(group, center, height / 2 + 0.07, z, length, height, 0.15, wallColor);
    box(group, center, height + 0.09, z, length + 0.04, 0.1, 0.22, '#b3bdb0', options);
    for (let i = 0; i < Math.floor(length / 1.3); i += 1) {
      const x = Math.min(start, end) + 0.7 + i * 1.3;
      box(group, x, 0.34, z + 0.078, 0.54, 0.15, 0.01, '#929f9c', options);
    }
    for (const y of [0.47, 0.88]) line(group, [[start, y, z + 0.079], [end, y, z + 0.079]], '#82928e');
  }

  function storage(x, z, width, depth, height, frontDirection = 1, label = '物置') {
    const shed = new THREE.Group();
    shed.position.set(x, 0.045, z);
    shed.rotation.y = frontDirection < 0 ? Math.PI : 0;
    frontDirection = 1;
    const id = `alley-storage-${++storageCount}`;
    const name = `${label}附属间`;
    shed.name = name;
    group.add(shed);
    box(shed, 0, 0.1, 0, width + 0.09, 0.2, depth + 0.08, '#a5ada0');
    const doorX = width * 0.16;
    const doorWidth = 1.06;
    for (const side of [-1, 1]) box(shed, side * (width / 2 - 0.065), height / 2 + 0.14, 0, 0.13, height, depth, '#c0c4b5');
    box(shed, 0, height / 2 + 0.14, -depth / 2 + 0.065, width, height, 0.13, '#c0c4b5');
    for (const [a, b] of [[-width / 2, doorX - doorWidth / 2 - 0.025], [doorX + doorWidth / 2 + 0.025, width / 2]]) {
      box(shed, (a + b) / 2, height / 2 + 0.14, depth / 2 - 0.065, b - a, height, 0.13, '#c0c4b5');
      box(shed, (a + b) / 2, 0.37, depth / 2 + 0.015, b - a, 0.4, 0.04, '#a7b09e', options);
    }
    const roof = box(shed, 0, height + 0.24, 0, width + 0.28, 0.095, depth + 0.24, '#7b8e87', options);
    roof.rotation.x = frontDirection * 0.07;
    roof.userData.roof = true;
    for (let i = 0; i < Math.ceil(width / 0.22); i += 1) {
      const seam = box(shed, -width / 2 + 0.1 + i * 0.22, height + 0.297, 0, 0.025, 0.028, depth + 0.26, '#93a09b', options);
      seam.rotation.x = frontDirection * 0.07;
    }
    const door = createHomeDoor(kit, group, shed, { id, name, x: doorX, front: depth / 2, floor: 0.2, width: doorWidth, height: 1.97, color: '#71847b', openAngle: Math.PI * 0.48 });
    // 浅附属间的门向外打开，避免门叶占掉仅一米多深的室内。
    sign(shed, label, doorX - 0.77, 1.42, depth / 2 + 0.052, 0.28, 0.16, { fg: '#5d7168', bg: '#dddcca' });
    box(shed, doorX, 0.24, depth / 2 + 0.19, 1.21, 0.08, 0.47, '#adb2a4', options);
    if (height > 2.17) box(shed, doorX, (2.17 + height + 0.14) / 2, depth / 2 - 0.065, doorWidth + 0.05, height + 0.14 - 2.17, 0.13, '#c0c4b5');
    const frame = new THREE.Group();
    frame.position.set(-width * 0.26, 1.7, frontDirection * (depth / 2 + 0.038));
    frame.rotation.y = frontDirection < 0 ? Math.PI : 0;
    shed.add(frame);
    box(frame, 0, 0, 0, 0.68, 0.7, 0.06, '#80908a', options);
    box(frame, 0, 0, 0.039, 0.57, 0.58, 0.025, '#a6b7ad', options);
    box(frame, 0, 0, 0.056, 0.025, 0.58, 0.023, '#c9c7b2', options);
    box(frame, 0, -0.1, 0.056, 0.57, 0.025, 0.023, '#c9c7b2', options);
    const cornerX = -width / 2 + 0.11;
    cylinder(shed, cornerX, (height + 0.14) / 2, frontDirection * (depth / 2 + 0.1), 0.029, height + 0.14, '#899a92', 6);
    // 整齐靠墙的木架、工具和周转箱不会堵塞门后观察空间。
    const shelfX = -width / 2 + 0.7;
    for (const yy of [0.51, 1.15, 1.78]) box(shed, shelfX, yy, -depth / 2 + 0.25, 1.04, 0.045, 0.34, '#9b896c');
    for (const xx of [shelfX - 0.47, shelfX + 0.47]) box(shed, xx, 1.03, -depth / 2 + 0.25, 0.04, 1.79, 0.34, '#92866d', options);
    for (let i = 0; i < 4; i++) box(shed, shelfX - 0.34 + i * 0.22, 0.65, -depth / 2 + 0.25, 0.17, 0.2, 0.23, ['#a4b59d', '#c7b591', '#a3b4bb'][i % 3], options);
    box(shed, shelfX + 0.15, 1.32, -depth / 2 + 0.25, 0.41, 0.27, 0.26, '#baaa8a', options);
    sign(shed, '春の道具\n使ったら元の場所へ', width / 2 - 0.08, 1.44, 0, Math.min(0.8, depth - 0.25), 0.44, { bg: '#eee4ca', fg: '#70816a', rotationY: -Math.PI / 2 });
    shed.updateWorldMatrix(true, true);
    const entry = shed.localToWorld(new THREE.Vector3(doorX, 0.025, depth / 2 + 0.7)).toArray();
    const inside = shed.localToWorld(new THREE.Vector3(doorX, 0.2, 0)).toArray();
    group.userData.enterableBuildings.push({ id, name, entry, inside, route: [entry, inside] });
    return shed;
  }

  function stack(x, z, orientation = 0) {
    const crates = new THREE.Group();
    crates.position.set(x, 0.09, z);
    crates.rotation.y = orientation;
    group.add(crates);
    for (let row = 0; row < 2; row += 1) {
      box(crates, row * 0.035, 0.14 + row * 0.27, 0, 0.46, 0.255, 0.31, row ? '#a5aa8d' : '#9e9b7b', options);
      for (let i = 0; i < 3; i += 1) box(crates, -0.13 + i * 0.13, 0.15 + row * 0.27, 0.161, 0.068, 0.055, 0.012, '#758273', options);
      box(crates, 0, 0.18 + row * 0.27, -0.158, 0.29, 0.038, 0.01, '#7f8877', options);
    }
  }

  function cabinet(x, z, direction = 1) {
    box(group, x, 0.51, z, 0.59, 0.88, 0.28, '#b1b9a9', options);
    box(group, x, 0.52, z + direction * 0.15, 0.51, 0.76, 0.015, '#99a894', options);
    box(group, x + 0.18, 0.57, z + direction * 0.168, 0.03, 0.11, 0.025, '#d1d2bd', options);
    box(group, x, 0.98, z, 0.63, 0.05, 0.32, '#81938a', options);
  }

  function vine(x, z, facing = 1) {
    const stemPoints = [[x, 0.12, z], [x + 0.12, 0.59, z], [x + 0.04, 1.02, z], [x + 0.29, 1.43, z], [x + 0.21, 1.8, z]];
    for (let i = 0; i < stemPoints.length - 1; i += 1) rod(group, stemPoints[i], stemPoints[i + 1], 0.012, '#758b6e');
    for (let i = 0; i < 14; i += 1) {
      const y = 0.3 + i * 0.1;
      const leaf = mesh(group, leafGeometry, i % 3 ? '#8ca476' : '#739477', options);
      leaf.position.set(x + (i % 2 ? 0.16 : -0.035) + Math.sin(y * 2) * 0.09, y, z + facing * 0.017);
      leaf.scale.set(0.079, 0.105, 0.024);
      leaf.rotation.z = i % 2 ? -0.55 : 0.55;
    }
  }

  function lowTree(x, z) {
    cylinder(group, x, 0.9, z, 0.065, 1.8, '#817866', 7);
    for (let i = 0; i < 5; i += 1) {
      const angle = i / 5 * Math.PI * 2;
      const px = x + Math.cos(angle) * 0.57;
      const pz = z + Math.sin(angle) * 0.48;
      const y = 2.03 + (i % 3) * 0.14;
      rod(group, [x, 1.15, z], [px, y, pz], 0.027, '#7c7463');
      const leaves = mesh(group, new THREE.IcosahedronGeometry(0.67, 1), ['#8fa589', '#9eb595', '#779b85'][i % 3], options);
      leaves.position.set(px, y + 0.16, pz);
      leaves.scale.set(1.15, 0.8, 0.9);
    }
  }

  function backyard(x, z, direction, halfWidth = 1.75) {
    box(group, x + direction * 1.03, 0.052, z, 2.6, 0.08, halfWidth * 2 - 0.3, '#b8b8a1', { outline: false, castShadow: false });
    boundary(x - 0.3, x + direction * 2.45, z - halfWidth, 0.73);
    boundary(x - 0.3, x + direction * 2.45, z + halfWidth, 0.82);
    box(group, x + direction * 2.48, 0.51, z, 0.13, 0.94, halfWidth * 2 + 0.1, '#adb6a7');
    lowTree(x + direction * 1.65, z + 0.75);
    const clothesStart = Math.min(1.3, halfWidth - 0.23);
    const clothesEnd = Math.min(1.2, halfWidth - 0.23);
    for (const offset of [-clothesStart, clothesEnd]) cylinder(group, x + direction * 0.73, 1.03, z + offset, 0.026, 1.96, metal, 6);
    line(group, [[x + direction * 0.73, 1.99, z - clothesStart], [x + direction * 0.73, 1.91, z], [x + direction * 0.73, 1.99, z + clothesEnd]], '#87918a');
    for (let i = 0; i < 3; i += 1) {
      box(group, x + direction * 0.75, 1.58, z - 0.77 + i * 0.66, 0.025, i === 1 ? 0.61 : 0.47, 0.45, ['#d1dbd1', '#e0d4bd', '#b2c5c2'][i], options);
      box(group, x + direction * 0.75, 1.91, z - 0.94 + i * 0.66, 0.048, 0.065, 0.029, '#a9a38d', options);
    }
    for (const dz of [-0.83, -0.24]) {
      cylinder(group, x + direction * 1.86, 0.17, z + dz, 0.19, 0.27, '#b39076', 8);
      const leaves = mesh(group, leafGeometry, '#8da879', options);
      leaves.position.set(x + direction * 1.86, 0.43, z + dz);
      leaves.scale.set(0.25, 0.29, 0.24);
    }
  }

  // 右巷先穿过两店之间，再沿储物间和院墙一直通向树下后院。
  pave(-0.2, 13, 6.75, 1.6);
  shade(2.45, 12.7, 6.75, 1.47);
  storage(9.12, 5.27, 4.75, 1.26, 2.21, 1, '裏口');
  boundary(6.74, 13.12, 7.66, 1.62);
  boundary(11.53, 13.14, 5.84, 1.29);
  cabinet(5.93, 7.39, -1);
  stack(7.02, 6.16, 0.02);
  vine(9.12, 7.558, -1);
  vine(12.1, 7.558, -1);
  rod(group, [6.85, 2.27, 5.96], [6.85, 0.3, 5.96], 0.032, '#8fa299');
  box(group, 6.89, 1.8, 5.99, 0.23, 0.33, 0.105, '#b3bdaa', options);
  backyard(13.15, 6.75, 1);

  // 左侧新增低附属楼，恰好在咖啡店南侧留出一条一米半的巷道。
  storage(-12.2, 11, 4.2, 2.8, 3, 1, '小森');
  pave(-8, -21, 13.175, 1.5);
  shade(-10.03, -20.78, 13.175, 1.37);
  boundary(-14.4, -21.16, 12.325, 1.43);
  boundary(-15, -21.18, 14.02, 1.63);
  cabinet(-14.86, 13.756, -1);
  stack(-16.7, 12.67, Math.PI);
  vine(-17.4, 13.924, -1);
  rod(group, [-14.07, 2.75, 12.49], [-14.07, 0.31, 12.49], 0.026, '#859991');
  box(group, -14.05, 1.53, 12.51, 0.2, 0.29, 0.07, '#b3bead', options);
  backyard(-21.18, 13.175, -1);

  // 第三巷的附属间全部放在正 z 一侧，负侧院墙不越过支路的 -1.5 米边界。
  pave(-8, -21, 0, 1.6);
  shade(-8.7, -20.7, 0, 1.46);
  storage(-12.4, 1.51, 4.35, 1.10, 2.08, -1, '道具');
  boundary(-8.58, -21.17, -0.94, 1.54);
  boundary(-14.64, -21.18, 0.93, 1.61);
  boundary(-8.58, -10.17, 0.93, 1.26);
  cabinet(-16.64, 0.59, -1);
  stack(-18.35, -0.59, -0.07);
  vine(-15.43, -0.846, 1);
  vine(-19.72, 0.838, -1);
  rod(group, [-14.46, 1.99, 0.87], [-14.46, 0.26, 0.87], 0.027, '#869990');
  backyard(-21.18, 0, -1, 1.27);

  // 坐在暖光里的普通小猫：头、耳、肩、后腿和弯曲尾巴都具有三维体积。
  const cat = new THREE.Group();
  cat.name = '巷口晒太阳的小猫';
  cat.position.set(1.2, 0.096, 6.75);
  cat.scale.setScalar(0.68);
  cat.rotation.y = -Math.PI / 2 - 0.25;
  cat.userData.dynamic = true;
  group.add(cat);
  const catGeometry = new THREE.SphereGeometry(1, 8, 6);
  function catPart(x, y, z, sx, sy, sz, color) {
    const part = mesh(cat, catGeometry, color, options);
    part.position.set(x, y, z);
    part.scale.set(sx, sy, sz);
    return part;
  }
  catPart(0, 0.26, -0.01, 0.165, 0.255, 0.15, '#c9ab7f');
  catPart(0, 0.535, 0.033, 0.173, 0.163, 0.146, '#d8bc8d');
  catPart(0, 0.472, 0.145, 0.102, 0.065, 0.04, '#ead6ae');
  catPart(-0.13, 0.135, -0.045, 0.098, 0.134, 0.104, '#c5a478');
  catPart(0.13, 0.135, -0.045, 0.098, 0.134, 0.104, '#c5a478');
  for (const x of [-0.071, 0.071]) {
    catPart(x, 0.064, 0.129, 0.062, 0.056, 0.1, '#ead3a5');
    catPart(x, 0.551, 0.16, 0.013, 0.022, 0.009, '#566154');
    const ear = mesh(cat, new THREE.ConeGeometry(0.078, 0.167, 3), '#d4b487', options);
    ear.position.set(x * 1.44, 0.714, 0.025);
    ear.rotation.z = x > 0 ? -0.17 : 0.17;
    const inner = mesh(cat, new THREE.ConeGeometry(0.048, 0.115, 3), '#c9968d', options);
    inner.position.set(x * 1.44, 0.71, 0.046);
    inner.rotation.z = ear.rotation.z;
  }
  catPart(0, 0.513, 0.187, 0.018, 0.012, 0.008, '#9f817b');
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.125, 0.16, -0.11), new THREE.Vector3(0.263, 0.092, -0.16),
    new THREE.Vector3(0.258, 0.045, -0.3), new THREE.Vector3(0.07, 0.045, -0.32),
  ]);
  mesh(cat, new THREE.TubeGeometry(tailCurve, 12, 0.032, 5, false), '#c4a37c', options);
  const whiskerPositions = [];
  for (const side of [-1, 1]) for (const offset of [-0.012, 0.013]) whiskerPositions.push(side * 0.061, 0.49 + offset, 0.18, side * 0.146, 0.5 + offset, 0.167);
  const whiskerGeometry = new THREE.BufferGeometry();
  whiskerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(whiskerPositions, 3));
  cat.add(new THREE.LineSegments(whiskerGeometry, new THREE.LineBasicMaterial({ color: '#907c68', transparent: true, opacity: 0.65 })));
  let greeted = false;
  group.userData.interactions.push({
    id: 'alley-cat', label: '轻轻摸摸晒太阳的小猫', position: () => cat.getWorldPosition(new THREE.Vector3()), radius: 1.5,
    action(ctx) {
      greeted = !greeted;
      cat.rotation.y = -Math.PI / 2 - 0.25 + (greeted ? 0.18 : 0);
      cat.scale.setScalar(greeted ? 0.71 : 0.68);
      ctx.toast(greeted ? '小猫抬起头，轻轻蹭了蹭你的手。' : '小猫眯起眼，又躺回了暖和的光斑。');
      ctx.refreshShadows?.();
    },
  });

  // 墙脚零星苔痕与被风留住的樱花瓣仅占边缘，不堵住中间通行线。
  for (const lane of group.userData.laneBounds) {
    const min = Math.min(lane.start, lane.end);
    const length = Math.abs(lane.end - lane.start);
    for (let i = 0; i < 9; i += 1) {
      const x = min + random(0.8, length - 0.4);
      const z = lane.z + (i % 2 ? 1 : -1) * (lane.width / 2 - 0.06);
      box(group, x, 0.088, z, random(0.09, 0.24), 0.008, random(0.027, 0.055), '#8f9f84', { outline: false, castShadow: false });
      for (let petal = 0; petal < 3; petal += 1) {
        const fallen = mesh(group, new THREE.CircleGeometry(random(0.02, 0.035), 5), petal % 2 ? '#e3bac7' : '#f3d4d1', { outline: false, castShadow: false, receiveShadow: false });
        fallen.rotation.x = -Math.PI / 2;
        fallen.position.set(x + random(-0.13, 0.13), 0.093, z + random(-0.035, 0.035));
        fallen.scale.y = 0.6;
      }
    }
  }

  return group;
}
