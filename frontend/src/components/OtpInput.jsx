import { useRef } from 'react';

/** @param {{ value: string, onChange: (value: string) => void, disabled?: boolean, autoFocus?: boolean }} props */
export default function OtpInput({ value, onChange, disabled = false, autoFocus = false }) {
    const refs = useRef(/** @type {Array<HTMLInputElement | null>} */([]));
    const digits = Array.from({ length: 6 }, (_, index) => value[index] || '');

    const focus = (/** @type {number} */ index) => {
        const input = refs.current[Math.max(0, Math.min(5, index))];
        input?.focus();
        input?.select();
    };

    const fill = (/** @type {string} */ text) => {
        const next = text.replace(/\D/g, '').slice(0, 6);
        onChange(next);
        if (next) focus(Math.min(next.length, 5));
    };

    const updateDigit = (/** @type {number} */ index, /** @type {string} */ digit) => {
        const next = digits.slice();
        next[index] = digit;
        onChange(next.join('').slice(0, 6));
    };

    return (
        <div className="otp-input" role="group" aria-label="Six-digit verification code">
            {digits.map((digit, index) => (
                <input
                    key={index}
                    ref={(element) => { refs.current[index] = element; }}
                    value={digit}
                    onChange={(event) => {
                        const entered = event.target.value.replace(/\D/g, '');
                        if (entered.length > 1) { fill(entered); return; }
                        updateDigit(index, entered.slice(-1));
                        if (entered && index < 5) focus(index + 1);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Backspace') {
                            event.preventDefault();
                            if (digits[index]) updateDigit(index, '');
                            else if (index > 0) { updateDigit(index - 1, ''); focus(index - 1); }
                        }
                        if (event.key === 'ArrowLeft') { event.preventDefault(); focus(index - 1); }
                        if (event.key === 'ArrowRight') { event.preventDefault(); focus(index + 1); }
                    }}
                    onPaste={(event) => { event.preventDefault(); fill(event.clipboardData.getData('text')); }}
                    onFocus={(event) => event.currentTarget.select()}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    aria-label={`Verification code digit ${index + 1}`}
                    disabled={disabled}
                    autoFocus={autoFocus && index === 0}
                />
            ))}
        </div>
    );
}