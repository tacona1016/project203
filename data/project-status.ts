export type ProjectStatus = {
  phase: string;
  /** Agreed current objective; null means it has not yet been set. */
  goal: string | null;
  nextAction: string;
  /** Confirmed update date in YYYY-MM-DD format. */
  updatedAt: string;
  /** Existing internal pages only; add links after an actual discussion. */
  relatedLinks?: readonly { label: string; href: string }[];
};

// Replace null only after the project has agreed its stage, next action and date.
// Do not infer an actual project status from presentation examples or today's date.
export const projectStatus: ProjectStatus | null = null;
