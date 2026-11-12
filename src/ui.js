import { profile, about, highlights, skills, experience, education, certifications, projects, ctf, contactMessage, tryhackme } from './data.js';

const $ = (s) => document.querySelector(s);

const linkList = (links) =>
  `<ul class="links">${links
    .map(
      (l) =>
        `<li><a href="${l.url}" target="_blank" rel="noopener"><span class="lk">${l.label}</span><span class="lv">${l.text ?? l.url} ↗</span></a></li>`,
    )
    .join('')}</ul>`;

const timeline = (items) =>
  `<ol class="timeline">${items
    .map(
      (e) => `<li>
        <div class="tl-period">${e.period}</div>
        <div class="tl-role">${e.role}</div>
        <div class="tl-org">${e.company}${e.location ? ` · ${e.location}` : ''}</div>
        ${e.points?.length ? `<ul>${e.points.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
      </li>`,
    )
    .join('')}</ol>`;

const chips = (items, color) =>
  `<div class="chips">${items.map((t) => `<span class="chip" style="--c:${color || 'var(--cyan)'}">${t}</span>`).join('')}</div>`;

export function sectionContent(id) {
  if (id.startsWith('project-')) {
    const p = projects[Number(id.split('-')[1])];
    return {
      kicker: `project_${id.split('-')[1].padStart(2, '0')} // ${p.tagline}`,
      title: p.title,
      html: `<p>${p.description}</p>${chips(p.tags, p.color)}${
        p.links?.length ? `<div class="btn-row">${p.links.map((l) => `<a class="btn primary" href="${l.url}" target="_blank" rel="noopener">${l.label} ↗</a>`).join('')}</div>` : ''
      }`,
    };
  }
  switch (id) {
    case 'welcome':
      return {
        kicker: 'session established',
        title: `Hi, I'm ${profile.name.split(' ')[0]}`,
        html: `<p>${profile.tagline}</p>
          <p class="muted">Drive to the glowing rings to open each section. Push the data cores around, and if you're
          curious, there's a flag hidden at the south pole.</p>
          ${profile.status ? `<p class="status">● ${profile.status}</p>` : ''}`,
      };
    case 'about':
      return {
        kicker: '$ cat ~/about.txt',
        title: 'About me',
        html: `${photoCard()}${about}<div class="stats">${highlights.map((h) => `<div><b>${h.value}</b><span>${h.label}</span></div>`).join('')}</div>
          <p class="muted">📍 ${profile.location}</p>`,
      };
    case 'skills':
      return {
        kicker: '$ cat ~/skills.txt',
        title: 'Skillset',
        html: skills.map((s) => `<h4 style="color:${s.color}">${s.category}</h4>${chips(s.items, s.color)}`).join(''),
      };
    case 'experience':
      return {
        kicker: '$ cat ~/experience.txt',
        title: 'Experience & Education',
        html: `<h4>Work</h4>${timeline(experience)}<h4>Education</h4>${timeline(education)}`,
      };
    case 'certs':
      return {
        kicker: '$ cat ~/certifications.txt',
        title: 'Certifications',
        html: `<ul class="certs">${certifications
          .map((c) => `<li><span class="cg">${c.group}</span><span>${c.name}${c.note ? `<em>${c.note}</em>` : ''}</span></li>`)
          .join('')}</ul>`,
      };
    case 'contact':
      return { kicker: '$ cat ~/contact.txt', title: "Let's talk", html: `${contactMessage}${linkList(profile.links)}` };
    case 'thm':
      return {
        kicker: `$ curl tryhackme.com/p/${tryhackme.username}`,
        title: 'Hack & Byte Diner',
        html: `<p>Welcome in! This diner serves one thing: <strong>hands-on hacking from my TryHackMe profile</strong>.
          It's where I sharpen blue-team skills on realistic SOC, SIEM, incident response and malware analysis rooms.</p>
          <h4>Today's menu</h4>
          <ul class="certs">${tryhackme.menu
            .map((m) => `<li><span class="cg">${m.done ? '✔ done' : '◔ cooking'}</span><span>${m.item}<em>${m.status}</em></span></li>`)
            .join('')}</ul>
          ${tryhackme.stats?.length ? `<div class="stats">${tryhackme.stats.map((s) => `<div><b>${s.value}</b><span>${s.label}</span></div>`).join('')}</div>` : ''}
          <div class="btn-row"><a class="btn primary" href="${tryhackme.url}" target="_blank" rel="noopener">Visit my TryHackMe profile ↗</a></div>`,
      };
    case 'ctf':
      return { kicker: 'flag{you_found_it}', title: ctf.title, html: ctf.html };
    default:
      return { kicker: '', title: id, html: '' };
  }
}

const NAV = [
  ['about', 'About'],
  ['projects', 'Projects'],
  ['skills', 'Skills'],
  ['experience', 'Experience'],
  ['certs', 'Certs'],
  ['thm', 'TryHackMe'],
  ['contact', 'Contact'],
];

function photoCard() {
  if (!profile.photo) return '';
  return `<div class="holo-card" data-tilt>
    <div class="holo-inner">
      <img src="${profile.photo}" alt="Photo of ${profile.name}" />
      <span class="holo-glare"></span><span class="holo-scan"></span>
      <span class="holo-tag">ID // ${profile.shortName}<em>clearance: blue team</em></span>
    </div>
  </div>`;
}

// 3D tilt that follows the pointer
function bindTilt(root) {
  root.querySelectorAll('[data-tilt]').forEach((card) => {
    const inner = card.querySelector('.holo-inner');
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.classList.add('tilting');
      inner.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 22}deg) translateZ(10px)`;
      inner.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
      inner.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('tilting');
      inner.style.transform = '';
    });
  });
}

function buildClassic() {
  const sec = (id) => {
    const c = sectionContent(id);
    return `<section><p class="kicker">${c.kicker}</p><h2>${c.title}</h2>${c.html}</section>`;
  };
  return `
    <header class="classic-head">
      <p class="kicker">${profile.role}</p>
      <h1>${profile.name}</h1>
      <p>${profile.tagline}</p>
      ${profile.status ? `<p class="status">● ${profile.status}</p>` : ''}
    </header>
    ${photoCard()}
    ${sec('about')}
    <section><p class="kicker">~/projects</p><h2>Projects</h2>
      <div class="cards">${projects
        .map((p, i) => {
          const c = sectionContent(`project-${i}`);
          return `<article class="card" style="--c:${p.color}"><p class="kicker">${p.tagline}</p><h3>${p.title}</h3>${c.html}</article>`;
        })
        .join('')}</div>
    </section>
    ${sec('skills')}${sec('experience')}${sec('certs')}${sec('contact')}
  `;
}

export function initUI({ onStart, onTeleport, onReset, onDismiss }) {
  // text from data
  $('#intro-name').textContent = profile.name;
  $('#intro-name').dataset.text = profile.name;
  $('#intro-role').textContent = profile.role;
  $('#hud-name').textContent = profile.shortName;
  $('#hud-role').textContent = profile.role;
  document.title = `3D World | ${profile.name}`;

  // boot sequence: a defender's terminal
  // cmd = typed by the "user", others print instantly with a class for colour
  const PROMPT = 'blue@soc:~$ ';
  const script = [
    { cmd: 'whoami' },
    { out: `${profile.name.split(' ')[0].toLowerCase()} :: blue team // defender`, cls: 'dim' },
    { cmd: 'sudo systemctl start siem-agent suricata nftables' },
    { out: '[  OK  ] Started SIEM forwarder (Splunk / Sentinel).', cls: 'ok' },
    { out: '[  OK  ] Started Suricata IDS on eth0.', cls: 'ok' },
    { out: '[  OK  ] Started nftables host firewall.', cls: 'ok' },
    { cmd: 'tail -f /var/log/auth.log' },
    { out: 'sshd[2231]: Failed password for root from 185.220.101.47', cls: 'warn' },
    { out: 'sshd[2231]: Failed password for root from 185.220.101.47', cls: 'warn' },
    { out: '[ALERT] T1110 brute force: 41 attempts / 60s', cls: 'alert', wait: 380 },
    { out: '[BLOCK] 185.220.101.47 → deny list. threat contained.', cls: 'ok' },
    { cmd: './explore --world=planet --mode=defend', wait: 200 },
  ];
  const boot = $('#boot');
  let bootCancelled = false;
  const addLine = (cls) => {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    boot.appendChild(div);
    boot.scrollTop = boot.scrollHeight;
    return div;
  };
  (async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await sleep(300);
    for (const step of script) {
      if (bootCancelled) return;
      if (step.cmd) {
        const div = addLine('cmd');
        div.textContent = PROMPT;
        for (const ch of step.cmd) {
          if (bootCancelled) return;
          div.textContent += ch;
          await sleep(18 + Math.random() * 40);
        }
        await sleep(step.wait ?? 160);
      } else {
        addLine(step.cls).textContent = step.out;
        await sleep(step.wait ?? 110);
      }
    }
    addLine('cmd caret').textContent = PROMPT;
    $('#start-btn').classList.add('ready');
  })();

  // ?play skips the intro (handy for sharing a direct link); ?play#projects deep-links to a section
  setTimeout(() => {
    if (!new URLSearchParams(location.search).has('play')) return;
    start(true);
    const hash = location.hash.slice(1);
    if (NAV.some(([id]) => id === hash) || hash === 'ctf') onTeleport(hash === 'projects' ? 'project-0' : hash);
  }, 0);

  // nav
  const nav = $('#nav');
  const navBtns = {};
  const visited = new Set();
  const goTo = (id) => {
    onTeleport(id === 'projects' ? 'project-0' : id);
    document.body.classList.remove('menu-open');
  };
  NAV.forEach(([id, label], i) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="num">0${i + 1}</span>${label}`;
    b.title = `${label} (key ${i + 1})`;
    b.onclick = () => goTo(id);
    nav.appendChild(b);
    navBtns[id] = b;
  });
  const classicBtn = document.createElement('button');
  classicBtn.innerHTML = '<span class="num">←</span>Portfolio';
  classicBtn.title = 'Back to the portfolio';
  classicBtn.className = 'alt';
  nav.appendChild(classicBtn);
  $('#menu-btn').onclick = () => document.body.classList.toggle('menu-open');

  // tour order used by the panel's prev / next
  const ORDER = ['about', ...projects.map((_, i) => `project-${i}`), 'skills', 'experience', 'certs', 'thm', 'contact'];
  const shortName = (id) => (id.startsWith('project-') ? projects[Number(id.split('-')[1])].title : NAV.find(([n]) => n === id)?.[1] ?? id);
  const sectionKey = (id) => (id?.startsWith('project-') ? 'projects' : id);

  // classic view
  const classic = $('#classic');
  $('#classic-inner').innerHTML = buildClassic();
  bindTilt($('#classic-inner'));
  const openClassic = () => {
    classic.classList.add('open');
    document.body.classList.remove('menu-open');
  };
  classicBtn.onclick = () => (location.href = './');
  $('#intro-classic').onclick = () => (location.href = './');
  $('#classic-close').onclick = () => classic.classList.remove('open');

  // start
  let started = false;
  const start = (instant = false) => {
    if (started) return;
    started = true;
    bootCancelled = true;
    $('#intro').classList.add('hidden');
    if (instant) $('#intro').style.display = 'none';
    document.body.classList.add('playing');
    setTimeout(() => $('#hint').classList.add('fade'), 9000);
    onStart(instant);
  };
  $('#start-btn').onclick = () => start();

  // panel
  const panel = $('#panel');
  function show(id) {
    const c = sectionContent(id);
    $('#panel-kicker').textContent = c.kicker;
    $('#panel-title').textContent = c.title;
    $('#panel-body').innerHTML = c.html;
    bindTilt($('#panel-body'));
    // prev / next tour buttons
    const i = ORDER.indexOf(id);
    const foot = $('#panel-nav');
    foot.innerHTML = '';
    if (i !== -1) {
      const prev = ORDER[(i - 1 + ORDER.length) % ORDER.length];
      const next = ORDER[(i + 1) % ORDER.length];
      foot.innerHTML = `<button data-go="${prev}">← ${shortName(prev)}</button><span>${i + 1} / ${ORDER.length}</span><button data-go="${next}">${shortName(next)} →</button>`;
    } else if (id === 'welcome') {
      foot.innerHTML = `<span></span><button data-go="about" class="cta">Start the tour →</button>`;
    }
    foot.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => goTo(b.dataset.go)));

    panel.scrollTop = 0;
    panel.classList.add('open');
    visited.add(id);
    navBtns[sectionKey(id)]?.classList.add('visited');
  }
  function setCurrent(id) {
    const key = sectionKey(id);
    for (const [k, b] of Object.entries(navBtns)) b.classList.toggle('active', k === key);
  }

  // ── GPS guidance: next unvisited section ──
  const nextTarget = () => ORDER.find((id) => !visited.has(id)) ?? (visited.has('ctf') ? null : 'ctf');
  const guide = $('#guide');
  let guideKey = '';
  function setGuide(id, dist) {
    const key = id ? `${id}|${Math.round(dist)}` : '';
    if (key === guideKey) return;
    guideKey = key;
    if (!id) {
      guide.classList.remove('show');
      return;
    }
    const name = id === 'ctf' ? 'Secret flag' : shortName(id);
    guide.innerHTML = `<span class="g-k">NEXT ›</span><b>${name}</b><span class="g-d">${Math.round(dist)} m</span><kbd>N</kbd>`;
    guide.dataset.go = id;
    guide.classList.add('show');
  }
  guide.onclick = () => guide.dataset.go && goTo(guide.dataset.go);
  const hide = () => panel.classList.remove('open');
  $('#panel-close').onclick = () => {
    hide();
    onDismiss();
  };

  // keyboard
  const keys = new Set();
  let jumpQueued = false;
  addEventListener('keydown', (e) => {
    if (classic.classList.contains('open')) return;
    if (!started && (e.code === 'Enter' || e.code === 'Space') && !$('#start-btn').disabled) {
      e.preventDefault();
      return start();
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'Space' && !e.repeat) jumpQueued = true;
    if (e.code === 'KeyR' && !e.repeat) onReset();
    if (e.code === 'KeyN' && !e.repeat && started) {
      const n = nextTarget();
      if (n) goTo(n);
    }
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit && started && NAV[digit[1] - 1]) goTo(NAV[digit[1] - 1][0]);
    if (e.code === 'Escape') {
      hide();
      onDismiss();
    }
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // touch joystick
  const joy = { x: 0, y: 0, id: null };
  const base = $('#joy');
  const knob = $('#joy-knob');
  const moveJoy = (e) => {
    const r = base.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    joy.x = dx;
    joy.y = dy;
    knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
  };
  base.addEventListener('pointerdown', (e) => {
    joy.id = e.pointerId;
    base.setPointerCapture(e.pointerId);
    moveJoy(e);
  });
  base.addEventListener('pointermove', (e) => e.pointerId === joy.id && moveJoy(e));
  const endJoy = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.id = null;
    joy.x = joy.y = 0;
    knob.style.transform = '';
  };
  base.addEventListener('pointerup', endJoy);
  base.addEventListener('pointercancel', endJoy);

  let boostHeld = false;
  const boostBtn = $('#boost-btn');
  boostBtn.addEventListener('pointerdown', () => (boostHeld = true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => boostBtn.addEventListener(ev, () => (boostHeld = false)));
  $('#jump-btn').addEventListener('pointerdown', () => (jumpQueued = true));

  // ── live SIEM feed ──
  const feed = $('#siem-lines');
  const counter = $('#siem-count');
  let blocked = 0;
  function log(text, level = 'info') {
    const row = document.createElement('div');
    row.className = `ev ${level}`;
    const ts = new Date().toISOString().slice(11, 19);
    row.innerHTML = `<span class="ts">${ts}</span> ${text}`;
    feed.appendChild(row);
    while (feed.children.length > 7) feed.firstChild.remove();
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const ip = () => `${pick([45, 91, 103, 185, 193, 194, 212])}.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.${(Math.random() * 254 + 1) | 0}`;
  const NOISE = [
    () => [`sshd: Failed password for <b>root</b> from ${ip()}`, 'warn'],
    () => [`suricata: ET SCAN Nmap -sS from ${ip()}`, 'warn'],
    () => [`sysmon EID 3: outbound 443 chrome.exe → cdn ok`, 'info'],
    () => [`sentinel: sign-in risk=low user=k.k mfa=passed`, 'info'],
    () => [`splunk: correlation search ran · 0 notables`, 'info'],
    () => [`edr: quarantined <b>invoice_2026.pdf.exe</b> T1204`, 'ok'],
    () => [`sysmon EID 1: powershell -enc … parent=winword <b>T1059.001</b>`, 'alert'],
    () => [`nft: DROP tcp ${ip()} → 10.0.0.12:3389 T1021`, 'ok'],
    () => [`elk: dns tunnel heuristic · entropy 4.7 · triaged`, 'warn'],
  ];
  (function noise() {
    if (document.body.classList.contains('playing')) {
      const [t, l] = pick(NOISE)();
      log(t, l);
    }
    setTimeout(noise, 1400 + Math.random() * 2200);
  })();

  // ── intrusion alert banner ──
  const banner = $('#alert-banner');
  let alertBusy = false;
  function intrusion(onGlitch) {
    if (alertBusy || !document.body.classList.contains('playing')) return;
    alertBusy = true;
    const src = ip();
    banner.className = 'show red';
    banner.innerHTML = `⚠ INTRUSION ATTEMPT <span>${src} · T1190 exploit public-facing app</span>`;
    log(`<b>ALERT</b> exploit attempt from ${src} · T1190`, 'alert');
    onGlitch?.(1);
    setTimeout(() => {
      banner.className = 'show blue';
      banner.innerHTML = `✔ THREAT CONTAINED <span>host isolated · IOC pushed to blocklist</span>`;
      log(`IR: ${src} contained · playbook PB-07 complete`, 'ok');
      onGlitch?.(0.4);
    }, 1800);
    setTimeout(() => {
      banner.className = '';
      alertBusy = false;
    }, 4200);
  }

  const k = (...codes) => (codes.some((c) => keys.has(c)) ? 1 : 0);
  const clamp1 = (v) => Math.max(-1, Math.min(1, v));

  return {
    show,
    hide,
    setCurrent,
    setGuide,
    nextTarget,
    goTo,
    visited,
    log,
    intrusion,
    threatBlocked(info) {
      blocked++;
      counter.textContent = String(blocked).padStart(4, '0');
      log(`fw: <b>BLOCKED</b> ${info.proto} ${ip()}:${info.port} · ${info.mitre}`, 'ok');
    },
    getInput() {
      const input = {
        throttle: clamp1(k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown') - joy.y),
        steer: clamp1(k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft') + joy.x),
        boost: !!k('ShiftLeft', 'ShiftRight') || boostHeld,
        jump: jumpQueued,
      };
      jumpQueued = false;
      if (Math.abs(input.throttle) < 0.15) input.throttle = 0;
      return input;
    },
  };
}
