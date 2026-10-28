/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EcGroup, type EcPoint, point, unwrapPoint } from "./ec";
import { multInt } from "./group";
import { mod, NatModField } from "./nat_field";

const SECP256K1_P = fromHex(
    "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F",
);

function fromHex(hex: string): bigint {
    return BigInt(`0x${hex}`);
}

function toHex(value: bigint): string {
    return value.toString(16).padStart(64, "0");
}

export class Curve {
    readonly ec: EcGroup<bigint>;
    readonly generator: EcPoint<bigint>;
    readonly n: bigint;

    constructor(ec: EcGroup<bigint>, generator: EcPoint<bigint>, n: bigint) {
        this.ec = ec;
        this.generator = generator;
        this.n = n;
    }

    static secp256k1(): Curve {
        const field = new NatModField(SECP256K1_P);
        const ec = new EcGroup(field, 0n, 7n);
        const generator = point(
            fromHex("79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798"),
            fromHex("483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8"),
        );
        return new Curve(
            ec,
            generator,
            fromHex("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"),
        );
    }
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = 1n;
    base = mod(base, modulus);

    while (exponent > 0n) {
        if ((exponent & 1n) === 1n) {
            result = (result * base) % modulus;
        }
        base = (base * base) % modulus;
        exponent >>= 1n;
    }

    return result;
}

export class PublicKey {
    constructor(readonly curve: Curve, readonly point: EcPoint<bigint>) { }

    toString(): string {
        const [x, y] = unwrapPoint(this.point);
        return `${toHex(x)},${toHex(y)}`;
    }

    toCompressed(): string {
        const [x, y] = unwrapPoint(this.point);

        const prefix = (y & 1n) === 0n ? "02" : "03";

        return prefix + toHex(x);
    }

    static fromCompressedSecp256k1(
        compressed: string,
    ): PublicKey {
        const curve = Curve.secp256k1();
        if (!/^(02|03)[0-9a-fA-F]{64}$/.test(compressed)) {
            throw new Error("Invalid compressed public key format");
        }

        const prefix = compressed.slice(0, 2);
        const x = BigInt("0x" + compressed.slice(2));
        const p = SECP256K1_P;

        if (x >= p) {
            throw new Error("Invalid public key: x is out of range");
        }

        // y² = x³ + 7 (mod p)
        const ySquared = mod(
            x * x % p * x + 7n,
            p,
        );

        // Since p % 4 === 3, sqrt(ySquared) = ySquared^((p+1)/4) mod p.

        let y = modPow(ySquared, (p + 1n) / 4n, p);

        // Reject x values that do not correspond to a curve point.
        if (mod(y * y, p) !== ySquared) {
            throw new Error("Invalid compressed public key: point is not on the curve");
        }

        // Select the root whose parity matches the prefix.
        const shouldBeOdd = prefix === "03";

        if ((y & 1n) === 1n !== shouldBeOdd) {
            y = p - y;
        }

        return new PublicKey(curve, point(x, y));
    }
}

export class PrivateKey {
    constructor(readonly curve: Curve, readonly d: bigint) {
        if (d <= 0n || d >= curve.n) {
            throw new RangeError("Private key must be in the range [1, n - 1]");
        }
    }
    /*
        sign(z: bigint): readonly [bigint, bigint] {
            // Random ECDSA nonce; not deterministic and not a production-hardened signer.
            const k = randomBigIntBelow(this.curve.n - 1n) + 1n;
            const rPoint = multInt(this.curve.ec, this.curve.generator, k);
            if (rPoint.kind === "infinity") throw new Error("Unexpected point at infinity");
            const r = rPoint.x % this.curve.n;
            const kInverse = modInverse(k, this.curve.n);
            if (kInverse === undefined) throw new Error("Nonce has no inverse");
            const s = mod(kInverse * (z + r * this.d), this.curve.n);
            return [r, s];
        }
    */
    toPub(): PublicKey {
        return new PublicKey(this.curve, multInt(this.curve.ec, this.curve.generator, this.d));
    }

    ecdh(other: PublicKey): EcPoint<bigint> {
        if (other.curve !== this.curve && other.curve.n !== this.curve.n) {
            throw new Error("Cannot perform ECDH across different curves");
        }
        return multInt(this.curve.ec, other.point, this.d);
    }


    static fromPriv(curve: Curve, d: bigint): PrivateKey {
        return new PrivateKey(curve, d);
    }


}
