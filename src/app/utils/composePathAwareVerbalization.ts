import { Pair } from "../hooks/types";

export function composePathAwareVerbalization(
  pair: Pair | null,
  visiblePaths: ReadonlySet<string>
): string {
  if (!pair) return "";

  const pairExplanation = pair.verbalization?.trim() ?? "";
  const selectedPaths = pair.paths.filter((path) => visiblePaths.has(path.id));

  if (selectedPaths.length === 0) {
    return [pairExplanation, "No path-level evidence is currently selected."]
      .filter(Boolean)
      .join(" ");
  }

  const selectedEvidence = selectedPaths
    .map(
      (path) =>
        path.verbalization?.trim()
        || "No path-level verbalization is available."
    )
    .join(" ");

  return [pairExplanation, selectedEvidence].filter(Boolean).join(" ");
}
