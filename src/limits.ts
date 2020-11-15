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

enum Limits {
    Limited,
    Unlimited,
}

type Unlimited = {
    readonly _tag: Limits.Unlimited;
};
type Limited = {
    readonly _tag: Limits.Limited;
    readonly limit: number;
    readonly rate: number;
};

export type Limit = Unlimited | Limited;

export const Unlimited: Limit = { _tag: Limits.Unlimited };
export const Limited: (input: { limit: number; rate: number }) => Limit = ({
    limit,
    rate,
}) => ({
    _tag: Limits.Limited,
    limit,
    rate,
});

export const isLimited = (x: Limit): x is Limited => x._tag === Limits.Limited;
