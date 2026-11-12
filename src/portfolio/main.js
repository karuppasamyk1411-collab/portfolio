import './style.css';
import { profile, about, highlights, skills, experience, education, certifications, projects, ctf, contactMessage, tryhackme, soc, text } from '../data.js';

// headings & blurbs tagged with data-text="KEY" come from VITE_TEXT_<KEY> in .env
document.querySelectorAll('[data-text]').forEach((el) => {
  const v = text(el.dataset.text);
  if (v) el.textContent = v;
});
import { createParticleHero } from './particles.js';
import { createCrt } from './crt.js';
import { createSocDesk } from './socDesk.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ext = (url) => (/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '');
const linkBy = (label) => profile.links.find((l) => l.label === label);

/* ── nav ── */
const SECTIONS = [
  ['monitor', 'Live SOC'],
  ['about', 'About'],
  ['experience', 'Experience'],
  ['projects', 'Projects'],
  ['skills', 'Skills'],
  ['certifications', 'Certifications'],
  ['contact', 'Contact'],
];
$('#logo-name').textContent = profile.name.split(' ')[0];
$('.logo-mark').textContent = profile.name
  .split(/\s+/)
  .map((w) => w[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

/* ── themes: light / dark / root (hacker) ── */
const THEMES = { light: '#f5f8ff', dark: '#070d24', root: '#050505' };
const root = document.documentElement;
const themeBtn = $('#theme-toggle');
const themeMenu = $('#theme-menu');
const themeMeta = document.querySelector('meta[name="theme-color"]');
function applyTheme(t, save) {
  if (!THEMES[t]) t = 'light';
  root.dataset.theme = t;
  themeBtn.setAttribute('aria-label', `Change theme (current: ${t})`);
  themeMeta.content = THEMES[t];
  themeMenu.querySelectorAll('[data-theme-choice]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeChoice === t)));
  if (save) {
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* storage blocked: theme still applies for this visit */
    }
  }
  dispatchEvent(new CustomEvent('themechange', { detail: t }));
}
applyTheme(root.dataset.theme, false);
const setMenu = (open) => {
  themeMenu.classList.toggle('open', open);
  themeBtn.setAttribute('aria-expanded', String(open));
};
themeBtn.onclick = (e) => {
  e.stopPropagation();
  setMenu(!themeMenu.classList.contains('open'));
};
themeMenu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-choice]');
  if (!b) return;
  applyTheme(b.dataset.themeChoice, true);
  setMenu(false);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#theme-picker')) setMenu(false);
});
addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));
$('#nav-links').innerHTML = SECTIONS.map(([id, label]) => `<a href="#${id}" data-id="${id}">${label}</a>`).join('');

const nav = $('#site-nav');
const toggle = $('#menu-toggle');
toggle.onclick = () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
};
$('#nav-links').addEventListener('click', () => {
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
});
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 10), { passive: true });

// highlight the section in view
const navObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      document.querySelectorAll('#nav-links a').forEach((a) => a.classList.toggle('active', a.dataset.id === e.target.id));
    }
  },
  { rootMargin: '-45% 0px -50% 0px' },
);
SECTIONS.forEach(([id]) => navObserver.observe(document.getElementById(id)));

/* ── hero ── */
$('#hero-status').textContent = profile.openTo;
const resume = linkBy('Résumé');
if (resume) $('#cv-btn').href = resume.url;
$('#hero-name').textContent = profile.name;
$('#hero-name').dataset.text = profile.name; // used by the Root theme's glitch layers
$('#hero-name').dataset.prompt = `root@${$('.logo-mark').textContent.toLowerCase()}:~# whoami`;
$('#hero-role').textContent = profile.role;
$('#hero-tagline').textContent = profile.tagline;
$('#hero-links').innerHTML = ['GitHub', 'LinkedIn', 'TryHackMe']
  .map(linkBy)
  .filter(Boolean)
  .map((l) => `<li><a href="${l.url}"${ext(l.url)}>${l.label} <span aria-hidden="true">↗</span></a></li>`)
  .join('');

/* ── hero: 3D CRT computer typing a terminal session built from .env ── */
const initials = profile.name
  .split(/\s+/)
  .map((w) => w[0])
  .join('')
  .slice(0, 3)
  .toUpperCase();
const emailLink = linkBy('Email');
const crtScript = [
  { cmd: 'whoami' },
  { out: profile.name.toLowerCase(), kind: 'bright' },
  { out: profile.role.toLowerCase(), kind: 'dim', pause: 0.6 },
  { cmd: 'cat focus.txt' },
  { out: (text('FOCUS') || profile.tagline).toLowerCase(), pause: 0.7 },
  { cmd: 'nmap -sV --top-ports 3 203.0.113.7' },
  { out: '22/tcp   open      ssh     OpenSSH 8.9', kind: 'dim' },
  { out: '80/tcp   open      http    nginx 1.24', kind: 'dim' },
  { out: '445/tcp  filtered  microsoft-ds', kind: 'dim', pause: 0.7 },
  { cmd: 'tail -f /var/log/auth.log | grep -i fail' },
  { out: 'sshd[2231]: Failed password for root from 185.220.101.47', kind: 'dim', pause: 0.3 },
  { out: 'sshd[2231]: Failed password for root from 185.220.101.47', kind: 'dim', pause: 0.3 },
  { out: '[ALERT] T1110 brute force: 41 attempts / 60s', kind: 'alert', pause: 0.5 },
  { out: '[BLOCK] 185.220.101.47 -> deny list. contained.', kind: 'ok', pause: 0.8 },
  { cmd: './hire_me.sh' },
  { out: `[+] ${profile.openTo.toLowerCase()}`, kind: 'ok' },
  { out: `[+] ${profile.location.toLowerCase()}`, kind: 'ok' },
  ...(emailLink ? [{ out: `[+] ${emailLink.text}`, kind: 'ok' }] : []),
  { out: '', pause: 5 },
];
createCrt($('#crt'), { prompt: `root@${initials.toLowerCase()}:~# `, script: crtScript });

/* ── contact: the particle swarm as the closing visual ── */
let blocked = 0;
createParticleHero($('#swarm'), {
  initials,
  onBlocked() {
    blocked++;
    $('#blocked-count').textContent = blocked.toLocaleString();
  },
  onShape(label) {
    const el = $('#last-target');
    el.classList.remove('swap');
    void el.offsetWidth; // restart the little swap animation
    el.textContent = label;
    el.classList.add('swap');
  },
});

/* ── live SOC monitor: 3D desk + 2D consoles fed by the same stream ── */
$('#linux-title').textContent = `root@${soc.host}: ~ — tail -F /var/log/auth.log /var/log/syslog`;
const linuxLog = $('#linux-log');
const winLog = $('#win-log');
const MAX_ROWS = 9;
const pushRow = (box, html, newestFirst) => {
  const row = document.createElement('div');
  row.innerHTML = html;
  row.className = 'row';
  newestFirst ? box.prepend(row) : box.append(row);
  while (box.children.length > MAX_ROWS) (newestFirst ? box.lastElementChild : box.firstElementChild).remove();
};
const WIN_LEVEL = { ok: 'Audit Success', warn: 'Audit Failure', alert: 'Critical', info: 'Information' };
const socCanvas = $('#soc-desk');
createSocDesk(socCanvas, {
  host: soc.host,
  domain: soc.domain,
  onLinux: (l) => pushRow(linuxLog, `<span class="${l.lvl}">${esc(l.text)}</span>`, false),
  onWindows: (w) =>
    pushRow(
      winLog,
      `<span class="lvl ${w.lvl}">${WIN_LEVEL[w.lvl]}</span><span class="t">${w.time}</span><b>${w.id}</b><span class="src">${esc(w.ch)}</span><span class="msg">${esc(w.msg)}</span>`,
      true,
    ),
});
socCanvas.addEventListener('focuschange', (e) => {
  $('#soc-hint').textContent = e.detail ? 'Click anywhere (or press Esc) to zoom out' : 'Click a screen to zoom in';
});

/* ── stats ── */
$('#stats').innerHTML = highlights.map((h) => `<div class="stat"><b>${esc(h.value)}</b><span>${esc(h.label)}</span></div>`).join('');

/* ── about ── */
$('#about-photo').innerHTML = profile.photo
  ? `<div class="photo-card" data-tilt>
      <div class="photo-inner">
        <img src="${profile.photo}" alt="Portrait of ${esc(profile.name)}" />
        <span class="glare"></span>
        <span class="photo-tag"><b>${esc(profile.name.split(' ')[0])}</b> · Blue team</span>
      </div>
    </div>`
  : '';
$('#about-text').innerHTML = about;
const msc = education[0];
$('#facts').innerHTML = [
  ['Location', profile.location],
  ['Right to work', profile.status.replace(': ', ' · ')],
  ['Education', msc ? `${msc.role.split(',')[0]}, ${msc.company}` : ''],
  ['Focus', text('FOCUS')],
]
  .filter(([, v]) => v)
  .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
  .join('');

/* ── experience timeline ── */
const item = (e, type) => `<li class="reveal">
  <div class="tl-meta"><span class="tl-type ${type}">${type === 'work' ? 'Work' : 'Education'}</span><span class="tl-period">${esc(e.period)}</span></div>
  <div class="tl-body">
    <h3>${esc(e.role)}</h3>
    <p class="tl-org">${esc(e.company)}${e.location ? ` · ${esc(e.location)}` : ''}</p>
    ${e.points?.length ? `<ul>${e.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
  </div>
</li>`;
$('#timeline').innerHTML = [...experience.map((e) => item(e, 'work')), ...education.map((e) => item(e, 'edu'))].join('');

/* ── projects ── */
$('#project-grid').innerHTML = projects
  .map(
    (p, i) => `<article class="project reveal" data-tilt style="--c:${p.color}">
      <div class="project-inner">
        <div class="project-top">
          <span class="project-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="project-kicker">${esc(p.tagline)}</span>
        </div>
        <h3>${esc(p.title)}</h3>
        ${p.metric ? `<p class="metric">${esc(p.metric)}</p>` : ''}
        <p class="project-desc">${esc(p.description)}</p>
        <div class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        ${
          p.links?.length
            ? `<div class="project-links">${p.links.map((l) => `<a href="${l.url}"${ext(l.url)}>${esc(l.label)} ↗</a>`).join('')}</div>`
            : ''
        }
      </div>
    </article>`,
  )
  .join('');

/* ── skills ── */
$('#skill-grid').innerHTML = skills
  .map(
    (s) => `<div class="skill reveal" style="--c:${s.color}">
      <h3><span class="sdot"></span>${esc(s.category)}</h3>
      <div class="chips">${s.items.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
    </div>`,
  )
  .join('');

/* ── certifications + CTF ── */
$('#cert-grid').innerHTML =
  certifications
    .map(
      (c) => `<div class="cert reveal">
        <span class="cert-group">${esc(c.group)}</span>
        <p>${esc(c.name)}</p>
        ${c.note ? `<small>${esc(c.note)}</small>` : ''}
      </div>`,
    )
    .join('') +
  (ctf.title
    ? `<div class="cert ctf reveal">
        <span class="cert-group">Competition</span>
        <p>${esc(ctf.title)}</p>
        ${ctf.text ? `<small>${esc(ctf.text)}</small>` : ''}
      </div>`
    : '');

/* ── TryHackMe ── */
if (tryhackme) {
  $('#thm-actions').innerHTML = `<a class="btn primary" href="${tryhackme.url}" target="_blank" rel="noopener">View my TryHackMe profile ↗</a>
    <a class="btn ghost" href="world.html?play#thm">Visit the diner in 3D</a>`;
  $('#thm-menu').innerHTML = tryhackme.menu
    .map((m) => `<li class="${m.done ? 'done' : 'wip'}"><span>${esc(m.item)}</span><b>${m.done ? '✔' : '◔'} ${esc(m.status)}</b></li>`)
    .join('');
  $('#thm-stats').innerHTML = (tryhackme.stats || []).map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('');
} else {
  $('#tryhackme').remove();
}

/* ── contact ── */
$('#contact-text').innerHTML = contactMessage;
const email = linkBy('Email');
const li = linkBy('LinkedIn');
$('#contact-actions').innerHTML = [
  email && `<a class="btn primary" href="${email.url}">Email me</a>`,
  li && `<a class="btn ghost" href="${li.url}" target="_blank" rel="noopener">Connect on LinkedIn ↗</a>`,
]
  .filter(Boolean)
  .join('');
$('#contact-links').innerHTML = profile.links
  .map((l) => `<li><a href="${l.url}"${ext(l.url)}><span>${esc(l.label)}</span><span>${esc(l.text ?? l.url)}</span></a></li>`)
  .join('');
$('#footer-text').textContent = `© ${new Date().getFullYear()} ${profile.name} · Built with Three.js`;

/* ── 3D tilt on cards ── */
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (canHover && !reduced) {
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    const inner = card.firstElementChild;
    const max = card.classList.contains('photo-card') ? 14 : 7;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      inner.style.transform = `rotateY(${x * max}deg) rotateX(${-y * max}deg) translateZ(0)`;
      inner.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
      inner.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
      card.classList.add('tilting');
    });
    card.addEventListener('pointerleave', () => {
      inner.style.transform = '';
      card.classList.remove('tilting');
    });
  });
}

/* ── reveal on scroll ── */
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    }
  },
  { rootMargin: '0px 0px -8% 0px' },
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/* ── deep links (e.g. /#contact): the browser jumps before the sections above are filled in,
      so jump again once the content exists ── */
if (location.hash.length > 1) {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}
