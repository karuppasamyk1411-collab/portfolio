import * as THREE from 'three';
import { linuxLine, windowsLine, MITRE } from './logs.js';

// A 3D SOC workstation: three monitors with live, canvas-drawn screens
//   left   → Linux terminal (auth.log / syslog / auditd / ufw / fail2ban)
//   centre → SIEM overview dashboard
//   right  → Windows Event Viewer (Security / Sysmon / PowerShell)
// Click a screen to zoom in; click again (or Esc) to zoom out.

const W = 1024;
const H = 576;
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SANS = '"Inter", system-ui, sans-serif';
const LVL = { info: '#c9d1d9', ok: '#3fb950', warn: '#e3b341', alert: '#ff6b81', block: '#58a6ff' };

function makeScreen() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { c, ctx: c.getContext('2d'), tex };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

/* ── screen painters ── */
function drawLinux(s, lines, host, t) {
  const { ctx } = s;
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#161b26';
  ctx.fillRect(0, 0, W, 40);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(22 + i * 22, 20, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.font = `500 16px ${MONO}`;
  ctx.fillStyle = '#8b96ad';
  ctx.fillText(`root@${host}: ~ — tail -F /var/log/auth.log /var/log/syslog /var/log/audit/audit.log`, 96, 26);
  ctx.font = `500 17px ${MONO}`;
  const LH = 25;
  const max = Math.floor((H - 60) / LH);
  const view = lines.slice(-max);
  view.forEach((l, i) => {
    ctx.fillStyle = LVL[l.lvl] || LVL.info;
    ctx.fillText(l.text, 16, 70 + i * LH);
  });
  if (Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = '#3fb950';
    ctx.fillRect(16, 70 + view.length * LH - 16, 11, 20);
  }
}

function drawWindows(s, rows, domain) {
  const { ctx } = s;
  ctx.fillStyle = '#121826';
  ctx.fillRect(0, 0, W, H);
  // title bar + breadcrumb
  ctx.fillStyle = '#1d2638';
  ctx.fillRect(0, 0, W, 40);
  ctx.font = `600 16px ${SANS}`;
  ctx.fillStyle = '#e6edf7';
  ctx.fillText('Event Viewer', 16, 26);
  ctx.font = `400 15px ${SANS}`;
  ctx.fillStyle = '#93a2bf';
  ctx.fillText(`${domain}  ›  Windows Logs  ›  Security  ·  Microsoft-Windows-Sysmon/Operational  ·  PowerShell`, 130, 26);
  // column header
  const cols = [16, 168, 278, 370, 500];
  ctx.fillStyle = '#18202f';
  ctx.fillRect(0, 44, W, 30);
  ctx.font = `600 14px ${SANS}`;
  ctx.fillStyle = '#93a2bf';
  ['Level', 'Time', 'Event ID', 'Source', 'Message'].forEach((h, i) => ctx.fillText(h, cols[i], 64));
  const LEVEL = {
    ok: ['Audit Success', '#3fb950'],
    warn: ['Audit Failure', '#e3b341'],
    alert: ['Critical', '#ff6b81'],
    info: ['Information', '#58a6ff'],
  };
  const RH = 30;
  const max = 12;
  rows.slice(0, max).forEach((r, i) => {
    const y = 80 + i * RH;
    if (i === 0) {
      ctx.fillStyle = 'rgba(88,166,255,0.18)';
      ctx.fillRect(0, y - 2, W, RH);
    } else if (i % 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(0, y - 2, W, RH);
    }
    const [label, col] = LEVEL[r.lvl] || LEVEL.info;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cols[0] + 6, y + 13, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `500 14px ${SANS}`;
    ctx.fillText(label, cols[0] + 18, y + 18);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = `500 14px ${MONO}`;
    ctx.fillText(r.time, cols[1], y + 18);
    ctx.fillStyle = '#e6edf7';
    ctx.font = `700 14px ${MONO}`;
    ctx.fillText(String(r.id), cols[2], y + 18);
    ctx.font = `500 14px ${SANS}`;
    ctx.fillStyle = '#93a2bf';
    ctx.fillText(r.ch, cols[3], y + 18);
    ctx.fillStyle = '#c9d1d9';
    ctx.fillText(r.msg, cols[4], y + 18);
  });
  // details pane for the selected (newest) event
  const top = 80 + max * RH + 6;
  ctx.fillStyle = '#0d1320';
  ctx.fillRect(0, top, W, H - top);
  ctx.fillStyle = '#58a6ff';
  ctx.fillRect(0, top, W, 2);
  const r = rows[0];
  if (r) {
    ctx.font = `600 15px ${SANS}`;
    ctx.fillStyle = '#e6edf7';
    ctx.fillText(`Event ${r.id}, ${r.ch}  ·  Computer: ${r.host}`, 16, top + 28);
    ctx.font = `500 14px ${MONO}`;
    ctx.fillStyle = '#c9d1d9';
    ctx.fillText(r.msg, 16, top + 54);
  }
}

function drawSiem(s, st, t) {
  const { ctx } = s;
  ctx.fillStyle = '#0a1020';
  ctx.fillRect(0, 0, W, H);
  // header
  ctx.font = `700 22px ${SANS}`;
  ctx.fillStyle = '#e6edf7';
  ctx.fillText('SIEM · SOC Overview', 22, 38);
  ctx.font = `500 14px ${MONO}`;
  ctx.fillStyle = '#93a2bf';
  ctx.fillText(`last 15 min · ${new Date().toLocaleTimeString('en-GB')}`, 262, 37);
  ctx.fillStyle = Math.floor(t * 2) % 2 ? '#3fb950' : '#1f6f35';
  ctx.beginPath();
  ctx.arc(W - 74, 32, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3fb950';
  ctx.font = `700 14px ${MONO}`;
  ctx.fillText('LIVE', W - 60, 37);

  // KPI tiles
  const kpis = [
    ['Events / sec', st.eps.toLocaleString(), '#22d3ee'],
    ['Open alerts', String(st.alerts), '#ff6b81'],
    ['IPs blocked', String(st.blocked), '#58a6ff'],
    ['MTTR', '4m 12s', '#3fb950'],
  ];
  kpis.forEach(([k, v, col], i) => {
    const x = 22 + i * 248;
    ctx.fillStyle = '#121a2e';
    roundRect(ctx, x, 58, 232, 84, 10);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.fillRect(x, 58, 4, 84);
    ctx.font = `500 14px ${SANS}`;
    ctx.fillStyle = '#93a2bf';
    ctx.fillText(k, x + 18, 86);
    ctx.font = `700 32px ${SANS}`;
    ctx.fillStyle = '#e6edf7';
    ctx.fillText(v, x + 18, 126);
  });

  // events/sec area chart
  const cx = 22, cy = 160, cw = 600, ch = 190;
  ctx.fillStyle = '#121a2e';
  roundRect(ctx, cx, cy, cw, ch, 10);
  ctx.fill();
  ctx.font = `600 14px ${SANS}`;
  ctx.fillStyle = '#93a2bf';
  ctx.fillText('Event volume', cx + 14, cy + 24);
  const hist = st.history;
  const maxV = 3200;
  ctx.beginPath();
  hist.forEach((v, i) => {
    const x = cx + 14 + (i / (hist.length - 1)) * (cw - 28);
    const y = cy + ch - 14 - (v / maxV) * (ch - 50);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.lineTo(cx + cw - 14, cy + ch - 14);
  ctx.lineTo(cx + 14, cy + ch - 14);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, cy, 0, cy + ch);
  grad.addColorStop(0, 'rgba(34,211,238,0.35)');
  grad.addColorStop(1, 'rgba(34,211,238,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // MITRE technique bars
  const bx = 22, by = 362, bw = 600, bh = 196;
  ctx.fillStyle = '#121a2e';
  roundRect(ctx, bx, by, bw, bh, 10);
  ctx.fill();
  ctx.font = `600 14px ${SANS}`;
  ctx.fillStyle = '#93a2bf';
  ctx.fillText('Top MITRE ATT&CK techniques', bx + 14, by + 24);
  const top = Object.entries(st.mitre).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mMax = Math.max(1, ...top.map(([, v]) => v));
  top.forEach(([id, v], i) => {
    const y = by + 44 + i * 29;
    const name = MITRE.find((m) => m[0] === id)?.[1] ?? '';
    ctx.font = `600 13px ${MONO}`;
    ctx.fillStyle = '#c9d1d9';
    ctx.fillText(`${id} ${name}`, bx + 14, y + 14);
    ctx.fillStyle = '#1d2740';
    ctx.fillRect(bx + 290, y + 2, 270, 16);
    ctx.fillStyle = i === 0 ? '#ff6b81' : '#a78bfa';
    ctx.fillRect(bx + 290, y + 2, (270 * v) / mMax, 16);
  });

  // alert queue
  const ax = 640, ay = 160, aw = W - ax - 22, ah = 398;
  ctx.fillStyle = '#121a2e';
  roundRect(ctx, ax, ay, aw, ah, 10);
  ctx.fill();
  ctx.font = `600 14px ${SANS}`;
  ctx.fillStyle = '#93a2bf';
  ctx.fillText('Alert queue', ax + 14, ay + 24);
  const SEV = { CRIT: '#ff6b81', HIGH: '#fb923c', MED: '#e3b341' };
  st.queue.slice(0, 9).forEach((a, i) => {
    const y = ay + 40 + i * 39;
    ctx.fillStyle = i === 0 ? 'rgba(255,107,129,0.10)' : 'rgba(255,255,255,0.02)';
    ctx.fillRect(ax + 8, y, aw - 16, 34);
    ctx.fillStyle = SEV[a.sev];
    roundRect(ctx, ax + 14, y + 8, 48, 18, 4);
    ctx.fill();
    ctx.font = `700 11px ${MONO}`;
    ctx.fillStyle = '#0a1020';
    ctx.fillText(a.sev, ax + 20, y + 21);
    ctx.font = `500 13px ${SANS}`;
    ctx.fillStyle = '#e6edf7';
    ctx.fillText(a.title, ax + 72, y + 22);
  });
}

/* ── scene ── */
export function createSocDesk(canvas, { host = 'soc-sensor-01', domain = 'CORP', onLinux, onWindows } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);

  const hemi = new THREE.HemisphereLight('#ffffff', '#c7d2fe', 2.0);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 5, bottom: -3 });
  scene.add(key);

  // desk
  const deskMat = new THREE.MeshStandardMaterial({ color: '#eef2fb', roughness: 0.55, metalness: 0.05 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(11, 0.2, 3.4), deskMat);
  desk.position.set(0, -0.1, 0.6);
  desk.receiveShadow = true;
  scene.add(desk);
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.035, 0.03),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#22d3ee').multiplyScalar(1.3), toneMapped: false }),
  );
  strip.position.set(0, -0.19, 2.31);
  scene.add(strip);

  // light / dark room
  const THEMES = {
    light: { desk: '#eef2fb', sky: '#ffffff', ground: '#c7d2fe', hemi: 2.0, key: 1.6 },
    dark: { desk: '#1a2547', sky: '#8ea2ff', ground: '#0a1230', hemi: 0.9, key: 0.9 },
    root: { desk: '#141414', sky: '#ff8a96', ground: '#050505', hemi: 0.7, key: 0.6, strip: '#ff1f3d' },
  };
  const applyRoom = (t) => {
    const p = THEMES[t] || THEMES.light;
    strip.material.color.set(p.strip || '#22d3ee').multiplyScalar(1.3);
    deskMat.color.set(p.desk);
    hemi.color.set(p.sky);
    hemi.groundColor.set(p.ground);
    hemi.intensity = p.hemi;
    key.intensity = p.key;
  };
  applyRoom(document.documentElement.dataset.theme);
  addEventListener('themechange', (e) => applyRoom(e.detail));

  // monitors
  const screens = { linux: makeScreen(), siem: makeScreen(), win: makeScreen() };
  const bezelMat = new THREE.MeshStandardMaterial({ color: '#1f2537', roughness: 0.4, metalness: 0.5 });
  const SW = 3.3;
  const SH = (SW * H) / W;
  const monitors = [];
  [
    ['linux', -3.45, 0.8, 0.42],
    ['siem', 0, 0, 0],
    ['win', 3.45, 0.8, -0.42],
  ].forEach(([k, x, z, ry]) => {
    const g = new THREE.Group();
    g.position.set(x, 1.45, z);
    g.rotation.y = ry;
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.14, SH + 0.14, 0.1), bezelMat);
    bezel.castShadow = true;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: screens[k].tex, toneMapped: false }));
    scr.position.z = 0.052;
    scr.userData.key = k;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.1), bezelMat);
    neck.position.set(0, -SH / 2 - 0.3, -0.12);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.6), bezelMat);
    base.position.set(0, -1.45, 0.05);
    base.castShadow = true;
    g.add(bezel, scr, neck, base);
    scene.add(g);
    monitors.push({ key: k, group: g, screen: scr });
  });

  // keyboard, mouse, mug
  const kbTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#1b2133';
    x.fillRect(0, 0, 512, 160);
    for (let r = 0; r < 5; r++)
      for (let k = 0; k < 15; k++) {
        x.fillStyle = (r + k) % 7 === 0 ? '#22d3ee' : '#2b3350';
        x.fillRect(10 + k * 33, 10 + r * 29, 28, 24);
      }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const kb = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.75), [bezelMat, bezelMat, new THREE.MeshStandardMaterial({ map: kbTex, roughness: 0.6 }), bezelMat, bezelMat, bezelMat]);
  kb.position.set(0, 0.04, 1.65);
  kb.castShadow = true;
  const mouse = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.14, 4, 10), bezelMat);
  mouse.rotation.x = Math.PI / 2;
  mouse.scale.set(1, 1, 0.5);
  mouse.position.set(1.65, 0.06, 1.7);
  const mug = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.42, 20), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.08, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#22d3ee', roughness: 0.4 }));
  band.position.y = 0.04;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 8, 16), cup.material);
  handle.position.set(0.22, 0, 0);
  mug.add(cup, band, handle);
  mug.position.set(-1.9, 0.21, 1.55);
  [mouse, cup].forEach((m) => (m.castShadow = true));
  scene.add(kb, mouse, mug);

  /* ── live data ── */
  const linux = [];
  const win = [];
  const st = { eps: 1400, history: Array.from({ length: 90 }, () => 1200 + Math.random() * 500), alerts: 7, blocked: 132, queue: [], mitre: Object.fromEntries(MITRE.map(([id]) => [id, 1 + Math.floor(Math.random() * 6)])) };
  const ALERT_TITLES = {
    T1110: 'SSH brute force from external host',
    'T1059.001': 'Encoded PowerShell from Office macro',
    T1046: 'Port scan detected by Suricata',
    T1105: 'Suspicious download via curl/certutil',
    T1136: 'New local admin account created',
    'T1543.003': 'Unsigned service installed',
    'T1070.001': 'Security event log cleared',
  };
  const raise = (tech, sev) => {
    st.mitre[tech] = (st.mitre[tech] || 0) + 1;
    st.alerts++;
    st.queue.unshift({ sev, title: ALERT_TITLES[tech] });
    st.queue.length = Math.min(st.queue.length, 12);
  };
  for (let i = 0; i < 22; i++) linux.push(linuxLine(host));
  for (let i = 0; i < 14; i++) win.unshift(windowsLine(domain));
  ['T1110', 'T1046', 'T1059.001', 'T1105', 'T1136'].forEach((tech, i) => raise(tech, ['HIGH', 'MED', 'CRIT', 'HIGH', 'CRIT'][i]));
  // give the 2D consoles the same starting history (oldest first)
  linux.forEach((l) => onLinux?.(l));
  [...win].reverse().forEach((w) => onWindows?.(w));

  let linuxT = 0;
  let winT = 0;
  let chartT = 0;
  let paintT = 0;
  function tick(dt) {
    linuxT -= dt;
    winT -= dt;
    chartT -= dt;
    if (linuxT <= 0) {
      const l = linuxLine(host);
      linux.push(l);
      if (linux.length > 60) linux.shift();
      if (l.text.includes('Ban ') || l.text.includes('UFW BLOCK')) st.blocked++;
      if (l.lvl === 'alert') raise(l.text.includes('audit') ? 'T1105' : 'T1110', l.text.includes('audit') ? 'HIGH' : 'MED');
      if (l.text.includes('ET SCAN')) st.mitre.T1046++;
      onLinux?.(l);
      linuxT = 0.35 + Math.random() * 0.6;
    }
    if (winT <= 0) {
      const w = windowsLine(domain);
      win.unshift(w);
      if (win.length > 30) win.pop();
      const techById = { 4104: 'T1059.001', 4720: 'T1136', 7045: 'T1543.003', 1102: 'T1070.001', 4625: 'T1110' };
      if (w.lvl === 'alert' && techById[w.id]) raise(techById[w.id], w.id === 1102 || w.id === 4104 ? 'CRIT' : 'HIGH');
      onWindows?.(w);
      winT = 0.5 + Math.random() * 0.7;
    }
    if (chartT <= 0) {
      st.eps = Math.max(600, Math.min(3000, Math.round(st.eps + (Math.random() - 0.5) * 260 + (Math.random() < 0.05 ? 900 : 0))));
      st.history.push(st.eps);
      st.history.shift();
      if (Math.random() < 0.15 && st.alerts > 3) st.alerts--; // analyst closing tickets
      chartT = 0.25;
    }
  }

  /* ── camera: framing, parallax, click-to-zoom ── */
  const home = { pos: new THREE.Vector3(0, 2.7, 10.5), look: new THREE.Vector3(0, 0.95, 0.4) };
  const camPos = home.pos.clone();
  const camLook = home.look.clone();
  const target = { pos: home.pos.clone(), look: home.look.clone() };
  let focused = null;
  const mouseN = new THREE.Vector2();

  function frameHome() {
    // pull back on narrow screens so all three monitors fit
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = Math.max(9.6, 6.2 / Math.tan(hfov / 2));
    home.pos.set(0, 2.0 + dist * 0.05, dist);
  }
  function focus(m) {
    focused = m;
    if (!m) {
      target.pos.copy(home.pos);
      target.look.copy(home.look);
      return;
    }
    const center = new THREE.Vector3();
    m.screen.getWorldPosition(center);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(m.group.quaternion);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const fitH = (SH * 1.12) / 2 / Math.tan(vfov / 2);
    const fitW = (SW * 1.08) / 2 / (Math.tan(vfov / 2) * camera.aspect);
    target.pos.copy(center).addScaledVector(normal, Math.max(fitH, fitW));
    target.look.copy(center);
  }

  const ray = new THREE.Raycaster();
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(monitors.map((m) => m.screen))[0];
    const m = hit && monitors.find((mm) => mm.screen === hit.object);
    focus(focused || !m ? null : m);
    canvas.dispatchEvent(new CustomEvent('focuschange', { detail: focused?.key ?? null }));
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseN.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    const ray2 = new THREE.Raycaster();
    ray2.setFromCamera(new THREE.Vector2(mouseN.x, -mouseN.y), camera);
    canvas.style.cursor = focused || ray2.intersectObjects(monitors.map((m) => m.screen)).length ? 'zoom-in' : 'default';
    if (focused) canvas.style.cursor = 'zoom-out';
  });
  canvas.addEventListener('pointerleave', () => mouseN.set(0, 0));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && focused) {
      focus(null);
      canvas.dispatchEvent(new CustomEvent('focuschange', { detail: null }));
    }
  });

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frameHome();
    focus(focused);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  camPos.copy(home.pos);

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  let time = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    time += dt;
    tick(dt);

    // repaint screens ~12 fps
    paintT -= dt;
    if (paintT <= 0) {
      paintT = 1 / 12;
      drawLinux(screens.linux, linux, host, time);
      drawSiem(screens.siem, st, time);
      drawWindows(screens.win, win, domain);
      for (const s of Object.values(screens)) s.tex.needsUpdate = true;
    }

    // gentle parallax when not zoomed in
    if (!focused) {
      target.pos.copy(home.pos);
      if (!reduced) target.pos.x += mouseN.x * 0.9;
      if (!reduced) target.pos.y += -mouseN.y * 0.4;
      target.look.copy(home.look);
    }
    const k = 1 - Math.exp(-dt * 4);
    camPos.lerp(target.pos, k);
    camLook.lerp(target.look, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
  }
  frame();
}
