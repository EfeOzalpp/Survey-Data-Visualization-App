const FORCE_MOCK_READS = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export const USE_MOCK_READS = FORCE_MOCK_READS;

export function shouldUseMockReads() {
  return FORCE_MOCK_READS;
}
