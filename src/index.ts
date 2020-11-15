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
import { Limit, Limited, isLimited, Unlimited } from './limits';

/**
 * A record of what happened during a single tick.
 */
class Bucket {
    tick: number;
    expiry: number;
    successes: number = 0;
    failures: number = 0;
    attempts: number = 0;
    limit: Limit;

    constructor(tick: number, limit: Limit) {
        this.tick = tick;
        this.expiry = tick + 60_000;
        this.limit = limit;
    }

    attempt() {
        this.attempts++;
        return !isLimited(this.limit) || this.attempts <= this.limit.limit;
    }
}

export class SelfThrottleError extends Error {
    constructor() {
        super('Throttled by SelfThrottle');
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

    private limitForNextTick(): Limit {
        if (this._failures() === 0) {
            return Unlimited;
        }
        const maybeLimit = Math.ceil(
            (1.2 * this._successes()) / this.buckets.length,
        );
        const limit = Math.max(1, isNaN(maybeLimit) ? 1 : maybeLimit);
        const rate = this._successes() / this._attempts();
        return Limited({ limit, rate });
    }

    private maybeTick() {
        const now = millisecondTicker();
        const diff = now - this.lastTick;
        if (diff < 1000 && this.buckets.length > 0) {
            // No need to tick, we're still in the same second
            return;
        }
        this.lastTick += diff - (diff % 1000);
        this.buckets = this.buckets.filter(
            bucket => this.lastTick < bucket.expiry,
        );
        this.buckets.unshift(
            new Bucket(this.lastTick, this.limitForNextTick()),
        );
    }

    get isLimiting(): boolean {
        this.maybeTick();
        return isLimited(this.buckets[0].limit);
    }

    /**
     * The number of requests made in the last minute that have successfully returned.
     */
    get successes(): number {
        this.maybeTick();
        return this._successes();
    }

    private _successes() {
        return this.buckets.reduce((prev, cur) => prev + cur.successes, 0);
    }

    private _attempts() {
        return this.buckets.reduce((prev, cur) => prev + cur.attempts, 0);
    }

    /**
     * The number of requests made in the last minute that have returned with an error.
     */
    get failures(): number {
        this.maybeTick();
        return this._failures();
    }

    private _failures() {
        return this.buckets.reduce((prev, cur) => prev + cur.failures, 0);
    }

    /**
     * If we're not limiting or have not reached our limit, executes the function and returns the promise it returns.
     * @param f A promise generator
     */
    attempt<T>(f: () => Promise<T>): Promise<T> {
        return this.wrap(f)();
    }

    /**
     * Wraps the provided function so it will be throttled if it fails.
     * @param f The function to be wrapped
     */
    wrap<F extends (...args: P) => Promise<T>, T, P extends any[]>(f: F): F {
        return ((...p: P): Promise<T> => {
            this.maybeTick();
            const bucket = this.buckets[0];
            if (bucket.attempt()) {
                try {
                    const promise = f(...p);
                    Promise.resolve(promise).then(
                        () => bucket.successes++,
                        () => bucket.failures++,
                    );
                    return promise;
                } catch (e) {
                    bucket.failures++;
                    throw e;
                }
            }
            return Promise.reject(new SelfThrottleError());
        }) as F;
    }
}
