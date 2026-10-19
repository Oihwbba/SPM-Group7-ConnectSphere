-- SCRUM-121 AC1 — an account can hold more than one role: the roles it holds
-- besides its primary "role". Additive: every existing account starts with
-- none, so its permissions are unchanged.
ALTER TABLE "User" ADD COLUMN "additionalRoles" "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[];
