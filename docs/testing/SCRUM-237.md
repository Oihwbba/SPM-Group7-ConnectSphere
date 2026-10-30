# SCRUM-237 — Say on the website and in the README that it is the team's development environment, not a service for customers: test cases

SCRUM-237 is a Chore task in Jira. The deployed site is where the team builds,
tests and coordinates the project; nothing on it said so, so a customer who
found it could take it for a live service.

Format and conventions: [README.md](README.md).

**Shared pre-conditions:** the app running against a migrated and seeded
database (`npm run db:seed`). The e2e spec only signs in and looks, so it runs
on any database.

| ID | Type | Criterion | Automated |
|---|---|---|---|
| [TC-237-01](#tc-237-01) | Positive | AC 1, AC 4 | Unit, e2e |
| [TC-237-02](#tc-237-02) | Positive | AC 1, AC 4 | Unit, e2e |
| [TC-237-03](#tc-237-03) | Boundary | AC 2 | Unit, e2e |
| [TC-237-04](#tc-237-04) | Positive | AC 3 | Manual (a document check) |

---

### TC-237-01

| Item | Content |
|---|---|
| Test Case ID | TC-237-01 |
| Test Scenario | [Positive] AC 1, AC 4: the sign-in page says the site is the team's development environment |
| Pre-conditions | Signed out. |
| Test Steps | 1. Open `/login`. |
| Test Data | — |
| Expected Result | Under the sign-in form: "This site is the ConnectSphere team's development environment, used to build and coordinate the project. It isn't a service for customers." |

**Automated by:** `e2e/development-notice.spec.ts` › "SCRUM-237 [AC1, AC4] TC-237-01: the sign-in page says the site is the team's development environment"; `tests/unit/development-notice.test.tsx` › "SCRUM-237 [AC1, AC4] TC-237-01, TC-237-02: the %s says the site is the team's development environment, not a service for customers"

### TC-237-02

| Item | Content |
|---|---|
| Test Case ID | TC-237-02 |
| Test Scenario | [Positive] AC 1, AC 4: every signed-in page says the same, above the top bar |
| Pre-conditions | Signed out. |
| Test Steps | 1. Sign in as each role in turn. <br> 2. Look at the top of the page each lands on. |
| Test Data | `organiser@`, `coordinator@`, `venuestaff@`, `techsupport@` and `attendee@test.local` / `Password123!` |
| Expected Result | The same notice runs across the top of the page, above the top bar. Every signed-in page shares the one layout, so each role's landing page stands for all its pages. |

**Automated by:** `e2e/development-notice.spec.ts` › "SCRUM-237 [AC1, AC4] TC-237-02: ${email} sees the notice above the top bar" (each of the five roles); `tests/unit/development-notice.test.tsx` › "SCRUM-237 [AC1, AC4] TC-237-01, TC-237-02: the %s says the site is the team's development environment, not a service for customers"

### TC-237-03

| Item | Content |
|---|---|
| Test Case ID | TC-237-03 |
| Test Scenario | [Boundary] AC 2: at phone width the notice fits, leaves the top bar's controls clear, and uses the theme's colours |
| Pre-conditions | Signed in as the Coordinator, with the window 375 px wide. |
| Test Steps | 1. Look at the notice. <br> 2. Open the profile menu, close it, and look at the bell. <br> 3. Scroll down the page. |
| Test Data | `coordinator@test.local` / `Password123!` |
| Expected Result | The notice wraps inside the page, and the page doesn't scroll sideways. The profile menu opens and the bell is visible, so the notice covers neither. Scrolled, the top bar stays at the top of the screen and the notice scrolls away above it. Its colours are the theme's muted tokens, with no hard-coded colour. |

**Automated by:** `e2e/development-notice.spec.ts` › "SCRUM-237 [AC2] TC-237-03: at 375 px the notice wraps inside the page and leaves the top bar's controls clear"; `tests/unit/development-notice.test.tsx` › "SCRUM-237 [AC2] TC-237-03: both use the theme's colours, the strip across the page and the panel as a card"

### TC-237-04

| Item | Content |
|---|---|
| Test Case ID | TC-237-04 |
| Test Scenario | [Positive] AC 3: the README and the product context say the same |
| Pre-conditions | — |
| Test Steps | 1. Read `README.md` under **Live app**. <br> 2. Read `docs/product-context.md`, "The deployed site". |
| Test Data | — |
| Expected Result | Both say the live app is the team's development environment, with only seeded test accounts and demo events, and isn't a service for customers. |

**Automated by:** Manual (a document check, done in review).
