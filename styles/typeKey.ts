export function normalizeNodeType(type?: string) {
  return (type || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
