import { createClient } from "@sanity/client";
import { optionalEnv } from "../../env";
import { SANITY_DATASET, SANITY_PROJECT_ID } from "./config";

const readToken = optionalEnv("SANITY_READ", optionalEnv("SANITY_READ_TOKEN", ""));

export const sanityReadClient = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: optionalEnv("SANITY_API_VERSION", "2022-03-07"),
  useCdn: false,
  ...(readToken ? { token: readToken } : {}),
});
