import {useEffect, useState} from 'react';
import {Check, KeyRound, Mail, Power, ShieldCheck, UserCheck, UserPlus, Users as UsersIcon,} from 'lucide-react';
import {useStore} from '../store-context.js';
import {relativeTime} from '../data.js';
import {Avatar, Field, Modal, PageHeader, StatCard, StatusBadge} from '../components/UI.jsx';
import PrettySelect from '../components/PrettySelect.jsx';

/** @type {Record<import('../types.js').Role, string[]>} */
const roleDescriptions = {
    Administrator: ['Full inventory access', 'User management', 'Financial reporting', 'System settings'],
    'Inventory Staff': ['View products', 'Add and update stock', 'View stock alerts', 'Inventory summaries'],
    Cashier: ['Search products', 'Check available stock', 'Process customer sales', 'View sales history'],
};

/** @param {{ open: boolean, onClose: () => void }} props */
function AddUserModal({open, onClose}) {
    const {users, addUser} = useStore();
    const [form, setForm] = useState(/** @type {{ name: string, email: string, phone: string, role: import('../types.js').Role }} */ ({
        name: '',
        email: '',
        phone: '',
        role: 'Cashier'
    }));
    const [errors, setErrors] = useState(/** @type {{ name?: string, email?: string }} */ ({}));
    useEffect(() => {
        if (open) {
            setForm({name: '', email: '', phone: '', role: 'Cashier'});
            setErrors({});
        }
    }, [open]);
    const submit = (/** @type {import('react').FormEvent<HTMLFormElement>} */ event) => {
        event.preventDefault();
        /** @type {{ name?: string, email?: string }} */
        const next = {};
        if (!form.name.trim()) next.name = 'Full name is required.';
        if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.';
        if (users.some((user) => user.email.toLowerCase() === form.email.toLowerCase())) next.email = 'A user with this email already exists.';
        setErrors(next);
        if (Object.keys(next).length) return;
        addUser(form);
        onClose();
    };
    return <Modal open={open} onClose={onClose} title="Add a system user"
                  subtitle="Invite a team member and assign their access role." footer={<>
        <button className="button button-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="add-user-form" className="button button-primary"><UserPlus size={16}/>Send
            Invitation
        </button>
    </>}>
        <form id="add-user-form" className="form-stack" onSubmit={submit}>
            <Field label="Full name" required error={errors.name}><input value={form.name}
                                                                         onChange={(event) => setForm({
                                                                             ...form,
                                                                             name: event.target.value
                                                                         })} placeholder="e.g. Nimal Perera" autoFocus/></Field>
            <Field label="Email address" required error={errors.email}><input type="email" value={form.email}
                                                                              onChange={(event) => setForm({
                                                                                  ...form,
                                                                                  email: event.target.value
                                                                              })}
                                                                              placeholder="name@apekade.lk"/></Field>
            <div className="form-grid two-columns"><Field label="Phone number"><input value={form.phone}
                                                                                      onChange={(event) => setForm({
                                                                                          ...form,
                                                                                          phone: event.target.value
                                                                                      })}
                                                                                      placeholder="+94 77 000 0000"/></Field><Field
                label="System role" required><PrettySelect value={form.role} onChange={(event) => setForm({
                ...form,
                role: /** @type {import('../types.js').Role} */ (event.target.value)
            })}>
                <option>Administrator</option>
                <option>Inventory Staff</option>
                <option>Cashier</option>
            </PrettySelect></Field></div>
            <div className="role-preview"><ShieldCheck size={20}/>
                <div><strong>{form.role} permissions</strong><p>{roleDescriptions[form.role].join(' · ')}</p></div>
            </div>
        </form>
    </Modal>;
}

export default function Users() {
    const {users, profile, toggleUser, session} = useStore();
    const [addOpen, setAddOpen] = useState(false);
    return (
        <div>
            <PageHeader title="Users & Access"
                        description="Manage your team and keep system permissions aligned with their responsibilities."
                        actions={<button className="button button-primary" onClick={() => setAddOpen(true)}><UserPlus
                            size={17}/>Add User</button>}/>
            <section className="stats-grid compact-stats user-stats">
                <StatCard icon={UsersIcon} label="Total Users" value={users.length}
                          note={`${users.filter((user) => user.active).length} active accounts`} tone="blue"/>
                <StatCard icon={ShieldCheck} label="Administrators"
                          value={users.filter((user) => user.role === 'Administrator').length} note="Full system access"
                          tone="indigo"/>
                <StatCard icon={UserCheck} label="Inventory Staff"
                          value={users.filter((user) => user.role === 'Inventory Staff').length}
                          note="Stock management access" tone="green"/>
                <StatCard icon={KeyRound} label="Cashiers"
                          value={users.filter((user) => user.role === 'Cashier').length} note="Sales processing access"
                          tone="amber"/>
            </section>
            <section className="card table-card users-table-card">
                <div className="card-header">
                    <div><h2>System Users</h2><p>Account status and most recent activity</p></div>
                    <span className="security-label"><ShieldCheck size={15}/>Role-based access enabled</span></div>
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th>User</th>
                            <th>Contact</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Last Active</th>
                            <th>Access</th>
                        </tr>
                        </thead>
                        <tbody>
                        {users.map((user) => <tr key={user.id}>
                            <td data-label="User" data-wide="true">
                                <div className="user-cell"><Avatar name={user.name}
                                                                   src={user.id === session.userId ? session.avatar : user.id === 'u1' ? profile.avatar : null}/>
                                    <div><strong>{user.name}{user.id === session.userId && <span
                                        className="you-badge">You</span>}</strong><span>{user.id === 'u1' ? 'Primary account' : `User ID · ${user.id.toUpperCase()}`}</span>
                                    </div>
                                </div>
                            </td>
                            <td data-label="Contact" data-wide="true">
                                <div className="contact-cell"><span><Mail
                                    size={14}/>{user.email}</span><small>{user.phone || 'No phone added'}</small></div>
                            </td>
                            <td data-label="Role"><span
                                className={`role-badge role-${user.role.toLowerCase().replaceAll(' ', '-')}`}>{user.role}</span>
                            </td>
                            <td data-label="Status"><StatusBadge
                                status={user.active ? 'Active' : 'inactive'}>{user.active ? 'Active' : 'Deactivated'}</StatusBadge>
                            </td>
                            <td data-label="Last Active"
                                className="muted">{user.id === session.userId ? 'Online now' : relativeTime(user.lastActive)}</td>
                            <td data-label="Access">
                                <button
                                    className={`button button-small ${user.active ? 'button-secondary' : 'button-primary'}`}
                                    onClick={() => toggleUser(user.id)} disabled={user.id === 'u1'}><Power
                                    size={14}/>{user.active ? 'Deactivate' : 'Activate'}</button>
                            </td>
                        </tr>)}
                        </tbody>
                    </table>
                </div>
            </section>
            <section className="role-cards-section">
                <div className="section-heading">
                    <div><h2>Role Permissions</h2><p>Default access levels defined by the RetailTrack SRS.</p></div>
                </div>
                <div className="role-card-grid">
                    {Object.entries(roleDescriptions).map(([role, permissions], index) => <article
                        className="card role-card" key={role}><span
                        className={`role-card-icon role-color-${index}`}>{index === 0 ?
                        <ShieldCheck size={22}/> : index === 1 ? <UserCheck size={22}/> : <KeyRound size={22}/>}</span>
                        <h3>{role}</h3>
                        <p>{index === 0 ? 'Complete control over store operations and system access.' : index === 1 ? 'Focused tools for maintaining accurate stock records.' : 'A streamlined workspace for daily customer sales.'}</p>
                        <ul>{permissions.map((permission) => <li key={permission}><Check size={14}/>{permission}
                        </li>)}</ul>
                    </article>)}
                </div>
            </section>
            <AddUserModal open={addOpen} onClose={() => setAddOpen(false)}/>
        </div>
    );
}