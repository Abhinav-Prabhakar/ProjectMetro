// ---------------------------------------------------------------------------
// Small geometry helpers (three's BufferGeometryUtils is not vendored)
// ---------------------------------------------------------------------------

import * as THREE from 'three';

export function normalizeGeometry(geom) {
  let g = geom;
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

export function mergeGeometries(list) {
  const geoms = list.filter(Boolean).map(normalizeGeometry);
  if (!geoms.length) return null;
  let vCount = 0;
  let iCount = 0;
  for (const g of geoms) {
    vCount += g.attributes.position.count;
    iCount += g.index.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  // Vertex colours are optional. When any input carries them the merged
  // geometry must carry them too, otherwise a `vertexColors: true` material
  // reads every vertex as black — which is exactly how the train proxies
  // turned into moving silhouettes.
  const hasColor = geoms.some((g) => g.attributes.color);
  const col = hasColor ? new Float32Array(vCount * 3) : null;
  if (hasColor) col.fill(1);
  const idx = new (vCount > 65535 ? Uint32Array : Uint16Array)(iCount);
  let vo = 0;
  let io = 0;
  for (const g of geoms) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const t = g.attributes.uv.array;
    pos.set(p, vo * 3);
    nor.set(n, vo * 3);
    uv.set(t, vo * 2);
    if (col && g.attributes.color) col.set(g.attributes.color.array, vo * 3);
    const gi = g.index.array;
    for (let k = 0; k < gi.length; k++) idx[io + k] = gi[k] + vo;
    vo += g.attributes.position.count;
    io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/**
 * Collect every mesh under `root` into buckets keyed by material, merge each
 * bucket into one draw call, and return the replacement group. Meshes tagged
 * `userData.keep` (doors, wheels, animated parts) are left alone.
 */
export function mergeByMaterial(root) {
  const buckets = new Map();
  const keep = [];
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();

  root.traverse((o) => {
    if (o === root) return;
    if (o.userData.keep) { keep.push(o); return; }
    if (!o.isMesh) return;
    if (o.parent && o.parent.userData.keep) return;
    if (Array.isArray(o.material)) return;
    const key = o.material;
    if (!buckets.has(key)) buckets.set(key, []);
    const g = o.geometry.clone();
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(m);
    buckets.get(key).push(g);
  });

  const group = new THREE.Group();
  group.name = root.name + '-merged';
  for (const [mat, geoms] of buckets) {
    const merged = mergeGeometries(geoms);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = !!mat.userData.castShadow;
    mesh.receiveShadow = !!mat.userData.receiveShadow;
    group.add(mesh);
    geoms.forEach((g) => g.dispose());
  }
  // preserve animated descendants by re-parenting them
  for (const o of keep) {
    o.updateMatrixWorld(true);
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    o.matrix.copy(m);
    o.matrix.decompose(o.position, o.quaternion, o.scale);
    group.add(o);
  }
  return group;
}
