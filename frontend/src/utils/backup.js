import {api} from '../api/client.js';

/**
 * Reads a backup file and asks the server to validate it. Nothing is changed on the server.
 * Accepts backups exported by this system and the older browser-only exports.
 * @param {File} file
 * @returns {Promise<{ data: any, summary: Record<string, number>, warnings: string[] }>}
 */
export async function readBackupFile(file) {
    if (file.size > 8 * 1024 * 1024) throw new Error('Choose a backup smaller than 8 MB.');
    let data;
    try {
        data = JSON.parse(await file.text());
    } catch {
        throw new Error('This file is not valid JSON. Choose a RetailTrack JSON backup.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The selected file does not contain a RetailTrack backup.');
    const json = await api.post('/backup/import', {mode: 'validate', backup: data});
    return {data, summary: json.data.summary || {}, warnings: json.data.warnings || []};
}
