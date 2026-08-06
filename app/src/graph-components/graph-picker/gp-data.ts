// src/graph-components/graph-picker/gp-data.ts
// Builds the section options used by the graph picker and the radar widget.

import { useMemo, useCallback } from "react";
import { ROLE_SECTIONS } from "../../onboarding/section-picker/sections";
import { useSurveyDataStore } from "../../app/state/survey-data-store";
import { useIdentity } from "../../app/state/identity-context";

interface GraphOption {
  id: string;
  label: string;
}

const SPECIAL_SECTIONS: GraphOption[] = [
  { id: "all", label: "Everyone" },
  { id: "visitor", label: "Explorers" },
  { id: "all-massart", label: "MassArt " },
  { id: "all-students", label: "All Students" },
  { id: "all-staff", label: "All Faculty/Staff" },
];

export const CHOOSE_STUDENT = "__choose-student";
export const CHOOSE_STAFF = "__choose-staff";
export const GO_BACK = "__go-back";

// These umbrella ids still appear in stored/mock data, so the picker can label them.
const STUDENT_UMBRELLA_OPTIONS: GraphOption[] = [
  { id: "fine-arts", label: "Fine Arts" },
  { id: "design", label: "Design" },
  { id: "foundations", label: "Foundations" },
];

export function titleFromId(id: string) {
  if (!id) return "";
  return id.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function useGraphPickerData(value: string) {
  const counts = useSurveyDataStore((s) => s.counts);
  const { mySection } = useIdentity();

  const BASE_STUDENT = useMemo(() => {
    const base = ROLE_SECTIONS.student.map((section) => ({ id: section.value, label: section.label }));
    const have = new Set(base.map((option) => option.id));
    STUDENT_UMBRELLA_OPTIONS.forEach((option) => {
      if (!have.has(option.id)) base.push(option);
    });
    return base;
  }, []);

  const BASE_STAFF = useMemo(
    () => ROLE_SECTIONS.staff.map((section) => ({ id: section.value, label: section.label })),
    []
  );

  const ALL_LABELS = useMemo(() => {
    const list = [...SPECIAL_SECTIONS, ...BASE_STUDENT, ...BASE_STAFF];
    const map = new Map(list.map((option) => [option.id, option.label]));
    [value, mySection].forEach((id) => {
      if (id && !map.has(id)) map.set(id, titleFromId(id));
    });
    return map;
  }, [BASE_STUDENT, BASE_STAFF, value, mySection]);

  const sortByCountThenAlpha = useCallback(
    (items: GraphOption[]) =>
      [...items].sort((a, b) => {
        const cb = counts[b.id] ?? 0;
        const ca = counts[a.id] ?? 0;
        if (cb !== ca) return cb - ca;
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
      }),
    [counts]
  );

  const STUDENT_OPTS = useMemo(() => sortByCountThenAlpha(BASE_STUDENT), [BASE_STUDENT, sortByCountThenAlpha]);
  const STAFF_OPTS = useMemo(() => sortByCountThenAlpha(BASE_STAFF), [BASE_STAFF, sortByCountThenAlpha]);

  const MAIN_OPTS = useMemo(
    () => [
      ...SPECIAL_SECTIONS,
      { id: CHOOSE_STUDENT, label: "Student Departments" },
      { id: CHOOSE_STAFF, label: "Institutional Departments" },
    ],
    []
  );

  const studentIdSet = useMemo(() => new Set(BASE_STUDENT.map((section) => section.id)), [BASE_STUDENT]);
  const staffIdSet = useMemo(() => new Set(BASE_STAFF.map((section) => section.id)), [BASE_STAFF]);
  const yourIdsSet = useMemo(() => {
    const ids = new Set<string>();
    if (!mySection) return ids;

    ids.add(mySection);
    if (studentIdSet.has(mySection)) ids.add("all-students");
    if (staffIdSet.has(mySection)) ids.add("all-staff");
    return ids;
  }, [mySection, staffIdSet, studentIdSet]);

  return {
    yourIdsSet,
    ALL_LABELS,
    STUDENT_OPTS,
    STAFF_OPTS,
    MAIN_OPTS,
    studentIdSet,
    staffIdSet,
    counts,
  };
}
