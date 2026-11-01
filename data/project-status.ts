export type ProjectStatus = {
  phase: string;
  nextAction: string;
  /** Confirmed update date in YYYY-MM-DD format. */
  updatedAt: string;
};

// Replace null only after the project has agreed its stage, next action and date.
// Do not infer an actual project status from presentation examples or today's date.
export const projectStatus: ProjectStatus | null = null;
