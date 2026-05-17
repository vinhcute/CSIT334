import { useState } from "react";
import { ProfilePage, type AccountView } from "./features/account/ProfilePage.js";
import {
  AdminParkingInventoryPage,
  type AdminParkingInventoryView,
} from "./features/admin/AdminParkingInventoryPage.js";
import { AdminAnalyticsPage } from "./features/admin/AdminAnalyticsPage.js";
import { AdminIncidentManagementPage } from "./features/admin/AdminIncidentManagementPage.js";
import { AdminSensorEventsPage } from "./features/admin/AdminSensorEventsPage.js";
import { AdminUsersPage } from "./features/admin/AdminUsersPage.js";
import { LoginPage } from "./features/auth/LoginPage.js";
import { RegisterPage } from "./features/auth/RegisterPage.js";
import { useAuthState } from "./features/auth/authState.js";
import { ParkingDashboardPage } from "./features/parking/ParkingDashboardPage.js";
import { ParkingMapPage } from "./features/parking/ParkingMapPage.js";
import { ReportIssuePage } from "./features/parking/ReportIssuePage.js";
import type { UserRole } from "./features/auth/authTypes.js";

const driverSidebarItems = [
  "Dashboard",
  "Parking Map",
  "My Bookings",
  "My Vehicles",
  "Report Issue",
  "Subscription / Permit",
  "Settings",
  "Logout",
] as const;

const adminSidebarItems = [
  "Dashboard",
  "Users",
  "Zones",
  "Spots",
  "Sensors",
  "Bookings",
  "Incidents",
  "Analytics",
  "Settings",
  "Logout",
] as const;

type DriverSection = (typeof driverSidebarItems)[number];
type AdminSection = (typeof adminSidebarItems)[number];
type AppSection = DriverSection | AdminSection;

const accountViewBySection: Partial<Record<AppSection, AccountView>> = {
  "My Vehicles": "Vehicles",
  "Subscription / Permit": "Subscription",
};

export function App() {
  const { user, status, logout } = useAuthState();
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [activeSection, setActiveSection] = useState<AppSection>("Dashboard");
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null);
  const isAuthenticated = status === "authenticated" && user;

  if (status === "loading" || status === "idle") {
    return (
      <main className="auth-page" aria-live="polite">
        <section className="account-state account-state-loading">
          <h1>Loading account session...</h1>
          <span className="loading-ring" aria-hidden="true" />
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return authView === "login" ? (
      <LoginPage
        onCreateAccount={() => {
          setRegistrationMessage(null);
          setAuthView("register");
        }}
        registrationMessage={registrationMessage}
      />
    ) : (
      <RegisterPage
        onSignIn={(message) => {
          setRegistrationMessage(message ?? null);
          setAuthView("login");
        }}
      />
    );
  }

  const sidebarItems = getSidebarItems(user.role);
  const primarySidebarItems = sidebarItems.filter((item) => item !== "Settings" && item !== "Logout");
  const effectiveSection = sidebarItems.includes(activeSection) ? activeSection : "Dashboard";
  const pageTitle = getPageTitle(effectiveSection);

  return (
    <main className="app-shell" aria-label="UniPark application shell">
      <aside className="sidebar app-sidebar" aria-label="Primary navigation">
        <button
          className="brand brand-button sidebar-logo"
          onClick={() => setActiveSection("Dashboard")}
          type="button"
        >
          UniPark
        </button>
        <nav className="nav-list sidebar-nav sidebar-nav-main">
          {primarySidebarItems.map((item) => (
            <button
              className={effectiveSection === item ? "nav-link nav-link-active" : "nav-link"}
              key={item}
              onClick={() => setActiveSection(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" aria-hidden="true" />
        <nav className="nav-list sidebar-nav sidebar-nav-bottom" aria-label="Session navigation">
          <button
            className={effectiveSection === "Settings" ? "nav-link nav-link-active" : "nav-link"}
            onClick={() => setActiveSection("Settings")}
            type="button"
          >
            Settings
          </button>
          <button className="nav-link" onClick={() => void logout()} type="button">
            Logout
          </button>
        </nav>
      </aside>

      <section className="workspace" aria-label="Account workspace">
        <header className="top-bar">
          <label className="search-field">
            <span className="sr-only">Search</span>
            <input type="search" placeholder="Search" />
          </label>
          <div className="user-summary" aria-label="Signed in user placeholder">
            <span className="user-name">{user.name ?? user.email}</span>
            <span className="user-role">{formatRole(user.role)}</span>
          </div>
        </header>

        {shouldShowDefaultIntro(effectiveSection) ? (
          <section className="page-intro" aria-labelledby="page-title">
            <p className="eyebrow">Authenticated Account Area</p>
            <h1 id="page-title">{pageTitle}</h1>
            <p>
              Your secure account session is active. Profile, vehicle, and subscription tools are ready.
            </p>
          </section>
        ) : null}

        {effectiveSection === "Dashboard" ? (
          <ParkingDashboardPage />
        ) : effectiveSection === "Parking Map" ? (
          <ParkingMapPage />
        ) : effectiveSection === "Report Issue" ? (
          <ReportIssuePage />
        ) : effectiveSection === "Users" ? (
          <AdminUsersPage />
        ) : isAdminParkingInventorySection(effectiveSection) ? (
          <AdminParkingInventoryPage
            initialView={getAdminParkingInventoryView(effectiveSection)}
            onReturnDashboard={() => setActiveSection("Dashboard")}
          />
        ) : effectiveSection === "Sensors" ? (
          <AdminSensorEventsPage />
        ) : effectiveSection === "Incidents" ? (
          <AdminIncidentManagementPage />
        ) : effectiveSection === "Analytics" ? (
          <AdminAnalyticsPage />
        ) : effectiveSection === "Settings" ? (
          <DeferredState title="Settings" />
        ) : user.role === "admin" ? (
          <DeferredState title={pageTitle} />
        ) : accountViewBySection[effectiveSection] ? (
          <ProfilePage view={accountViewBySection[effectiveSection]} />
        ) : (
          <DeferredState title={pageTitle} />
        )}
      </section>
    </main>
  );
}

function getSidebarItems(role: UserRole): readonly AppSection[] {
  return role === "admin" ? adminSidebarItems : driverSidebarItems;
}

function formatRole(role: UserRole): string {
  return role === "admin" ? "Admin" : "Driver";
}

function getPageTitle(section: AppSection): string {
  if (section === "Dashboard") {
    return "Welcome to UniPark";
  }

  if (section === "Zones") {
    return "Zone Management";
  }

  if (section === "Spots") {
    return "Spot Management";
  }

  if (section === "Sensors") {
    return "Simulated Sensor Events";
  }

  if (section === "My Vehicles") {
    return "Vehicles";
  }

  if (section === "Subscription / Permit") {
    return "Subscription + Parking Permit";
  }

  return section;
}

function isAdminParkingInventorySection(section: AppSection): section is "Zones" | "Spots" {
  return section === "Zones" || section === "Spots";
}

function getAdminParkingInventoryView(section: "Zones" | "Spots"): AdminParkingInventoryView {
  return section === "Zones" ? "zones" : "spots";
}

function shouldShowDefaultIntro(section: AppSection): boolean {
  return (
    section !== "Dashboard" &&
    section !== "Parking Map" &&
    section !== "Report Issue" &&
    section !== "Users" &&
    section !== "Sensors" &&
    section !== "Incidents" &&
    section !== "Analytics" &&
    !isAdminParkingInventorySection(section)
  );
}

function DeferredState({ title }: { title: string }) {
  return (
    <section className="account-state account-state-empty">
      <h2>{title}</h2>
      <p>This screen will be added in a later verification loop.</p>
    </section>
  );
}
