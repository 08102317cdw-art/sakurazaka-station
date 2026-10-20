import { pondDistance } from './pond-shape.js';

// 从合并前的真实几何生成步行碰撞：墙体按单件 OBB 收集，门洞保持镂空。
export function createWalkWorld(THREE, roots, movingRoots = []) {
  const radius = 0.19;
  const height = 1.68;
  const stepHeight = 0.26;
  const baseGround = 0.07;
  const cellSize = 2;
  const maxGround = 32;
  const epsilon = 0.018;
  const bounds = { minX: -46, maxX: 148, minZ: -58, maxZ: 58 };
  const waterExclusions = roots.flatMap(root => root?.userData.waterExclusions ?? []);
  const blockers = new Map();
  const surfaces = new Map();
  const moving = [];
  const dynamicSurfaces = [];
  let waterDriver = null;
  const movingSet = new Set(movingRoots);
  const stats = {
    radius, height, stepHeight, baseGround, cellSize, bounds,
    meshes: 0, instances: 0, blockers: 0, surfaces: 0, moving: 0,
    ignored: 0, invalid: 0, obstacleCells: 0, surfaceCells: 0,
    queries: 0, candidates: 0, maxCandidates: 0,
  };
  const temporaryMatrix = new THREE.Matrix4();
  const instanceMatrix = new THREE.Matrix4();
  const temporaryBox = new THREE.Box3();
  const localCenter = new THREE.Vector3();
  const worldCenter = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  function key(x, z) { return `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`; }
  function finiteBox(box) {
    return [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite);
  }
  function insert(index, item, padding = 0) {
    const minX = Math.max(bounds.minX, item.minX - padding);
    const maxX = Math.min(bounds.maxX, item.maxX + padding);
    const minZ = Math.max(bounds.minZ, item.minZ - padding);
    const maxZ = Math.min(bounds.maxZ, item.maxZ + padding);
    if (minX > maxX || minZ > maxZ) return;
    for (let ix = Math.floor(minX / cellSize); ix <= Math.floor(maxX / cellSize); ix++) {
      for (let iz = Math.floor(minZ / cellSize); iz <= Math.floor(maxZ / cellSize); iz++) {
        const cell = `${ix},${iz}`;
        if (!index.has(cell)) index.set(cell, []);
        index.get(cell).push(item);
      }
    }
  }
  function candidates(index, x, z) { return index.get(key(x, z)) ?? []; }
  function recordCandidates(count) {
    stats.queries += 1;
    stats.candidates += count;
    stats.maxCandidates = Math.max(stats.maxCandidates, count);
  }
  function footprint(box, matrix, geometryBounds) {
    const result = {
      minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z,
      minY: box.min.y, maxY: box.max.y, type: 'obb',
    };
    const e = matrix.elements;
    const axisX = Math.hypot(e[0], e[2]);
    const axisZ = Math.hypot(e[8], e[10]);
    const axisY = Math.hypot(e[4], e[5], e[6]);
    // 倾斜的细杆和支撑取保守 AABB；纯水平转角的墙、开门叶保持精确 OBB。
    const yawOnly = Math.hypot(e[4], e[6]) <= axisY * 0.035 && Math.abs(e[1]) < 0.015 && Math.abs(e[9]) < 0.015;
    if (!yawOnly || axisX < 1e-8 || axisZ < 1e-8) {
      result.cx = (box.min.x + box.max.x) / 2;
      result.cz = (box.min.z + box.max.z) / 2;
      result.ux = 1; result.uz = 0; result.vx = 0; result.vz = 1;
      result.hx = (box.max.x - box.min.x) / 2;
      result.hz = (box.max.z - box.min.z) / 2;
      return result;
    }
    geometryBounds.getCenter(localCenter);
    worldCenter.copy(localCenter).applyMatrix4(matrix);
    result.cx = worldCenter.x;
    result.cz = worldCenter.z;
    result.ux = e[0] / axisX; result.uz = e[2] / axisX;
    result.vx = e[8] / axisZ; result.vz = e[10] / axisZ;
    result.hx = (geometryBounds.max.x - geometryBounds.min.x) * axisX / 2;
    result.hz = Math.max(0.008, (geometryBounds.max.z - geometryBounds.min.z) * axisZ / 2);
    return result;
  }
  function contains(item, x, z, padding = 0) {
    if (item.type === 'circle') return (x - item.cx) ** 2 + (z - item.cz) ** 2 <= (item.r + padding) ** 2;
    if (item.type === 'triangle') {
      const dx = x - item.ax;
      const dz = z - item.az;
      const u = (dx * item.v2z - dz * item.v2x) / item.denominator;
      const v = (item.v1x * dz - item.v1z * dx) / item.denominator;
      return u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001;
    }
    const dx = x - item.cx;
    const dz = z - item.cz;
    const alongX = dx * item.ux + dz * item.uz;
    const alongZ = dx * item.vx + dz * item.vz;
    const outsideX = Math.max(0, Math.abs(alongX) - item.hx);
    const outsideZ = Math.max(0, Math.abs(alongZ) - item.hz);
    return outsideX * outsideX + outsideZ * outsideZ <= padding * padding + 1e-12;
  }
  function addBlocker(item) {
    if (item.maxY <= baseGround + epsilon || item.minY > maxGround + height) return;
    insert(blockers, item, radius);
    stats.blockers += 1;
  }
  function addSurface(item) {
    if (item.maxY < baseGround - epsilon || item.maxY > maxGround) return;
    // 脚先接触台阶边缘时即可抬起；格子同时索引踏面周围的脚半径。
    insert(surfaces, item, radius);
    stats.surfaces += 1;
  }
  function ancestorExcluded(object) {
    for (let node = object; node; node = node.parent) {
      if (movingSet.has(node) || node.userData?.walkCollision === false || node.userData?.dynamic === true) return true;
    }
    return false;
  }
  function collectRamp(object, matrix, box) {
    if (box.max.y > maxGround || box.min.y < -0.3) return;
    const geometry = object.geometry;
    const positions = geometry.getAttribute('position');
    const indices = geometry.index;
    const count = indices ? indices.count : positions.count;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const edge1 = new THREE.Vector3();
    const edge2 = new THREE.Vector3();
    for (let i = 0; i + 2 < count; i += 3) {
      a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(matrix);
      b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(matrix);
      c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2).applyMatrix4(matrix);
      edge1.subVectors(b, a); edge2.subVectors(c, a);
      normal.crossVectors(edge1, edge2).normalize();
      if (normal.y < 0.55) continue;
      const denominator = edge1.x * edge2.z - edge1.z * edge2.x;
      if (Math.abs(denominator) < 1e-8) continue;
      addSurface({
        type: 'triangle', ax: a.x, ay: a.y, az: a.z,
        v1x: edge1.x, v1y: edge1.y, v1z: edge1.z,
        v2x: edge2.x, v2y: edge2.y, v2z: edge2.z, denominator,
        minX: Math.min(a.x, b.x, c.x), maxX: Math.max(a.x, b.x, c.x),
        minZ: Math.min(a.z, b.z, c.z), maxZ: Math.max(a.z, b.z, c.z),
        minY: Math.min(a.y, b.y, c.y), maxY: Math.max(a.y, b.y, c.y),
      });
    }
  }
  function collectMesh(object, matrix, instance = false) {
    const geometry = object.geometry;
    const type = geometry.type;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    if (!material || material.isShaderMaterial ||
      (type === 'PlaneGeometry' && material.map) ||
      !['BoxGeometry', 'CylinderGeometry', 'TubeGeometry', 'TorusGeometry', 'PlaneGeometry', 'BufferGeometry'].includes(type) ||
      (type === 'BufferGeometry' && /花|山|天空|阴影/.test(object.name))) {
      stats.ignored += 1;
      return;
    }
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const localBounds = geometry.boundingBox;
    temporaryBox.copy(localBounds).applyMatrix4(matrix);
    if (!finiteBox(temporaryBox)) { stats.invalid += 1; return; }
    const box = temporaryBox;
    if (box.max.y <= baseGround - epsilon || box.min.y > maxGround + height) { stats.ignored += 1; return; }
    if (object.userData?.roof) {
      const ceiling = footprint(box, matrix, localBounds);
      ceiling.source = object.name || '屋面与天花板';
      addBlocker(ceiling);
      return;
    }
    if (type === 'BufferGeometry') {
      collectRamp(object, matrix, box);
      return;
    }
    const item = footprint(box, matrix, localBounds);
    item.source = object.name || object.parent?.name || type;
    if (type === 'PlaneGeometry') {
      normalMatrix.getNormalMatrix(matrix);
      normal.set(0, 0, 1).applyMatrix3(normalMatrix).normalize();
      if (Math.abs(normal.y) > 0.86) {
        if (!material.transparent || material.opacity > 0.9) { addSurface(item); addBlocker(item); }
        return;
      }
      // 无贴图的透明玻璃是实际窗面；文字贴图与地面阴影已在上方排除。
      if (Math.abs(normal.y) < 0.35) addBlocker(item);
      return;
    }
    const spanX = box.max.x - box.min.x;
    const spanZ = box.max.z - box.min.z;
    const spanY = box.max.y - box.min.y;
    if (type === 'TubeGeometry' && box.max.y <= baseGround + stepHeight) return;
    if (type === 'CylinderGeometry') {
      const e = matrix.elements;
      const axisY = Math.hypot(e[4], e[5], e[6]);
      if (axisY > 1e-8 && Math.abs(e[5]) / axisY > 0.98) {
        item.type = 'circle';
        item.r = Math.max(spanX, spanZ) / 2;
        item.cx = (box.min.x + box.max.x) / 2;
        item.cz = (box.min.z + box.max.z) / 2;
      }
    }
    // 大而低的地板、路缘与台阶可踩；桌椅和小配送箱保留为障碍物。
    const broadSlab = type === 'BoxGeometry' && spanY <= stepHeight + 0.018 && Math.max(spanX, spanZ) >= 1.05;
    const lowTile = type === 'BoxGeometry' && spanY <= 0.06 && Math.min(spanX, spanZ) >= 0.09;
    const floorTile = instance && type === 'BoxGeometry' && spanY <= 0.055 && box.max.y <= 0.52;
    const soilDisc = type === 'CylinderGeometry' && spanY <= 0.12 && box.max.y <= 0.32 && Math.max(spanX, spanZ) >= 0.5;
    if (broadSlab || lowTile || floorTile || soilDisc || object.userData?.walkSurface === true) {
      item.walkable = item.maxY <= maxGround;
      addSurface(item);
    }
    addBlocker(item);
  }

  // 预先生成每个运动根节点的局部盒，每帧只变换一次根矩阵。
  for (const root of movingRoots) {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    const localBox = new THREE.Box3();
    root.traverse(object => {
      if (!object.isMesh || !object.geometry) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      temporaryMatrix.multiplyMatrices(inverse, object.matrixWorld);
      temporaryBox.copy(object.geometry.boundingBox).applyMatrix4(temporaryMatrix);
      if (finiteBox(temporaryBox)) localBox.union(temporaryBox);
    });
    if (!localBox.isEmpty()) moving.push({ root, localBox, worldBox: new THREE.Box3(), item: null });
  }
  for (const root of roots) {
    if (!root) continue;
    root.updateWorldMatrix(true, true);
    root.traverse(object => {
      // 电梯地板明确声明踏面；祖先动态标记不让它从重力支撑中消失。
      if (object.isMesh && object.userData?.walkSurface === true) {
        let dynamicAncestor = false;
        for (let node = object.parent; node; node = node.parent) dynamicAncestor ||= node.userData?.dynamic === true;
        if (dynamicAncestor && !movingSet.has(object)) {
          if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
          dynamicSurfaces.push({ object, localBounds: object.geometry.boundingBox.clone(), box: new THREE.Box3(), item: null });
          return;
        }
      }
      if (!object.isMesh || !object.visible || ancestorExcluded(object)) return;
      stats.meshes += 1;
      if (object.isInstancedMesh) {
        // 花朵、树冠和草丛不参与身体碰撞，只展开地砖与真正的树干实例。
        if (!['BoxGeometry', 'CylinderGeometry'].includes(object.geometry.type)) { stats.ignored += 1; return; }
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, instanceMatrix);
          temporaryMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
          collectMesh(object, temporaryMatrix, true);
          stats.instances += 1;
        }
      } else collectMesh(object, object.matrixWorld);
    });
  }
  function refreshMoving() {
    for (const entry of moving) {
      entry.root.updateWorldMatrix(true, false);
      entry.worldBox.copy(entry.localBox).applyMatrix4(entry.root.matrixWorld);
      const b = entry.worldBox;
      entry.item = footprint(b, entry.root.matrixWorld, entry.localBox);
    }
    for (const entry of dynamicSurfaces) {
      entry.object.updateWorldMatrix(true, false);
      entry.box.copy(entry.localBounds).applyMatrix4(entry.object.matrixWorld);
      entry.item = footprint(entry.box, entry.object.matrixWorld, entry.localBounds);
      entry.item.walkable = true;
      entry.item.source = entry.object.name || '运动踏面';
    }
  }
  function surfaceHeight(item, x, z) {
    if (item.type !== 'triangle') return item.maxY;
    const dx = x - item.ax;
    const dz = z - item.az;
    const u = (dx * item.v2z - dz * item.v2x) / item.denominator;
    const v = (item.v1x * dz - item.v1z * dx) / item.denominator;
    return item.ay + u * item.v1y + v * item.v2y;
  }
  function sampleWater(x, z) {
    if (waterDriver?.sampleWater) return waterDriver.sampleWater(x, z);
    const pond = waterExclusions.find(item => pondDistance(x, z, item) <= 0);
    if (!pond) return null;
    const shoreDistance = pondDistance(x, z, pond);
    const inward = Math.max(0, -shoreDistance);
    // 小鱼塘的两圈土岸与建模保持同样的半米、1.05 米宽度。
    let bottomY = pond.bottomY;
    if (inward < 0.5) bottomY = THREE.MathUtils.lerp(0.135, pond.bottomY * 0.49, inward / 0.5);
    else if (inward < 1.05) bottomY = THREE.MathUtils.lerp(pond.bottomY * 0.49, pond.bottomY, (inward - 0.5) / 0.55);
    return { ...pond, height: pond.waterY, bottomY, shoreDistance, u: (x - pond.x) / pond.width + 0.5, v: (z - pond.z) / pond.depth + 0.5 };
  }
  function terrainHeight(x, z) {
    const water = sampleWater(x, z);
    const bottom = waterDriver?.bottomAt?.(x, z) ?? water?.bottomY;
    return Number.isFinite(bottom) ? bottom : baseGround;
  }
  function groundHeight(x, z, previousGround = 0, options = {}) {
    if (![x, z, previousGround].every(Number.isFinite)) return baseGround;
    const nearby = candidates(surfaces, x, z);
    recordCandidates(nearby.length);
    let ground = terrainHeight(x, z);
    const reachable = Math.max(ground, previousGround) + (options.allowStep === false ? epsilon : stepHeight + epsilon);
    for (const item of [...nearby, ...dynamicSurfaces.map(entry => entry.item).filter(Boolean)]) {
      // 只接触实际低踏面就预先抬脚，避免大平台侧壁先撞上身体。
      // 斜坡仍按脚中心求高度，防止在坡外延长出虚构的斜面。
      if (!contains(item, x, z, item.type === 'triangle' ? 0 : radius - 0.003)) continue;
      const y = surfaceHeight(item, x, z);
      if (y <= reachable && y > ground) ground = y;
    }
    return ground;
  }
  function blocked(x, z, ground, previousGround = ground, bodyHeight = height, allowSteps = true) {
    if (x < bounds.minX + radius || x > bounds.maxX - radius || z < bounds.minZ + radius || z > bounds.maxZ - radius) return true;
    const nearby = candidates(blockers, x, z);
    recordCandidates(nearby.length + moving.length);
    const feet = ground + epsilon;
    const head = ground + bodyHeight;
    // 从较高踏面向下迈步时，旧踏面的边缘不把身体卡在半空。
    const clearedTop = Math.max(ground, previousGround) + 0.045;
    for (const item of nearby) {
      if (item.maxY <= clearedTop || item.minY >= head || item.maxY <= feet) continue;
      // 脚的圆形半径先接触台阶侧面时，也允许踏上可达的低踏面。
      if (allowSteps && item.walkable && item.maxY <= Math.max(ground, previousGround) + stepHeight + epsilon) continue;
      if (contains(item, x, z, radius - 0.003)) {
        stats.lastCollision = { source: item.source, center: [item.cx, item.cz], y: [item.minY, item.maxY], x: [item.minX, item.maxX], z: [item.minZ, item.maxZ] };
        return true;
      }
    }
    for (const entry of moving) {
      const item = entry.item;
      if (item && item.minY < head && item.maxY > feet && contains(item, x, z, radius)) return true;
    }
    return false;
  }
  function isBlocked(x, z, ground = 0) {
    if (![x, z, ground].every(Number.isFinite)) return true;
    refreshMoving();
    return blocked(x, z, ground);
  }
  function move(position, dx, dz) {
    const result = position.clone();
    if (![result.x, result.y, result.z, dx, dz].every(Number.isFinite)) return result;
    refreshMoving();
    const targetX = THREE.MathUtils.clamp(result.x + dx, bounds.minX + radius, bounds.maxX - radius);
    const targetZ = THREE.MathUtils.clamp(result.z + dz, bounds.minZ + radius, bounds.maxZ - radius);
    const count = Math.max(1, Math.ceil(Math.max(Math.abs(targetX - result.x), Math.abs(targetZ - result.z)) / 0.075));
    const stepX = (targetX - result.x) / count;
    const stepZ = (targetZ - result.z) / count;
    result.y = groundHeight(result.x, result.z, result.y);
    function tryAxis(axis, amount) {
      if (Math.abs(amount) < 1e-9) return;
      const x = axis === 'x' ? result.x + amount : result.x;
      const z = axis === 'z' ? result.z + amount : result.z;
      const ground = groundHeight(x, z, result.y);
      if (!blocked(x, z, ground, result.y)) {
        result[axis] += amount;
        result.y = ground;
      }
    }
    for (let i = 0; i < count; i++) {
      if (Math.abs(stepX) > Math.abs(stepZ)) { tryAxis('x', stepX); tryAxis('z', stepZ); }
      else { tryAxis('z', stepZ); tryAxis('x', stepX); }
    }
    return result;
  }

  function moveBody(position, dx, dz, options = {}) {
    const result = position.clone();
    if (![result.x, result.y, result.z, dx, dz].every(Number.isFinite)) return result;
    const bodyHeight = Number.isFinite(options.bodyHeight) ? options.bodyHeight : height;
    const stepUp = options.stepUp !== false;
    refreshMoving();
    const targetX = THREE.MathUtils.clamp(result.x + dx, bounds.minX + radius, bounds.maxX - radius);
    const targetZ = THREE.MathUtils.clamp(result.z + dz, bounds.minZ + radius, bounds.maxZ - radius);
    const count = Math.max(1, Math.ceil(Math.max(Math.abs(targetX - result.x), Math.abs(targetZ - result.z)) / 0.05));
    const stepX = (targetX - result.x) / count, stepZ = (targetZ - result.z) / count;
    function tryAxis(axis, amount) {
      if (Math.abs(amount) < 1e-10) return;
      const x = axis === 'x' ? result.x + amount : result.x;
      const z = axis === 'z' ? result.z + amount : result.z;
      const floor = groundHeight(x, z, result.y);
      const candidateY = stepUp && floor > result.y && floor <= result.y + stepHeight + epsilon ? floor : result.y;
      // 水底岸坡与真实台阶相同；过高的坡面不能穿过身体，也不能在跳跃时自动抬脚。
      if (floor > candidateY + epsilon) return;
      if (!blocked(x, z, candidateY, result.y, bodyHeight, stepUp)) {
        result[axis] += amount;
        result.y = candidateY;
      }
    }
    for (let i = 0; i < count; i++) {
      if (Math.abs(stepX) > Math.abs(stepZ)) { tryAxis('x', stepX); tryAxis('z', stepZ); }
      else { tryAxis('z', stepZ); tryAxis('x', stepX); }
    }
    return result;
  }

  function moveVertical(position, dy, options = {}) {
    const result = position.clone();
    const bodyHeight = Number.isFinite(options.bodyHeight) ? options.bodyHeight : height;
    if (![result.x, result.y, result.z, dy, bodyHeight].every(Number.isFinite)) return { position: result, grounded: false, hitCeiling: false };
    refreshMoving();
    const nearby = [...candidates(blockers, result.x, result.z), ...moving.map(entry => entry.item), ...dynamicSurfaces.map(entry => entry.item)].filter(Boolean);
    let floor = groundHeight(result.x, result.z, result.y, { allowStep: false });
    // 跳上桌面、平台和运动踏面后可站立；只收脚底下方真正接触到的表面。
    for (const item of nearby) {
      if (contains(item, result.x, result.z, radius - 0.003) && item.maxY <= result.y + epsilon && item.maxY > floor) floor = item.maxY;
    }
    let nextY = result.y + dy;
    let hitCeiling = false;
    if (dy > 0) {
      for (const item of nearby) {
        if (!contains(item, result.x, result.z, radius - 0.003)) continue;
        if (item.minY >= result.y + bodyHeight - epsilon && item.minY < nextY + bodyHeight + epsilon) {
          nextY = Math.min(nextY, item.minY - bodyHeight - epsilon);
          hitCeiling = true;
        }
      }
    }
    const grounded = nextY <= floor + 1e-6 && dy <= 0;
    if (nextY < floor) nextY = floor;
    result.y = nextY;
    return { position: result, grounded, hitCeiling, groundY: floor };
  }
  function canOccupy(position, bodyHeight = height) {
    refreshMoving();
    return !blocked(position.x, position.z, position.y, position.y, bodyHeight, false);
  }
  stats.obstacleCells = blockers.size;
  stats.surfaceCells = surfaces.size;
  stats.moving = moving.length;
  stats.dynamicSurfaces = dynamicSurfaces.length;
  refreshMoving();
  // 近距离视线检查沿真实墙体采样，避免隔着墙触发室内物件。
  function lineClear(from, to) {
    refreshMoving();
    const distance = from.distanceTo(to);
    const count = Math.max(1, Math.ceil(distance / 0.12));
    const stop = Math.max(0, distance - 0.28) / Math.max(distance, 0.001);
    for (let i = 1; i < count; i++) {
      const t = i / count;
      if (t > stop) break;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const z = from.z + (to.z - from.z) * t;
      for (const item of [...candidates(blockers, x, z), ...moving.map(entry => entry.item)]) {
        if (item && y > item.minY + 0.025 && y < item.maxY - 0.025 && contains(item, x, z, 0.006)) return false;
      }
    }
    return true;
  }
  return { move, moveBody, moveVertical, canOccupy, groundHeight, isBlocked, lineClear, sampleWater, setWaterDriver(driver) { waterDriver = driver; }, stats };
}
