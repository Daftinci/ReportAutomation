import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/client';

const ACCENT = '#5538ee';

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1.5L2 3.5v3c0 2.8 2 5 4.5 6 2.5-1 4.5-3.2 4.5-6v-3z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="4.5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 11.5c0-2.2 2.2-4 5-4s5 1.8 5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Add User Modal ───────────────────────────────────────────────────────────

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'standard' | 'admin'>('standard');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await api.createUser(username.trim(), password, role);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-7">
        <h2 className="text-[16px] font-bold text-slate-900 mb-5">Add new user</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Username</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13.5px] outline-none focus:border-[#5538ee] bg-slate-50"
              placeholder="johndoe"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13.5px] outline-none focus:border-[#5538ee] bg-slate-50"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'standard' | 'admin')}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13.5px] outline-none focus:border-[#5538ee] bg-slate-50"
            >
              <option value="standard">Standard user</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="flex-1 h-10 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50 transition-opacity"
              style={{ background: ACCENT }}
            >
              {loading ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({ user, onClose, onSaved }: {
  user: api.User; onClose: () => void; onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await api.updateUser(user.id, { password });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-7">
        <h2 className="text-[16px] font-bold text-slate-900 mb-1">Change password</h2>
        <p className="text-[12.5px] text-slate-500 mb-5">For <span className="font-semibold text-slate-700">{user.username}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">New password</label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13.5px] outline-none focus:border-[#5538ee] bg-slate-50"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13.5px] outline-none focus:border-[#5538ee] bg-slate-50"
              placeholder="Repeat new password"
            />
          </div>

          {error && (
            <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !password || !confirm}
              className="flex-1 h-10 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50 transition-opacity"
              style={{ background: ACCENT }}>
              {loading ? 'Saving…' : 'Save password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Users Page ───────────────────────────────────────────────────────────────

export default function UsersPage({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<api.User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<api.User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRoleChange = async (user: api.User, newRole: 'admin' | 'standard') => {
    try {
      await api.updateUser(user.id, { role: newRole });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
      showToast(`${user.username} is now ${newRole === 'admin' ? 'an admin' : 'a standard user'}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleDelete = async (user: api.User) => {
    setDeletingId(user.id);
    try {
      await api.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      showToast(`${user.username} deleted`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-8">
      <div className="max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[20px] font-bold text-slate-900">User management</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Manage accounts and permissions</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-white text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: ACCENT }}
          >
            <PlusIcon />
            Add user
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 text-[13px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-[13px] text-slate-400">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-slate-400">No users found</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">User</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Role</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Created</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            {user.role === 'admin' ? <ShieldIcon /> : <UserIcon />}
                          </div>
                          <div>
                            <div className="text-[13.5px] font-semibold text-slate-800">{user.username}</div>
                            {isSelf && <div className="text-[11px] text-slate-400">You</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as 'admin' | 'standard')}
                          disabled={isSelf}
                          className="h-8 px-2.5 rounded-lg border border-slate-200 text-[12.5px] bg-white outline-none focus:border-[#5538ee] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="standard">Standard user</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-[12.5px] text-slate-500">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setPasswordTarget(user)}
                            className="h-8 px-3 rounded-lg text-[12px] text-slate-600 hover:bg-slate-100 transition-colors"
                            title="Change password"
                          >
                            Change password
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => handleDelete(user)}
                              disabled={deletingId === user.id}
                              className="h-8 px-3 rounded-lg text-[12px] text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
                              title="Delete user"
                            >
                              {deletingId === user.id ? 'Deleting…' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {addOpen && (
        <AddUserModal onClose={() => setAddOpen(false)} onCreated={loadUsers} />
      )}
      {passwordTarget && (
        <ChangePasswordModal
          user={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSaved={() => showToast('Password updated')}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white text-[12.5px] font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
