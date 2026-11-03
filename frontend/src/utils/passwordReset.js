import {generateOtp} from './credentials.js';

const storageKey = 'retailtrack-password-reset';
const codeLifetime = 10 * 60 * 1000;
const verifiedLifetime = 15 * 60 * 1000;

/**
 * @typedef {{ email: string, code: string, expiresAt: number, attempts: number, verified: boolean, verifiedAt?: number }} PasswordResetFlow
 */

/** @returns {PasswordResetFlow | null} */
export function readPasswordReset() {
    try {
        const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        if (!value || typeof value.email !== 'string' || typeof value.code !== 'string') return null;
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

/** @param {string} email */
export function createPasswordReset(email) {
    return savePasswordReset({
        email: email.trim().toLowerCase(),
        code: generateOtp(),
        expiresAt: Date.now() + codeLifetime,
        attempts: 0,
        verified: false,
    });
}

/**
 * @param {PasswordResetFlow} flow
 * @param {string} code
 */
export function verifyPasswordReset(flow, code) {
    if (Date.now() >= flow.expiresAt) return {
        ok: false,
        flow,
        message: 'This verification code has expired. Request a new code.'
    };
    if (flow.attempts >= 5) return {ok: false, flow, message: 'Too many incorrect attempts. Request a new code.'};
    if (flow.code !== code) {
        const next = savePasswordReset({...flow, attempts: flow.attempts + 1});
        const remaining = Math.max(0, 5 - next.attempts);
        return {
            ok: false,
            flow: next,
            message: remaining ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Too many incorrect attempts. Request a new code.'
        };
    }
    const next = savePasswordReset({...flow, verified: true, verifiedAt: Date.now(), attempts: 0});
    return {ok: true, flow: next, message: ''};
}

/** @param {PasswordResetFlow | null} flow */
export function isPasswordResetVerified(flow) {
    return Boolean(flow?.verified && flow.verifiedAt && Date.now() - flow.verifiedAt < verifiedLifetime);
}

export function clearPasswordReset() {
    try {
        sessionStorage.removeItem(storageKey);
    } catch { /* No persistent cleanup is required when storage is blocked. */
    }
}