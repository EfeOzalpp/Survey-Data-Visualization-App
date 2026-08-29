// src/domain/survey/types.ts
// Shared survey row contracts used by the app, browser data services, and server routes.

export interface SurveyWeights {
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  q5?: number;
}

export interface SurveyRow extends SurveyWeights {
  _id: string;
  section: string;
  avgWeight?: number;
  soloMessage?: string;
  submittedAt: string;
}

export interface RawSurveyRow extends SurveyWeights {
  _id: string;
  _type?: "userResponseV4";
  _createdAt?: string;
  _updatedAt?: string;
  section?: string;
  avgWeight?: number;
  soloMessage?: string;
  soloMessageUpdatedAt?: string;
  submittedAt?: string;
}

export type Unsubscribe = () => void;
