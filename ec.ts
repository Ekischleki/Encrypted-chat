/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Field } from "./field";
import { addMany, Group, isZero, multInt, sub } from "./group";

export type EcPoint<E> =
    | { readonly kind: "point"; readonly x: E; readonly y: E; }
    | { readonly kind: "infinity"; };

export const infinity = <E>(): EcPoint<E> => ({ kind: "infinity" });
export const point = <E>(x: E, y: E): EcPoint<E> => ({ kind: "point", x, y });

export function unwrapPoint<E>(value: EcPoint<E>): readonly [E, E] {
    if (value.kind === "infinity") throw new Error("Point was at infinity");
    return [value.x, value.y];
}

export class EcGroup<E> implements Group<EcPoint<E>> {
    constructor(
        readonly field: Field<E>,
        readonly a: E,
        readonly b: E,
    ) { }

    add(left: EcPoint<E>, right: EcPoint<E>): EcPoint<E> {
        if (left.kind === "infinity") return right;
        if (right.kind === "infinity") return left;

        const { x: x1, y: y1 } = left;
        const { x: x2, y: y2 } = right;
        const dx = sub(this.field, x1, x2);
        const dy = sub(this.field, y1, y2);

        let slope: E;
        if (isZero(this.field, dx)) {
            const ySum = this.field.add(y1, y2);
            if (isZero(this.field, ySum)) return infinity<E>();
            const numerator = this.field.add(
                multInt(this.field, this.field.mult(x1, x1), 3n),
                this.a,
            );
            const inverse = this.field.inv(ySum);
            if (inverse === undefined) throw new Error("Non-invertible denominator in point doubling");
            slope = this.field.mult(numerator, inverse);
        } else {
            const inverse = this.field.inv(dx);
            if (inverse === undefined) throw new Error("Non-invertible denominator in point addition");
            slope = this.field.mult(dy, inverse);
        }

        const xResult = addMany(this.field, [
            this.field.mult(slope, slope),
            this.field.neg(x1),
            this.field.neg(x2),
        ]);
        const yResult = sub(this.field, this.field.mult(slope, sub(this.field, x1, xResult)), y1);
        return point(xResult, yResult);
    }

    neg(value: EcPoint<E>): EcPoint<E> {
        if (value.kind === "infinity") return value;
        return point(value.x, this.field.neg(value.y));
    }

    addIdent(): EcPoint<E> { return infinity<E>(); }

    eq(left: EcPoint<E>, right: EcPoint<E>): boolean {
        if (left.kind === "infinity" || right.kind === "infinity") {
            return left.kind === right.kind;
        }
        return this.field.eq(left.x, right.x) && this.field.eq(left.y, right.y);
    }

    multInt(value: EcPoint<E>, factor: bigint): EcPoint<E> {
        return multInt(this, value, factor);
    }
}
