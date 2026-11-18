import {useState} from 'react';
import {Check, CheckCircle2, RotateCcw, ShieldAlert} from 'lucide-react';
import {useStore} from '../store-context.js';
import {api} from '../api/client.js';
import OtpInput from './OtpInput.jsx';

export default function EmailVerification() {
    const {session, users, markEmailVerified, notify} = useStore();
    const currentUser = users.find((user) => user.id === session.userId);
    const verified = currentUser?.emailVerified === true;
    const [challenge, setChallenge] = useState(/** @type {{ expiresAt: number } | null} */ (null));
    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    const sendCode = async () => {
        try {
            await api.post('/auth/email-verification/send');
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not send the code.');
            return;
        }
        setChallenge({expiresAt: Date.now() + 10 * 60 * 1000});
        setCode('');
        setError('');
        notify('A verification code was emailed to you.', 'info');
    };

    const verify = async () => {
        if (!challenge || Date.now() >= challenge.expiresAt) {
            setError('This code has expired. Resend a new verification code.');
            return;
        }
        try {
            await api.post('/auth/email-verification/confirm', {otp: code});
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Verification failed.');
            return;
        }
        markEmailVerified();
        setChallenge(null);
        setCode('');
        setError('');
    };

    return (
        <section className={`email-verification-card ${verified ? 'verified' : 'unverified'}`}>
            <div className="email-verification-summary">
                <span className="email-verification-icon">{verified ? <CheckCircle2 size={23}/> :
                    <ShieldAlert size={23}/>}</span>
                <div><strong>Email verification</strong><p>{currentUser?.email || session.email}</p>
                    <small>{verified ? 'Your email address is verified.' : 'Verify your email to secure account notifications and recovery.'}</small>
                </div>
                <span
                    className={`badge ${verified ? 'badge-in' : 'badge-low'}`}>{verified ? 'Verified' : 'Not verified'}</span>
            </div>
            {!verified && <div className="email-verification-actions">
                <button type="button" className="button button-secondary" onClick={sendCode}><RotateCcw size={15}/>Resend
                    verification code
                </button>
                {challenge && <div className="email-verification-challenge">
                    <p className="email-code-hint">We emailed a six-digit code to your address. It expires in 10 minutes.</p>
                    <label>Verification code</label>
                    <OtpInput value={code} onChange={(value) => {
                        setCode(value);
                        setError('');
                    }}/>
                    {error && <p className="verification-error" role="alert">{error}</p>}
                    <button type="button" className="button button-primary" onClick={verify}
                            disabled={code.length !== 6}><Check size={15}/>Verify email
                    </button>
                </div>}
            </div>}
        </section>
    );
}