// src/onboarding/section-picker/sections.ts
// UI-picker-specific rendering types. The canonical section catalog
// (ROLE_SECTIONS, RoleSection) lives in domain/survey/sections.ts.
import type { RoleSection } from '../../domain/survey/sections';

export interface SectionHeader {
  type: 'header';
  id: string;
  label: string;
}

export interface SectionOption extends RoleSection {
  type?: 'option';
}

export type SectionItem = SectionHeader | SectionOption;
