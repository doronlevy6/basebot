import { customAlphabet } from 'nanoid';
import { customAlphabet as customAlphabetAsync } from 'nanoid/async';

/**
 * We use nanoid in order to create IDs with enough uniqueness.
 * We want things to be semi-pretty, so we are generating with a custom
 * alphabet that includes numbers and only lowercase letters, with 21 characters of entropy.
 * According to the collision calculator, this means that if we are generating 1000 IDs per second,
 * it will take about 355 million years in order to have a 1% probability of a collision.
 * Let's see if this is true.
 */
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 21);
const nanoidAsync = customAlphabetAsync(alphabet, 21);

/**
 * This is a blocking call that triggers a collection of random bytes from
 * the CPU. It can cause a slowdown in requests due to its blocking nature.
 * In order to avoid creating a slowdown and a blocking call, use the
 * `generateIDAsync` function instead.
 * @returns A randomly generated ID string that conforms to our alphabet
 */
export const generateID = (): string => {
  return nanoid();
};

/**
 * This is a non-blocking call that triggers a collection of random bytes from
 * the CPU. In order to avoid blocking the CPU, this creates a Promise that will
 * asynchronously call the CPU in order to generate the random bytes.
 * @returns A Promise that resolves to a randomly generated ID string that conforms to our alphabet
 */
export const generateIDAsync = async (): Promise<string> => {
  return nanoidAsync();
};
