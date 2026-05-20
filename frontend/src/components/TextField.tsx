import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, ...inputProps }: TextFieldProps) {
  const inputId = id ?? inputProps.name ?? label.toLowerCase().replaceAll(" ", "-");
  const errorId = `${inputId}-error`;

  return (
    <label className={error ? "form-field form-field-error" : "form-field"} htmlFor={inputId}>
      <span className="form-label">{label}</span>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        id={inputId}
        {...inputProps}
      />
      {error ? (
        <span className="form-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
