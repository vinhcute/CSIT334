import { useState, type FormEvent } from "react";
import { TextField } from "../../components/TextField.js";
import type { VehicleProfile } from "../auth/authTypes.js";
import type { VehicleProfileRequest } from "../../services/accountApi.js";

interface VehicleProfilesPanelProps {
  vehicleProfiles: VehicleProfile[];
  onSave(input: VehicleProfileRequest, vehicleProfileId?: string): Promise<void>;
}

const emptyVehicleInput: VehicleProfileRequest = {
  licensePlate: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleColor: "",
};

export function VehicleProfilesPanel({ vehicleProfiles, onSave }: VehicleProfilesPanelProps) {
  const [input, setInput] = useState<VehicleProfileRequest>(emptyVehicleInput);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [licensePlateError, setLicensePlateError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const licensePlate = input.licensePlate.trim();

    if (!licensePlate) {
      setLicensePlateError("Licence plate is required.");
      return;
    }

    setIsSaving(true);
    setLicensePlateError(undefined);

    try {
      await onSave(
        {
          ...input,
          licensePlate,
          vehicleMake: input.vehicleMake?.trim() || undefined,
          vehicleModel: input.vehicleModel?.trim() || undefined,
          vehicleColor: input.vehicleColor?.trim() || undefined,
        },
        editingId,
      );
      setInput(emptyVehicleInput);
      setEditingId(undefined);
    } catch {
      setLicensePlateError("Unable to save this licence plate.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(vehicleProfile: VehicleProfile) {
    setEditingId(vehicleProfile.id);
    setInput({
      licensePlate: vehicleProfile.licensePlate,
      vehicleMake: vehicleProfile.vehicleMake ?? "",
      vehicleModel: vehicleProfile.vehicleModel ?? "",
      vehicleColor: vehicleProfile.vehicleColor ?? "",
      isPrimary: vehicleProfile.isPrimary,
    });
    setLicensePlateError(undefined);
  }

  return (
    <section className="account-card" aria-labelledby="vehicles-title">
      <div className="panel-heading">
        <h2 id="vehicles-title">My Vehicles</h2>
        <p>{vehicleProfiles.length ? "Only your authenticated vehicles are shown." : "No vehicles yet."}</p>
      </div>

      {vehicleProfiles.length ? (
        <ul className="vehicle-list">
          {vehicleProfiles.map((vehicleProfile) => (
            <li key={vehicleProfile.id}>
              <div>
                <strong>{vehicleProfile.licensePlate}</strong>
                <span>
                  {[vehicleProfile.vehicleColor, vehicleProfile.vehicleMake, vehicleProfile.vehicleModel]
                    .filter(Boolean)
                    .join(" ") || "Vehicle details not provided"}
                </span>
              </div>
              <button className="text-button" onClick={() => startEditing(vehicleProfile)} type="button">
                Edit
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <h3>No vehicles yet</h3>
          <p>Add your first vehicle profile to connect it to your parking account.</p>
        </div>
      )}

      <form className="vehicle-form" onSubmit={handleSubmit}>
        <TextField
          error={licensePlateError}
          label="Licence Plate"
          name="licensePlate"
          onChange={(event) => setInput({ ...input, licensePlate: event.target.value })}
          placeholder="ABC-123"
          value={input.licensePlate}
        />
        <TextField
          label="Make"
          name="vehicleMake"
          onChange={(event) => setInput({ ...input, vehicleMake: event.target.value })}
          placeholder="Toyota"
          value={input.vehicleMake}
        />
        <TextField
          label="Model"
          name="vehicleModel"
          onChange={(event) => setInput({ ...input, vehicleModel: event.target.value })}
          placeholder="Corolla"
          value={input.vehicleModel}
        />
        <TextField
          label="Colour"
          name="vehicleColor"
          onChange={(event) => setInput({ ...input, vehicleColor: event.target.value })}
          placeholder="White"
          value={input.vehicleColor}
        />
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : editingId ? "Update Vehicle" : "Add Vehicle"}
        </button>
      </form>
    </section>
  );
}
