import { describe, expect, it } from "vitest";

import { letterFromGpa, round2, scoreToGradePoint } from "./bands.js";

describe("scoreToGradePoint", () => {
  it.each([
    [100, 5.0],
    [80, 5.0],
    [79, 4.0],
    [70, 4.0],
    [69, 3.5],
    [60, 3.5],
    [59, 3.0],
    [50, 3.0],
    [49, 2.0],
    [40, 2.0],
    [39, 1.0],
    [33, 1.0],
    [32, 0],
    [0, 0],
  ])("maps score %i to grade point %f", (score, expected) => {
    expect(scoreToGradePoint(score).gradePoint).toBe(expected);
  });
});

describe("letterFromGpa", () => {
  it.each([
    [5.0, "A+"],
    [4.99, "A"],
    [4.0, "A"],
    [3.99, "A-"],
    [3.5, "A-"],
    [3.49, "B"],
    [3.0, "B"],
    [2.99, "C"],
    [2.0, "C"],
    [1.99, "D"],
    [1.0, "D"],
    [0.99, "F"],
    [0, "F"],
  ] as const)("maps GPA %f to letter %s", (gpa, expected) => {
    expect(letterFromGpa(gpa)).toBe(expected);
  });
});

describe("round2", () => {
  it("rounds half-up without floating point drift", () => {
    expect(round2(3.005)).toBe(3.01);
    expect(round2(18.5 / 6)).toBe(3.08);
    expect(round2(17 / 6)).toBe(2.83);
  });
});
