/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Divider } from "@components/Divider";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { openModal } from "@utils/modal";
import { Alerts, UserStore } from "@webpack/common";

import { deriveEncryptionKeys, deriveMasterKey } from "./cryptoFunctions";
import { MasterPasswordModal } from "./modals";
import { settings } from "./settings";
import { base64ToUint8, hash, KEY_PREFIX, uint8ArraysEqual, uint8ToBase64 } from "./utils";

// =======================================================================================
// I KNOW IT SAYS GRONK BUT THIS IS ALL LEAHS CODE. IT JUST BLAMES ME BECAUSE I MERGED IT.
// =======================================================================================

function MasterPasswordStatusAlert(enabled: boolean) {
    const enabledMessage = "You can now use cryptographic features!";
    const disabledMessage = "The master password you entered was incorrect. Cryptographic features will be disabled until you enter the correct one.";
    const message = (enabled) ? enabledMessage : disabledMessage;
    Alerts.show({
        title: `Master Password ${(enabled) ? "Correct" : "Incorrect"}`,
        body: <>
            <Divider className={Margins.bottom16} />
            <Paragraph>
                {message}
            </Paragraph>
        </>,
        confirmText: (enabled) ? "Yippe!" : "Zamn ):"
    });
}

// A wrapper around localStorage providing encryption using a master password
export class EncryptedStore {
    keyPrefix: string = "";
    // We cant init in the constructor since it can't be async, so we assume a user will call the init function
    master_key: CryptoKey = undefined as unknown as CryptoKey;


    is_init: boolean = false;

    // we need a separate thing for locally stored things we dont wanna sync
    public isInit(): boolean {
        return this.is_init;
    }

    // Initializes the Encrypted store. Returns true if the master password was correct or if the master password hasn't been set yet.
    public async init(master_password: string, uuid: string): Promise<boolean> {
        // Using uuid as salt is good at masking the master pass, while also being easily syncable between devices
        const known_salt = base64ToUint8(uuid);


        // derives the master key with the given master password and the salt
        const { derivedKey, keyBits } = await deriveMasterKey(master_password, known_salt);

        // exports the master key to a plain uint8
        const derivedKeyBytes = new Uint8Array(keyBits);
        const derived_key_hash = await hash(derivedKeyBytes); // hashes the exported key to match the check
        const stored_key_hash = settings.store.masterPassChecksum;
        if (stored_key_hash) { // if a password hash is stored
            const match_stored_key_hash = base64ToUint8(stored_key_hash); // sets the hash to a uint8 to check
            if (match_stored_key_hash) { // not sure why we need this, if it's faulty somehow?
                if (!uint8ArraysEqual(match_stored_key_hash, derived_key_hash)) {
                    // matches the hashed master key that we just derived and the stored key hash
                    return false;
                }
            }
        }

        settings.store.masterPassChecksum = uint8ToBase64(derived_key_hash);
        this.master_key = derivedKey;
        this.is_init = true;
        return true;
    }

    public user_prompt_store(): boolean {
        if (this.isInit()) { // this is unnecessary because this can only be called if isInit returns false
            return true;
        }

        openModal(props => (
            <MasterPasswordModal rootProps={props} on_confirm={(password, p) => {
                p.onClose();
                this.init(password, UserStore.getCurrentUser().id).then(success => {
                    MasterPasswordStatusAlert(success);
                });
            }} />
        ));
        return false;
    }
}


export const encryptedStore = new EncryptedStore();
