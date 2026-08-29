// src/domain/survey/sections.ts
// Canonical section catalog and section-filtering logic, shared by onboarding,
// the backend, and graph filtering/scoping. This is the single source of
// truth for "what sections exist" - onboarding/section-picker/sections.ts
// only adds UI-picker-specific rendering types on top of ROLE_SECTIONS below.

export interface RoleSection {
  value: string;
  label: string;
  aliases?: string[];
}

interface RoleSectionCatalog {
  student: RoleSection[];
  staff: RoleSection[];
}

// The pickable catalog shown in the onboarding section picker.
export const ROLE_SECTIONS: RoleSectionCatalog = {
  student: [
    { value: '3d-arts', label: '3D Arts' },
    { value: 'animation', label: 'Animation' },
    { value: 'architecture', label: 'Architecture' },
    { value: 'art-education', label: 'Art Education' },
    { value: 'ceramics', label: 'Ceramics' },
    { value: 'communication-design', label: 'Communication Design', aliases: ['comdes', 'cd'] },
    { value: 'creative-writing', label: 'Creative Writing' },
    { value: 'design-innovation', label: 'Design Innovation', aliases: ['mdes'] },
    { value: 'digital-media', label: 'Digital Media', aliases: ['dm'] },
    { value: 'dynamic-media-institute', label: 'Dynamic Media Institute', aliases: ['dmi'] },
    { value: 'fashion-design', label: 'Fashion Design', aliases: ['fd'] },
    { value: 'fibers', label: 'Fibers' },
    { value: 'film-video', label: 'Film/Video', aliases: ['film'] },
    { value: 'fine-arts-2d', label: 'Fine Arts 2D', aliases: ['fa2d'] },
    { value: 'furniture-design', label: 'Furniture Design' },
    { value: 'glass', label: 'Glass' },
    { value: 'history-of-art', label: 'History of Art', aliases: ['hoa'] },
    { value: 'humanities', label: 'Humanities' },
    { value: 'illustration', label: 'Illustration', aliases: ['ill'] },
    { value: 'industrial-design', label: 'Industrial Design', aliases: ['id'] },
    { value: 'integrative-sciences', label: 'Integrative Sciences & Biological Arts', aliases: ['isba'] },
    { value: 'jewelry-metalsmithing', label: 'Jewelry & Metalsmithing' },
    { value: 'liberal-arts', label: 'Liberal Arts', aliases: ['la'] },
    { value: 'mfa-low-residency', label: 'MFA Low Residency', aliases: ['mfa-lr'] },
    { value: 'mfa-low-residency-foundation', label: 'MFA Low Residency | Studio Foundation', aliases: ['mfa-lr-sf'] },
    { value: 'mfa-studio-arts', label: 'MFA Studio Arts | Fine Arts 2D', aliases: ['mfa-2d'] },
    { value: 'painting', label: 'Painting' },
    { value: 'photography', label: 'Photography', aliases: ['photo'] },
    { value: 'printmaking', label: 'Printmaking' },
    { value: 'sculpture', label: 'Sculpture' },
    { value: 'studio-arts', label: 'Studio Arts' },
    { value: 'studio-interrelated-media', label: 'Studio for Interrelated Media', aliases: ['sim'] },
    { value: 'studio-foundation', label: 'Studio Foundation', aliases: ['sf'] },
    { value: 'visual-storytelling', label: 'Visual Storytelling & Comic Arts', aliases: ['vs'] },
  ],
  staff: [
    { value: 'academic-affairs', label: 'Academic Affairs', aliases: ['aa'] },
    { value: 'academic-resource-center', label: 'Academic Resource Center', aliases: ['arc'] },
    { value: 'administration-finance', label: 'Administration & Finance' },
    { value: 'administrative-services', label: 'Administrative Services' },
    { value: 'admissions', label: 'Admissions' },
    { value: 'artward-bound', label: 'Artward Bound' },
    { value: 'bookstore', label: 'Bookstore' },
    { value: 'bursar', label: "Bursar's Office" },
    { value: 'career-development', label: 'Career Development', aliases: ['career'] },
    { value: 'center-art-community', label: 'Center for Art & Community Partnerships', aliases: ['cacp'] },
    { value: 'community-health', label: 'Community Health & Well-being' },
    { value: 'compass', label: 'Compass' },
    { value: 'conference-event-services', label: 'Conference & Event Services' },
    { value: 'counseling-center', label: 'Counseling Center' },
    { value: 'facilities', label: 'Facilities' },
    { value: 'fiscal-accounting', label: 'Fiscal Affairs / Accounting Services' },
    { value: 'fiscal-budget', label: 'Fiscal Affairs / Budget Office' },
    { value: 'graduate-programs', label: 'Graduate Programs' },
    { value: 'health-office', label: 'Health Office' },
    { value: 'housing-residence-life', label: 'Housing & Residence Life', aliases: ['housing'] },
    { value: 'human-resources', label: 'Human Resources', aliases: ['hr'] },
    { value: 'kennedy-cafeteria', label: 'Kennedy Cafeteria', aliases: ['food'] },
    { value: 'institutional-advancement', label: 'Institutional Advancement' },
    { value: 'institutional-research', label: 'Institutional Research & Strategic Effectiveness' },
    { value: 'international-education', label: 'International Education Center' },
    { value: 'justice-equity', label: 'Justice, Equity, & Transformation', aliases: ['jet'] },
    { value: 'library', label: 'Library' },
    { value: 'marketing-communications', label: 'Marketing & Communications', aliases: ['marcom'] },
    { value: 'maam', label: 'MassArt Art Museum', aliases: ['maam'] },
    { value: 'foundation', label: 'MassArt Foundation' },
    { value: 'president-office', label: "President's Office" },
    { value: 'pce', label: 'Professional & Continuing Education', aliases: ['pce'] },
    { value: 'public-safety', label: 'Public Safety' },
    { value: 'registrar', label: "Registrar's Office" },
    { value: 'student-development', label: 'Student Development' },
    { value: 'student-engagement', label: 'Student Engagement' },
    { value: 'student-financial-assistance', label: 'Student Financial Assistance' },
    { value: 'sustainability', label: 'Sustainability' },
    { value: 'technology', label: 'Technology', aliases: ['it'] },
    { value: 'woodshop', label: 'Woodshop' },
    { value: 'youth-programs', label: 'Youth Programs' },
  ],
};

// Broader/legacy student section values that predate the current granular
// picker - not offered as picker options, but kept here so any older stored
// rows using them still count correctly toward student/MassArt aggregates.
const LEGACY_STUDENT_SECTION_IDS = ['fine-arts', 'design', 'foundations'];

export const STUDENT_IDS = [...ROLE_SECTIONS.student.map((s) => s.value), ...LEGACY_STUDENT_SECTION_IDS];
export const STAFF_IDS = ROLE_SECTIONS.staff.map((s) => s.value);

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
