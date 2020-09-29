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

class Bucket {
    count: number = 0;
}

export class SelfThrottle {
    buckets: Bucket[];
    constructor() {
        this.buckets = [new Bucket()];
    }

    recordSuccess() {
        this.buckets[0].count += 1;
    }

    get successes(): number {
        return this.buckets[0].count;
    }

    async registerAttempt() {
        return true;
    }

    async registerPromise<T>(promise: Promise<T>): Promise<T> {
        const result = await promise;
        this.recordSuccess();
        return result;
    }
}
