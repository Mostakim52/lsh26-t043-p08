import {
  isAbsentMark,
  isSplitMark,
  type FixtureCase,
  type FixtureMark,
} from "./fixture.js";

/**
 * Turns a raw fixture case into the flat records the database stores.
 *
 * This is deliberately pure and free of Prisma imports: every cross-reference
 * rule in the dataset (a student's optional subject must exist and must not be
 * compulsory, marks must match the subject's practical-ness, and so on) is
 * checked here and can be tested without a database.
 */

export interface NormalizedSubject {
  code: string;
  name: string;
  hasPractical: boolean;
  isCompulsory: boolean;
  displayOrder: number;
}

export interface NormalizedMark {
  subjectCode: string;
  isAbsent: boolean;
  wholeScore: number | null;
  theoryScore: number | null;
  practicalScore: number | null;
}

export interface NormalizedStudent {
  rollNo: string;
  name: string;
  className: string;
  optionalSubjectCode: string;
  marks: NormalizedMark[];
}

export interface NormalizedCase {
  caseId: string;
  subjects: NormalizedSubject[];
  students: NormalizedStudent[];
}

export class FixtureValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FixtureValidationError";
  }
}

function normalizeMark(
  subjectCode: string,
  hasPractical: boolean,
  mark: FixtureMark,
  where: string,
): NormalizedMark {
  // Absence is recorded on its own flag and leaves every score null, so an
  // absent student never collapses into "scored zero".
  if (isAbsentMark(mark)) {
    return {
      subjectCode,
      isAbsent: true,
      wholeScore: null,
      theoryScore: null,
      practicalScore: null,
    };
  }

  if (isSplitMark(mark)) {
    if (!hasPractical) {
      throw new FixtureValidationError(
        `${where}: subject "${subjectCode}" has no practical part but was given theory/practical marks`,
      );
    }
    return {
      subjectCode,
      isAbsent: false,
      wholeScore: null,
      theoryScore: mark.theory,
      practicalScore: mark.practical,
    };
  }

  if (hasPractical) {
    throw new FixtureValidationError(
      `${where}: subject "${subjectCode}" has a practical part but was given a single whole mark`,
    );
  }
  return {
    subjectCode,
    isAbsent: false,
    wholeScore: mark,
    theoryScore: null,
    practicalScore: null,
  };
}

export function normalizeCase(fixtureCase: FixtureCase): NormalizedCase {
  const { case_id: caseId } = fixtureCase;

  const subjectByCode = new Map<string, NormalizedSubject>();
  fixtureCase.subjects.forEach((subject, index) => {
    if (subjectByCode.has(subject.code)) {
      throw new FixtureValidationError(
        `${caseId}: duplicate subject code "${subject.code}"`,
      );
    }
    subjectByCode.set(subject.code, {
      code: subject.code,
      name: subject.name,
      hasPractical: subject.practical,
      isCompulsory: fixtureCase.compulsory.includes(subject.code),
      displayOrder: index,
    });
  });

  for (const code of fixtureCase.compulsory) {
    if (!subjectByCode.has(code)) {
      throw new FixtureValidationError(
        `${caseId}: compulsory subject "${code}" is not in the subject list`,
      );
    }
  }

  const seenRollNos = new Set<string>();
  const students = fixtureCase.students.map((student) => {
    const where = `${caseId}/${student.id}`;

    if (seenRollNos.has(student.id)) {
      throw new FixtureValidationError(`${where}: duplicate student id`);
    }
    seenRollNos.add(student.id);

    const optionalSubject = subjectByCode.get(student.optional);
    if (!optionalSubject) {
      throw new FixtureValidationError(
        `${where}: optional subject "${student.optional}" is not in the subject list`,
      );
    }
    if (optionalSubject.isCompulsory) {
      throw new FixtureValidationError(
        `${where}: optional subject "${student.optional}" is also compulsory`,
      );
    }

    // A student carries exactly the compulsory subjects plus their optional.
    const expected = [...fixtureCase.compulsory, student.optional];
    const provided = Object.keys(student.marks);

    const missing = expected.filter((code) => !(code in student.marks));
    if (missing.length > 0) {
      throw new FixtureValidationError(
        `${where}: missing marks for ${missing.join(", ")}`,
      );
    }
    const unexpected = provided.filter((code) => !expected.includes(code));
    if (unexpected.length > 0) {
      throw new FixtureValidationError(
        `${where}: unexpected marks for ${unexpected.join(", ")}`,
      );
    }

    const marks = expected.map((code) => {
      const subject = subjectByCode.get(code);
      if (!subject) {
        throw new FixtureValidationError(
          `${where}: subject "${code}" is not in the subject list`,
        );
      }
      const mark = student.marks[code];
      if (mark === undefined) {
        throw new FixtureValidationError(`${where}: missing mark for "${code}"`);
      }
      return normalizeMark(code, subject.hasPractical, mark, where);
    });

    return {
      rollNo: student.id,
      name: student.name,
      className: student.class,
      optionalSubjectCode: student.optional,
      marks,
    } satisfies NormalizedStudent;
  });

  return {
    caseId,
    subjects: [...subjectByCode.values()],
    students,
  };
}
