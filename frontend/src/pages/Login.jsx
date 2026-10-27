import {useState} from 'react';
import {Eye, EyeOff, LockKeyhole, Mail, PackageOpen, ShieldCheck, ShoppingCart, Warehouse} from 'lucide-react';
import {demoAccounts} from '../data.js';
import {useStore} from '../StoreContext.jsx';

const roleIcons = {Administrator: ShieldCheck, 'Inventory Staff': Warehouse, Cashier: ShoppingCart};

export default function Login({onLogin}) {
    const {settings} = useStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [selectedRole, setSelectedRole] = useState('Administrator');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const fillDemo = (account) => {
        setEmail(account.email);
        setPassword(account.password);
        setSelectedRole(account.role);
        setError('');
    };

    const submit = (event) => {
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
        const account = demoAccounts.find((item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password);
        if (!account) {
            setError('Invalid email or password. Select one of the three demo roles below.');
            return;
        }
        setLoading(true);
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
                                                                 onChange={(event) => setRemember(event.target.checked)}/><span>Remember me</span></label><span>Password for all roles: demo1234</span>
                    </div>
                    <button className="login-submit" type="submit" disabled={loading}>{loading ? <><span
                        className="button-spinner"/>Signing in…</> : 'Sign In'}</button>
                </form>
                <div className="demo-role-section">
                    <div className="demo-role-title"><span>Demo accounts</span><small>Select a role to autofill</small>
                    </div>
                    <div className="demo-role-grid">
                        {demoAccounts.map((account) => {
                            const Icon = roleIcons[account.role];
                            const shortRole = account.role === 'Administrator' ? 'Admin' : account.role === 'Inventory Staff' ? 'Inventory' : 'Cashier';
                            return <button type="button" key={account.userId}
                                           className={selectedRole === account.role ? 'active' : ''}
                                           onClick={() => fillDemo(account)}><Icon
                                size={18}/><strong>{shortRole}</strong><small>{account.name.split(' ')[0]}</small>
                            </button>;
                        })}
                    </div>
                    <div className="demo-account-detail">
                        <span>{selectedRole}</span><code>{demoAccounts.find((account) => account.role === selectedRole)?.email}</code>
                    </div>
                </div>
                <p className="login-restricted">System access is restricted to authorized personnel only.</p>
            </section>
            <footer className="login-footer"><strong>{settings.storeName} <span>-</span> {settings.location}
            </strong><small>RetailTrack · Secure inventory operations</small></footer>
        </div>
    );
}