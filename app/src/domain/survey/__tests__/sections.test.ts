import { filterRowsForSection } from "../sections";

interface Row {
  _id: string;
  section: string;
}

const makeRow = (section: string): Row => ({ _id: `${section}-id`, section });

const rows: Row[] = [
  makeRow("design"),
  makeRow("design"),
  makeRow("fine-arts"),
  makeRow("visitor"),
];

describe("filterRowsForSection", () => {
  test("'all' returns all rows", () => {
    expect(filterRowsForSection(rows, "all")).toHaveLength(4);
  });

  test("empty string returns all rows", () => {
    expect(filterRowsForSection(rows, "")).toHaveLength(4);
  });

  test("specific section filters correctly", () => {
    const result = filterRowsForSection(rows, "design");
    expect(result).toHaveLength(2);
    result.forEach((r) => {
      expect(r.section).toBe("design");
    });
  });

  test("unknown section returns empty array", () => {
    expect(filterRowsForSection(rows, "nonexistent")).toHaveLength(0);
  });

  test("'all-students' returns only student-section rows", () => {
    const withStaff = [...rows, makeRow("facilities")];
    const result = filterRowsForSection(withStaff, "all-students");
    expect(result.every((r) => r.section === "design" || r.section === "fine-arts")).toBe(true);
  });

  test("'all-staff' returns only staff-section rows", () => {
    const withStaff = [...rows, makeRow("facilities")];
    const result = filterRowsForSection(withStaff, "all-staff");
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe("facilities");
  });
});
