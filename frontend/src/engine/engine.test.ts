import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildChecklists, multiListStudents } from './checklists';
import { evaluateDataset } from './engine';
import { gradeForMark, letterForGpa } from './rules';
import type { Dataset, StudentResult } from './types';

const dataset = JSON.parse(
  readFileSync(resolve(__dirname, '../../public/data/sample-results.json'), 'utf8'),
) as Dataset;

const results = evaluateDataset(dataset);
const lists = buildChecklists(results);
const listById = Object.fromEntries(lists.map((l) => [l.id, l]));

function student(name: string): StudentResult {
  const found = results.find((r) => r.student.name === name);
  if (!found) throw new Error(`no student named ${name}`);
  return found;
}

function subject(name: string, code: string) {
  const found = student(name).subjects.find((s) => s.code === code);
  if (!found) throw new Error(`${name} has no subject ${code}`);
  return found;
}

function onList(id: 'optional' | 'practical' | 'absent', name: string): boolean {
  return listById[id].entries.some((e) => e.result.student.name === name);
}

describe('dataset shape', () => {
  it('covers at least 60 students across two classes', () => {
    expect(results.length).toBeGreaterThanOrEqual(60);
    expect(dataset.classes).toHaveLength(2);
    for (const cls of dataset.classes) {
      expect(results.filter((r) => r.student.classId === cls.id).length).toBeGreaterThan(0);
    }
  });

  it('gives every student six compulsory subjects and one optional', () => {
    for (const r of results) {
      expect(r.compulsory).toHaveLength(6);
      expect(r.optional).not.toBeNull();
      expect(r.subjects).toHaveLength(7);
    }
  });

  it('carries at least eight hand-seeded edge cases', () => {
    expect(results.filter((r) => r.student.edgeCase).length).toBeGreaterThanOrEqual(8);
  });
});

describe('grade scale', () => {
  it('reads grade points off the band boundaries', () => {
    expect(gradeForMark(100).gp).toBe(5);
    expect(gradeForMark(80).gp).toBe(5);
    expect(gradeForMark(79).gp).toBe(4);
    expect(gradeForMark(70).gp).toBe(4);
    expect(gradeForMark(69).gp).toBe(3.5);
    expect(gradeForMark(60).gp).toBe(3.5);
    expect(gradeForMark(59).gp).toBe(3);
    expect(gradeForMark(50).gp).toBe(3);
    expect(gradeForMark(49).gp).toBe(2);
    expect(gradeForMark(40).gp).toBe(2);
    expect(gradeForMark(39).gp).toBe(1);
    expect(gradeForMark(33).gp).toBe(1);
    expect(gradeForMark(32).gp).toBe(0);
    expect(gradeForMark(0).gp).toBe(0);
  });

  it('maps a final GPA to a letter grade (R-10)', () => {
    expect(letterForGpa(5.0, true)).toBe('A+');
    expect(letterForGpa(4.99, true)).toBe('A');
    expect(letterForGpa(4.0, true)).toBe('A');
    expect(letterForGpa(3.99, true)).toBe('A-');
    expect(letterForGpa(3.5, true)).toBe('A-');
    expect(letterForGpa(3.49, true)).toBe('B');
    expect(letterForGpa(3.0, true)).toBe('B');
    expect(letterForGpa(2.99, true)).toBe('C');
    expect(letterForGpa(2.0, true)).toBe('C');
    expect(letterForGpa(1.99, true)).toBe('D');
    expect(letterForGpa(1.0, true)).toBe('D');
    expect(letterForGpa(0.99, true)).toBe('F');
    expect(letterForGpa(4.75, false)).toBe('F');
  });
});

describe('edge case: strong average, one failed compulsory subject', () => {
  const name = 'Tahmina Akter';

  it('fails Chemistry on the theory pass mark', () => {
    const che = subject(name, 'CHE');
    expect(che.theory).toBe(22);
    expect(che.status).toBe('fail');
    expect(che.gradePoint).toBe(0);
    expect(che.ruleId).toBe('R-11');
  });

  it('reports 0.00 F but keeps the uncancelled average visible (R-13)', () => {
    const r = student(name);
    expect(r.compulsorySum).toBe(25);
    expect(r.optionalCredit).toBe(3);
    expect(r.uncancelledGpa).toBe(4.67);
    expect(r.gpa).toBe(0);
    expect(r.letter).toBe('F');
    expect(r.averageMark).toBeGreaterThan(80);
    expect(r.cancelledBy.map((s) => s.code)).toEqual(['CHE']);
    expect(r.trace.some((s) => s.emphasis === 'cancel' && s.detail.includes('4.67'))).toBe(true);
  });
});

describe('edge case: practical fail with a passing theory mark', () => {
  const name = 'Nayeem Hossain';

  it('fails the subject even though theory passed (R-11)', () => {
    const phy = subject(name, 'PHY');
    expect(phy.theory).toBe(58);
    expect(phy.practical).toBe(6);
    expect(phy.gradePoint).toBe(0);
    expect(phy.practicalFailed).toBe(true);
    expect(phy.rule).toContain('theory mark of 58');
  });

  it('cancels the result and lands on the practical list', () => {
    const r = student(name);
    expect(r.uncancelledGpa).toBe(3.75);
    expect(r.gpa).toBe(0);
    expect(r.letter).toBe('F');
    expect(onList('practical', name)).toBe(true);
  });
});

describe('edge case: optional subject below the point where it helps', () => {
  const name = 'Sumaiya Rahman';

  it('scores exactly 2.00 so max(0, gp - 2) contributes nothing', () => {
    const r = student(name);
    expect(r.optionalGradePoint).toBe(2);
    expect(r.optionalCredit).toBe(0);
    expect(r.compulsorySum).toBe(22.5);
    expect(r.gpa).toBe(3.75);
    expect(r.letter).toBe('A-');
    expect(r.flags.optionalRule).toBe(true);
    expect(onList('optional', name)).toBe(true);
  });
});

describe('edge case: absent in a compulsory subject', () => {
  const name = 'Rakib Islam';

  it('shows AB, grade point 0 and an overall F (R-12)', () => {
    const ict = subject(name, 'ICT');
    expect(ict.status).toBe('absent');
    expect(ict.markUsed).toBe('AB');
    expect(ict.gradePoint).toBe(0);
    expect(ict.ruleId).toBe('R-12');

    const r = student(name);
    expect(r.uncancelledGpa).toBe(4.08);
    expect(r.gpa).toBe(0);
    expect(r.letter).toBe('F');
    expect(onList('absent', name)).toBe(true);
    expect(onList('practical', name)).toBe(false);
  });
});

describe('edge case: absent in the optional subject', () => {
  const name = 'Nusrat Jahan Mim';

  it('contributes 0 without cancelling the result (R-12)', () => {
    const r = student(name);
    expect(r.optional?.status).toBe('absent');
    expect(r.optionalCredit).toBe(0);
    expect(r.passed).toBe(true);
    expect(r.gpa).toBe(4.08);
    expect(r.letter).toBe('A');
  });

  it('appears on both the optional and absent lists (R-29)', () => {
    expect(onList('optional', name)).toBe(true);
    expect(onList('absent', name)).toBe(true);
  });
});

describe('edge case: GPA cap', () => {
  it('holds 5.50 at 5.00 for A+', () => {
    const r = student('Sazzad Hossain');
    expect(r.compulsorySum).toBe(30);
    expect(r.optionalCredit).toBe(3);
    expect(r.gpa).toBe(5);
    expect(r.letter).toBe('A+');
    expect(r.trace.some((s) => s.emphasis === 'cap')).toBe(true);
  });
});

describe('edge case: letter grade boundaries', () => {
  it('treats exactly 3.50 as A-', () => {
    const r = student('Farzana Yeasmin');
    expect(r.gpa).toBe(3.5);
    expect(r.letter).toBe('A-');
  });

  it('treats 3.42 as B', () => {
    const r = student('Mehedi Hasan');
    expect(r.gpa).toBe(3.42);
    expect(r.letter).toBe('B');
  });
});

describe('edge case: component pass marks exactly met', () => {
  it('passes Chemistry on 25 theory and 8 practical', () => {
    const che = subject('Habibur Rahman', 'CHE');
    expect(che.total).toBe(33);
    expect(che.status).toBe('pass');
    expect(che.gradePoint).toBe(1);

    const r = student('Habibur Rahman');
    expect(r.gpa).toBe(1.5);
    expect(r.letter).toBe('D');
    expect(onList('practical', 'Habibur Rahman')).toBe(false);
  });
});

describe('edge case: practical fail inside the optional subject', () => {
  const name = 'Arif Mahmud';

  it('zeroes the optional without cancelling the result', () => {
    const r = student(name);
    expect(r.optional?.practicalFailed).toBe(true);
    expect(r.optionalGradePoint).toBe(0);
    expect(r.optionalCredit).toBe(0);
    expect(r.passed).toBe(true);
    expect(r.gpa).toBe(4.33);
    expect(r.letter).toBe('A');
  });

  it('lands on the practical and optional lists', () => {
    expect(onList('practical', name)).toBe(true);
    expect(onList('optional', name)).toBe(true);
  });
});

describe('edge case: theory fail with a passing practical', () => {
  const name = 'Israt Jahan';

  it('fails the subject without touching the practical list', () => {
    const phy = subject(name, 'PHY');
    expect(phy.theory).toBe(21);
    expect(phy.practical).toBe(20);
    expect(phy.gradePoint).toBe(0);
    expect(phy.practicalFailed).toBe(false);

    const r = student(name);
    expect(r.uncancelledGpa).toBe(3.25);
    expect(r.gpa).toBe(0);
    expect(onList('practical', name)).toBe(false);
    expect(onList('absent', name)).toBe(false);
    expect(onList('optional', name)).toBe(false);
  });
});

describe('edge case: absent twice', () => {
  const name = 'Marzia Sultana';

  it('cancels on the compulsory AB and lists the optional AB too', () => {
    const r = student(name);
    expect(r.uncancelledGpa).toBe(3);
    expect(r.gpa).toBe(0);
    expect(r.letter).toBe('F');
    expect(onList('absent', name)).toBe(true);
    expect(onList('optional', name)).toBe(true);
  });
});

describe('checking lists (R-29)', () => {
  it('lists every optional grade point at or below 2.00, absences included', () => {
    const expected = results.filter((r) => (r.optional?.gradePoint ?? 0) <= 2).length;
    expect(listById.optional.entries).toHaveLength(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('lists every practical part below 8', () => {
    const expected = results.filter((r) =>
      r.subjects.some((s) => s.practical !== null && s.practical < 8),
    ).length;
    expect(listById.practical.entries).toHaveLength(expected);
  });

  it('lists every AB in any subject', () => {
    const expected = results.filter((r) => r.subjects.some((s) => s.status === 'absent')).length;
    expect(listById.absent.entries).toHaveLength(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('allows a student on more than one list', () => {
    const multi = multiListStudents(lists);
    expect(multi.size).toBeGreaterThan(0);
  });
});

describe('whole cohort invariants', () => {
  it('never reports a GPA above the cap or below zero', () => {
    for (const r of results) {
      expect(r.gpa).toBeGreaterThanOrEqual(0);
      expect(r.gpa).toBeLessThanOrEqual(5);
    }
  });

  it('reports 0.00 and F for every compulsory failure, and never otherwise', () => {
    for (const r of results) {
      const hasCompulsoryFailure = r.compulsory.some((s) => s.status !== 'pass');
      expect(hasCompulsoryFailure).toBe(!r.passed);
      if (hasCompulsoryFailure) {
        expect(r.gpa).toBe(0);
        expect(r.letter).toBe('F');
      } else {
        expect(r.letter).not.toBe('F');
      }
    }
  });

  it('matches the formula for every passing student', () => {
    for (const r of results.filter((s) => s.passed)) {
      const expected = Math.min(5, (r.compulsorySum + r.optionalCredit) / 6);
      expect(r.gpa).toBeCloseTo(Math.round(expected * 100) / 100, 10);
    }
  });
});
