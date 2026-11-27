import { describe, expect, it } from "vitest";

import { stepNotice } from "../src/index.ts";

// Four notes, two to a row.
describe("stepNotice", () => {
  it("walks the grid with WASD", () => {
    expect(stepNotice(0, 4, 1, 0)).toBe(1);
    expect(stepNotice(1, 4, -1, 0)).toBe(0);
    expect(stepNotice(0, 4, 0, 1)).toBe(2);
    expect(stepNotice(3, 4, 0, -1)).toBe(1);
  });

  it("holds at the edges", () => {
    expect(stepNotice(1, 4, 1, 0)).toBe(1);
    expect(stepNotice(2, 4, -1, 0)).toBe(2);
    expect(stepNotice(0, 4, 0, -1)).toBe(0);
    expect(stepNotice(3, 4, 0, 1)).toBe(3);
  });

  it("drops down to the lone note of a short last row", () => {
    expect(stepNotice(1, 3, 0, 1)).toBe(2);
    expect(stepNotice(2, 3, 1, 0)).toBe(2);
  });
});
