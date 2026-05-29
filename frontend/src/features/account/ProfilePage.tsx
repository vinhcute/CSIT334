import { useCallback, useEffect, useMemo, useState } from "react";
import type { SafeUser, VehicleProfile } from "../auth/authTypes.js";
import { useAuthState } from "../auth/authState.js";
import { createApiClient } from "../../services/apiClient.js";
import {
  createAccountApi,
  type UpdateProfileRequest,
  type VehicleProfileRequest,
} from "../../services/accountApi.js";
import { createSubscriptionApi } from "../../services/subscriptionApi.js";
import { VehicleProfilesPanel } from "./VehicleProfilesPanel.js";
import { SubscriptionPanel } from "./SubscriptionPanel.js";
import {
  getProfileSettingsErrorMessage,
  ProfileSettingsPanel,
} from "./ProfileSettingsPanel.js";

const sharedApiClient = createApiClient();

export type AccountView = "Dashboard" | "Account" | "Vehicles" | "Subscription" | "Settings";

interface ProfilePageProps {
  view?: AccountView;
}

export function ProfilePage({ view = "Dashboard" }: ProfilePageProps) {
  const { updateCurrentUser, user } = useAuthState();
  const accountApi = useMemo(() => createAccountApi(sharedApiClient), []);
  const subscriptionApi = useMemo(() => createSubscriptionApi(sharedApiClient), []);
  const [profile, setProfile] = useState<SafeUser | null>(user);
  const [vehicleProfiles, setVehicleProfiles] = useState<VehicleProfile[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const [currentProfile, vehicles] = await Promise.all([
        accountApi.getCurrentProfile(),
        accountApi.listMyVehicleProfiles(),
      ]);

      setProfile(currentProfile.user);
      setVehicleProfiles(vehicles.vehicleProfiles);
      setStatus("ready");
    } catch {
      setStatus("error");
      setError("Unable to load account data. Please check your connection and try again.");
    }
  }, [accountApi]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  async function handleSaveVehicle(input: VehicleProfileRequest, vehicleProfileId?: string) {
    setMessage(null);
    setError(null);

    try {
      const result = vehicleProfileId
        ? await accountApi.updateVehicleProfile(vehicleProfileId, input)
        : await accountApi.createVehicleProfile(input);

      setVehicleProfiles((profiles) => {
        if (!vehicleProfileId) {
          return [...profiles, result.vehicleProfile];
        }

        return profiles.map((profileItem) =>
          profileItem.id === vehicleProfileId ? result.vehicleProfile : profileItem,
        );
      });
      setMessage(vehicleProfileId ? "Vehicle profile updated." : "Vehicle profile added.");
    } catch (saveError) {
      setError(getVehicleErrorMessage(saveError));
      throw saveError;
    }
  }

  async function handleSaveProfile(input: UpdateProfileRequest) {
    setMessage(null);
    setError(null);
    setIsSavingProfile(true);

    try {
      const result = await accountApi.updateCurrentProfile(input);
      setProfile(result.user);
      updateCurrentUser(result.user);
      setMessage("Profile details updated.");
    } catch (saveError) {
      setError(getProfileSettingsErrorMessage(saveError));
      throw saveError;
    } finally {
      setIsSavingProfile(false);
    }
  }

  if (status === "loading") {
    return <AccountStateCard title="Loading account data..." variant="loading" />;
  }

  if (status === "error") {
    return (
      <AccountStateCard
        actionLabel="Retry"
        onAction={() => void loadAccount()}
        title="Unable to load data"
        variant="error"
      >
        {error}
      </AccountStateCard>
    );
  }

  return (
    <section className="account-page" aria-labelledby="account-title">
      {view === "Dashboard" || view === "Account" || view === "Settings" ? (
        <div className="account-header">
          <div>
            <p className="eyebrow">
              {view === "Settings" ? "Account Settings" : "Current Profile"}
            </p>
            <h1 id="account-title">
              {view === "Settings" ? "Settings" : profile?.name ?? "UniPark Account"}
            </h1>
            <p>{getViewSummary(view)}</p>
          </div>
        </div>
      ) : (
        <h2 className="sr-only" id="account-title">
          {view}
        </h2>
      )}

      {view === "Dashboard" || view === "Account" ? <ProfileSummary profile={profile} /> : null}

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-banner-error">{error}</p> : null}

      {view === "Dashboard" ? (
        <div className="account-grid">
          <VehicleProfilesPanel vehicleProfiles={vehicleProfiles} onSave={handleSaveVehicle} />
          <SubscriptionPanel subscriptionApi={subscriptionApi} />
        </div>
      ) : null}

      {view === "Vehicles" ? (
        <div className="account-single-panel">
          <VehicleProfilesPanel vehicleProfiles={vehicleProfiles} onSave={handleSaveVehicle} />
        </div>
      ) : null}

      {view === "Subscription" ? (
        <div className="account-single-panel">
          <SubscriptionPanel subscriptionApi={subscriptionApi} />
        </div>
      ) : null}

      {view === "Settings" ? (
        <div className="account-single-panel">
          <ProfileSettingsPanel
            isSaving={isSavingProfile}
            onSave={handleSaveProfile}
            profile={profile}
          />
        </div>
      ) : null}
    </section>
  );
}

function ProfileSummary({ profile }: { profile: SafeUser | null }) {
  return (
    <section className="account-card profile-card" aria-label="Current user profile">
      <dl className="profile-list">
        <div>
          <dt>Name</dt>
          <dd>{profile?.name ?? "Not provided"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{profile?.email}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{profile?.role ? formatLabel(profile.role) : "Not provided"}</dd>
        </div>
        <div>
          <dt>Account Status</dt>
          <dd>{profile?.accountStatus ? formatLabel(profile.accountStatus) : "Not provided"}</dd>
        </div>
      </dl>
    </section>
  );
}

interface AccountStateCardProps {
  title: string;
  variant: "loading" | "error" | "empty";
  children?: string | null;
  actionLabel?: string;
  onAction?: () => void;
}

function AccountStateCard({
  actionLabel,
  children,
  onAction,
  title,
  variant,
}: AccountStateCardProps) {
  return (
    <section className={`account-state account-state-${variant}`} aria-live="polite">
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {variant === "loading" ? <span className="loading-ring" aria-hidden="true" /> : null}
      {actionLabel && onAction ? (
        <button className="primary-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function getVehicleErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("409")) {
    return "A vehicle with this licence plate already exists.";
  }

  return "Unable to save vehicle profile. Please check the details and try again.";
}

function getViewSummary(view: AccountView): string {
  if (view === "Settings") {
    return "Edit your profile details for this admin or driver account.";
  }

  if (view === "Account") {
    return "Review your authenticated UniPark account details.";
  }

  return "Manage your profile, vehicle profiles, and simulated subscription access.";
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
