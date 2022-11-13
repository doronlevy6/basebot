import * as niceware from 'niceware';

const passphraseBytes = 12;
const passphraseSize = passphraseBytes / 2;
const passphraseDelimiter = '-';
const passphrasePrefix = 'gistauth-';

export const generatePassphrase = (): string => {
  // This will generate a passphrase with {{passphraseBytes}} bytes, which should be a {{passphraseSize}} word passphrase
  // niceware package does not have types so we're explicitly casting to string[]
  const uniquePhrase = (
    niceware.generatePassphrase(passphraseBytes) as string[]
  ).join(passphraseDelimiter);
  return `${passphrasePrefix}${uniquePhrase}`;
};

export const isPassphraseMessage = (text: string): boolean | 'too_short' => {
  const normalized = text.trim();

  if (!normalized.includes(passphraseDelimiter)) {
    return false;
  }

  if (!normalized.startsWith(passphrasePrefix)) {
    return false;
  }

  const passphrase = extractUniquePhrase(normalized);
  if (passphrase.split(passphraseDelimiter).length !== passphraseSize) {
    return 'too_short';
  }

  return true;
};

const extractUniquePhrase = (text: string): string => {
  const normalized = text.trim();
  const passphrase = normalized.replace(passphrasePrefix, '');
  return passphrase;
};
