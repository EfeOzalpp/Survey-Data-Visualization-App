export interface InfoSlide {
  key: string;
  title: string;
  copy: string[];
}

export interface InfoSlideMedia {
  slideKey: string;
  lightVideoUrl: string;
  lightAlt: string;
  darkVideoUrl: string;
  darkAlt: string;
}

export type InfoSlideMediaMap = Partial<Record<string, InfoSlideMedia>>;

export const INFO_SLIDES: InfoSlide[] = [
  {
    key: "shape-scenery",
    title: "Buttons are your answers",
    copy: ["Each selected answer changes the scene in real time.", "The text inside the buttons defines the type of change."],
  },
  {
    key: "multi-selection",
    title: "Multi-selection",
    copy: ["There are a total of 5 questions.", "You can toggle multiple answer when several options fit."],
  },
  {
    key: "receive-shape",
    title: "Receive your shape",
    copy: ["Your answers are combined into a personalized shape.", "You can also share any message that'd stay with your shape."],
  },
  {
    key: "join-collective",
    title: "Join the collective",
    copy: ["Once finished, your results joins the shared visualizations.", "One example of it is the bar graph widget."],
  },
  {
    key: "shared-patterns",
    title: "Explore shared patterns",
    copy: ["Use tooltips, filters and widgets to see how your responses relate to everyone or specific groups."],
  },
  {
    key: "live-changes",
    title: "Watch the collection grow",
    copy: ["New responses are sreamed, allowing the visualization to keep growing, even when you're idle."],
  },
];

let mediaRequest: Promise<InfoSlideMediaMap> | null = null;

function isMediaRow(value: unknown): value is InfoSlideMedia {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.slideKey === "string" &&
    typeof row.lightVideoUrl === "string" &&
    typeof row.lightAlt === "string" &&
    typeof row.darkVideoUrl === "string" &&
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
