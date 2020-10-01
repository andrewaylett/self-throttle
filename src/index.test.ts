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

import 'jest';
import { SelfThrottle } from './index';
import { millisecondTicker } from './time';
import assert from 'assert';

jest.mock('./time');
const mockMillisecondTicker = millisecondTicker as jest.Mock<
    ReturnType<typeof millisecondTicker>
>;

type ms = 'ms';
const ms = 'ms'; // eslint-disable-line no-redeclare
type MilliSeconds = [number, ms];
let nextMockTime: MilliSeconds = [0, ms];
mockMillisecondTicker.mockImplementation(() => {
    const result = nextMockTime[0];
    nextMockTime[0] += 1;
    return result;
});
const seconds = (s: number) => {
    nextMockTime = [nextMockTime[0] + s * 1000, ms];
};

const buildPromise = <T>(): [
    Promise<T>,
    (v: T | PromiseLike<T> | undefined) => void,
    (reason?: any) => void,
] => {
    let resolve: (v: T | PromiseLike<T> | undefined) => void;
    let reject: (reason?: any) => void;
    const promise = new Promise<T>((resolve1, reject1) => {
        resolve = resolve1;
        reject = reject1;
    });
    // @ts-ignore
    // noinspection JSUnusedAssignment
    return [promise, resolve, reject];
};

describe('Can initialise', () => {
    it('is constructable', () => {
        const instance = new SelfThrottle();
        expect(instance).toBeInstanceOf(SelfThrottle);
    });
});

const systemUnderTest = () => new SelfThrottle();

describe('Basic event submission', () => {
    it('will count successes', () => {
        const instance = systemUnderTest();
        instance.recordSuccess();
        expect(instance).toHaveProperty('successes', 1);
    });

    it('will allow an attempt', async () => {
        const instance = systemUnderTest();
        const result = instance.registerAttempt();
        expect(result).toBeTruthy();
    });

    it('will allow more than one request in the first second', async () => {
        const instance = systemUnderTest();
        const one = instance.registerAttempt();
        const two = instance.registerAttempt();
        expect(one).toBeTruthy();
        expect(two).toBeTruthy();
    });
});

describe('Promise Submission', () => {
    it('will count a successful promise', async () => {
        const instance = systemUnderTest();
        const promise = Promise.resolve(true);
        const result = await instance.registerPromise(promise);
        expect(await promise).toBeTruthy();
        expect(result).toBeTruthy();
        expect(instance).toHaveProperty('successes', 1);
    });

    it('counts promises against the tick they started in', async () => {
        const [promise, resolve] = buildPromise<boolean>();
        const instance = systemUnderTest();
        const returnedPromise = instance.registerPromise(promise);
        expect(instance).toHaveProperty('successes', 0);
        seconds(30);
        resolve(true);
        expect(await returnedPromise).toBeTruthy();
        expect(instance).toHaveProperty('successes', 1);
        seconds(30);
        expect(instance).toHaveProperty('successes', 0);
    });
});

describe('Time', () => {
    it('forgets successes after a minute', () => {
        const instance = systemUnderTest();
        instance.recordSuccess();
        seconds(60);
        expect(instance).toHaveProperty('successes', 0);
    });

    it('remembers successes less than a minute old', () => {
        const instance = systemUnderTest();
        instance.recordSuccess();
        seconds(30);
        instance.recordSuccess();
        seconds(30);
        expect(instance).toHaveProperty('successes', 1);
    });

    it('a failure in the first tick means only one attempt in the second', async () => {
        const instance = systemUnderTest();
        assert(instance.registerAttempt());
        instance.recordFailure();
        seconds(1);
        const one = instance.registerAttempt();
        const two = instance.registerAttempt();
        const three = instance.registerAttempt();
        expect(one).toBeTruthy();
        expect(two).toBeFalsy();
        expect(three).toBeFalsy();
    });
});
