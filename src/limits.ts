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

class Unlimited {
    readonly isLimited: false = false;
}
class Limited {
    constructor(limit: number, rate: number) {
        this.limit = limit;
        this.rate = rate;
    }
    readonly isLimited: true = true;
    readonly limit: number;
    readonly rate: number;
}

export type Limit = Unlimited | Limited;
// eslint-disable-next-line no-redeclare
export const Limit = {
    unlimited: new Unlimited(),
    limited: ({ limit, rate }: { limit: number; rate: number }) =>
        new Limited(limit, rate),
};
