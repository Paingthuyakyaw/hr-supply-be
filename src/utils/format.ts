export const formatCode = (prefix: string, value: Number) =>
  `${prefix}-${String(value).padStart(3, "0")}`;
