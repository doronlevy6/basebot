export const pluralString = (
  count: number,
  singular: string,
  plural?: string,
): string => {
  if (count <= 0) {
    return '';
  }
  if (count === 1) {
    return `1 ${singular}`;
  }
  return plural ? `${count} ${plural}` : `${count} ${singular}s`;
};
