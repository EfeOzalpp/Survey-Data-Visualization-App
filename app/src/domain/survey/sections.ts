export const STUDENT_IDS = [
  '3d-arts','animation','architecture','art-education','ceramics',
  'communication-design','creative-writing','design-innovation','digital-media',
  'dynamic-media-institute','fashion-design','fibers','film-video','fine-arts-2d',
  'furniture-design','glass','history-of-art','humanities','illustration',
  'industrial-design','integrative-sciences','jewelry-metalsmithing','liberal-arts',
  'mfa-low-residency','mfa-low-residency-foundation','mfa-studio-arts',
  'painting','photography','printmaking','sculpture','studio-arts',
  'studio-interrelated-media','studio-foundation','visual-storytelling',
  'fine-arts','design','foundations'
];

export const STAFF_IDS = [
  'academic-affairs','academic-resource-center','administration-finance',
  'administrative-services','admissions','artward-bound','bookstore','bursar',
  'career-development','center-art-community','community-health','compass',
  'conference-event-services','counseling-center','facilities','fiscal-accounting',
  'fiscal-budget','graduate-programs','health-office','housing-residence-life',
  'human-resources','institutional-advancement','institutional-research',
  'international-education','justice-equity','library','marketing-communications',
  'maam','foundation','president-office','pce','public-safety','registrar',
  'student-development','student-engagement','student-financial-assistance',
  'sustainability','technology','woodshop','youth-programs'
];

export const NON_VISITOR_MASSART = Array.from(new Set([...STUDENT_IDS, ...STAFF_IDS]));

const STUDENT_ID_SET = new Set(STUDENT_IDS);
const STAFF_ID_SET = new Set(STAFF_IDS);
const NON_VISITOR_MASSART_SET = new Set(NON_VISITOR_MASSART);

export function parentAggregateForSection(section: string) {
  if (STUDENT_ID_SET.has(section)) return 'all-students';
  if (STAFF_ID_SET.has(section)) return 'all-staff';
  return null;
}

export const AGGREGATE_SECTIONS = new Set(['all', 'all-massart', 'all-students', 'all-staff']);

export const ALLOWED_SECTIONS = new Set<string>([
  'visitor',
  ...AGGREGATE_SECTIONS,
  ...STUDENT_IDS,
  ...STAFF_IDS,
]);

export function filterRowsForSection<T extends { section: string }>(rows: T[], section: string): T[] {
  if (!section || section === 'all') return rows;
  if (section === 'all-massart') return rows.filter((row) => NON_VISITOR_MASSART_SET.has(row.section));
  if (section === 'all-students') return rows.filter((row) => STUDENT_ID_SET.has(row.section));
  if (section === 'all-staff') return rows.filter((row) => STAFF_ID_SET.has(row.section));
  return rows.filter((row) => row.section === section);
}
