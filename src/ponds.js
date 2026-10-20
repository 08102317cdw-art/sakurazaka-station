import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 水边的尺寸同时用于地面开孔、水面网格和鱼的边界判断。
export const POND_LAYOUT = [
  { id: 'komorebi', name: '木漏れ日の鯉池', x: -29, z: 23, width: 9, depth: 7, cornerRadius: 1.65, waterY: 0.12, bottomY: -1.35, fishCount: 8 },
  { id: 'satoyama', name: '里山の養魚池', x: 31, z: 35.5, width: 10, depth: 8, cornerRadius: 1.8, waterY: 0.12, bottomY: -1.65, fishCount: 9 },
  { id: 'spring', name: '山裾の湧水池', x: -33, z: -41, width: 7, depth: 5, cornerRadius: 1.2, waterY: 0.12, bottomY: -1.2, fishCount: 6 },
];

export function roundedPondPoints(width, depth, radius, steps = 12) {
  const points = [];
  const corners = [[width / 2 - radius, depth / 2 - radius, 0], [-width / 2 + radius, depth / 2 - radius, Math.PI / 2], [-width / 2 + radius, -depth / 2 + radius, Math.PI], [width / 2 - radius, -depth / 2 + radius, Math.PI * 1.5]];
  for (const [cx, cz, start] of corners) {
    for (let i = 0; i <= steps; i += 1) {
      const a = start + i / steps * Math.PI / 2;
      points.push([cx + Math.cos(a) * radius, cz + Math.sin(a) * radius]);
    }
  }
  return points;
}

export function createPonds(kit) {
  const { THREE, mesh, box, cylinder, line, sign, mat } = kit;
  const group = new THREE.Group();
  group.name = '小镇周边的三座生活鱼塘';
  const plain = { outline: false };
  const stones = ['#9b9b86', '#868c7a', '#aeaa94', '#7c8878'];
  let seed = 25871;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const range = (a, b) => a + random() * (b - a);
  const sphere = new THREE.SphereGeometry(1, 18, 12);
  const rockShape = new THREE.IcosahedronGeometry(1, 1);
  const pelletGeometry = new THREE.SphereGeometry(0.022, 6, 4);
  const pellets = [];
  const interactions = [];
  const access = [];
  const ponds = [];
  let waterDriver = null;
  let simulationTime = 0;
  let updateRevision = 0;
  let accumulator = 0;
  let physicalSteps = 0;
  let droppedTime = 0;
  const fixedStep = 1 / 120;
  const up = new THREE.Vector3(0, 1, 0);
  const surfaceNormal = new THREE.Vector3();
  const floatRotation = new THREE.Quaternion();
  const spinRotation = new THREE.Quaternion();

  function rod(parent, a, b, radius, color) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const item = cylinder(parent, 0, 0, 0, radius, delta.length(), color, 8);
    item.position.copy(start.add(end).multiplyScalar(0.5));
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return item;
  }

  function rail(parent, a, b, y = 0.74) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const item = box(parent, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, 0.055, 0.055, Math.hypot(dx, dz) + 0.04, '#8b7c60', plain);
    item.rotation.y = Math.atan2(dx, dz);
    return item;
  }

  function path(points, width = 1.8) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const [x1, z1] = points[i], [x2, z2] = points[i + 1];
      const length = Math.hypot(x2 - x1, z2 - z1);
      const item = box(group, (x1 + x2) / 2, 0.022, (z1 + z2) / 2, width, 0.09, length + width * 0.45, '#b9b396', { ...plain, castShadow: false });
      item.rotation.y = Math.atan2(x2 - x1, z2 - z1);
      for (let d = 0.6; d < length; d += 1.7) {
        const t = d / length;
        const joint = box(group, x1 + (x2 - x1) * t, 0.071, z1 + (z2 - z1) * t, width * 0.83, 0.006, 0.026, '#a2a18a', { ...plain, castShadow: false });
        joint.rotation.y = item.rotation.y;
      }
    }
  }

  function basin(parent, pond) {
    const edge = roundedPondPoints(pond.width, pond.depth, pond.cornerRadius);
    const middle = roundedPondPoints(pond.width - 1.0, pond.depth - 1.0, Math.max(0.45, pond.cornerRadius - 0.45));
    const floor = roundedPondPoints(pond.width - 2.1, pond.depth - 2.1, Math.max(0.35, pond.cornerRadius - 0.8));
    const positions = [], groups = [];
    const rings = [edge, middle, floor];
    const heights = [0.135, pond.bottomY * 0.49, pond.bottomY];
    for (let r = 0; r < 2; r += 1) {
      const first = positions.length / 3;
      for (let i = 0; i < edge.length; i += 1) {
        const next = (i + 1) % edge.length;
        const a = [rings[r][i][0], heights[r], rings[r][i][1]];
        const b = [rings[r][next][0], heights[r], rings[r][next][1]];
        const c = [rings[r + 1][i][0], heights[r + 1], rings[r + 1][i][1]];
        const d = [rings[r + 1][next][0], heights[r + 1], rings[r + 1][next][1]];
        positions.push(...a, ...c, ...b, ...b, ...c, ...d);
      }
      groups.push([first, positions.length / 3 - first, r]);
    }
    const first = positions.length / 3;
    for (let i = 0; i < floor.length; i += 1) {
      const next = (i + 1) % floor.length;
      positions.push(0, pond.bottomY, 0, floor[next][0], pond.bottomY, floor[next][1], floor[i][0], pond.bottomY, floor[i][1]);
    }
    groups.push([first, positions.length / 3 - first, 2]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    groups.forEach(([start, count, index]) => geometry.addGroup(start, count, index));
    geometry.computeVertexNormals();
    const item = new THREE.Mesh(geometry, [mat('#8b8e72'), mat('#758267'), mat('#677657')]);
    item.material.forEach(material => { material.side = THREE.DoubleSide; });
    item.receiveShadow = true;
    item.userData.walkCollision = false;
    item.userData.waterCaustics = true;
    item.name = '有深度的土石池底和缓斜岸坡';
    parent.add(item);
    return edge;
  }

  function shore(parent, pond, edge) {
    const wetStones = new THREE.Group();
    wetStones.name = '水下卵石与沉积带';
    wetStones.userData.walkCollision = false;
    parent.add(wetStones);
    function edgeRail(a, b) {
      if (pond.id !== 'spring') { rail(parent, a, b); return; }
      // 桥两端与岸栏的交点留出门洞，不在桥面上横放拦路栏杆。
      const ea = a[0] + a[1] + 3.6, eb = b[0] + b[1] + 3.6;
      if (Math.min(ea, eb) > 0.88 || Math.max(ea, eb) < -0.88) { rail(parent, a, b); return; }
      if (Math.abs(ea - eb) < 0.001) return;
      const cuts = [0, 1, (-0.88 - ea) / (eb - ea), (0.88 - ea) / (eb - ea)].filter(t => t >= 0 && t <= 1).sort((x, y) => x - y);
      for (let i = 0; i < cuts.length - 1; i += 1) {
        const start = cuts[i], end = cuts[i + 1];
        if (Math.abs(ea + (eb - ea) * (start + end) / 2) < 0.88) continue;
        rail(parent, [a[0] + (b[0] - a[0]) * start, a[1] + (b[1] - a[1]) * start], [a[0] + (b[0] - a[0]) * end, a[1] + (b[1] - a[1]) * end]);
      }
    }
    for (let i = 0; i < edge.length; i += 1) {
      const [x, z] = edge[i];
      const next = edge[(i + 1) % edge.length];
      // 岸边保留碎石与芦苇，护栏不压在水面正上方。
      const expanded = [x + Math.sign(x) * 0.30, z + Math.sign(z) * 0.30];
      const expandedNext = [next[0] + Math.sign(next[0]) * 0.30, next[1] + Math.sign(next[1]) * 0.30];
      const frontEdge = z > pond.depth / 2 - 0.04 && next[1] > pond.depth / 2 - 0.04;
      const platformOpening = frontEdge && Math.max(Math.abs(x), Math.abs(next[0])) < 1.45;
      if (frontEdge && x > 1.45 && next[0] < -1.45) {
        edgeRail(expanded, [1.45, expanded[1]]);
        edgeRail([-1.45, expandedNext[1]], expandedNext);
      } else if (!platformOpening) edgeRail(expanded, expandedNext);
      const bridgeOpening = pond.id === 'spring' && Math.abs(expanded[0] + expanded[1] + 3.6) < 0.92;
      if (i % 4 === 0 && !platformOpening && !bridgeOpening) cylinder(parent, expanded[0], 0.42, expanded[1], 0.048, 0.82, '#89785a');
      if (i % 2 === 0) {
        const stone = mesh(parent, rockShape, stones[Math.floor(random() * stones.length)], plain);
        stone.position.set(x + Math.sign(x) * 0.07, 0.15 + range(-0.025, 0.04), z + Math.sign(z) * 0.08);
        stone.scale.set(range(0.22, 0.41), range(0.14, 0.25), range(0.22, 0.36));
        stone.rotation.set(range(-0.25, 0.25), range(0, Math.PI), range(-0.18, 0.18));
        const moss = mesh(parent, rockShape, '#7a9064', { ...plain, castShadow: false });
        moss.position.copy(stone.position).add(new THREE.Vector3(-0.015, stone.scale.y * 0.6, 0.02));
        moss.scale.set(stone.scale.x * 0.58, 0.018, stone.scale.z * 0.63);
      }
    }
    for (let i = 0; i < 56; i += 1) {
      const x = range(-pond.width * 0.34, pond.width * 0.34), z = range(-pond.depth * 0.33, pond.depth * 0.33);
      const rock = mesh(wetStones, rockShape, stones[i % stones.length], { ...plain, castShadow: false });
      rock.position.set(x, pond.bottomY + 0.035, z);
      rock.scale.set(range(0.045, 0.11), range(0.025, 0.07), range(0.05, 0.13));
      rock.rotation.y = range(0, 6.28);
    }
    if (pond.id === 'satoyama') {
      const waterRock = mesh(parent, rockShape, '#788477', plain);
      waterRock.position.set(2.9, pond.waterY - 0.08, -1.9);
      waterRock.scale.set(0.32, 0.28, 0.34);
      pond.waterObstacles.push({ x: 2.9, z: -1.9, radius: 0.34 });
    }
    for (let i = 0; i < 16; i += 1) {
      const side = i < 9 ? 1 : -1;
      const x = side * (pond.width / 2 - range(0.25, 0.6));
      const z = range(-pond.depth * 0.32, pond.depth * 0.3);
      for (let stem = 0; stem < 3; stem += 1) {
        const height = range(0.45, 0.95);
        const stemX = x + range(-0.11, 0.11), stemZ = z + range(-0.10, 0.1);
        rod(wetStones, [stemX, -0.15, stemZ], [stemX + side * 0.09, height, stemZ + 0.08], 0.009, '#8d966b');
        const head = cylinder(wetStones, stemX + side * 0.09, height - 0.10, stemZ + 0.08, 0.025, 0.18, '#99815f', 6);
        head.rotation.z = -side * 0.12;
        for (const direction of [-1, 1]) {
          const leaf = mesh(wetStones, new THREE.ConeGeometry(0.026, 0.4, 3), '#708d5d', { ...plain, castShadow: false });
          leaf.position.set(stemX + direction * 0.08, 0.27 + direction * 0.07, stemZ);
          leaf.rotation.z = direction * 0.49;
          leaf.scale.z = 0.14;
        }
      }
    }
  }

  function observationDeck(parent, pond) {
    const centerZ = pond.depth / 2 - 0.25;
    const deck = new THREE.Group();
    deck.name = '可步行的投喂木平台';
    parent.add(deck);
    for (let row = 0; row < 11; row += 1) box(deck, 0, 0.275, centerZ - 0.8 + row * 0.19, 2.5, 0.12, 0.177, row % 3 === 0 ? '#a9926b' : '#b69c73', plain);
    box(deck, 0, 0.12, centerZ + 1.39, 2.5, 0.15, 0.58, '#a5a187', plain);
    for (const x of [-1.08, 1.08]) {
      box(deck, x, 0.1, centerZ + 1.15, 0.42, 0.14, 0.55, '#a5a187', plain);
      for (const z of [centerZ - 0.72, centerZ + 0.6]) cylinder(deck, x, -0.32, z, 0.065, 1.12, '#746c53');
      for (const z of [centerZ - 0.82, centerZ + 0.85]) cylinder(deck, x, 0.61, z, 0.045, 0.82, '#887052');
      rail(deck, [x, centerZ - 0.85], [x, centerZ + 0.88], 1.00);
    }
    // 前方栏杆较低，视线可直接越过栏杆看到鱼与涟漪。
    rail(deck, [-1.08, centerZ - 0.85], [1.08, centerZ - 0.85], 0.83);
    box(deck, -1.08, 0.67, centerZ + 0.35, 0.24, 0.25, 0.34, '#75908b', plain);
    box(deck, -1.08, 0.82, centerZ + 0.35, 0.29, 0.035, 0.40, '#9cb0a2', plain);
    sign(deck, '鯉のえさ', -1.08, 0.69, centerZ + 0.525, 0.20, 0.12, { bg: '#e9debb', fg: '#5c6f58' });
    pond.feedPoint = new THREE.Vector3(0, pond.waterY, centerZ - 1.22);
    pond.deckEntry = [pond.x, 0.07, pond.z + centerZ + 1.85];
    pond.deckView = [pond.x, 0.335, pond.z + centerZ + 0.24];
    const interaction = { id: `feed-${pond.id}`, label: '撒一小把鱼食', position: new THREE.Vector3(pond.x, 0.95, pond.z + centerZ - 0.7), radius: 2.3, action(context) {
      if (pond.feedCooldown > 0) { context.toast?.('鱼儿正在吃，请稍等片刻'); return false; }
      feed(pond);
      context.toast?.('鱼食落入水中，鲤鱼循着涟漪游过来了');
      return true;
    } };
    interactions.push(interaction);
    return deck;
  }

  function board(parent, pond) {
    const x = 2.6, z = pond.depth / 2 + 1.45;
    for (const dx of [-0.58, 0.58]) cylinder(parent, x + dx, 0.68, z, 0.045, 1.3, '#837658');
    box(parent, x, 1.06, z, 1.42, 0.74, 0.065, '#9b8865', plain);
    sign(parent, `${pond.name}\n鯉を大切に・水には入らない`, x, 1.08, z + 0.038, 1.31, 0.62, { bg: '#eee7ce', fg: '#5b6f61', fontSize: 145 });
    box(parent, -2.5, 0.43, z, 1.82, 0.105, 0.43, '#a48b66', plain);
    for (const dx of [-0.63, 0.63]) box(parent, -2.5 + dx, 0.22, z, 0.095, 0.4, 0.38, '#796e57', plain);
    for (let slat = 0; slat < 3; slat += 1) box(parent, -2.5, 0.65 + slat * 0.15, z - 0.23, 1.8, 0.10, 0.05, '#9f8966', plain);
    interactions.push({ id: `info-${pond.id}`, label: '阅读鱼塘养护牌', position: new THREE.Vector3(pond.x + x, 1.16, pond.z + z + 0.15), radius: 2.3, action(context) {
      context.inspect?.(pond.name, '这里的水由缓坡土岸围住，深处有沉积泥沙与卵石。鲤鱼会用尾鳍推进、胸鳍调整姿态，靠近水面时留下尾流。请站在平台投喂一小把鱼食，留心鱼食入水的飞溅、浮起的颗粒与鱼群转弯时的涟漪。');
      return true;
    } });
  }

  function finGeometry(points) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    geometry.setIndex(points.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]);
    geometry.computeVertexNormals();
    return geometry;
  }

  const tailShape = finGeometry([[0, 0.009, 0], [0.018, 0.098, -0.145], [0.003, -0.006, -0.111], [0.015, -0.074, -0.15]]);
  const dorsalShape = finGeometry([[0, 0.047, 0.105], [0.008, 0.111, -0.042], [0, 0.047, -0.095]]);
  const pectoralShape = finGeometry([[0, 0, 0], [0.114, -0.012, -0.044], [0.097, -0.006, -0.116], [0.015, 0, -0.069]]);
  const finMaterials = new Map();
  const fishBodyGeometries = new Map();
  const fishBodyMaterial = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: mat('#ffffff').gradientMap });
  function finMat(color) {
    if (!finMaterials.has(color)) finMaterials.set(color, new THREE.MeshToonMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.86, depthWrite: false }));
    return finMaterials.get(color);
  }

  function makeFish(parent, index, pond) {
    const fish = new THREE.Group();
    fish.name = `${pond.name}・鲤鱼${index + 1}`;
    parent.add(fish);
    const palette = [['#eee8d2', '#d17a46', '#9d6c48'], ['#d69a59', '#574e45', '#bc8653'], ['#b7b3a3', '#777f6d', '#929983'], ['#eee7d5', '#cd7750', '#d39c68'], ['#899486', '#535f59', '#788879']][index % 5];
    const body = mesh(fish, sphere, palette[0], { castShadow: true });
    body.scale.set(0.069, 0.057, 0.187);
    const head = mesh(fish, sphere, palette[0], { castShadow: true });
    head.position.set(0, -0.003, 0.14);
    head.scale.set(0.055, 0.047, 0.071);
    const tailStem = new THREE.Group();
    tailStem.position.z = -0.163;
    fish.add(tailStem);
    const tail = new THREE.Mesh(tailShape, finMat(palette[2]));
    tailStem.add(tail);
    const dorsal = new THREE.Mesh(dorsalShape, finMat(palette[2]));
    fish.add(dorsal);
    const fins = [];
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(pectoralShape, finMat(palette[2]));
      fin.position.set(side * 0.052, -0.014, 0.063);
      fin.scale.x = side;
      fish.add(fin); fins.push(fin);
      const eye = mesh(fish, sphere, '#383e39', { castShadow: false });
      eye.position.set(side * 0.050, 0.017, 0.163);
      eye.scale.set(0.010, 0.010, 0.014);
      const glint = mesh(fish, sphere, '#d8ddc5', { castShadow: false });
      glint.position.set(side * 0.057, 0.0195, 0.166);
      glint.scale.set(0.003, 0.004, 0.004);
      line(fish, [[side * 0.045, -0.024, 0.179], [side * 0.058, -0.026, 0.19], [side * 0.065, -0.019, 0.207]], '#9f9a78');
    }
    const mouth = mesh(fish, new THREE.TorusGeometry(0.012, 0.0027, 5, 9), '#ab9a7b', { castShadow: false });
    mouth.position.set(0, -0.018, 0.203);
    mouth.scale.y = 0.61;
    // 躯干、斑纹与眼睛按顶点色合成一次提交，尾鳍和胸鳍仍独立运动。
    const pieces = fish.children.filter(item => item.isMesh && !item.material.transparent && item !== mouth);
    const bodyKey = index % 5;
    if (!fishBodyGeometries.has(bodyKey)) {
      const geometries = pieces.map(piece => {
        piece.updateMatrix();
        const geometry = piece.geometry.clone().applyMatrix4(piece.matrix);
        for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
        const positions = geometry.getAttribute('position');
        const count = positions.count;
        const colors = new Float32Array(count * 3);
        const color = piece.material.color;
        const patchColor = new THREE.Color(palette[1]);
        for (let i = 0; i < count; i += 1) {
          let painted = color;
          if (piece === body || piece === head) {
            const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
            // 锦鲤的花纹直接画在皮肤顶点上，不用凸起的球体冒充色斑。
            const uneven = Math.sin(z * 68 + x * 73) * 0.10;
            const patchA = ((x - 0.02) / 0.049) ** 2 + ((z - 0.097) / 0.043) ** 2;
            const patchB = ((x + 0.025) / 0.043) ** 2 + ((z + 0.005) / 0.061) ** 2;
            const patchC = ((x - 0.019) / 0.038) ** 2 + ((z + 0.108) / 0.043) ** 2;
            if (y > -0.019 && Math.min(patchA, patchB, patchC) < 1 + uneven) painted = patchColor;
          }
          colors[i * 3] = painted.r; colors[i * 3 + 1] = painted.g; colors[i * 3 + 2] = painted.b;
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        return geometry;
      });
      fishBodyGeometries.set(bodyKey, mergeGeometries(geometries));
      geometries.forEach(geometry => geometry.dispose());
    }
    pieces.forEach(piece => fish.remove(piece));
    const paintedBody = new THREE.Mesh(fishBodyGeometries.get(bodyKey), fishBodyMaterial);
    paintedBody.castShadow = true; paintedBody.receiveShadow = true;
    paintedBody.name = '鲤鱼的斑纹与立体眼睛';
    fish.add(paintedBody);
    const size = range(0.87, 1.46);
    fish.scale.setScalar(size);
    const angle = range(0, 6.28);
    const state = { mesh: fish, tail: tailStem, fins, mouth, size, x: range(-pond.width * 0.28, pond.width * 0.28), z: range(-pond.depth * 0.26, pond.depth * 0.26), y: pond.waterY - range(0.36, 0.82), vx: Math.sin(angle) * 0.2, vy: 0, vz: Math.cos(angle) * 0.2, phase: range(0, 6.28), speed: range(0.15, 0.34), wander: range(0, 6.28), wanderTime: range(0, 4), wakeTime: range(0.1, 0.7), consumed: 0, stroke: 0 };
    state.stroke = state.phase;
    fish.position.set(state.x, state.y, state.z);
    return state;
  }

  function signedBoundary(pond, x, z) {
    const qx = Math.abs(x) - (pond.width / 2 - pond.cornerRadius);
    const qz = Math.abs(z) - (pond.depth / 2 - pond.cornerRadius);
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - pond.cornerRadius;
  }

  function disturb(pond, x, z, strength, radius) {
    waterDriver?.disturb?.(pond.id, 0.5 + x / pond.width, 0.5 + z / pond.depth, strength, radius);
    pond.disturbanceCount += 1;
  }

  function sampleSurface(pond, x, z) {
    const u = THREE.MathUtils.clamp(0.5 + x / pond.width, 0, 1);
    const v = THREE.MathUtils.clamp(0.5 + z / pond.depth, 0, 1);
    const surface = waterDriver?.sampleSurface?.(pond.id, u, v);
    const height = surface?.height ?? waterDriver?.sampleHeight?.(pond.id, u, v) ?? 0;
    return {
      height: pond.waterY + (Number.isFinite(height) ? height : 0),
      slopeX: Number.isFinite(surface?.slopeX) ? surface.slopeX : 0,
      slopeZ: Number.isFinite(surface?.slopeZ) ? surface.slopeZ : 0,
    };
  }

  function feed(pond) {
    pond.feedTime = 17;
    pond.feedCooldown = 7;
    pond.feedRevision += 1;
    for (const pellet of pond.pellets) {
      pellet.alive = true;
      pellet.floating = false;
      pellet.age = 0;
      pellet.x = pond.feedPoint.x + range(-0.10, 0.10);
      pellet.z = pond.feedPoint.z + 0.50 + range(-0.10, 0.10);
      pellet.y = 1.17 + range(-0.08, 0.10);
      pellet.vx = range(-0.35, 0.35);
      pellet.vz = range(-0.72, -0.37);
      pellet.vy = range(0.36, 0.9);
      pellet.yaw = pellet.phase;
      pellet.mesh.rotation.set(0, pellet.yaw, 0);
      pellet.mesh.visible = true;
      pellet.mesh.position.set(pellet.x, pellet.y, pellet.z);
    }
    return true;
  }

  function updatePellets(pond, dt, wind) {
    for (const pellet of pond.pellets) {
      if (!pellet.alive) continue;
      pellet.age += dt;
      if (!pellet.floating) {
        // 恒重力的中点位移保留正确落体距离，细小食粒的空气阻力随相对风速增长。
        const dragX = (wind.x * 0.18 - pellet.vx) * 0.45;
        const dragZ = (wind.y * 0.18 - pellet.vz) * 0.45;
        const accelerationY = -9.81 - pellet.vy * Math.abs(pellet.vy) * 0.018;
        pellet.x += pellet.vx * dt + dragX * dt * dt * 0.5;
        pellet.y += pellet.vy * dt + accelerationY * dt * dt * 0.5;
        pellet.z += pellet.vz * dt + dragZ * dt * dt * 0.5;
        pellet.vx += dragX * dt; pellet.vy += accelerationY * dt; pellet.vz += dragZ * dt;
        const surface = sampleSurface(pond, pellet.x, pellet.z);
        if (pellet.y <= surface.height + pellet.radius * 0.4 && pellet.vy < 0) {
          pellet.floating = true;
          const impactSpeed = Math.abs(pellet.vy);
          // 落水先传递动量给波面；食粒仍有下沉速度，再由浮力缓缓托起。
          pellet.vx *= 0.32; pellet.vz *= 0.32; pellet.vy *= 0.24;
          disturb(pond, pellet.x, pellet.z, Math.min(0.032, impactSpeed * 0.006), 0.055);
        }
      } else {
        const surface = sampleSurface(pond, pellet.x, pellet.z);
        // 浮力与水阻形成近临界阻尼的弹簧，不把物体硬贴到每帧水位上。
        const buoyancy = (surface.height + 0.012 - pellet.y) * 110;
        const waterDrag = -pellet.vy * 21 - pellet.vy * Math.abs(pellet.vy) * 4;
        pellet.vy += THREE.MathUtils.clamp(buoyancy + waterDrag, -50, 50) * dt;
        pellet.y += pellet.vy * dt;
        pellet.vx += ((wind.x * 0.012 - pellet.vx) * 1.65 - surface.slopeX * 0.12) * dt;
        pellet.vz += ((wind.y * 0.012 - pellet.vz) * 1.65 - surface.slopeZ * 0.12) * dt;
        pellet.x += pellet.vx * dt; pellet.z += pellet.vz * dt;
        for (const fish of pond.fish) {
          if (fish.y > surface.height - 0.21 && pellet.y > surface.height - 0.065 && Math.hypot(fish.x - pellet.x, fish.z - pellet.z) < 0.21 * fish.size) {
            pellet.alive = false;
            fish.consumed += 1;
            pond.consumed += 1;
            disturb(pond, fish.x, fish.z, 0.014, 0.11);
            break;
          }
        }
      }
      if (pellet.age > 25) pellet.alive = false;
      pellet.mesh.visible = pellet.alive;
      pellet.mesh.position.set(pellet.x, pellet.y, pellet.z);
      pellet.yaw += dt * 0.8;
      if (pellet.floating) {
        const surface = sampleSurface(pond, pellet.x, pellet.z);
        surfaceNormal.set(-surface.slopeX, 1, -surface.slopeZ).normalize();
        floatRotation.setFromUnitVectors(up, surfaceNormal);
        spinRotation.setFromAxisAngle(up, pellet.yaw);
        floatRotation.multiply(spinRotation);
        pellet.mesh.quaternion.slerp(floatRotation, 1 - Math.exp(-dt * 8));
      } else pellet.mesh.rotation.set(pellet.age * 0.9, pellet.yaw, Math.sin(pellet.phase) * pellet.age * 0.6);
    }
  }

  function updateFish(pond, fish, dt, daylight) {
    fish.wanderTime -= dt;
    if (fish.wanderTime <= 0) { fish.wander += range(-0.68, 0.68); fish.wanderTime = range(2.4, 5.4); }
    let targetX = Math.sin(fish.wander + fish.phase) * pond.width * 0.29;
    let targetZ = Math.cos(fish.wander * 0.71 + fish.phase) * pond.depth * 0.26;
    const hungry = pond.feedTime > 0;
    let targetY = pond.waterY - 0.5 - (Math.sin(simulationTime * 0.11 + fish.phase) + 1) * 0.18;
    if (hungry) {
      let nearest = Infinity;
      for (const pellet of pond.pellets) {
        if (!pellet.alive || !pellet.floating) continue;
        const distance = Math.hypot(pellet.x - fish.x, pellet.z - fish.z);
        if (distance < nearest) { nearest = distance; targetX = pellet.x; targetZ = pellet.z; }
      }
      if (!Number.isFinite(nearest)) { targetX = pond.feedPoint.x + Math.sin(fish.phase + simulationTime * 0.25) * 0.42; targetZ = pond.feedPoint.z + Math.cos(fish.phase) * 0.35; }
      targetY = sampleSurface(pond, targetX, targetZ).height - 0.10 - Math.max(0, Math.hypot(targetX - fish.x, targetZ - fish.z) - 0.4) * 0.08;
    }
    let desiredX = targetX - fish.x, desiredZ = targetZ - fish.z;
    const distance = Math.hypot(desiredX, desiredZ);
    const speed = fish.speed * (hungry ? 1.5 : 0.66 + daylight * 0.34) * (hungry ? Math.min(1, distance / 0.4 + 0.15) : 1);
    desiredX = desiredX / Math.max(distance, 0.05) * speed;
    desiredZ = desiredZ / Math.max(distance, 0.05) * speed;
    for (const other of pond.fish) {
      if (other === fish) continue;
      const dx = fish.x - other.x, dz = fish.z - other.z;
      const separation = Math.hypot(dx, dz);
      if (separation > 0.015 && separation < 0.45) {
        const force = (0.45 - separation) * 0.62;
        desiredX += dx / separation * force; desiredZ += dz / separation * force;
      }
    }
    for (const obstacle of pond.waterObstacles) {
      const dx = fish.x - obstacle.x, dz = fish.z - obstacle.z;
      const separation = Math.hypot(dx, dz);
      if (separation > 0.005 && separation < obstacle.radius + 0.36) {
        const force = (obstacle.radius + 0.36 - separation) * 2.2;
        desiredX += dx / separation * force; desiredZ += dz / separation * force;
      }
    }
    const edge = signedBoundary(pond, fish.x, fish.z);
    if (edge > -0.65) {
      const gradientX = (signedBoundary(pond, fish.x + 0.02, fish.z) - signedBoundary(pond, fish.x - 0.02, fish.z)) / 0.04;
      const gradientZ = (signedBoundary(pond, fish.x, fish.z + 0.02) - signedBoundary(pond, fish.x, fish.z - 0.02)) / 0.04;
      const force = Math.max(0, (edge + 0.65) * 2.6);
      desiredX -= gradientX * force; desiredZ -= gradientZ * force;
    }
    // 有限加速度与有界转弯使鱼不会瞬移或突然掉头。
    const acceleration = hungry ? 0.42 : 0.26;
    const ax = desiredX - fish.vx, az = desiredZ - fish.vz;
    const magnitude = Math.hypot(ax, az), change = Math.min(magnitude, acceleration * dt);
    fish.vx += ax / Math.max(magnitude, 0.0001) * change;
    fish.vz += az / Math.max(magnitude, 0.0001) * change;
    fish.x += fish.vx * dt; fish.z += fish.vz * dt;
    targetY = THREE.MathUtils.clamp(targetY, pond.bottomY + 0.25, pond.waterY - 0.086);
    // 调深是鳍的缓慢推进与水阻平衡，速度连续，入食后也不会瞬移到水面。
    const desiredRise = THREE.MathUtils.clamp((targetY - fish.y) * 0.65, -0.18, 0.18);
    fish.vy += THREE.MathUtils.clamp((desiredRise - fish.vy) * 2.2, -0.24, 0.24) * dt;
    fish.y += fish.vy * dt;
    const velocity = Math.hypot(fish.vx, fish.vz);
    const desiredHeading = Math.atan2(fish.vx, fish.vz);
    let turn = THREE.MathUtils.euclideanModulo(desiredHeading - fish.mesh.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    turn = THREE.MathUtils.clamp(turn, -1.15 * dt, 1.15 * dt);
    fish.mesh.rotation.y += turn;
    fish.mesh.rotation.z += (THREE.MathUtils.clamp(-turn / Math.max(dt, 0.001) * 0.08, -0.12, 0.12) - fish.mesh.rotation.z) * Math.min(1, dt * 3);
    fish.mesh.position.set(fish.x, fish.y, fish.z);
    fish.stroke += dt * (5 + velocity * 12);
    const stroke = fish.stroke;
    fish.tail.rotation.y = Math.sin(stroke) * (0.16 + velocity * 0.53);
    fish.fins.forEach((fin, index) => { fin.rotation.z = Math.sin(stroke * 0.63 + index * Math.PI) * 0.22; });
    fish.mouth.scale.y = 0.60 + (hungry ? Math.sin(stroke * 0.8) * 0.13 : 0);
    fish.wakeTime -= dt;
    if (fish.wakeTime <= 0) {
      const depth = Math.max(0, sampleSurface(pond, fish.x, fish.z).height - fish.y);
      if (depth < 0.31 && velocity > 0.025) {
        const trailingX = fish.x - Math.sin(fish.mesh.rotation.y) * 0.2;
        const trailingZ = fish.z - Math.cos(fish.mesh.rotation.y) * 0.2;
        // 深水尾流被水体吸收，浅水尾流随推进速度的平方增大。
        const wakeStrength = (0.002 + velocity * velocity * 0.10) * Math.exp(-depth * 5.5);
        disturb(pond, trailingX, trailingZ, wakeStrength, 0.09 + fish.size * 0.025);
      }
      fish.wakeTime = hungry ? 0.35 : 0.7;
    }
  }

  for (const configuration of POND_LAYOUT) {
    const pond = { ...configuration, waterObstacles: [{ x: -1.08, z: configuration.depth / 2 - 0.97, radius: 0.09 }, { x: 1.08, z: configuration.depth / 2 - 0.97, radius: 0.09 }], feedTime: 0, feedCooldown: 0, feedRevision: 0, consumed: 0, disturbanceCount: 0, inletTime: 0, fish: [], pellets: [] };
    const root = new THREE.Group();
    root.position.set(pond.x, 0, pond.z);
    root.name = pond.name;
    group.add(root);
    pond.root = root;
    const edge = basin(root, pond);
    shore(root, pond, edge);
    observationDeck(root, pond);
    board(root, pond);
    const waterGroup = new THREE.Group();
    waterGroup.position.y = pond.waterY;
    waterGroup.name = `${pond.name}・流动水面`;
    waterGroup.userData.dynamic = true;
    waterGroup.userData.walkCollision = false;
    root.add(waterGroup);
    pond.waterGroup = waterGroup;
    const fishGroup = new THREE.Group();
    fishGroup.name = '会转弯和进食的立体鱼群';
    fishGroup.userData.dynamic = true;
    fishGroup.userData.walkCollision = false;
    root.add(fishGroup);
    pond.fishGroup = fishGroup;
    for (let i = 0; i < pond.fishCount; i += 1) pond.fish.push(makeFish(fishGroup, i, pond));
    const foodGroup = new THREE.Group();
    foodGroup.name = '受重力下落与漂浮的鱼食';
    foodGroup.userData.dynamic = true;
    foodGroup.userData.walkCollision = false;
    root.add(foodGroup);
    pond.foodGroup = foodGroup;
    for (let i = 0; i < 22; i += 1) {
      const item = mesh(foodGroup, pelletGeometry, i % 3 ? '#ba9157' : '#d5b978', { ...plain, castShadow: false });
      item.scale.setScalar(range(0.63, 1.16));
      item.visible = false;
      const pellet = { mesh: item, radius: 0.022 * item.scale.x, alive: false, floating: false, age: 0, phase: range(0, 6.28), yaw: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
      pond.pellets.push(pellet); pellets.push(pellet);
    }
    // 石质进水口有真实落差，少量持续入水激起局部扰动。
    const inletX = pond.width / 2 - 0.35, inletZ = -pond.depth * 0.22;
    pond.inlet = [inletX - 0.18, inletZ];
    box(root, inletX + 0.45, 0.19, inletZ, 0.82, 0.24, 0.55, '#92977e', plain);
    rod(root, [inletX + 0.47, 0.36, inletZ], [inletX - 0.12, 0.27, inletZ], 0.072, '#889a88');
    const opening = mesh(root, new THREE.CircleGeometry(0.057, 12), '#445e52', { castShadow: false });
    opening.rotation.y = -Math.PI / 2;
    opening.position.set(inletX - 0.17, 0.265, inletZ);
    const waterJet = mesh(fishGroup, new THREE.CylinderGeometry(0.019, 0.026, 0.15, 7), new THREE.MeshBasicMaterial({ color: '#b6cfba', transparent: true, opacity: 0.52, depthWrite: false }), { castShadow: false });
    waterJet.position.set(inletX - 0.2, 0.195, inletZ);
    waterJet.rotation.z = 0.25;
    pond.waterJet = waterJet;
    const valve = mesh(root, new THREE.TorusGeometry(0.078, 0.016, 6, 12), '#8e7461', plain);
    valve.position.set(inletX + 0.45, 0.44, inletZ);
    valve.rotation.x = Math.PI / 2;
    ponds.push(pond);
  }

  const westernPath = [[-8, 35], [-29, 35], [-29, 27.45]];
  const easternPath = [[0, 40.5], [31, 40.5]];
  const farmPath = [[23.6, 30.2], [24.7, 30.2], [24.7, 40.5], [31, 40.5]];
  const northernPath = [[-23, -24], [-29, -27], [-33, -32], [-33, -37.8]];
  path(westernPath, 1.65);
  path(easternPath, 1.75);
  path(farmPath, 1.45);
  path(northernPath, 1.55);
  path([[-4, 38], [-4, 40.5], [0, 40.5]], 1.75);
  const pondPaths = [westernPath, easternPath, northernPath];
  ponds.forEach((pond, index) => access.push({ id: pond.id, name: pond.name, path: pondPaths[index].map(([x, z]) => [x, 0.07, z]), entry: pond.deckEntry, view: pond.deckView, feed: [pond.x + pond.feedPoint.x, pond.waterY, pond.z + pond.feedPoint.z] }));

  // 北塘的小桥仅跨过一个角，桥面有护栏与连续可步行的台阶。
  const bridge = new THREE.Group();
  bridge.name = '跨越湧水池角落的窄木桥';
  bridge.position.set(-35.5, 0, -42.1);
  bridge.rotation.y = -Math.PI / 4;
  group.add(bridge);
  for (let row = 0; row < 24; row += 1) box(bridge, 0, 0.3025, -2.12 + row * 0.19, 1.15, 0.055, 0.179, row % 4 ? '#a8946c' : '#b39e74', plain);
  for (const z of [-2.56, 2.56]) box(bridge, 0, 0.12, z, 1.15, 0.15, 0.70, '#9f967a', plain);
  for (const x of [-0.56, 0.56]) {
    for (const z of [-2.1, 0, 2.1]) cylinder(bridge, x, 0.73, z, 0.045, 0.95, '#8c7656');
    rail(bridge, [x, -2.2], [x, 2.28], 1.1);
    rail(bridge, [x, -2.2], [x, 2.28], 0.75);
    box(bridge, x * 0.75, 0.235, 0, 0.11, 0.10, 4.70, '#807151', plain);
  }
  path([[-33, -37.8], [-36.8, -38.8], [-37.3, -40.0]], 1.35);
  path([[-33.85, -43.75], [-31.4, -44.7], [-29.0, -44.7], [-29.0, -37.6]], 1.3);
  group.userData.pondAccess = access;
  group.userData.interactions = interactions;
  group.userData.pondFootprints = POND_LAYOUT.map(pond => ({ ...pond }));
  group.userData.waterExclusions = POND_LAYOUT.map(pond => ({ ...pond }));
  group.userData.pondBridge = { entry: [-37.31, 0.195, -40.29], exit: [-33.69, 0.195, -43.91], height: 0.33 };

  function update(dt, environment = {}) {
    const elapsed = Math.max(0, Number.isFinite(dt) ? dt : 0);
    const accepted = Math.min(elapsed, 0.07);
    droppedTime += elapsed - accepted;
    accumulator += accepted;
    const wind = {
      x: Number.isFinite(environment.wind?.x) ? environment.wind.x : -0.35,
      y: Number.isFinite(environment.wind?.y) ? environment.wind.y : 0.16,
    };
    const daylight = THREE.MathUtils.clamp(Number.isFinite(environment.daylight) ? environment.daylight : 1, 0, 1);
    updateRevision += 1;
    // 显示帧只积累时长；鱼、落体与浮力共享固定小步，低帧率不会扩大积分误差。
    while (accumulator + 1e-10 >= fixedStep) {
      accumulator = Math.max(0, accumulator - fixedStep);
      simulationTime += fixedStep;
      physicalSteps += 1;
      for (const pond of ponds) {
        pond.feedTime = Math.max(0, pond.feedTime - fixedStep);
        pond.feedCooldown = Math.max(0, pond.feedCooldown - fixedStep);
        updatePellets(pond, fixedStep, wind);
        for (const fish of pond.fish) updateFish(pond, fish, fixedStep, daylight);
        pond.inletTime -= fixedStep;
        if (pond.inletTime <= 0) { disturb(pond, ...pond.inlet, 0.009, 0.105); pond.inletTime += 0.18; }
        pond.waterJet.scale.x = 0.94 + Math.sin(simulationTime * 7) * 0.055;
        pond.waterJet.scale.z = 0.97 + Math.cos(simulationTime * 5) * 0.035;
      }
    }
  }

  return { group, ponds, update, setWaterDriver(driver) { waterDriver = driver; }, feed(id) { const pond = ponds.find(item => item.id === id); return pond ? feed(pond) : false; },
    get snapshot() { return { time: simulationTime, revision: updateRevision, physicalSteps, accumulator, droppedTime, fishCount: ponds.reduce((sum, pond) => sum + pond.fish.length, 0), activePellets: pellets.filter(pellet => pellet.alive).length, ponds: ponds.map(pond => ({ id: pond.id, fishCount: pond.fish.length, feedTime: pond.feedTime, feedRevision: pond.feedRevision, consumed: pond.consumed, disturbances: pond.disturbanceCount, fish: pond.fish.map(fish => ({ x: fish.x + pond.x, y: fish.y, z: fish.z + pond.z, speed: Math.hypot(fish.vx, fish.vz), heading: fish.mesh.rotation.y, boundaryDistance: signedBoundary(pond, fish.x, fish.z), consumed: fish.consumed })) })) }; },
  };
}
