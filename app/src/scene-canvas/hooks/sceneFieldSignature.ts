import type { Place } from "../grid-layout/occupancy";
import type { SceneLookupKey } from "../scene-rules/lookup";

function reservedFootprintsKey(reservedFootprints: Place[] | undefined) {
  if (!reservedFootprints?.length) return "";
  return reservedFootprints
    .map((footprint) =>
      [footprint.r0, footprint.c0, footprint.w, footprint.h].map((value) => String(value)).join(",")
    )
    .join(";");
}

export function fieldAppearSignature(args: {
  hostId: string;
  sceneLookupKey: SceneLookupKey;
  spotlightIndex?: number;
  reservedFootprints: Place[] | undefined;
}) {
  return [
    args.hostId,
    args.sceneLookupKey,
    String(args.spotlightIndex ?? ""),
    reservedFootprintsKey(args.reservedFootprints),
  ].join("|");
}

