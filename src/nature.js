export function createNature(kit) {
  const { THREE, mat, rng } = kit;
  const group = new THREE.Group();
  group.name = '樱花与远山';
  const random = (min, max) => min + rng() * (max - min);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const blossomColors = ['#fff5f5', '#fce8ee', '#f7dce7', '#fffaf6', '#eee5f0'];
  const barkColors = ['#65504c', '#765748', '#574650', '#83624f'];
  const branches = [];
  const blossoms = [];
  const groundPetals = [];
  const shrubs = [];
  const trees = [];
  const breeze = new THREE.Vector2(-0.35, 0.16);

  // 五片微弯的薄花瓣有清楚的顶端缺口，花心和细蕊也属于同一份共享几何。
  function makeBlossomGeometry() {
    const positions = [];
    const normals = [];
    const colors = [];
    function vertex(point, normal, tint) {
      positions.push(...point);
      normals.push(...normal);
      const value = new THREE.Color(tint);
      colors.push(value.r, value.g, value.b);
    }
    function triangle(a, b, c, tint) {
      for (const point of [a, b, c]) vertex(point, [0, 0, 1], tint);
    }
    for (let petal = 0; petal < 5; petal += 1) {
      const angle = (petal / 5) * Math.PI * 2;
      const points = [[0, 0.075, 0.001], [-0.16, 0.25, 0.019], [-0.255, 0.47, 0.055], [-0.19, 0.665, 0.089], [-0.06, 0.785, 0.116], [0, 0.722, 0.078], [0.06, 0.785, 0.12], [0.19, 0.665, 0.089], [0.255, 0.47, 0.055], [0.16, 0.25, 0.019]];
      const rotate = ([x, y, z]) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z];
      for (let i = 0; i < points.length; i += 1) {
        for (const point of [[0, 0.405, 0.031], points[(i + 1) % points.length], points[i]]) {
          const normal = new THREE.Vector3(-point[0] * 0.12, -point[1] * 0.26, 1).normalize();
          const orientedNormal = [normal.x * Math.cos(angle) - normal.y * Math.sin(angle), normal.x * Math.sin(angle) + normal.y * Math.cos(angle), normal.z];
          vertex(rotate(point), orientedNormal, point[1] > 0.54 ? '#fffaf7' : point[1] < 0.2 ? '#efd0dd' : '#ffedf2');
        }
      }
    }
    for (let i = 0; i < 6; i += 1) {
      const a = i / 6 * Math.PI * 2;
      const b = (i + 1) / 6 * Math.PI * 2;
      triangle([0, 0, 0.018], [Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.018], [Math.cos(b) * 0.085, Math.sin(b) * 0.085, 0.018], '#dcb4c1');
      const start = [Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0.03];
      const end = [Math.cos(a) * 0.145, Math.sin(a) * 0.145, 0.07];
      const dx = Math.sin(a) * 0.007;
      const dy = -Math.cos(a) * 0.007;
      const p0 = [start[0] - dx, start[1] - dy, start[2]];
      const p1 = [start[0] + dx, start[1] + dy, start[2]];
      const p2 = [end[0] + dx, end[1] + dy, end[2]];
      const p3 = [end[0] - dx, end[1] - dy, end[2]];
      triangle(p0, p1, p2, '#b98e9e');
      triangle(p0, p2, p3, '#b98e9e');
      triangle([end[0] - 0.017, end[1] - 0.009, 0.073], [end[0] + 0.017, end[1] - 0.009, 0.073], [end[0], end[1] + 0.018, 0.073], '#d1b690');
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, -0.5);
  petalShape.bezierCurveTo(0.38, -0.26, 0.4, 0.18, 0.15, 0.5);
  petalShape.lineTo(0, 0.41);
  petalShape.lineTo(-0.15, 0.5);
  petalShape.bezierCurveTo(-0.4, 0.18, -0.38, -0.26, 0, -0.5);
  const petalGeometry = new THREE.ShapeGeometry(petalShape, 3);
  const petalPositions = petalGeometry.getAttribute('position');
  for (let i = 0; i < petalPositions.count; i += 1) {
    const along = petalPositions.getY(i) + 0.5;
    petalPositions.setZ(i, Math.sin(along * Math.PI) * 0.028 + along * along * 0.07 + petalPositions.getX(i) * 0.012);
  }
  petalGeometry.computeVertexNormals();
  const petalMaterial = mat('#ffffff').clone();
  petalMaterial.side = THREE.DoubleSide;
  const flowerMaterial = mat('#ffffff').clone();
  flowerMaterial.side = THREE.DoubleSide;
  flowerMaterial.vertexColors = true;

  function createInstances(geometry, material, entries, shadows = false, name = '') {
    const instance = new THREE.InstancedMesh(geometry, material, entries.length);
    instance.name = name;
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      dummy.position.set(entry.x, entry.y, entry.z);
      dummy.rotation.set(entry.rx || 0, entry.ry || 0, entry.rz || 0);
      if (entry.quaternion) dummy.quaternion.copy(entry.quaternion);
      dummy.scale.set(entry.sx ?? entry.scale ?? 1, entry.sy ?? entry.scale ?? 1, entry.sz ?? entry.scale ?? 1);
      dummy.updateMatrix();
      instance.setMatrixAt(i, dummy.matrix);
      instance.setColorAt(i, color.set(entry.color || '#ffffff'));
    }
    instance.castShadow = shadows;
    instance.receiveShadow = shadows;
    group.add(instance);
    return instance;
  }

  function branch(start, end, radius, branchColor = barkColors[0]) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    branches.push({
      x: center.x, y: center.y, z: center.z,
      sx: radius, sy: direction.length(), sz: radius,
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
      color: branchColor,
    });
  }

  function floweringTip(center, scale) {
    // 细枝承托三朵一组的花，花间留空，树冠没有隐藏的粉色体块。
    for (let i = 0; i < 7; i += 1) {
      const angle = i / 7 * Math.PI * 2 + random(-0.3, 0.3);
      const radius = random(0.43, 1.05) * scale;
      const bud = center.clone().add(new THREE.Vector3(Math.cos(angle) * radius, random(-0.38, 0.46) * scale, Math.sin(angle) * radius * 0.84));
      const middle = center.clone().lerp(bud, 0.56);
      middle.y += 0.11 * scale;
      branch(center, middle, 0.013 * scale, '#826469');
      branch(middle, bud, 0.0075 * scale, '#92777a');
      for (let j = 0; j < 3; j += 1) {
        const theta = angle + j / 3 * Math.PI * 2;
        const normal = new THREE.Vector3(Math.cos(theta) * 0.68, random(0.26, 0.92), Math.sin(theta) * 0.68).normalize();
        const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), random(0, Math.PI * 2)));
        blossoms.push({
          x: bud.x + Math.cos(theta) * 0.12 * scale,
          y: bud.y + 0.035 * j * scale,
          z: bud.z + Math.sin(theta) * 0.12 * scale,
          scale: random(0.14, 0.22) * scale,
          quaternion: orientation,
          color: blossomColors[bud.y < center.y - 0.13 * scale ? 4 : Math.floor(random(0, 4))],
        });
      }
    }
  }

  function sakura(x, z, scale = 1, arms = 6) {
    trees.push({ x, z, scale, height: 7.6 * scale });
    const at = (px, py, pz) => new THREE.Vector3(x + px * scale, py * scale, z + pz * scale);
    const bend = random(-0.3, 0.3);
    const trunk = [at(0, 0, 0), at(-0.08, 1.65, 0.1), at(bend, 3.2, -0.02), at(bend + 0.22, 4.65, 0.08), at(bend + 0.12, 5.9, -0.08)];
    for (let i = 0; i < trunk.length - 1; i += 1) branch(trunk[i], trunk[i + 1], (0.27 - i * 0.055) * scale, barkColors[i % barkColors.length]);
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      branch(at(Math.cos(a) * 0.65, 0.03, Math.sin(a) * 0.58), at(0, 0.7, 0), 0.16 * scale, barkColors[2]);
    }
    for (let i = 0; i < arms; i += 1) {
      const angle = (i / arms) * Math.PI * 2 + random(-0.2, 0.2);
      const start = at(bend, random(2.6, 4.3), 0);
      const reach = random(1.75, 2.55);
      const joint = at(Math.cos(angle) * reach * 0.66, random(4.2, 5.15), Math.sin(angle) * reach * 0.58);
      const tip = at(Math.cos(angle) * reach, random(5.3, 6.25), Math.sin(angle) * reach * 0.87);
      branch(start, joint, 0.13 * scale, barkColors[i % 4]);
      branch(joint, tip, 0.075 * scale, barkColors[(i + 1) % 4]);
      for (let fork = 0; fork < 3; fork += 1) {
        const a = angle + (fork - 1) * 0.76;
        const length = random(0.68, 1.3);
        const endpoint = tip.clone().add(new THREE.Vector3(Math.cos(a) * length * scale, random(0.22, 0.88) * scale, Math.sin(a) * length * 0.82 * scale));
        branch(tip, endpoint, 0.035 * scale, barkColors[2]);
        floweringTip(endpoint, scale * random(0.87, 1.12));
      }
      floweringTip(joint.clone().lerp(tip, 0.75), scale * 0.78);
    }
    // 中央高冠与六组内层花枝连接周边枝梢，形成饱满而有起伏的冠层。
    const crownTop = at(bend + 0.18, 6.7, -0.08);
    branch(trunk[4], crownTop, 0.055 * scale, barkColors[2]);
    floweringTip(crownTop.clone().add(new THREE.Vector3(0, 0.18 * scale, 0)), scale * 1.06);
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const center = at(bend + Math.cos(angle) * 1.24, 6.18 + Math.sin(angle + 0.5) * 0.42, Math.sin(angle) * 1.1);
      branch(trunk[3], center, 0.043 * scale, barkColors[2]);
      floweringTip(center, scale * 0.97);
    }

    // 树脚保留裸土与低矮树池，让树干与生活街道真正接地。
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.05 * scale, 1.13 * scale, 0.04, 12), mat('#aaa494'));
    soil.position.set(x, 0.025, z);
    soil.receiveShadow = true;
    group.add(soil);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.08 * scale, 0.055 * scale, 3, 16), mat('#bebaaa'));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.08, z);
    group.add(rim);
    for (let i = 0; i < 165; i += 1) {
      const angle = random(0, Math.PI * 2);
      const radius = Math.sqrt(rng()) * random(1.15, 2.75) * scale;
      groundPetals.push({ x: x + Math.cos(angle) * radius, y: random(0.048, 0.067), z: z + Math.sin(angle) * radius, scale: random(0.03, 0.065), rx: -Math.PI / 2, rz: random(0, 6.3), color: blossomColors[Math.floor(random(0, 4))] });
    }
  }

  sakura(23, -4, 1.14, 7);
  sakura(24, -25, 0.94, 6);
  sakura(-17, -12, 0.94, 6);
  sakura(-8.85, 11.7, 0.74, 5);
  // 樱花退到侧院与铁道边，根部和低枝不侵入住宅门口及室内楼梯。
  sakura(18.5, 21.5, 1.13, 6);
  sakura(3, -25.7, 0.85, 6);
  sakura(-25, -30, 0.93, 6);

  createInstances(new THREE.CylinderGeometry(0.58, 1, 1, 7), mat('#ffffff'), branches, true, '有自然分叉的樱花树干');
  const flowers = createInstances(makeBlossomGeometry(), flowerMaterial, blossoms, true, '枝梢上的五瓣薄片樱花');
  flowers.receiveShadow = false;
  group.userData.sakuraTrees = trees;
  group.userData.blossomCount = blossoms.length;
  group.userData.cloudCount = 0;

  // 花瓣集中在排水沟、店铺墙角与树下；街心只留下零星几片。
  for (let i = 0; i < 1020; i += 1) {
    const side = i % 2 === 0 ? -7 : -1;
    groundPetals.push({ x: side + random(-0.25, 0.22), y: random(0.09, 0.12), z: random(-4.5, 33), scale: random(0.027, 0.06), rx: -Math.PI / 2, rz: random(0, 6.3), color: blossomColors[Math.floor(random(0, 4))] });
  }
  for (let i = 0; i < 120; i += 1) {
    groundPetals.push({ x: random(-6.7, -1.3), y: 0.066, z: random(-4.5, 33), scale: random(0.025, 0.052), rx: -Math.PI / 2, rz: random(0, 6.3), color: blossomColors[Math.floor(random(0, 4))] });
  }
  const corners = [[0.2, -5.4], [9.5, -4.2], [-9.3, 5.5], [11, 14], [-10.4, 24.5]];
  for (const [x, z] of corners) {
    for (let i = 0; i < 52; i += 1) groundPetals.push({ x: x + random(-0.75, 0.75), y: 0.104, z: z + random(-0.3, 0.4), scale: random(0.03, 0.065), rx: -Math.PI / 2, rz: random(0, 6.3), color: blossomColors[Math.floor(random(0, 4))] });
  }
  createInstances(petalGeometry, petalMaterial, groundPetals, false, '路缘与树下的落樱');

  // 近处灌丛以小叶块组成，颜色随朝向变化，避免油亮的写实材质。
  const shrubLocations = [[15, -11], [16.1, -11.2], [22, -5], [23.4, -5.5], [-12, -9], [-14, -8.5], [13, 18.5], [15, 20], [8, -28], [-23, -24]];
  for (const [x, z] of shrubLocations) {
    for (let i = 0; i < 17; i += 1) {
      shrubs.push({ x: x + random(-0.8, 0.8), y: random(0.27, 0.62), z: z + random(-0.5, 0.5), sx: random(0.24, 0.47), sy: random(0.24, 0.4), sz: random(0.24, 0.47), ry: random(0, 6.3), color: ['#88a97d', '#799d7a', '#a4bd88', '#648b78'][i % 4] });
    }
  }
  createInstances(new THREE.IcosahedronGeometry(1, 0), mat('#ffffff'), shrubs, true, '车站庭院灌丛');

  const grass = [];
  const grassGeometry = new THREE.BufferGeometry();
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.08, 0, 0, 0, 1, 0, 0.08, 0, 0, 0, 0, -0.08, 0, 0.83, 0, 0, 0, 0.08], 3));
  grassGeometry.computeVertexNormals();
  const grassMaterial = mat('#ffffff').clone();
  grassMaterial.side = THREE.DoubleSide;
  for (const [x, z] of shrubLocations) {
    for (let i = 0; i < 15; i += 1) grass.push({ x: x + random(-1.2, 1.2), y: 0.04, z: z + random(-0.7, 0.7), sx: random(0.65, 1.2), sy: random(0.1, 0.27), sz: random(0.65, 1.2), ry: random(0, 6.3), color: ['#879e74', '#b0ba8c', '#7c9c80'][i % 3] });
  }
  createInstances(grassGeometry, grassMaterial, grass, false, '树池旁的小草');

  // 远山使用连续的低频轮廓，层层叠出晴朗午后的空气感。
  function hills(z, base, tint, peaks, heightScale = 1) {
    const vertices = [];
    const indices = [];
    const samples = 140, rows = 20, halfDepth = 21;
    for (let row = 0; row <= rows; row += 1) for (let i = 0; i <= samples; i += 1) {
      const x = -190 + (i / samples) * 440;
      let y = base;
      for (const peak of peaks) y += peak[1] * Math.exp(-(((x - peak[0]) / peak[2]) ** 2));
      const crossSection = Math.sin(row / rows * Math.PI) ** 1.6;
      const endFalloff = Math.min(1, Math.max(0, (x + 190) / 35), Math.max(0, (250 - x) / 35));
      vertices.push(x, -.05 + y * heightScale * crossSection * endFalloff, z + (row / rows * 2 - 1) * halfDepth);
      if (i < samples && row < rows) {
        const n = row * (samples + 1) + i, next = n + samples + 1;
        indices.push(n, next, n + 1, n + 1, next, next + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mountain = new THREE.Mesh(geometry, mat(tint));
    mountain.name = '有前后缓坡的层叠远山';
    group.add(mountain);
  }
  hills(-144, 5.5, '#b4bdcf', [[-79, 16, 24], [-31, 19, 28], [27, 15, 31], [85, 19, 28], [155, 17, 34], [211, 12, 28]], 0.83);
  hills(-114, 2.8, '#a1b6b8', [[-90, 12, 25], [-45, 12, 23], [3, 10.5, 29], [54, 14, 25], [103, 10, 24], [160, 13, 38], [215, 9, 29]], 0.88);
  hills(-88, 1.7, '#90aaa0', [[-89, 8, 27], [-47, 9, 24], [8, 6.5, 30], [58, 8.5, 30], [111, 8, 24], [170, 8, 34], [218, 5, 26]], 0.94);

  const distantTrees = [];
  for (let i = 0; i < 95; i += 1) {
    const x = -65 + i * 1.4;
    const height = random(1.6, 3.5);
    distantTrees.push({ x, y: height / 2, z: -48 + random(-3.5, 3.5), sx: random(0.6, 1.25), sy: height, sz: random(0.6, 1.25), color: ['#86a18d', '#77988c', '#94ac98', '#9daf9d'][i % 4] });
  }
  createInstances(new THREE.ConeGeometry(1, 1, 7), mat('#ffffff'), distantTrees, false, '地平线林带');

  const clouds = [];
  for (const [x, y, z, scale] of [[-37, 20, -68, 1.1], [28, 23, -84, 1.25], [62, 18.5, -71, 0.95], [-7, 25, -90, 0.72], [-67, 17.5, -66, 0.78], [44, 16.5, -60, 0.65]]) {
    for (let i = 0; i < 9; i += 1) {
      const offset = (i - 4) * 1.35 * scale;
      clouds.push({ x: x + offset, y: y + Math.sin((i / 8) * Math.PI) * 1.15 * scale, z, sx: random(1.3, 2.2) * scale, sy: random(0.65, 1.25) * scale, sz: 0.6 * scale, color: i % 4 === 0 ? '#ede5e1' : '#fff6e7' });
    }
  }
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  createInstances(new THREE.IcosahedronGeometry(1, 2), cloudMaterial, clouds, false, '蜂蜜色天空中的薄云');

  const floating = [];
  const treeSelection = [0, 0, 0, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 6];
  for (let i = 0; i < 210; i += 1) {
    const tree = trees[treeSelection[Math.floor(random(0, treeSelection.length))]];
    const angle = random(0, Math.PI * 2);
    const radius = Math.sqrt(rng()) * 2.8 * tree.scale;
    const streetborne = i % 5 === 0;
    const height = streetborne ? random(2.8, 4.4) : tree.height;
    floating.push({
      x: streetborne ? random(-6.8, -0.5) : tree.x + Math.cos(angle) * radius,
      y: random(0.35, height),
      z: streetborne ? [10, 24, -3][i % 3] + random(-5, 5) : tree.z + Math.sin(angle) * radius * 0.85,
      height, phase: random(0, Math.PI * 2), fall: random(0.16, 0.35),
      scale: random(0.04, 0.078), color: blossomColors[Math.floor(random(0, 4))],
    });
  }
  const airbornePetals = createInstances(petalGeometry, petalMaterial, floating, false, '缓缓飘落的樱花瓣');
  group.userData.floatingPetalCount = floating.length;
  airbornePetals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  airbornePetals.frustumCulled = false;

  function update(time) {
    for (let i = 0; i < floating.length; i += 1) {
      const petal = floating[i];
      const cycle = ((petal.y - time * petal.fall) % petal.height + petal.height) % petal.height;
      const descent = 1 - cycle / petal.height;
      const flutter = 0.8 + Math.min(breeze.length(), 3) * 0.18;
      dummy.position.set(petal.x + descent * breeze.x * 1.9 + Math.sin(time * 0.38 + petal.phase) * 0.48 * flutter, 0.2 + cycle, petal.z + descent * breeze.y * 1.9 + Math.cos(time * 0.31 + petal.phase) * 0.3 * flutter);
      dummy.rotation.set(Math.sin(time * 0.8 + petal.phase) * 0.75, time * 0.35 + petal.phase, Math.sin(time * 0.65 + petal.phase) * 0.9);
      dummy.scale.setScalar(petal.scale);
      dummy.updateMatrix();
      airbornePetals.setMatrixAt(i, dummy.matrix);
    }
    airbornePetals.instanceMatrix.needsUpdate = true;
  }

  function setPetalsVisible(visible) {
    airbornePetals.visible = visible;
  }

  update(0);
  return { group, update, setPetalsVisible,
    setEnvironment({ wind, daylight }) {
      breeze.copy(wind);
      cloudMaterial.color.setRGB(0.22 + daylight * 0.78, 0.29 + daylight * 0.71, 0.42 + daylight * 0.58);
    },
  };
}
