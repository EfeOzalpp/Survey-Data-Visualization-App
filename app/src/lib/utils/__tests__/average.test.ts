import { averageWeights } from "../average";

describe("averageWeights", () => {
  test("returns 0.5 for empty array", () => {
    expect(averageWeights([])).toBe(0.5);
  });

  test("returns 0.5 when all values are undefined", () => {
    expect(averageWeights([undefined, undefined])).toBe(0.5);
  });

  test("returns 0.5 when all values are null", () => {
    expect(averageWeights([null, null])).toBe(0.5);
  });

  test("returns the single finite value", () => {
    expect(averageWeights([0.8, undefined])).toBe(0.8);
  });

  test("computes average of multiple finite values", () => {
    expect(averageWeights([0.2, 0.6, 1.0])).toBeCloseTo(0.6, 10);
  });

  test("ignores NaN values", () => {
    expect(averageWeights([0.5, NaN])).toBe(0.5);
  });

  test("ignores null mixed with finite values", () => {
    expect(averageWeights([0.4, null, 0.6])).toBeCloseTo(0.5, 10);
  });

  test("returns 0 when all values are 0", () => {
    expect(averageWeights([0, 0])).toBe(0);
  });
});
