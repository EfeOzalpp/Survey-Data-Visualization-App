import type { ListenEvent } from "@sanity/client";

import type { RawSurveyRow, SurveyRow } from "../../../domain/survey/types";
import { normalizeSurveyRow } from "../../../domain/survey/normalizeSurveyRow";
import { sanityReadClient } from "./readClient";
import { recordSanityRequest } from "../../load-testing/requestStats"; // load-testing

const PROJECTION = `
  _id, section,
  q1, q2, q3, q4, q5,
  avgWeight,
  soloMessage,
  soloMessageUpdatedAt,
  submittedAt,
  _createdAt
`;

export const LISTEN_FILTER = `!(_id in path("drafts.**")) && _type == "userResponseV4"`;
const SNAPSHOT_PAGE_QUERY = `*[${LISTEN_FILTER} && (
  !defined($cursorTime) ||
  coalesce(submittedAt, _createdAt) < $cursorTime ||
  (coalesce(submittedAt, _createdAt) == $cursorTime && _id < $cursorId)
)] | order(coalesce(submittedAt, _createdAt) desc, _id desc)[0...$limit]{ ${PROJECTION} }`;

export const SNAPSHOT_CHUNK_SIZE = 250;

export interface SnapshotCursor {
  time: string;
  id: string;
}

export async function fetchSnapshotPage(cursor: SnapshotCursor | null): Promise<SurveyRow[]> {
  recordSanityRequest("snapshotFetch"); // load-testing
  const rawRows: RawSurveyRow[] = await sanityReadClient.fetch<RawSurveyRow[]>(SNAPSHOT_PAGE_QUERY, {
    limit: SNAPSHOT_CHUNK_SIZE,
    cursorTime: cursor?.time ?? null,
    cursorId: cursor?.id ?? null,
  });
  return rawRows.map(normalizeSurveyRow);
}

export function listenToSurveyResponses({
  onEvent,
  onError,
}: {
  onEvent: (event: ListenEvent<RawSurveyRow>) => void;
  onError: (error: unknown) => void;
}) {
  recordSanityRequest("listenSubscriptionOpened"); // load-testing
  return sanityReadClient
    .listen<RawSurveyRow>(
      `*[${LISTEN_FILTER}]`,
      {},
      {
        includeResult: true,
        includeMutations: false,
        visibility: "query",
      }
    )
    .subscribe({ next: onEvent, error: onError });
}
