import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createDefense } from './defense.js';
import { createMinimap } from './minimap.js';
import { createRoads } from './roads.js';

// Glitch / CRT pass: chromatic aberration, tearing bands, grain, vignette
const GlitchShader = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAmount; uniform float uTime; varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float t = floor(uTime * 24.0);
      float band = step(1.0 - 0.35 * uAmount, rand(vec2(floor(uv.y * 28.0), t)));
      uv.x += (rand(vec2(floor(uv.y * 90.0), t)) - 0.5) * 0.08 * uAmount * band;
      float s = 0.0012 + 0.01 * uAmount;
      vec4 c = texture2D(tDiffuse, uv);
      c.r = texture2D(tDiffuse, uv + vec2(s, 0.0)).r;
      c.b = texture2D(tDiffuse, uv - vec2(s, 0.0)).b;
      c.rgb = mix(c.rgb, c.rgb * vec3(1.25, 0.75, 0.8), band * uAmount * 0.6);  // red tint on tears
      c.rgb += (rand(vUv * (uTime + 1.0)) - 0.5) * 0.025;                     // grain
      c.rgb *= 0.96 + 0.04 * sin(vUv.y * 900.0);                               // scanlines
      float v = smoothstep(1.0, 0.4, length(vUv - 0.5));
      c.rgb *= mix(0.8, 1.0, v);                                            // vignette
      gl_FragColor = c;
    }`,
};
import './style.css';
import { R, tangentTowards, walk, anyPerpendicular, orientQuat, placeOnSurface } from './utils.js';
import { createPlanet, scatterProps, createSky, createOrbs } from './planet.js';
import { createRover, START, START_FWD } from './rover.js';
import { createLandmarks } from './landmarks.js';
import { initUI } from './ui.js';

async function main() {
  try {
    await Promise.all([
      document.fonts.load('700 128px "JetBrains Mono"'),
      document.fonts.load('600 32px "JetBrains Mono"'),
      document.fonts.load('700 92px "Space Grotesk"'),
    ]);
  } catch {
    /* fonts are optional */
  }

  /* ── renderer / scene ── */
  const canvas = document.querySelector('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const pixelRatio = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  // "Root" theme (picked on the portfolio): black + blood red instead of the dusk-blue neon look
  const ROOT = document.documentElement.dataset.theme === 'root';
  // sky gradient (screen space)
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4;
  skyCanvas.height = 512;
  const sctx = skyCanvas.getContext('2d');
  const sg = sctx.createLinearGradient(0, 0, 0, 512);
  const stops = ROOT ? ['#000000', '#0c0002', '#24000a', '#4a0012'] : ['#0b1a4a', '#1f3a8f', '#3d3fb0', '#6a3fb3'];
  [0, 0.45, 0.75, 1].forEach((p, i) => sg.addColorStop(p, stops[i]));
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 4, 512);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1200);
  camera.position.set(0, 34, 72);

  scene.add(ROOT ? new THREE.HemisphereLight('#ffc2c9', '#1a0005', 1.25) : new THREE.HemisphereLight('#b4c2ff', '#3a2a6a', 1.6));
  const sun = new THREE.DirectionalLight('#e6ecff', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  /* ── post-processing (bloom = the neon glow) ── */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.45, 0.96);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const glitch = new ShaderPass(GlitchShader);
  composer.addPass(glitch);
  let glitchAmt = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const kick = (a) => (glitchAmt = reducedMotion ? 0 : Math.max(glitchAmt, a));

  /* ── world ── */
  const obstacles = [];
  const landmarks = createLandmarks(scene, obstacles);
  const planet = createPlanet(scene, landmarks.clearings);

  // road network: start → every landmark, plus About → each project billboard
  const zoneById = Object.fromEntries(landmarks.zones.map((z) => [z.id, z]));
  const links = [];
  for (const id of ['about', 'skills', 'experience', 'certs', 'contact', 'thm']) {
    const z = zoneById[id];
    if (z) links.push({ from: START, to: z.dir, trimStart: 2.5, trimEnd: z.radius * 0.55 });
  }
  if (zoneById.about) {
    for (const z of landmarks.zones.filter((zz) => zz.id.startsWith('project-'))) {
      links.push({ from: zoneById.about.dir, to: z.dir, trimStart: zoneById.about.radius * 0.6, trimEnd: 2.6 });
    }
  }
  const roads = createRoads(scene, links);
  // keep pylons, crystals and data bits off the tarmac
  scatterProps(scene, [...landmarks.clearings, ...roads.samples], obstacles);
  const sky = createSky(scene);
  if (ROOT) {
    planet.setColors('#ff2a45', '#ffffff');
    sky.setColors({ inner: '#ff1f3d', outer: '#5a0010', rings: ['#ff1f3d', '#ffffff'] });
  }
  const orbs = createOrbs(scene, obstacles);
  const rover = createRover(scene);

  /* ── camera rig ── */
  const cam = { up: START.clone(), fwd: START_FWD.clone(), yaw: 0, dist: 11 };
  const lookCur = new THREE.Vector3(0, 4, 0);
  const _target = new THREE.Vector3();
  const _desired = new THREE.Vector3();
  const _f = new THREE.Vector3();
  const _look = new THREE.Vector3();

  function computeDesired() {
    _target.copy(rover.root.position).addScaledVector(cam.up, 1.2);
    _desired.copy(_target).addScaledVector(cam.up, cam.dist * 0.5).addScaledVector(cam.fwd, -cam.dist);
    _look.copy(_target).addScaledVector(cam.fwd, 2);
  }

  let started = false;
  let startTime = 0;
  let t = 0;
  let dragging = false;
  let lastX = 0;
  let lastDrag = -10;

  function updateCamera(dt) {
    cam.up.lerp(rover.state.pos, 1 - Math.exp(-dt * 6)).normalize();
    _f.copy(rover.state.fwd).applyAxisAngle(rover.state.pos, cam.yaw);
    cam.fwd.lerp(_f, 1 - Math.exp(-dt * 3));
    cam.fwd.addScaledVector(cam.up, -cam.fwd.dot(cam.up));
    if (cam.fwd.lengthSq() < 1e-4) cam.fwd.copy(_f);
    cam.fwd.normalize();
    if (!dragging && t - lastDrag > 1.2) cam.yaw *= Math.exp(-dt * 2);

    computeDesired();
    const rate = THREE.MathUtils.lerp(1.4, 8, Math.min(1, (t - startTime) / 3));
    const k = 1 - Math.exp(-dt * rate);
    camera.position.lerp(_desired, k);
    lookCur.lerp(_look, k);
    camera.up.copy(cam.up);
    camera.lookAt(lookCur);
  }

  function snapCamera() {
    cam.up.copy(rover.state.pos);
    cam.fwd.copy(rover.state.fwd);
    cam.yaw = 0;
    computeDesired();
    camera.position.copy(_desired);
    lookCur.copy(_look);
  }

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    cam.yaw -= (e.clientX - lastX) * 0.006;
    lastX = e.clientX;
    lastDrag = t;
  });
  const endDrag = () => (dragging = false);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      cam.dist = THREE.MathUtils.clamp(cam.dist + e.deltaY * 0.01, 6, 22);
    },
    { passive: true },
  );

  /* ── zones & UI ── */
  let current = null;
  let dismissed = null;

  const ui = initUI({
    onStart(instant) {
      started = true;
      startTime = instant ? t - 3 : t;
      if (instant) snapCamera();
    },
    onTeleport(id) {
      const z = landmarks.zones.find((zz) => zz.id === id);
      if (!z) return;
      const back = tangentTowards(z.dir, START);
      const pos = walk(z.dir, back, z.radius * 0.6);
      rover.teleport(pos, tangentTowards(pos, z.dir));
      dismissed = null;
      current = null;
      if (started) snapCamera();
    },
    onReset() {
      rover.teleport(START, START_FWD);
      dismissed = null;
      snapCamera();
    },
    onDismiss() {
      dismissed = current?.id ?? null;
    },
  });

  const defense = createDefense(scene, {
    onBlocked(info) {
      kick(0.35);
      if (started) ui.threatBlocked(info);
    },
  });
  // occasional "intrusion → contained" drama
  (function scheduleIntrusion() {
    setTimeout(() => {
      ui.intrusion(kick);
      scheduleIntrusion();
    }, 22000 + Math.random() * 20000);
  })();

  const minimap = createMinimap(document.querySelector('#minimap'), landmarks.zones, {
    onPick: (id) => (id === 'welcome' ? ui.goTo('about') : ui.goTo(id)),
    visited: ui.visited,
  });

  /* ── GPS guidance: arrow above the rover + beacon at the target ── */
  const arrow = new THREE.Group();
  const arrowMat = new THREE.MeshStandardMaterial({ color: '#0b1640', emissive: '#00f0ff', emissiveIntensity: 0.6, flatShading: true });
  // flat chevron-style arrow, extruded so it has real thickness
  const shape = new THREE.Shape();
  shape.moveTo(-0.22, -0.7);
  shape.lineTo(0.22, -0.7);
  shape.lineTo(0.22, 0.1);
  shape.lineTo(0.6, 0.1);
  shape.lineTo(0, 0.95);
  shape.lineTo(-0.6, 0.1);
  shape.lineTo(-0.22, 0.1);
  shape.closePath();
  const arrowGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false });
  arrowGeo.translate(0, 0, -0.11);
  arrowGeo.rotateX(Math.PI / 2); // lie flat: the shape's tip (+Y) now points along local +Z (forward)
  const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
  const arrowEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(arrowGeo),
    new THREE.LineBasicMaterial({ color: new THREE.Color('#00f0ff').multiplyScalar(2.2), toneMapped: false }),
  );
  arrow.add(arrowMesh, arrowEdges);
  arrow.visible = false;
  scene.add(arrow);

  const beacon = new THREE.Group();
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#00f0ff').multiplyScalar(2), transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false });
  const beaconGeo = new THREE.CylinderGeometry(0.12, 0.12, 36, 6, 1, true);
  beaconGeo.translate(0, 18, 0);
  beacon.add(new THREE.Mesh(beaconGeo, beaconMat));
  beacon.visible = false;
  scene.add(beacon);
  const _tan = new THREE.Vector3();
  let beaconFor = null;

  function updateGuide() {
    const id = ui.nextTarget();
    const z = id && landmarks.zones.find((zz) => zz.id === id);
    if (!z || current?.id === z.id) {
      arrow.visible = false;
      beacon.visible = false;
      ui.setGuide(null);
      return;
    }
    const dist = Math.acos(THREE.MathUtils.clamp(rover.state.pos.dot(z.dir), -1, 1)) * R;
    tangentTowards(rover.state.pos, z.dir, _tan);
    arrow.visible = true;
    arrow.position.copy(rover.root.position).addScaledVector(rover.state.pos, 3.0 + Math.sin(t * 3) * 0.12);
    orientQuat(rover.state.pos, _tan, arrow.quaternion);
    arrowMat.emissive.set(z.color);
    arrowEdges.material.color.set(z.color).multiplyScalar(2.2);
    if (beaconFor !== z.id) {
      beaconFor = z.id;
      placeOnSurface(beacon, z.dir);
      beaconMat.color.set(z.color).multiplyScalar(2);
    }
    beacon.visible = true;
    beaconMat.opacity = 0.4 + 0.2 * Math.sin(t * 4);
    ui.setGuide(z.id, dist);
  }

  function checkZones() {
    let best = null;
    let bd = Infinity;
    for (const z of landmarks.zones) {
      const d = rover.state.pos.distanceTo(z.dir) * R;
      if (d < z.radius && d < bd) {
        best = z;
        bd = d;
      }
    }
    if ((best?.id ?? null) !== (current?.id ?? null)) {
      current = best;
      ui.setCurrent(best?.id ?? null);
      if (best) {
        if (dismissed !== best.id) ui.show(best.id);
      } else {
        ui.hide();
        dismissed = null;
      }
    }
    landmarks.setActive(best);
  }

  /* ── loop ── */
  const clock = new THREE.Clock();
  const _right = new THREE.Vector3();
  const _toCam = new THREE.Vector3();
  const _up = new THREE.Vector3();

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    if (started) {
      const input = ui.getInput();
      input.atDestination = !!current && current.id !== 'welcome'; // driver hops out at landmarks
      rover.update(dt, input, obstacles);
      updateCamera(dt);
      checkZones();
      updateGuide();
      landmarks.fadeWelcome(rover.state.pos);
    } else {
      const a = t * 0.07;
      camera.position.set(Math.sin(a) * 72, 34, Math.cos(a) * 72);
      camera.up.set(0, 1, 0);
      camera.lookAt(lookCur);
    }
    orbs.update(dt, rover.state);
    landmarks.update(t, dt);
    planet.update(t);
    sky.update(dt);
    defense.update(dt, _up.copy(rover.root.position).normalize(), true);
    if (started) minimap.draw(rover.state.pos, rover.state.fwd, t, current?.id);
    glitchAmt *= Math.exp(-dt * 4);
    glitch.uniforms.uAmount.value = glitchAmt;
    glitch.uniforms.uTime.value = t;

    // keep the key light & its shadow box centred on the rover, lit from the camera's side
    const focus = rover.root.position;
    _up.copy(focus).normalize();
    _right.setFromMatrixColumn(camera.matrixWorld, 0);
    _toCam.copy(camera.position).sub(focus).normalize();
    if (Math.abs(_up.dot(_right)) > 0.99) anyPerpendicular(_up, _right);
    sun.position.copy(focus).addScaledVector(_up, 45).addScaledVector(_right, 22).addScaledVector(_toCam, 12);
    sun.target.position.copy(focus);

    composer.render();
    requestAnimationFrame(frame);
  }
  frame();

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    bloom.resolution.set(innerWidth, innerHeight);
  });
}

main();
