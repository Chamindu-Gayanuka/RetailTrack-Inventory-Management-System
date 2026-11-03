/** Generate a six-digit one-time verification code. */
export function generateOtp() {
    const values = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
    else values[0] = Math.floor(Math.random() * 0xffffffff);
    return String(100000 + (values[0] % 900000));
}

/** @param {string} password */
export function passwordValidationError(password) {
    if (password.length < 8) return 'Your new password must contain at least 8 characters.';
    return '';
}

/**
 * IDs and birth dates are accepted. Length and character variety increase the rating.
 * @param {string} password
 * @returns {{ label: 'Weak' | 'Medium' | 'Strong' | '', level: 0 | 1 | 2 | 3 }}
 */
export function getPasswordStrength(password) {
    if (!password) return {label: '', level: 0};
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    const characterTypes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
    if (characterTypes >= 2) score += 1;
    if (characterTypes >= 3) score += 1;
    if (score >= 3) return {label: 'Strong', level: 3};
    if (score === 2) return {label: 'Medium', level: 2};
    return {label: 'Weak', level: 1};
}

/** @param {string} email */
export function maskEmail(email) {
    const [name = '', domain = ''] = email.split('@');
    if (!domain) return email;
    const visible = name.slice(0, Math.min(2, name.length));
    return `${visible}${'*'.repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}