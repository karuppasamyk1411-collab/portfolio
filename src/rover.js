import * as THREE from 'three';
import { R, heightAt, orientQuat, tangentTowards, walk, shadows, neonEdges, glowMat, NEON } from './utils.js';

export const START = new THREE.Vector3(0, 1, 0);
export const START_FWD = new THREE.Vector3(0, 0, -1);

function underglowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,240,255,1)');
  g.addColorStop(0.5, 'rgba(0,240,255,0.35)');
  g.addColorStop(1, 'rgba(0,240,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createRover(scene) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  scene.add(root);

  const dark = new THREE.MeshStandardMaterial({ color: '#0a0c18', roughness: 0.8, flatShading: true });

  const box = (w, h, d, m, x, y, z, edge) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    if (edge) neonEdges(mesh, edge, 2.4);
    body.add(mesh);
    return mesh;
  };

  /* ── angular steel pickup (wedge profile extruded across the width) ── */
  const steel = new THREE.MeshStandardMaterial({ color: '#c3c8d0', roughness: 0.32, metalness: 0.85, flatShading: true });
  const WIDTH = 1.56;
  // side profile in (z forward, y up): nose → hood edge → roof peak → long "sail" slope → tail
  const extrudeSide = (pts, width, material, edgeColor) => {
    const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
    geo.translate(0, 0, -width / 2);
    geo.rotateY(-Math.PI / 2); // shape's x (forward) → world +z, extrusion → across x
    const mesh = new THREE.Mesh(geo, material);
    if (edgeColor) {
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: new THREE.Color(edgeColor).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.55 })));
    }
    body.add(mesh);
    return mesh;
  };
  const PEAK = [-0.1, 1.7];
  const HOOD = [1.42, 0.86];
  const TAIL = [-1.55, 1.05];
  const roofY = (z) => HOOD[1] + ((HOOD[0] - z) * (PEAK[1] - HOOD[1])) / (HOOD[0] - PEAK[0]);
  const sailY = (z) => PEAK[1] - ((PEAK[0] - z) * (PEAK[1] - TAIL[1])) / (PEAK[0] - TAIL[0]);
  const WF = 1.05; // windshield starts here (z)
  const WR = -0.8; // rear window ends here (z)
  const BELT = 1.04; // window line height
  // steel lower body + the sail behind the cabin
  extrudeSide(
    [[1.55, 0.38], [1.6, 0.66], HOOD, [WF, roofY(WF)], [WF, BELT], [WR, BELT], [WR, sailY(WR)], TAIL, [-1.6, 0.38]],
    WIDTH,
    steel,
    NEON.cyan,
  );
  // tinted glass cabin on top (see-through so the driver shows)
  const tint = new THREE.MeshStandardMaterial({
    color: '#0b1730', roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.5, depthWrite: false,
    emissive: NEON.cyan, emissiveIntensity: 0.12, flatShading: true, side: THREE.DoubleSide,
  });
  const cabin = extrudeSide([[WF, BELT], [WF, roofY(WF)], PEAK, [WR, sailY(WR)], [WR, BELT]], WIDTH - 0.04, tint, '#cfe8ff');
  cabin.renderOrder = 2;
  // thin steel roof spine + pillars keep the silhouette crisp
  extrudeSide([[0.35, roofY(0.35) - 0.02], [0.35, roofY(0.35) + 0.03], PEAK.map((v, i) => v + (i ? 0.03 : 0)), [-0.45, sailY(-0.45) + 0.03], [-0.45, sailY(-0.45) - 0.02], [PEAK[0], PEAK[1] - 0.02]], WIDTH + 0.01, steel);

  // black trapezoid wheel arches
  const archMat = new THREE.MeshStandardMaterial({ color: '#111318', roughness: 0.9, flatShading: true });
  for (const zc of [1.0, -1.0]) {
    for (const s of [-1, 1]) {
      const shape = new THREE.Shape([
        new THREE.Vector2(zc - 0.62, 0.36), new THREE.Vector2(zc - 0.42, 0.98),
        new THREE.Vector2(zc + 0.42, 0.98), new THREE.Vector2(zc + 0.62, 0.36),
      ]);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
      g.rotateY(-Math.PI / 2);
      const arch = new THREE.Mesh(g, archMat);
      arch.position.x = s * (WIDTH / 2 + 0.035) + (s > 0 ? 0.05 : 0);
      body.add(arch);
    }
  }
  // lower trim / skirt
  box(WIDTH + 0.04, 0.1, 3.0, archMat, 0, 0.42, 0);

  // full-width light bars
  const head = glowMat('#e8fbff', 4);
  const tail = glowMat('#ff2b4f', 4);
  const frontBar = box(WIDTH * 0.96, 0.035, 0.04, head, 0, HOOD[1] - 0.02, HOOD[0] + 0.03);
  frontBar.rotation.x = -0.4;
  box(WIDTH * 0.96, 0.04, 0.04, tail, 0, TAIL[1] - 0.04, TAIL[0] - 0.03);
  // neon underbody accent
  box(0.04, 0.04, 2.6, glowMat(NEON.cyan, 3), WIDTH / 2 + 0.03, 0.47, 0);
  box(0.04, 0.04, 2.6, glowMat(NEON.cyan, 3), -WIDTH / 2 - 0.03, 0.47, 0);

  // cabin floor + seat (visible through the glass)
  box(0.6, 0.12, 0.6, dark, 0, 0.62, -0.2);
  box(0.6, 0.62, 0.1, dark, 0, 0.95, -0.55);

  /* ── steering wheel ── */
  const wheelMount = new THREE.Group();
  wheelMount.position.set(0, 1.02, 0.32);
  wheelMount.rotation.x = -1.05; // tilted towards the driver
  body.add(wheelMount);
  const steeringSpin = new THREE.Group();
  wheelMount.add(steeringSpin);
  const steerRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.028, 6, 24), dark);
  neonEdges(steerRing, NEON.cyan, 1.4, 0.5);
  const steerHub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), glowMat(NEON.cyan, 2));
  steerHub.rotation.x = Math.PI / 2;
  const steerSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.02), dark);
  steeringSpin.add(steerRing, steerHub, steerSpoke);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), dark);
  column.position.set(0, 0.92, 0.46);
  column.rotation.x = 0.6;
  body.add(column);

  /* ── driver (low-poly portrait: curly hair, glasses, black shirt) ── */
  const skin = new THREE.MeshStandardMaterial({ color: '#6e4128', roughness: 0.7, flatShading: true });
  const shirt = new THREE.MeshStandardMaterial({ color: '#16161d', roughness: 0.85, flatShading: true });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#0f0b09', roughness: 0.9, flatShading: true });
  const metal = new THREE.MeshStandardMaterial({ color: '#d7dde8', roughness: 0.25, metalness: 0.9 });
  const lensMat = new THREE.MeshStandardMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.5 });

  const driver = new THREE.Group();
  driver.position.set(0, 0.62, -0.2);
  driver.scale.setScalar(0.92);
  body.add(driver);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.28), shirt);
  torso.position.y = 0.3;
  torso.rotation.x = 0.06;
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.2), shirt);
  collar.position.set(0, 0.6, 0.02);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.14, 8), skin);
  neck.position.y = 0.66;
  driver.add(torso, collar, neck);

  // legs: grey trousers + dark shoes; only shown once the driver steps out
  const pants = new THREE.MeshStandardMaterial({ color: '#8b8f96', roughness: 0.85, flatShading: true });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1f', roughness: 0.6, flatShading: true });
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.12, 0.04, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pants);
    leg.position.y = -0.36;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.09, 0.3), shoeMat);
    shoe.position.set(0, -0.74, 0.05);
    hip.add(leg, shoe);
    hip.visible = false;
    driver.add(hip);
    return hip;
  });

  const headGroup = new THREE.Group();
  headGroup.position.y = 0.88;
  driver.add(headGroup);
  const headMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 1), skin);
  headMesh.scale.set(0.95, 1.12, 1);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.01, 0.2);
  const ears = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), skin);
    e.position.set(s * 0.18, 0, 0);
    return e;
  });
  headGroup.add(headMesh, nose, ...ears);

  // curly hair: a cluster of small blobs over the top and back of the head
  const curlGeo = new THREE.IcosahedronGeometry(0.075, 0);
  for (let i = 0; i < 34; i++) {
    const golden = i * 2.39996;
    const v = 1 - (i / 33) * 0.95; // from top downwards
    const polar = Math.acos(v) * 1.15;
    if (polar > 1.9) continue;
    const az = golden;
    const dir = new THREE.Vector3(Math.sin(polar) * Math.cos(az), Math.cos(polar), Math.sin(polar) * Math.sin(az));
    if (dir.z > 0.35 && dir.y < 0.55) continue; // keep the face clear
    const c = new THREE.Mesh(curlGeo, hairMat);
    c.position.copy(dir).multiplyScalar(0.2).add(new THREE.Vector3(0, 0.05, -0.01));
    c.scale.setScalar(0.85 + ((i * 37) % 10) / 22);
    c.rotation.set(i, i * 2, i * 3);
    headGroup.add(c);
  }

  // glasses
  for (const s of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 18), metal);
    rim.position.set(s * 0.075, 0.03, 0.185);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), lensMat);
    lens.position.set(s * 0.075, 0.03, 0.186);
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.18), metal);
    temple.position.set(s * 0.165, 0.035, 0.1);
    headGroup.add(rim, lens, temple);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.008), metal);
  bridge.position.set(0, 0.045, 0.19);
  headGroup.add(bridge);

  // arms (two segments each) + hands; posed every frame
  const segGeo = new THREE.CylinderGeometry(0.055, 0.05, 1, 6);
  const foreGeo = new THREE.CylinderGeometry(0.05, 0.045, 1, 6);
  const handGeo = new THREE.IcosahedronGeometry(0.055, 0);
  const arms = [-1, 1].map((side) => {
    const upper = new THREE.Mesh(segGeo, shirt);
    const fore = new THREE.Mesh(foreGeo, skin); // rolled-up sleeves
    const hand = new THREE.Mesh(handGeo, skin);
    body.add(upper, fore, hand);
    return { side, upper, fore, hand };
  });
  const _sh = new THREE.Vector3();
  const _el = new THREE.Vector3();
  const _hd = new THREE.Vector3();
  const _dv = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  const setSeg = (mesh, a, b) => {
    _dv.subVectors(b, a);
    const len = _dv.length();
    mesh.position.addVectors(a, b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y, _dv.divideScalar(len || 1));
    mesh.scale.set(1, len, 1);
  };
  const rimPoint = (angle, out) => {
    out.set(Math.sin(angle) * 0.19, Math.cos(angle) * 0.19, 0);
    out.applyEuler(steeringSpin.rotation).applyQuaternion(wheelMount.quaternion).add(wheelMount.position);
    return out;
  };
  let idleTime = 0;
  let waveK = 0;
  // getting out: seat → hop over the side → stand next to the truck (car's left side, +X)
  const SEAT = new THREE.Vector3(0, 0.62, -0.2);
  const STAND = new THREE.Vector3(1.55, 0.7, -0.1);
  const _loc = new THREE.Vector3();
  const _hang = new THREE.Vector3();
  const _wv = new THREE.Vector3();
  const easeInOut = (x) => x * x * (3 - 2 * x);

  function poseDriver(dt, time, steer, speed, exitK) {
    // steering wheel turns with the steering input
    steeringSpin.rotation.z = -steer * 1.6;

    // seated: wave at the camera after standing still for a moment.  standing: always wave.
    idleTime = Math.abs(speed) < 0.3 ? idleTime + dt : 0;
    const wantWave = exitK > 0.95 || idleTime > 2.2 ? 1 : 0;
    waveK += (wantWave - waveK) * Math.min(1, dt * 5);

    // body path: up and over the side, then down onto the ground
    const e = easeInOut(exitK);
    driver.position.lerpVectors(SEAT, STAND, e);
    driver.position.y += Math.sin(Math.PI * e) * 0.9;
    driver.rotation.set(0, e * 2.3, -steer * 0.08 * (1 - e)); // turn to face out towards the camera
    for (const [i, hip] of legs.entries()) {
      hip.visible = exitK > 0.45;
      hip.rotation.x = exitK < 0.98 ? Math.sin(time * 10 + i * Math.PI) * 0.35 * Math.sin(Math.PI * e) : 0;
    }
    driver.updateMatrix();

    headGroup.rotation.y = (-steer * 0.45 + waveK * -0.8) * (1 - e) + e * -0.25;
    headGroup.rotation.x = Math.sin(time * 1.7) * 0.03;

    for (const a of arms) {
      // shoulder in body space
      _sh.set(a.side * 0.29, 0.55, 0).applyMatrix4(driver.matrix);
      // seated: hands at 10 and 2 o'clock on the rim
      rimPoint(a.side * 1.05, _hd);
      // standing: hands hang by the sides
      _hang.set(a.side * 0.33, 0.06, 0.04).applyMatrix4(driver.matrix);
      _hd.lerp(_hang, e);
      if (a.side < 0 && waveK > 0.01) {
        // right hand: raise and wave (inside the cab when seated, overhead when standing)
        _wv.set(-0.42 + Math.sin(time * 9) * 0.08, 0.6, 0.2).add(SEAT); // seated wave target (body space)
        _loc.set(-0.42 + Math.sin(time * 9) * 0.1, 1.15, 0.12).applyMatrix4(driver.matrix); // standing wave target
        _wv.lerp(_loc, e);
        _hd.lerp(_wv, waveK);
      }
      // elbow: halfway, pushed outward and down
      _el.addVectors(_sh, _hd).multiplyScalar(0.5);
      _loc.set(a.side * 0.12, -0.1 * (1 - waveK * (a.side < 0 ? 1 : 0)), 0).applyEuler(driver.rotation);
      _el.add(_loc);
      setSeg(a.upper, _sh, _el);
      setSeg(a.fore, _el, _hd);
      a.hand.position.copy(_hd);
    }
  }

  // underglow
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 4.2),
    new THREE.MeshBasicMaterial({ map: underglowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.05;
  root.add(glow);

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(0.3, 0.035, 4, 16);
  rimGeo.rotateY(Math.PI / 2);
  const rimMat = glowMat(NEON.cyan, 3);
  const wheels = [];
  const steerPivots = [];
  const coverGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.02, 6); // flat hexagonal aero cover
  coverGeo.rotateZ(Math.PI / 2);
  const coverMat = new THREE.MeshStandardMaterial({ color: '#8d939c', roughness: 0.35, metalness: 0.8, flatShading: true });
  for (const [x, z, front] of [[-0.9, 1.0, true], [0.9, 1.0, true], [-0.9, -1.0, false], [0.9, -1.0, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.42, z);
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, dark);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.x = Math.sign(x) * 0.19;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.06), rimMat);
    spoke.position.x = Math.sign(x) * 0.19;
    const cover = new THREE.Mesh(coverGeo, coverMat);
    cover.position.x = Math.sign(x) * 0.185;
    w.add(cover);
    w.add(tire, rim, spoke);
    pivot.add(w);
    root.add(pivot);
    wheels.push(w);
    if (front) steerPivots.push(pivot);
  }
  shadows(root);
  glow.castShadow = false;

  // spark particles
  const sparkGeo = new THREE.OctahedronGeometry(0.09, 0);
  const sparkMats = [glowMat(NEON.cyan, 4), glowMat(NEON.magenta, 4)];
  const sparks = [];
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(sparkGeo, sparkMats[i % 2]);
    m.visible = false;
    scene.add(m);
    sparks.push({ m, life: 1, max: 1, vel: new THREE.Vector3() });
  }
  let sparkTimer = 0;
  let sparkIdx = 0;
  const _w = new THREE.Vector3();

  // state
  const state = {
    pos: START.clone(),
    fwd: START_FWD.clone(),
    speed: 0,
    steer: 0,
    hY: 0,
    vY: 0,
    grounded: true,
    squash: 0,
    accel: 0,
    exitK: 0, // 0 = driver seated, 1 = standing outside
    parkTime: 0,
  };
  const _axis = new THREE.Vector3();
  const _n = new THREE.Vector3();
  let wheelSpin = 0;
  let time = 0;

  function sync() {
    const g = heightAt(state.pos);
    root.position.copy(state.pos).multiplyScalar(R + g + state.hY);
    orientQuat(state.pos, state.fwd, root.quaternion);
    root.updateMatrixWorld(true);
  }

  function update(dt, input, obstacles) {
    time += dt;
    const prevSpeed = state.speed;
    const max = input.boost ? 21 : 13;

    // driver hops out after parking at a destination; pressing drive brings them back in first
    const wantsDrive = !!input.throttle || !!input.jump;
    if (input.atDestination && !wantsDrive && Math.abs(state.speed) < 0.4 && state.grounded) state.parkTime += dt;
    else state.parkTime = 0;
    const exitTarget = state.parkTime > 0.8 ? 1 : 0;
    state.exitK = THREE.MathUtils.clamp(state.exitK + Math.sign(exitTarget - state.exitK) * (dt / 0.75), 0, 1);
    const driverOut = state.exitK > 0.001;
    const throttle = driverOut ? 0 : input.throttle;

    if (throttle) {
      const opposing = Math.sign(throttle) !== Math.sign(state.speed) && Math.abs(state.speed) > 0.5;
      state.speed += throttle * (opposing ? 34 : 17) * dt;
    } else {
      state.speed *= Math.exp(-1.6 * dt);
      if (Math.abs(state.speed) < 0.05) state.speed = 0;
    }
    if (state.speed > max) state.speed = Math.max(max, state.speed - 25 * dt);
    state.speed = Math.max(state.speed, -7);

    state.steer += (input.steer - state.steer) * Math.min(1, dt * 10);
    const grip = THREE.MathUtils.clamp(state.speed / 5, -1, 1);
    const turn = state.steer * 2.3 * grip * dt * (state.grounded ? 1 : 0.4);
    state.fwd.applyAxisAngle(state.pos, -turn);

    const dist = state.speed * dt;
    if (dist !== 0) {
      _axis.crossVectors(state.pos, state.fwd).normalize();
      const th = dist / R;
      state.pos.applyAxisAngle(_axis, th);
      state.fwd.applyAxisAngle(_axis, th);
    }
    state.pos.normalize();

    // jump
    if (input.jump && state.grounded && !driverOut) {
      state.vY = 8.5;
      state.grounded = false;
    }
    state.vY -= 24 * dt;
    state.hY += state.vY * dt;
    if (state.hY <= 0) {
      if (!state.grounded) state.squash = Math.min(0.28, -state.vY * 0.02);
      state.hY = 0;
      state.vY = 0;
      state.grounded = true;
    }

    // collisions
    for (const o of obstacles) {
      if (o.top !== undefined && state.hY > o.top) continue;
      const d = state.pos.distanceTo(o.dir) * R;
      const min = o.radius + 1.1;
      if (d < min) {
        tangentTowards(state.pos, o.dir, _n).negate();
        state.pos.copy(walk(state.pos, _n, min - d));
        const into = state.fwd.dot(_n) * Math.sign(state.speed || 1);
        if (into < 0) state.speed *= 1 - Math.abs(into) * 0.5;
      }
    }
    state.fwd.addScaledVector(state.pos, -state.fwd.dot(state.pos)).normalize();

    // visuals
    sync();
    wheelSpin += (state.speed * dt) / 0.42;
    for (const w of wheels) w.rotation.x = wheelSpin;
    for (const p of steerPivots) p.rotation.y = -state.steer * 0.45;
    poseDriver(dt, time, state.steer, state.speed, state.exitK);

    if (dt > 0) state.accel += ((state.speed - prevSpeed) / dt - state.accel) * Math.min(1, dt * 6);
    const speedK = Math.min(Math.abs(state.speed) / 12, 1);
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, -state.steer * grip * 0.09, Math.min(1, dt * 8));
    body.rotation.x = THREE.MathUtils.clamp(-state.accel * 0.006, -0.08, 0.08);
    state.squash *= Math.exp(-dt * 10);
    body.scale.set(1 + state.squash * 0.5, 1 - state.squash, 1 + state.squash * 0.5);
    body.position.y = Math.sin(time * 22) * 0.015 * speedK;
    glow.material.opacity = 0.6 + 0.3 * Math.sin(time * 3) - Math.min(state.hY * 0.25, 0.6);

    // sparks
    sparkTimer -= dt;
    if (state.grounded && Math.abs(state.speed) > 6 && sparkTimer <= 0) {
      sparkTimer = input.boost ? 0.015 : 0.04;
      for (const side of [-0.92, 0.92]) {
        const s = sparks[sparkIdx++ % sparks.length];
        root.localToWorld(_w.set(side, 0.1, -Math.sign(state.speed) * 1.2));
        s.m.position.copy(_w);
        s.vel.copy(state.pos).multiplyScalar(1 + Math.random() * 1.5).addScaledVector(state.fwd, -state.speed * 0.15);
        s.vel.x += (Math.random() - 0.5) * 1.2;
        s.vel.z += (Math.random() - 0.5) * 1.2;
        s.life = 0;
        s.max = 0.4 + Math.random() * 0.4;
        s.m.visible = true;
      }
    }
    for (const s of sparks) {
      if (!s.m.visible) continue;
      s.life += dt;
      const t = s.life / s.max;
      if (t >= 1) {
        s.m.visible = false;
        continue;
      }
      s.m.position.addScaledVector(s.vel, dt);
      s.m.scale.setScalar(Math.sin(t * Math.PI) * 1.2);
      s.m.rotation.y += dt * 8;
    }
  }

  function teleport(pos, fwd) {
    state.pos.copy(pos).normalize();
    state.fwd.copy(fwd).addScaledVector(state.pos, -fwd.dot(state.pos)).normalize();
    state.speed = 0;
    state.hY = 0;
    state.vY = 0;
    state.exitK = 0; // back in the seat for the new trip
    state.parkTime = 0;
    sync();
  }

  poseDriver(0, 0, 0, 0, 0);
  sync();
  return { root, state, update, teleport };
}
