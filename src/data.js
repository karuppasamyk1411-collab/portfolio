// ─────────────────────────────────────────────────────────────
//  Content loader.  ALL text and lists come from the .env file
//  (keys starting with VITE_).  Edit .env, not this file.
//  Missing keys fall back to empty values so the site still loads.
// ─────────────────────────────────────────────────────────────

const ENV = import.meta.env;

/** plain text value from .env */
export const env = (key, fallback = '') => {
  const v = ENV[`VITE_${key}`];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
};

/** JSON list/object from .env (logs a clear message if the JSON is broken) */
const envJSON = (key, fallback) => {
  const raw = env(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[.env] VITE_${key} is not valid JSON: ${err.message}`);
    return fallback;
  }
};

const email = env('EMAIL');
const linkedin = env('LINKEDIN_URL');
const github = env('GITHUB_URL');
const thmUser = env('TRYHACKME_USER');
const resumeUrl = env('RESUME_URL');
const urlTail = (u) => u.replace(/^https?:\/\/(www\.)?[^/]+\//, '').replace(/\/$/, '');

export const profile = {
  name: env('NAME', 'Your Name'),
  shortName: env('SHORT_NAME', env('NAME', 'YOU').split(' ')[0].toUpperCase()),
  role: env('ROLE'),
  tagline: env('TAGLINE'),
  location: env('LOCATION'),
  openTo: env('OPEN_TO'),
  photo: env('PHOTO'),
  status: env('STATUS'),
  links: [
    email && { label: 'Email', url: `mailto:${email}`, text: email },
    linkedin && { label: 'LinkedIn', url: linkedin, text: urlTail(linkedin) },
    github && { label: 'GitHub', url: github, text: urlTail(github) },
    thmUser && { label: 'TryHackMe', url: `https://tryhackme.com/p/${thmUser}`, text: `p/${thmUser}` },
    resumeUrl && { label: 'Résumé', url: resumeUrl, text: 'Download PDF' },
  ].filter(Boolean),
};

export const soc = {
  host: env('SOC_HOSTNAME', 'soc-sensor-01'),
  domain: env('SOC_DOMAIN', 'CORP'),
};

export const about = env('ABOUT');
export const highlights = envJSON('HIGHLIGHTS', []);
export const skills = envJSON('SKILLS', []);
export const experience = envJSON('EXPERIENCE', []);
export const education = envJSON('EDUCATION', []);
export const certifications = envJSON('CERTIFICATIONS', []);
export const projects = envJSON('PROJECTS', []);

export const ctf = {
  title: env('CTF_TITLE'),
  text: env('CTF_TEXT'),
  html: env('CTF_HTML'),
};

export const contactMessage = env('CONTACT_MESSAGE');

export const tryhackme = thmUser
  ? {
      username: thmUser,
      url: `https://tryhackme.com/p/${thmUser}`,
      tagline: env('TRYHACKME_TAGLINE'),
      menu: envJSON('TRYHACKME_MENU', []),
      stats: envJSON('TRYHACKME_STATS', []),
    }
  : null;

/** page headings & blurbs (portfolio) */
export const text = (key, fallback = '') => env(`TEXT_${key}`, fallback);
