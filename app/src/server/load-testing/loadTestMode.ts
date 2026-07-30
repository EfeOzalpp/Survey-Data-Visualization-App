// load-testing: single flag gating everything in this folder. 
// Unset in real production env
// Set LOAD_TEST_MODE=true only in the local k6/Docker run.
export const LOAD_TEST_MODE = process.env.LOAD_TEST_MODE === "true";
