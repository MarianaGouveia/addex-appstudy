const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const normalizedBasePath = configuredBasePath
  ? `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`
  : "";

export function publicAssetPath(relativePath: string) {
  return `${normalizedBasePath}/${relativePath.replace(/^\/+/, "")}`;
}

export function toPublicDataSegment(value: string) {
  return value.trim().replace(/[^A-Za-z0-9_]/g, "_");
}
