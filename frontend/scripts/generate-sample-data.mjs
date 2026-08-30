/**
 * Builds frontend/public/data/sample-results.json.
 *
 * The cohort is deterministic: a seeded PRNG fills the ordinary students, and the
 * sharp edges are hand-written below with exact marks so they can be checked by hand.
 * Re-running the script reproduces the same file byte for byte.
 *
 *   node scripts/generate-sample-data.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../public/data/sample-results.json');
const SEED = 20260830;

/* ------------------------------------------------------------------ prng -- */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const between = (lo, hi) => lo + rand() * (hi - lo);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* -------------------------------------------------------------- catalogue -- */

const CLASSES = [
  { id: 'c9a', name: 'Class 9 - Section A', session: '2025-2026' },
  { id: 'c10a', name: 'Class 10 - Section A', session: '2025-2026' },
];

const SUBJECTS = [
  { code: 'BAN', name: 'Bangla', hasPractical: false, kind: 'compulsory' },
  { code: 'ENG', name: 'English', hasPractical: false, kind: 'compulsory' },
  { code: 'MAT', name: 'Mathematics', hasPractical: false, kind: 'compulsory' },
  { code: 'PHY', name: 'Physics', hasPractical: true, kind: 'compulsory' },
  { code: 'CHE', name: 'Chemistry', hasPractical: true, kind: 'compulsory' },
  { code: 'ICT', name: 'Information and Communication Technology', hasPractical: true, kind: 'compulsory' },
  { code: 'HMT', name: 'Higher Mathematics', hasPractical: true, kind: 'optional' },
  { code: 'BIO', name: 'Biology', hasPractical: true, kind: 'optional' },
  { code: 'ECO', name: 'Economics', hasPractical: false, kind: 'optional' },
];

const COMPULSORY = SUBJECTS.filter((s) => s.kind === 'compulsory');
const byCode = Object.fromEntries(SUBJECTS.map((s) => [s.code, s]));

const GIVEN = [
  'Rakib', 'Tanvir', 'Sabbir', 'Nayeem', 'Shakib', 'Arif', 'Mahmud', 'Rasel',
  'Sohel', 'Imran', 'Fahim', 'Jubayer', 'Rifat', 'Sazzad', 'Mizanur', 'Anisur',
  'Kamrul', 'Shahriar', 'Ashraful', 'Mehedi', 'Rubel', 'Tofayel', 'Nazmul', 'Habibur',
  'Sadia', 'Nusrat', 'Tahmina', 'Farzana', 'Sumaiya', 'Rumana', 'Israt', 'Jannatul',
  'Maisha', 'Sharmin', 'Afsana', 'Nabila', 'Tasnim', 'Rubaiya', 'Marzia', 'Lamia',
  'Sanjida', 'Shirin', 'Ayesha', 'Nishat',
];

const FAMILY = [
  'Islam', 'Hossain', 'Rahman', 'Ahmed', 'Chowdhury', 'Akter', 'Khatun', 'Sultana',
  'Sarker', 'Biswas', 'Talukder', 'Bhuiyan', 'Molla', 'Haque', 'Karim', 'Uddin',
  'Alam', 'Siddique', 'Mondal', 'Parvin',
];

/* ------------------------------------------------------------ mark shapes -- */

const PROFILES = [
  { lo: 0.82, hi: 0.97, weight: 8 },
  { lo: 0.68, hi: 0.86, weight: 20 },
  { lo: 0.5, hi: 0.72, weight: 34 },
  { lo: 0.36, hi: 0.56, weight: 24 },
  { lo: 0.24, hi: 0.43, weight: 14 },
];
const PROFILE_BAG = PROFILES.flatMap((p) => Array(p.weight).fill(p));

function marksFor(def, ability) {
  const ratio = clamp(ability + between(-0.09, 0.09), 0.08, 1);
  if (!def.hasPractical) {
    return { code: def.code, theory: Math.round(clamp(ratio * 100, 0, 100)), practical: null };
  }
  // Practicals are marked a little more generously than the written paper, which is
  // why a practical fail next to a passing theory mark is the unusual case it is.
  const pracRatio = clamp(ratio + between(-0.04, 0.14), 0.05, 1);
  return {
    code: def.code,
    theory: Math.round(clamp(ratio * 75, 0, 75)),
    practical: Math.round(clamp(pracRatio * 25, 0, 25)),
  };
}

/* ----------------------------------------------------------- edge records -- */
// Hand-written so every number can be verified against the rules by hand.
// A plain number is a written-only mark out of 100; [theory, practical] is a
// practical subject marked out of 75 and 25; 'AB' is absent.

const EDGE_STUDENTS = [
  {
    name: 'Tahmina Akter', classId: 'c9a', optionalCode: 'HMT',
    edgeCase: 'Strong average, one failed compulsory subject. Chemistry theory 22 / 75 misses the pass mark of 25, so a 4.67 average is cancelled to 0.00 F.',
    m: { BAN: 88, ENG: 85, MAT: 92, PHY: [68, 22], CHE: [22, 20], ICT: [70, 23], HMT: [66, 21] },
  },
  {
    name: 'Nayeem Hossain', classId: 'c9a', optionalCode: 'BIO',
    edgeCase: 'Practical fail with a passing theory mark. Physics theory 58 / 75 passed but practical 6 / 25 did not, which fails the subject.',
    m: { BAN: 72, ENG: 68, MAT: 75, PHY: [58, 6], CHE: [55, 19], ICT: [60, 20], BIO: [57, 18] },
  },
  {
    name: 'Sumaiya Rahman', classId: 'c9a', optionalCode: 'ECO',
    edgeCase: 'Optional subject exactly on the line. Economics 44 / 100 gives grade point 2.00, and max(0, 2.00 - 2) = 0, so it adds nothing.',
    m: { BAN: 66, ENG: 71, MAT: 62, PHY: [52, 18], CHE: [50, 17], ICT: [55, 19], ECO: 44 },
  },
  {
    name: 'Rakib Islam', classId: 'c9a', optionalCode: 'HMT',
    edgeCase: 'Absent in a compulsory subject. AB in ICT cancels a 4.08 average to 0.00 F.',
    m: { BAN: 74, ENG: 69, MAT: 81, PHY: [60, 20], CHE: [58, 19], ICT: 'AB', HMT: [62, 21] },
  },
  {
    name: 'Nusrat Jahan Mim', classId: 'c9a', optionalCode: 'BIO',
    edgeCase: 'Absent in the optional subject. Biology AB contributes 0 but does not cancel the result, so the GPA stands at 4.08.',
    m: { BAN: 70, ENG: 66, MAT: 72, PHY: [55, 19], CHE: [52, 18], ICT: [61, 20], BIO: 'AB' },
  },
  {
    name: 'Sazzad Hossain', classId: 'c10a', optionalCode: 'HMT',
    edgeCase: 'GPA cap. (30.00 + 3.00) / 6 = 5.50, held at 5.00 for A+.',
    m: { BAN: 82, ENG: 84, MAT: 95, PHY: [70, 23], CHE: [68, 22], ICT: [72, 24], HMT: [71, 23] },
  },
  {
    name: 'Farzana Yeasmin', classId: 'c10a', optionalCode: 'ECO',
    edgeCase: 'Letter grade boundary. The GPA lands on exactly 3.50, the first point of A- rather than the last of B.',
    m: { BAN: 73, ENG: 64, MAT: 61, PHY: [45, 18], CHE: [44, 17], ICT: [40, 15], ECO: 40 },
  },
  {
    name: 'Habibur Rahman', classId: 'c10a', optionalCode: 'ECO',
    edgeCase: 'Component pass marks exactly met. Chemistry 25 / 75 theory and 8 / 25 practical is a pass at 33, grade point 1.00.',
    m: { BAN: 35, ENG: 41, MAT: 33, PHY: [30, 10], CHE: [25, 8], ICT: [28, 12], ECO: 35 },
  },
  {
    name: 'Arif Mahmud', classId: 'c10a', optionalCode: 'HMT',
    edgeCase: 'Practical fail in the optional subject. Higher Mathematics practical 5 / 25 zeroes the optional, but the compulsory six still carry a 4.33.',
    m: { BAN: 76, ENG: 70, MAT: 79, PHY: [62, 21], CHE: [59, 20], ICT: [65, 22], HMT: [55, 5] },
  },
  {
    name: 'Israt Jahan', classId: 'c10a', optionalCode: 'BIO',
    edgeCase: 'Theory fail with a passing practical. Physics practical 20 / 25 passed, theory 21 / 75 did not. No checking list catches this one, which is why the trace matters.',
    m: { BAN: 63, ENG: 58, MAT: 66, PHY: [21, 20], CHE: [50, 18], ICT: [54, 19], BIO: [58, 20] },
  },
  {
    name: 'Marzia Sultana', classId: 'c10a', optionalCode: 'ECO',
    edgeCase: 'Absent twice. AB in compulsory Mathematics and in the optional Economics, so the student lands on both the absent list and the optional list.',
    m: { BAN: 68, ENG: 64, MAT: 'AB', PHY: [50, 18], CHE: [48, 17], ICT: [52, 19], ECO: 'AB' },
  },
  {
    name: 'Mehedi Hasan', classId: 'c10a', optionalCode: 'ECO',
    edgeCase: 'The other side of the boundary. 20.50 / 6 = 3.4167, rounded to 3.42, which is B and not A-.',
    m: { BAN: 71, ENG: 60, MAT: 69, PHY: [46, 17], CHE: [42, 15], ICT: [38, 13], ECO: 47 },
  },
];

function edgeMarks(spec, optionalCode) {
  const codes = [...COMPULSORY.map((s) => s.code), optionalCode];
  return codes.map((code) => {
    const v = spec[code];
    if (v === 'AB') return { code, theory: null, practical: null, absent: true };
    if (Array.isArray(v)) return { code, theory: v[0], practical: v[1] };
    if (byCode[code].hasPractical) throw new Error(code + ' needs [theory, practical]');
    return { code, theory: v, practical: null };
  });
}

/* ------------------------------------------------------------- the cohort -- */

const TOTAL_PER_CLASS = 32;
const usedNames = new Set(EDGE_STUDENTS.map((s) => s.name));

function freshName() {
  for (let i = 0; i < 500; i += 1) {
    const name = pick(GIVEN) + ' ' + pick(FAMILY);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  throw new Error('ran out of distinct names');
}

const OPTIONAL_BAG = ['HMT', 'HMT', 'HMT', 'BIO', 'BIO', 'ECO'];
const students = [];

for (const cls of CLASSES) {
  const seeded = EDGE_STUDENTS.filter((s) => s.classId === cls.id);
  const filler = TOTAL_PER_CLASS - seeded.length;
  const pool = [];

  for (const s of seeded) {
    pool.push({
      name: s.name,
      optionalCode: s.optionalCode,
      marks: edgeMarks(s.m, s.optionalCode),
      edgeCase: s.edgeCase,
    });
  }

  for (let i = 0; i < filler; i += 1) {
    const profile = pick(PROFILE_BAG);
    const ability = between(profile.lo, profile.hi);
    const optionalCode = pick(OPTIONAL_BAG);
    const defs = [...COMPULSORY, byCode[optionalCode]];
    pool.push({
      name: freshName(),
      optionalCode,
      marks: defs.map((def) => marksFor(def, ability)),
    });
  }

  // A couple of ordinary students also miss a paper, so the absent list is not made
  // up entirely of the hand-seeded records.
  const absentPicks = new Set();
  while (absentPicks.size < 2) absentPicks.add(seeded.length + Math.floor(rand() * filler));
  for (const idx of absentPicks) {
    const target = pick(pool[idx].marks);
    target.theory = null;
    target.practical = null;
    target.absent = true;
  }

  // Shuffle so the seeded edge cases are not all at the top of the roll.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = pool[i];
    pool[i] = pool[j];
    pool[j] = swap;
  }

  pool.forEach((s, i) => {
    const roll = i + 1;
    students.push({
      id: cls.id.toUpperCase() + '-' + String(roll).padStart(2, '0'),
      roll,
      name: s.name,
      classId: cls.id,
      optionalCode: s.optionalCode,
      marks: s.marks,
      ...(s.edgeCase ? { edgeCase: s.edgeCase } : {}),
    });
  });
}

const dataset = {
  meta: {
    school: 'Shaheed Smrity Higher Secondary School',
    exam: 'Annual Examination',
    session: '2025-2026',
    generatedAt: '2026-08-30',
    seed: SEED,
  },
  classes: CLASSES,
  subjects: SUBJECTS,
  students,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(dataset, null, 2) + '\n', 'utf8');
console.log('wrote ' + students.length + ' students to ' + OUT);
