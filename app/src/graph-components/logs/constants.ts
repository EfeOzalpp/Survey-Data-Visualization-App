export type SortKey = "time" | "average" | "rank" | "q1" | "q2" | "q3" | "q4" | "q5";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "time", label: "Latest" },
  { key: "average", label: "Average" },
  { key: "rank", label: "Rank" },
  { key: "q1", label: "Question 1" },
  { key: "q2", label: "Question 2" },
  { key: "q3", label: "Question 3" },
  { key: "q4", label: "Question 4" },
  { key: "q5", label: "Question 5" },
];

export const PAGE_SIZE = 50;

export const SECTION_DISPLAY: Record<string, string> = {
  visitor: 'Explorer',
};
