const storageKey = 'retailtrack-password-reset';
const verifiedLifetime = 15 * 60 * 1000;

/**
 * Progress of a password recovery, kept in sessionStorage so a page reload does not lose it.
 * The one-time code itself is checked by the server; only the email, timing and reset token live here.
 * @typedef {{ email: string, code: string, expiresAt: number, attempts: number, verified: boolean, verifiedAt?: number, resetToken?: string }} PasswordResetFlow
 */

/** @returns {PasswordResetFlow | null} */
export function readPasswordReset() {
    try {
        const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        if (!value || typeof value.email !== 'string') return null;
        return value;
    } catch {
        return null;
    }
}

/** @param {PasswordResetFlow} flow */
export function savePasswordReset(flow) {
    try {
        sessionStorage.setItem(storageKey, JSON.stringify(flow));
    } catch { /* The current page can still complete the recovery flow. */
    }
    return flow;
}

/** @param {PasswordResetFlow | null} flow */
export function isPasswordResetVerified(flow) {
    return Boolean(flow?.verified && flow.resetToken && flow.verifiedAt && Date.now() - flow.verifiedAt < verifiedLifetime);
}

export function clearPasswordReset() {
    try {
        sessionStorage.removeItem(storageKey);
    } catch { /* No persistent cleanup is required when storage is blocked. */
    }
}
