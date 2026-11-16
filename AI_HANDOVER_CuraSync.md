# CuraSync — AI Handover Document

> **Purpose:** Give this document to another AI assistant (Gemini, Claude, Copilot, etc.) so it can continue developing CuraSync without restarting the project.
>
> **Last updated:** 16 November 2026  
> **Project:** CuraSync  
> **Developer workflow:** Beginner-friendly, step-by-step instructions in VS Code on Windows/PowerShell.

---

## 1. Project overview

CuraSync is an individual college hospital-management-system project. It is intended to provide separate workflows for patients, doctors, and receptionists, with administrative capabilities planned/implemented as applicable.

The project must remain a **Java-based backend** because the faculty requires Java.

### Core goals
- Patient registration, login, profile, and dashboard
- Doctor profiles, specializations, consultation fees, and availability
- Appointment booking, rescheduling, cancellation, and status tracking
- Medical records (diagnoses, prescriptions, treatment history) with role-based access
- Payment/billing support
- Receptionist walk-in booking and appointment management
- Authentication and role-based access control (RBAC)
- Dashboard summaries and reports
- Patient appointment confirmation emails after payment is successfully verified

---

## 2. Technology stack and project paths

### Windows project paths
- **Repository/root:** `D:\CuraSync`
- **Frontend:** `D:\CuraSync\curasync`
- **Backend Maven/Spring Boot project:** `D:\CuraSync\backend-maven\demo`

### Frontend
- Next.js **16.4.3**
- React **19.3.0**
- TypeScript
- Tailwind CSS **4**
- App Router uses the root `app\` directory (not `src\app`).
- Local frontend: `http://localhost:3000`

### Backend
- Java **24** (local environment previously reported `javac 24.0.1`; deployed log reported Java 24.0.2)
- Spring Boot **4.1.2**
- Maven wrapper **3.10.0**
- Embedded Tomcat; local backend port **8080**
- Backend package namespace: `com.example.demo`

### Database
- Neon PostgreSQL
- JDBC connection uses SSL (`sslmode=require`) and `channel_binding=require`.
- Do not put credentials, passwords, API keys, or full database connection strings in this document or in prompts. Keep secrets in environment variables.

### Deployment (latest known)
- Frontend deployed on **Vercel**
- Backend deployed on **Railway**
- Database hosted on **Neon PostgreSQL**
- Deployment was recently made functional; latest user confirmation on 16-Nov-2026: “done working now.”
- A recent commit fixed CORS for the deployed frontend:
  - Commit: `6a3a7c7`
  - Message: `Fix CORS for deployed CuraSync frontend`
- Another recent commit changed `SecurityConfig.java` to allow deployed Vercel frontend requests. The latest known deployment troubleshooting involved Railway backend database configuration and Hibernate dialect/JDBC metadata errors, which were resolved before the “done working now” confirmation. Verify current deployment state before making assumptions.

---

## 3. Repository and Git workflow

- GitHub repository: `https://github.com/Rounit18/JAVAMINIPROJECT-123-120`
- Branch: `main`
- Git root: `D:\CuraSync`
- Note: `Rounit18` is a friend's GitHub account. The developer's Vercel account and GitHub account ownership may differ; don't assume account ownership.

### Safe milestone workflow (PowerShell)
Run from a **new terminal** if the user asks for fresh terminal instructions:

```powershell
cd D:\CuraSync
git status
git add .
git commit -m "Describe the completed feature"
git push
```

Before committing, review `git status` and ensure no `.env`, credentials, keys, or secret files are staged.

---

## 4. Frontend routes known to exist

Known route pages include:
- `/`
- `/dashboard`
- `/doctor/dashboard`
- `/doctor/login`
- `/doctor/register`
- `/doctors`
- `/login`
- `/profile`
- `/register`
- `/receptionist`
- `/receptionist/dashboard` (receptionist dashboard route has been under development; verify its current existence and behavior)

The receptionist login page was observed at `app/receptionist/page.tsx`; it posts to the receptionist login endpoint and on success redirects to `/receptionist/dashboard`. There was a recent confusing issue where the browser showed 404 at `/receptionist` even though an HTTP request to `localhost:3000/receptionist` returned 200. Recheck the actual current code/runtime if this resurfaces.

---

## 5. Backend controllers and key endpoints

Known controllers in:
`D:\CuraSync\backend-maven\demo\src\main\java\com\example\demo`

- `AppointmentController.java`
- `DoctorController.java`
- `HealthController.java`
- `PatientController.java`
- `ReceptionistController.java` (recently modified; verify current status)

### Known patient authentication endpoints
- `POST /api/patients/login`
- `GET /api/patients/me`
- `POST /api/patients/logout`

Patient session uses cookies/credentials.

### Known appointment/payment endpoints
- `POST /api/appointments/book`
- `POST /api/appointments/verify-payment`

The online payment flow uses Razorpay Checkout:
- Checkout script: `https://checkout.razorpay.com/v1/checkout.js`
- Appointment payment-related fields known from implementation:
  - appointment status `PENDING_PAYMENT`
  - `amount`
  - `paymentStatus` (initially `PENDING`)
  - `razorpayOrderId`
  - `razorpayPaymentId`
- Doctor entity includes `consultationFee`.
- User confirmed the Razorpay test payment flow and appointment booking succeeded previously.
- An auth guard was added: unauthenticated booking returns 403; a doctor session attempting patient booking gets “Only patients can book appointments.”

**Important:** Inspect the current controller/service files before relying on this endpoint list or modifying behavior. Do not invent API routes or request/response DTO shapes.

---

## 6. Roles and user experience requirements

### Landing page and authentication
- Landing page should let the user choose a role (patient, doctor, receptionist) and direct them to the appropriate login/register flow.
- Maintain role separation and existing authentication behavior.

### Patient
- Patient can view doctors, doctor availability by day and slots, and book appointments.
- Patient should see a clear unavailable/conflict message if the doctor already has an appointment at the selected date/time.
- Appointment booking should not permit duplicate/overlapping bookings for the same doctor/time slot.
- Patient profile includes contact details.
- Patient appointment confirmation email is required, but **must be sent only after payment has been successfully collected and verified** (online patient payment or receptionist records Cash/Card/UPI as paid).

### Doctor
- Doctor profile includes specialization, availability, and consultation fee.
- Doctor can mark availability.
- Doctor dashboard has tabs known as Overview, Appointments, Patients, Availability.
- Appointment booked for a doctor should appear in that doctor's dashboard. Example doctor display used in development: **Dr. Rahul Bose**, Cardiology, MBBS, MD, 8 years’ experience, consultation fee ₹500.
- Do **not** send appointment emails to doctors. Appointment details should appear in the doctor's dashboard.

### Receptionist
- Receptionist should be able to view schedules/appointments across doctors, manage patients, book walk-in appointments, and handle appointment rescheduling/cancellation/check-in/status as required by the implemented UI.
- Receptionist-created appointments should appear in the relevant doctor dashboard.
- **Do not send an email to the doctor** for receptionist-created bookings.
- Patient confirmation email is still required after payment is marked/verified as paid.
- “Today's Revenue” should represent the total amount of appointments **booked/paid today**, as defined in the existing implementation; inspect logic and labels to keep it consistent.
- Receptionist page needs a logout button.

### Visual/UX preferences
- User asks for polished/premium UI, especially success/error cards.
- Payment success should show a prominent “Appointment Booked Successfully” message.
- Appointment conflict/unavailability should be clear and visually prominent.
- User prefers precise paste locations and complete replacement files when feasible.

---

## 7. Known issues / unfinished work at handover

### Patient confirmation email
- Email feature is not working as of 16-Nov-2026; user explicitly said they will address it later.
- Expected behavior: send patient confirmation email only after successful payment verification/recording as paid.
- No email to doctors.
- Diagnose current email provider/configuration, environment variables, backend logs, and triggering path. Do not expose or ask the user to paste secrets; request redacted config/logs.

### Other items to verify
- Receptionist dashboard route/UI and logout button; route had recently been in development.
- Ensure appointment duplicate booking prevention works robustly on backend/database, not only frontend.
- Confirm all role access rules remain correct after deployment.
- Verify Vercel frontend ↔ Railway backend CORS and environment configuration after changes.
- Verify dashboard revenue calculation and label consistency.

This list is a handover snapshot, not a claim that every listed item is still broken. Recheck the code and deployed application.

---

## 8. Security and data handling rules

- Never ask the developer to share real `.env` contents, passwords, API secrets, Razorpay secret keys, or Neon credentials.
- Do not commit `.env` files or credentials.
- Keep authentication, role checks, payment verification, and appointment conflict checks on the backend.
- Do not trust frontend payment success alone; server-side payment verification is required.
- Protect medical records and patient data with appropriate authorization.
- Avoid broad security relaxations. If changing CORS or Spring Security, explain the exact effect and preserve credentials/authentication requirements.
- Use test/sandbox payment credentials for development.

---

## 9. Developer collaboration instructions (important)

The developer is a beginner and builds the project by copying code into VS Code. The AI should:

1. **Inspect the existing code first** (the repository or the relevant complete files) before proposing modifications.
2. Continue the existing project; do not recreate it from scratch.
3. Give the exact Windows file path for every file to edit.
4. Prefer complete, paste-ready replacement files where safe. If only a small edit is necessary, identify the exact location and surrounding code.
5. Explain actions step-by-step in beginner-friendly language.
6. Use fenced code blocks with the correct language identifier for code.
7. Provide PowerShell commands that can be pasted as-is.
8. Do not say “paste this in the main return” without identifying the precise place/section.
9. Avoid changing unrelated files or features.
10. Preserve existing functionality and explain any tradeoffs.
11. Ask the user to share the current file content when the AI cannot inspect the repository directly; do not guess its contents.
12. After a change, give clear testing steps and wait for the user's confirmation before moving to the next substantial step.
13. For terminal restart/stop/start instructions relating to CuraSync, user prefers instructions for a **new terminal**, not reusing the currently running backend terminal.
14. When suggesting Git operations, check `git status` and remind the user to exclude secrets.
15. If a token/session limit interrupts work, summarize what was changed, what remains, and the next exact action in this file.

---

## 10. How a new AI should start

Use this prompt along with the repository and this document:

> I am continuing development of CuraSync, an existing hospital management system. Read `AI_HANDOVER.md` carefully and inspect the current GitHub repository/codebase before making suggestions.
>
> Do not rebuild the project. Confirm the current architecture, completed features, and pending work against the actual code. I am a beginner using VS Code on Windows. Give exact file paths, beginner-friendly steps, and preferably complete replacement files. Preserve existing behavior and security. Never request or expose secrets.
>
> First, summarize your understanding and identify the next task. Do not edit code until you explain the plan and I confirm.

---

## 11. Update this handover after every major milestone

After completing a feature, update:
- **Completed features**
- **Current status**
- **Known issues / unfinished work**
- **Relevant endpoints or database changes**
- **Latest Git commit**
- **Next exact step**

Keep the handover synchronized with the repository. The code in GitHub is the source of truth for implementation; this document records context and workflow preferences.
