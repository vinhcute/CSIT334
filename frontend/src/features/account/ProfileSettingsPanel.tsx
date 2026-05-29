import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../services/apiClient.js";
import type { UpdateProfileRequest } from "../../services/accountApi.js";
import type { SafeUser } from "../auth/authTypes.js";

interface ProfileSettingsPanelProps {
  profile: SafeUser | null;
  isSaving: boolean;
  onSave(input: UpdateProfileRequest): Promise<void>;
}

interface ProfileSettingsValidation {
  name?: string;
  email?: string;
  universityId?: string;
}

const emptyInput: UpdateProfileRequest = {
  name: "",
  email: "",
  universityId: "",
};

export function ProfileSettingsPanel({ isSaving, onSave, profile }: ProfileSettingsPanelProps) {
  const [input, setInput] = useState<UpdateProfileRequest>(toProfileInput(profile));
  const [validation, setValidation] = useState<ProfileSettingsValidation>({});

  useEffect(() => {
    setInput(toProfileInput(profile));
    setValidation({});
  }, [profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValidation = validateProfileInput(input);

    if (Object.keys(nextValidation).length > 0) {
      setValidation(nextValidation);
      return;
    }

    setValidation({});
    await onSave({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      universityId: input.universityId.trim(),
    });
  }

  return (
    <section className="account-card settings-card" aria-labelledby="settings-profile-title">
      <div className="panel-heading">
        <h2 id="settings-profile-title">Profile Details</h2>
        <p>Update the profile details attached to your authenticated UniPark account.</p>
      </div>

      <form className="settings-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className={validation.name ? "form-field form-field-error" : "form-field"}>
          <span className="form-label">Name</span>
          <input
            autoComplete="name"
            onChange={(event) => setInput((current) => ({ ...current, name: event.target.value }))}
            value={input.name}
          />
          {validation.name ? <span className="form-error">{validation.name}</span> : null}
        </label>

        <label className={validation.email ? "form-field form-field-error" : "form-field"}>
          <span className="form-label">Email</span>
          <input
            autoComplete="email"
            onChange={(event) =>
              setInput((current) => ({ ...current, email: event.target.value }))
            }
            type="email"
            value={input.email}
          />
          {validation.email ? <span className="form-error">{validation.email}</span> : null}
        </label>

        <label className={validation.universityId ? "form-field form-field-error" : "form-field"}>
          <span className="form-label">University ID</span>
          <input
            autoComplete="off"
            onChange={(event) =>
              setInput((current) => ({ ...current, universityId: event.target.value }))
            }
            value={input.universityId}
          />
          {validation.universityId ? (
            <span className="form-error">{validation.universityId}</span>
          ) : null}
        </label>

        <div className="settings-readonly-grid" aria-label="Read-only account controls">
          <div>
            <span>Role</span>
            <strong>{profile?.role ? formatLabel(profile.role) : "Not provided"}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>
              {profile?.accountStatus ? formatLabel(profile.accountStatus) : "Not provided"}
            </strong>
          </div>
        </div>

        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? "Saving profile..." : "Save Profile"}
        </button>
      </form>
    </section>
  );
}

export function getProfileSettingsErrorMessage(error: unknown): string {
  if (error instanceof ApiError && typeof error.body === "object" && error.body) {
    const body = error.body as { error?: unknown };

    if (typeof body.error === "string") {
      return body.error;
    }
  }

  return "Unable to save profile details. Please check the details and try again.";
}

function toProfileInput(profile: SafeUser | null): UpdateProfileRequest {
  if (!profile) {
    return emptyInput;
  }

  return {
    name: profile.name ?? "",
    email: profile.email,
    universityId: profile.universityId ?? "",
  };
}

function validateProfileInput(input: UpdateProfileRequest): ProfileSettingsValidation {
  const validation: ProfileSettingsValidation = {};

  if (!input.name.trim()) {
    validation.name = "Name is required.";
  }

  if (!input.email.trim()) {
    validation.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    validation.email = "Enter a valid email address.";
  }

  if (!input.universityId.trim()) {
    validation.universityId = "University ID is required.";
  }

  return validation;
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
