import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createKit() {
  let seed = 1042;
  const rng = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const gradientMap = new THREE.DataTexture(new Uint8Array([74, 142, 209, 255]), 4, 1, THREE.RedFormat);
  // 四级明暗保留清晰色块，冷色环境光填入背光面。
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  const materials = new Map();
  const outlines = new Map();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const cubeEdges = new THREE.EdgesGeometry(cube);
  const cylinders = new Map();
  const surfaceWetness = { value: 0 };
  function mat(color) {
    if (color?.isMaterial) return color;
    const key = String(color);
    if (!materials.has(key)) {
      const material = new THREE.MeshToonMaterial({ color, gradientMap });
      material.onBeforeCompile = shader => {
        shader.uniforms.uSurfaceWetness = surfaceWetness;
        // 固定阴影采样方向：保留细柔边，避免屏幕随机采样形成颗粒。
        shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',
          THREE.ShaderChunk.shadowmap_pars_fragment.replace('float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;', 'float phi = 0.0;'));
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintPosition;\nvarying vec3 vPaintNormal;');
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
          vec4 paintPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            paintPosition = instanceMatrix * paintPosition;
          #endif
          vPaintPosition = (modelMatrix * paintPosition).xyz;
          vPaintNormal = normalize(mat3(modelMatrix) * objectNormal);
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintPosition;\nvarying vec3 vPaintNormal;\nuniform float uSurfaceWetness;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float brush = sin(vPaintPosition.x * 1.6 + sin(vPaintPosition.z * 1.1)) * 0.018;
          brush += sin(vPaintPosition.y * 7.0 + sin(vPaintPosition.x * 2.2)) * 0.009;
          diffuseColor.rgb *= 1.0 + brush;
          // 雨水优先浸润朝上的低处表面，墙面不出现整片油亮反射。
          float groundWet = uSurfaceWetness * smoothstep(0.6, 0.95, vPaintNormal.y) * (1.0 - smoothstep(0.3, 1.4, vPaintPosition.y));
          diffuseColor.rgb *= 1.0 - groundWet * 0.22;
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float sunlit = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722));
          outgoingLight *= mix(vec3(0.88, 0.88, 1.16), vec3(1.0), smoothstep(0.015, 0.38, sunlit));
          #include <opaque_fragment>
        `);
      };
      materials.set(key, material);
    }
    return materials.get(key);
  }
  function edgeMaterial(color) {
    const c = new THREE.Color(color);
    const hue = {};
    c.getHSL(hue);
    const key = hue.h < .13 || hue.h > .85 ? 'warm' : 'cool';
    if (!outlines.has(key)) outlines.set(key, new THREE.LineBasicMaterial({ color: key === 'warm' ? '#51404c' : '#3e485a', transparent: true, opacity: .36 }));
    return outlines.get(key);
  }
  function mesh(parent, geometry, color, opts = {}) {
    const item = new THREE.Mesh(geometry, mat(color));
    item.castShadow = opts.castShadow !== false;
    item.receiveShadow = opts.receiveShadow !== false;
    if (opts.rotation) item.rotation.set(...opts.rotation);
    parent.add(item);
    return item;
  }
  function box(parent, x, y, z, w, h, d, color, opts = {}) {
    const item = mesh(parent, cube, color, opts);
    item.position.set(x, y, z);
    item.scale.set(w, h, d);
    if (opts.outline !== false && Math.max(w, h, d) > 1.2 && Math.min(w, h, d) > .12) {
      item.add(new THREE.LineSegments(cubeEdges, edgeMaterial(color?.isMaterial ? color.color : color)));
    }
    return item;
  }
  function cylinder(parent, x, y, z, r, h, color, segments = 8) {
    if (!cylinders.has(segments)) cylinders.set(segments, new THREE.CylinderGeometry(1, 1, 1, segments));
    const item = mesh(parent, cylinders.get(segments), color);
    item.scale.set(r, h, r);
    item.position.set(x, y, z);
    return item;
  }
  function line(parent, points, color = '#5d5665') {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)));
    const item = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .65 }));
    parent.add(item);
    return item;
  }
  function sign(parent, text, x, y, z, w, h, opts = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.max(128, Math.round(1024 * h / w));
    const ctx = canvas.getContext('2d');
    if ((opts.bg ?? '#f8eed7') !== 'transparent') {
      ctx.fillStyle = opts.bg ?? '#f8eed7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (opts.border) {
      ctx.strokeStyle = opts.border;
      ctx.lineWidth = 12;
      ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
    }
    const rows = String(text).split('\n');
    let fontSize = opts.fontSize ?? Math.min(220, canvas.height * .61 / rows.length);
    const family = opts.fontFamily ?? '"Yu Mincho", "Noto Serif JP", "Microsoft YaHei", serif';
    ctx.font = `${opts.fontWeight ?? 600} ${fontSize}px ${family}`;
    const maxWidth = Math.max(...rows.map(row => ctx.measureText(row).width));
    if (maxWidth > canvas.width * .86) fontSize *= canvas.width * .86 / maxWidth;
    ctx.font = `${opts.fontWeight ?? 600} ${fontSize}px ${family}`;
    ctx.fillStyle = opts.fg ?? '#394e4b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    rows.forEach((row, i) => ctx.fillText(row, canvas.width / 2, canvas.height / 2 + (i - (rows.length - 1) / 2) * fontSize * 1.2));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const item = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    item.position.set(x, y, z);
    item.rotation.y = opts.rotationY ?? 0;
    parent.add(item);
    return item;
  }
  function roof(parent, x, y, z, w, d, h, color) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    const a = w / 2, b = d / 2;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -a,0,-b, a,0,-b, a,h,0, -a,h,0,
      -a,h,0, a,h,0, a,0,b, -a,0,b,
      -a,0,b, a,0,b, a,0,-b, -a,0,-b,
      -a,0,-b, -a,h,0, -a,0,b,
      a,0,b, a,h,0, a,0,-b,
    ], 3));
    geometry.setIndex([0,2,1,0,3,2,4,6,5,4,7,6,8,10,9,8,11,10,12,14,13,15,17,16]);
    geometry.computeVertexNormals();
    const item = mesh(group, geometry, color);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial(color));
    group.add(edges);
    box(group, 0, h + .035, 0, w + .12, .13, .15, color, { outline: false });
    // 瓦缝作为低频笔触，仅描出部分屋面接缝。
    for (let i = 1; i < 9; i++) {
      const offset = b * i / 9;
      const height = h * (1 - i / 9) + .025;
      line(group, [[-a,height,offset],[a,height,offset]], '#899194');
      line(group, [[-a,height,-offset],[a,height,-offset]], '#68727c');
    }
    item.userData.roof = true;
    return group;
  }
  return { THREE, rng, mat, box, cylinder, mesh, line, sign, roof,
    setWetness(value) { surfaceWetness.value = THREE.MathUtils.clamp(value, 0, 1); },
  };
}

export function optimizeStaticGroup(group, excluded = []) {
  // 合并同材质的静态几何；电车与飘落花瓣保留独立变换。
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const batches = new Map();
  function collect(item) {
    if (excluded.includes(item) || (item !== group && item.userData.dynamic) || item.isInstancedMesh) return;
    if (item.isMesh && !Array.isArray(item.material)) {
      const key = `${item.material.uuid}:${item.castShadow}:${item.receiveShadow}`;
      if (!batches.has(key)) batches.set(key, { material: item.material, castShadow: item.castShadow, receiveShadow: item.receiveShadow, items: [] });
      batches.get(key).items.push(item);
    }
    [...item.children].forEach(collect);
  }
  collect(group);
  for (const batch of batches.values()) {
    if (batch.items.length < 2 || batch.material.transparent || batch.material.map) continue;
    const geometries = batch.items.map(item => {
      const geometry = item.geometry.clone();
      if (geometry.index) {
        const expanded = geometry.toNonIndexed();
        geometry.dispose();
        return expanded;
      }
      return geometry;
    });
    geometries.forEach((geometry, i) => {
      geometry.applyMatrix4(inverse.clone().multiply(batch.items[i].matrixWorld));
      for (const attr of Object.keys(geometry.attributes)) if (attr !== 'position' && attr !== 'normal') geometry.deleteAttribute(attr);
    });
    const geometry = mergeGeometries(geometries, false);
    if (!geometry) continue;
    const merged = new THREE.Mesh(geometry, batch.material);
    merged.castShadow = batch.castShadow;
    merged.receiveShadow = batch.receiveShadow;
    // 线框要保留原世界变换，不能随已合并的网格消失。
    for (const item of batch.items) {
      for (const child of [...item.children]) {
        child.applyMatrix4(inverse.clone().multiply(item.matrixWorld));
        group.add(child);
      }
      item.removeFromParent();
    }
    group.add(merged);
    geometries.forEach(g => g.dispose());
  }
  group.updateWorldMatrix(true, true);
  const lineBatches = new Map();
  function collectLines(item) {
    if (excluded.includes(item) || (item !== group && item.userData.dynamic)) return;
    if (item.isLine && !Array.isArray(item.material)) {
      const key = `${item.material.color.getHex()}:${item.material.opacity}:${item.material.depthTest}`;
      if (!lineBatches.has(key)) lineBatches.set(key, { material: item.material, items: [] });
      lineBatches.get(key).items.push(item);
    }
    [...item.children].forEach(collectLines);
  }
  collectLines(group);
  for (const batch of lineBatches.values()) {
    if (batch.items.length < 2) continue;
    const points = [];
    const vertex = new THREE.Vector3();
    for (const item of batch.items) {
      const position = item.geometry.getAttribute('position');
      const index = item.geometry.index;
      const count = index ? index.count : position.count;
      const transform = inverse.clone().multiply(item.matrixWorld);
      const stride = item.isLineSegments ? 2 : 1;
      for (let i = 0; i < count - 1; i += stride) {
        for (const j of [i, i + 1]) {
          vertex.fromBufferAttribute(position, index ? index.getX(j) : j).applyMatrix4(transform);
          points.push(vertex.x, vertex.y, vertex.z);
        }
      }
      item.removeFromParent();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    group.add(new THREE.LineSegments(geometry, batch.material));
  }
}
