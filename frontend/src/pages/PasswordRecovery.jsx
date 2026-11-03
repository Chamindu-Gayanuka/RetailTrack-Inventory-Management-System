import {useEffect, useState} from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    Eye,
    EyeOff,
    KeyRound,
    LockKeyhole,
    Mail,
    RotateCcw,
    ShieldCheck
} from 'lucide-react';
import {useStore} from '../store-context.js';
import OtpInput from '../components/OtpInput.jsx';
import {getPasswordStrength, maskEmail, passwordValidationError} from '../utils/credentials.js';
import {
    clearPasswordReset,
    createPasswordReset,
    isPasswordResetVerified,
    readPasswordReset,
    verifyPasswordReset
} from '../utils/passwordReset.js';

/** @typedef {(path: string) => void} Navigate */

/** @param {{ navigate: Navigate, icon: import('lucide-react').LucideIcon, title: string, description: string, children: import('react').ReactNode }} props */
function AuthShell({navigate, icon: Icon, title, description, children}) {
    const {settings} = useStore();
    return (
        <div className="login-page recovery-page">
            <div className="login-background-grid"/>
            <section className="login-card recovery-card">
                <button type="button" className="auth-back-link" onClick={() => navigate('login')}><ArrowLeft
                    size={16}/>Back to sign in
                </button>
                <div className="auth-brand"><strong>RetailTrack</strong><span>Inventory Management System</span></div>
                <div className="recovery-heading"><span className="recovery-heading-icon"><Icon size={25}/></span>
                    <h1>{title}</h1><p>{description}</p></div>
                {children}
            </section>
            <footer className="login-footer"><strong>{settings.storeName} <span>-</span> {settings.location}
            </strong><small>RetailTrack · Secure inventory operations</small></footer>
        </div>
    );
}

/** @param {{ code: string, onUse: (code: string) => void }} props */
function LocalCodeNotice({code, onUse}) {
    return (
        <div className="local-code-callout">
            <Mail size={19}/>
            <div><strong>Local verification code</strong><span>Email service is not configured. Use this code to continue:</span>
            </div>
            <button type="button" onClick={() => onUse(code)} title="Fill the verification code">{code}</button>
        </div>
    );
}

/** @param {{ navigate: Navigate }} props */
export function ForgotPassword({navigate}) {
    const {findAccountByEmail} = useStore();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const submit = (/** @type {import('react').FormEvent<HTMLFormElement>} */ event) => {
        event.preventDefault();
        setError('');
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
            setError('Enter a valid email address.');
            return;
        }
        const account = findAccountByEmail(email);
        if (!account) {
            setError('No active account is registered with this email address.');
            return;
        }
        createPasswordReset(account.email);
        navigate('verify-otp');
    };

    return (
        <AuthShell navigate={navigate} icon={KeyRound} title="Forgot password?"
                   description="Enter your account email to receive a six-digit verification code.">
            <form onSubmit={submit} noValidate>
                <div className={`login-field ${error ? 'has-error' : ''}`}><label htmlFor="recovery-email">Email
                    Address</label>
                    <div><Mail size={19}/><input id="recovery-email" type="email" value={email} onChange={(event) => {
                        setEmail(event.target.value);
                        setError('');
                    }} placeholder="name@apekade.lk" autoComplete="email" autoFocus/></div>
                </div>
                {error && <div className="login-error" role="alert">{error}</div>}
                <button className="login-submit" type="submit">Send verification code <ArrowRight size={18}/></button>
            </form>
            <p className="recovery-help">A local verification code will be shown on the next page until an email service
                is connected.</p>
        </AuthShell>
    );
}

/** @param {{ navigate: Navigate }} props */
export function VerifyOtp({navigate}) {
    const [flow, setFlow] = useState(readPasswordReset);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!flow) return undefined;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [flow]);

    if (!flow) return <AuthShell navigate={navigate} icon={ShieldCheck} title="Verification unavailable"
                                 description="Start a new password recovery request to receive a verification code.">
        <button className="login-submit" onClick={() => navigate('forgot-password')}>Start password recovery</button>
    </AuthShell>;

    const seconds = Math.max(0, Math.ceil((flow.expiresAt - now) / 1000));
    const timer = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const submit = (/** @type {import('react').FormEvent<HTMLFormElement>} */ event) => {
        event.preventDefault();
        setError('');
        setMessage('');
        if (code.length !== 6) {
            setError('Enter all six digits of your verification code.');
            return;
        }
        const result = verifyPasswordReset(flow, code);
        setFlow(result.flow);
        if (!result.ok) {
            setError(result.message);
            setCode('');
            return;
        }
        navigate('reset-password');
    };
    const resend = () => {
        const next = createPasswordReset(flow.email);
        setFlow(next);
        setNow(Date.now());
        setCode('');
        setError('');
        setMessage('A new verification code is ready.');
    };

    return (
        <AuthShell navigate={navigate} icon={ShieldCheck} title="Verify your code"
                   description={`Enter the six-digit code prepared for ${maskEmail(flow.email)}.`}>
            <LocalCodeNotice code={flow.code} onUse={(value) => {
                setCode(value);
                setError('');
            }}/>
            <form onSubmit={submit}>
                <div className="otp-field"><label>Verification code</label><OtpInput value={code} onChange={(value) => {
                    setCode(value);
                    setError('');
                }} autoFocus/></div>
                <div className={`otp-expiry ${seconds === 0 ? 'expired' : ''}`}>
                    <span>{seconds ? `Code expires in ${timer}` : 'This code has expired'}</span><span>{Math.max(0, 5 - flow.attempts)} attempts available</span>
                </div>
                {error && <div className="login-error" role="alert">{error}</div>}
                {message && <div className="auth-success-message"><Check size={15}/>{message}</div>}
                <button className="login-submit" type="submit" disabled={!seconds}>Verify code <ArrowRight size={18}/>
                </button>
            </form>
            <div className="recovery-secondary"><span>Did not receive the code?</span>
                <button type="button" onClick={resend}><RotateCcw size={14}/>Resend code</button>
            </div>
        </AuthShell>
    );
}

/** @param {{ navigate: Navigate }} props */
export function ResetPassword({navigate}) {
    const {resetPassword} = useStore();
    const [flow] = useState(readPasswordReset);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [error, setError] = useState('');
    const [complete, setComplete] = useState(false);
    const strength = getPasswordStrength(password);

    if (complete) return <AuthShell navigate={navigate} icon={CheckCircle2} title="Password reset complete"
                                    description="Your new password is ready. Use it the next time you sign in to RetailTrack.">
        <button className="login-submit" onClick={() => navigate('login')}>Return to sign in <ArrowRight size={18}/>
        </button>
    </AuthShell>;
    if (!flow || !isPasswordResetVerified(flow)) return <AuthShell navigate={navigate} icon={LockKeyhole}
                                                                   title="Verification required"
                                                                   description="Verify a current one-time code before choosing a new password.">
        <button className="login-submit"
                onClick={() => navigate(flow ? 'verify-otp' : 'forgot-password')}>{flow ? 'Return to verification' : 'Start password recovery'}</button>
    </AuthShell>;

    const submit = (/** @type {import('react').FormEvent<HTMLFormElement>} */ event) => {
        event.preventDefault();
        setError('');
        if (!isPasswordResetVerified(flow)) {
            setError('Your verified session has expired. Start a new recovery request.');
            return;
        }
        const validation = passwordValidationError(password);
        if (validation) {
            setError(validation);
            return;
        }
        if (password !== confirmation) {
            setError('New passwords do not match.');
            return;
        }
        if (!resetPassword(flow.email, password)) {
            setError('This account is no longer available. Start a new recovery request.');
            return;
        }
        clearPasswordReset();
        setComplete(true);
    };

    return (
        <AuthShell navigate={navigate} icon={LockKeyhole} title="Choose a new password"
                   description={`Create a secure password for ${maskEmail(flow.email)}.`}>
            <form onSubmit={submit} noValidate>
                <div className={`login-field ${error ? 'has-error' : ''}`}><label htmlFor="new-password">New
                    Password</label>
                    <div><LockKeyhole size={19}/><input id="new-password" type={showPassword ? 'text' : 'password'}
                                                        value={password} onChange={(event) => {
                        setPassword(event.target.value);
                        setError('');
                    }} placeholder="At least 8 characters" autoComplete="new-password" autoFocus/>
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide new password' : 'Show new password'}>{showPassword ?
                            <EyeOff size={18}/> : <Eye size={18}/>}</button>
                    </div>
                </div>
                {password &&
                    <div className={`password-strength strength-${strength.label.toLowerCase()}`} aria-live="polite">
                        <div><span>Password strength</span><strong>{strength.label}</strong></div>
                        <div className="password-strength-meter" aria-hidden="true">{[1, 2, 3].map((level) => <i
                            key={level} className={strength.level >= level ? 'active' : ''}/>)}</div>
                    </div>}
                <div className={`login-field ${error ? 'has-error' : ''}`}><label htmlFor="confirm-password">Confirm New
                    Password</label>
                    <div><ShieldCheck size={19}/><input id="confirm-password"
                                                        type={showConfirmation ? 'text' : 'password'}
                                                        value={confirmation} onChange={(event) => {
                        setConfirmation(event.target.value);
                        setError('');
                    }} placeholder="Enter the password again" autoComplete="new-password"/>
                        <button type="button" onClick={() => setShowConfirmation(!showConfirmation)}
                                aria-label={showConfirmation ? 'Hide confirm password' : 'Show confirm password'}>{showConfirmation ?
                            <EyeOff size={18}/> : <Eye size={18}/>}</button>
                    </div>
                </div>
                <div className="password-rules" aria-label="Password rules"><span
                    className={password.length >= 8 ? 'met' : ''}><Check size={14}/>At least 8 characters</span><span
                    className="met"><Check size={14}/>ID numbers and birth dates are accepted</span><span><ShieldCheck
                    size={14}/>Longer, unique passwords are more secure</span></div>
                {error && <div className="login-error" role="alert">{error}</div>}
                <button className="login-submit" type="submit">Reset password <Check size={18}/></button>
            </form>
        </AuthShell>
    );
}