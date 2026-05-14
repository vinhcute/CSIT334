# UI Test Accounts

Use these accounts for local UI testing only. Do not reuse these passwords in production or shared environments.

## Accounts

| Role | Email | Password | Notes |
| --- | --- | --- | --- |
| Admin | `ui-admin@example.test` | `ui-admin-password` | Create as an admin in the database or through a seed script before testing admin-only UI. |
| Driver | `ui-driver@example.test` | `ui-driver-password` | Can be created through the registration UI or `POST /api/auth/register`. |

## Driver Registration Payload

Use this payload if you want to create the driver through the backend API before logging in from the UI:

```json
{
  "name": "UI Test Driver",
  "universityId": "UITEST001",
  "email": "ui-driver@example.test",
  "password": "ui-driver-password",
  "licensePlate": "UIT-001"
}
```

## Important Note

The current demo seed file includes placeholder `passwordHash` values, so seeded demo users such as `admin001@example.test` and `driver001@example.test` will not log in unless their password hashes are replaced with real bcrypt hashes.
