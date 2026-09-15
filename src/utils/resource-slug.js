export const getResourceSlug = (value) =>
  value
    .toLowerCase()
    .replaceAll("???", "blue-baby")
    .replace("&", "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
