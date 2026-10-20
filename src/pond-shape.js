// 鱼塘开挖、水面和步行边界共用同一条以米为单位的圆角岸线。
export function pondDistance(x, z, pond, expansion = 0) {
  const radius = pond.cornerRadius + expansion;
  const qx = Math.abs(x - pond.x) - pond.width / 2 + pond.cornerRadius;
  const qz = Math.abs(z - pond.z) - pond.depth / 2 + pond.cornerRadius;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - radius;
}

export function roundedPondPath(THREE, pond, expansion = 0) {
  const path = new THREE.Path();
  const x = pond.x;
  // ShapeGeometry 在 XY 绘制，旋转到地面后其 Y 方向对应负 Z。
  const y = -pond.z;
  const w = pond.width / 2 + expansion;
  const d = pond.depth / 2 + expansion;
  const r = pond.cornerRadius + expansion;
  path.moveTo(x - w + r, y - d);
  path.lineTo(x + w - r, y - d);
  path.absarc(x + w - r, y - d + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + d - r);
  path.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  path.lineTo(x - w + r, y + d);
  path.absarc(x - w + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x - w, y - d + r);
  path.absarc(x - w + r, y - d + r, r, Math.PI, Math.PI * 1.5, false);
  path.closePath();
  return path;
}
