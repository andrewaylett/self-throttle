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
        const result = await instance.registerAttempt();
        expect(result).toBeTruthy();
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
});
