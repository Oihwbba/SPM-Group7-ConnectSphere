## ConnectSphere — Full Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | One deployable, UI + server logic, one container in C4 |
| Language | **TypeScript** | Types catch a class of AI-generated mistakes before runtime |
| UI | **React** (comes with Next.js) | Not a separate decision |
| Styling | **Tailwind CSS** | Fast without a designer |
| Components | **shadcn/ui** | Accessible form controls, copy-pasted into your repo — no dependency lock-in, and your backlog is almost entirely forms |
| ORM | **Prisma** | Schema, migrations, typed queries, `$transaction` |
| Database | **PostgreSQL on Supabase** | Real Postgres; free tier |
| Validation | **Zod** | Server-side rules in one place — maps directly onto the input-validity AC (positive attendance, end-not-before-start) |
| Forms | **Server Actions + Zod** | Fewer concepts than adding React Hook Form; add RHF only if a form gets genuinely complex |
| Auth | **Auth.js + Prisma adapter** | Users live in your database, roles as a column, one source of truth |
| Unit/integration tests | **Vitest** | Fast, TS-native |
| E2E tests | **Playwright** | Rubric asks for E2E “as relevant” |
| Local DB | **Docker Compose Postgres** | All five of you on an identical environment |
| CI | **GitHub Actions** | Postgres service container → migrate → Vitest → Playwright. This is Deliverable 6’s CI script |
| Lint/format | **ESLint + Prettier** | Evidence for the Code Quality rubric row |
| Hosting | **Vercel (app) + Supabase (DB)** | Git-push deploys |