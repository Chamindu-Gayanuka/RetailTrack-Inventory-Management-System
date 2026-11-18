/**
 * Thin client for the RetailTrack REST API.
 *
 * The base URL comes from VITE_API_URL (see .env.example) and defaults to the local backend.
 */

// Must be written exactly as import.meta.env.VITE_API_URL: Vite substitutes only that expression at build time.
export const API_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

const TOKEN_KEY = 'retailtrack-token';

export class ApiError extends Error {
    /**
     * @param {string} message
     * @param {number} status
     * @param {Record<string, string[]> | undefined} [errors]
     */
    constructor(message, status, errors) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.errors = errors;
    }
}

/** @returns {string | null} */
export function getToken() {
    try {
        return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

/**
 * @param {string | null} token
 * @param {boolean} [remember] keep the token across browser restarts
 */
export function setToken(token, remember = true) {
    try {
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_KEY);
        if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch { /* The token stays in memory for this page when storage is blocked. */
    }
    memoryToken = token;
}

/** @type {string | null} */
let memoryToken = null;
/** @type {null | (() => void)} */
let unauthorizedHandler = null;

/** Called when the server rejects the stored token (expired, user disabled, password changed). */
export function onUnauthorized(/** @type {null | (() => void)} */ handler) {
    unauthorizedHandler = handler;
}

/**
 * @param {string} method
 * @param {string} path  e.g. "/products"
 * @param {unknown} [body]
 * @param {{ auth?: boolean, query?: Record<string, string | number | undefined> }} [options]
 * @returns {Promise<any>} the full response envelope ({success, data, message, meta})
 */
export async function request(method, path, body, options = {}) {
    const {auth = true, query} = options;
    const url = new URL(`${API_URL}${path}`, window.location.origin);
    if (query) for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') url.searchParams.set(key, String(value));

    /** @type {Record<string, string>} */
    const headers = {Accept: 'application/json'};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = auth ? (getToken() || memoryToken) : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
        response = await fetch(url, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)});
    } catch {
        throw new ApiError('Cannot reach the RetailTrack server. Check that the backend is running.', 0);
    }

    const text = await response.text();
    /** @type {any} */
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch { /* Non-JSON bodies are treated as empty. */
    }

    if (!response.ok || (json && json.success === false)) {
        if (response.status === 401 && auth && token && unauthorizedHandler) unauthorizedHandler();
        const errors = json?.errors;
        const firstFieldError = errors ? Object.values(errors).flat()[0] : undefined;
        // "Validation failed." alone is not helpful; show what exactly was wrong when the server says so.
        const generic = !json?.message || /^validation failed\.?$/i.test(json.message);
        const message = generic && typeof firstFieldError === 'string' ? firstFieldError : (json?.message || `Request failed (${response.status}).`);
        throw new ApiError(message, response.status, errors);
    }
    return json;
}

/**
 * Downloads a file from an authenticated endpoint (for example the JSON backup).
 * @param {string} path
 * @param {string} filename
 */
export async function downloadFile(path, filename) {
    const token = getToken() || memoryToken;
    let response;
    try {
        response = await fetch(`${API_URL}${path}`, {headers: token ? {Authorization: `Bearer ${token}`} : {}});
    } catch {
        throw new ApiError('Cannot reach the RetailTrack server. Check that the backend is running.', 0);
    }
    if (!response.ok) {
        let message = `Download failed (${response.status}).`;
        try {
            message = (await response.json()).message || message;
        } catch { /* keep the default message */
        }
        throw new ApiError(message, response.status);
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const api = {
    /** @param {string} path @param {Record<string, string | number | undefined>} [query] */
    get: (path, query) => request('GET', path, undefined, {query}),
    /** @param {string} path @param {unknown} [body] @param {{ auth?: boolean }} [options] */
    post: (path, body, options) => request('POST', path, body ?? {}, options),
    /** @param {string} path @param {unknown} [body] */
    patch: (path, body) => request('PATCH', path, body ?? {}),
    /** @param {string} path */
    delete: (path) => request('DELETE', path),
};

/**
 * Reads every page of a list endpoint (the API caps a page at 500 rows).
 * @param {string} path
 * @param {Record<string, string | number | undefined>} [query]
 * @returns {Promise<any[]>}
 */
export async function fetchAll(path, query = {}) {
    const items = [];
    for (let page = 1; page <= 200; page += 1) {
        const json = await request('GET', path, undefined, {query: {...query, page, limit: 500}});
        const rows = Array.isArray(json.data) ? json.data : [];
        items.push(...rows);
        const totalPages = json.meta?.totalPages ?? 1;
        if (page >= totalPages || rows.length === 0) break;
    }
    return items;
}
