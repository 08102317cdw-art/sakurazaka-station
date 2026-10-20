import { decorateResidence } from './residential-details.js';
import { buildHomeInterior, createHomeDoor } from './home-interiors.js';

export function createTown(kit) {
  const { THREE, box, cylinder, mesh, sign } = kit;
  const town = new THREE.Group();
  town.name = '桜坂的生活街区';
  town.userData.dynamicRoots = [];
  town.userData.interactions = [];
  town.userData.enterableBuildings = [];
  town.userData.nightLights = [];
  town.userData.setNight = night => { for (const light of town.userData.nightLights) light.visible = Boolean(night); };
  let residenceCount = 0;
  const animatedClothes = [];
  const palette = {
    cream: '#e4d6b6', pale: '#eee3cd', wall: '#cfc7b4', blue: '#728091',
    tile: '#646f83', wood: '#87664e', dark: '#4e4850', glass: '#718997',
    trim: '#b29a79', green: '#647b62', red: '#b86560', cement: '#aaa89a',
  };

  function group(parent, x = 0, y = 0, z = 0, rotation = 0) {
    const value = new THREE.Group();
    value.position.set(x, y, z);
    value.rotation.y = rotation;
    parent.add(value);
    return value;
  }

  function rod(parent, a, b, radius, color) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const part = mesh(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), 6), color, { outline: false });
    part.position.copy(start.add(end).multiplyScalar(0.5));
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return part;
  }

  function stroke(parent, points, color = '#565464') {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point)));
    const object = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65 }));
    parent.add(object);
    return object;
  }

  // 屋顶是完整的三角棱柱，瓦缝用少量平行线表达手绘背景的节奏。
  function tiledRoof(parent, y, width, depth, rise, color) {
    const w = width / 2;
    const d = depth / 2;
    const vertices = [
      -w, y, d, w, y, d, 0, y + rise, d,
      w, y, -d, -w, y, -d, 0, y + rise, -d,
      -w, y, -d, -w, y, d, 0, y + rise, d,
      -w, y, -d, 0, y + rise, d, 0, y + rise, -d,
      0, y + rise, -d, 0, y + rise, d, w, y, d,
      0, y + rise, -d, w, y, d, w, y, -d,
      -w, y, -d, w, y, -d, w, y, d,
      -w, y, -d, w, y, d, -w, y, d,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const surface = mesh(parent, geometry, color);
    surface.userData.roof = true;
    box(parent, 0, y + rise + 0.035, 0, 0.21, 0.11, depth + 0.12, '#777d8c');
    for (let i = 1; i < 8; i += 1) {
      const offset = (i / 8) * w;
      const height = y + rise * (1 - i / 8) + 0.018;
      stroke(parent, [[offset, height, -d], [offset, height, d]], '#454c60');
      stroke(parent, [[-offset, height, -d], [-offset, height, d]], '#454c60');
    }
    for (let i = 0; i <= Math.floor(depth / 0.53); i += 1) {
      const z = -d + i * 0.53;
      stroke(parent, [[-w, y + 0.025, z], [0, y + rise + 0.025, z], [w, y + 0.025, z]], '#818796');
    }
    for (const side of [-1, 1]) {
      box(parent, side * w, y - 0.08, 0, 0.14, 0.2, depth + 0.11, '#605c61');
      box(parent, side * (w - 0.16), y - 0.15, 0, 0.33, 0.075, depth - 0.04, '#8c7961');
      rod(parent, [side * (w + 0.035), y - 0.04, -d - 0.06], [side * (w + 0.035), y - 0.04, d + 0.06], 0.067, '#777b7d');
      for (const end of [-1, 1]) {
        rod(parent, [side * w, y - 0.027, end * (d + 0.025)], [0, y + rise - 0.025, end * (d + 0.025)], 0.073, '#69626b');
      }
    }
    const tileShades = [new THREE.Color(color).offsetHSL(0, -0.015, 0.035).getStyle(), new THREE.Color(color).offsetHSL(0, 0.015, -0.025).getStyle()];
    for (let i = 0; i < 10; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const fraction = 0.29 + ((i * 3) % 5) * 0.13;
      const tileX = side * w * fraction;
      const tileZ = -d + 0.42 + ((i * 7) % 9) * (depth - 0.84) / 9;
      box(parent, tileX, y + rise * (1 - fraction) + 0.038, tileZ, 0.51, 0.047, 0.52, tileShades[i % 2], { outline: false, castShadow: false, rotation: [0, 0, -side * Math.atan2(rise, w)] });
    }
  }

  function window(parent, x, y, z, width = 1.3, height = 1.5, rotation = 0, curtain = true, opened = false) {
    const frame = group(parent, x, y, z, rotation);
    // 窗框由四边木料组成，玻璃后面是真实房间而不是整块木板。
    for (const xx of [-width / 2 - 0.04, width / 2 + 0.04]) box(frame, xx, 0, 0, 0.08, height + 0.16, 0.12, palette.wood);
    for (const yy of [-height / 2 - 0.04, height / 2 + 0.04]) box(frame, 0, yy, 0, width, 0.08, 0.12, palette.wood);
    const glazing = new THREE.MeshBasicMaterial({ color: '#a9c5c8', transparent: true, opacity: 0.19, side: THREE.DoubleSide, depthWrite: false });
    const pane = mesh(frame, new THREE.PlaneGeometry(opened ? width / 2 - 0.025 : width, height), glazing, { outline: false, castShadow: false });
    pane.position.set(opened ? width / 4 : 0, 0, 0.06);
    if (curtain) {
      box(frame, -width * 0.36, 0.015, -0.07, width * 0.22, height - 0.09, 0.025, '#dcd9c7', { outline: false, castShadow: false, receiveShadow: false });
      box(frame, width * 0.36, 0.015, -0.07, width * 0.22, height - 0.09, 0.025, '#c8d0c9', { outline: false, castShadow: false, receiveShadow: false });
      stroke(frame, [[-width * 0.35, -height * 0.45, -0.09], [-width * 0.37, height * 0.45, -0.09]], '#a6aead');
    }
    box(frame, 0, 0, 0.12, 0.065, height, 0.045, '#b4aa91');
    box(frame, 0, -height * 0.14, 0.121, width, 0.055, 0.046, '#b4aa91');
    if (opened) {
      const leafWidth = width / 2 - 0.045;
      const sash = group(frame, -width / 2 + 0.025, 0, 0.13, -0.24);
      for (const sx of [0, leafWidth]) box(sash, sx, 0, 0, 0.045, height, 0.058, '#b8ac90');
      for (const sy of [-height / 2, height / 2]) box(sash, leafWidth / 2, sy, 0, leafWidth, 0.045, 0.058, '#b8ac90');
      const openGlass = mesh(sash, new THREE.PlaneGeometry(leafWidth - 0.055, height - 0.07), glazing, { outline: false, castShadow: false });
      openGlass.position.set(leafWidth / 2, 0, 0.012);
      box(sash, leafWidth / 2, -height * 0.14, 0.055, leafWidth - 0.06, 0.045, 0.027, '#b8ac90');
      box(sash, leafWidth - 0.087, -0.03, 0.07, 0.025, 0.11, 0.035, '#7f8279', { outline: false });
    }
    box(frame, 0, -height / 2 - 0.065, 0.13, width + 0.25, 0.095, 0.27, '#b9b4a4');
    box(frame, 0, height / 2 + 0.105, 0.12, width + 0.34, 0.065, 0.43, '#727981');
    return frame;
  }

  function planter(parent, x, y, z, size = 0.3, flowers = false) {
    cylinder(parent, x, y + size * 0.52, z, size * 0.68, size, '#b57d64', 8);
    cylinder(parent, x, y + size, z, size * 0.75, size * 0.12, '#b9866c', 8);
    for (let i = 0; i < 3; i += 1) {
      const leaf = mesh(parent, new THREE.IcosahedronGeometry(size * 0.69, 0), i % 2 ? '#788b5d' : '#58745b', { outline: false });
      leaf.position.set(x + (i - 1) * size * 0.34, y + size * 1.4 + (i % 2) * size * 0.32, z + (i % 2) * size * 0.15);
      leaf.scale.y = 1.2;
      if (flowers) {
        const flower = mesh(parent, new THREE.IcosahedronGeometry(size * 0.23, 0), i % 2 ? '#e9cab1' : '#d795a6', { outline: false });
        flower.position.copy(leaf.position).y += size * 0.55;
      }
    }
  }

  function airConditioner(parent, x, y, z, rotation = 0) {
    const unit = group(parent, x, y, z, rotation);
    box(unit, 0, 0, 0, 1.04, 0.62, 0.4, '#d5d3c5');
    const fan = mesh(unit, new THREE.CircleGeometry(0.225, 16), '#858c8d', { outline: false });
    fan.position.set(-0.2, 0, 0.207);
    for (let i = 0; i < 6; i += 1) box(unit, -0.2, -0.19 + i * 0.076, 0.218, 0.43, 0.022, 0.016, '#bdc0b8', { outline: false });
    for (let i = 0; i < 4; i += 1) box(unit, 0.32, -0.16 + i * 0.095, 0.213, 0.2, 0.025, 0.02, '#989f9b', { outline: false });
    box(unit, -0.39, -0.36, 0, 0.11, 0.12, 0.54, '#7b7d79');
    box(unit, 0.39, -0.36, 0, 0.11, 0.12, 0.54, '#7b7d79');
    rod(unit, [0.54, -0.2, -0.04], [0.65, -0.85, -0.15], 0.035, '#c2b79e');
  }

  function bicycle(parent, x, z, rotation = 0, color = '#5e8380') {
    const bike = group(parent, x, 0.04, z, rotation);
    for (const wheelX of [-0.57, 0.57]) {
      const tyre = mesh(bike, new THREE.TorusGeometry(0.36, 0.04, 6, 18), '#51505a', { outline: false });
      tyre.position.set(wheelX, 0.39, 0);
      const rim = mesh(bike, new THREE.TorusGeometry(0.307, 0.011, 4, 18), '#b5b7b1', { outline: false });
      rim.position.copy(tyre.position);
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI;
        stroke(bike, [[wheelX - Math.cos(angle) * 0.3, 0.39 - Math.sin(angle) * 0.3, 0.006], [wheelX + Math.cos(angle) * 0.3, 0.39 + Math.sin(angle) * 0.3, 0.006]], '#b8b8b0');
      }
    }
    const points = [[-0.57, 0.39, 0], [-0.2, 0.83, 0], [0, 0.39, 0], [0.37, 0.85, 0], [0.57, 0.39, 0]];
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 1], [2, 0], [3, 4]]) rod(bike, points[a], points[b], 0.027, color);
    rod(bike, [-0.2, 0.78, 0], [-0.24, 1.02, 0], 0.018, '#868c89');
    box(bike, -0.25, 1.03, 0, 0.33, 0.065, 0.16, '#665452');
    rod(bike, [0.36, 0.83, 0], [0.29, 1.14, 0], 0.018, '#bcc0b6');
    rod(bike, [0.29, 1.14, -0.17], [0.29, 1.14, 0.17], 0.019, '#74777a');
    box(bike, 0.5, 1.05, 0, 0.29, 0.24, 0.32, '#9caa9b');
    box(bike, 0.5, 1.08, 0.166, 0.25, 0.12, 0.014, '#778e87', { outline: false });
    rod(bike, [0, 0.38, 0], [-0.12, 0.21, 0.14], 0.013, '#9ba39a');
    box(bike, -0.13, 0.21, 0.15, 0.17, 0.035, 0.09, '#514e57');
    rod(bike, [-0.27, 0.36, 0], [-0.45, 0.04, 0.24], 0.013, '#909887');
  }

  function vendingMachine(parent, x, z, color = '#7394a5', rotation = 0) {
    const machine = group(parent, x, 0.16, z, rotation);
    box(machine, 0, 0.91, 0, 1.08, 1.82, 0.75, color);
    box(machine, 0, 1.68, 0.395, 0.96, 0.18, 0.045, '#f0ead9');
    sign(machine, 'つめたい', 0, 1.68, 0.425, 0.78, 0.11, { fg: '#506c80', bg: '#f0ead9' });
    box(machine, -0.08, 1.16, 0.393, 0.82, 0.79, 0.035, '#526c80');
    box(machine, -0.08, 1.16, 0.413, 0.74, 0.72, 0.015, '#c4d6d5', { outline: false });
    const drinkColors = ['#d59673', '#e4d4ac', '#8bb5a0', '#a0bad1', '#ddaaad'];
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const canX = -0.36 + column * 0.143;
        const canY = 0.94 + row * 0.225;
        cylinder(machine, canX, canY, 0.446, 0.045, 0.137, drinkColors[(row + column) % drinkColors.length], 6);
        box(machine, canX, canY, 0.494, 0.065, 0.039, 0.012, '#f3eddc', { outline: false });
        box(machine, canX, canY - 0.091, 0.437, 0.07, 0.025, 0.018, '#f0ebce', { outline: false });
      }
      box(machine, -0.08, 0.826 + row * 0.225, 0.447, 0.78, 0.028, 0.055, '#839496', { outline: false });
    }
    box(machine, 0.423, 0.9, 0.412, 0.095, 0.35, 0.033, '#d9dfd7');
    box(machine, 0.423, 1.025, 0.437, 0.05, 0.021, 0.018, '#4c535b', { outline: false });
    box(machine, 0.423, 0.908, 0.438, 0.067, 0.07, 0.019, '#779387', { outline: false });
    box(machine, -0.07, 0.38, 0.409, 0.69, 0.2, 0.04, '#49505a');
    box(machine, -0.07, 0.285, 0.434, 0.73, 0.07, 0.072, '#a8b7b6');
    sign(machine, 'DRINK', -0.1, 0.61, 0.417, 0.57, 0.12, { fg: '#f8f0d8', bg: color });
    for (const footX of [-0.35, 0.35]) box(machine, footX, -0.07, 0, 0.14, 0.15, 0.49, '#6c6b67');
  }

  function balcony(parent, z, width, height) {
    const base = height / 2 + 0.295;
    box(parent, 0, base, z + 0.47, width, 0.17, 1.05, '#a7a99f');
    box(parent, 0, base + 0.91, z + 0.98, width, 0.067, 0.06, '#637378');
    box(parent, 0, base + 0.21, z + 0.98, width, 0.07, 0.06, '#637378');
    for (let x = -width / 2; x <= width / 2 + 0.01; x += 0.48) box(parent, x, base + 0.56, z + 0.98, 0.035, 0.68, 0.04, '#78878a', { outline: false });
    const glass = new THREE.MeshBasicMaterial({ color: '#a6c4c4', transparent: true, opacity: 0.33, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 4; i += 1) {
      const panel = mesh(parent, new THREE.PlaneGeometry(width / 4 - 0.06, 0.59), glass, { outline: false, castShadow: false });
      panel.position.set(-width / 2 + (i + 0.5) * width / 4, base + 0.56, z + 0.985);
    }
    for (const x of [-width / 2, width / 2]) {
      box(parent, x, base + 0.55, z + 0.5, 0.05, 0.72, 1, '#748188');
      rod(parent, [x * 0.75, base - 0.08, z + 0.6], [x * 0.75, base - 0.74, z + 0.04], 0.033, '#7c827e');
    }
    planter(parent, -width * 0.34, base + 0.09, z + 0.75, 0.23, true);
    rod(parent, [-width * 0.36, base + 1.71, z + 0.6], [width * 0.38, base + 1.71, z + 0.6], 0.013, '#9c9181');
    for (let i = 0; i < 3; i += 1) {
      const clothes = group(parent, -width * 0.15 + i * 0.63, base + 1.67, z + 0.6);
      clothes.userData.dynamic = true;
      if (i === 1) {
        box(clothes, -0.12, -0.34, 0, 0.2, 0.61, 0.028, '#8797ae', { outline: false, castShadow: false });
        box(clothes, 0.12, -0.34, 0, 0.2, 0.61, 0.028, '#8797ae', { outline: false, castShadow: false });
        box(clothes, 0, -0.08, 0, 0.43, 0.16, 0.034, '#8797ae', { outline: false, castShadow: false });
      } else {
        const shade = i === 0 ? '#e9dfc6' : '#cab1b0';
        box(clothes, 0, -0.3, 0, 0.43, 0.6, 0.03, shade, { outline: false, castShadow: false });
        box(clothes, -0.26, -0.13, 0, 0.19, 0.22, 0.03, shade, { outline: false, castShadow: false, rotation: [0, 0, -0.25] });
        box(clothes, 0.26, -0.13, 0, 0.19, 0.22, 0.03, shade, { outline: false, castShadow: false, rotation: [0, 0, 0.25] });
      }
      for (const clipX of [-0.14, 0.14]) box(clothes, clipX, -0.01, 0, 0.022, 0.077, 0.054, '#a89670', { outline: false, castShadow: false });
      animatedClothes.push({ group: clothes, phase: animatedClothes.length * 0.91 });
    }
  }

  function woodenPanels(parent, x, z, width, height) {
    box(parent, x, height / 2 + 0.3, z, width, height, 0.08, '#9a7858');
    for (let i = 1; i < 6; i += 1) {
      const y = 0.3 + (i / 6) * height;
      stroke(parent, [[x - width / 2 + 0.04, y, z + 0.047], [x + width / 2 - 0.03, y + 0.018, z + 0.047]], '#735845');
    }
    stroke(parent, [[x - 0.12, 0.54, z + 0.051], [x + 0.17, 0.82, z + 0.051], [x + 0.09, 1.25, z + 0.051]], '#b29170');
  }

  function house({ x, z, rotation = 0, width = 6, depth = 5, height = 6.05, color = palette.cream, shop = null, balconySize = 0, distant = false, floors = 2, roofColor = palette.tile, timber = false }) {
    const building = group(town, x, 0, z, rotation);
    const front = depth / 2;
    const id = `residence-${++residenceCount}`;
    const name = `${['小森', '日向', '高橋', '青山', '桜井', '杉本', '秋山'][((residenceCount - 1) % 7)]}家${distant ? '的后街住宅' : '的住宅'}`;
    building.name = name;
    const doorX = -width * 0.14;
    const doorWidth = 1.2;
    const doorTop = 2.62;
    // 地基低于室内木地板，避免两张共面顶面在近景里闪烁。
    box(building, 0, 0.1, 0, width + 0.16, 0.2, depth + 0.18, '#aaa596');
    const hole = (center, bottom, top, openingWidth) => ({ left: center - openingWidth / 2, right: center + openingWidth / 2, bottom, top });
    const frontHoles = [hole(doorX, 0.24, doorTop, doorWidth + 0.05), hole(width * 0.29, 0.97, 2.45, 1.52)];
    const rearHoles = [hole(width * 0.23, 1.17, 2.29, 1.24)];
    const rightHoles = distant ? [] : [hole(-0.74, 1.155, 2.285, 1.17)];
    const leftHoles = [];
    if (floors === 2) {
      const upperY = height - 1.39;
      frontHoles.push(hole(-width * 0.245, upperY - 0.725, upperY + 0.725, 1.66), hole(width * 0.245, upperY - 0.725, upperY + 0.725, 1.64));
      rearHoles.push(hole(-width * 0.2, height - 2.025, height - 0.775, 1.24));
      rightHoles.push(hole(-0.9, upperY + 0.02 - 0.7, upperY + 0.02 + 0.7, 1.29));
      leftHoles.push(hole(0.65, upperY + 0.02 - 0.7, upperY + 0.02 + 0.7, 1.19));
    }
    function clearRanges(length, holes, y) {
      const result = [];
      let cursor = -length / 2;
      for (const opening of holes.filter(value => y > value.bottom && y < value.top).sort((a, b) => a.left - b.left)) {
        const left = Math.max(-length / 2, opening.left);
        const right = Math.min(length / 2, opening.right);
        if (left > cursor) result.push([cursor, left]);
        cursor = Math.max(cursor, right);
      }
      if (cursor < length / 2) result.push([cursor, length / 2]);
      return result;
    }
    function wall(axis, fixed, length, holes, insideOffset) {
      const rows = [...new Set([0.24, height + 0.24, ...holes.flatMap(value => [value.bottom, value.top])].filter(value => value >= 0.24 && value <= height + 0.24))].sort((a, b) => a - b);
      for (let j = 1; j < rows.length; j++) {
        const y = (rows[j - 1] + rows[j]) / 2;
        const h = rows[j] - rows[j - 1];
        for (const [a, b] of clearRanges(length, holes, y)) {
          if (b - a < 0.01) continue;
          if (axis === 'x') {
            box(building, (a + b) / 2, y, fixed, b - a, h, 0.16, color);
            box(building, (a + b) / 2, y, fixed + insideOffset, b - a, h, 0.015, '#e5dac3', { outline: false, castShadow: false, receiveShadow: false });
          } else {
            box(building, fixed, y, (a + b) / 2, 0.16, h, b - a, color);
            box(building, fixed + insideOffset, y, (a + b) / 2, 0.015, h, b - a, '#e5dac3', { outline: false, castShadow: false, receiveShadow: false });
          }
        }
      }
    }
    // 每一扇窗都有对应墙洞，内侧是维护良好的浅色抹灰墙。
    wall('x', front - 0.08, width, frontHoles, -0.092);
    wall('x', -front + 0.08, width, rearHoles, 0.092);
    wall('z', width / 2 - 0.08, depth, rightHoles, -0.092);
    wall('z', -width / 2 + 0.08, depth, leftHoles, 0.092);
    // 墙裙与窗下沿同样绕开入口。
    for (const [a, b] of [[-width / 2, doorX - doorWidth / 2 - 0.025], [doorX + doorWidth / 2 + 0.025, width / 2]]) {
      box(building, (a + b) / 2, 0.57, front + 0.04, b - a, 0.59, 0.1, '#b8b4a3');
    }
    if (floors === 2) box(building, 0, 3.16, front + 0.047, width + 0.06, 0.13, 0.16, '#c4b59b');
    box(building, 0, height + 0.23, 0, width + 0.55, 0.2, depth + 0.64, palette.wood);
    tiledRoof(building, height + 0.36, width + 0.78, depth + 0.89, floors === 1 ? 0.78 : 1.3, roofColor);
    for (const corner of [-1, 1]) {
      box(building, corner * (width / 2 - 0.075), height / 2 + 0.25, front + 0.058, 0.12, height, 0.13, '#c7b99e');
      cylinder(building, corner * (width / 2 + 0.12), height / 2 + 0.12, front + 0.16, 0.053, height + 0.15, '#858a87', 6);
      rod(building, [corner * (width / 2 + 0.12), height + 0.19, front + 0.16], [corner * (width / 2 + 0.425), height + 0.32, front + 0.42], 0.053, '#858a87');
      rod(building, [corner * (width / 2 + 0.12), 0.25, front + 0.16], [corner * (width / 2 + 0.26), 0.19, front + 0.22], 0.06, '#858a87');
    }
    if (floors === 2) {
      const upperY = height - 1.39;
      window(building, -width * 0.245, upperY, front + 0.09, 1.62, 1.45, 0, true, !distant && timber);
      window(building, width * 0.245, upperY, front + 0.09, 1.6, 1.45);
      window(building, width / 2 + 0.07, upperY + 0.02, -0.9, 1.25, 1.4, Math.PI / 2, true, !distant && balconySize > 4);
      window(building, -width / 2 - 0.07, upperY + 0.02, 0.65, 1.15, 1.4, -Math.PI / 2);
      if (balconySize) balcony(building, front + 0.13, balconySize, height);
    }
    if (timber) {
      for (let i = 0; i < Math.floor(height / 0.33); i += 1) {
        const y = 0.4 + i * 0.33;
        for (const [a, b] of clearRanges(width, frontHoles, y)) box(building, (a + b) / 2, y, front + 0.075, b - a, 0.033, 0.033, '#9e8063', { outline: false });
        for (const [a, b] of clearRanges(width, rearHoles, y)) box(building, (a + b) / 2, y, -front - 0.025, b - a, 0.033, 0.033, '#9e8063', { outline: false });
        for (const [a, b] of clearRanges(depth, rightHoles, y)) box(building, width / 2 + 0.025, y, (a + b) / 2, 0.035, 0.033, b - a, '#9e8063', { outline: false });
        for (const [a, b] of clearRanges(depth, leftHoles, y)) box(building, -width / 2 - 0.025, y, (a + b) / 2, 0.035, 0.033, b - a, '#9e8063', { outline: false });
      }
    }

    if (shop) {
      const bakery = shop === 'bakery';
      const shade = bakery ? '#a27464' : '#679a83';
      const left = -width * 0.23;
      window(building, 0.86, 1.69, -front - 0.08, 1.59, 1.17, Math.PI, false);
      box(building, -1.32, 1.23, -front - 0.065, 1.06, 2.03, 0.12, '#927e63');
      box(building, -1.32, 1.69, -front - 0.134, 0.75, 0.66, 0.021, '#95a79e', { outline: false });
      box(building, -1.69, 1.14, -front - 0.153, 0.035, 0.19, 0.027, '#ccbfa3');
      sign(building, bakery ? '珈琲と焼きたてパン' : '小杉商店', 0, 2.67, -front - 0.09, 3.1, 0.44, { bg: '#e6d9bb', fg: '#6d715e', rotationY: Math.PI });
      box(building, -1.34, 0.13, -front - 0.39, 1.25, 0.19, 0.66, '#b9b5a4');
      planter(building, 1.72, 0.05, -front - 0.53, 0.25, true);
      box(building, left, 1.6, front + 0.1, width * 0.42, 2.36, 0.14, '#705d51');
      box(building, left, 1.64, front + 0.187, width * 0.37, 1.95, 0.024, '#879b9b', { outline: false });
      box(building, left, 1.68, front + 0.211, 0.055, 1.95, 0.046, '#c3bba5');
      box(building, left, 1.1, front + 0.211, width * 0.37, 0.052, 0.046, '#c3bba5');
      for (let i = 0; i < 4; i += 1) {
        const displayX = left - 0.7 + i * 0.43;
        box(building, displayX, 1.09, front + 0.232, 0.24, 0.17, 0.13, bakery ? '#caa573' : ['#a9bb9e', '#d1ab8f', '#d3ce9b', '#9aafc1'][i], { outline: false });
      }
      box(building, width * 0.21, 1.5, front + 0.1, 1.17, 2.46, 0.13, palette.wood);
      box(building, width * 0.21, 1.55, front + 0.176, 0.94, 2.13, 0.022, '#809596', { outline: false });
      box(building, width * 0.21 - 0.35, 1.39, front + 0.218, 0.045, 0.24, 0.043, '#d7d0b8');
      sign(building, bakery ? 'こもれび ベーカリー' : '小杉商店', 0, 3.01, front + 0.29, width - 0.45, 0.53, { bg: bakery ? '#efe0bd' : '#eee4c8', fg: '#645647', border: '#9a7b61' });
      const awning = group(building, 0, 2.56, front + 0.51);
      awning.rotation.x = 0.15;
      box(awning, 0, 0, 0, width - 0.13, 0.11, 1.34, '#dfd8bf');
      const stripeWidth = (width - 0.13) / 13;
      for (let i = 0; i < 13; i += 1) {
        const stripeX = -width / 2 + 0.07 + stripeWidth * (i + 0.5);
        if (i % 2 === 0) box(awning, stripeX, 0.064, 0, stripeWidth, 0.018, 1.34, shade, { outline: false });
        box(awning, stripeX, -0.08, 0.66, stripeWidth - 0.01, 0.18, 0.055, i % 2 === 0 ? shade : '#e7dfc8', { outline: false });
      }
      rod(building, [-width / 2 + 0.18, 2.47, front + 1.12], [-width / 2 + 0.18, 2.1, front + 0.05], 0.028, '#8a8575');
      rod(building, [width / 2 - 0.18, 2.47, front + 1.12], [width / 2 - 0.18, 2.1, front + 0.05], 0.028, '#8a8575');
      box(building, 0, 0.24, front + 0.58, width + 0.22, 0.14, 1.2, '#b9b5a6');
      box(building, width * 0.21, 0.135, front + 1.24, 1.47, 0.08, 0.8, '#c2bdab', { rotation: [-0.07, 0, 0] });
      planter(building, -width * 0.42, 0.31, front + 0.9, 0.35, true);
      planter(building, width * 0.44, 0.31, front + 0.84, 0.25);
      const board = group(building, -width * 0.25, 0, front + 1.08);
      box(board, 0, 0.83, 0, 0.63, 0.95, 0.07, '#857053', { rotation: [-0.1, 0, 0] });
      box(board, 0, 0.83, 0.048, 0.5, 0.78, 0.02, '#526360', { outline: false });
      sign(board, bakery ? '焼きたて\nパンと珈琲' : '冷たい飲み物\nあります', 0, 0.87, 0.073, 0.43, 0.61, { bg: '#526360', fg: '#ece2c5' });
      rod(board, [-0.26, 0.36, -0.05], [-0.26, 0.07, -0.35], 0.035, '#857053');
      rod(board, [0.26, 0.36, -0.05], [0.26, 0.07, -0.35], 0.035, '#857053');
      if (!bakery) {
        vendingMachine(building, width / 2 + 0.72, front + 0.4, '#7394a5', Math.PI / 2);
        sign(building, '小杉商店', width / 2 + 0.085, 2.69, 0.07, 2.45, 0.46, { bg: '#efe4c8', fg: '#687567', rotationY: Math.PI / 2, border: '#8a957c' });
      }
      else {
        box(building, -width / 2 - 0.47, 0.65, front + 0.78, 0.78, 0.14, 0.74, '#a58561');
        for (const dx of [-0.3, 0.3]) for (const dz of [-0.27, 0.27]) box(building, -width / 2 - 0.47 + dx, 0.37, front + 0.78 + dz, 0.055, 0.55, 0.055, '#816e59');
        planter(building, -width / 2 - 0.47, 0.72, front + 0.78, 0.15, true);
      }
    } else {
      window(building, width * 0.23, 1.73, -front - 0.085, 1.2, 1.12, Math.PI);
      if (floors === 2) window(building, -width * 0.2, height - 1.4, -front - 0.085, 1.2, 1.25, Math.PI);
      createHomeDoor(kit, town, building, { id, name, x: doorX, front });
      window(building, width * 0.29, 1.71, front + 0.085, 1.48, 1.48);
      box(building, -width * 0.14, 2.77, front + 0.45, 1.92, 0.14, 1.05, '#77818a');
      box(building, -width * 0.14, 0.22, front + 0.46, 1.68, 0.19, 0.91, '#b6b19f');
      if (!distant) {
        planter(building, -width * 0.36, 0.24, front + 0.64, 0.26, true);
        planter(building, width * 0.42, 0.2, front + 0.74, 0.38);
        woodenPanels(building, -width * 0.38, front + 0.11, 1.03, 1.63);
      }
    }
    if (!distant) {
      window(building, width / 2 + 0.085, 1.72, -0.74, 1.13, 1.13, Math.PI / 2);
      airConditioner(building, width / 2 + 0.27, 0.77, 0.68, Math.PI / 2);
      box(building, width / 2 + 0.066, 2.44, -depth * 0.27, 0.019, 0.77, 0.73, '#d4ccbb', { outline: false });
      box(building, width * 0.37, 1.13, front + 0.107, 0.71, 0.35, 0.016, '#cfc5b0', { outline: false });
      stroke(building, [[width * 0.46, 0.28, front + 0.12], [width * 0.43, 0.4, front + 0.12], [width * 0.46, 0.65, front + 0.12]], '#8a8a84');
      cylinder(building, width / 2 + 0.21, Math.min(4.2, height - 0.2) / 2 + 0.04, -depth / 2 + 0.31, 0.029, Math.min(4.2, height - 0.2), '#aba898', 6);
    }
    if (!shop) {
      decorateResidence(kit, building, { width, depth, height, distant });
      buildHomeInterior(kit, town, building, { id, name, width, depth, height, floors, distant });
    }
    return building;
  }

  // 沿主街交错布置，院落、支路和车站前的小广场始终保持通畅。
  const leftB = house({ x: -13, z: 5.8, rotation: Math.PI / 2 + 0.045, width: 5.8, depth: 5.6, height: 5.85, color: '#78614f', timber: true, roofColor: '#646c75' });
  const leftC = house({ x: -12.3, z: -9.8, rotation: Math.PI / 2 - 0.055, width: 5.35, depth: 4.8, height: 5.65, color: '#d6ddcf', balconySize: 3.8, roofColor: '#74847c' });
  house({ x: 13.6, z: 28.3, rotation: -Math.PI / 2 + 0.04, width: 6.7, depth: 6.1, height: 6.45, color: '#c5d1d5', balconySize: 4.3, roofColor: '#697786' });
  house({ x: -15.1, z: 30.5, rotation: Math.PI / 2 + 0.065, width: 7.1, depth: 6.35, height: 6.1, color: '#dfd0b1', balconySize: 4.6 });

  bicycle(leftB, -3.7, 2.65, 0.12, '#a36c5d');
  vendingMachine(town, 1.25, 13.25, '#7394a5', -Math.PI / 2);
  planter(leftC, 3.8, 0.06, 1.57, 0.48);
  planter(leftC, 3.8, 0.06, -0.07, 0.3, true);

  function yard(x, z, width, depth, side = 1, accessZ = null) {
    box(town, x, 0.027, z, width, 0.055, depth, '#b5b09d', { outline: false, castShadow: false });
    const segments = accessZ === null ? [[z - depth / 2, z + depth / 2]] : [[z - depth / 2, accessZ - 0.76], [accessZ + 0.76, z + depth / 2]];
    for (const [a, b] of segments) {
      if (b <= a) continue;
      box(town, x + side * width / 2, 0.51, (a + b) / 2, 0.18, 0.95, b - a, '#aaa99b');
      box(town, x + side * width / 2, 1, (a + b) / 2, 0.24, 0.1, b - a + 0.05, '#c3bdac');
    }
    box(town, x, 0.52, z - depth / 2, width, 0.98, 0.17, '#aaa99b');
    for (let i = 0; i < 5; i += 1) stroke(town, [[x - width / 2, 0.25 + i * 0.18, z - depth / 2 + 0.092], [x + width / 2, 0.25 + i * 0.18, z - depth / 2 + 0.092]], '#929589');
    for (let i = 0; i < 4; i += 1) planter(town, x + (i - 1.5) * 0.59, 0.06, z - depth * 0.25, 0.26, i % 2 === 0);
    box(town, x - width * 0.28, 0.076, z + depth * 0.16, width * 0.4, 0.11, depth * 0.34, '#8b8b70', { outline: false });
  }
  yard(11.9, 13.7, 4.4, 2.5, 1);

  // 远景保持屋顶和窗格的清楚节奏，避免细节把视线从站房抢走。
  const distantPlots = [
    { x: -21.5, z: -29, color: '#c4d0d0', width: 5.2, height: 5.6, roofColor: '#6c8091' },
    { x: -13, z: -31.8, color: '#dabf99', width: 6.3, depth: 5.2, height: 3.05, floors: 1, timber: true, roofColor: '#7c7063' },
    { x: -4.5, z: -32.5, color: '#d8dedb', width: 4.7, height: 6.2, rotation: Math.PI / 2 },
    { x: 3.6, z: -32.2, color: '#eadbbe', width: 6.3, depth: 4.8, height: 5.6, roofColor: '#8c827a' },
    { x: 12.3, z: -31.3, color: '#c0cdce', width: 5.7, height: 3.3, floors: 1, rotation: -Math.PI / 2, roofColor: '#637e83' },
    { x: 21.7, z: -30.5, color: '#d8cfb4', width: 5.5, height: 6.25, roofColor: '#708079' },
    { x: -26, z: -42, color: '#bdb9a5', width: 5.1, height: 3.1, floors: 1, rotation: Math.PI / 2, roofColor: '#7f7365' },
    { x: -17.2, z: -43.6, color: '#ccb9a0', width: 6.2, height: 5.75, timber: true },
    { x: -1.9, z: -44.2, color: '#d6cfb8', width: 5.1, height: 3.1, floors: 1, roofColor: '#70817e' },
    { x: 14.9, z: -43.1, color: '#c3d1d3', width: 5.8, height: 6.1, rotation: -Math.PI / 2, roofColor: '#697d92' },
  ];
  for (const plot of distantPlots) house({ depth: 4.5, distant: true, ...plot });

  box(town, 0, 0.046, -26, 52, 0.092, 2.15, '#b6b6a6', { outline: false, castShadow: false });
  box(town, 0, 0.042, -37.6, 57, 0.084, 2.55, '#babba8', { outline: false, castShadow: false });
  box(town, -8.5, 0.049, -33.4, 1.85, 0.098, 12.8, '#b6b6a6', { outline: false, castShadow: false });
  box(town, 17.1, 0.049, -33.7, 1.65, 0.098, 13, '#b6b6a6', { outline: false, castShadow: false });
  yard(-18, -34, 4.1, 3.4, -1);
  yard(7.65, -33.1, 3.2, 4.1, 1, -32.1);
  yard(24, -38.5, 5.2, 4.7, 1);

  function evergreen(x, z, height = 4.1) {
    cylinder(town, x, height * 0.28, z, 0.12, height * 0.55, '#8b7656', 7);
    for (let i = 0; i < 3; i += 1) {
      const crown = mesh(town, new THREE.IcosahedronGeometry(height * (0.27 - i * 0.04), 0), ['#6f8c67', '#7d946c', '#91a579'][i], { outline: false });
      crown.position.set(x + (i === 1 ? 0.16 : -0.05), height * (0.42 + i * 0.19), z + (i === 1 ? -0.13 : 0.08));
      crown.scale.y = 1.2;
    }
  }
  for (const [x, z, height] of [[-25, -31, 4.8], [-10, -40, 4], [7.4, -41, 4.8], [27, -34, 5.3], [22.2, 14.5, 3.8], [15.4, 22, 3.6]]) evergreen(x, z, height);

  function vegetablePlot(x, z, width, depth) {
    box(town, x, 0.04, z, width + 1.4, 0.08, depth + 1.35, '#b6ae90', { outline: false, castShadow: false });
    box(town, x, 0.13, z, width, 0.15, depth, '#937f62', { outline: false });
    for (const offset of [-1, 1]) {
      box(town, x + offset * width / 2, 0.21, z, 0.1, 0.27, depth + 0.16, '#a08e73');
      box(town, x, 0.21, z + offset * depth / 2, width + 0.1, 0.27, 0.1, '#a08e73');
    }
    for (let row = 0; row < 4; row += 1) {
      const plantZ = z - depth / 2 + 0.42 + row * (depth - 0.85) / 3;
      box(town, x, 0.22, plantZ, width - 0.32, 0.14, 0.18, '#a68c6b', { outline: false });
      for (let column = 0; column < 6; column += 1) {
        const leaf = mesh(town, new THREE.IcosahedronGeometry(0.2, 0), row % 2 ? '#8ca279' : '#738f66', { outline: false });
        leaf.position.set(x - width / 2 + 0.39 + column * (width - 0.8) / 5, 0.41, plantZ);
        leaf.scale.set(1.15, 0.9, 1.1);
      }
    }
    for (const postX of [x - width / 2 - 0.3, x + width / 2 + 0.3]) {
      for (const postZ of [z - depth / 2 - 0.3, z + depth / 2 + 0.3]) box(town, postX, 0.51, postZ, 0.075, 0.92, 0.075, '#b4a17c');
      rod(town, [postX, 0.8, z - depth / 2 - 0.3], [postX, 0.8, z + depth / 2 + 0.3], 0.017, '#a59577');
    }
  }
  vegetablePlot(17.7, 13.2, 4.2, 4.6);
  vegetablePlot(22.1, 23.5, 5.1, 4.1);
  box(town, 17.7, 0.058, 19.8, 1.23, 0.115, 9.2, '#c0b59a', { outline: false, castShadow: false });
  box(town, 23.6, 0.052, 30.2, 12, 0.105, 1.7, '#b7ad93', { outline: false, castShadow: false });
  const shed = group(town, 26.5, 0, 15.5);
  shed.name = '菜园旁的农具棚';
  for (const side of [-1, 1]) box(shed, side * 1.58, 1.21, 0, 0.14, 2.15, 2.5, '#b49b79');
  box(shed, 0, 1.21, -1.18, 3.3, 2.15, 0.14, '#b49b79');
  for (const [a, b] of [[-1.65, -0.915], [0.335, 1.65]]) box(shed, (a + b) / 2, 1.21, 1.18, b - a, 2.15, 0.14, '#b49b79');
  box(shed, 0, 0.16, 0, 3.45, 0.23, 2.66, '#999989');
  tiledRoof(shed, 2.4, 3.75, 2.95, 0.4, '#7c8c7c');
  createHomeDoor(kit, town, shed, { id: 'garden-shed', name: '农具棚', x: -0.29, front: 1.25, floor: 0.275, width: 1.2, height: 2.05, color: '#8a785e' });
  for (let i = 0; i < 8; i += 1) for (const [a, b] of [[-1.61, -0.915], [0.335, 1.6]]) stroke(shed, [[a, 0.3 + i * 0.22, 1.285], [b, 0.3 + i * 0.22, 1.285]], '#89795e');
  box(shed, 0.96, 0.78, -0.61, 0.95, 0.07, 0.78, '#8d795f');
  for (const xx of [0.6, 1.31]) for (const zz of [-0.88, -0.34]) box(shed, xx, 0.52, zz, 0.06, 0.51, 0.06, '#8d795f');
  for (let i = 0; i < 3; i++) box(shed, -1.12 + i * 0.21, 1.2, -1.065, 0.035, 1.6, 0.055, '#9b8c6d');
  box(shed, -1.13, 0.58, -0.98, 0.26, 0.48, 0.07, '#82998d');
  box(shed, 0.83, 0.88, -0.62, 0.49, 0.13, 0.36, '#aaad8b');
  sign(shed, '植える日・四月十三日\n朝、水やり', 1.49, 1.64, -0.31, 0.68, 0.4, { bg: '#ece0c2', fg: '#647667', rotationY: -Math.PI / 2 });
  town.userData.enterableBuildings.push({ id: 'garden-shed', name: '菜园旁的农具棚', entry: [26.21, 0.275, 17.55], inside: [26.21, 0.275, 15.7], route: [[26.21, 0.07, 17.55], [26.21, 0.275, 15.7]] });
  window(shed, 0.98, 1.3, 1.29, 0.66, 0.62, 0, false);
  planter(shed, -1.83, 0.04, 1.17, 0.26);

  // 支路边的石阶与小围墙呼应长期居住的小镇尺度。
  for (const x of [-17.1, 12.7]) {
    box(town, x, 0.41, 21.8, 0.3, 0.76, 4.2, '#a9a89c');
    box(town, x, 0.83, 21.8, 0.37, 0.11, 4.32, '#beb9a8');
    for (let i = 0; i < 4; i += 1) stroke(town, [[x + 0.16, 0.13 + i * 0.19, 19.72], [x + 0.16, 0.13 + i * 0.19, 23.9]], '#929688');
  }
  town.userData.update = (time, windStrength = 0.4) => {
    const sway = 0.7 + Math.min(windStrength, 3) * 0.18;
    for (const item of animatedClothes) {
      item.group.rotation.x = Math.sin(time * 1.12 + item.phase) * 0.085 * sway;
      item.group.rotation.z = Math.sin(time * 0.87 + item.phase) * 0.025 * sway;
    }
  };
  return town;
}
