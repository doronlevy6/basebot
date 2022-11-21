export const splitTextBlocks = (text: string) => {
  const MAX_SLACK_BLOCK_CHARACTERS = 3000;
  if (text.length <= MAX_SLACK_BLOCK_CHARACTERS) {
    return [text];
  }

  const parts: string[] = [];
  const lines = text.split('\n');

  let part = '';
  lines.forEach((line) => {
    if (part.length > 2000) {
      parts.push(`${part}`);
      part = '';
    }
    part = `${part}${line}\n`;
  });
  parts.push(part);

  return parts;
};

// TODO: The following utils are problematic and we should avoid using them.
// We are currently adding them only to be able to do testing on our internal workspace
// because the data in our internal workspace has been very corrupted, and to be able
// to test some of our extra models on an external workspace where there is good data.
export const isBaseTeamWorkspace = (teamId: string): boolean => {
  return teamId === 'T02G37MUWJ1';
};

export const isItayOnLenny = (userId: string, teamId: string): boolean => {
  return teamId === 'T013K620LTW' && userId === 'U02AKBYHV7V';
};
