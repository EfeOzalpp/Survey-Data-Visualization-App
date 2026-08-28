import type { Request, Response } from "express";

import { saveSoloMessageRoute } from "../../../routes/saveSoloMessage";
import { saveUserResponseRoute } from "../../../routes/saveUserResponse";
import { openSurveyResponseSse } from "../../../services/surveyResponseSse";
import { SurveyResponseSync } from "../../../services/surveyResponseSync";
import {
  importSanitySurveyResponses,
  parseSanitySurveyResponse,
} from "../importSanitySurveyResponses";
import { closePostgresPool, postgresPool } from "../pool";
import { listenToPostgresSurveyResponses } from "../surveyResponseListener";
import {
  createSurveyResponse,
  fetchSurveyResponsePage,
  findSurveyResponseById,
  updateSurveyResponseSoloMessage,
} from "../surveyResponseRepository";

interface RecordedResponse {
  statusCode: number;
  body: unknown;
  response: Response;
}

const BASE_WEIGHTS = {
  q1: 0.1,
  q2: 0.2,
  q3: 0.3,
  q4: 0.4,
  q5: 0.5,
};

function createInput({
  id,
  submittedAt,
  idempotencyKeySha256,
}: {
  id: string;
  submittedAt: string;
  idempotencyKeySha256: string;
}) {
  return {
    id,
    section: "visitor",
    weights: BASE_WEIGHTS,
    avgWeight: 0.3,
    submittedAt,
    idempotencyKeySha256,
  };
}

function request(body: unknown) {
  return {
    body,
    header: () => undefined,
  } as unknown as Request;
}

function recordedResponse(): RecordedResponse {
  const recorded = {
    statusCode: 200,
    body: undefined as unknown,
  };
  const response = {
    status(statusCode: number) {
      recorded.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      recorded.body = body;
      return response;
    },
  } as unknown as Response;

  return {
    get statusCode() {
      return recorded.statusCode;
    },
    get body() {
      return recorded.body;
    },
    response,
  };
}

async function waitFor(
  predicate: () => boolean,
  description: string,
  timeoutMs = 3_000
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

beforeAll(async () => {
  const database = await postgresPool.query<{ current_database: string }>(
    "SELECT current_database()"
  );
  if (database.rows[0]?.current_database !== "butterfly_effect_test") {
    throw new Error(
      "PostgreSQL integration tests require the isolated butterfly_effect_test database"
    );
  }
});

beforeEach(async () => {
  await postgresPool.query("TRUNCATE TABLE survey_responses");
});

afterAll(async () => {
  await closePostgresPool();
});

test("creates and maps a survey response", async () => {
  const saved = await createSurveyResponse(
    createInput({
      id: "response-1",
      submittedAt: "2026-07-30T12:00:00.000Z",
      idempotencyKeySha256: "a".repeat(64),
    })
  );

  expect(saved).toEqual({
    created: true,
    row: {
      _id: "response-1",
      section: "visitor",
      ...BASE_WEIGHTS,
      avgWeight: 0.3,
      submittedAt: "2026-07-30T12:00:00.000Z",
    },
  });
});

test("returns the original row for a repeated idempotency key", async () => {
  const first = await createSurveyResponse(
    createInput({
      id: "response-original",
      submittedAt: "2026-07-30T12:00:00.000Z",
      idempotencyKeySha256: "b".repeat(64),
    })
  );
  const repeated = await createSurveyResponse(
    createInput({
      id: "response-duplicate",
      submittedAt: "2026-07-30T13:00:00.000Z",
      idempotencyKeySha256: "b".repeat(64),
    })
  );

  const count = await postgresPool.query<{ count: string }>(
    "SELECT count(*) FROM survey_responses"
  );

  expect(first.created).toBe(true);
  expect(repeated.created).toBe(false);
  expect(repeated.row._id).toBe("response-original");
  expect(count.rows[0].count).toBe("1");
});

test("updates and clears a solo message", async () => {
  await createSurveyResponse(
    createInput({
      id: "response-message",
      submittedAt: "2026-07-30T12:00:00.000Z",
      idempotencyKeySha256: "c".repeat(64),
    })
  );

  const withMessage = await updateSurveyResponseSoloMessage(
    "response-message",
    "Hello from PostgreSQL"
  );
  const withoutMessage = await updateSurveyResponseSoloMessage(
    "response-message",
    null
  );

  expect(withMessage?.soloMessage).toBe("Hello from PostgreSQL");
  expect(withoutMessage?.soloMessage).toBeUndefined();
  expect(await findSurveyResponseById("missing-response")).toBeNull();
});

test("paginates newest-first with a stable timestamp and id cursor", async () => {
  await createSurveyResponse(
    createInput({
      id: "response-a",
      submittedAt: "2026-07-30T12:00:00.000Z",
      idempotencyKeySha256: "d".repeat(64),
    })
  );
  await createSurveyResponse(
    createInput({
      id: "response-b",
      submittedAt: "2026-07-30T13:00:00.000Z",
      idempotencyKeySha256: "e".repeat(64),
    })
  );
  await createSurveyResponse(
    createInput({
      id: "response-c",
      submittedAt: "2026-07-30T13:00:00.000Z",
      idempotencyKeySha256: "f".repeat(64),
    })
  );

  const firstPage = await fetchSurveyResponsePage(null, 2);
  const secondPage = await fetchSurveyResponsePage(
    {
      time: firstPage[1].submittedAt,
      id: firstPage[1]._id,
    },
    2
  );

  expect(firstPage.map((row) => row._id)).toEqual([
    "response-c",
    "response-b",
  ]);
  expect(secondPage.map((row) => row._id)).toEqual(["response-a"]);
});

test("persists the existing create and edit route contracts through PostgreSQL", async () => {
  const createResponse = recordedResponse();
  await saveUserResponseRoute(
    request({
      section: "visitor",
      weights: {
        q1: 1,
        q2: 1,
        q3: 0.9,
        q4: 1,
        q5: 1,
      },
      clientId: "client-postgres-route",
      clientRequestId: "request-postgres-create",
      website: "",
    }),
    createResponse.response
  );

  const created = createResponse.body as Record<string, unknown>;
  expect(createResponse.statusCode).toBe(200);
  expect(typeof created._id).toBe("string");
  expect(typeof created.editToken).toBe("string");
  expect(created.section).toBe("visitor");

  const messageResponse = recordedResponse();
  await saveSoloMessageRoute(
    request({
      editToken: created.editToken,
      message: "PostgreSQL route integration",
      clientId: "client-postgres-route",
      clientRequestId: "request-postgres-message",
      website: "",
    }),
    messageResponse.response
  );

  expect(messageResponse.statusCode).toBe(200);
  expect(messageResponse.body).toEqual({
    _id: created._id,
    soloMessage: "PostgreSQL route integration",
  });

  const count = await postgresPool.query<{ count: string }>(
    "SELECT count(*) FROM survey_responses"
  );
  expect(count.rows[0].count).toBe("1");
});

test("delivers each committed row change to two independent worker listeners", async () => {
  function nextUpsert() {
    let resolve!: (id: string) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<string>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });

    return {
      promise,
      onChange: (change: { type: string; row?: { _id: string } }) => {
        if (change.type === "upsert" && change.row) {
          resolve(change.row._id);
        }
      },
      onError: reject,
    };
  }

  const workerA = nextUpsert();
  const workerB = nextUpsert();
  const listenerA = await listenToPostgresSurveyResponses(workerA);
  const listenerB = await listenToPostgresSurveyResponses(workerB);

  try {
    await createSurveyResponse(
      createInput({
        id: "response-cluster-notification",
        submittedAt: "2026-07-30T14:00:00.000Z",
        idempotencyKeySha256: "1".repeat(64),
      })
    );

    await expect(
      Promise.all([workerA.promise, workerB.promise])
    ).resolves.toEqual([
      "response-cluster-notification",
      "response-cluster-notification",
    ]);
  } finally {
    listenerA.unsubscribe();
    listenerB.unsubscribe();
  }
});

test("converts a committed PostgreSQL notification into a coalesced SSE patch", async () => {
  let hasClients = true;
  let snapshotComplete = false;
  let resolvePatch!: (id: string) => void;
  let rejectPatch!: (error: unknown) => void;
  const patchReceived = new Promise<string>((resolve, reject) => {
    resolvePatch = resolve;
    rejectPatch = reject;
  });

  const sync = new SurveyResponseSync({
    hasClients: () => hasClients,
    canPublishPatches: () => snapshotComplete,
    onSnapshotReset: () => {
      snapshotComplete = false;
    },
    onSnapshotPage: () => undefined,
    onSnapshotComplete: () => {
      snapshotComplete = true;
    },
    onUpsert: () => undefined,
    onDelete: () => undefined,
    onPatch: ({ upserts }) => {
      if (upserts[0]) resolvePatch(upserts[0]._id);
    },
    onError: rejectPatch,
  });

  await sync.startListener();
  await sync.ensureSnapshot();

  try {
    await createSurveyResponse(
      createInput({
        id: "response-sync-patch",
        submittedAt: "2026-07-30T15:00:00.000Z",
        idempotencyKeySha256: "2".repeat(64),
      })
    );

    await expect(patchReceived).resolves.toBe("response-sync-patch");
  } finally {
    hasClients = false;
    sync.stopIfIdle();
  }
});

test("writes the initial snapshot and subsequent PostgreSQL patch to an SSE response", async () => {
  const writes: string[] = [];
  const response = {
    status() {
      return response;
    },
    setHeader() {
      return response;
    },
    flushHeaders() {
      return undefined;
    },
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
  } as unknown as Response;

  const cleanup = openSurveyResponseSse({
    section: "all",
    limit: "all",
    res: response,
  });

  try {
    await waitFor(
      () => writes.includes("event: snapshot\n"),
      "the initial SSE snapshot"
    );

    await createSurveyResponse(
      createInput({
        id: "response-live-sse-patch",
        submittedAt: "2026-07-30T16:00:00.000Z",
        idempotencyKeySha256: "3".repeat(64),
      })
    );

    await waitFor(
      () =>
        writes.includes("event: patch\n") &&
        writes.some((chunk) => chunk.includes("response-live-sse-patch")),
      "the live SSE patch"
    );
  } finally {
    cleanup();
  }
});

test("imports Sanity rows idempotently and applies later exported edits", async () => {
  const original = parseSanitySurveyResponse({
    _id: "sanity-import-response",
    _type: "userResponseV4",
    _createdAt: "2026-07-29T12:00:00.000Z",
    _updatedAt: "2026-07-29T12:00:00.000Z",
    section: "visitor",
    ...BASE_WEIGHTS,
    avgWeight: 0.3,
    submittedAt: "2026-07-29T11:59:59.000Z",
  });

  await expect(importSanitySurveyResponses([original])).resolves.toMatchObject({
    inserted: 1,
    updated: 0,
    unchanged: 0,
    verified: 1,
  });
  await expect(importSanitySurveyResponses([original])).resolves.toMatchObject({
    inserted: 0,
    updated: 0,
    unchanged: 1,
    verified: 1,
  });

  const edited = {
    ...original,
    soloMessage: "Imported edit",
    soloMessageUpdatedAt: "2026-07-30T12:00:00.000Z",
    updatedAt: "2026-07-30T12:00:00.000Z",
  };
  await expect(importSanitySurveyResponses([edited])).resolves.toMatchObject({
    inserted: 0,
    updated: 1,
    unchanged: 0,
    verified: 1,
  });
  await expect(findSurveyResponseById(original.id)).resolves.toMatchObject({
    _id: original.id,
    soloMessage: "Imported edit",
  });
});

test("refuses to overwrite a response created by the PostgreSQL API", async () => {
  await createSurveyResponse(
    createInput({
      id: "native-postgres-response",
      submittedAt: "2026-07-30T12:00:00.000Z",
      idempotencyKeySha256: "4".repeat(64),
    })
  );

  const collidingImport = parseSanitySurveyResponse({
    _id: "native-postgres-response",
    _type: "userResponseV4",
    _createdAt: "2026-07-29T12:00:00.000Z",
    _updatedAt: "2026-07-29T12:00:00.000Z",
    section: "visitor",
    ...BASE_WEIGHTS,
    avgWeight: 0.3,
    submittedAt: "2026-07-29T11:59:59.000Z",
  });

  await expect(
    importSanitySurveyResponses([collidingImport])
  ).rejects.toThrow(
    "Refusing to overwrite PostgreSQL-created response native-postgres-response"
  );
});
