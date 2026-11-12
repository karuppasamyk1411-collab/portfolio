import * as THREE from 'three';
import { R, heightAt, NEON } from './utils.js';

// Paved roads along great-circle arcs between landmarks.
// Returns sample points so props can be kept off the tarmac.

const WIDTH = 2.4;
const STEP = 0.5; // world units between samples
const LIFT = 0.09;

const _t = new THREE.Vector3();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

function arcPoints(a, b, trimStart, trimEnd) {
  const ang = a.angleTo(b);
  const len = ang * R;
  const from = trimStart / len;
  const to = 1 - trimEnd / len;
  const n = Math.max(2, Math.ceil(((to - from) * len) / STEP));
  const axis = new THREE.Vector3().crossVectors(a, b).normalize();
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = from + ((to - from) * i) / n;
    pts.push(a.clone().applyAxisAngle(axis, ang * f));
  }
  return pts;
}

// push a ribbon strip (offset across the road from `o0` to `o1`) into position/index arrays
function ribbon(pts, o0, o1, pos, idx, lift, every = 0) {
  for (let i = 0; i < pts.length - 1; i++) {
    if (every && i % every !== 0) continue; // dashes
    const base = pos.length / 3;
    for (const j of [i, i + 1]) {
      const p = pts[j];
      const q = pts[Math.min(j + 1, pts.length - 1)];
      const r = pts[Math.max(j - 1, 0)];
      _t.subVectors(q, r).normalize();
      _s.crossVectors(p, _t).normalize();
      for (const o of [o0, o1]) {
        _p.copy(p).addScaledVector(_s, o / R).normalize();
        _p.multiplyScalar(R + heightAt(_p) + lift);
        pos.push(_p.x, _p.y, _p.z);
      }
    }
    idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
}

function mesh(pos, idx, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/**
 * links: [{ from: dir, to: dir, trimStart, trimEnd }]
 */
export function createRoads(scene, links) {
  const asphalt = { pos: [], idx: [] };
  const edges = { pos: [], idx: [] };
  const dashes = { pos: [], idx: [] };
  const samples = [];

  for (const l of links) {
    const pts = arcPoints(l.from, l.to, l.trimStart ?? 0, l.trimEnd ?? 0);
    ribbon(pts, -WIDTH / 2, WIDTH / 2, asphalt.pos, asphalt.idx, LIFT);
    ribbon(pts, -WIDTH / 2, -WIDTH / 2 + 0.1, edges.pos, edges.idx, LIFT + 0.01);
    ribbon(pts, WIDTH / 2 - 0.1, WIDTH / 2, edges.pos, edges.idx, LIFT + 0.01);
    ribbon(pts, -0.06, 0.06, dashes.pos, dashes.idx, LIFT + 0.01, 3);
    for (let i = 0; i < pts.length; i += 2) samples.push({ dir: pts[i], radius: WIDTH / 2 });
  }

  const road = mesh(
    asphalt.pos,
    asphalt.idx,
    new THREE.MeshStandardMaterial({
      color: '#161c3a', roughness: 0.85, metalness: 0.1,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  );
  road.receiveShadow = true;
  const edgeMesh = mesh(
    edges.pos,
    edges.idx,
    new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.cyan).multiplyScalar(1.6), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  const dashMesh = mesh(
    dashes.pos,
    dashes.idx,
    new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.amber).multiplyScalar(1.3), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  scene.add(road, edgeMesh, dashMesh);
  return { samples };
}
