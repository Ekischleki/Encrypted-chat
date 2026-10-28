/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Group, multInt } from "./group";

export interface Ring<E> extends Group<E> {
    mult(a: E, b: E): E;
    multIdent(): E;
}

/** Exponentiation by squaring. For exponent 0, returns the multiplicative identity. */
export function powInt<E>(ring: Ring<E>, value: E, exponent: bigint): E {
    if (exponent < 0n) throw new RangeError("Exponent must be non-negative");
    let result = ring.multIdent();
    let factor = value;
    let n = exponent;

    while (n > 0n) {
        if ((n & 1n) === 1n) result = ring.mult(result, factor);
        n >>= 1n;
        if (n > 0n) factor = ring.mult(factor, factor);
    }
    return result;
}

// Retained as a small convenience for code ported from the original trait extension.
export function scalarMultiple<E>(ring: Ring<E>, value: E, factor: bigint): E {
    return multInt(ring, value, factor);
}
