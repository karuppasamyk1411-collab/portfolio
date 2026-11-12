import * as THREE from 'three';
import {
  R,
  UP,
  dirFrom,
  placeOnSurface,
  makeLabel,
  shadows,
  heightAt,
  anyPerpendicular,
  neonBox,
  neonCylinder,
  glowMat,
  NEON,
  DARK_METAL,
} from './utils.js';
import { profile, skills, projects, certifications, tryhackme } from './data.js';

const POLE = new THREE.Vector3(0, 1, 0);

/* ───────── helpers ───────── */

function zoneRing(scene, dir, radius, color) {
  const seg = 72;
  const t1 = anyPerpendicular(dir);
  const t2 = new THREE.Vector3().crossVectors(dir, t1);
  const positions = [];
  const idx = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    for (const rr of [radius - 0.3, radius]) {
      p.copy(dir).addScaledVector(t1, (Math.cos(a) * rr) / R).addScaledVector(t2, (Math.sin(a) * rr) / R).normalize();
      p.multiplyScalar(R + heightAt(p) + 0.14);
      positions.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(idx);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(1.5),
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  scene.add(mesh);
  return mesh;
}

function beam(group, a, b, r, material) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 5), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  group.add(m);
  return m;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/* ───────── builders ───────── */

function commandCenter() {
  const g = new THREE.Group();
  const base = neonBox(3.6, 2.6, 3.0, NEON.cyan);
  base.position.y = 0.9;
  const top = neonBox(2.2, 1.0, 2.0, NEON.cyan);
  top.position.y = 2.7;
  g.add(base, top);

  const lines = ['$ whoami', 'karuppasamy', '$ cat role.txt', 'soc_analyst', 'secure_dev', '$ status', 'ONLINE ▮'];
  const screenTex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#020611';
    ctx.fillRect(0, 0, w, h);
    ctx.font = '600 26px "JetBrains Mono", monospace';
    lines.forEach((l, i) => {
      ctx.fillStyle = l.startsWith('$') ? '#00f0ff' : '#39ff88';
      ctx.fillText(l, 24, 40 + i * 31);
    });
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), new THREE.MeshBasicMaterial({ map: screenTex }));
  screen.position.set(0, 1.25, 1.52);
  g.add(screen);

  // side window strips
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 2.4), glowMat(NEON.magenta, 3));
    strip.position.set(s * 1.82, 1.7, 0);
    g.add(strip);
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.6, 5), DARK_METAL);
  mast.position.set(0.6, 4.0, -0.4);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glowMat(NEON.magenta, 4));
  tip.position.set(0.6, 4.85, -0.4);
  g.add(mast, tip);

  shadows(g, true, true);
  return {
    group: g,
    update(t) {
      tip.material.emissiveIntensity = Math.sin(t * 4) > 0 ? 5 : 0.5;
    },
  };
}

function photoHologram(url) {
  const g = new THREE.Group();
  const W = 2.4;
  const H = 3.0;
  const Y = 4.4;

  // projector base
  const base = neonCylinder(0.7, 0.9, 0.5, 8, NEON.cyan);
  base.position.y = 0.1;
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16), glowMat(NEON.cyan, 4));
  lens.position.y = 0.42;
  g.add(base, lens);

  // floating photo with a hologram shader
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const uniforms = { map: { value: tex }, uTime: { value: 0 }, tint: { value: new THREE.Color(NEON.cyan) } };
  const photoMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D map; uniform float uTime; uniform vec3 tint; varying vec2 vUv;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        // occasional horizontal glitch shift
        float g = step(0.985, h(floor(uTime * 9.0))) * step(0.5, h(floor(uv.y * 30.0) + floor(uTime * 9.0)));
        uv.x += g * 0.03;
        vec3 c = texture2D(map, gl_FrontFacing ? uv : vec2(1.0 - uv.x, uv.y)).rgb;
        float scan = 0.88 + 0.12 * sin(uv.y * 520.0 - uTime * 8.0);
        float sweep = exp(-pow((fract(uv.y - uTime * 0.18) - 0.5) * 30.0, 2.0));
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = smoothstep(0.0, 0.03, min(e.x, e.y));
        float rim = 1.0 - smoothstep(0.0, 0.05, min(e.x, e.y));
        vec3 col = mix(c, c * tint * 1.3, 0.18) * scan * 0.92;
        col += tint * (sweep * 0.25 + rim * 0.6);
        float flick = 0.94 + 0.06 * h(floor(uTime * 20.0));
        gl_FragColor = vec4(col * flick, edge * 0.95);
      }`,
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(W, H), photoMat);
  const holder = new THREE.Group();
  holder.position.y = Y;
  holder.add(photo);
  // neon frame
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(W + 0.12, H + 0.12)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(NEON.cyan).multiplyScalar(2.4), toneMapped: false }),
  );
  holder.add(frame);
  g.add(holder);

  // projection beams from lens to the photo corners
  const pts = [];
  for (const [x, y] of [[-W / 2, -H / 2], [W / 2, -H / 2], [-W / 2, H / 2], [W / 2, H / 2]]) {
    pts.push(0, 0.5, 0, x, Y + y, 0);
  }
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const beamMat = new THREE.LineBasicMaterial({ color: new THREE.Color(NEON.cyan).multiplyScalar(1.6), transparent: true, opacity: 0.35, toneMapped: false });
  const beams = new THREE.LineSegments(beamGeo, beamMat);
  g.add(beams);

  shadows(base);
  return {
    group: g,
    update(t) {
      uniforms.uTime.value = t;
      holder.position.y = Y + Math.sin(t * 1.3) * 0.12;
      holder.rotation.y = Math.sin(t * 0.4) * 0.45;
      beams.rotation.y = holder.rotation.y;
      beamMat.opacity = 0.25 + 0.1 * Math.sin(t * 7);
    },
  };
}

function radarStation() {
  const g = new THREE.Group();
  const base = neonCylinder(1.2, 1.5, 1.4, 8, NEON.green);
  base.position.y = 0.4;
  const mast = neonCylinder(0.2, 0.3, 2.6, 6, NEON.green);
  mast.position.y = 2.4;
  g.add(base, mast);

  const head = new THREE.Group();
  head.position.y = 3.8;
  g.add(head);
  const dishGeo = new THREE.SphereGeometry(1.5, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.32);
  const dish = new THREE.Mesh(dishGeo, new THREE.MeshStandardMaterial({ color: '#141a33', metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide, flatShading: true }));
  const wire = new THREE.Mesh(dishGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.green).multiplyScalar(1.8), wireframe: true, toneMapped: false }));
  dish.add(wire);
  dish.rotation.x = Math.PI / 2.6;
  dish.position.y = 0.4;
  head.add(dish);

  // scanning laser
  const laserGeo = new THREE.CylinderGeometry(0.03, 0.03, 9, 4);
  laserGeo.translate(0, 4.5, 0);
  laserGeo.rotateX(Math.PI / 2);
  const laserMat = glowMat(NEON.green, 3);
  const laser = new THREE.Mesh(laserGeo, laserMat);
  laser.position.y = 0.7;
  laser.rotation.x = -0.18;
  head.add(laser);
  const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glowMat(NEON.green, 5));
  emitter.position.y = 0.7;
  head.add(emitter);

  shadows(g, true, true);
  laser.castShadow = false;
  return {
    group: g,
    update(t) {
      head.rotation.y = t * 0.9;
      laserMat.emissiveIntensity = 2 + Math.sin(t * 8);
    },
  };
}

function skillCore() {
  const g = new THREE.Group();
  const ped = neonCylinder(0.8, 1.0, 1.2, 6, NEON.cyan);
  ped.position.y = 0.3;
  g.add(ped);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), glowMat(NEON.cyan, 3));
  core.position.y = 1.7;
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.cyan).multiplyScalar(2), wireframe: true, toneMapped: false }),
  );
  shell.position.y = 1.7;
  g.add(core, shell);

  const crystals = [];
  const geo = new THREE.OctahedronGeometry(0.42, 0);
  skills.forEach((s, i) => {
    const a = (i / skills.length) * Math.PI * 2;
    const holder = new THREE.Group();
    holder.position.set(Math.cos(a) * 5.2, 3 + (i % 2) * 0.7, Math.sin(a) * 5.2);
    const cr = new THREE.Mesh(geo, glowMat(s.color, 2.2));
    cr.scale.y = 1.7;
    const label = makeLabel(s.category, { height: 0.42, color: s.color });
    label.position.y = 1.05;
    holder.add(cr, label);
    g.add(holder);
    crystals.push({ holder, cr, base: holder.position.y, i });
  });
  shadows(g, true, false);
  return {
    group: g,
    update(t) {
      core.rotation.y = t;
      shell.rotation.y = -t * 0.6;
      shell.rotation.x = t * 0.3;
      for (const c of crystals) {
        c.holder.position.y = c.base + Math.sin(t * 2 + c.i) * 0.22;
        c.cr.rotation.y = t * 1.5 + c.i;
      }
    },
  };
}

function certVault() {
  const g = new THREE.Group();
  const ped = neonCylinder(1.0, 1.3, 1.0, 6, NEON.magenta);
  ped.position.y = 0.3;
  g.add(ped);

  const shield = new THREE.Group();
  shield.position.y = 3.2;
  const hex = neonCylinder(1.4, 1.4, 0.25, 6, NEON.magenta);
  hex.rotation.x = Math.PI / 2;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 6), glowMat(NEON.magenta, 1.4));
  inner.rotation.x = Math.PI / 2;
  // check mark
  const ck1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.1), glowMat('#ffffff', 4));
  ck1.position.set(-0.2, -0.1, 0.2);
  ck1.rotation.z = 0.75;
  const ck2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 0.1), glowMat('#ffffff', 4));
  ck2.position.set(0.18, 0.08, 0.2);
  ck2.rotation.z = -0.6;
  shield.add(hex, inner, ck1, ck2);
  g.add(shield);

  const orbit = new THREE.Group();
  orbit.position.y = 3.2;
  g.add(orbit);
  const badgeGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 6);
  const colors = [NEON.cyan, NEON.amber, NEON.green, NEON.violet, NEON.magenta];
  certifications.forEach((_, i) => {
    const b = new THREE.Mesh(badgeGeo, glowMat(colors[i % colors.length], 2.5));
    const a = (i / certifications.length) * Math.PI * 2;
    b.position.set(Math.cos(a) * 2.4, Math.sin(a * 2) * 0.3, Math.sin(a) * 2.4);
    b.rotation.x = Math.PI / 2;
    orbit.add(b);
  });
  shadows(g, true, false);
  return {
    group: g,
    update(t) {
      shield.rotation.y = Math.sin(t * 0.8) * 0.6;
      shield.position.y = 3.2 + Math.sin(t * 1.5) * 0.15;
      orbit.rotation.y = t * 0.7;
      orbit.children.forEach((b, i) => (b.rotation.z = t * 2 + i));
    },
  };
}

function commTower() {
  const g = new THREE.Group();
  const legMat = glowMat(NEON.cyan, 0.9);
  const H = 8;
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const at = (cx, cz, y) => {
    const k = 1 - (y + 0.3) / (H + 0.3);
    const s = 0.2 + 0.8 * k;
    return new THREE.Vector3(cx * s, y, cz * s);
  };
  for (const [cx, cz] of corners) beam(g, at(cx, cz, -0.3), at(cx, cz, H), 0.06, legMat);
  for (const y of [1.2, 3.2, 5.2, 7]) {
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      beam(g, at(ax, az, y), at(bx, bz, y), 0.03, legMat);
      beam(g, at(ax, az, y), at(bx, bz, y + 2 > H ? H : y + 2), 0.025, legMat);
    }
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), glowMat(NEON.magenta, 5));
  beacon.position.y = H + 0.3;
  g.add(beacon);

  // signal rings
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.035, 6, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.magenta).multiplyScalar(2), transparent: true, toneMapped: false, depthWrite: false }),
    );
    r.rotation.x = Math.PI / 2;
    r.position.y = H + 0.3;
    g.add(r);
    rings.push(r);
  }

  // terminal kiosk
  const kiosk = neonBox(0.9, 1.3, 0.6, NEON.cyan);
  kiosk.position.set(2.6, 0.4, 0.6);
  kiosk.rotation.y = -0.4;
  const kScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), glowMat(NEON.green, 1.6));
  kScreen.position.set(0, 0.3, 0.31);
  kiosk.add(kScreen);
  g.add(kiosk);

  shadows(g, true, false);
  rings.forEach((r) => (r.castShadow = false));
  return {
    group: g,
    update(t) {
      beacon.material.emissiveIntensity = Math.sin(t * 5) > 0.3 ? 6 : 0.4;
      rings.forEach((r, i) => {
        const p = (t * 0.45 + i / 3) % 1;
        r.scale.setScalar(0.5 + p * 6);
        r.material.opacity = 1 - p;
      });
    },
  };
}

function projectTexture(p) {
  return canvasTexture(1024, 600, (ctx, w, h) => {
    const col = new THREE.Color(p.color);
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#060818');
    bg.addColorStop(1, `#${col.clone().multiplyScalar(0.25).getHexString()}`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // grid
    ctx.strokeStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.12)`;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);

    ctx.fillStyle = p.color;
    ctx.font = '600 34px "JetBrains Mono", monospace';
    ctx.fillText(`// ${p.tagline.toUpperCase()}`, 56, 92);

    ctx.fillStyle = '#e9f6ff';
    ctx.font = '700 92px "Space Grotesk", sans-serif';
    wrapText(ctx, p.title, w - 112).forEach((l, i) => ctx.fillText(l, 56, 200 + i * 98));

    ctx.font = '600 30px "JetBrains Mono", monospace';
    let x = 56;
    for (const tag of p.tags) {
      const tw = ctx.measureText(tag).width + 36;
      if (x + tw > w - 56) break;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, h - 120, tw, 56);
      ctx.fillStyle = '#e9f6ff';
      ctx.fillText(tag, x + 18, h - 81);
      x += tw + 16;
    }
  });
}

function holoBillboard(p) {
  const g = new THREE.Group();
  const postMat = glowMat(p.color, 1.6);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.14), postMat);
    post.position.set(s * 2.2, 1.4, 0);
    g.add(post);
  }
  const frame = neonBox(4.7, 2.9, 0.16, p.color);
  frame.position.y = 3.2;
  g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.64), new THREE.MeshBasicMaterial({ map: projectTexture(p) }));
  face.position.set(0, 3.2, 0.09);
  g.add(face);
  const back = face.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.09;
  g.add(back);
  shadows(g, true, false);
  return { group: g };
}

/* ── TryHackMe "Hack & Byte Diner": neon diner with a rooftop billboard ── */
function neonText(ctx, text, x, y, color, blur = 28) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = blur / 2;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.35;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

function thmBillboardTexture(thm) {
  return canvasTexture(1024, 380, (ctx, w, h) => {
    ctx.fillStyle = '#04070f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(57,255,136,0.08)';
    for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // double neon border
    ctx.shadowColor = '#39ff88';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#39ff88';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.strokeStyle = '#ff2bd6';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, w - 60, h - 60);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.font = '600 30px "JetBrains Mono", monospace';
    neonText(ctx, '★  NOW SERVING  ★', w / 2, 86, '#ffb800', 14);
    ctx.font = '700 150px "Space Grotesk", sans-serif';
    neonText(ctx, 'TRYHACKME', w / 2, 225, '#39ff88', 34);
    ctx.font = '600 38px "JetBrains Mono", monospace';
    neonText(ctx, thm.tagline.toUpperCase(), w / 2, 292, '#ff2bd6', 16);
    ctx.font = '500 24px "JetBrains Mono", monospace';
    ctx.fillStyle = '#9fb3d9';
    ctx.fillText(`tryhackme.com/p/${thm.username}`, w / 2, 336);
  });
}

function thmMenuTexture(thm) {
  return canvasTexture(512, 640, (ctx, w, h) => {
    ctx.fillStyle = '#0a0f1f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffb800';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.textAlign = 'center';
    ctx.font = '700 46px "Space Grotesk", sans-serif';
    neonText(ctx, "TODAY'S MENU", w / 2, 78, '#ffb800', 16);
    ctx.font = '500 20px "JetBrains Mono", monospace';
    ctx.fillStyle = '#9fb3d9';
    ctx.fillText('fresh off the TryHackMe grill', w / 2, 112);
    ctx.textAlign = 'left';
    let y = 170;
    for (const m of thm.menu) {
      ctx.font = '600 24px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#eaf2ff';
      wrapText(ctx, m.item, w - 80).forEach((line, i) => ctx.fillText(line, 40, y + i * 28));
      y += 28 * Math.max(1, wrapText(ctx, m.item, w - 80).length);
      ctx.font = '600 20px "JetBrains Mono", monospace';
      neonText(ctx, `${m.done ? '✔' : '◔'} ${m.status}`, 40, y + 4, m.done ? '#39ff88' : '#ffb800', 10);
      y += 62;
    }
    ctx.textAlign = 'center';
    ctx.font = '600 20px "JetBrains Mono", monospace';
    neonText(ctx, 'drive in to order ↓', w / 2, h - 40, '#00f0ff', 10);
  });
}

function cyberDiner(thm) {
  const g = new THREE.Group();
  const hall = neonBox(5.2, 2.4, 3.0, NEON.magenta);
  hall.position.y = 0.8;
  g.add(hall);

  // glowing front windows with booth silhouettes
  const winTex = canvasTexture(512, 100, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ffcf7a');
    grad.addColorStop(1, '#ff7a59');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(30,10,40,0.85)';
    for (let x = 30; x < w; x += 90) {
      ctx.beginPath();
      ctx.arc(x, 62, 14, 0, Math.PI * 2); // a diner's head
      ctx.fill();
      ctx.fillRect(x - 18, 74, 36, 30);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < w; x += 128) ctx.fillRect(x, 0, 4, h);
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.75), new THREE.MeshBasicMaterial({ map: winTex }));
  win.position.set(0.5, 1.15, 1.52);
  g.add(win);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.35), glowMat(NEON.cyan, 0.8));
  door.position.set(-1.95, 0.35, 1.52);
  g.add(door);

  // striped awning
  const awnTex = canvasTexture(256, 32, (ctx, w, h) => {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? '#ff2bd6' : '#f4f0ff';
      ctx.fillRect(i * 16, 0, 16, h);
    }
  });
  const awning = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.08, 0.8), new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.6 }));
  awning.position.set(0, 1.85, 1.85);
  awning.rotation.x = 0.35;
  g.add(awning);

  // "OPEN 24/7" neon
  const openTex = canvasTexture(256, 96, (ctx, w, h) => {
    ctx.textAlign = 'center';
    ctx.font = '700 58px "Space Grotesk", sans-serif';
    neonText(ctx, 'OPEN 24/7', w / 2, 68, '#ff2b4f', 18);
  });
  const openMat = new THREE.MeshBasicMaterial({ map: openTex, transparent: true, toneMapped: false });
  const openSign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.42), openMat);
  openSign.position.set(1.6, 0.45, 1.53);
  g.add(openSign);

  // rooftop billboard
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.16), DARK_METAL);
    post.position.set(s * 2.3, 2.7, -0.3);
    g.add(post);
  }
  const frame = neonBox(6.3, 2.45, 0.2, NEON.green);
  frame.position.set(0, 4.55, -0.3);
  g.add(frame);
  const bbMat = new THREE.MeshBasicMaterial({ map: thmBillboardTexture(thm), toneMapped: false, transparent: true });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 2.27), bbMat);
  face.position.set(0, 4.55, -0.19);
  g.add(face);
  const back = face.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.41;
  g.add(back);

  // giant neon donut
  const donut = new THREE.Group();
  const dough = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.24, 10, 24), new THREE.MeshStandardMaterial({ color: '#4a2a1a', emissive: '#ff2bd6', emissiveIntensity: 0.6, flatShading: true }));
  donut.add(dough);
  const sprinkleGeo = new THREE.BoxGeometry(0.1, 0.03, 0.03);
  const sprinkleMats = [NEON.cyan, NEON.green, NEON.amber, '#ffffff'].map((c) => glowMat(c, 2.5));
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const sp = new THREE.Mesh(sprinkleGeo, sprinkleMats[i % sprinkleMats.length]);
    sp.position.set(Math.cos(a) * (0.55 + Math.sin(i * 3.7) * 0.12), Math.sin(a) * (0.55 + Math.sin(i * 3.7) * 0.12), 0.22);
    sp.rotation.z = i * 1.3;
    donut.add(sp);
  }
  donut.position.set(-2.2, 6.6, -0.3);
  g.add(donut);

  // menu board out front
  const menu = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.08), DARK_METAL);
    leg.position.set(s * 0.72, 0.85, 0);
    menu.add(leg);
  }
  const board = neonBox(1.6, 2.0, 0.08, NEON.amber);
  board.position.y = 1.55;
  const menuFace = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.88), new THREE.MeshBasicMaterial({ map: thmMenuTexture(thm), toneMapped: false }));
  menuFace.position.set(0, 1.55, 0.05);
  menu.add(board, menuFace);
  menu.position.set(3.7, 0, 2.2);
  menu.rotation.y = -0.35;
  g.add(menu);

  shadows(g, true, true);
  [win, door, openSign, face, back, menuFace].forEach((m) => (m.castShadow = false));
  return {
    group: g,
    menuOffset: new THREE.Vector3(3.7, 0, 2.2),
    update(t) {
      donut.rotation.y = t * 0.9;
      donut.position.y = 6.6 + Math.sin(t * 1.6) * 0.12;
      // neon flicker on the billboard + blinking OPEN sign
      const f = Math.sin(t * 37) > 0.97 || Math.sin(t * 13.3) > 0.995 ? 0.35 : 1;
      bbMat.opacity = f;
      openMat.opacity = Math.sin(t * 2.2) > -0.2 ? 1 : 0.15;
    },
  };
}

function ctfFlag() {
  const g = new THREE.Group();
  const base = neonCylinder(0.8, 1.0, 0.6, 6, NEON.amber);
  base.position.y = 0.1;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6), glowMat('#ffffff', 2));
  pole.position.y = 2.4;
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.1, 12, 4),
    new THREE.MeshStandardMaterial({ color: '#000', emissive: NEON.amber, emissiveIntensity: 2, side: THREE.DoubleSide, flatShading: true }),
  );
  cloth.geometry.translate(0.9, 0, 0);
  cloth.position.set(0.06, 4.0, 0);
  g.add(base, pole, cloth);
  shadows(g, true, false);
  const pos = cloth.geometry.attributes.position;
  const orig = pos.array.slice();
  return {
    group: g,
    update(t) {
      for (let i = 0; i < pos.count; i++) {
        const x = orig[i * 3];
        pos.setZ(i, Math.sin(x * 3 - t * 5) * 0.15 * x);
      }
      pos.needsUpdate = true;
    },
  };
}

/* ───────── world layout ───────── */

export function createLandmarks(scene, obstacles) {
  const zones = [];
  const clearings = [];
  const updaters = [];

  const addZone = (id, dir, radius, color) => {
    const ring = zoneRing(scene, dir, radius, color);
    const zone = { id, dir: dir.clone(), radius, ring, color, active: false };
    zones.push(zone);
    clearings.push({ dir: dir.clone(), radius: radius + 1.5 });
    return zone;
  };
  const addLabel = (text, dir, lift, height, opts) => {
    const s = makeLabel(text, { height, ...opts });
    s.position.copy(dir).multiplyScalar(R + heightAt(dir) + lift);
    scene.add(s);
    return s;
  };
  const addLandmark = (built, dir, face = POLE) => {
    placeOnSurface(built.group, dir, { face });
    scene.add(built.group);
    built.group.updateMatrixWorld(true);
    if (built.update) updaters.push(built.update);
    return built.group;
  };
  const obstacleAt = (group, x, z, radius) => {
    const w = group.localToWorld(new THREE.Vector3(x, 0, z)).normalize();
    obstacles.push({ dir: w, radius });
  };

  // Start / welcome
  addZone('welcome', POLE, 4.5, NEON.cyan);
  const wDir = dirFrom(9, -90);
  const welcomeLabels = [
    addLabel(profile.shortName, wDir, 4.8, 1.7, { color: '#e9f6ff' }),
    addLabel('// ' + profile.role.toUpperCase(), wDir, 3.6, 0.5, { color: NEON.cyan }),
  ];

  // About: command center
  const aboutDir = dirFrom(24, -62);
  const center = addLandmark(commandCenter(), aboutDir);
  obstacles.push({ dir: aboutDir.clone(), radius: 2.3 });
  // photo hologram beside the command center, facing the start
  if (profile.photo) {
    const holoDir = center.localToWorld(new THREE.Vector3(-3.9, 0, 1.0)).normalize();
    addLandmark(photoHologram(profile.photo), holoDir);
    obstacles.push({ dir: holoDir, radius: 0.9 });
  }
  addZone('about', aboutDir, 6.5, NEON.cyan);
  addLabel('ABOUT', aboutDir, 6.2, 1.0, { color: NEON.cyan });

  // Skills: core + crystals
  const skillsDir = dirFrom(30, -20);
  addLandmark(skillCore(), skillsDir);
  obstacles.push({ dir: skillsDir.clone(), radius: 1.0 });
  addZone('skills', skillsDir, 7, NEON.violet);
  addLabel('SKILLS', skillsDir, 6.0, 1.0, { color: NEON.violet });

  // Experience: SOC radar
  const expDir = dirFrom(30, -160);
  addLandmark(radarStation(), expDir);
  obstacles.push({ dir: expDir.clone(), radius: 1.4 });
  addZone('experience', expDir, 6.5, NEON.green);
  addLabel('EXPERIENCE', expDir, 7.4, 1.0, { color: NEON.green });

  // Certifications: vault
  const certDir = dirFrom(32, 40);
  addLandmark(certVault(), certDir);
  obstacles.push({ dir: certDir.clone(), radius: 1.2 });
  addZone('certs', certDir, 6.5, NEON.magenta);
  addLabel('CERTIFICATIONS', certDir, 6.0, 0.9, { color: NEON.magenta });

  // Contact: comms tower
  const contactDir = dirFrom(36, 120);
  const tower = addLandmark(commTower(), contactDir);
  obstacles.push({ dir: contactDir.clone(), radius: 1.3 });
  obstacleAt(tower, 2.6, 0.6, 0.6);
  addZone('contact', contactDir, 6.5, NEON.amber);
  addLabel('CONTACT', contactDir, 10.2, 1.0, { color: NEON.amber });

  // Projects: holographic billboards in an arc
  const n = projects.length;
  projects.forEach((p, i) => {
    const bearing = n === 1 ? -90 : -135 + (90 * i) / (n - 1);
    const dir = dirFrom(64, bearing);
    const bb = addLandmark(holoBillboard(p), dir);
    obstacleAt(bb, -2.2, 0, 0.25);
    obstacleAt(bb, 2.2, 0, 0.25);
    addZone(`project-${i}`, dir, 4.8, p.color);
  });
  addLabel('PROJECTS', dirFrom(50, -90), 7, 1.3, { color: '#e9f6ff' });

  // TryHackMe: the Hack & Byte Diner
  if (tryhackme) {
    const thmDir = dirFrom(46, 78);
    const built = cyberDiner(tryhackme);
    const diner = addLandmark(built, thmDir);
    obstacles.push({ dir: thmDir.clone(), radius: 2.8 });
    obstacleAt(diner, built.menuOffset.x, built.menuOffset.z, 0.7);
    addZone('thm', thmDir, 7.5, NEON.green);
    addLabel('HACK & BYTE DINER', thmDir, 8.4, 0.9, { color: NEON.green });
  }

  // Easter egg: Capture The Flag at the south pole
  const southDir = dirFrom(180, 0);
  addLandmark(ctfFlag(), southDir);
  obstacles.push({ dir: southDir.clone(), radius: 0.9 });
  addZone('ctf', southDir, 5, NEON.amber);
  addLabel('CAPTURE THE FLAG', southDir, 6, 0.9, { color: NEON.amber });

  let time = 0;
  return {
    zones,
    clearings,
    /** fade the big start-area name out once the rover drives away from the start */
    fadeWelcome(roverPos) {
      const d = roverPos.distanceTo(POLE) * R;
      const o = THREE.MathUtils.clamp(1 - (d - 4.5) / 2.5, 0, 1);
      for (const s of welcomeLabels) {
        s.material.opacity = o;
        s.visible = o > 0.01;
      }
    },
    setActive(zone) {
      for (const z of zones) z.active = z === zone;
    },
    update(t, dt) {
      time = t;
      for (const u of updaters) u(t, dt);
      for (const z of zones) {
        const target = z.active ? 0.75 + 0.25 * Math.sin(time * 6) : 0.35;
        z.ring.material.opacity += (target - z.ring.material.opacity) * Math.min(1, dt * 8);
      }
    },
  };
}
