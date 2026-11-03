import {useEffect, useRef, useState} from 'react';
import {
    Bell,
    Building2,
    Camera,
    Check,
    ChevronRight,
    Database,
    Download,
    HardDrive,
    KeyRound,
    LockKeyhole,
    Mail,
    MapPin,
    Phone,
    Save,
    ShieldCheck,
    Store,
    UserRound,
} from 'lucide-react';
import {useStore} from '../store-context.js';
import {rolePermissions} from '../data.js';
import {Avatar, Field, Modal, PageHeader, Toggle} from '../components/UI.jsx';
import PrettySelect from '../components/PrettySelect.jsx';
import EmailVerification from '../components/EmailVerification.jsx';

export default function Settings() {
    const {settings, updateSettings, products, sales, users, transactions, notify} = useStore();
    const [tab, setTab] = useState('store');
    const [form, setForm] = useState(settings);
    useEffect(() => setForm(settings), [settings]);
    const set = (/** @type {keyof import('../types.js').StoreSettings} */ key, /** @type {string | boolean} */ value) => setForm((current) => /** @type {import('../types.js').StoreSettings} */ ({
        ...current,
        [key]: value
    }));

    const downloadDataExport = () => {
        const payload = JSON.stringify({
            formatVersion: 1,
            exportedAt: new Date().toISOString(),
            settings,
            products,
            sales,
            users,
            transactions
        }, null, 2);
        const url = URL.createObjectURL(new Blob([payload], {type: 'application/json'}));
        const link = document.createElement('a');
        link.href = url;
        link.download = `retailtrack-data-export-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        notify('Data export downloaded.');
    };

    let storageBytes = 0;
    try {
        storageBytes = Object.keys(localStorage).filter((key) => key.startsWith('retailtrack-')).reduce((total, key) => total + new Blob([key, localStorage.getItem(key) || '']).size, 0);
    } catch { /* Storage information is unavailable when browser storage is blocked. */
    }
    const storageLabel = storageBytes >= 1024 * 1024 ? `${(storageBytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(storageBytes / 1024))} KB`;

    return (
        <div>
            <PageHeader title="Settings"
                        description="Configure your store, notifications, security and data preferences."
                        actions={<button className="button button-primary" onClick={() => updateSettings(form)}><Save
                            size={16}/>Save Changes</button>}/>
            <div className="settings-layout">
                <aside className="card settings-nav">
                    <button className={tab === 'store' ? 'active' : ''} onClick={() => setTab('store')}><Store
                        size={18}/><span><strong>Store Profile</strong><small>Business information</small></span><ChevronRight
                        size={15}/></button>
                    <button className={tab === 'notifications' ? 'active' : ''} onClick={() => setTab('notifications')}>
                        <Bell
                            size={18}/><span><strong>Notifications</strong><small>Alerts and summaries</small></span><ChevronRight
                        size={15}/></button>
                    <button className={tab === 'security' ? 'active' : ''} onClick={() => setTab('security')}>
                        <ShieldCheck size={18}/><span><strong>Security</strong><small>Sessions and access</small></span><ChevronRight
                        size={15}/></button>
                    <button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}><Database
                        size={18}/><span><strong>Data & Storage</strong><small>Exports and local usage</small></span><ChevronRight
                        size={15}/></button>
                </aside>
                <section className="card settings-panel">
                    {tab === 'store' && <>
                        <div className="settings-panel-head"><span className="settings-head-icon"><Building2 size={22}/></span>
                            <div><h2>Store Profile</h2><p>This information appears throughout your RetailTrack
                                workspace.</p></div>
                        </div>
                        <div className="store-preview"><span
                            className="store-preview-logo">{form.storeName?.slice(0, 1)}</span>
                            <div><strong>{form.storeName}</strong><span><MapPin size={14}/>{form.location}</span></div>
                            <span className="badge badge-in"><span className="badge-dot"/>Active Store</span></div>
                        <div className="form-grid two-columns settings-form"><Field label="Store name" required><input
                            value={form.storeName}
                            onChange={(event) => set('storeName', event.target.value)}/></Field><Field label="Location"><input
                            value={form.location}
                            onChange={(event) => set('location', event.target.value)}/></Field><Field
                            label="Contact phone">
                            <div className="input-with-icon"><Phone size={16}/><input value={form.phone}
                                                                                      onChange={(event) => set('phone', event.target.value)}/>
                            </div>
                        </Field><Field label="Business email">
                            <div className="input-with-icon"><Mail size={16}/><input type="email" value={form.email}
                                                                                     onChange={(event) => set('email', event.target.value)}/>
                            </div>
                        </Field><Field label="Currency"><PrettySelect value={form.currency}
                                                                      onChange={(event) => set('currency', event.target.value)}>
                            <option>Sri Lankan Rupee (LKR)</option>
                        </PrettySelect></Field><Field label="Timezone"><PrettySelect value="Asia/Colombo (GMT+5:30)"
                                                                                     disabled aria-label="Timezone">
                            <option>Asia/Colombo (GMT+5:30)</option>
                        </PrettySelect></Field></div>
                        <div className="settings-save-row"><span>Changes are saved to the local data store</span>
                            <button className="button button-primary" onClick={() => updateSettings(form)}>Save Store
                                Profile
                            </button>
                        </div>
                    </>}
                    {tab === 'notifications' && <>
                        <div className="settings-panel-head"><span className="settings-head-icon"><Bell
                            size={22}/></span>
                            <div><h2>Notification Preferences</h2><p>Choose which operational updates you want to
                                receive.</p></div>
                        </div>
                        <div className="settings-toggle-list"><Toggle checked={form.lowStockAlerts}
                                                                      onChange={(value) => set('lowStockAlerts', value)}
                                                                      label="Low stock alerts"
                                                                      description="Show an alert when a product reaches its minimum stock level."/><Toggle
                            checked={form.saleNotifications} onChange={(value) => set('saleNotifications', value)}
                            label="New sale notifications"
                            description="Receive an activity notification after each completed sale."/><Toggle
                            checked={form.weeklySummary} onChange={(value) => set('weeklySummary', value)}
                            label="Weekly business summary"
                            description="Prepare a weekly summary of sales and inventory movement."/><Toggle
                            checked={form.emailAlerts} onChange={(value) => set('emailAlerts', value)}
                            label="Email notifications"
                            description="Also send critical stock alerts to your business email."/></div>
                        <div className="info-callout">Email delivery requires a configured email service. In-app stock
                            alerts remain available regardless of these preferences.
                        </div>
                        <div className="settings-save-row"><span>Preferences apply to Chamindu’s account</span>
                            <button className="button button-primary" onClick={() => updateSettings(form)}>Save
                                Preferences
                            </button>
                        </div>
                    </>}
                    {tab === 'security' && <>
                        <div className="settings-panel-head"><span className="settings-head-icon"><ShieldCheck
                            size={22}/></span>
                            <div><h2>Security & Access</h2><p>Your workspace is protected by role-based access
                                control.</p></div>
                        </div>
                        <div className="security-status-card"><span><ShieldCheck size={26}/></span>
                            <div><strong>Security Protected</strong><p>Administrator permissions are active for this
                                account.</p></div>
                            <span className="badge badge-in"><span className="badge-dot"/>Healthy</span></div>
                        <div className="session-list"><h3>Active Session</h3>
                            <div><span className="session-icon"><LockKeyhole size={19}/></span>
                                <div><strong>Current browser</strong><p>This browser is signed in to your account.</p>
                                </div>
                                <span className="badge badge-in">Current</span></div>
                        </div>
                    </>}
                    {tab === 'data' && <>
                        <div className="settings-panel-head"><span className="settings-head-icon"><Database size={22}/></span>
                            <div><h2>Data & Storage</h2><p>Export business records and review local storage usage.</p>
                            </div>
                        </div>
                        <div className="data-summary-grid">
                            <div><strong>{products.length}</strong><span>Products</span></div>
                            <div><strong>{sales.length}</strong><span>Sales</span></div>
                            <div><strong>{transactions.length}</strong><span>Movements</span></div>
                            <div><strong>{users.length}</strong><span>Users</span></div>
                        </div>
                        <div className="data-action-card"><span><Download size={22}/></span>
                            <div><strong>Export business data</strong><p>Download products, sales, users, movements and
                                store settings in JSON format.</p></div>
                            <button className="button button-secondary" onClick={downloadDataExport}>Download</button>
                        </div>
                        <div className="data-action-card"><span><HardDrive size={22}/></span>
                            <div><strong>Browser storage</strong><p>Records are saved automatically in this browser.
                                Export regularly to keep an external backup.</p></div>
                            <strong className="data-storage-value">{storageLabel}</strong></div>
                    </>}
                </section>
            </div>
        </div>
    );
}

/** @param {{ open: boolean, onClose: () => void }} props */
function PasswordModal({open, onClose}) {
    const {notify, changePassword} = useStore();
    const [form, setForm] = useState({current: '', next: '', confirm: ''});
    const [error, setError] = useState('');
    useEffect(() => {
        if (open) {
            setForm({current: '', next: '', confirm: ''});
            setError('');
        }
    }, [open]);
    const submit = (/** @type {import('react').FormEvent<HTMLFormElement>} */ event) => {
        event.preventDefault();
        if (!form.current) {
            setError('Enter your current password.');
            return;
        }
        if (form.next !== form.confirm) {
            setError('New passwords do not match.');
            return;
        }
        const result = changePassword(form.current, form.next);
        if (!result.ok) {
            setError(result.message);
            return;
        }
        notify('Your sign-in password was updated.');
        onClose();
    };
    return <Modal open={open} onClose={onClose} title="Update secure password"
                  subtitle="Use at least 8 characters and avoid reusing a password." footer={<>
        <button className="button button-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="password-form" className="button button-primary">Update Password</button>
    </>}>
        <form id="password-form" onSubmit={submit} className="form-stack"><Field label="Current password"
                                                                                 required><input type="password"
                                                                                                 value={form.current}
                                                                                                 onChange={(event) => setForm({
                                                                                                     ...form,
                                                                                                     current: event.target.value
                                                                                                 })}/></Field><Field
            label="New password" required><input type="password" value={form.next} onChange={(event) => setForm({
            ...form,
            next: event.target.value
        })}/></Field><Field label="Confirm new password" required error={error}><input type="password"
                                                                                       value={form.confirm}
                                                                                       onChange={(event) => setForm({
                                                                                           ...form,
                                                                                           confirm: event.target.value
                                                                                       })}/></Field></form>
    </Modal>;
}

export function Profile() {
    const {profile, session, users, updateProfile, notify} = useStore();
    const primary = session.userId === 'u1';
    const currentUser = users.find((user) => user.id === session.userId);
    const emailVerified = currentUser?.emailVerified === true;
    /** @type {{ name: string, email: string, phone: string, avatar?: string | null, role: import('../types.js').Role }} */
    const account = {
        name: primary ? profile.name : session.name,
        email: primary ? profile.email : session.email,
        phone: primary ? profile.phone || '' : users.find((user) => user.id === session.userId)?.phone || '',
        avatar: primary ? profile.avatar : session.avatar,
        role: session.role,
    };
    const [form, setForm] = useState(account);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const fileRef = useRef(/** @type {HTMLInputElement | null} */ (null));
    useEffect(() => setForm(account), [session.userId, session.name, session.email, session.avatar, profile]);
    const permissions = rolePermissions[session.role] || [];
    const changePhoto = (/** @type {import('react').ChangeEvent<HTMLInputElement>} */ event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            notify('Choose an image smaller than 2 MB.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const avatar = /** @type {string} */ (reader.result);
            setForm((current) => ({...current, avatar}));
            updateProfile({avatar});
        };
        reader.readAsDataURL(file);
    };
    return (
        <div>
            <PageHeader breadcrumb={<><span>Account</span><ChevronRight size={13}/><span>Profile</span></>}
                        title="My Profile"
                        description="Manage your personal details and review your assigned system access."/>
            <section className="profile-hero card">
                <div className="profile-photo-wrap"><Avatar name={form.name} src={form.avatar} size="profile"/>
                    <button onClick={() => fileRef.current?.click()} aria-label="Change profile photo"><Camera
                        size={16}/></button>
                    <input ref={fileRef} type="file" accept="image/*" onChange={changePhoto} hidden/></div>
                <div className="profile-hero-copy"><h2>{form.name}</h2>
                    <div><span className="admin-badge">{session.role.toUpperCase()}</span><span><Mail
                        size={15}/>{form.email}</span></div>
                </div>
                <span className={`security-label ${emailVerified ? '' : 'verification-pending'}`}>{emailVerified ?
                    <ShieldCheck size={16}/> :
                    <Mail size={16}/>}{emailVerified ? 'Email verified' : 'Email not verified'}</span></section>
            <EmailVerification/>
            <form className="card profile-settings-card" onSubmit={(event) => {
                event.preventDefault();
                updateProfile(form);
            }}>
                <div className="profile-form-grid">
                    <section className="form-section">
                        <div className="form-section-heading"><span><UserRound size={18}/></span>
                            <div><h2>Personal Details</h2><p>Your account contact information.</p></div>
                        </div>
                        <Field label="Full Name"><input aria-label="Full Name" value={form.name}
                                                        onChange={(event) => setForm({
                                                            ...form,
                                                            name: event.target.value
                                                        })}/></Field><Field label="Email Address"><input
                        aria-label="Email Address" type="email" value={form.email}
                        onChange={(event) => setForm({...form, email: event.target.value})}/></Field><Field
                        label="Phone Number"><input aria-label="Phone Number" value={form.phone}
                                                    onChange={(event) => setForm({
                                                        ...form,
                                                        phone: event.target.value
                                                    })}/></Field></section>
                    <section className="form-section">
                        <div className="form-section-heading"><span><ShieldCheck size={18}/></span>
                            <div><h2>System Role & Access</h2><p>Permissions assigned by the system owner.</p></div>
                        </div>
                        <Field label="Account Role"
                               hint="Role permissions are managed by the System Owner and cannot be edited here.">
                            <div className="input-with-icon readonly"><input aria-label="Account Role"
                                                                             value={session.role} readOnly/><LockKeyhole
                                size={17}/></div>
                        </Field><Field label="Change Password">
                        <button type="button" className="password-update-button" onClick={() => setPasswordOpen(true)}>
                            <KeyRound size={17}/><span>Update secure password</span><ChevronRight size={17}/></button>
                    </Field>
                        <div className="permission-block"><label>Assigned Permissions</label>
                            <div>{permissions.map((permission) => <span key={permission}><Check size={14}/>{permission}</span>)}</div>
                        </div>
                    </section>
                </div>
                <div className="form-card-footer"><span className="autosave-note"><ShieldCheck size={16}/>Changes are saved to the local data store</span>
                    <div>
                        <button type="button" className="button button-secondary"
                                onClick={() => setForm(account)}>Cancel
                        </button>
                        <button type="submit" className="button button-primary">Save Changes</button>
                    </div>
                </div>
            </form>
            <PasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)}/>
        </div>
    );
}