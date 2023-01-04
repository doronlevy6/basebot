export const calculateUserDefaultHour = (
  offset: number,
  hour: number,
): number => {
  const date = new Date();
  date.setUTCHours(hour, 0, 0);
  let defaultHour = date.getUTCHours() - Math.floor(offset / 3600);
  defaultHour = defaultHour % 24;
  if (defaultHour < 0) {
    defaultHour = 24 + defaultHour;
  }

  return defaultHour;
};
