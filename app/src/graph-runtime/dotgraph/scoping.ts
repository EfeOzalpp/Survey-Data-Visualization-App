// src/graph-runtime/dotgraph/scoping.ts

// Role and section normalization for deciding when a user's personal dot belongs in the current graph view.

import { STUDENT_IDS, STAFF_IDS } from '../../domain/survey/sections';

export const ROLE = {
  VISITOR: 'visitor',
  STUDENTS: 'all-students',
  STAFF: 'all-staff',
  UNKNOWN: 'unknown',
} as const;

export type ViewerRole = (typeof ROLE)[keyof typeof ROLE];

const BUCKETS = new Set(['all', 'all-massart', 'all-students', 'all-staff', 'visitor']);

const STUDENT_ID_SET = new Set(STUDENT_IDS);
const STAFF_ID_SET = new Set(STAFF_IDS);

const normStr = (v: unknown) => {
  if (typeof v === "string") return v.trim().toLowerCase();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim().toLowerCase();
  return "";
};

// Postgres, session storage, and UI labels can all produce slightly different section strings.
export function normSection(sectionRaw: unknown): string {
  const s = normStr(sectionRaw);
  if (!s) return 'all';
  if (s === 'all' || s.includes('everyone')) return 'all';
  if (s.includes('massart')) return 'all-massart';
  if (s.includes('all-students') || s.includes('all students')) return 'all-students';
  if (
    s.includes('all-staff') ||
    s.includes('all staff') ||
    s.includes('faculty/staff') ||
    s.includes('faculty-staff')
  ) {
    return 'all-staff';
  }
  if (s.includes('visitor')) return 'visitor';
  return s;
}

export function deriveRoleFromSectionId(mySectionRaw: unknown): ViewerRole {
  const s = normSection(mySectionRaw);
  if (s === 'visitor') return ROLE.VISITOR;
  if (STUDENT_ID_SET.has(s) || s === 'all-students') return ROLE.STUDENTS;
  if (STAFF_ID_SET.has(s) || s === 'all-staff') return ROLE.STAFF;
  return ROLE.UNKNOWN;
}

// These are the graph scopes where the user's personal dot still makes sense.
function includedScopesForUser(role: ViewerRole, mySectionRaw: unknown): Set<string> {
  const me = normSection(mySectionRaw);

  switch (role) {
    case ROLE.VISITOR:
      return new Set(['all', 'visitor']);
    case ROLE.STUDENTS: {
      const set = new Set(['all-students', 'all-massart', 'all']);
      if (me && !BUCKETS.has(me)) set.add(me);
      return set;
    }
    case ROLE.STAFF: {
      const set = new Set(['all-staff', 'all-massart', 'all']);
      if (me && !BUCKETS.has(me)) set.add(me);
      return set;
    }
    default: {
      const set = new Set(['all-massart', 'all']);
      if (me && !BUCKETS.has(me)) set.add(me);
      return set;
    }
  }
}

export function allowPersonalInSection(
  role: ViewerRole,
  mySectionRaw: unknown,
  sectionRaw: unknown
): boolean {
  const here = normSection(sectionRaw);
  return includedScopesForUser(role, mySectionRaw).has(here);
}
