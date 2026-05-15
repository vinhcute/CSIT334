import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccountStatus, SafeUser } from "../auth/authTypes.js";
import { useAuthState } from "../auth/authState.js";
import { createApiClient } from "../../services/apiClient.js";
import {
  createAdminUsersApi,
  type AdminUserSummary,
} from "../../services/adminUsersApi.js";

const sharedApiClient = createApiClient();

type AdminUsersStatus = "loading" | "ready" | "empty" | "error";
type AdminAccountAction = "disable" | "reactivate";

interface PendingAccountAction {
  action: AdminAccountAction;
  user: AdminUserSummary;
}

export function canViewAdminUsers(user: SafeUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function getAccountStatusClass(status: AccountStatus): string {
  return `status-badge status-badge-${status}`;
}

export function getAccountActionForStatus(status: AccountStatus): AdminAccountAction {
  return status === "disabled" ? "reactivate" : "disable";
}

export function userSummaryHasSensitiveFields(user: Record<string, unknown>): boolean {
  return "passwordHash" in user;
}

export function AdminUsersPage() {
  const { user } = useAuthState();
  const adminUsersApi = useMemo(() => createAdminUsersApi(sharedApiClient), []);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [status, setStatus] = useState<AdminUsersStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAccountAction | null>(null);

  const loadUsers = useCallback(async () => {
    if (!canViewAdminUsers(user)) {
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const result = await adminUsersApi.listUsers();
      setUsers(result.users);
      setStatus(result.users.length > 0 ? "ready" : "empty");
    } catch {
      setStatus("error");
      setError("Unable to load account summaries. Please retry after checking the API server.");
    }
  }, [adminUsersApi, user]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  if (!canViewAdminUsers(user)) {
    return (
      <section className="account-state account-state-error admin-state" aria-live="polite">
        <h2>Permission denied</h2>
        <p>Admin account management is restricted to UniPark administrator accounts.</p>
      </section>
    );
  }

  async function confirmAccountAction() {
    if (!pendingAction) {
      return;
    }

    setMessage(null);
    setError(null);

    try {
      const result =
        pendingAction.action === "disable"
          ? await adminUsersApi.disableUser(pendingAction.user.id)
          : await adminUsersApi.reactivateUser(pendingAction.user.id);

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === result.user.id ? result.user : currentUser,
        ),
      );
      setMessage(
        pendingAction.action === "disable"
          ? "Account disabled. The status is now visible to admins."
          : "Account reactivated. The status is now visible to admins.",
      );
      setPendingAction(null);
    } catch {
      setError("Unable to update this account status. Please retry before moving on.");
    }
  }

  if (status === "loading") {
    return (
      <section className="account-state account-state-loading admin-state" aria-live="polite">
        <h2>Loading account summaries...</h2>
        <span className="loading-ring" aria-hidden="true" />
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="account-state account-state-error admin-state" aria-live="polite">
        <h2>Unable to load users</h2>
        <p>{error}</p>
        <button className="primary-button" onClick={() => void loadUsers()} type="button">
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="admin-users-page" aria-labelledby="admin-users-title">
      <div className="account-header">
        <p className="eyebrow">Admin Account Controls</p>
        <h2 id="admin-users-title">User Account Management</h2>
        <p>View, disable, and reactivate driver accounts.</p>
      </div>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-banner-error">{error}</p> : null}

      {pendingAction ? (
        <section className="admin-confirmation" aria-live="polite">
          <div>
            <p className="eyebrow">Confirm {pendingAction.action}</p>
            <h3>{getDisplayName(pendingAction.user)}</h3>
            <p>
              This will {pendingAction.action} account access for{" "}
              {pendingAction.user.email}.
            </p>
          </div>
          <div className="admin-confirmation-actions">
            <button
              className="primary-button"
              onClick={() => void confirmAccountAction()}
              type="button"
            >
              Confirm {pendingAction.action}
            </button>
            <button
              className="secondary-button"
              onClick={() => setPendingAction(null)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {status === "empty" ? (
        <section className="account-state account-state-empty admin-state" aria-live="polite">
          <h2>No accounts found</h2>
          <p>User accounts will appear here after registration or seed data is available.</p>
        </section>
      ) : (
        <div className="admin-users-table" role="table" aria-label="User account summaries">
          <div className="admin-users-row admin-users-row-heading" role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">Email</span>
            <span role="columnheader">Role</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Action</span>
          </div>
          {users.map((account) => {
            const action = getAccountActionForStatus(account.accountStatus);

            return (
              <div className="admin-users-row" key={account.id} role="row">
                <span role="cell">
                  <strong>{getDisplayName(account)}</strong>
                  {account.universityId ? <small>{account.universityId}</small> : null}
                </span>
                <span role="cell">{account.email}</span>
                <span role="cell">{formatLabel(account.role)}</span>
                <span role="cell">
                  <span className={getAccountStatusClass(account.accountStatus)}>
                    {formatLabel(account.accountStatus)}
                  </span>
                </span>
                <span role="cell">
                  <button
                    className={action === "disable" ? "danger-button" : "secondary-button"}
                    onClick={() => setPendingAction({ action, user: account })}
                    type="button"
                  >
                    {action === "disable" ? "Disable" : "Reactivate"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getDisplayName(user: AdminUserSummary) {
  return user.name ?? user.email;
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
