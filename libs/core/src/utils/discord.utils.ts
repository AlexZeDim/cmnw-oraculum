import { randomInt } from 'crypto';
import { DateTime } from 'luxon';
import { setTimeout } from 'node:timers/promises';

/**
 * @description Gives a random int number in-between requested values
 */
export const cryptoRandomIntBetween = (
  min = 0,
  max = 100,
  divider?: number | undefined,
) => (divider ? randomInt(min, max + 1) / divider : randomInt(min, max + 1));

export const formatRedisKey = (key: string, formatter = 'PEPA') =>
  `${formatter}:${key}`;

export const isDurationNotPass = (sinceDate: Date, unitNumber = 6) => {
  const now = DateTime.now();
  const time = DateTime.fromJSDate(sinceDate);
  const diff = time.diff(now, 'hours').toObject();
  return diff.hours < unitNumber;
};

export const waitForDelay = async (seconds: number) =>
  await setTimeout(seconds * 1000);

export const operationStatus = (isNew: boolean) =>
  isNew ? 'created' : 'updated';

export const now = () => DateTime.now().setZone('Europe/Moscow').toJSDate();
