import * as THREE from 'three';
import { R, UP, glowMat } from './utils.js';

// Incoming attack packets (red) that get stopped by the planet's firewall shield (blue).
export const SHIELD_R = R + 22;

const RED = '#ff1f3d';
const BLUE = '#2f9bff';

const ATTACKS = [
  { proto: 'tcp', port: 22, mitre: 'T1110 brute force' },
  { proto: 'tcp', port: 3389, mitre: 'T1021 remote services' },
  { proto: 'tcp', port: 445, mitre: 'T1210 exploit remote svc' },
  { proto: 'udp', port: 53, mitre: 'T1071.004 DNS C2' },
  { proto: 'tcp', port: 443, mitre: 'T1190 public-facing app' },
  { proto: 'tcp', port: 8080, mitre: 'T1595 active scanning' },
];

export function createDefense(scene, { onBlocked }) {
  // threats
  const threatGeo = new THREE.OctahedronGeometry(0.55, 0);
  const trailGeo = new THREE.CylinderGeometry(0.0, 0.14, 7, 5);
  trailGeo.translate(0, -3.5, 0); // tail extends behind along -Y
  const threatMat = glowMat(RED, 5);
  const trailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(RED).multiplyScalar(2), transparent: true, opacity: 0.6, toneMapped: false });
  const threats = [];
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(threatGeo, threatMat), new THREE.Mesh(trailGeo, trailMat));
    g.visible = false;
    scene.add(g);
    threats.push({ g, vel: new THREE.Vector3(), alive: false });
  }

  // shield impact: hexagon ripples + a brief hex "panel" of the shield lighting up
  const hexRing = new THREE.RingGeometry(0.85, 1, 6);
  const hexFill = new THREE.CircleGeometry(1, 6);
  const ripples = [];
  for (let i = 0; i < 12; i++) {
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE).multiplyScalar(2.5), transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    const fillMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE), transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    const g = new THREE.Group();
    const ring = new THREE.Mesh(hexRing, ringMat);
    const ring2 = new THREE.Mesh(hexRing, ringMat);
    const fill = new THREE.Mesh(hexFill, fillMat);
    g.add(ring, ring2, fill);
    g.visible = false;
    scene.add(g);
    ripples.push({ g, ring, ring2, fill, ringMat, fillMat, life: 1 });
  }
  // sparks flying back off the shield
  const sparkGeo = new THREE.OctahedronGeometry(0.18, 0);
  const sparkMat = glowMat(RED, 4);
  const sparks = [];
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(sparkGeo, sparkMat);
    m.visible = false;
    scene.add(m);
    sparks.push({ m, vel: new THREE.Vector3(), life: 1 });
  }

  let rippleIdx = 0;
  let sparkIdx = 0;
  let spawnTimer = 1.5;
  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);

  function spawn(focusUp) {
    const t = threats.find((x) => !x.alive);
    if (!t) return;
    // come from somewhere in the player's sky so it's visible
    const from = _v
      .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .multiplyScalar(1.6)
      .add(focusUp)
      .normalize();
    t.g.position.copy(from).multiplyScalar(150);
    // aim at a point on the planet near the player
    const aim = focusUp
      .clone()
      .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.5))
      .normalize()
      .multiplyScalar(R);
    t.vel.copy(aim).sub(t.g.position).normalize().multiplyScalar(45 + Math.random() * 25);
    t.g.quaternion.setFromUnitVectors(UP, _v.copy(t.vel).normalize());
    t.alive = true;
    t.g.visible = true;
  }

  function impact(point) {
    const n = _v.copy(point).normalize();
    _q.setFromUnitVectors(Z, n);
    for (let k = 0; k < 2; k++) {
      const r = ripples[rippleIdx++ % ripples.length];
      r.g.position.copy(point);
      r.g.quaternion.copy(_q);
      r.g.visible = true;
      r.life = -k * 0.12; // second ripple slightly delayed
    }
    for (let k = 0; k < 8; k++) {
      const s = sparks[sparkIdx++ % sparks.length];
      s.m.position.copy(point);
      s.vel
        .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .multiplyScalar(14)
        .addScaledVector(n, 10);
      s.life = 0;
      s.m.visible = true;
    }
  }

  return {
    update(dt, focusUp, active) {
      if (active) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawn(focusUp);
          spawnTimer = 1.2 + Math.random() * 3;
        }
      }
      for (const t of threats) {
        if (!t.alive) continue;
        t.g.position.addScaledVector(t.vel, dt);
        t.g.children[0].rotation.y += dt * 10;
        if (t.g.position.length() <= SHIELD_R) {
          t.alive = false;
          t.g.visible = false;
          impact(t.g.position.clone().setLength(SHIELD_R));
          onBlocked?.(ATTACKS[Math.floor(Math.random() * ATTACKS.length)]);
        }
      }
      for (const r of ripples) {
        if (!r.g.visible) continue;
        r.life += dt / 0.9;
        if (r.life >= 1) {
          r.g.visible = false;
          continue;
        }
        const p = Math.max(0, r.life);
        r.ring.scale.setScalar(1 + p * 7);
        r.ring2.scale.setScalar(0.6 + p * 4);
        r.fill.scale.setScalar(2.2);
        r.ringMat.opacity = (1 - p) * (r.life < 0 ? 0 : 1);
        r.fillMat.opacity = Math.max(0, 0.35 - p * 0.6);
      }
      for (const s of sparks) {
        if (!s.m.visible) continue;
        s.life += dt / 0.7;
        if (s.life >= 1) {
          s.m.visible = false;
          continue;
        }
        s.m.position.addScaledVector(s.vel, dt);
        s.m.scale.setScalar(1 - s.life);
      }
    },
  };
}
