import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Hero: a 3D retro CRT computer whose curved screen runs a live, self-typing terminal session.
// Hover the screen → it glitches.  Click → skip ahead to the next command.

const PALETTES = {
  root: { shell: '#262626', trim: '#111111', keys: '#1c1c1c', keyTop: '#262626', bg: '#00040c', text: '#3d9bff', bright: '#ffffff', dim: '#3f6a99', ok: '#ffffff', glow: '#1f8bff', alert: '#ff3049' },
  dark: { shell: '#1d2440', trim: '#121831', keys: '#1a2140', keyTop: '#283158', bg: '#020a14', text: '#22d3ee', bright: '#e6f6ff', dim: '#1b6b80', ok: '#3dff7a', glow: '#22d3ee', alert: '#ff5c7a' },
  light: { shell: '#e8dfc8', trim: '#cdbf9f', keys: '#efe8d6', keyTop: '#fbf7ec', bg: '#031006', text: '#39ff7a', bright: '#d8ffe4', dim: '#1d7a3c', ok: '#ffffff', glow: '#22c55e', alert: '#ff6b6b' },
};
const themeNow = () => (PALETTES[document.documentElement.dataset.theme] ? document.documentElement.dataset.theme : 'root');

const TW = 1024;
const TH = 768;
const FONT = 26;
const LH = 34;
const COLS = 60;

function wrap(text, cols) {
  const out = [];
  for (let i = 0; i < text.length; i += cols) out.push(text.slice(i, i + cols));
  return out.length ? out : [''];
}

export function createCrt(canvas, { prompt = 'root@kk:~# ', script = [] } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.6, 9.2);

  const hemi = new THREE.HemisphereLight('#ffffff', '#222222', 1.2);
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  const screenLight = new THREE.PointLight('#1f8bff', 6, 7, 1.6); // glow spilling from the screen
  screenLight.position.set(0, 0.2, 1.6);
  scene.add(hemi, key, screenLight);

  const rig = new THREE.Group(); // tilts toward the cursor
  scene.add(rig);

  /* ── materials ── */
  const shellMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 });
  const trimMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const keysMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });

  /* ── monitor ── */
  const monitor = new THREE.Group();
  monitor.position.y = 0.55;
  rig.add(monitor);
  const front = new THREE.Mesh(new RoundedBoxGeometry(3.0, 2.45, 0.55, 5, 0.14), shellMat);
  const back = new THREE.Mesh(new RoundedBoxGeometry(2.35, 1.95, 1.35, 5, 0.3), shellMat);
  back.position.set(0, -0.05, -0.8);
  const gasket = new THREE.Mesh(new RoundedBoxGeometry(2.5, 1.95, 0.08, 4, 0.06), trimMat);
  gasket.position.z = 0.26;
  monitor.add(front, back, gasket);
  // vents on top
  for (let i = 0; i < 7; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.9), trimMat);
    v.position.set(-0.6 + i * 0.2, 0.95, -0.75);
    monitor.add(v);
  }
  // knobs + power LED
  for (const x of [0.95, 1.18]) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), trimMat);
    k.rotation.x = Math.PI / 2;
    k.position.set(x, -1.07, 0.29);
    monitor.add(k);
  }
  const ledMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), ledMat);
  led.position.set(-1.2, -1.07, 0.29);
  monitor.add(led);

  /* ── terminal texture + CRT shader ── */
  const tc = document.createElement('canvas');
  tc.width = TW;
  tc.height = TH;
  const ctx = tc.getContext('2d');
  const termTex = new THREE.CanvasTexture(tc);
  termTex.colorSpace = THREE.SRGBColorSpace;
  termTex.minFilter = THREE.LinearFilter;

  const crtUniforms = { map: { value: termTex }, uTime: { value: 0 }, uGlitch: { value: 0 } };
  const crtMat = new THREE.ShaderMaterial({
    uniforms: crtUniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D map; uniform float uTime; uniform float uGlitch; varying vec2 vUv;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      vec2 curve(vec2 uv){ uv = uv * 2.0 - 1.0; vec2 off = abs(uv.yx) / vec2(5.0, 4.2); uv += uv * off * off; return uv * 0.5 + 0.5; }
      void main(){
        vec2 uv = curve(vUv);
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        float band = step(0.82, h(floor(uv.y * 36.0) + floor(uTime * 18.0)));
        uv.x += band * uGlitch * 0.035 * (h(floor(uTime * 30.0)) - 0.5);
        float ca = 0.0012 + uGlitch * 0.007;
        vec3 c = vec3(texture2D(map, uv + vec2(ca, 0.0)).r, texture2D(map, uv).g, texture2D(map, uv - vec2(ca, 0.0)).b);
        vec3 blur = (texture2D(map, uv + vec2(0.003, 0.0)).rgb + texture2D(map, uv - vec2(0.003, 0.0)).rgb +
                     texture2D(map, uv + vec2(0.0, 0.004)).rgb + texture2D(map, uv - vec2(0.0, 0.004)).rgb) * 0.25;
        c += blur * 0.55;                                   // phosphor bloom
        c *= 0.86 + 0.14 * sin(uv.y * 300.0 * 3.14159);     // scanlines (coarse enough to avoid moiré)
        float vig = smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x) * smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.7, uv.y);
        c *= mix(0.5, 1.0, vig);
        c *= 0.96 + 0.04 * sin(uTime * 55.0);                // flicker
        float roll = smoothstep(0.0, 0.02, abs(fract(uv.y - uTime * 0.08) - 0.5) - 0.48); // slow rolling bar
        c *= 0.92 + 0.08 * (1.0 - roll);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  // slightly bulged glass
  const sg = new THREE.PlaneGeometry(2.3, 1.75, 32, 24);
  const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i) / 1.15;
    const y = sp.getY(i) / 0.875;
    sp.setZ(i, 0.09 * (1 - Math.min(1, (x * x + y * y) / 2)));
  }
  sg.computeVertexNormals();
  const screen = new THREE.Mesh(sg, crtMat);
  screen.position.z = 0.29;
  monitor.add(screen);

  /* ── stand + keyboard ── */
  const neck = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.35, 0.8, 3, 0.08), shellMat);
  neck.position.set(0, -0.95, -0.55);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.14, 1.4, 3, 0.06), shellMat);
  foot.position.set(0, -1.12, -0.5);
  rig.add(neck, foot);

  const kc = document.createElement('canvas');
  kc.width = 512;
  kc.height = 176;
  const kctx = kc.getContext('2d');
  const keyTex = new THREE.CanvasTexture(kc);
  keyTex.colorSpace = THREE.SRGBColorSpace;
  const KROWS = 5;
  const KCOLS = 15;
  let litKey = -1;
  let litT = 0;
  function drawKeys(p) {
    kctx.fillStyle = p.keys;
    kctx.fillRect(0, 0, kc.width, kc.height);
    for (let r = 0; r < KROWS; r++)
      for (let c = 0; c < KCOLS; c++) {
        const i = r * KCOLS + c;
        const w = r === 4 && c > 3 && c < 11 ? 0 : 1; // space bar region drawn separately
        if (!w) continue;
        kctx.fillStyle = i === litKey ? p.glow : p.keyTop;
        kctx.fillRect(8 + c * 33.4, 8 + r * 33, 29, 28);
      }
    kctx.fillStyle = litKey === -2 ? p.glow : p.keyTop;
    kctx.fillRect(8 + 4 * 33.4, 8 + 4 * 33, 33.4 * 7 - 4, 28);
    keyTex.needsUpdate = true;
  }
  const keyboard = new THREE.Mesh(new RoundedBoxGeometry(2.7, 0.14, 0.95, 3, 0.05), [keysMat, keysMat, new THREE.MeshStandardMaterial({ map: keyTex, roughness: 0.55 }), keysMat, keysMat, keysMat]);
  keyboard.position.set(0, -1.15, 1.35);
  keyboard.rotation.x = 0.08;
  rig.add(keyboard);

  // soft glow pool under the computer
  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 3.2),
    new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -1.25;
  rig.add(pool);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.26;
  floor.receiveShadow = true;
  rig.add(floor);
  [front, back, neck, foot, keyboard].forEach((m) => (m.castShadow = true));

  /* ── theme ── */
  let P = PALETTES[themeNow()];
  function applyTheme(t) {
    P = PALETTES[t] || PALETTES.root;
    shellMat.color.set(P.shell);
    trimMat.color.set(P.trim);
    keysMat.color.set(P.keys);
    ledMat.color.set(P.glow);
    screenLight.color.set(P.glow);
    pool.material.color.set(P.glow);
    hemi.intensity = t === 'light' ? 1.8 : 1.7;
    key.intensity = t === 'light' ? 1.6 : 2.0;
    drawKeys(P);
    paint();
  }

  /* ── terminal engine ── */
  const lines = []; // { text, kind }
  let step = 0;
  let typed = 0;
  let wait = 0.6;
  let cursorOn = true;
  function paint() {
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, TW, TH);
    ctx.font = `600 ${FONT}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'top';
    const rows = [];
    for (const l of lines) for (const part of wrap(l.text, COLS)) rows.push({ text: part, kind: l.kind });
    const maxRows = Math.floor((TH - 60) / LH);
    const view = rows.slice(-maxRows);
    view.forEach((r, i) => {
      const y = 36 + i * LH;
      if (r.kind === 'cmd' && r.text.startsWith(prompt)) {
        ctx.fillStyle = P.text;
        ctx.fillText(prompt, 44, y);
        ctx.fillStyle = P.bright;
        ctx.fillText(r.text.slice(prompt.length), 44 + ctx.measureText(prompt).width, y);
      } else {
        ctx.fillStyle = r.kind === 'ok' ? P.ok : r.kind === 'alert' ? P.alert : r.kind === 'dim' ? P.dim : P.bright;
        ctx.fillText(r.text, 44, y);
      }
      ctx.shadowBlur = 0;
    });
    // block cursor at the end of the last row
    if (cursorOn) {
      const last = view[view.length - 1];
      const x = 44 + (last ? ctx.measureText(last.text).width : 0) + 4;
      const y = 36 + Math.max(0, view.length - 1) * LH;
      ctx.fillStyle = P.text;
      ctx.fillRect(x, y + 2, FONT * 0.6, FONT);
    }
    termTex.needsUpdate = true;
  }

  function advance(dt) {
    if (!script.length) return;
    wait -= dt;
    if (wait > 0) return;
    const s = script[step];
    if (!s) {
      // end of script: pause, clear the screen, start again
      lines.length = 0;
      step = 0;
      typed = 0;
      wait = 0.8;
      return;
    }
    if (s.cmd !== undefined) {
      if (typed === 0) lines.push({ text: prompt, kind: 'cmd' });
      if (typed < s.cmd.length) {
        typed++;
        lines[lines.length - 1].text = prompt + s.cmd.slice(0, typed);
        litKey = s.cmd[typed - 1] === ' ' ? -2 : Math.floor(Math.random() * KROWS * KCOLS);
        litT = 0.09;
        drawKeys(P);
        wait = reduced ? 0.02 : 0.035 + Math.random() * 0.06;
      } else {
        typed = 0;
        step++;
        wait = 0.35;
      }
    } else {
      lines.push({ text: s.out, kind: s.kind || 'out' });
      step++;
      wait = s.pause ?? 0.18;
    }
    paint();
  }

  function skipAhead() {
    // finish the current command instantly and print its output
    while (script[step] && script[step].cmd === undefined) advance(99);
    if (script[step]?.cmd !== undefined) {
      const s = script[step];
      if (typed === 0) lines.push({ text: prompt, kind: 'cmd' });
      lines[lines.length - 1].text = prompt + s.cmd;
      typed = 0;
      step++;
      wait = 0;
    }
    paint();
  }

  applyTheme(themeNow());
  addEventListener('themechange', (e) => applyTheme(e.detail));
  // start with the first command already on screen so it's never blank
  for (let guard = 0; step < Math.min(3, script.length) && guard < 200; guard++) advance(99);

  /* ── interaction ── */
  const mouse = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  let hover = false;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    hover = ray.intersectObject(screen).length > 0;
    canvas.style.cursor = hover ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', () => {
    mouse.set(0, 0);
    hover = false;
  });
  canvas.addEventListener('click', () => skipAhead());

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole computer in frame on tall/narrow layouts
    camera.position.z = camera.aspect < 1 ? 9.2 / camera.aspect ** 0.6 : 9.2;
    camera.lookAt(0, -0.1, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  let time = 0;
  let glitch = 0;
  let nextGlitch = 3;
  let blinkT = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    time += dt;

    advance(dt);
    blinkT += dt;
    if (blinkT > 0.5) {
      blinkT = 0;
      cursorOn = !cursorOn;
      paint();
    }
    if (litT > 0 && (litT -= dt) <= 0) {
      litKey = -1;
      drawKeys(P);
    }

    // glitch: on hover, plus a random burst now and then
    nextGlitch -= dt;
    if (nextGlitch <= 0 && !reduced) {
      glitch = 1;
      nextGlitch = 5 + Math.random() * 6;
    }
    const target = hover && !reduced ? 0.6 : 0;
    glitch = Math.max(target, glitch - dt * 3);
    crtUniforms.uGlitch.value = glitch;
    crtUniforms.uTime.value = time;
    screenLight.intensity = 5 + Math.sin(time * 55) * 0.4 + glitch * 3;

    // tilt toward the cursor + gentle idle sway
    const sway = reduced ? 0 : Math.sin(time * 0.5) * 0.08;
    rig.rotation.y += (mouse.x * 0.35 + sway - rig.rotation.y) * Math.min(1, dt * 4);
    rig.rotation.x += (-mouse.y * 0.12 - rig.rotation.x) * Math.min(1, dt * 4);
    renderer.render(scene, camera);
  }
  frame();
}
