/*
 * Copyright 2020 Andrew Aylett
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { describe, it, jest } from '@jest/globals';
import { SelfThrottle } from 'self-throttle';

import { Attempt, DECLINE, FAIL, SUCCEED, expect } from './expect.js';

const mockNow = jest.fn<() => number>();

type ms = 'ms';
const ms = 'ms';
type MilliSeconds = [number, ms];
let nextMockTime: MilliSeconds = [0, ms];
mockNow.mockImplementation(() => {
    const result = nextMockTime[0];
    nextMockTime[0] += 1;
    return result;
});
const seconds = (s: number) => {
    nextMockTime = [nextMockTime[0] + s * 1000, ms];
};
const setMockTime = (s: number) => {
    nextMockTime = [s * 1000 + (nextMockTime[0] % 1000), ms];
};

const buildPromise = <T>(): [
    Promise<T>,
    (v: T | PromiseLike<T>) => void,
    (reason?: unknown) => void,
] => {
    let resolve: (v: T | PromiseLike<T>) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise<T>((resolve1, reject1) => {
        resolve = resolve1;
        reject = reject1;
    });
    // This is safe because the executor for the promise runs synchronously.
    // But the TS compiler doesn't know that.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore TS2454
    return [promise, resolve, reject];
};

describe('Can initialise', () => {
    it('test matchers', async () => {
        const asyncThrow = async () => {
            throw new Error('foo');
        };

        await expect(asyncThrow()).rejects.toThrow('foo');
    });

    it('is constructable', () => {
        const instance = new SelfThrottle();

        expect(instance).toBeInstanceOf(SelfThrottle);
    });
});

const systemUnderTest = () => new SelfThrottle(mockNow);

describe('Basic event submission', () => {
    it('will count successes', async () => {
        const instance = systemUnderTest();
        await instance.attempt(async () => true);

        expect(instance).toHaveProperty('successes', 1);
    });

    it('will allow an attempt', async () => {
        const instance = systemUnderTest();
        const result = await instance.attempt(async () => true);

        expect(result).toBeTruthy();
    });

    it('will allow more than one request in the first second', async () => {
        const instance = systemUnderTest();
        const one = await instance.attempt(async () => true);
        const two = await instance.attempt(async () => true);

        expect(one).toBeTruthy();
        expect(two).toBeTruthy();
    });
});

describe('Promise Submission', () => {
    it('will count a wrap returning a successful promise', async () => {
        const instance = systemUnderTest();
        const promise = Promise.resolve(true);
        const wrapped = instance.wrap(async (b) => b);
        const result = await wrapped(promise);

        expect(await promise).toBeTruthy();
        expect(result).toBeTruthy();
        expect(instance).toHaveProperty('successes', 1);
    });

    it('counts promises against the tick they started in', async () => {
        const [promise, resolve] = buildPromise<boolean>();
        const instance = systemUnderTest();
        const wrapped = instance.wrap(async (b) => b);
        const returnedPromise = wrapped(promise);

        expect(instance).toHaveProperty('successes', 0);

        seconds(30);
        resolve(true);

        expect(await returnedPromise).toBeTruthy();
        expect(instance).toHaveProperty('successes', 1);

        seconds(30);

        expect(instance).toHaveProperty('successes', 0);
    });
});

describe('Failures', () => {
    it('records synchronous errors', () => {
        const instance = systemUnderTest();
        const error = new Error('expected');
        const wrapped = instance.wrap(() => {
            throw error;
        });

        expect(wrapped).toThrow(error);
        expect(instance).toHaveProperty('successes', 0);
        expect(instance).toHaveProperty('failures', 1);
    });

    it('records asynchronous errors', async () => {
        const instance = systemUnderTest();
        const error = new Error('expected');
        const wrapped = instance.wrap(async () => {
            throw error;
        });

        await expect(wrapped()).rejects.toThrow(error);
        expect(instance).toHaveProperty('successes', 0);
        expect(instance).toHaveProperty('failures', 1);
    });
});

describe('Time', () => {
    it('forgets successes after a minute', () => {
        const instance = systemUnderTest();
        instance.attempt(() => Promise.resolve(true));
        seconds(60);

        expect(instance).toHaveProperty('successes', 0);
    });

    it('remembers successes less than a minute old', async () => {
        const instance = systemUnderTest();
        await instance.attempt(() => Promise.resolve(true));
        seconds(30);
        await instance.attempt(() => Promise.resolve(true));
        seconds(30);

        expect(instance).toHaveProperty('successes', 1);
    });

    it('remembers failures less than a minute old', async () => {
        const instance = systemUnderTest();

        await expect(
            instance.attempt(() => Promise.reject(true)),
        ).rejects.toBeTruthy();

        seconds(30);

        expect(instance).toHaveProperty('failures', 1);
        expect(instance).toHaveProperty('successes', 0);

        await instance.attempt(() => Promise.resolve(true));
        seconds(30);

        expect(instance).toHaveProperty('failures', 0);
        expect(instance).toHaveProperty('successes', 1);
    });

    it('a failure in the first tick means only one attempt in the second', async () => {
        const instance = systemUnderTest();

        await expect(
            instance.attempt(() => Promise.reject(true)),
        ).rejects.toBeTruthy();

        seconds(1);

        await expect(
            instance.attempt(() => Promise.resolve(true)),
        ).resolves.toBeTruthy();
        await expect(
            instance.attempt(() => Promise.resolve(true)),
        ).rejects.toBeTruthy();
        await expect(
            instance.attempt(() => Promise.resolve(true)),
        ).rejects.toBeTruthy();
    });
});

describe('a sequence of successes and failures', () => {
    const instance = systemUnderTest();
    type Test = [number, boolean, Attempt[]];
    const testCase: Test[] = [
        [0, false, [SUCCEED, SUCCEED]],
        [1, false, [SUCCEED, FAIL, SUCCEED]],
        [2, true, [SUCCEED, SUCCEED, SUCCEED, DECLINE]],
        [5, true, [SUCCEED, SUCCEED, SUCCEED, DECLINE]],
        [62, false, [SUCCEED, SUCCEED, SUCCEED, SUCCEED, FAIL]],
        [63, true, [SUCCEED, SUCCEED, SUCCEED, SUCCEED, FAIL, DECLINE]],
        [64, true, [SUCCEED, SUCCEED, SUCCEED, SUCCEED, FAIL, DECLINE]],
        [65, true, [SUCCEED, SUCCEED, SUCCEED, SUCCEED, FAIL, DECLINE]],
        [66, true, [SUCCEED, SUCCEED, SUCCEED, SUCCEED, FAIL, DECLINE]],
        [67, true, [SUCCEED, SUCCEED, SUCCEED, SUCCEED, FAIL, DECLINE]],
        [68, true, [SUCCEED, SUCCEED, SUCCEED, SUCCEED, FAIL, DECLINE]],
        [
            128,
            false,
            [
                SUCCEED,
                SUCCEED,
                SUCCEED,
                SUCCEED,
                FAIL,
                SUCCEED,
                SUCCEED,
                SUCCEED,
                SUCCEED,
            ],
        ],
    ];
    for (const [timestamp, limiting, attempts] of testCase) {
        let j = 0;
        for (const attempt of attempts) {
            ((attempt, caseInTimestamp) => {
                it(`At second ${timestamp}, case ${caseInTimestamp}: ${attempt.toString()}`, async () => {
                    if (caseInTimestamp === 0) {
                        setMockTime(timestamp);
                    }

                    expect(instance).toHaveProperty('isLimiting', limiting);

                    const successes = instance.successes;
                    const failures = instance.failures;

                    await expect(instance).throttlesTo(
                        timestamp,
                        attempt,
                        successes,
                        failures,
                    );
                });
            })(attempt, j);
            j++;
        }
    }
});
