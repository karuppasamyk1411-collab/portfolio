import * as THREE from 'three';

/** Planet radius in world units. */
export const R = 30;
export const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _z = new THREE.Vector3();

/** Small deterministic PRNG so the world looks the same on every visit. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Unit direction on the planet. `angle` = degrees away from the north pole (start point),
 * `bearing` = compass direction in degrees (-90 is straight ahead of the starting rover).
 */
export function dirFrom(angleDeg, bearingDeg) {
  const a = THREE.MathUtils.degToRad(angleDeg);
  const b = THREE.MathUtils.degToRad(bearingDeg);
  return new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)).normalize();
}

/** Terrain height offset for a unit direction (gentle rolling hills). */
export function heightAt(d) {
  return (
    0.22 * Math.sin(d.x * 6.0 + 1.3) * Math.sin(d.z * 5.0 - 0.7) * Math.cos(d.y * 4.0) +
    0.08 * Math.sin(d.x * 17.0 + d.y * 13.0 + d.z * 11.0)
  );
}

export function anyPerpendicular(dir, out = new THREE.Vector3()) {
  const axis = Math.abs(dir.y) < 0.9 ? UP : X_AXIS;
  return out.crossVectors(dir, axis).normalize();
}

/** Unit tangent at `from` that points along the surface towards `to`. */
export function tangentTowards(from, to, out = new THREE.Vector3()) {
  out.copy(to).addScaledVector(from, -to.dot(from));
  if (out.lengthSq() < 1e-8) return anyPerpendicular(from, out);
  return out.normalize();
}

/** Quaternion whose local +Y = up and local +Z = fwd. */
export function orientQuat(up, fwd, out = new THREE.Quaternion()) {
  _z.copy(fwd).addScaledVector(up, -fwd.dot(up)).normalize();
  _x.crossVectors(up, _z).normalize();
  _m.makeBasis(_x, up, _z);
  return out.setFromRotationMatrix(_m);
}

/** Stand an object on the planet surface. `face` = a direction its +Z should look towards. */
export function placeOnSurface(obj, dir, { lift = 0, face = null, spin = 0 } = {}) {
  const d = dir.clone().normalize();
  obj.position.copy(d).multiplyScalar(R + heightAt(d) + lift);
  const f = face ? tangentTowards(d, face) : anyPerpendicular(d);
  orientQuat(d, f, obj.quaternion);
  if (spin) obj.rotateY(spin);
  return obj;
}

/** Move a surface direction along a tangent by `dist` world units. */
export function walk(dir, tangent, dist) {
  const axis = new THREE.Vector3().crossVectors(dir, tangent).normalize();
  return dir.clone().applyAxisAngle(axis, dist / R).normalize();
}

export function shadows(obj, cast = true, receive = false) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

export const NEON = {
  cyan: '#00f0ff',
  magenta: '#ff2bd6',
  green: '#39ff88',
  amber: '#ffb800',
  violet: '#8a5cff',
};

/** Emissive material that glows under bloom. */
export const glowMat = (color, intensity = 2.5) =>
  new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, flatShading: true });

/** Bright line material (values > 1 so bloom picks it up). */
export const lineMat = (color, boost = 2.2, opacity = 1) =>
  new THREE.LineBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(boost),
    transparent: opacity < 1,
    opacity,
    toneMapped: false,
  });

/** Add glowing edges to a mesh. */
export function neonEdges(mesh, color, boost = 2.2, opacity = 1) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), lineMat(color, boost, opacity));
  mesh.add(e);
  return e;
}

const DARK_METAL = new THREE.MeshStandardMaterial({ color: '#141a33', roughness: 0.45, metalness: 0.6, flatShading: true });

/** Dark box with neon edges — the basic building block of the cyber world. */
export function neonBox(w, h, d, color, body = DARK_METAL) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), body);
  neonEdges(m, color);
  return m;
}

export function neonCylinder(rt, rb, h, sides, color, body = DARK_METAL) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, sides), body);
  neonEdges(m, color);
  return m;
}

export { DARK_METAL };

/** Text sprite that always faces the camera. */
export function makeLabel(
  text,
  { height = 1, color = '#ffffff', weight = 700, outline = 'rgba(4,6,20,0.85)', family = '"JetBrains Mono", monospace' } = {},
) {
  const fontSize = 128;
  const font = `${weight} ${fontSize}px ${family}`;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const pad = 32;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = Math.ceil(fontSize * 1.35) + pad;
  c.width = w;
  c.height = h;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = outline;
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((height * w) / h, height, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Shorthand for the low-poly material used everywhere. */
export const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, ...extra });
