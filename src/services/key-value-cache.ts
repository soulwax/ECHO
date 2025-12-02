// File: src/services/key-value-cache.ts

import { injectable } from 'inversify';
import { prisma } from '../utils/db.js';
import { MIN_CACHE_KEY_LENGTH } from '../utils/constants.js';
import debug from '../utils/debug.js';

type Seconds = number;

type Options = {
  expiresIn: Seconds;
  key?: string;
};

type FunctionArgs = unknown[];

const futureTimeToDate = (time: Seconds) => new Date(new Date().getTime() + (time * 1000));

/**
 * Key-value cache provider for caching function results
 */
@injectable()
export default class KeyValueCacheProvider {
  /**
   * Wraps a function with caching logic
   * @param func - The function to cache
   * @param options - Cache options including expiration and optional key
   * @returns The cached or newly computed result
   */
  async wrap<F extends (...args: FunctionArgs) => Promise<unknown>, R = Awaited<ReturnType<F>>>(
    func: F,
    ...options: [...Parameters<F>, Options]
  ): Promise<R> {
    if (options.length === 0) {
      throw new Error('Missing cache options');
    }

    const functionArgs = options.slice(0, options.length - 1);

    const {
      key = JSON.stringify(functionArgs),
      expiresIn,
    } = options[options.length - 1] as Options;

    if (key.length < MIN_CACHE_KEY_LENGTH) {
      throw new Error(`Cache key ${key} is too short. Minimum length is ${MIN_CACHE_KEY_LENGTH}.`);
    }

    const cachedResult = await prisma.keyValueCache.findUnique({
      where: {
        key,
      },
    });

    if (cachedResult) {
      if (new Date() < cachedResult.expiresAt) {
        debug(`Cache hit: ${key}`);
        return JSON.parse(cachedResult.value) as R;
      }

      await prisma.keyValueCache.delete({
        where: {
          key,
        },
      });
    }

    debug(`Cache miss: ${key}`);

    const result = await func(...(functionArgs as Parameters<F>)) as R;

    // Save result
    const value = JSON.stringify(result);
    const expiresAt = futureTimeToDate(expiresIn);
    await prisma.keyValueCache.upsert({
      where: {
        key,
      },
      update: {
        value,
        expiresAt,
      },
      create: {
        key,
        value,
        expiresAt,
      },
    });

    return result as R;
  }
}
