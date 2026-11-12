import * as THREE from 'three';

// Hero centrepiece: a swarm of particles that morphs between cyber shapes
//   shield → padlock → fingerprint → your initials → …
// Particles flee the mouse, and red "attacks" hit the shape and make it ripple.

const THEME = {
  light: { a: '#0891b2', b: '#6d28d9', hot: '#e11d48', ring: '#0891b2', blending: THREE.NormalBlending, opacity: 0.95, size: 1.25 },
  dark: { a: '#22d3ee', b: '#a78bfa', hot: '#ff3d5a', ring: '#22d3ee', blending: THREE.AdditiveBlending, opacity: 1.0, size: 1.4 },
  root: { a: '#1f8bff', b: '#f2f2f2', hot: '#ff1f3d', ring: '#1f8bff', blending: THREE.AdditiveBlending, opacity: 1.0, size: 1.35 },
};
const themeNow = () => (THEME[document.documentElement.dataset.theme] ? document.documentElement.dataset.theme : 'light');

/* ── shape generators: each returns n points (Float32Array n*3), roughly within radius ~1.7 ── */

// sample a 2D region with denser edges, then give it a domed 3D depth
function sample2D(inside, [x0, x1, y0, y1], n, { edge = 0.05, bias = 0.4, depth = 0.45, scale = 1 } = {}) {
  const out = new Float32Array(n * 3);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rMax = Math.max(x1 - x0, y1 - y0) / 2;
  let i = 0;
  let guard = 0;
  while (i < n && guard++ < n * 80) {
    const x = x0 + Math.random() * (x1 - x0);
    const y = y0 + Math.random() * (y1 - y0);
    if (!inside(x, y)) continue;
    const isEdge = !inside(x + edge, y) || !inside(x - edge, y) || !inside(x, y + edge) || !inside(x, y - edge);
    if (!isEdge && Math.random() > bias) continue;
    const r2 = ((x - cx) ** 2 + (y - cy) ** 2) / (rMax * rMax);
    const dome = depth * Math.max(0, 1 - r2);
    const z = Math.random() < 0.75 ? dome : dome * Math.random() - depth * 0.3 * Math.random();
    out.set([(x - cx) * scale, (y - cy) * scale, z * scale], i * 3);
    i++;
  }
  return out;
}

function shieldShape(n) {
  const inside = (x, y) => {
    const top = 1.0 - 0.14 * x * x;
    if (y > top || y < -1.3) return false;
    const w = y > 0.15 ? 1 : Math.pow(Math.max(0, (y + 1.3) / 1.45), 0.75);
    if (Math.abs(x) > w) return false;
    // carve a check mark out of the middle (short stroke down-left, long stroke up-right)
    const inCheckA = x > -0.42 && x < -0.1 && Math.abs(y - (-1.0 * (x + 0.1) - 0.32)) < 0.08;
    const inCheckB = x >= -0.12 && x < 0.5 && Math.abs(y - (1.15 * (x + 0.1) - 0.34)) < 0.08;
    return !(inCheckA || inCheckB);
  };
  return sample2D(inside, [-1.05, 1.05, -1.32, 1.02], n, { scale: 1.45 });
}

function padlockShape(n) {
  const inside = (x, y) => {
    const body = Math.abs(x) <= 0.85 && y >= -1.1 && y <= 0.15;
    const keyhole = Math.hypot(x, y + 0.35) < 0.16 || (Math.abs(x) < 0.065 && y < -0.35 && y > -0.75);
    if (body) return !keyhole;
    const r = Math.hypot(x, y - 0.15);
    return y >= 0.15 && r >= 0.4 && r <= 0.62;
  };
  return sample2D(inside, [-0.9, 0.9, -1.12, 0.8], n, { scale: 1.6 });
}

function fingerprintShape(n) {
  const rings = 17;
  const curves = [];
  let total = 0;
  for (let i = 1; i <= rings; i++) {
    const rx = 0.075 * i;
    const ry = 0.095 * i;
    // open at the bottom for outer ridges, with a few random breaks
    const gap = i > 6 ? 0.9 + i * 0.03 : 0;
    const breaks = Array.from({ length: 2 }, () => [Math.random() * Math.PI * 2, 0.15 + Math.random() * 0.25]);
    const len = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    curves.push({ rx, ry, gap, breaks, len });
    total += len;
  }
  const out = new Float32Array(n * 3);
  let i = 0;
  while (i < n) {
    // pick a ring proportional to its length
    let r = Math.random() * total;
    const c = curves.find((cv) => (r -= cv.len) <= 0) || curves[curves.length - 1];
    const a = Math.random() * Math.PI * 2;
    const fromBottom = Math.abs(((a - Math.PI * 1.5 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (c.gap && fromBottom < c.gap / 2) continue;
    if (c.breaks.some(([b, w]) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < w / 2)) continue;
    let x = Math.cos(a) * c.rx;
    let y = Math.sin(a) * c.ry + 0.1;
    x += 0.05 * Math.sin(y * 4); // natural swirl
    const j = 0.012;
    x += (Math.random() - 0.5) * j;
    y += (Math.random() - 0.5) * j;
    const z = 0.35 * Math.max(0, 1 - (x * x + y * y) / 2.6) + (Math.random() - 0.5) * 0.04;
    out.set([x * 1.45, y * 1.45, z], i * 3);
    i++;
  }
  return out;
}

function textShape(n, text) {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 230;
  ctx.font = `700 ${size}px "Space Grotesk", "Inter", sans-serif`;
  while (ctx.measureText(text).width > W * 0.9 && size > 60) {
    size -= 10;
    ctx.font = `700 ${size}px "Space Grotesk", "Inter", sans-serif`;
  }
  ctx.fillText(text, W / 2, H / 2 + size * 0.04);
  const data = ctx.getImageData(0, 0, W, H).data;
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 128;
  const scale = 3.4 / W;
  return sample2D(
    (x, y) => on(Math.round(x), Math.round(y)),
    [0, W, 0, H],
    n,
    { edge: 4, bias: 0.5, depth: 0 },
  ).map((v, i) => {
    const k = i % 3;
    if (k === 0) return v * scale; // x
    if (k === 1) return -v * scale; // y (canvas y goes down)
    return (Math.random() - 0.5) * 0.25; // z: a little thickness
  });
}

/* ── main ── */
export function createParticleHero(canvas, { initials = 'ME', onBlocked, onShape } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const N = coarse ? 4200 : 7000;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const pr = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(pr);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 7.2);
  const group = new THREE.Group();
  group.scale.setScalar(0.85);
  scene.add(group);

  const SHAPES = [
    { label: 'Perimeter defended', make: shieldShape },
    { label: 'Data encrypted', make: padlockShape },
    { label: 'Identity verified', make: fingerprintShape },
    { label: 'Analyst online', make: (n) => textShape(n, initials) },
  ];
  const targets = SHAPES.map(() => null); // built lazily (fonts must be loaded for the initials)
  const getTarget = (i) => (targets[i] ||= SHAPES[i].make(N));

  // particle state
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const heat = new Float32Array(N);
  const delay = new Float32Array(N);
  const sizes = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // start as a loose cloud
    const r = 3 + Math.random() * 3;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p)], i * 3);
    delay[i] = Math.random() * 0.7;
    sizes[i] = 0.6 + Math.random() * 0.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('heat', new THREE.BufferAttribute(heat, 1));
  geo.setAttribute('psize', new THREE.BufferAttribute(sizes, 1));

  const uniforms = {
    uA: { value: new THREE.Color() },
    uB: { value: new THREE.Color() },
    uHot: { value: new THREE.Color() },
    uSize: { value: 1 },
    uOpacity: { value: 1 },
    uPR: { value: pr },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float heat; attribute float psize;
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uHot; uniform float uSize; uniform float uPR;
      varying vec3 vColor; varying float vHeat;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float g = clamp((position.y + 1.8) / 3.6, 0.0, 1.0);
        vColor = mix(mix(uA, uB, g), uHot, heat);
        vHeat = heat;
        gl_PointSize = uSize * psize * uPR * (13.0 / -mv.z) * (1.0 + heat * 0.8);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOpacity; varying vec3 vColor; varying float vHeat;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vColor, a * uOpacity);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  group.add(points);

  // orbit ring + background dust
  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.005, 6, 220), ringMat);
  ring.rotation.set(Math.PI / 2.4, 0.25, 0);
  scene.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.004, 6, 220), ringMat);
  ring2.rotation.set(Math.PI / 1.8, -0.4, 0.3);
  scene.add(ring2);
  const orbiter = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial());
  ring.add(orbiter);

  // attack streaks
  const attackMat = new THREE.LineBasicMaterial({ transparent: true });
  const attacks = Array.from({ length: 4 }, () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(g, attackMat);
    line.visible = false;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial());
    head.visible = false;
    group.add(line, head);
    return { line, head, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, live: false };
  });

  function applyTheme(t) {
    const p = THEME[t] || THEME.light;
    uniforms.uA.value.set(p.a);
    uniforms.uB.value.set(p.b);
    uniforms.uHot.value.set(p.hot);
    uniforms.uOpacity.value = p.opacity;
    uniforms.uSize.value = p.size;
    mat.blending = p.blending;
    mat.needsUpdate = true;
    ringMat.color.set(p.ring);
    orbiter.material.color.set(p.ring);
    attackMat.color.set(p.hot);
    attacks.forEach((a) => a.head.material.color.set(p.hot));
  }
  applyTheme(themeNow());
  addEventListener('themechange', (e) => applyTheme(e.detail));

  /* ── morph schedule ── */
  let shapeIdx = 0;
  let current = getTarget(shapeIdx);
  let morphAt = 0; // time the current shape became the target
  const HOLD = reduced ? 9 : 5.2;
  onShape?.(SHAPES[shapeIdx].label);
  function nextShape(time) {
    shapeIdx = (shapeIdx + 1) % SHAPES.length;
    current = getTarget(shapeIdx);
    morphAt = time;
    if (!reduced) {
      // a swirl kick so particles flow instead of sliding straight
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        const x = pos[k];
        const y = pos[k + 1];
        vel[k] += -y * 1.6 + (Math.random() - 0.5) * 1.2;
        vel[k + 1] += x * 1.6 + (Math.random() - 0.5) * 1.2;
        vel[k + 2] += (Math.random() - 0.5) * 2.5;
      }
    }
    onShape?.(SHAPES[shapeIdx].label);
  }

  function launchAttack() {
    const a = attacks.find((x) => !x.live);
    if (!a) return;
    const k = Math.floor(Math.random() * N) * 3;
    a.to.set(current[k], current[k + 1], current[k + 2]);
    const ang = Math.random() * Math.PI * 2;
    a.from.set(Math.cos(ang) * 5, Math.sin(ang) * 3.2, 1.5 + Math.random() * 1.5);
    a.t = 0;
    a.live = a.line.visible = a.head.visible = true;
  }

  function impact(p) {
    const R2 = 0.55 * 0.55;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      const dx = pos[k] - p.x;
      const dy = pos[k + 1] - p.y;
      const dz = pos[k + 2] - p.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < R2 * 4) {
        const f = Math.exp(-d2 / R2);
        const d = Math.sqrt(d2) || 1;
        vel[k] += (dx / d) * 4 * f;
        vel[k + 1] += (dy / d) * 4 * f;
        vel[k + 2] += (dz / d) * 4 * f + f * 2;
        heat[i] = Math.max(heat[i], f);
      }
    }
    onBlocked?.();
  }

  /* ── pointer: particles flee the cursor ── */
  const mouse = new THREE.Vector2(9, 9);
  const parallax = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const local = new THREE.Vector3(999, 999, 0);
  const inv = new THREE.Matrix4();
  let pointerActive = false;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    parallax.copy(mouse);
    pointerActive = true;
  });
  canvas.addEventListener('pointerleave', () => {
    pointerActive = false;
    parallax.set(0, 0);
  });

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  let time = 0;
  let attackT = 2.5;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.033);
    if (!visible || document.hidden) return;
    time += dt;

    if (time - morphAt > HOLD) nextShape(time);
    attackT -= dt;
    if (attackT <= 0) {
      launchAttack();
      attackT = (reduced ? 6 : 2.4) + Math.random() * 2;
    }

    // mouse → point on the z=0 plane in the group's local space
    group.updateMatrixWorld();
    if (pointerActive) {
      ray.setFromCamera(mouse, camera);
      inv.copy(group.matrixWorld).invert();
      ray.ray.applyMatrix4(inv);
      if (!ray.ray.intersectPlane(plane, local)) local.set(999, 999, 0);
    } else local.set(999, 999, 0);

    // integrate particles
    const since = time - morphAt;
    const K = 7.5; // spring
    const damp = Math.exp(-3.2 * dt);
    const REP = 0.7 * 0.7;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      const active = since >= delay[i] || reduced;
      if (active) {
        vel[k] += (current[k] - pos[k]) * K * dt;
        vel[k + 1] += (current[k + 1] - pos[k + 1]) * K * dt;
        vel[k + 2] += (current[k + 2] - pos[k + 2]) * K * dt;
      }
      // cursor repulsion
      const dx = pos[k] - local.x;
      const dy = pos[k + 1] - local.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < REP) {
        const f = (1 - d2 / REP) * 22 * dt;
        const d = Math.sqrt(d2) || 1;
        vel[k] += (dx / d) * f;
        vel[k + 1] += (dy / d) * f;
        vel[k + 2] += f * 0.6;
      }
      vel[k] *= damp;
      vel[k + 1] *= damp;
      vel[k + 2] *= damp;
      pos[k] += vel[k] * dt;
      pos[k + 1] += vel[k + 1] * dt;
      pos[k + 2] += vel[k + 2] * dt;
      if (heat[i] > 0) heat[i] = Math.max(0, heat[i] - dt * 1.4);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.heat.needsUpdate = true;

    // attacks
    for (const a of attacks) {
      if (!a.live) continue;
      a.t += dt * 1.6;
      const head = a.head.position.lerpVectors(a.from, a.to, Math.min(1, a.t));
      const tail = new THREE.Vector3().lerpVectors(a.from, a.to, Math.max(0, a.t - 0.35));
      const arr = a.line.geometry.attributes.position.array;
      arr.set([tail.x, tail.y, tail.z, head.x, head.y, head.z]);
      a.line.geometry.attributes.position.needsUpdate = true;
      if (a.t >= 1) {
        a.live = a.line.visible = a.head.visible = false;
        impact(a.to);
      }
    }

    // gentle sway + parallax
    const sway = reduced ? 0 : Math.sin(time * 0.35) * 0.35;
    group.rotation.y += (sway + parallax.x * 0.35 - group.rotation.y) * Math.min(1, dt * 3);
    group.rotation.x += (-parallax.y * 0.2 - group.rotation.x) * Math.min(1, dt * 3);
    orbiter.position.set(Math.cos(time * 0.7) * 2.55, Math.sin(time * 0.7) * 2.55, 0);
    ring2.rotation.z += dt * 0.05;

    renderer.render(scene, camera);
  }
  frame();
}
