import { useState } from "react";
import type {
  CreateSubscriptionResponse,
  SubscriptionType,
} from "../../services/subscriptionApi.js";
import type { createSubscriptionApi } from "../../services/subscriptionApi.js";

interface SubscriptionPanelProps {
  subscriptionApi: ReturnType<typeof createSubscriptionApi>;
}

const subscriptionOptions: Array<{ type: SubscriptionType; label: string; detail: string }> = [
  { type: "daily", label: "Daily", detail: "One day simulated permit" },
  { type: "weekly", label: "Weekly", detail: "Seven day simulated permit" },
  { type: "monthly", label: "Monthly", detail: "Thirty day simulated permit" },
];

export function SubscriptionPanel({ subscriptionApi }: SubscriptionPanelProps) {
  const [selectedType, setSelectedType] = useState<SubscriptionType>("daily");
  const [result, setResult] = useState<CreateSubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);

    try {
      const nextResult = await subscriptionApi.createSubscription(selectedType);
      setResult(nextResult);
    } catch {
      setError("Unable to activate simulated subscription. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="account-card" aria-labelledby="subscription-title">
      <div className="panel-heading">
        <h2 id="subscription-title">Subscription</h2>
        <p>Choose a simulated permit. No real payment will be processed.</p>
      </div>

      <div className="subscription-options" role="radiogroup" aria-label="Subscription type">
        {subscriptionOptions.map((option) => (
          <label
            className={
              selectedType === option.type
                ? "subscription-option subscription-option-active"
                : "subscription-option"
            }
            key={option.type}
          >
            <input
              checked={selectedType === option.type}
              name="subscriptionType"
              onChange={() => setSelectedType(option.type)}
              type="radio"
              value={option.type}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.detail}</small>
            </span>
          </label>
        ))}
      </div>

      {error ? <p className="form-banner-error">{error}</p> : null}
      {result ? (
        <p className="form-success">
          {result.message} Active until {new Date(result.subscription.endTime).toLocaleDateString()}.
        </p>
      ) : null}

      <button className="primary-button" disabled={isSaving} onClick={handleSubmit} type="button">
        {isSaving ? "Activating..." : "Activate Simulated Subscription"}
      </button>
    </section>
  );
}
