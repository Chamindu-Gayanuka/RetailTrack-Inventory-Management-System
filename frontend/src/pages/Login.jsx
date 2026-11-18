import {useState} from 'react';
import {Eye, EyeOff, LockKeyhole, Mail, PackageOpen} from 'lucide-react';
import {useStore} from '../store-context.js';

/** @param {{ onLogin: (account: import('../types.js').AuthAccount, remember: boolean) => void, navigate: (path: string) => void }} props */
export default function Login({onLogin, navigate}) {
    const {settings, authenticate} = useStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (/** @type {import('react').FormEvent<HTMLFormElement>} */ event) => {
        event.preventDefault();
        setError('');
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            setError('Enter a valid email address.');
            return;
        }
        if (!password) {
            setError('Enter your password.');
            return;
        }
        setLoading(true);
        let account;
        try {
            account = await authenticate(email, password);
        } catch (error) {
            setLoading(false);
            setError(error instanceof Error ? error.message : 'Sign in failed. Please try again.');
            return;
        }
        if (!account) {
            setLoading(false);
            setError('The email or password you entered is incorrect. Please try again.');
            return;
        }
        window.setTimeout(() => onLogin(account, remember), 550);
    };

    return (
        <div className="login-page">
            <div className="login-background-grid"/>
            <section className="login-card">
                <div className="login-brand"><span className="login-brand-mark"><PackageOpen size={29}/></span>
                    <h1>RetailTrack</h1><p>Inventory Management System</p></div>
                <div className="login-welcome"><h2>Welcome back</h2><p>Sign in to manage your store inventory and
                    sales.</p></div>
                <form onSubmit={submit} noValidate>
                    <div className={`login-field ${error ? 'has-error' : ''}`}><label htmlFor="login-email">Email
                        Address</label>
                        <div><Mail size={19}/><input id="login-email" type="email" value={email} onChange={(event) => {
                            setEmail(event.target.value);
                            setError('');
                        }} placeholder="name@apekade.lk" autoComplete="email"/></div>
                    </div>
                    <div className={`login-field ${error ? 'has-error' : ''}`}><label
                        htmlFor="login-password">Password</label>
                        <div><LockKeyhole size={19}/><input id="login-password"
                                                            type={showPassword ? 'text' : 'password'} value={password}
                                                            onChange={(event) => {
                                                                setPassword(event.target.value);
                                                                setError('');
                                                            }} placeholder="Enter your password"
                                                            autoComplete="current-password"/>
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ?
                                <EyeOff size={18}/> : <Eye size={18}/>}</button>
                        </div>
                    </div>
                    {error && <div className="login-error">{error}</div>}
                    <div className="login-options"><label><input type="checkbox" checked={remember}
                                                                 onChange={(event) => setRemember(event.target.checked)}/><span>Remember me</span></label>
                        <button type="button" onClick={() => navigate('forgot-password')}>Forgot password?</button>
                    </div>
                    <button className="login-submit" type="submit" disabled={loading}>{loading ? <><span
                        className="button-spinner"/>Signing in…</> : 'Sign In'}</button>
                </form>
                <p className="login-restricted">System access is restricted to authorized personnel only.</p>
            </section>
            <footer className="login-footer"><strong>{settings.storeName} <span>-</span> {settings.location}
            </strong><small>RetailTrack · Secure inventory operations</small></footer>
        </div>
    );
}