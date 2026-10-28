/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Field } from "./field";
import type { Magnitude } from "./group";

function gcd(a: bigint, b: bigint): bigint {
    while (b !== 0n) [a, b] = [b, a % b];
    return a < 0n ? -a : a;
}

function mod(value: bigint, modulus: bigint): bigint {
    const result = value % modulus;
    return result < 0n ? result + modulus : result;
}

function modInverse(value: bigint, modulus: bigint): bigint | undefined {
    let oldR = mod(value, modulus), r = modulus;
    let oldS = 1n, s = 0n;

    while (r !== 0n) {
        const q = oldR / r;
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return oldR === 1n ? mod(oldS, modulus) : undefined;
}

/** Integers modulo `size`. This is a field only when size is prime. */
export class NatModField implements Field<bigint>, Magnitude<bigint> {
    readonly size: bigint;

    constructor(size: bigint) {
        if (size < 2n) throw new RangeError("Size of NatModField needs to be at least 2");
        this.size = size;
    }

    add(a: bigint, b: bigint): bigint { return mod(a + b, this.size); }
    neg(a: bigint): bigint { return mod(-a, this.size); }
    addIdent(): bigint { return 0n; }
    eq(a: bigint, b: bigint): boolean { return mod(a, this.size) === mod(b, this.size); }
    mult(a: bigint, b: bigint): bigint { return mod(a * b, this.size); }
    multIdent(): bigint { return 1n; }
    inv(a: bigint): bigint | undefined { return modInverse(a, this.size); }

    measureElemAdd(a: bigint): bigint {
        return this.size / gcd(this.size, mod(a, this.size));
    }

    groupSize(): bigint { return this.size; }
}


export { gcd, mod, modInverse };
