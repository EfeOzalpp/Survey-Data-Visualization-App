import type { SurveyRow } from "../../../domain/survey/types";

export const SURVEY_RESPONSE_CHUNK_SIZE = 250;

export interface SurveyResponseCursor {
  time: string;
  id: string;
}

export type SurveyResponseChange =
  | { type: "upsert"; row: SurveyRow }
  | { type: "delete"; id: string };

export interface SurveyResponseSubscription {
  unsubscribe: () => void;
}
