import type { Response } from "express";

import { filterRowsForSection } from "../../domain/survey/sections";
import type { SurveyRow } from "../../domain/survey/types";
import {
  recordSseConnectionClosed,
  recordSseConnectionOpened,
} from "../load-testing/sseConnectionStats"; // load-testing
import type { SurveyResponseLimit } from "./responseStore";
import { serializeSnapshotChunk } from "./snapshotCache";

const HEARTBEAT_MS = 25_000;

export interface StreamClient {
  id: number;
  section: string;
  limit: SurveyResponseLimit;
  res: Response;
  heartbeat: NodeJS.Timeout;
}

export class SseClientHub {
  private nextClientId = 1;
  private readonly clients = new Map<number, StreamClient>();

  constructor(private readonly onBecameIdle: () => void) {}

  get size() {
    return this.clients.size;
  }

  open({
    section,
    limit,
    res,
  }: {
    section: string;
    limit: SurveyResponseLimit;
    res: Response;
  }) {
    const id = this.nextClientId;
    this.nextClientId += 1;

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const client: StreamClient = {
      id,
      section,
      limit,
      res,
      heartbeat: setInterval(() => {
        if (!this.writeComment(client, "heartbeat")) this.remove(id);
      }, HEARTBEAT_MS),
    };

    this.clients.set(id, client);
    recordSseConnectionOpened(); // load-testing
    this.writeComment(client, "connected");
    return client;
  }

  remove(id: number) {
    const client = this.clients.get(id);
    if (!client) return;

    clearInterval(client.heartbeat);
    this.clients.delete(id);
    recordSseConnectionClosed(); // load-testing
    if (this.clients.size === 0) this.onBecameIdle();
  }

  sendSnapshot(client: StreamClient, chunks: string[]) {
    for (const chunk of chunks) {
      if (this.writeRaw(client, "snapshot", chunk)) continue;
      this.remove(client.id);
      return false;
    }
    return true;
  }

  sendError(client: StreamClient, error: unknown) {
    if (this.writeEvent(client, "stream-error", {
      message: error instanceof Error ? error.message : "Survey response stream failed",
    })) {
      return true;
    }

    this.remove(client.id);
    return false;
  }

  broadcastSnapshotPage(
    rows: SurveyRow[],
    {
      reset = false,
      complete = false,
    }: {
      reset?: boolean;
      complete?: boolean;
    } = {}
  ) {
    const serializedBySection = new Map<string, string>();

    for (const client of this.clients.values()) {
      let serialized = serializedBySection.get(client.section);
      if (serialized === undefined) {
        serialized = serializeSnapshotChunk(
          filterRowsForSection(rows, client.section),
          { reset, complete }
        );
        serializedBySection.set(client.section, serialized);
      }
      if (!this.writeRaw(client, "snapshot", serialized)) this.remove(client.id);
    }
  }

  broadcastPatch({
    upserts,
    deletes,
  }: {
    upserts: SurveyRow[];
    deletes: string[];
  }) {
    const serializedBySection = new Map<string, string | null>();

    for (const client of this.clients.values()) {
      let serialized = serializedBySection.get(client.section);
      if (serialized === undefined) {
        const clientUpserts = filterRowsForSection(upserts, client.section);
        if (!clientUpserts.length && !deletes.length) {
          serialized = null;
        } else {
          serialized = JSON.stringify({
            ...(clientUpserts.length ? { upserts: clientUpserts } : {}),
            ...(deletes.length ? { deletes } : {}),
          });
        }
        serializedBySection.set(client.section, serialized);
      }

      if (serialized === null) continue;
      if (!this.writeRaw(client, "patch", serialized)) this.remove(client.id);
    }
  }

  broadcastError(error: unknown) {
    for (const client of this.clients.values()) {
      this.sendError(client, error);
    }
  }

  private writeRaw(client: StreamClient, event: string, dataString: string) {
    try {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${dataString}\n\n`);
      return true;
    } catch (error) {
      console.warn("[surveyResponseStream] failed to write SSE event:", error);
      return false;
    }
  }

  private writeEvent(client: StreamClient, event: string, data: unknown) {
    return this.writeRaw(client, event, JSON.stringify(data));
  }

  private writeComment(client: StreamClient, comment: string) {
    try {
      client.res.write(`: ${comment}\n\n`);
      return true;
    } catch (error) {
      console.warn("[surveyResponseStream] failed to write SSE heartbeat:", error);
      return false;
    }
  }
}
