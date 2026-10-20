import assert from 'node:assert/strict';
import { createKit } from '../src/kit.js';
import { createLake, LAKE_LAYOUT } from '../src/lake.js';
import { pondDistance } from '../src/pond-shape.js';

// 模块验证只模拟招牌画布接口，湖底和鱼群仍使用真实 Three.js 几何。
globalThis.document = { createElement() { return { width: 1, height: 1, getContext() { return { fillRect() {}, strokeRect() {}, fillText() {}, measureText(text) { return { width: text.length * 90 }; } }; } }; } };
const kit = createKit();
const lake = createLake(kit);
const pond = lake.ponds[0];
assert.equal(LAKE_LAYOUT[0].x, 100);
assert.equal(lake.snapshot.fishCount, 32);
assert.equal(pond.bottomAt(100, -4), -9.5);
assert.equal(pond.bottomAt(66, -4), 0.052);
assert.equal(pond.bottomAt(134, -4), 0.052);
let attributeCount = 0, lakebedVertices = 0;
lake.group.traverse(object => {
  if (!object.geometry) return;
  for (const attribute of Object.values(object.geometry.attributes)) {
    attributeCount += 1;
    for (const value of attribute.array) assert(Number.isFinite(value));
  }
  if (object.name.includes('九米半')) {
    const positions = object.geometry.getAttribute('position');
    lakebedVertices = positions.count;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i), z = positions.getZ(i);
      assert(Math.abs(pond.bottomAt(x + pond.x, z + pond.z) - positions.getY(i)) < 2e-6);
    }
    const normals = object.geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i += 1) assert(normals.getY(i) > 0.05, '湖底三角形应朝向水中');
  }
});
for (const spot of lake.fishingSpots) {
  assert(pondDistance(spot.castTarget[0], spot.castTarget[2], pond) < -1);
}
assert(pondDistance(...[lake.entry[0], lake.entry[2]], pond) < 0);
for (let i = 0; i < 7200; i += 1) lake.update(1 / 60);
for (const fish of lake.snapshot.fish) {
  for (const value of Object.values(fish)) assert(Number.isFinite(value));
  assert(fish.boundaryDistance < -0.4);
  assert(fish.y > fish.bottom + 0.3 && fish.y < pond.waterY - 0.2);
  assert(fish.speed < 0.85);
}
const lake30 = createLake(createKit());
const lake60 = createLake(createKit());
for (let i = 0; i < 300; i += 1) lake30.update(1 / 30);
for (let i = 0; i < 600; i += 1) lake60.update(1 / 60);
assert.equal(lake30.snapshot.physicalSteps, lake60.snapshot.physicalSteps);
for (let i = 0; i < lake30.snapshot.fish.length; i += 1) {
  const a = lake30.snapshot.fish[i], b = lake60.snapshot.fish[i];
  assert(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9);
}
console.log(JSON.stringify({ finite: true, attributes: attributeCount, lakebedVertices, fishCount: lake.snapshot.fishCount,
  time: lake.snapshot.time, deepestBed: pond.bottomAt(100, -4), shoreHeight: pond.bottomAt(66, -4), fixedStepMatches: true,
  fishingSpots: lake.fishingSpots, entry: lake.entry }));
