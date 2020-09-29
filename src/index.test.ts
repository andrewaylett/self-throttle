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

import { SelfThrottle } from './index';

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
        const instance = new SelfThrottle();
        const result = await instance.registerAttempt();
        expect(result).toBeTruthy();
    });
});

describe('Promise Submission', () => {
    it('will count a successful promise', async () => {
        const instance = new SelfThrottle();
        const promise = Promise.resolve(true);
        const result = await instance.registerPromise(promise);
        expect(await promise).toBeTruthy();
        expect(result).toBeTruthy();
        expect(instance).toHaveProperty('successes', 1);
    });
});
