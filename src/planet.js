import * as THREE from 'three';
import {
  R,
  heightAt,
  placeOnSurface,
  rng,
  shadows,
  tangentTowards,
  walk,
  NEON,
  glowMat,
  neonEdges,
  DARK_METAL,
} from './utils.js';

const NEON_LIST = [NEON.cyan, NEON.magenta, NEON.green, NEON.violet, NEON.amber];

function randomDir(rand) {
  const u = rand() * 2 - 1;
  const t = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(t), u, s * Math.sin(t));
}

/* ───────────────────────── Planet ───────────────────────── */

export function createPlanet(scene, clearings) {
  const geo = new THREE.IcosahedronGeometry(1, 28);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    v.multiplyScalar(R + heightAt(v));
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  // flat-shaded face colours: dark terrain, teal "pads" around landmarks
  const colors = new Float32Array(pos.count * 3);
  const rand = rng(42);
  const ground = ['#2a3b80', '#25347a', '#30438e', '#2d3083'].map((c) => new THREE.Color(c));
  const pad = ['#1a6a8a', '#1f7896'].map((c) => new THREE.Color(c));
  const c = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), ctr = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    d.fromBufferAttribute(pos, i + 2);
    ctr.copy(a).add(b).add(d).normalize();
    c.copy(ground[Math.floor(rand() * ground.length)]);
    c.offsetHSL(0, 0, heightAt(ctr) * 0.08);
    for (const cl of clearings) {
      if (ctr.distanceTo(cl.dir) * R < cl.radius + (rand() - 0.5) * 0.8) {
        c.copy(pad[Math.floor(rand() * pad.length)]);
        break;
      }
    }
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const uniforms = { uTime: { value: 0 }, uLine: { value: new THREE.Color(0.0, 0.7, 0.95) }, uWave: { value: new THREE.Color(1.0, 0.08, 0.2) } };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.15 });

  // Neon grid + expanding scan wave, drawn in the shader
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uLine = uniforms.uLine;
    shader.uniforms.uWave = uniforms.uWave;
    shader.vertexShader =
      'varying vec3 vDir;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vDir = normalize(position);');
    shader.fragmentShader =
      'uniform float uTime;\nuniform vec3 uLine;\nuniform vec3 uWave;\nvarying vec3 vDir;\n' +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 gp = vDir * ${(R / 2.5).toFixed(3)};
        vec3 gw = fwidth(gp);
        vec3 gf = 0.5 - abs(fract(gp) - 0.5);
        vec3 gl = 1.0 - smoothstep(gw * 0.2, gw * 1.0, gf);
        float line = max(max(gl.x, gl.y), gl.z);
        float ang = acos(clamp(vDir.y, -1.0, 1.0));
        float wave = exp(-pow((fract(ang * 1.1 - uTime * 0.07) - 0.5) * 16.0, 2.0));
        totalEmissiveRadiance += line * (uLine * 0.28 + uWave * wave * 2.0);
        `,
      );
  };

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  scene.add(mesh);

  return {
    mesh,
    update: (t) => (uniforms.uTime.value = t),
    /** recolour the neon grid (line) and the travelling scan wave */
    setColors(line, wave) {
      uniforms.uLine.value.set(line);
      uniforms.uWave.value.set(wave);
    },
  };
}

/* ───────────────────────── Props ───────────────────────── */

export function scatterProps(scene, clearings, obstacles, seed = 7) {
  const rand = rng(seed);
  const free = (d, padding) =>
    clearings.every((c) => d.distanceTo(c.dir) * R > c.radius + padding) &&
    obstacles.every((o) => d.distanceTo(o.dir) * R > o.radius + padding);

  // Neon pylons (the "trees" of this world)
  const pylonGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 6);
  pylonGeo.translate(0, 0.5, 0);
  const capGeo = new THREE.OctahedronGeometry(0.32, 0);
  const stripGeo = new THREE.BoxGeometry(0.06, 1, 0.06);
  stripGeo.translate(0, 0.5, 0);
  const glowMats = NEON_LIST.map((col) => glowMat(col, 3));

  let placed = 0, tries = 0;
  while (placed < 80 && tries++ < 4000) {
    const d = randomDir(rand);
    if (!free(d, 1.4)) continue;
    const g = new THREE.Group();
    const h = 1.6 + rand() * 2.6;
    const glow = glowMats[Math.floor(rand() * glowMats.length)];
    const body = new THREE.Mesh(pylonGeo, DARK_METAL);
    body.scale.y = h;
    const strip = new THREE.Mesh(stripGeo, glow);
    strip.scale.y = h * 0.85;
    strip.position.set(0, 0.05, 0.3);
    const cap = new THREE.Mesh(capGeo, glow);
    cap.position.y = h + 0.45;
    cap.userData.spin = 0.5 + rand();
    g.add(body, strip, cap);
    placeOnSurface(g, d, { lift: -0.05, spin: rand() * 6.28 });
    shadows(g);
    scene.add(g);
    obstacles.push({ dir: d, radius: 0.45 });
    placed++;
  }

  // Crystal clusters (the "rocks")
  const crystalGeo = new THREE.OctahedronGeometry(0.5, 0);
  const crystalMats = NEON_LIST.map(
    (col) =>
      new THREE.MeshStandardMaterial({
        color: '#0b0f22',
        emissive: col,
        emissiveIntensity: 0.55,
        roughness: 0.2,
        metalness: 0.4,
        flatShading: true,
      }),
  );
  placed = 0;
  tries = 0;
  while (placed < 40 && tries++ < 4000) {
    const d = randomDir(rand);
    if (!free(d, 1.2)) continue;
    const g = new THREE.Group();
    const m = crystalMats[Math.floor(rand() * crystalMats.length)];
    const n = 3 + Math.floor(rand() * 3);
    const s = 0.7 + rand() * 0.8;
    for (let i = 0; i < n; i++) {
      const cr = new THREE.Mesh(crystalGeo, m);
      cr.scale.set(0.6, 1.6 + rand() * 1.4, 0.6);
      cr.position.set((rand() - 0.5) * 0.9, 0.3, (rand() - 0.5) * 0.9);
      cr.rotation.set((rand() - 0.5) * 0.7, rand() * 3, (rand() - 0.5) * 0.7);
      g.add(cr);
    }
    g.scale.setScalar(s);
    placeOnSurface(g, d, { lift: -0.1, spin: rand() * 6.28 });
    shadows(g);
    scene.add(g);
    obstacles.push({ dir: d, radius: 0.7 * s });
    placed++;
  }

  // Glowing "data bits" scattered on the ground (instanced, cheap)
  const bitGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const count = 700;
  const bits = new THREE.InstancedMesh(bitGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2) }), count);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < count; ) {
    const d = randomDir(rand);
    if (!clearings.every((cl) => d.distanceTo(cl.dir) * R > cl.radius)) continue;
    placeOnSurface(dummy, d, { lift: 0.08 + rand() * 0.15, spin: rand() * 6 });
    dummy.scale.setScalar(0.5 + rand() * 1.2);
    dummy.updateMatrix();
    bits.setMatrixAt(i, dummy.matrix);
    bits.setColorAt(i, col.set(NEON_LIST[Math.floor(rand() * 3)]));
    i++;
  }
  bits.instanceMatrix.needsUpdate = true;
  bits.instanceColor.needsUpdate = true;
  scene.add(bits);
}

/* ───────────────────────── Sky ───────────────────────── */

export function createSky(scene, seed = 3) {
  const rand = rng(seed);

  // stars
  const n = 2500;
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const d = randomDir(rand).multiplyScalar(260 + rand() * 120);
    p.set([d.x, d.y, d.z], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(
    new THREE.Points(sg, new THREE.PointsMaterial({ color: '#9fb8ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85 })),
  );

  // orbital rings with travelling data packets
  const rings = [];
  const packetGeo = new THREE.OctahedronGeometry(0.35, 0);
  [
    { r: R + 15, tilt: [0.35, 0, 0.2], color: NEON.cyan, speed: 0.12 },
    { r: R + 19, tilt: [-0.5, 0, -0.4], color: NEON.magenta, speed: -0.08 },
  ].forEach((cfg) => {
    const pivot = new THREE.Group();
    pivot.rotation.set(...cfg.tilt);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.r, 0.04, 6, 240),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.color).multiplyScalar(1.6), transparent: true, opacity: 0.55, toneMapped: false }),
    );
    ring.rotation.x = Math.PI / 2;
    pivot.add(ring);
    const spinner = new THREE.Group();
    pivot.add(spinner);
    const packetMat = glowMat(cfg.color, 4);
    for (let i = 0; i < 10; i++) {
      const pk = new THREE.Mesh(packetGeo, packetMat);
      const a = (i / 10) * Math.PI * 2 + rand() * 0.3;
      pk.position.set(Math.cos(a) * cfg.r, 0, Math.sin(a) * cfg.r);
      spinner.add(pk);
    }
    scene.add(pivot);
    rings.push({ spinner, speed: cfg.speed, ringMat: ring.material, packetMat });
  });

  // atmosphere halo
  const atmoR = R * 1.22;
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(atmoR, 64, 48),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        cInner: { value: new THREE.Color(NEON.cyan) },
        cOuter: { value: new THREE.Color(NEON.violet) },
        uR: { value: R },
        uA: { value: atmoR },
      },
      vertexShader: `
        varying vec3 vP; varying vec3 vC;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vP = mv.xyz;
          vC = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 cInner; uniform vec3 cOuter; uniform float uR; uniform float uA;
        varying vec3 vP; varying vec3 vC;
        void main(){
          vec3 rd = normalize(vP);
          float dist = length(vC - rd * dot(vC, rd));   // closest approach of view ray to planet centre
          float t = clamp((dist - uR) / (uA - uR), 0.0, 1.0);
          float a = pow(1.0 - t, 2.5);
          gl_FragColor = vec4(mix(cOuter, cInner, 1.0 - t) * a * 0.6, a);
        }`,
    }),
  );
  scene.add(atmo);

  return {
    update(dt) {
      for (const r of rings) r.spinner.rotation.y += r.speed * dt;
    },
    /** recolour the atmosphere halo and the two orbit rings */
    setColors({ inner, outer, rings: ringColors }) {
      atmo.material.uniforms.cInner.value.set(inner);
      atmo.material.uniforms.cOuter.value.set(outer);
      rings.forEach((r, i) => {
        const c = ringColors[i % ringColors.length];
        r.ringMat.color.set(c).multiplyScalar(1.6);
        r.packetMat.emissive.set(c);
      });
    },
  };
}

/* ───────────────────────── Pushable data cores ───────────────────────── */

export function createOrbs(scene, obstacles, count = 6, seed = 11) {
  const rand = rng(seed);
  const geo = new THREE.IcosahedronGeometry(0.75, 0);
  const shellGeo = new THREE.IcosahedronGeometry(0.62, 0);
  const orbs = [];
  for (let i = 0; i < count; i++) {
    const color = NEON_LIST[i % NEON_LIST.length];
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#0b0f22', roughness: 0.3, metalness: 0.5, flatShading: true, transparent: true, opacity: 0.85 }));
    neonEdges(mesh, color, 2.6);
    mesh.add(new THREE.Mesh(shellGeo, glowMat(color, 1.6)));
    mesh.castShadow = true;
    scene.add(mesh);
    const dir = walk(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(i * 1.7), 0, Math.sin(i * 1.7)), 6 + rand() * 4);
    orbs.push({ mesh, dir, vel: new THREE.Vector3(), hY: 0, vY: 0, r: 0.75 });
  }

  const n = new THREE.Vector3();
  const axis = new THREE.Vector3();

  function separate(o, otherDir, minD) {
    const d = o.dir.distanceTo(otherDir) * R;
    if (d >= minD) return null;
    tangentTowards(o.dir, otherDir, n).negate();
    o.dir.copy(walk(o.dir, n, minD - d));
    return n;
  }

  return {
    update(dt, rover) {
      for (const o of orbs) {
        // move along the surface
        const sp = o.vel.length();
        if (sp > 1e-4) {
          axis.crossVectors(o.dir, o.vel).normalize();
          const ang = (sp * dt) / R;
          o.dir.applyAxisAngle(axis, ang).normalize();
          o.vel.applyAxisAngle(axis, ang);
          // roll
          o.mesh.rotateOnWorldAxis(axis, (sp * dt) / o.r);
        }
        o.vel.addScaledVector(o.dir, -o.vel.dot(o.dir)).multiplyScalar(Math.exp(-0.9 * dt));

        // bounce
        o.vY -= 22 * dt;
        o.hY += o.vY * dt;
        if (o.hY < 0) {
          o.hY = 0;
          o.vY = Math.abs(o.vY) > 2 ? -o.vY * 0.45 : 0;
        }

        // rover hits
        if (rover.hY < 1.6) {
          const nn = separate(o, rover.pos, o.r + 1.1);
          if (nn) {
            const vn = rover.fwd.dot(nn) * rover.speed;
            const target = Math.max(vn, 1.5) * 1.35;
            const cur = o.vel.dot(nn);
            if (cur < target) o.vel.addScaledVector(nn, target - cur);
            o.vY = Math.max(o.vY, Math.abs(rover.speed) * 0.35);
          }
        }
        // obstacles
        for (const ob of obstacles) {
          const nn = separate(o, ob.dir, o.r + ob.radius);
          if (nn) {
            const vn = o.vel.dot(nn);
            if (vn < 0) o.vel.addScaledVector(nn, -1.6 * vn);
          }
        }
      }
      // orb vs orb (equal mass, swap normal velocity)
      for (let i = 0; i < orbs.length; i++)
        for (let j = i + 1; j < orbs.length; j++) {
          const A = orbs[i], B = orbs[j];
          const nn = separate(A, B.dir, A.r + B.r);
          if (nn) {
            const va = A.vel.dot(nn), vb = B.vel.dot(nn);
            if (va - vb < 0) {
              A.vel.addScaledVector(nn, vb - va);
              B.vel.addScaledVector(nn, va - vb);
            }
          }
        }

      for (const o of orbs) o.mesh.position.copy(o.dir).multiplyScalar(R + heightAt(o.dir) + o.r + o.hY);
    },
  };
}
