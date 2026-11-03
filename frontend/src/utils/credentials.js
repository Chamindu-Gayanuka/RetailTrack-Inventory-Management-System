/** Generate a six-digit one-time code for the frontend demo. */
export function generateOtp() {
    const values = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
    else values[0] = Math.floor(Math.random() * 0xffffffff);
    return String(100000 + (values[0] % 900000));
}

/** @param {string} password */
export function passwordValidationError(password) {
    if (password.length < 8) return 'Use at least 8 characters for your new password.';
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Include at least one letter and one number in your new password.';
    return '';
}

/** @param {string} email */
export function maskEmail(email) {
    const [name = '', domain = ''] = email.split('@');
    if (!domain) return email;
    const visible = name.slice(0, Math.min(2, name.length));
    return `${visible}${'*'.repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}