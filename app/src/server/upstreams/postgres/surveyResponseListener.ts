import { Client, type Notification } from "pg";

import type {
  SurveyResponseChange,
  SurveyResponseSubscription,
} from "./surveyResponseTypes";
import { POSTGRES_CONFIG } from "./config";
import {
  postgresRecordToSurveyRow,
  type PostgresSurveyResponseRecord,
} from "./surveyResponseRepository";

const SURVEY_RESPONSE_CHANGE_CHANNEL = "survey_response_changes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseChangePayload(payload: string): SurveyResponseChange {
  const parsed: unknown = JSON.parse(payload);
  if (!isRecord(parsed)) {
    throw new Error("PostgreSQL survey-response notification is not an object");
  }

  if (parsed.operation === "delete" && typeof parsed.id === "string") {
    return { type: "delete", id: parsed.id };
  }

  if (parsed.operation === "upsert" && isRecord(parsed.row)) {
    return {
      type: "upsert",
      row: postgresRecordToSurveyRow(
        parsed.row as unknown as PostgresSurveyResponseRecord
      ),
    };
  }

  throw new Error("PostgreSQL survey-response notification is invalid");
}

export async function listenToPostgresSurveyResponses({
  onChange,
  onError,
}: {
  onChange: (change: SurveyResponseChange) => void;
  onError: (error: unknown) => void;
}): Promise<SurveyResponseSubscription> {
  const client = new Client({
    connectionString: POSTGRES_CONFIG.connectionString,
    connectionTimeoutMillis: POSTGRES_CONFIG.connectionTimeoutMillis,
    application_name: "butterfly-effect-survey-change-listener",
  });
  let closed = false;
  let reportedConnectionFailure = false;

  const reportConnectionFailure = (error: unknown) => {
    if (closed || reportedConnectionFailure) return;
    reportedConnectionFailure = true;
    onError(error);
  };

  const handleNotification = (notification: Notification) => {
    if (
      closed ||
      notification.channel !== SURVEY_RESPONSE_CHANGE_CHANNEL ||
      !notification.payload
    ) {
      return;
    }

    try {
      onChange(parseChangePayload(notification.payload));
    } catch (error) {
      onError(error);
    }
  };

  client.on("notification", handleNotification);
  client.on("error", reportConnectionFailure);
  client.on("end", () => {
    reportConnectionFailure(
      new Error("PostgreSQL survey-response listener disconnected")
    );
  });

  await client.connect();
  await client.query(`LISTEN ${SURVEY_RESPONSE_CHANGE_CHANNEL}`);

  return {
    unsubscribe: () => {
      if (closed) return;
      closed = true;
      client.removeListener("notification", handleNotification);
      void client.end().catch(() => undefined);
    },
  };
}
