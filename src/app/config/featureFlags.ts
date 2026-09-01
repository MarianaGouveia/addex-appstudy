/**
 * Application feature switches.
 *
 * Set a feature to `false` to remove its controls, content, and related hover
 * interactions from the UI. Restart the development server after changing a
 * value if the update is not picked up automatically.
 */
export const featureFlags = {
  colorChange: false,
  showIC: false,
  graphSetting: false,
  exportContent: false,
  /** Send pseudonymous study interaction events to the configured log store. */
  logs: true,
  /** Read the participant's Google Form ID from the study link. */
  forms: true,
} as const;

export type FeatureName = keyof typeof featureFlags;
