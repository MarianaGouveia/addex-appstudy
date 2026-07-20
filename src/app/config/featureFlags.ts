/**
 * Application feature switches.
 *
 * Set a feature to `false` to remove its controls, content, and related hover
 * interactions from the UI. Restart the development server after changing a
 * value if the update is not picked up automatically.
 */
export const featureFlags = {
  colorChange: false,
  exportContent: false,
  showIC: false,
  graphSetting: false,
} as const;

export type FeatureName = keyof typeof featureFlags;
