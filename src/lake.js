import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pondDistance } from './pond-shape.js';

// 湖、地面开孔、潜水边界与水波共享以米为单位的岸线。
export const LAKE_LAYOUT = [
  { id: 'sakurami', name: '桜見湖', x: 100, z: -4, width: 68, depth: 54, cornerRadius: 24, waterY: 0.12, bottomY: -9.5, fishCount: 32 },
];

export function createLake(kit) {
  const { THREE, mesh, box, cylinder, sign, mat } = kit;
  const group = new THREE.Group();
  group.name = '桜見湖・可潜入的湖岸与水下世界';
  const root = new THREE.Group();
  const pond = { ...LAKE_LAYOUT[0], root, waterObstacles: [], fish: [] };
  root.position.set(pond.x, 0, pond.z);
  root.name = pond.name;
  group.add(root);
  const localShape = { ...pond, x: 0, z: 0 };
  const plain = { outline: false };
  const noShadow = { outline: false, castShadow: false };
  let seed = 793817;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const range = (a, b) => a + random() * (b - a);
  const clamp = THREE.MathUtils.clamp;
  const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  let waterDriver = null;
  let elapsed = 0;
  let accumulator = 0;
  let physicalSteps = 0;
  let disturbanceCount = 0;
  const fixedStep = 1 / 90;

  function localBottom(x, z) {
    const inward = Math.max(0, -pondDistance(x, z, localShape));
    const deep = smooth(inward / 15.5);
    // 岸边连续变浅，中央的低频泥沙起伏不会形成悬浮地板。
    const sediment = Math.sin(x * 0.18) * Math.sin(z * 0.15 + 0.4) * 0.22 * deep;
    return Math.max(pond.bottomY, 0.052 + (pond.bottomY - 0.052) * deep + sediment);
  }
  pond.bottomAt = (worldX, worldZ) => localBottom(worldX - pond.x, worldZ - pond.z);
  pond.localBottomAt = localBottom;

  function rod(parent, a, b, radius, color, collision = true) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const item = cylinder(parent, 0, 0, 0, radius, direction.length(), color, 8);
    item.position.copy(start.add(end).multiplyScalar(0.5));
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    if (!collision) item.userData.walkCollision = false;
    return item;
  }

  function edgePoint(angle) {
    const dx = Math.cos(angle), dz = Math.sin(angle);
    let lo = 0, hi = 46;
    for (let i = 0; i < 32; i += 1) {
      const mid = (lo + hi) / 2;
      if (pondDistance(dx * mid, dz * mid, localShape) > 0) hi = mid;
      else lo = mid;
    }
    return [dx * lo, dz * lo];
  }

  const edge = Array.from({ length: 192 }, (_, i) => edgePoint(i / 192 * Math.PI * 2));
  const floorPositions = [0, localBottom(0, 0), 0], floorColors = [];
  const floorIndices = [];
  const vertexColor = new THREE.Color();
  function terrainColor(x, y, z) {
    const inward = Math.max(0, -pondDistance(x, z, localShape));
    vertexColor.set('#bcaf85').lerp(new THREE.Color('#6f8374'), smooth(inward / 17));
    vertexColor.multiplyScalar(1 + Math.sin(x * 0.25 + z * 0.13) * 0.035);
    floorColors.push(vertexColor.r, vertexColor.g, vertexColor.b);
  }
  terrainColor(0, localBottom(0, 0), 0);
  const ringCount = 44;
  for (let ring = 1; ring <= ringCount; ring += 1) {
    const scale = ring / ringCount;
    for (const [ex, ez] of edge) {
      const x = ex * scale, z = ez * scale, y = localBottom(x, z);
      floorPositions.push(x, y, z);
      terrainColor(x, y, z);
    }
    for (let i = 0; i < edge.length; i += 1) {
      const next = (i + 1) % edge.length;
      const current = 1 + (ring - 1) * edge.length + i;
      const following = 1 + (ring - 1) * edge.length + next;
      if (ring === 1) floorIndices.push(0, following, current);
      else {
        const inner = current - edge.length, innerNext = following - edge.length;
        floorIndices.push(inner, following, current, inner, innerNext, following);
      }
    }
  }
  const floorGeometry = new THREE.BufferGeometry();
  floorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(floorPositions, 3));
  floorGeometry.setAttribute('color', new THREE.Float32BufferAttribute(floorColors, 3));
  floorGeometry.setIndex(floorIndices);
  floorGeometry.computeVertexNormals();
  const floorMaterial = mat('#ffffff').clone();
  floorMaterial.vertexColors = true;
  floorMaterial.side = THREE.DoubleSide;
  const floor = mesh(root, floorGeometry, floorMaterial, noShadow);
  floor.name = '从砂砾浅滩连续下沉至九米半的真实湖底';
  floor.userData.walkCollision = false;
  floor.userData.waterCaustics = true;
  // 独立材质保持顶点色，静态合并器没有同材质的第二块网格。

  const pathPositions = [], pathIndices = [];
  edge.forEach(([x, z], i) => {
    const length = Math.hypot(x, z), dx = x / length, dz = z / length;
    pathPositions.push(x + dx * 1.25, 0.032, z + dz * 1.25, x + dx * 3.05, 0.032, z + dz * 3.05);
    const a = i * 2, b = ((i + 1) % edge.length) * 2;
    pathIndices.push(a, b, a + 1, a + 1, b, b + 1);
  });
  const pathGeometry = new THREE.BufferGeometry();
  pathGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pathPositions, 3));
  pathGeometry.setIndex(pathIndices);
  pathGeometry.computeVertexNormals();
  const lakesidePath = mesh(root, pathGeometry, '#c1b697', noShadow);
  lakesidePath.name = '可以环湖散步的砂土小径';
  lakesidePath.userData.walkCollision = false;

  function path(points, width = 2.1) {
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1], b = points[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const slab = box(group, (a[0] + b[0]) / 2, 0.014, (a[1] + b[1]) / 2, width, 0.08, length + width * 0.3, '#c2b697', noShadow);
      slab.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
      slab.userData.walkCollision = false;
    }
  }
  path([[27, 3], [35, 8], [43, 8], [pond.x - 43, 8], [pond.x - 36, 6], [pond.x - 33.4, 4]]);
  path([[pond.x - 43, 8], [pond.x - 37.5, 8], [pond.x - 35.7, 8]], 2.4);

  // 西岸浅滩不设栏杆，沙坡与水下缓坡直接衔接。
  const beach = mesh(root, new THREE.CircleGeometry(3.4, 40), '#d0bd92', noShadow);
  beach.rotation.x = -Math.PI / 2;
  beach.scale.set(0.72, 1.2, 1);
  beach.position.set(-36.9, 0.024, 6);
  beach.userData.walkCollision = false;
  beach.name = '没有护栏的天然入水浅滩';

  const dock = new THREE.Group();
  dock.name = '有支撑与潜水梯的木栈桥';
  root.add(dock);
  const dockStart = -35.5, dockEnd = -25;
  for (let i = 0; i < 27; i += 1) {
    const x = dockStart + (i + 0.5) * (dockEnd - dockStart) / 27;
    box(dock, x, 0.36, 12, (dockEnd - dockStart) / 27 - 0.012, 0.16, 2.4, i % 5 ? '#a28b66' : '#b39b72', plain);
    if (i % 3 === 0) {
      for (const z of [10.94, 13.06]) {
        const nail = mesh(dock, new THREE.CircleGeometry(0.023, 6), '#6e746a', noShadow);
        nail.rotation.x = -Math.PI / 2;
        nail.position.set(x, 0.442, z);
        nail.userData.walkCollision = false;
      }
    }
  }
  for (const [x, top] of [[-36.05, 0.18], [-35.73, 0.31]]) box(dock, x, top - 0.05, 12, 0.38, 0.1, 2.4, '#a7987b', plain);
  for (const z of [11.18, 12.82]) box(dock, -30.25, 0.21, z, 11.05, 0.18, 0.15, '#75664d', plain);
  for (const x of [-33.4, -29.4, -25.65]) {
    for (const z of [10.97, 13.03]) {
      const bottom = localBottom(x, z) - 0.12;
      rod(dock, [x, bottom, z], [x, 0.42, z], 0.105, '#776f57');
      // 支柱只对自己的圆形截面排水，不把整段码头当成水坝。
      if (pondDistance(x, z, localShape) < 0) pond.waterObstacles.push({ x, z, radius: 0.105 });
    }
  }
  for (const z of [10.76, 13.24]) {
    for (const x of [-34.8, -31.8, -28.8]) rod(dock, [x, 0.4, z], [x, 1.28, z], 0.045, '#8f7957');
    rod(dock, [-34.8, 1.22, z], [-27.2, 1.22, z], 0.039, '#927c59');
  }
  for (const x of [-26.35, -25.75]) rod(dock, [x, -1.55, 13.5], [x, 0.99, 13.5], 0.032, '#8c9d96', false);
  for (let y = -1.35; y < 0.45; y += 0.3) rod(dock, [-26.35, y, 13.5], [-25.75, y, 13.5], 0.026, '#b6c0aa', false);
  const lifering = mesh(dock, new THREE.TorusGeometry(0.24, 0.066, 10, 28), '#c37457', plain);
  lifering.position.set(-31.6, 0.93, 13.29);
  lifering.userData.walkCollision = false;
  rod(dock, [-31.65, 1.19, 13.34], [-31.7, 0.63, 13.34], 0.012, '#d2c9a8', false);

  const shoreBoard = new THREE.Group();
  shoreBoard.position.set(-36.9, 0, 2.7);
  root.add(shoreBoard);
  for (const x of [-0.65, 0.65]) cylinder(shoreBoard, x, 0.81, 0, 0.07, 1.61, '#76664f');
  box(shoreBoard, 0, 1.25, 0, 1.86, 0.87, 0.09, '#6e765e', plain);
  sign(shoreBoard, '桜見湖\nSAKURAMI LAKE', 0, 1.3, 0.052, 1.7, 0.52, { bg: '#e7dfbb', fg: '#425c52', fontSize: 170 });
  sign(shoreBoard, '静かな水辺を、ゆっくり。', 0, 0.98, 0.052, 1.64, 0.16, { bg: '#e7dfbb', fg: '#66715a', fontSize: 80 });

  const underwater = new THREE.Group();
  underwater.name = '潜水可发现的石林、水草与沉船';
  underwater.userData.walkCollision = false;
  root.add(underwater);
  const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
  const rockMaterials = ['#929d82', '#798b78', '#a6a58a', '#647b71'].map(color => mat(color));
  const rockCounts = [45, 45, 45, 45];
  const transform = new THREE.Object3D();
  const rockRecords = [];
  for (let color = 0; color < 4; color += 1) {
    const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterials[color], rockCounts[color]);
    rocks.castShadow = false;
    rocks.receiveShadow = true;
    rocks.userData.waterCaustics = true;
    rocks.userData.walkCollision = false;
    underwater.add(rocks);
    for (let i = 0; i < rockCounts[color]; i += 1) {
      let x, z;
      do { x = range(-32, 32); z = range(-25, 25); } while (pondDistance(x, z, localShape) > -0.45);
      const large = i < 6;
      const sx = large ? range(0.6, 1.35) : range(0.12, 0.44);
      const sy = large ? range(0.55, 1.9) : range(0.065, 0.24);
      const sz = large ? range(0.45, 0.94) : range(0.14, 0.44);
      const bottom = localBottom(x, z);
      transform.position.set(x, bottom + sy * 0.46, z);
      transform.scale.set(sx, sy, sz);
      transform.rotation.set(range(-0.15, 0.15), range(0, Math.PI * 2), range(-0.2, 0.2));
      transform.updateMatrix(); rocks.setMatrixAt(i, transform.matrix);
      rockRecords.push({ x, z, bottom, height: sy });
    }
    rocks.instanceMatrix.needsUpdate = true;
  }

  const leafPositions = [0,0,0, -.14,.4,.01, -.1,.79,.025, 0,0,0, -.1,.79,.025, .025,.47,-.02];
  const grassGeometry = new THREE.BufferGeometry();
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leafPositions, 3));
  grassGeometry.computeVertexNormals();
  const grassMaterial = mat('#719873').clone();
  grassMaterial.side = THREE.DoubleSide;
  const grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, 600);
  grass.castShadow = false;
  grass.receiveShadow = true;
  grass.userData.waterCaustics = true;
  grass.userData.walkCollision = false;
  grass.name = '扎根湖底的疏密水草带';
  underwater.add(grass);
  for (let i = 0; i < 600; i += 1) {
    const cluster = Math.floor(i / 100);
    const centers = [[-21, -2], [-15, 15], [10, 15], [24, 0], [-6, -17], [4, 4]];
    const [cx, cz] = centers[cluster];
    let x = cx + range(-3.7, 3.7), z = cz + range(-3.2, 3.2);
    while (pondDistance(x, z, localShape) > -0.8) { x *= 0.97; z *= 0.97; }
    transform.position.set(x, localBottom(x, z) + 0.02, z);
    transform.rotation.set(0, range(0, Math.PI * 2), range(-0.06, 0.06));
    transform.scale.set(range(0.55, 1.35), range(0.4, 1.35), 1);
    transform.updateMatrix(); grass.setMatrixAt(i, transform.matrix);
  }
  grass.instanceMatrix.needsUpdate = true;

  const wreck = new THREE.Group();
  wreck.name = '沉在中央湖床的小木船';
  wreck.position.set(3, localBottom(3, -5) + 0.1, -5);
  wreck.rotation.set(0.08, -0.46, 0.09);
  underwater.add(wreck);
  for (const x of [-0.69, -0.47, -0.23, 0, 0.23, 0.47, 0.69]) {
    const plank = box(wreck, x, 0.17 + Math.abs(x) * 0.25, 0, 0.22, 0.08, 3.6 - Math.abs(x) * 1.1, '#667267', noShadow);
    plank.rotation.z = x * 0.43;
    plank.userData.waterCaustics = true;
  }
  for (const z of [-1.25, -0.62, 0, 0.62, 1.25]) {
    rod(wreck, [-0.77, 0.31, z], [-0.64, 0.72, z], 0.045, '#7f816c', false).userData.waterCaustics = true;
    rod(wreck, [0.77, 0.31, z], [0.64, 0.63, z], 0.045, '#7f816c', false).userData.waterCaustics = true;
  }
  const brokenOar = rod(wreck, [-1.5, 0.09, 0.8], [-0.3, 0.12, 2.45], 0.037, '#8b8870', false);
  brokenOar.userData.waterCaustics = true;
  const trunk = rod(underwater, [-11, localBottom(-11, 6) + 0.22, 6], [-4, localBottom(-4, 7) + 0.25, 7], 0.28, '#738275', false);
  trunk.userData.waterCaustics = true;
  for (let i = 0; i < 3; i += 1) rod(underwater, [-9 + i * 1.5, localBottom(-9 + i * 1.5, 6.4) + 0.35, 6.4], [-8.4 + i * 1.5, localBottom(-8.4 + i * 1.5, 7.6) + 0.54, 7.6], 0.07, '#718274', false).userData.waterCaustics = true;

  // 岸上的草、芦苇和树群保持疏密层次，留出西岸入口与环湖通路。
  const reeds = new THREE.Group();
  reeds.name = '避开入口的岸边芦苇';
  reeds.userData.walkCollision = false;
  root.add(reeds);
  for (let i = 0; i < 74; i += 1) {
    const angle = range(-Math.PI * 0.4, Math.PI * 0.55);
    const [ex, ez] = edgePoint(angle);
    const scale = range(0.969, 0.988);
    const x = ex * scale, z = ez * scale, base = Math.max(-0.34, localBottom(x, z));
    for (let j = 0; j < 3; j += 1) {
      const sx = x + range(-0.18, 0.18), sz = z + range(-0.18, 0.18), height = range(0.68, 1.48);
      rod(reeds, [sx, base, sz], [sx + 0.13, base + height, sz - 0.06], 0.013, '#879069', false);
      const head = mesh(reeds, new THREE.CapsuleGeometry(0.037, 0.18, 3, 5), '#9b9270', noShadow);
      head.position.set(sx + 0.13, base + height - 0.05, sz - 0.06);
      head.rotation.z = -0.09;
    }
  }

  const flowerGeometry = new THREE.IcosahedronGeometry(0.17, 0);
  const leafyGeometry = new THREE.IcosahedronGeometry(1, 1);
  function tree(x, z, cherry = false) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, 0, z);
    root.add(treeGroup);
    const height = range(3.6, 5.3);
    rod(treeGroup, [0, 0, 0], [0.1, height * 0.69, 0], 0.14, '#77614e');
    for (const side of [-1, 1]) rod(treeGroup, [0.02, height * 0.42, 0], [side * 0.87, height * 0.76, side * 0.27], 0.08, '#77614e');
    if (cherry) {
      const blossoms = new THREE.InstancedMesh(flowerGeometry, mat('#ecc7cb'), 240);
      blossoms.castShadow = true;
      blossoms.receiveShadow = true;
      blossoms.userData.walkCollision = false;
      treeGroup.add(blossoms);
      for (let i = 0; i < 240; i += 1) {
        const theta = range(0, Math.PI * 2), radius = Math.sqrt(random()) * 1.72;
        transform.position.set(Math.cos(theta) * radius, height * 0.76 + range(-0.6, 0.6) + (1 - radius / 1.72) * 0.5, Math.sin(theta) * radius);
        transform.scale.set(range(0.75, 1.28), range(0.48, 0.84), range(0.8, 1.28));
        transform.rotation.set(range(0, 3), range(0, 3), range(0, 3));
        transform.updateMatrix(); blossoms.setMatrixAt(i, transform.matrix);
      }
    } else {
      for (let i = 0; i < 4; i += 1) {
        const foliage = mesh(treeGroup, leafyGeometry, i % 2 ? '#7b966c' : '#8da477', plain);
        foliage.position.set((i % 2 - 0.5) * 1.22, height * 0.76 + (i > 1 ? 0.58 : 0), (i > 1 ? -0.38 : 0.38));
        foliage.scale.set(1.26, 0.91, 1.12);
        foliage.userData.walkCollision = false;
      }
    }
  }
  for (const [x, z, cherry] of [[-26,24,true],[-15,30,false],[3,32,true],[24,26,false],[37,10,false],[37,-10,false],[25,-26,true],[3,-32,false],[-19,-30,false],[-34,-15,true]]) tree(x, z, cherry);
  for (const [x, z] of [[-25, 26], [5, 30]]) {
    const bench = new THREE.Group(); bench.position.set(x, 0, z); root.add(bench);
    for (const sx of [-0.76, 0.76]) box(bench, sx, 0.26, 0, 0.12, 0.52, 0.66, '#6e7e70', plain);
    for (const sz of [-0.22, 0, 0.22]) box(bench, 0, 0.47, sz, 2.05, 0.065, 0.2, '#a9946f', plain);
    box(bench, 0, 0.86, -0.31, 2.05, 0.28, 0.075, '#a9946f', plain);
  }

  const waterGroup = new THREE.Group();
  waterGroup.position.y = pond.waterY;
  waterGroup.userData.dynamic = true;
  waterGroup.userData.walkCollision = false;
  waterGroup.name = '桜見湖・可传播的湖面';
  root.add(waterGroup); pond.waterGroup = waterGroup;
  const fishGroup = new THREE.Group();
  fishGroup.userData.dynamic = true;
  fishGroup.userData.walkCollision = false;
  fishGroup.name = '在不同深度巡游的三十二尾湖鱼';
  root.add(fishGroup); pond.fishGroup = fishGroup;

  function bakedPart(geometry, color) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const colors = new Float32Array(g.getAttribute('position').count * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.deleteAttribute('uv');
    return g;
  }
  const fishParts = [];
  const fishBody = new THREE.SphereGeometry(1, 12, 8); fishBody.scale(0.26, 0.086, 0.093);
  fishParts.push(bakedPart(fishBody, '#b5c5af'));
  const fishBelly = new THREE.SphereGeometry(1, 10, 6); fishBelly.scale(0.20, 0.026, 0.071); fishBelly.translate(0.012, -0.066, 0);
  fishParts.push(bakedPart(fishBelly, '#e4ddbb'));
  const fishStripe = new THREE.SphereGeometry(1, 10, 6); fishStripe.scale(0.17, 0.012, 0.065); fishStripe.translate(-0.025, 0.075, 0);
  fishParts.push(bakedPart(fishStripe, '#778d7b'));
  const bodyGeometry = mergeGeometries(fishParts, false);
  const bodyMaterial = mat('#ffffff').clone(); bodyMaterial.vertexColors = true;
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, pond.fishCount);
  bodies.castShadow = false; bodies.receiveShadow = true; fishGroup.add(bodies);
  const tailGeometry = new THREE.BufferGeometry();
  tailGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,-.16,.11,0,-.11,0,0,0,0,0,-.11,0,0,-.16,-.11,0], 3));
  tailGeometry.computeVertexNormals();
  const tailMaterial = mat('#909f80').clone(); tailMaterial.side = THREE.DoubleSide;
  const tails = new THREE.InstancedMesh(tailGeometry, tailMaterial, pond.fishCount);
  tails.castShadow = false; tails.receiveShadow = true; fishGroup.add(tails);
  const eyes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.013, 6, 4), mat('#3d5651'), pond.fishCount * 2);
  eyes.castShadow = false; fishGroup.add(eyes);
  const fishColor = new THREE.Color();
  for (let i = 0; i < pond.fishCount; i += 1) {
    const school = i % 4;
    const center = [[-16,-5],[8,12],[15,-11],[-2,1]][school];
    const x = center[0] + range(-2.4, 2.4), z = center[1] + range(-2.1, 2.1);
    const y = Math.max(localBottom(x, z) + 0.55, [-2.2,-4.8,-3.5,-7.1][school] + range(-0.4, 0.4));
    const heading = range(0, Math.PI * 2);
    pond.fish.push({ x, y, z, vx: Math.cos(heading) * 0.42, vy: 0, vz: Math.sin(heading) * 0.42, school, phase: range(0, Math.PI * 2), size: range(0.65, 1.42), wakeTime: range(0, 0.5) });
    fishColor.set(i % 8 === 0 ? '#d2a478' : i % 5 === 0 ? '#b4c4bc' : '#c8d1be');
    bodies.setColorAt(i, fishColor); tails.setColorAt(i, fishColor);
  }

  const direction = new THREE.Vector3();
  const fishQuaternion = new THREE.Quaternion();
  const fishTransform = new THREE.Matrix4();
  const tailRotation = new THREE.Quaternion();
  const fishScale = new THREE.Vector3();
  const fishPoint = new THREE.Vector3();
  const tailPoint = new THREE.Vector3();
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisX = new THREE.Vector3(1, 0, 0);
  function drawFish() {
    pond.fish.forEach((fish, i) => {
      direction.set(fish.vx, fish.vy, fish.vz).normalize();
      fishQuaternion.setFromUnitVectors(axisX, direction);
      fishPoint.set(fish.x, fish.y, fish.z); fishScale.setScalar(fish.size);
      fishTransform.compose(fishPoint, fishQuaternion, fishScale); bodies.setMatrixAt(i, fishTransform);
      tailPoint.set(-0.245 * fish.size, 0, 0).applyQuaternion(fishQuaternion).add(fishPoint);
      tailRotation.setFromAxisAngle(axisY, Math.sin(elapsed * (6 + Math.hypot(fish.vx, fish.vz) * 4) + fish.phase) * 0.48);
      tailRotation.premultiply(fishQuaternion);
      fishTransform.compose(tailPoint, tailRotation, fishScale); tails.setMatrixAt(i, fishTransform);
      for (const side of [-1, 1]) {
        transform.position.set(0.17 * fish.size, 0.019 * fish.size, side * 0.076 * fish.size).applyQuaternion(fishQuaternion).add(fishPoint);
        transform.scale.setScalar(fish.size); transform.quaternion.copy(fishQuaternion); transform.updateMatrix();
        eyes.setMatrixAt(i * 2 + (side === 1 ? 1 : 0), transform.matrix);
      }
    });
    bodies.instanceMatrix.needsUpdate = true; tails.instanceMatrix.needsUpdate = true; eyes.instanceMatrix.needsUpdate = true;
  }
  function integrateFish(step) {
    for (const fish of pond.fish) {
      const center = [[-16,-5],[8,12],[15,-11],[-2,1]][fish.school];
      const angle = elapsed * 0.075 + fish.phase * 0.12 + fish.school * 1.3;
      const targetX = center[0] + Math.cos(angle) * 4.2, targetZ = center[1] + Math.sin(angle) * 3.0;
      let dx = targetX - fish.x, dz = targetZ - fish.z;
      const dist = Math.hypot(dx, dz);
      dx /= Math.max(dist, 0.1); dz /= Math.max(dist, 0.1);
      for (const other of pond.fish) {
        if (other === fish) continue;
        const ox = fish.x - other.x, oz = fish.z - other.z, oy = fish.y - other.y;
        const near = ox * ox + oz * oz + oy * oy;
        if (near < 0.3 && near > 0.001) { dx += ox / near * 0.13; dz += oz / near * 0.13; }
      }
      const boundary = pondDistance(fish.x, fish.z, localShape);
      if (boundary > -3) { dx -= fish.x * 0.09; dz -= fish.z * 0.09; }
      for (const obstacle of pond.waterObstacles) {
        const ox = fish.x - obstacle.x, oz = fish.z - obstacle.z;
        const near = ox * ox + oz * oz;
        if (near < 0.8) { dx += ox / Math.max(near, 0.01) * 0.2; dz += oz / Math.max(near, 0.01) * 0.2; }
      }
      const desiredSpeed = 0.38 + fish.size * 0.17;
      const desiredLength = Math.hypot(dx, dz);
      const blend = 1 - Math.exp(-step * 1.15);
      fish.vx += (dx / Math.max(desiredLength, 0.1) * desiredSpeed - fish.vx) * blend;
      fish.vz += (dz / Math.max(desiredLength, 0.1) * desiredSpeed - fish.vz) * blend;
      const targetY = Math.max(localBottom(fish.x, fish.z) + 0.62, [-2.2,-4.8,-3.5,-7.1][fish.school] + Math.sin(elapsed * 0.31 + fish.phase) * 0.32);
      fish.vy += (clamp((targetY - fish.y) * 0.65, -0.18, 0.18) - fish.vy) * blend;
      fish.x += fish.vx * step; fish.z += fish.vz * step; fish.y += fish.vy * step;
      fish.y = clamp(fish.y, localBottom(fish.x, fish.z) + 0.35, pond.waterY - 0.28);
      fish.wakeTime -= step;
      if (fish.y > pond.waterY - 0.5 && fish.wakeTime <= 0 && waterDriver) {
        waterDriver.disturb(pond.id, fish.x / pond.width + 0.5, fish.z / pond.depth + 0.5, 0.001, 0.14);
        disturbanceCount += 1; fish.wakeTime = 0.32;
      }
    }
  }
  drawFish();

  const fishingSpots = [
    { id: 'sakurami-west', name: '桜見湖・木桟橋', position: [pond.x - 25.8, 0.44, 8], castTarget: [pond.x - 19, pond.waterY, 8] },
    { id: 'sakurami-shore', name: '桜見湖・浅瀬', position: [pond.x - 34.3, 0.07, -1], castTarget: [pond.x - 25, pond.waterY, -1] },
  ];
  const entry = [pond.x - 32.4, 0.08, 2];
  const view = { position: [pond.x - 28, 13, 32], target: [pond.x, -1.2, pond.z] };
  group.userData.walkBounds = { minX: -46, maxX: 148, minZ: -56, maxZ: 48 };
  group.userData.waterExclusions = [{ ...LAKE_LAYOUT[0] }];
  group.userData.pondFootprints = [{ ...LAKE_LAYOUT[0] }];
  group.userData.pondAccess = [{ id: pond.id, name: pond.name, path: [[27, 0.07, 3], [35, 0.07, 8], [43, 0.07, 8], entry], entry, view }];
  group.userData.lakeEntry = entry;
  group.userData.fishingSpots = fishingSpots;
  group.userData.underwaterLandmarks = [
    { id: 'sakurami-wreck', name: '湖床の木舟', position: [pond.x + 3, localBottom(3, -5), pond.z - 5] },
    { id: 'sakurami-log', name: '沈んだ古木', position: [pond.x - 8, localBottom(-8, 6), pond.z + 6] },
  ];

  function update(dt) {
    accumulator += clamp(Number.isFinite(dt) ? dt : 0, 0, 0.07);
    while (accumulator + 1e-10 >= fixedStep) {
      accumulator = Math.max(0, accumulator - fixedStep); elapsed += fixedStep; physicalSteps += 1;
      integrateFish(fixedStep);
    }
    drawFish();
  }
  return {
    group, ponds: [pond], fishingSpots, entry, view, update,
    setWaterDriver(driver) { waterDriver = driver; },
    get snapshot() {
      return { id: pond.id, fishCount: pond.fish.length, time: elapsed, physicalSteps, accumulator, disturbances: disturbanceCount,
        centralDepth: pond.waterY - localBottom(0, 0), entry, fishingSpots,
        landmarks: group.userData.underwaterLandmarks,
        fish: pond.fish.map(fish => ({ x: fish.x + pond.x, y: fish.y, z: fish.z + pond.z, speed: Math.hypot(fish.vx, fish.vy, fish.vz), bottom: localBottom(fish.x, fish.z), boundaryDistance: pondDistance(fish.x, fish.z, localShape) })),
        rockCount: rockRecords.length, grassLeaves: 600 };
    },
  };
}
