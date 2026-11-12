import * as THREE from 'three';
import { R } from './utils.js';

// Radar-style minimap: rover in the centre facing up, sections plotted around it.
const LABELS = {
  welcome: 'START',
  about: 'ABOUT',
  skills: 'SKILLS',
  experience: 'EXP',
  certs: 'CERTS',
  contact: 'CONTACT',
  thm: 'THM',
  ctf: '?',
};

export function createMinimap(canvas, zones, { onPick, visited }) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 2);
  let size = 0;
  const RANGE = 48; // world units shown from centre to edge
  const blips = [];

  function resize() {
    size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }
  resize();
  addEventListener('resize', resize);

  const right = new THREE.Vector3();
  const tan = new THREE.Vector3();

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let best = null;
    let bd = 16;
    for (const b of blips) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best) onPick(best.id);
  });

  return {
    draw(pos, fwd, t, current) {
      if (!size) resize();
      const s = size;
      const c = s / 2;
      const rad = c - 10;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, s, s);

      // background + rings
      ctx.fillStyle = 'rgba(10, 18, 48, 0.78)';
      ctx.beginPath();
      ctx.arc(c, c, c - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      ctx.lineWidth = 1;
      for (const f of [0.33, 0.66, 1]) {
        ctx.beginPath();
        ctx.arc(c, c, rad * f, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(c, c - rad);
      ctx.lineTo(c, c + rad);
      ctx.moveTo(c - rad, c);
      ctx.lineTo(c + rad, c);
      ctx.stroke();

      // radar sweep
      const a = t * 1.6;
      const grad = ctx.createConicGradient ? ctx.createConicGradient(a, c, c) : null;
      if (grad) {
        grad.addColorStop(0, 'rgba(0, 240, 255, 0.28)');
        grad.addColorStop(0.12, 'rgba(0, 240, 255, 0)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c, c, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // blips
      right.crossVectors(fwd, pos).normalize(); // rover's right-hand side
      blips.length = 0;
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      for (const z of zones) {
        const ang = Math.acos(THREE.MathUtils.clamp(pos.dot(z.dir), -1, 1));
        const dist = ang * R;
        tan.copy(z.dir).addScaledVector(pos, -z.dir.dot(pos));
        if (tan.lengthSq() < 1e-8) tan.copy(fwd);
        tan.normalize();
        const x = tan.dot(right);
        const y = tan.dot(fwd);
        const off = dist > RANGE;
        const k = Math.min(dist / RANGE, 1) * rad;
        const px = c + x * k;
        const py = c - y * k;
        const isProject = z.id.startsWith('project-');
        const label = isProject ? `P${Number(z.id.split('-')[1]) + 1}` : LABELS[z.id] ?? z.id;
        const isCur = current === z.id;
        const seen = visited.has(z.id);

        ctx.globalAlpha = off ? 0.55 : 1;
        ctx.fillStyle = z.color;
        ctx.shadowColor = z.color;
        ctx.shadowBlur = isCur ? 12 : 6;
        ctx.beginPath();
        if (off) {
          // arrowhead on the rim pointing towards the section
          const ax = Math.atan2(py - c, px - c);
          ctx.moveTo(px + Math.cos(ax) * 5, py + Math.sin(ax) * 5);
          ctx.lineTo(px + Math.cos(ax + 2.4) * 5, py + Math.sin(ax + 2.4) * 5);
          ctx.lineTo(px + Math.cos(ax - 2.4) * 5, py + Math.sin(ax - 2.4) * 5);
        } else {
          ctx.arc(px, py, isCur ? 5 : 3.5, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        if (!off || !isProject) {
          ctx.fillStyle = seen ? 'rgba(220,235,255,0.75)' : '#ffffff';
          ctx.fillText(label, px, py - 7);
        }
        ctx.globalAlpha = 1;
        blips.push({ id: z.id, x: px, y: py });
      }

      // rover
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(c, c - 7);
      ctx.lineTo(c + 5, c + 5);
      ctx.lineTo(c, c + 2);
      ctx.lineTo(c - 5, c + 5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    },
  };
}
