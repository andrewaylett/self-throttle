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

/**
 * A record of what happened during a single tick.
 */
class Bucket {
    tick: number;
    expiry: number;
    successes: number = 0;
    failures: number = 0;
    attempts: number = 0;
    limit: number;
    limiting: boolean;

    constructor(tick: number, limit: [number, boolean]) {
        this.tick = tick;
        this.expiry = tick + 60_000;
        this.limit = limit[0];
        this.limiting = limit[1];
    }

    try() {
        if (!this.limiting || this.attempts < this.limit) {
            this.attempts++;
            return true;
        }
        return false;
    }
}

/**
 * Allows clients to avoid overwhelming services with requests they can be
 * confident the service won't successfully respond to.
 *
 * If we see _x_ successful requests per second over the previous minute,
 * along with some errors, we shouldn't expect all more than _x_ requests to
 * succeed in the next minute.
 *
 * If we've not seen any failures, we shouldn't throttle at all.
 */
export class SelfThrottle {
    private buckets: Bucket[];
    private lastTick: number = 0;

    constructor() {
        this.buckets = [];
    }

    private limitForNextTick(): [number, boolean] {
        if (this._failures() == 0) {
            return [-1, false];
        }
        const computedLimit = Math.ceil(
            (1.2 * this._successes()) / this.buckets.length,
        );
        return [Math.max(1, isNaN(computedLimit) ? 1 : computedLimit), true];
    }

    private maybeTick() {
        const now = millisecondTicker();
        const diff = now - this.lastTick;
        if (diff < 1000 && this.buckets.length > 0) {
            // No need to tick, we're still in the same second
            return;
        }
        this.lastTick += diff - (diff % 1000);
        this.buckets.unshift(
            new Bucket(this.lastTick, this.limitForNextTick()),
        );
        this.buckets = this.buckets.filter(
            bucket => this.lastTick < bucket.expiry,
        );
    }

    recordSuccess() {
        this.maybeTick();
        this.buckets[0].successes += 1;
    }

    recordFailure() {
        this.maybeTick();
        this.buckets[0].failures += 1;
    }

    get successes(): number {
        this.maybeTick();
        return this._successes();
    }

    private _successes() {
        return this.buckets.reduce((prev, cur) => prev + cur.successes, 0);
    }

    get failures(): number {
        this.maybeTick();
        return this._failures();
    }

    private _failures() {
        return this.buckets.reduce((prev, cur) => prev + cur.failures, 0);
    }

    registerAttempt() {
        this.maybeTick();
        return this.buckets[0].try();
    }

    attempt(callback: (success: () => void, failure: () => void) => void) {
        this.maybeTick();
        const bucket = this.buckets[0];
        bucket.attempts++;
        callback(
            () => {
                bucket.successes++;
            },
            () => {
                bucket.failures++;
            },
        );
    }

    async registerPromise<T>(promise: Promise<T>): Promise<T> {
        this.maybeTick();
        const bucket = this.buckets[0];
        const result = await promise;
        bucket.successes++;
        return result;
    }
}
