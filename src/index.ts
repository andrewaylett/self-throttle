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

import { millisecondTicker } from './time';

class Bucket {
    tick: number;
    expiry: number;
    count: number = 0;

    constructor(tick: number) {
        this.tick = tick;
        this.expiry = tick + 60_000;
    }
}

export class SelfThrottle {
    buckets: Bucket[];
    lastTick: number = millisecondTicker();

    constructor() {
        this.buckets = [new Bucket(this.lastTick)];
    }

    maybeTick() {
        const now = millisecondTicker();
        const diff = now - this.lastTick;
        if (diff < 1000) {
            // No need to tick, we're still in the same second
            return;
        }
        this.lastTick += diff - (diff % 1000);
        this.buckets.unshift(new Bucket(this.lastTick));
        this.buckets = this.buckets.filter(
            bucket => this.lastTick < bucket.expiry,
        );
    }

    recordSuccess() {
        this.maybeTick();
        this.buckets[0].count += 1;
    }

    get successes(): number {
        this.maybeTick();
        return this.buckets.reduce((prev, cur) => prev + cur.count, 0);
    }

    async registerAttempt() {
        this.maybeTick();
        return true;
    }

    async registerPromise<T>(promise: Promise<T>): Promise<T> {
        this.maybeTick();
        const result = await promise;
        this.recordSuccess();
        return result;
    }
}
