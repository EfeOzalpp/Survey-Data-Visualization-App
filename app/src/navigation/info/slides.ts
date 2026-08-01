export interface InfoSlide {
  key: string;
  title: string;
  copy: string;
}

export interface InfoSlideMedia {
  slideKey: string;
  lightGifUrl: string;
  darkGifUrl: string;
  alt: string;
}

export type InfoSlideMediaMap = Partial<Record<string, InfoSlideMedia>>;

export const INFO_SLIDES: InfoSlide[] = [
  {
    key: "shape-scenery",
    title: "Shape the scenery",
    copy: "Your survey choices change the city scene as you answer, turning each response into a visible part of the environment.",
  },
  {
    key: "five-questions",
    title: "Answer five questions",
    copy: "Each question captures a different part of your experience. You can select more than one answer when several options fit.",
  },
  {
    key: "receive-shape",
    title: "Receive your shape",
    copy: "Your answers are combined into a personalized shape drawn with the same Canvas2D scene system used throughout the survey.",
  },
  {
    key: "join-collective",
    title: "Join the collective",
    copy: "After submission, your shape joins the shared Three.js visualization alongside responses from previous participants.",
  },
  {
    key: "shared-patterns",
    title: "Explore shared patterns",
    copy: "Use roles, sections, charts, and comparisons to examine how your response relates to different groups in the collective data.",
  },
  {
    key: "live-changes",
    title: "Watch the picture change",
    copy: "New and edited responses arrive through the live stream, allowing the logs, counts, and collective visualization to keep growing.",
  },
];

let mediaRequest: Promise<InfoSlideMediaMap> | null = null;

function isMediaRow(value: unknown): value is InfoSlideMedia {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.slideKey === "string" &&
    typeof row.lightGifUrl === "string" &&
    typeof row.darkGifUrl === "string" &&
    typeof row.alt === "string";
}

async function fetchInfoSlideMedia() {
  const response = await fetch("/api/product-tour-media", {
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch((): unknown => ({})) as unknown;

  if (!response.ok) {
    throw new Error(`Product tour media API failed with status ${String(response.status)}`);
  }

  if (!body || typeof body !== "object") {
    throw new Error("Product tour media API returned an invalid response");
  }

  const media = (body as Record<string, unknown>).media;
  if (!Array.isArray(media) || !media.every(isMediaRow)) {
    throw new Error("Product tour media API returned invalid media rows");
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
