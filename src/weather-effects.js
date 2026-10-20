// 以真实屋顶和楼板接雨，雨滴使用重力、终端速度与水平风阻。
import { pondDistance } from './pond-shape.js';

export function createWeatherEffects({ kit, roots, camera, waterSurfaces = [], onWaterImpact = () => {} }) {
  const { THREE } = kit;
  const group = new THREE.Group();
  group.name = '受风与屋檐影响的降雨';
  group.userData.walkCollision = false;
  group.userData.dynamic = true;
  const mobile = typeof matchMedia === 'function' && matchMedia('(max-width: 600px)').matches;
  const count = mobile ? 700 : 1200;
  const splashCount = mobile ? 95 : 170;
  const rippleCount = mobile ? 55 : 95;
  const bounds = { minX: -44, maxX: 44, minZ: -56, maxZ: 46 };
  const cellSize = 4;
  const cells = new Map();
  const surfaces = [];
  const matrix = new THREE.Matrix4();
  const instanceMatrix = new THREE.Matrix4();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let seed = 93619;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const clamp = (value, lo = 0, hi = 1) => THREE.MathUtils.clamp(value, lo, hi);
  function cellKey(x, z) { return `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`; }
  function addTriangle(p0, p1, p2, object) {
    ab.subVectors(p1, p0);
    ac.subVectors(p2, p0);
    normal.crossVectors(ab, ac).normalize();
    if (normal.y < 0.36) return;
    const denominator = ab.x * ac.z - ab.z * ac.x;
    if (Math.abs(denominator) < 0.000001) return;
    const minX = Math.max(bounds.minX, Math.min(p0.x, p1.x, p2.x));
    const maxX = Math.min(bounds.maxX, Math.max(p0.x, p1.x, p2.x));
    const minZ = Math.max(bounds.minZ, Math.min(p0.z, p1.z, p2.z));
    const maxZ = Math.min(bounds.maxZ, Math.max(p0.z, p1.z, p2.z));
    if (minX > maxX || minZ > maxZ || Math.max(p0.y, p1.y, p2.y) < 0.01 || Math.min(p0.y, p1.y, p2.y) > 34) return;
    const item = { x: p0.x, y: p0.y, z: p0.z, abx: ab.x, aby: ab.y, abz: ab.z, acx: ac.x, acy: ac.y, acz: ac.z, denominator, normal: normal.clone(), name: object.name || object.parent?.name || '接雨面' };
    surfaces.push(item);
    for (let ix = Math.floor(minX / cellSize); ix <= Math.floor(maxX / cellSize); ix++) {
      for (let iz = Math.floor(minZ / cellSize); iz <= Math.floor(maxZ / cellSize); iz++) {
        const key = `${ix},${iz}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(item);
      }
    }
  }
  function collectGeometry(object, transform) {
    const geometry = object.geometry;
    const positions = geometry.getAttribute('position');
    const indices = geometry.index;
    const vertexCount = indices ? indices.count : positions.count;
    for (let i = 0; i + 2 < vertexCount; i += 3) {
      a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(transform);
      b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(transform);
      c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2).applyMatrix4(transform);
      addTriangle(a, b, c, object);
    }
  }
  // 在静态合并前建立索引；每个接雨面保留三角形高度，而不是把双坡屋顶当平盒。
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    root.traverse(object => {
      if (!object.isMesh || !object.visible || !object.geometry) return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      if (!material || material.transparent || material.isShaderMaterial) return;
      for (let ancestor = object; ancestor; ancestor = ancestor.parent) {
        if (ancestor.userData?.dynamic || ancestor.userData?.walkCollision === false) return;
      }
      // 花瓣、草丛和人物的曲面不成为整片雨棚；只接收实体建筑与铺装。
      if (!['BoxGeometry', 'BufferGeometry', 'PlaneGeometry'].includes(object.geometry.type) || /樱花|落樱|小草|薄云|树冠|花朵|天空|地平线|远山/.test(object.name)) return;
      if (object.isInstancedMesh) {
        if (object.geometry.type !== 'BoxGeometry') return;
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, instanceMatrix);
          matrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
          collectGeometry(object, matrix);
        }
      } else collectGeometry(object, object.matrixWorld);
    });
  }
  const groundNormal = new THREE.Vector3(0, 1, 0);
  function contact(x, z) {
    let height = 0.075;
    let hit = null;
    for (const item of cells.get(cellKey(x, z)) ?? []) {
      const dx = x - item.x;
      const dz = z - item.z;
      const u = (dx * item.acz - dz * item.acx) / item.denominator;
      const v = (item.abx * dz - item.abz * dx) / item.denominator;
      if (u < -0.00001 || v < -0.00001 || u + v > 1.00001) continue;
      const y = item.y + u * item.aby + v * item.acy;
      if (y > height) { height = y; hit = item; }
    }
    const water = waterSurfaces.find(pond => pondDistance(x, z, pond) <= 0 && pond.waterY > height);
    if (water) return { height: water.waterY, normal: groundNormal, name: water.name, water };
    return { height, normal: hit?.normal ?? groundNormal, name: hit?.name ?? '街道路面' };
  }
  function roofHeight(x, z) { return contact(x, z).height; }
  function isSheltered(position) {
    const x = Array.isArray(position) ? position[0] : position.x;
    const y = Array.isArray(position) ? position[1] : position.y;
    const z = Array.isArray(position) ? position[2] : position.z;
    return roofHeight(x, z) > y + 0.3;
  }

  const rainPositions = new Float32Array(count * 6);
  const rainGeometry = new THREE.BufferGeometry();
  const rainAttribute = new THREE.BufferAttribute(rainPositions, 3).setUsage(THREE.DynamicDrawUsage);
  rainGeometry.setAttribute('position', rainAttribute);
  const rainMaterial = new THREE.LineBasicMaterial({ color: '#b4cbd1', transparent: true, opacity: 0, depthWrite: false });
  const rainLines = new THREE.LineSegments(rainGeometry, rainMaterial);
  rainLines.name = '有终端速度的受风雨线';
  rainLines.frustumCulled = false;
  group.add(rainLines);
  const viewDirection = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const droplets = [];
  function updateAnchor() {
    camera.getWorldDirection(viewDirection);
    anchor.copy(camera.position).addScaledVector(viewDirection, Math.min(19, Math.max(8, camera.position.y * 0.72)));
    anchor.x = clamp(anchor.x, -24, 24);
    anchor.z = clamp(anchor.z, -32, 26);
  }
  updateAnchor();
  function respawn(drop, fill = false, index = 0) {
    const nearCamera = random() < 0.8;
    const horizontalLength = Math.hypot(viewDirection.x, viewDirection.z);
    const forwardX = horizontalLength > 0.01 ? viewDirection.x / horizontalLength : 0;
    const forwardZ = horizontalLength > 0.01 ? viewDirection.z / horizontalLength : -1;
    const lateral = (random() - 0.5) * 26;
    const depth = (random() - 0.5) * 34;
    // 八成雨滴集中在视轴附近；远场保留余下两成，数量不随可读性增加。
    drop.position.x = clamp(nearCamera ? anchor.x - forwardZ * lateral + forwardX * depth : -40 + random() * 80, bounds.minX + 1, bounds.maxX - 1);
    drop.position.z = clamp(nearCamera ? anchor.z + forwardX * lateral + forwardZ * depth : -52 + random() * 94, bounds.minZ + 1, bounds.maxZ - 1);
    const roof = roofHeight(drop.position.x, drop.position.z);
    const ceiling = Math.max(29, camera.position.y + 14, roof + 8);
    drop.position.y = fill ? roof + 0.3 + (ceiling - roof) * ((index + random()) / count) : ceiling + random() * 4;
    drop.terminal = 8.1 + random() * 2.1;
    drop.velocity.set(0, -(fill ? drop.terminal * 0.88 : 3.5 + random() * 2), 0);
    drop.seed = random() * Math.PI * 2;
  }
  for (let i = 0; i < count; i++) {
    const drop = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), terminal: 9, seed: 0 };
    respawn(drop, true, i);
    droplets.push(drop);
  }

  const splashPositions = new Float32Array(splashCount * 3 * 6);
  const splashGeometry = new THREE.BufferGeometry();
  const splashAttribute = new THREE.BufferAttribute(splashPositions, 3).setUsage(THREE.DynamicDrawUsage);
  splashGeometry.setAttribute('position', splashAttribute);
  const splashMaterial = new THREE.LineBasicMaterial({ color: '#c1d3d2', transparent: true, opacity: 0, depthWrite: false });
  const splashLines = new THREE.LineSegments(splashGeometry, splashMaterial);
  splashLines.name = '屋顶和路面的重力飞溅';
  splashLines.frustumCulled = false;
  group.add(splashLines);
  const splashes = Array.from({ length: splashCount }, () => ({ age: 9, life: 0.32, position: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), velocity: Array.from({ length: 3 }, () => new THREE.Vector3()) }));
  let splashIndex = 0;
  let rippleIndex = 0;
  let roofHits = 0;
  let groundHits = 0;
  let waterHits = 0;
  const ringGeometry = new THREE.RingGeometry(0.88, 1, 28);
  const ringMaterial = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color('#bdced1') }, opacity: { value: 0 } },
    vertexShader: 'attribute float fade; varying float vFade; void main(){ vFade=fade; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 color; uniform float opacity; varying float vFade; void main(){ gl_FragColor=vec4(color,opacity*vFade); #include <colorspace_fragment> }'.replace('; #include', ';\n#include').replace('fragment> }', 'fragment>\n}'),
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const rippleFade = new THREE.InstancedBufferAttribute(new Float32Array(rippleCount), 1).setUsage(THREE.DynamicDrawUsage);
  ringGeometry.setAttribute('fade', rippleFade);
  const rings = new THREE.InstancedMesh(ringGeometry, ringMaterial, rippleCount);
  rings.name = '积水里的扩散涟漪';
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rings.frustumCulled = false;
  group.add(rings);
  const ripples = Array.from({ length: rippleCount }, () => ({ age: 9, life: 0.68, position: new THREE.Vector3(), radius: 0.3 }));
  const transform = new THREE.Object3D();
  function impact(drop, hit) {
    if (hit.water) {
      waterHits++;
      onWaterImpact(hit.water, drop.position.x, drop.position.z, Math.abs(drop.velocity.y));
    }
    const grounded = hit.height < 0.65;
    if (grounded) groundHits += 1;
    else roofHits += 1;
    const splash = splashes[splashIndex++ % splashCount];
    splash.position.set(drop.position.x, hit.height + 0.016, drop.position.z);
    splash.normal.copy(hit.normal);
    splash.age = 0;
    splash.life = 0.27 + random() * 0.12;
    for (let i = 0; i < 3; i++) {
      const angle = random() * Math.PI * 2;
      const speed = 0.32 + random() * 0.6;
      splash.velocity[i].set(Math.cos(angle) * speed + hit.normal.x * 0.5, 0.58 + random() * 0.5, Math.sin(angle) * speed + hit.normal.z * 0.5);
    }
    if (grounded && !hit.water) {
      const ripple = ripples[rippleIndex++ % rippleCount];
      ripple.position.copy(splash.position);
      ripple.age = 0;
      ripple.life = 0.55 + random() * 0.35;
      ripple.radius = 0.2 + random() * 0.19;
    }
  }

  // 小片积水沿路缘低点聚集，以清水的低菲涅耳反射映出随昼夜变化的天色。
  const reflectionCanvas = document.createElement('canvas');
  reflectionCanvas.width = 256;
  reflectionCanvas.height = 128;
  const reflectionContext = reflectionCanvas.getContext('2d');
  const reflectionTexture = new THREE.CanvasTexture(reflectionCanvas);
  reflectionTexture.mapping = THREE.EquirectangularReflectionMapping;
  reflectionTexture.colorSpace = THREE.SRGBColorSpace;
  const puddleMaterial = new THREE.MeshPhysicalMaterial({ color: '#809590', roughness: 0.29, metalness: 0, transparent: true, opacity: 0.36, depthWrite: false, envMap: reflectionTexture, envMapIntensity: 0.45, clearcoat: 0.22, clearcoatRoughness: 0.34, polygonOffset: true, polygonOffsetFactor: -2 });
  const puddles = [];
  for (const [x, z, sx, sz] of [[-6.35, 3.1, 0.8, 0.45], [-1.67, 12.1, 0.62, 0.31], [-6.37, 20.8, 1.16, 0.32], [-1.65, 29, 0.7, 0.42], [-24, -8.7, 0.7, 0.43], [9.3, -1.18, 0.64, 0.42], [18.9, 1.11, 0.71, 0.32], [-4.3, 15.2, 0.42, 0.25]]) {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 30; i++) {
      const angle = i / 30 * Math.PI * 2;
      const wobble = 0.82 + Math.sin(angle * 3 + x) * 0.085 + Math.cos(angle * 5 + z) * 0.055;
      const px = Math.cos(angle) * wobble;
      const py = Math.sin(angle) * wobble;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    const patch = new THREE.Mesh(new THREE.ShapeGeometry(shape, 20), puddleMaterial);
    patch.name = '路缘缓慢积起的小水洼';
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, Math.min(0.2, roofHeight(x, z)) + 0.012, z);
    patch.receiveShadow = true;
    patch.renderOrder = 2;
    patch.scale.set(sx, sz, 1);
    group.add(patch);
    puddles.push({ patch, sx, sz });
  }
  let reflectionDaylight = -1;
  function updateReflection(daylight) {
    if (Math.abs(daylight - reflectionDaylight) < 0.04) return;
    reflectionDaylight = daylight;
    const high = new THREE.Color('#101b38').lerp(new THREE.Color('#adcbd8'), daylight);
    const low = new THREE.Color('#263247').lerp(new THREE.Color('#e0d9c3'), daylight);
    const gradient = reflectionContext.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, `#${high.getHexString()}`);
    gradient.addColorStop(0.65, `#${low.getHexString()}`);
    gradient.addColorStop(1, daylight > 0.45 ? '#6e8076' : '#182633');
    reflectionContext.fillStyle = gradient;
    reflectionContext.fillRect(0, 0, 256, 128);
    reflectionContext.fillStyle = daylight > 0.45 ? '#798d8a' : '#17232e';
    for (let i = 0; i < 8; i++) {
      const x = i * 36 - 4;
      const y = 85 + Math.sin(i * 3.5) * 8;
      reflectionContext.beginPath();
      reflectionContext.moveTo(x, 128);
      reflectionContext.lineTo(x, y);
      reflectionContext.lineTo(x + 13, y - 10);
      reflectionContext.lineTo(x + 29, y);
      reflectionContext.lineTo(x + 29, 128);
      reflectionContext.fill();
    }
    reflectionTexture.needsUpdate = true;
  }
  updateReflection(1);
  const nightRain = new THREE.Color('#8999b0');
  const dayRain = new THREE.Color('#ced6d7');
  let activeCount = 0;
  let lastRain = 0;
  let lastWetness = 0;
  let lastWind = new THREE.Vector2();
  function update(delta, state = {}) {
    const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.1);
    const rain = clamp(Number.isFinite(state.rain) ? state.rain : 0);
    const wetness = clamp(Number.isFinite(state.wetness) ? state.wetness : 0);
    const daylight = clamp(Number.isFinite(state.daylight) ? state.daylight : 1);
    const time = Number.isFinite(state.time) ? state.time : 0;
    const windX = Number.isFinite(state.wind?.x) ? state.wind.x : 0;
    const windZ = Number.isFinite(state.wind?.y) ? state.wind.y : 0;
    lastRain = rain;
    lastWetness = wetness;
    lastWind.set(windX, windZ);
    activeCount = rain < 0.012 ? 0 : Math.floor(count * Math.sqrt(rain));
    updateAnchor();
    const steps = Math.max(1, Math.ceil(dt / 0.035));
    const step = dt / steps;
    for (let i = 0; i < activeCount; i++) {
      const drop = droplets[i];
      for (let n = 0; n < steps; n++) {
        const gust = 0.14 * Math.sin(time * 0.9 + drop.seed);
        const resistance = 1 - Math.exp(-2.4 * step);
        drop.velocity.x += (windX + gust - drop.velocity.x) * resistance;
        drop.velocity.z += (windZ - gust * 0.5 - drop.velocity.z) * resistance;
        drop.velocity.y = Math.max(-drop.terminal, drop.velocity.y - 9.81 * step);
        drop.position.addScaledVector(drop.velocity, step);
        const hit = contact(drop.position.x, drop.position.z);
        if (drop.position.y <= hit.height) { impact(drop, hit); respawn(drop); }
        else if (drop.position.x < bounds.minX || drop.position.x > bounds.maxX || drop.position.z < bounds.minZ || drop.position.z > bounds.maxZ) respawn(drop);
      }
      const p = i * 6;
      rainPositions[p] = drop.position.x;
      rainPositions[p + 1] = drop.position.y;
      rainPositions[p + 2] = drop.position.z;
      rainPositions[p + 3] = drop.position.x - drop.velocity.x * 0.038;
      rainPositions[p + 4] = drop.position.y - drop.velocity.y * 0.038;
      rainPositions[p + 5] = drop.position.z - drop.velocity.z * 0.038;
    }
    rainGeometry.setDrawRange(0, activeCount * 2);
    rainAttribute.needsUpdate = true;
    rainMaterial.opacity = 0.2 + rain * 0.42;
    rainMaterial.color.copy(nightRain).lerp(dayRain, daylight);
    splashMaterial.opacity = rain * (0.27 + daylight * 0.21);
    splashMaterial.color.copy(rainMaterial.color);
    for (let i = 0; i < splashCount; i++) {
      const splash = splashes[i];
      splash.age += dt;
      const alive = splash.age < splash.life && rain > 0.01;
      for (let j = 0; j < 3; j++) {
        const p = (i * 3 + j) * 6;
        const velocity = splash.velocity[j];
        const candidateAge = alive ? splash.age : 0;
        // 飞溅回到原接雨面的瞬间消失，不让次生小水滴穿过屋面落进室内。
        const aboveSurface = velocity.dot(splash.normal) * candidateAge - 4.905 * splash.normal.y * candidateAge * candidateAge + 0.016 * splash.normal.y > 0;
        const visible = alive && aboveSurface;
        const age = visible ? candidateAge : 0;
        const x = visible ? splash.position.x + velocity.x * age : 0;
        const y = visible ? splash.position.y + velocity.y * age - 4.905 * age * age : -10;
        const z = visible ? splash.position.z + velocity.z * age : 0;
        splashPositions[p] = x;
        splashPositions[p + 1] = y;
        splashPositions[p + 2] = z;
        const previousAge = Math.max(0, age - 0.021);
        splashPositions[p + 3] = visible ? splash.position.x + velocity.x * previousAge : 0;
        splashPositions[p + 4] = visible ? splash.position.y + velocity.y * previousAge - 4.905 * previousAge * previousAge : -10;
        splashPositions[p + 5] = visible ? splash.position.z + velocity.z * previousAge : 0;
      }
    }
    splashAttribute.needsUpdate = true;
    ringMaterial.uniforms.opacity.value = rain * (0.29 + wetness * 0.22);
    ringMaterial.uniforms.color.value.copy(rainMaterial.color);
    for (let i = 0; i < rippleCount; i++) {
      const ripple = ripples[i];
      ripple.age += dt;
      const t = clamp(ripple.age / ripple.life);
      transform.position.copy(ripple.position);
      transform.rotation.set(-Math.PI / 2, 0, 0);
      transform.scale.setScalar(t < 1 ? 0.035 + t * ripple.radius : 0.000001);
      transform.updateMatrix();
      rings.setMatrixAt(i, transform.matrix);
      rippleFade.setX(i, t < 1 ? (1 - t) * (1 - t) : 0);
    }
    rings.instanceMatrix.needsUpdate = true;
    rippleFade.needsUpdate = true;
    for (const entry of puddles) {
      entry.patch.visible = wetness > 0.09;
      const growth = 0.3 + Math.sqrt(clamp((wetness - 0.09) / 0.91)) * 0.7;
      entry.patch.scale.set(entry.sx * growth, entry.sz * growth, 1);
    }
    puddleMaterial.opacity = 0.12 + wetness * 0.28;
    puddleMaterial.envMapIntensity = 0.22 + wetness * 0.34;
    puddleMaterial.color.set('#26384c').lerp(new THREE.Color('#82958e'), daylight);
    updateReflection(daylight);
  }
  update(0, { rain: 0, wetness: 0, daylight: 1 });
  return { group, update, roofHeight, isSheltered,
    get snapshot() {
      return { droplets: count, activeDrops: activeCount, rain: lastRain, wetness: lastWetness, wind: lastWind.toArray(), gravity: 9.81, terminalSpeed: [8.1, 10.2], roofHits, groundHits, waterHits, receivingTriangles: surfaces.length, spatialCells: cells.size, puddles: puddles.length,
        covered: [['喫茶こもれび', [-11.7, 1.7, 15.7]], ['桜坂駅', [4.125, 1.9, -8]], ['观光塔接待厅', [27, 1.8, 3]], ['露天生活街', [-4, 1.7, 18]]].map(([name, point]) => ({ name, position: point, roofHeight: Number(roofHeight(point[0], point[2]).toFixed(3)), sheltered: isSheltered(point) })),
      };
    },
  };
}
