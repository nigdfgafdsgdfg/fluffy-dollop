export function resolveImageUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  if (objectPath.startsWith("http")) return objectPath;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return null;
  const clean = objectPath.startsWith("/") ? objectPath.slice(1) : objectPath;
  return `https://${domain}/api/storage/${clean}`;
}
