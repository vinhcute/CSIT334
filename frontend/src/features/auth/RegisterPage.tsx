import { useState, type FormEvent } from "react";
import { TextField } from "../../components/TextField.js";
import { useAuthState } from "./authState.js";
import type { RegisterDriverRequest } from "./authTypes.js";
import {
  hasAuthErrors,
  validateRegistration,
  type AuthFormErrors,
} from "./authValidation.js";

interface RegisterPageProps {
  onSignIn(message?: string): void;
}

const initialRegistrationInput: RegisterDriverRequest = {
  name: "",
  universityId: "",
  email: "",
  password: "",
  licensePlate: "",
};

export function RegisterPage({ onSignIn }: RegisterPageProps) {
  const { register, status, error } = useAuthState();
  const [input, setInput] = useState<RegisterDriverRequest>(initialRegistrationInput);
  const [errors, setErrors] = useState<AuthFormErrors<keyof RegisterDriverRequest>>({});
  const isLoading = status === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateRegistration(input);
    setErrors(nextErrors);

    if (hasAuthErrors(nextErrors)) {
      return;
    }

    try {
      await register({
        ...input,
        email: input.email.trim(),
        name: input.name.trim(),
        universityId: input.universityId.trim(),
        licensePlate: input.licensePlate.trim(),
      });
      onSignIn("Account created. Sign in to continue.");
    } catch {
      // AuthProvider exposes a safe error message for the form banner.
    }
  }

  return (
    <section className="auth-page" aria-labelledby="register-title">
      <div className="auth-copy">
        <h1 id="register-title">Create Your UniPark Account</h1>
        <p>Register your campus identity and first vehicle profile to prepare your smart parking access.</p>
      </div>

      <form className="auth-card auth-card-wide" onSubmit={handleSubmit}>
        <div className="auth-card-heading">
          <h2>Create Account</h2>
          <p>Driver Registration</p>
        </div>

        {error ? <p className="form-banner-error">{error}</p> : null}

        <div className="form-grid">
          <TextField
            autoComplete="name"
            error={errors.name}
            label="Name"
            name="name"
            onChange={(event) => setInput({ ...input, name: event.target.value })}
            placeholder="Student name"
            value={input.name}
          />

          <TextField
            error={errors.universityId}
            label="University ID"
            name="universityId"
            onChange={(event) => setInput({ ...input, universityId: event.target.value })}
            placeholder="UOW000000"
            value={input.universityId}
          />

          <TextField
            error={errors.licensePlate}
            label="Licence Plate"
            name="licensePlate"
            onChange={(event) => setInput({ ...input, licensePlate: event.target.value })}
            placeholder="ABC-123"
            value={input.licensePlate}
          />

          <TextField
            autoComplete="email"
            error={errors.email}
            label="Email"
            name="email"
            onChange={(event) => setInput({ ...input, email: event.target.value })}
            placeholder="student@uow.edu.au"
            type="email"
            value={input.email}
          />

          <TextField
            autoComplete="new-password"
            error={errors.password}
            label="Password"
            name="password"
            onChange={(event) => setInput({ ...input, password: event.target.value })}
            placeholder="At least 8 characters"
            type="password"
            value={input.password}
          />
        </div>

        <button className="primary-button" disabled={isLoading} type="submit">
          {isLoading ? "Creating account..." : "Create Account"}
        </button>

        <div className="auth-links">
          <button className="text-button" onClick={() => onSignIn()} type="button">
            Already have an account?
          </button>
        </div>
      </form>
    </section>
  );
}
