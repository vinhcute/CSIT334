export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  universityId: true,
  role: true,
  accountStatus: true,
  createdAt: true,
  updatedAt: true,
  vehicleProfiles: true,
} as const;

export const adminUserSummarySelect = {
  id: true,
  name: true,
  email: true,
  universityId: true,
  role: true,
  accountStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function serializeSafeUser<T extends object>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _passwordHash, ...safeUser } = user as T & {
    passwordHash?: unknown;
  };

  return safeUser;
}

export function serializeSafeUsers<T extends object>(users: T[]): Array<Omit<T, "passwordHash">> {
  return users.map((user) => serializeSafeUser(user));
}
