/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LOGGER } from ".";
import { unwrapPoint } from "./ec";
import { Curve, PrivateKey, PublicKey } from "./ecc";
import { encryptedStore } from "./encryptedStore";
import { KeyExchangeModal } from "./modals";
import { settings } from "./settings";
import { hash, IV_LEN, stringToUint8 } from "./utils";
import { openModal } from "@utils/modal";

export const CHECKSUM_LEN = 8; // Ought to be enuf

function bytesToBigInt(bytes: Uint8Array): bigint {
    let result = 0n;

    for (const byte of bytes) {
        result = (result << 8n) | BigInt(byte);
    }

    return result;
}

async function derivePrivateScalar(
    keyMaterial: CryptoKey,
    salt: Uint8Array,
    curve: Curve,
    context: string,
): Promise<bigint> {
    const encoder = new TextEncoder();

    for (let counter = 0; counter < 256; counter++) {
        const info = encoder.encode(
            `${context}:secp256k1-private-key:${counter}`,
        );

        const bits = await crypto.subtle.deriveBits(
            {
                name: "HKDF",
                hash: "SHA-256",
                salt: salt as BufferSource,
                info,
            },
            keyMaterial,
            256,
        );

        const d = bytesToBigInt(new Uint8Array(bits));

        if (d > 0n && d < curve.n) {
            return d;
        }
    }

    throw new Error("Failed to derive a valid private scalar");
}

// derives a key from a string using PBKDF2. A salt can be passed or else it is automatically generated.
export async function deriveEncryptionKeys(keyMaterial: string, saltArr?: Uint8Array, iterations: number = 10_000) {
    const SALT_LEN = 16;
    const passwordArr = stringToUint8(keyMaterial);
    const salt: Uint8Array = saltArr ?? crypto.getRandomValues(new Uint8Array(SALT_LEN)); // generates a salt if one has not been passed
    const key = await crypto.subtle.importKey(
        "raw",
        passwordArr,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            salt: salt as BufferSource,
            iterations: iterations
        },
        key,
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
    return { derivedKey, salt };
}

export async function deriveMasterKey(password: string, saltArr?: Uint8Array, iterations: number = 400_000) {
    const { derivedKey, salt } = (await deriveEncryptionKeys(password, saltArr, iterations));

    const masterKeyBits = await crypto.subtle.exportKey("raw", derivedKey);

    const masterKey = await crypto.subtle.importKey(
        "raw",
        masterKeyBits,
        { name: "HKDF" },
        false,
        ["deriveBits", "deriveKey"]
    );
    return { derivedKey: masterKey, keyBits: masterKeyBits };
}


// the decrypt and encrypt functions (self explanatory). String -> uint8array -> encrypted uint8array -> base64 string and vice versa

export async function decrypt(messageBytes: Uint8Array<ArrayBuffer>, key: CryptoKey, iv: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        messageBytes
    );
    return new Uint8Array(decrypted);
}

export async function encrypt(message: string, key: CryptoKey) {
    const messageBytes = new TextEncoder().encode(message);
    const iv = await crypto.getRandomValues(new Uint8Array(IV_LEN));

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        messageBytes
    );

    return { encrypted: encrypted, iv: iv };
}

export async function decrypt_key(messageBytes: Uint8Array<ArrayBuffer>, key: CryptoKey, iv: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        messageBytes
    );
    return new Uint8Array(decrypted);
}

export async function encrypt_key(bytes: Uint8Array<ArrayBuffer>, key: CryptoKey) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        bytes
    );

    return { encrypted: encrypted, iv: iv };
}

// gets the key for the channel the user is currently on.

export async function getPrivateEcdhChannelKey(channel_id: string): Promise<PrivateKey> {
    return PrivateKey.fromPriv(Curve.secp256k1(), await derivePrivateScalar(encryptedStore.master_key, stringToUint8(channel_id), Curve.secp256k1(), "channel-ecdh-key"));
}

export async function getChannelKey(channel_id: string): Promise<CryptoKey> {
    if (!encryptedStore.isInit()) {
        encryptedStore.user_prompt_store();
        throw "Encrypted store not initialized";
    }
    const proxyKey = settings.store.knownPublicKeys[channel_id]; // called proxyKey because settings.store returns a gawddam proxy
    if (proxyKey == undefined) {
        openModal(props => (<KeyExchangeModal rootProps={props} />));
        throw "Public key not known";
    }
    const otherPublicKey = PublicKey.fromCompressedSecp256k1(proxyKey);
    const ownPrivateKey = await getPrivateEcdhChannelKey(channel_id);
    const sharedPoint = ownPrivateKey.ecdh(otherPublicKey);
    const sharedSecret = unwrapPoint(sharedPoint)[0].toString(16) + ", " + unwrapPoint(sharedPoint)[1].toString(16);
    LOGGER.log(sharedSecret);
    return (await deriveEncryptionKeys(sharedSecret, new Uint8Array(0))).derivedKey;
}

export async function createChecksum(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    return (await hash(bytes)).slice(0, CHECKSUM_LEN);
}
