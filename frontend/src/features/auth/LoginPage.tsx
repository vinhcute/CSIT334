import { useState, type FormEvent } from "react";
import { TextField } from "../../components/TextField.js";
import { useAuthState } from "./authState.js";
import type { LoginRequest } from "./authTypes.js";
import { hasAuthErrors, validateLogin, type AuthFormErrors } from "./authValidation.js";

interface LoginPageProps {
  onCreateAccount(): void;
  registrationMessage?: string | null;
}

const initialLoginInput: LoginRequest = {
  email: "",
  password: "",
};

export function LoginPage({ onCreateAccount, registrationMessage }: LoginPageProps) {
  const { login, status, error } = useAuthState();
  const [input, setInput] = useState<LoginRequest>(initialLoginInput);
  const [errors, setErrors] = useState<AuthFormErrors<keyof LoginRequest>>({});
  const isLoading = status === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateLogin(input);
    setErrors(nextErrors);

    if (hasAuthErrors(nextErrors)) {
      return;
    }

    try {
      await login({
        email: input.email.trim(),
        password: input.password,
      });
    } catch {
      // AuthProvider exposes a safe error message for the form banner.
    }
  }

  return (
    <section className="auth-page" aria-labelledby="login-title">
      <div className="auth-copy">
        <h1 id="login-title">Welcome Back to UniPark</h1>
        <p>Access your smart parking dashboard, bookings, and campus parking recommendations.</p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-heading">
          <h2>Sign In</h2>
          <p>University Parking Authority</p>
        </div>

        {registrationMessage ? <p className="form-success">{registrationMessage}</p> : null}
        {error ? <p className="form-banner-error">{error}</p> : null}

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
          autoComplete="current-password"
          error={errors.password}
          label="Password"
          name="password"
          onChange={(event) => setInput({ ...input, password: event.target.value })}
          placeholder="Enter password"
          type="password"
          value={input.password}
        />

        <button className="primary-button" disabled={isLoading} type="submit">
          {isLoading ? "Signing in..." : "Sign In"}
        </button>

        <div className="auth-links">
          <button className="text-button" type="button">
            Forgot password?
          </button>
          <button className="text-button" onClick={onCreateAccount} type="button">
            Create account
          </button>
        </div>
      </form>
    </section>
  );
}
