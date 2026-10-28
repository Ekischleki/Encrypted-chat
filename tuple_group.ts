/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Group, Magnitude } from "./group";
import type { Ring } from "./ring";

export type Pair<L, R> = readonly [L, R];

export class TupleAlgebra<L, R> implements Group<Pair<L, R>> {
    constructor(private readonly left: Group<L>, private readonly right: Group<R>) { }

    add(a: Pair<L, R>, b: Pair<L, R>): Pair<L, R> {
        return [this.left.add(a[0], b[0]), this.right.add(a[1], b[1])];
    }

    neg(a: Pair<L, R>): Pair<L, R> {
        return [this.left.neg(a[0]), this.right.neg(a[1])];
    }

    addIdent(): Pair<L, R> {
        return [this.left.addIdent(), this.right.addIdent()];
    }

    eq(a: Pair<L, R>, b: Pair<L, R>): boolean {
        return this.left.eq(a[0], b[0]) && this.right.eq(a[1], b[1]);
    }
}

export class TupleRing<L, R> extends TupleAlgebra<L, R> implements Ring<Pair<L, R>> {
    constructor(private readonly leftRing: Ring<L>, private readonly rightRing: Ring<R>) {
        super(leftRing, rightRing);
    }

    mult(a: Pair<L, R>, b: Pair<L, R>): Pair<L, R> {
        return [this.leftRing.mult(a[0], b[0]), this.rightRing.mult(a[1], b[1])];
    }

    multIdent(): Pair<L, R> {
        return [this.leftRing.multIdent(), this.rightRing.multIdent()];
    }
}

export class TupleMagnitude<L, R> extends TupleAlgebra<L, R> implements Magnitude<Pair<L, R>> {
    constructor(private readonly leftMagnitude: Magnitude<L>, private readonly rightMagnitude: Magnitude<R>) {
        super(leftMagnitude, rightMagnitude);
    }

    measureElemAdd(a: Pair<L, R>): bigint {
        return lcm(this.leftMagnitude.measureElemAdd(a[0]), this.rightMagnitude.measureElemAdd(a[1]));
    }

    groupSize(): bigint {
        return this.leftMagnitude.groupSize() * this.rightMagnitude.groupSize();
    }
}

function gcd(a: bigint, b: bigint): bigint {
    while (b !== 0n) [a, b] = [b, a % b];
    return a < 0n ? -a : a;
}

function lcm(a: bigint, b: bigint): bigint {
    return a === 0n || b === 0n ? 0n : (a / gcd(a, b)) * b;
}
