/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Algebraic group interface. Elements are treated as values by convention. */
export interface Group<E> {
    add(a: E, b: E): E;
    neg(a: E): E;
    addIdent(): E;
    eq(a: E, b: E): boolean;
}

export interface Magnitude<E> extends Group<E> {
    measureElemAdd(a: E): bigint;
    groupSize(): bigint;
}

export interface RandomGroup<E> extends Group<E> {
    getRandElem(): E;
    getRandNonZero(): E;
}

export function sub<E>(group: Group<E>, a: E, b: E): E {
    return group.add(a, group.neg(b));
}

export function addMany<E>(group: Group<E>, elements: readonly E[]): E {
    return elements.reduce((acc, value) => group.add(acc, value), group.addIdent());
}

export function isZero<E>(group: Group<E>, value: E): boolean {
    return group.eq(value, group.addIdent());
}

/** Computes fac * g with O(log fac) group additions. fac must be non-negative. */
export function multInt<E>(group: Group<E>, g: E, fac: bigint): E {
    if (fac < 0n) return multInt(group, group.neg(g), -fac);
    let result = group.addIdent();
    let addend = g;
    let n = fac;

    while (n > 0n) {
        if ((n & 1n) === 1n) result = group.add(result, addend);
        n >>= 1n;
        if (n > 0n) addend = group.add(addend, addend);
    }
    return result;
}
