/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Ring } from "./ring";

export interface Field<E> extends Ring<E> {
    /** Returns the multiplicative inverse, or undefined if it does not exist. */
    inv(value: E): E | undefined;
}
