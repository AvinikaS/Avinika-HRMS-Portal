# AVINIKA HRMS PORTAL — COMPLETE PROJECT STRUCTURE

```text
HRMS PORTAL/
├── FRONTEND/  (React.js + Vite — Modern User Interface)
│   └── src/
│       ├── main.jsx                          → App entry point & DOM root mounting
│       ├── App.jsx                           → Route definitions, role-based protection & navigation layout
│       ├── index.css                         → Global design system (tokens, glassmorphism, responsive tables, forms)
│       │
│       ├── context/
│       │   └── AuthContext.jsx               → User authentication, JWT session & role access control (Employee/HR Admin/SuperAdmin)
│       │
│       ├── utils/
│       │   ├── api.js                        → Centralized Axios instance with auth interceptors & error handlers
│       │   └── cloudinaryUpload.js           → Multi-file cloud asset uploader (Images, Proofs, Receipts)
│       │
│       ├── components/
│       │   ├── EmployeeWizard.jsx            → Multi-step employee onboarding stepper modal (Personal, Work, Salary, Bank)
│       │   ├── EmployeeSelect.jsx            → Searchable employee dropdown component with avatars & department tags
│       │   ├── YearManagerModal.jsx          → Financial/Calendar year selector modal (for Payroll & Performance appraisal)
│       │   └── Layout/
│       │       ├── Sidebar.jsx               → Responsive sidebar navigation menu with collapsible role-based trees
│       │       ├── Topbar.jsx                → Header bar (notifications tray, user profile dropdown, breadcrumbs & logout)
│       │       ├── PublicNavbar.jsx          → Landing and public portal header with navigation links
│       │       └── PublicFooter.jsx          → Landing and public portal footer
│       │
│       └── pages/
│           │
│           ├── ── 1. PUBLIC & AUTHENTICATION PAGES ──
│           │   ├── LandingPage.jsx           → Modern marketing landing page with feature showcase & hero section
│           │   ├── LandingPage.css           → Custom animations and landing page styling
│           │   ├── About.jsx                 → Company profile, mission, vision and leadership
│           │   ├── Features.jsx              → Platform capabilities and enterprise feature overview
│           │   ├── Contact.jsx               → Contact form, enterprise inquiry & office location map
│           │   ├── CareersPage.jsx           → Public careers portal with dynamic job openings & application form
│           │   ├── RecruitmentInfo.jsx       → Public job description & requirements detail view
│           │   ├── Login.jsx                 → Secure authentication portal with role redirection & Google OAuth
│           │   └── ForgotPassword.jsx        → Multi-step password recovery (OTP verification & password reset)
│           │
│           ├── ── 2. ADMIN CORE PORTAL ──
│           │   ├── Dashboard.jsx             → Admin executive dashboard (headcount, attendance stats, leave counters)
│           │   ├── Employees.jsx             → Master employee directory (list/card view, filters, profile drawer, status toggle)
│           │   ├── Attendance.jsx            → Organization attendance master (calendar view, daily logs, manual override)
│           │   ├── Leaves.jsx                → Leave management (pending requests, approve/reject workflow, leave balances)
│           │   ├── Payroll.jsx               → Monthly salary engine (batch processing, net pay breakdown, lock month)
│           │   ├── Recruitment.jsx           → ATS platform (job postings, resume review, interview rounds, offer letters)
│           │   ├── Performance.jsx           → Performance review system (KPI setup, review cycles, manager feedback & scores)
│           │   ├── Documents.jsx             → Company & employee document vault (category tagging, upload, preview)
│           │   ├── DocumentApprovals.jsx     → Employee document request processing & approval queue
│           │   ├── Settings.jsx              → System settings (company info, departments, designations, shifts, salary rules)
│           │   └── Holidays.jsx              → Holiday calendar configuration (National, Optional & Company holidays)
│           │
│           ├── ── 3. PAYROLL & STATUTORY COMPLIANCE SUB-MODULES ──
│           │   └── payroll/
│           │       ├── BankAdvice.jsx        → Bank transfer file generation (NEFT/RTGS salary payout records)
│           │       ├── BonusModule.jsx       → Festival and statutory bonus allocation & payroll integration
│           │       ├── IncentiveModule.jsx   → Performance & sales incentive configuration and disbursement
│           │       ├── LoanManagement.jsx    → Employee loan schemes, EMI amortization scheduler & auto-recovery
│           │       ├── AdvanceSalary.jsx     → Salary advance requests, approval limits & recovery cycle setup
│           │       ├── IncomeTax.jsx         → Tax slabs, Regime selection (Old vs New), declarations & monthly TDS
│           │       ├── Form16Module.jsx      → Automated Form 16 (Part A & Part B) generation and distribution
│           │       ├── PfModule.jsx          → Provident Fund (PF) ECR generation, employee/employer share breakdown
│           │       ├── EsicModule.jsx        → ESIC contribution ledger, eligibility audit & monthly return reports
│           │       ├── Form24QModule.jsx     → Quarterly TDS return preparation (Challan records & Annexure generation)
│           │       ├── ComplianceReports.jsx → Statutory compliance summary & audit readiness dashboard
│           │       └── ExitManagement.jsx    → Employee offboarding (Resignation review, Asset clearance checklist, F&F settlement, Gratuity)
│           │
│           ├── ── 4. ATTENDANCE REGULARIZATION & AUDIT SYSTEM (NEW) ──
│           │   └── payroll/
│           │       ├── HRAdminRegularizations.jsx      → HR review queue (Pending, Draft, Approved, Rejected tabs & batch actions)
│           │       ├── HRAdminRegularizationDetail.jsx → Forensic investigation panel (Biometric face verification score, GPS office distance, IP check, verification attempt inspector dropdown with <=900px multiline wrapping, approval/override actions)
│           │       ├── HRAdminPayrollAdjustments.jsx   → HR adjustments ledger (Attendance discrepancy salary impact, arrears & deductions)
│           │       ├── SuperAdminRegularizations.jsx   → Super Admin executive oversight of regularizations with final authority
│           │       ├── SuperAdminPayrollAdjustments.jsx→ Super Admin adjustment verification and lock prior to payroll generation
│           │       └── SuperAdminAttendanceAudit.jsx   → Comprehensive forensic audit trail (punch tampering, overrides & violation records)
│           │
│           ├── ── 5. EXPENSE & REIMBURSEMENT SYSTEM ──
│           │   └── expense/
│           │       ├── ExpenseDashboard.jsx            → Employee expense overview, claim counts & approved amount stats
│           │       ├── MyExpenses.jsx                  → All employee claims with status filters (Pending, Approved, Paid, Rejected)
│           │       ├── CreateExpense.jsx               → Claim submission form with receipt upload (Cloudinary) & category selector
│           │       ├── ExpenseDetail.jsx               → Detailed view of claim, receipt preview, timeline & comments
│           │       └── admin/
│           │           ├── SuperAdminExpenseDashboard.jsx → Super Admin expense dashboard (stat cards, department expenditure)
│           │           ├── SuperAdminExpenseAll.jsx       → All organization claims with search, date range & export
│           │           ├── SuperAdminExpenseDetail.jsx    → Super Admin review panel with final payout approval & payment toggle
│           │           ├── HRAdminExpenses.jsx            → HR Admin level-1 approval review queue
│           │           ├── HRAdminExpenseDetail.jsx       → HR Admin claim audit, receipt verification & approval/correction request
│           │           └── ExpenseCategories.jsx          → Expense policy configuration (claim limits, receipt rules, budget caps)
│           │
│           ├── ── 6. HR HELPDESK & TICKETING SYSTEM ──
│           │   └── helpdesk/
│           │       ├── CreateTicket.jsx               → Employee ticket submission (Category, Priority, Description, Attachments)
│           │       ├── MyHelpdesk.jsx                 → Employee support ticket list with status tracking
│           │       ├── TicketDetail.jsx               → Employee chat-style conversation thread with HR support
│           │       ├── AdminHelpdeskDashboard.jsx     → HR support dashboard (ticket velocity, SLA metrics, workload distribution)
│           │       ├── AdminAllTickets.jsx            → HR ticket queue with priority/status filters & assignment
│           │       └── AdminTicketDetail.jsx          → HR support management (internal notes, status changes, canned replies)
│           │
│           └── ── 7. EMPLOYEE SELF-SERVICE (ESS) PORTAL ──
│               └── SelfService/
│                   ├── EmployeeDashboard.jsx          → Employee homepage (check-in widget, leave stats, quick links)
│                   ├── MyAttendance.jsx               → Attendance log, monthly calendar & status distribution
│                   ├── AttendanceCalendar.jsx         → Interactive calendar visualizer for attendance logs
│                   ├── SmartAttendance.jsx            → Geofenced and face recognition check-in/out terminal
│                   ├── MyAttendanceRegularization.jsx → Employee regularization portal (pending requests, status badges & history) [NEW]
│                   ├── CreateRegularization.jsx       → Request regularization form (missed punches, reason, proof attachment) [NEW]
│                   ├── RegularizationDetail.jsx       → Employee regularization detail view with verification timeline [NEW]
│                   ├── MyLeaves.jsx                   → Leave application, leave balance calculator & holiday lookup
│                   ├── MyPayslips.jsx                 → Salary slips repository with PDF view & instant download
│                   ├── MyProfile.jsx                  → Comprehensive personal, employment, emergency & bank details profile
│                   ├── MyDocuments.jsx                → Personal document storage & formal document requests (NOC, Experience Letter)
│                   ├── MyLoansAndAdvances.jsx         → Active loans overview, EMI schedule, loan & advance salary application
│                   ├── MyPerformance.jsx              → Self-appraisal form, goal tracker & manager feedback review
│                   ├── HolidayCalendar.jsx            → Full year company holiday calendar with upcoming event highlights
│                   └── Resignation.jsx                → Formal offboarding submission, notice period tracker & exit checklist
│
│
└── BACKEND/  (Node.js + Express.js + MongoDB — Enterprise REST API)
    ├── server.js                            → Server bootstrapping, Socket.io initialization, middleware pipeline & DB connect
    ├── vercel.json                          → Vercel serverless deployment configuration
    ├── fixIndexes.js                        → Database index migration and uniqueness repair utility
    │
    ├── config/
    │   ├── cloudinary.js                    → Cloudinary SDK config for secure image & document cloud storage
    │   └── socket.js                        → Real-time WebSocket connection manager (live notifications & chat updates)
    │
    ├── middleware/
    │   ├── auth.js                          → JWT authorization, session verification & role-based gatekeeper
    │   └── upload.js                        → Multer memory storage & file validation middleware
    │
    ├── models/  (Mongoose Database Schemas)
    │   ├── User.js                          → System credentials, email, password hash, role & status
    │   ├── Employee.js                      → Full employee profile (Personal, professional, statutory IDs, bank details)
    │   ├── Department.js                    → Organizational departments & reporting heads
    │   ├── Attendance.js                    → Daily punch times, duration, status (Present, Half-Day, Late, Absent)
    │   ├── AttendanceRegularization.model.js→ Regularization requests, reasons, forensic scores & approval stages [NEW]
    │   ├── AttendanceAuditLog.model.js      → Security & compliance audit trail for attendance alterations [NEW]
    │   ├── AttendanceVerificationLog.model.js→ Detailed log of face biometric and GPS distance attempts [NEW]
    │   ├── PayrollAdjustment.model.js       → Monthly payroll additions/deductions linked to regularizations [NEW]
    │   ├── Leave.js                         → Leave requests, approval stages & balance deduction records
    │   ├── LeaveBalanceHistory.js           → Audit ledger for leave accruals, lapses & consumptions
    │   ├── Payroll.js                       → Monthly salary slips, CTC breakdown, gross, net & statutory deductions
    │   ├── PayrollYear.js                   → Financial year configuration and active period lock
    │   ├── Bonus.js                         → Employee bonus allocations & payout flags
    │   ├── Incentive.js                     → Monthly performance incentive disbursements
    │   ├── Loan.js                          → Employee loans, interest calculations & EMI amortization schedule
    │   ├── AdvanceSalary.js                 → Advance salary disbursement & recovery tracker
    │   ├── IncomeTaxProfile.js              → Employee tax regime, chapter VI-A deductions & monthly TDS
    │   ├── PfChallan.js                     → Monthly Provident Fund compliance challan records
    │   ├── EsicChallan.js                   → Employee State Insurance compliance challan records
    │   ├── TdsChallan.js                    → Income tax TDS challan records (BSR code, challan serial)
    │   ├── Form16.js                        → Annual Form 16 Part A & Part B generation records
    │   ├── Form24QReturn.js                 → Quarterly TDS return filings & deductee mapping
    │   ├── GratuityCalculation.js           → Gratuity eligibility & settlement calculation records
    │   ├── Exit.js                          → Master exit process tracker & clearance stages
    │   ├── ExitRequest.js                   → Resignation petitions, notice period negotiations & acceptance
    │   ├── FFSettlement.js                  → Full & Final settlement vouchers and disbursement approval
    │   ├── Performance.js                   → Employee appraisal submissions, goal metrics & manager ratings
    │   ├── PerformanceYear.js               → Performance appraisal cycle definition
    │   ├── JobPost.js                       → Job openings, specifications & requirements
    │   ├── Candidate.js                     → Job applicants, resume links, stage tracking & interview ratings
    │   ├── Document.js                      → Uploaded document records, categories & verification status
    │   ├── DocumentType.js                  → Predefined document types and mandatory requirements
    │   ├── Holiday.js                       → Public and company holiday schedules
    │   ├── Setting.js                       → Company profile, logo, address & organizational policies
    │   ├── PlatformConfig.js                → Platform-level feature toggles & global configuration
    │   ├── Shift.js                         → Shift definitions (timings, grace periods, half-day cutoffs)
    │   ├── Notification.js                  → In-app notifications with read/unread flags & routing targets
    │   ├── HelpdeskTicket.js                → Support tickets, priority, category, SLA status & assignment
    │   ├── HelpdeskMessage.js               → Real-time chat messages between employee and support agents
    │   ├── HelpdeskCategory.js              → Helpdesk category configurations & default assignees
    │   ├── ExpenseClaim.model.js            → Expense claims, bill attachments, amounts & approval states
    │   ├── ExpenseCategory.model.js         → Expense category limits, receipt requirements & policy rules
    │   └── ExpenseHistory.model.js          → Expense claim audit trail with step-by-step review actions
    │
    ├── controllers/  (Business Logic & Core Handlers)
    │   ├── authController.js                → User login, token generation, password recovery & role checks
    │   ├── oauthController.js               → Google OAuth single sign-on authentication
    │   ├── employeeController.js            → Employee onboarding, updates, profile fetching & directory search
    │   ├── departmentController.js          → Department addition, hierarchy & department member listing
    │   ├── dashboardController.js           → Fast aggregation for admin dashboard statistics
    │   ├── attendanceController.js          → Clock-in/out processing, geofencing, face matching & daily logs
    │   ├── attendanceRegularization.controller.js → Regularization creation, forensics, HR & SuperAdmin reviews [NEW]
    │   ├── payrollAdjustment.controller.js  → Monthly adjustments generation & integration with payroll engine [NEW]
    │   ├── leaveController.js               → Leave application, balance validation, approval & calendar sync
    │   ├── payrollController.js             → Monthly payroll generation, payslip PDF generation & locking
    │   ├── payrollYearController.js         → Financial year management & active period control
    │   ├── bonusController.js               → Bonus processing, calculations & inclusion in salary slips
    │   ├── incentiveController.js           → Incentive processing & department-wise disbursements
    │   ├── loanController.js                → Loan approvals, EMI deductions & early closure handling
    │   ├── advanceSalaryController.js       → Advance salary approval, disbursement & next-cycle recovery
    │   ├── taxController.js                 → Income tax computation, regime evaluation & deduction approvals
    │   ├── form16Controller.js              → Automated Form 16 PDF compilation
    │   ├── form24qController.js             → Form 24Q quarterly e-TDS return export
    │   ├── pfController.js                  → PF challan computation & ECR text file generator
    │   ├── esicController.js                → ESIC contribution ledger & monthly portal export
    │   ├── exitController.js                → Resignation handling, asset returns, gratuity & F&F calculation
    │   ├── performanceController.js         → KPI assignment, self-evaluations, manager reviews & history
    │   ├── performanceYearController.js     → Performance review period lifecycle management
    │   ├── recruitmentController.js         → Job vacancy management, applicant funnel, interview scheduling & offer letters
    │   ├── documentController.js            → Employee document repository & verification workflow
    │   ├── documentTypeController.js        → Document type configuration
    │   ├── holidayController.js             → Holiday scheduling & automated integration with attendance
    │   ├── shiftController.js               → Shift scheduling, timing enforcement & grace period calculation
    │   ├── helpdeskController.js            → Ticket lifecycle management, messaging, file attachments & SLA tracking
    │   ├── expenseController.js             → Multi-level expense claim approvals, policy checks & reimbursement payment
    │   └── reportsController.js             → Comprehensive compliance, attendance & financial reporting
    │
    ├── routes/  (REST API Endpoints)
    │   ├── auth.js                          → /api/auth (login, me, forgot-password, reset-password)
    │   ├── employees.js                     → /api/employees (CRUD, status, documents, search)
    │   ├── departments.js                   → /api/departments (list, create, update, delete)
    │   ├── dashboard.js                     → /api/dashboard (stats, trends, counters)
    │   ├── attendance.js                    → /api/attendance (check-in, check-out, monthly, manual)
    │   ├── attendanceRegularization.routes.js→ /api/attendance-regularization (requests, reviews, audits, forensics) [NEW]
    │   ├── payrollAdjustment.routes.js      → /api/payroll-adjustments (monthly adjustments, lock, approvals) [NEW]
    │   ├── leaves.js                        → /api/leaves (apply, balance, approve, reject, history)
    │   ├── payroll.js                       → /api/payroll (generate, lock, payslips, summary)
    │   ├── payrollYears.js                  → /api/payroll-years (manage financial years)
    │   ├── bonus.js                         → /api/bonus (bonus master, allocations)
    │   ├── incentives.js                    → /api/incentives (incentive rules & disbursements)
    │   ├── loan.js                          → /api/loans (schemes, apply, approve, schedule)
    │   ├── advance.js                       → /api/advance (salary advance requests & approvals)
    │   ├── tax.js                           → /api/tax (tax profiles, regime, declarations)
    │   ├── exit.js                          → /api/exit (resignations, checklist, settlement, gratuity)
    │   ├── performance.js                   → /api/performance (goals, appraisals, scores)
    │   ├── performanceYears.js              → /api/performance-years (appraisal cycles)
    │   ├── recruitment.js                   → /api/recruitment (jobs, candidates, interviews, offers)
    │   ├── careers.js                       → /api/careers (public job listings & applicant submission)
    │   ├── documents.js                     → /api/documents (upload, view, approve)
    │   ├── documentTypes.js                 → /api/document-types (custom document types)
    │   ├── holiday.js                       → /api/holidays (company holiday schedule)
    │   ├── settings.js                      → /api/settings (company settings & policy configs)
    │   ├── shifts.js                        → /api/shifts (work shifts & timing rules)
    │   ├── notifications.js                 → /api/notifications (in-app alerts & read states)
    │   ├── helpdesk.js                      → /api/helpdesk (tickets, messages, categories, assignments)
    │   ├── expense.routes.js                → /api/expenses (claims, categories, multi-tier approvals)
    │   ├── reports.js                       → /api/reports (audit & compliance exports)
    │   ├── upload.js                        → /api/upload (Cloudinary asset upload pipeline)
    │   └── cron.js                          → /api/cron (scheduled background payroll & sync tasks)
    │
    ├── services/
    │   └── payrollService.js                → Core computational engine for gross pay, deductions, tax & net pay
    │
    └── utils/
        ├── pdfGenerator.js                  → Dynamic PDF renderer (Payslips, F&F Settlement, Form 16, Offer Letters)
        ├── emailService.js                  → Automated transactional emails (Login alerts, OTPs, Status updates)
        ├── notificationHelper.js            → Unified in-app and WebSocket notification dispatcher
        ├── cronJobs.js                      → Automated background scheduler (monthly auto-payroll, holiday sync)
        ├── attendanceUtils.js               → Shift calculation, late marks, half-day deductions & duration logic
        ├── payrollUtils.js                  → Salary components helper, proration & rounding functions
        ├── taxUtils.js                      → Old vs New tax regime computation, standard deduction & rebates
        ├── geoUtils.js                      → Haversine formula calculation for office geofencing radius validation
        ├── faceMatch.js                     → Biometric face match similarity score calculation
        └── calendarificService.js           → External Indian national & gazetted holiday API integration
```
