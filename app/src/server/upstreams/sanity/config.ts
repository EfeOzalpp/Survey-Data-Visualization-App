import { optionalEnv } from "../../env";
import { LOAD_TEST_MODE } from "../../load-testing/loadTestMode"; // load-testing

export const SANITY_PROJECT_ID = optionalEnv("SANITY_PROJECT_ID", "2dnm6wwp");
// load-testing: defaults to the disposable dataset whenever LOAD_TEST_MODE is
// on, so forgetting SANITY_DATASET can't silently point k6 writes at production.
export const SANITY_DATASET = optionalEnv("SANITY_DATASET", LOAD_TEST_MODE ? "load-test" : "butterfly-habits");
