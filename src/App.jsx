import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const zones = [
  { id: 'North Lot', capacity: 178, available: 54, distance: '2 min walk', trend: 92 },
  { id: 'Engineering', capacity: 132, available: 28, distance: '4 min walk', trend: 68 },
  { id: 'Library West', capacity: 96, available: 18, distance: '5 min walk', trend: 74 },
  { id: 'Sports Centre', capacity: 146, available: 89, distance: '8 min walk', trend: 46 },
];

const bookings = [
  { spot: 'A-14', zone: 'North Lot', time: '10:00 - 12:00', status: 'Confirmed' },
  { spot: 'C-08', zone: 'Engineering', time: '13:30 - 15:00', status: 'Reserved' },
  { spot: 'B-21', zone: 'Library West', time: 'Yesterday', status: 'Completed' },
];

const customers = [
  ['Jamie Cooper', '7552452', 'jcooper@uow.edu.au', 'Active', '2 vehicles'],
  ['Maya Richards', '8623879', 'mrichards@uow.edu.au', 'Active', '1 vehicle'],
  ['Alex Morgan', '8516261', 'amorgan@uow.edu.au', 'Review', '3 vehicles'],
  ['Taylor Nguyen', '8675478', 'tnguyen@uow.edu.au', 'Active', '1 vehicle'],
];

const vehicles = [
  ['Jamie Cooper', 'ABC 203', 'A-14', '10:00', '2h 45m', 'Active'],
  ['Maya Richards', 'MAY 404', 'B-09', '09:30', '1h 20m', 'Active'],
  ['Alex Morgan', 'AXL 901', 'C-12', '08:15', '4h 10m', 'Overdue'],
  ['Taylor Nguyen', 'TAY 118', 'D-04', '11:45', '35m', 'Active'],
];

function App() {
  const [screen, setScreen] = useState('auth');
  const [authMode, setAuthMode] = useState('signin');
  const [role, setRole] = useState('user');
  const [selectedGate, setSelectedGate] = useState('North Gate');
  const [selectedSpot, setSelectedSpot] = useState('A-14');

  const spots = useMemo(
    () =>
      Array.from({ length: 120 }, (_, index) => {
        const statusPool = ['available', 'available', 'available', 'occupied', 'reserved', 'disabled'];
        return {
          id: `${String.fromCharCode(65 + Math.floor(index / 24))}-${String(index + 1).padStart(2, '0')}`,
          status: statusPool[(index * 7 + 3) % statusPool.length],
        };
      }),
    []
  );

  const handleLogin = (nextRole) => {
    setRole(nextRole);
    setScreen(nextRole === 'admin' ? 'analytics' : 'dashboard');
  };

  const handleLogout = () => {
    setAuthMode('signin');
    setScreen('auth');
  };

  if (screen === 'auth') {
    return <AuthScreen mode={authMode} setMode={setAuthMode} onEnter={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <Sidebar current={screen} setScreen={setScreen} role={role} onLogout={handleLogout} />
      <main className="workspace">
        <Topbar setScreen={setScreen} role={role} />
        {screen === 'dashboard' && (
          <Dashboard setScreen={setScreen} zones={zones} bookings={bookings} setSelectedGate={setSelectedGate} />
        )}
        {screen === 'parking' && (
          <ParkingMap spots={spots} zones={zones} selectedSpot={selectedSpot} setSelectedSpot={setSelectedSpot} />
        )}
        {screen === 'booking' && <Booking selectedSpot={selectedSpot} setScreen={setScreen} />}
        {screen === 'analytics' && <Analytics zones={zones} />}
        {screen === 'vehicles' && <DataTable title="Current Vehicles" subtitle="Live campus vehicle status" rows={vehicles} />}
        {screen === 'customers' && <DataTable title="All Customers" subtitle="Account information and subscription status" rows={customers} />}
        {screen === 'incident' && <Incident />}
        {screen === 'detection' && <Detection spots={spots.slice(0, 18)} />}
        {screen === 'recommendation' && <Recommendation gate={selectedGate} setGate={setSelectedGate} zones={zones} />}
      </main>
    </div>
  );
}

function Sidebar({ current, setScreen, role, onLogout }) {
  const userItems = [
    ['dashboard', 'Dashboard'],
    ['parking', 'Parking Map'],
    ['booking', 'My Bookings'],
    ['recommendation', 'Smart Recommendation'],
    ['incident', 'Report Issue'],
  ];
  const adminItems = [
    ['analytics', 'Analytics'],
    ['vehicles', 'Current Vehicles'],
    ['customers', 'Customers'],
    ['detection', 'Smart Detection'],
    ['parking', 'Parking Map'],
  ];
  const items = role === 'admin' ? adminItems : userItems;
  const homeScreen = role === 'admin' ? 'analytics' : 'dashboard';

  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => setScreen(homeScreen)} aria-label="Go to home screen">
        <span className="brand-mark">P</span>
        <span>UniPark</span>
        <em className="role-badge">{role === 'admin' ? 'Admin' : 'User'}</em>
      </button>
      <nav>
        {items.map(([key, label]) => (
          <button key={key} className={current === key ? 'active' : ''} onClick={() => setScreen(key)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button>Settings</button>
        <button onClick={onLogout}>Logout</button>
      </div>
    </aside>
  );
}

function Topbar({ setScreen, role }) {
  const profile = role === 'admin'
    ? { initials: 'AD', name: 'Admin', target: 'customers' }
    : { initials: 'MN', name: 'Nhat Minh', target: 'dashboard' };
  return (
    <header className="topbar">
      <label className="search">
        <input placeholder="Search zones, bookings, vehicles" />
      </label>
      
      <button className="language">English</button>
      <button className="profile" onClick={() => setScreen(profile.target)}>
        <span className="avatar">{profile.initials}</span>
        <span>{profile.name}</span>
      </button>
    </header>
  );
}

function Dashboard({ setScreen, zones, bookings, setSelectedGate }) {
  const totalCapacity = zones.reduce((sum, zone) => sum + zone.capacity, 0);
  const totalAvailable = zones.reduce((sum, zone) => sum + zone.available, 0);
  const occupied = totalCapacity - totalAvailable;

  return (
    <section className="page">
      <div className="hero-dashboard">
        <div>
          <p className="eyebrow">Smart Parking Management System</p>
          <h1>Welcome to UniPark</h1>
          <p className="muted">Real-time campus parking, reservations, recommendations, and analytics in one place.</p>
        </div>
        <button className="primary" onClick={() => setScreen('parking')}>View Parking Map</button>
      </div>
      <div className="metric-grid">
        <Metric label="Total Capacity" value={totalCapacity} />
        <Metric label="Available Spots" value={totalAvailable} tone="good" />
        <Metric label="Occupied" value={occupied} tone="danger" />
        <Metric label="Active Bookings" value={bookings.length} tone="warn" />
      </div>
      <div className="dashboard-grid">
        <section className="panel wide">
          <div className="panel-head">
            <h2>Zone Status</h2>
            <button onClick={() => setScreen('recommendation')}>Get Recommendation</button>
          </div>
          <div className="zone-list">
            {zones.map((zone) => (
              <button
                key={zone.id}
                className="zone-row"
                onClick={() => {
                  setSelectedGate('North Gate');
                  setScreen('recommendation');
                }}
              >
                <span>{zone.id}</span>
                <strong>{zone.available} available</strong>
                <div className="bar"><span style={{ width: `${zone.trend}%` }} /></div>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>My Bookings</h2>
            <button onClick={() => setScreen('booking')}>New</button>
          </div>
          {bookings.map((booking) => (
            <div className="booking-row" key={`${booking.spot}-${booking.time}`}>
              <span>{booking.spot}</span>
              <div>
                <strong>{booking.zone}</strong>
                <p>{booking.time}</p>
              </div>
              <em>{booking.status}</em>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = '' }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ParkingMap({ spots, zones, selectedSpot, setSelectedSpot }) {
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <h1>Parking Map</h1>
          <p>Colour and text labels show live availability for accessible campus use.</p>
        </div>
        <select aria-label="Zone filter">
          {zones.map((zone) => <option key={zone.id}>{zone.id}</option>)}
        </select>
      </div>
      <div className="parking-layout">
        <div className="map-panel">
          <div className="spot-grid">
            {spots.map((spot) => (
              <button
                key={spot.id}
                className={`spot ${spot.status} ${selectedSpot === spot.id ? 'selected' : ''}`}
                title={`${spot.id} ${spot.status}`}
                onClick={() => setSelectedSpot(spot.id)}
              >
                <span>{spot.id}</span>
              </button>
            ))}
          </div>
          <div className="legend">
            {['available', 'occupied', 'reserved', 'disabled'].map((item) => <span key={item}><i className={item} />{item}</span>)}
          </div>
        </div>
        <aside className="insight-panel">
          <Metric label="Total Capacity" value="540" />
          <Metric label="Available" value="189" tone="good" />
          <Metric label="Current Occupancy" value="68%" tone="warn" />
          <Metric label="Live Visitors" value="1,024" />
          <button className="primary block">Book {selectedSpot}</button>
        </aside>
      </div>
    </section>
  );
}

function Booking({ selectedSpot, setScreen }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <section className="page narrow">
      <div className="page-title">
        <div>
          <h1>Book Parking Spot</h1>
          <p>Create a reservation and prevent time-window conflicts.</p>
        </div>
      </div>
      <form className="form-panel" onSubmit={(event) => { event.preventDefault(); setConfirmed(true); }}>
        <label>Spot ID<input defaultValue={selectedSpot} /></label>
        <label>Parking Zone<select defaultValue="North Lot"><option>North Lot</option><option>Engineering</option><option>Library West</option></select></label>
        <div className="form-grid">
          <label>Start Time<input type="time" defaultValue="10:00" /></label>
          <label>End Time<input type="time" defaultValue="12:00" /></label>
        </div>
        <label>Vehicle Plate<input defaultValue="ABC 203" /></label>
        <button className="primary">Confirm Booking</button>
        {confirmed && <p className="success">Booking confirmed. Notification sent to your account.</p>}
      </form>
      <button className="ghost" onClick={() => setScreen('parking')}>Back to Map</button>
    </section>
  );
}

function Recommendation({ gate, setGate, zones }) {
  const best = zones.slice().sort((a, b) => b.available - a.available)[0];
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <h1>Smart Recommendation</h1>
          <p>Choose an entry gate to find the nearest available and least congested zone.</p>
        </div>
        <select value={gate} onChange={(event) => setGate(event.target.value)} aria-label="Entry gate">
          <option>North Gate</option>
          <option>South Gate</option>
          <option>East Gate</option>
        </select>
      </div>
      <div className="recommend-card">
        <div>
          <p className="eyebrow">{gate}</p>
          <h2>{best.id}</h2>
          <p>{best.available} spaces available, {best.distance}, predicted availability {best.trend}%.</p>
        </div>
        <button className="primary">Navigate</button>
      </div>
      <div className="metric-grid">
        {zones.map((zone) => <Metric key={zone.id} label={zone.id} value={`${zone.available}/${zone.capacity}`} />)}
      </div>
    </section>
  );
}

function Analytics({ zones }) {
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <h1>Campus Analytics</h1>
          <p>Admin overview of utilisation, bookings, and zone performance.</p>
        </div>
        <input type="date" defaultValue="2026-05-14" />
      </div>
      <div className="metric-grid">
        <Metric label="Daily Revenue" value="$142,850" />
        <Metric label="Peak Occupancy" value="94.2%" tone="danger" />
        <Metric label="Active Users" value="12,402" />
        <Metric label="Open Issues" value="12" tone="warn" />
      </div>
      <section className="panel">
        <div className="panel-head"><h2>Lot Utilisation vs Time</h2></div>
        <div className="chart">
          {zones.map((zone) => <span key={zone.id} style={{ height: `${zone.trend}%` }} title={zone.id} />)}
        </div>
      </section>
    </section>
  );
}

function DataTable({ title, subtitle, rows }) {
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <select><option>Sort by newest</option><option>Sort by status</option></select>
      </div>
      <section className="panel table-panel">
        <table>
          <thead><tr><th>Name</th><th>ID / Plate</th><th>Location / Email</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join('-')}>
                {row.map((cell, index) => <td key={`${cell}-${index}`}><span className={String(cell).toLowerCase()}>{cell}</span></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function Incident() {
  return (
    <section className="page">
      <div className="split-panel">
        <div>
          <p className="eyebrow danger-text">Account Disabled</p>
          <h1>Incident Report Subsystem</h1>
          <p>Review reported issues, no-show events, overdue vehicles, and system alerts.</p>
          {['Booking status reviewed', 'Sensor feed validated', 'Issue marked for admin follow-up'].map((item) => (
            <div className="timeline" key={item}><span />{item}</div>
          ))}
        </div>
        <form className="form-panel">
          <label>Issue Type<select><option>Blocked parking spot</option><option>Sensor mismatch</option><option>Payment issue</option></select></label>
          <label>Spot ID<input defaultValue="A-14" /></label>
          <label>Description<textarea defaultValue="Vehicle is occupying a reserved spot." /></label>
          <button className="primary">Submit Report</button>
        </form>
      </div>
    </section>
  );
}

function Detection({ spots }) {
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <h1>Smart Detection</h1>
          <p>Simulated sensor feed updates parking states within the real-time dashboard.</p>
        </div>
      </div>
      <div className="detection-feed">
        {spots.map((spot, index) => (
          <div className="sensor-card" key={spot.id}>
            <span className={`pulse ${spot.status}`} />
            <strong>{spot.id}</strong>
            <p>{index % 3 === 0 ? 'Vehicle detected' : index % 3 === 1 ? 'Vehicle left' : 'Signal stable'}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuthScreen({ mode, setMode, onEnter }) {
  const [loginRole, setLoginRole] = useState('user');
  const isCreate = mode === 'create';
  const isForgot = mode === 'forgot';
  const effectiveRole = isCreate ? 'user' : loginRole;
  return (
    <main className="auth-page">
      <section className="auth-visual">
        <span className="brand-mark">P</span>
        <h1>{isForgot ? 'Precision Meets Account Recovery' : isCreate ? 'Precision Access for the Modern Campus' : 'The Gateway to Your Campus Journey'}</h1>
        <p>Smart parking access for students, staff, and administrators.</p>
      </section>
      <section className="auth-card">
        <h2>{isForgot ? 'Forgot Password' : isCreate ? 'Create Account' : 'Institutional Sign-In'}</h2>
        <p>{isForgot ? 'Enter your institutional email to receive a reset link.' : effectiveRole === 'admin' ? 'Admin access for analytics, customers, vehicles, and reports.' : 'User access for parking maps, recommendations, and bookings.'}</p>
        {!isCreate && !isForgot && (
          <div className="role-tabs" aria-label="Choose login role">
            <button type="button" className={loginRole === 'user' ? 'role-tab active' : 'role-tab'} onClick={() => setLoginRole('user')}>User</button>
            <button type="button" className={loginRole === 'admin' ? 'role-tab active' : 'role-tab'} onClick={() => setLoginRole('admin')}>Admin</button>
          </div>
        )}
        <form onSubmit={(event) => { event.preventDefault(); onEnter(effectiveRole); }}>
          {isCreate && <label>Full Name<input placeholder="Jamie Cooper" /></label>}
          <label>Email Address<input type="email" placeholder="name@uow.edu.au" /></label>
          {!isForgot && <label>Password<input type="password" placeholder="Enter password" /></label>}
          {isCreate && <label>Vehicle Plate<input placeholder="ABC 203" /></label>}
          <button className="primary block">{isForgot ? 'Send Reset Link' : isCreate ? 'Create Account' : `Sign In as ${effectiveRole === 'admin' ? 'Admin' : 'User'}`}</button>
        </form>
        <div className="auth-links">
          <button onClick={() => setMode('signin')}>Sign In</button>
          <button onClick={() => setMode('create')}>Create Account</button>
          <button onClick={() => setMode('forgot')}>Forgot Password</button>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);

