export interface InfoSlide {
  key: string;
  title: string;
  copy: string[];
}

export interface InfoSlideMedia {
  slideKey: string;
  lightVideoUrl: string;
  lightVideoMp4Url: string;
  lightAlt: string;
  darkVideoUrl: string;
  darkVideoMp4Url: string;
  darkAlt: string;
}

export type InfoSlideMediaMap = Partial<Record<string, InfoSlideMedia>>;

export const INFO_SLIDES: InfoSlide[] = [
  {
    key: "shape-scenery",
    title: "First, a short survey",
    copy: ["Click on a button to answer.", " There are only 5 questions, and they're just the beginning."],
  },
  {
    key: "multi-selection",
    title: "Toggle more buttons",
    copy: ["You may multi-select when several options fit.", " The button text determines the kind of change."],
  },
  {
    key: "receive-shape",
    title: "Receive your shape",
    copy: ["Your answers are combined into a personalized shape.", " You can also share any message that'd stay with your shape."],
  },
  {
    key: "join-collective",
    title: "Join the collective",
    copy: ["Once finished, your results join the shared visualizations.", " One example of it is the bar graph widget."],
  },
  {
    key: "shared-patterns",
    title: "Explore shared patterns",
    copy: ["Use tooltips, filters, and widgets to compare your responses against everyone, or specific groups."],
  },
  {
    key: "live-changes",
    title: "Watch the world grow",
    copy: ["New responses are streamed so each update is live instantly, even when you're idle."],
  },
];

let mediaRequest: Promise<InfoSlideMediaMap> | null = null;

function isMediaRow(value: unknown): value is InfoSlideMedia {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.slideKey === "string" &&
    typeof row.lightVideoUrl === "string" &&
    typeof row.lightVideoMp4Url === "string" &&
    typeof row.lightAlt === "string" &&
    typeof row.darkVideoUrl === "string" &&
    typeof row.darkVideoMp4Url === "string" &&
    typeof row.darkAlt === "string";
}

async function fetchInfoSlideMedia() {
  const response = await fetch("/api/info-media", {
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch((): unknown => ({})) as unknown;

  if (!response.ok) {
    throw new Error(`Info media API failed with status ${String(response.status)}`);
  }

  if (!body || typeof body !== "object") {
    throw new Error("Info media API returned an invalid response");
  }

  const media = (body as Record<string, unknown>).media;
  if (!Array.isArray(media) || !media.every(isMediaRow)) {
    throw new Error("Info media API returned invalid media rows");
  }

  return Object.fromEntries(media.map((row) => [row.slideKey, row]));
}

export function readInfoSlideMedia() {
  mediaRequest ??= fetchInfoSlideMedia().catch((error: unknown) => {
    mediaRequest = null;
    throw error;
  });
  return mediaRequest;
}
