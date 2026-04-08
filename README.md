# Clinical UI Mock - Architecture and Onboarding Guide

## 1. Project Overview

This project is a plain JavaScript clinical consultation frontend for a doctor workflow. It lets a clinician:

- select a patient
- choose or create a complaint chain
- run AI-assisted triage questions
- generate downstream diagnoses/investigations/medications/procedures
- generate AI notes by section
- save a consultation as a visit in a complaint chain
- revisit prior encounters in the same chain

Core purpose: provide a consultation workflow where each visit is grouped under a complaint chain so clinical continuity is preserved across visits.

Key feature coverage in current code:

- Patient management:
  - patient registration page posts to backend
  - local patient cache in localStorage for sidebar rendering
- Complaint chains:
  - fetched per patient
  - selectable via JS-injected dropdown and sidebar popup list
- Encounter tracking:
  - encounter history fetched by complaint chain slug
  - rendered as visit tabs
- AI triage integration:
  - question session start + iterative answers
  - generation of diagnoses/investigations/medications/procedures
- Prescription generation:
  - composes full payload from form, selections, and notes
  - saves consultation and refreshes complaint counts/history

## 2. Core Concepts (VERY IMPORTANT)

### Chief Complaint

A chief complaint is the clinician-entered symptom/problem text shown as chips in the form.

How it is used:

- sent to triage at session start as chief_complaint
- used to auto-derive complaint_chain if currentComplaintSlug is missing at save time
- displayed in current encounter context

### Complaint Chain

A complaint chain is the longitudinal grouping key (slug) for related visits.

Why it exists:

- keeps repeat visits for the same clinical thread together
- allows visit history retrieval and tab rendering for continuity

How it groups encounters:

- consultations are saved with complaint_chain
- history endpoint filters by complaint chain slug
- complaint list endpoint returns visit counts per chain

### Encounter

An encounter is one visit record under a complaint chain.

Encounter lifecycle:

1. clinician selects patient and chain (or New Complaint)
2. app initializes a new encounter draft state
3. clinician fills consultation sections
4. app posts consultation to backend
5. app re-fetches complaint list and chain history
6. encounter appears as a numbered visit tab in that chain

## 3. System Architecture

Frontend responsibilities:

- render patient sidebar and consultation form
- manage in-memory workflow state
- orchestrate triage/summary/redis API calls
- render encounter history tabs and form hydration for old visits
- monitor service health and request logs

Backend responsibilities (as consumed by frontend):

- Redis API service:
  - patient create
  - complaint list per patient
  - complaint chain history per patient
  - consultation persistence
- Triage API service:
  - Q&A session and clinical decision steps
- Summary API service:
  - streaming AI notes by section

Text data flow diagram:

```text
Patient Click/Register
  -> UI Handlers (patientUI.js / register.html)
  -> app.js state transitions
  -> API calls (Redis/Triage/Summary)
  -> Backend services
  -> JSON/SSE responses
  -> STATE updates
  -> DOM re-render (dropdown, tabs, sections)
```

Runtime script order on dashboard:

```text
config.js -> patientService.js -> api.js -> patientUI.js -> app.js
```

## 4. Frontend Architecture

### config.js

Defines two globals:

- CONFIG
  - TRIAGE_API
  - SUMMARY_API
  - REDIS_API
  - DEFAULT_PATIENT_ID
- STATE
  - cross-module mutable app state for selected patient, complaint slug, encounter history, triage session, and selected/manual entries

### patientUI.js

Responsibilities:

- renders patient list from localStorage (patientService.js)
- highlights active patient
- handles patient click
  - stores selectedPatientId in localStorage
  - invokes window.selectPatient if available
  - otherwise redirects to index.html
- renders empty-state registration link when no patients

### app.js

Main orchestration layer:

- utility and monitored request wrapper
  - apiRequest, addLog, checkAllServices
- state transitions
  - activatePatient, selectPatient, startNewComplaint, startNewEncounter, cancel
- complaint chain handling
  - ensureComplaintDropdown (JS-only injection)
  - loadPatientComplaints
  - openComplaintChain
- encounter rendering
  - renderEncounterTabs
  - loadEncounterIntoForm
- triage flow
  - generateQuestions, answerQuestion
  - generateInvestigations, generateMedications, generateProcedures
- summary notes flow
  - generateNotes via SSE stream
- save flow
  - issuePrescription with payload composition and post-save refresh

## 5. State Management

Primary state keys:

```js
STATE.currentPatient
STATE.currentComplaintSlug
STATE.encounterHistory
```

When STATE.currentPatient is set:

- set in activatePatient/selectPatient/openComplaintChain/startNewComplaint
- cleared in cancel

When STATE.currentComplaintSlug is set:

- set when opening a chain (openComplaintChain)
- set when dropdown chain selected
- set from complaint chain input if manually used
- auto-derived from first chief complaint chip before save if still null

When STATE.currentComplaintSlug is cleared:

- patient switch (selectPatient)
- New Complaint selection (dropdown or startNewComplaint)
- complaint-chain input reset path
- cancel

When STATE.encounterHistory is set:

- set to fetched complaint history on chain selection (dropdown or sidebar chain click)
- sorted by visit_number ascending

When STATE.encounterHistory is cleared:

- patient switch
- new complaint start
- pre-load optimistic clearing while changing chain
- invalid/stale or failed fetch handling
- reset/cancel paths

Interaction model:

- currentPatient scopes all complaint/history API calls
- currentComplaintSlug scopes which longitudinal chain is shown and saved
- encounterHistory drives visit tab rendering and visit number display

## State Transitions

| Action | currentPatient | currentComplaintSlug | encounterHistory |
|--------|---------------|----------------------|------------------|
| Select Patient | set | null | [] |
| Select Chain | unchanged | set (chain_slug) | fetched, normalized, sorted |
| New Complaint | unchanged | null | [] |
| Save Consultation (success) | unchanged | same value used in payload | reloaded from backend |
| Save Consultation (failure) | unchanged | unchanged | unchanged |

Why this matters:

- if currentComplaintSlug is not cleared on patient/new-complaint transitions, visits can be saved into the wrong chain
- if encounterHistory is not cleared before async reload, stale tabs can be shown
- if state is not refreshed from backend after save, UI counts/history diverge from persisted data

## Source of Truth

- Backend is the source of truth for:
  - complaint chains
  - visit counts
  - encounter history
- Frontend state (STATE object) is ephemeral and must always be refreshed after:
  - saving a consultation
  - switching patients
  - switching complaint chains

Operational note:

- localStorage is used for sidebar patient listing convenience, but not as truth for complaint chains or encounter history

## 6. API Contracts

Only endpoints observed in current active runtime code are documented below.

### Redis API

#### GET /health

Purpose:

- service status in monitor panel

Frontend use:

- polled every 10 seconds via checkAllServices

#### POST /api/v1/patient

Purpose:

- create/register patient

Request payload (from register page):

```json
{
  "patient_id": "string",
  "name": "string",
  "dob": "YYYY-MM-DD",
  "gender": "Male|Female|Other",
  "blood_type": "A+|A-|B+|B-|O+|O-|AB+|AB-",
  "contact": "10-digit string",
  "address": "string"
}
```

Response structure:

- JSON body is expected but fields are not consumed by frontend registration flow

Frontend use:

- register.html uses fetch directly
- api.js also exposes createPatient(payload) helper (currently not used by register.html)

#### GET /api/v1/patient/{id}/complaints

Purpose:

- get complaint chains and visit counts for a patient

Expected item shape (as consumed):

```json
{
  "display_name": "Fever",
  "chain_slug": "fever",
  "visit_count": 2
}
```

Frontend use:

- populates complaint dropdown
- populates sidebar complaint popup list
- used after save to refresh counts

#### GET /api/v1/patient/{id}/complaint?complaint={chain_slug}&limit=20

Purpose:

- fetch encounter history for one complaint chain

Response usage shape (per encounter object fields read by UI):

```json
{
  "consultation_id": "uuid-or-string",
  "visit_number": 1,
  "visit_date": "YYYY-MM-DD",
  "chief_complaints": ["Fever"],
  "vitals": {
    "height_cm": 120,
    "weight_kg": 24,
    "head_circ_cm": 50,
    "temp_celsius": 38.2,
    "bp_mmhg": "120/80"
  },
  "key_questions": [{"question": "...", "answer": "..."}],
  "diagnoses": [{"name": "...", "selected": true}],
  "investigations": [{"name": "...", "selected": true}],
  "medications": [{"name": "...", "selected": true}],
  "procedures": [{"name": "...", "selected": true}],
  "advice": "...",
  "follow_up_date": "YYYY-MM-DD",
  "diagnoses_ai_notes": "...",
  "medications_ai_notes": "...",
  "advice_ai_notes": "..."
}
```

Frontend use:

- normalized using Array.isArray(...)? ... : []
- sorted by visit_number
- rendered as encounter tabs
- loaded into form for read/edit context

#### POST /api/v1/consultation

Purpose:

- persist consultation as a chain visit

Request payload (constructed in issuePrescription):

```json
{
  "patient_id": "string",
  "complaint_chain": "string",
  "visit_date": "YYYY-MM-DD",
  "chief_complaints": ["string"],
  "vitals": {
    "height_cm": 0,
    "weight_kg": 0,
    "head_circ_cm": 0,
    "temp_celsius": 0,
    "bp_mmhg": "string"
  },
  "key_questions": [{"question": "string", "answer": "string"}],
  "key_questions_ai_notes": "",
  "diagnoses": [{"name": "string", "selected": true, "is_custom": false}],
  "diagnoses_ai_notes": "string",
  "investigations": [{"name": "string", "selected": true, "is_custom": false}],
  "investigations_ai_notes": "string",
  "medications": [{"name": "string", "selected": true, "is_custom": false}],
  "medications_ai_notes": "string",
  "procedures": [{"name": "string", "selected": true, "is_custom": false}],
  "procedures_ai_notes": "string",
  "advice": "string",
  "follow_up_date": "YYYY-MM-DD|null",
  "advice_ai_notes": "string"
}
```

Response structure consumed:

- saved.consultation_id is logged

Frontend post-save behavior:

- reload complaint chains
- reload current complaint chain history
- rerender encounter tabs

### Triage API

#### GET /health

Purpose:

- service status in monitor panel

#### POST /start

Purpose:

- initialize triage session and get first question

Request payload:

```json
{
  "chief_complaint": "comma separated complaints",
  "complaint_chain": "string",
  "clinical_history": "string",
  "patient_id": "string"
}
```

Response fields consumed:

```json
{
  "session_id": "string",
  "question": "string",
  "options": ["string"]
}
```

#### POST /answer

Purpose:

- submit selected option and receive next step

Request payload:

```json
{
  "session_id": "string",
  "selected_option": "string"
}
```

Response fields consumed:

- completed (boolean)
- if not completed: question, options
- if completed: considerations or diagnoses array

#### POST /select-diagnoses

Purpose:

- generate investigations from selected diagnoses

Request payload:

```json
{
  "session_id": "string",
  "selected": ["diagnosis names"]
}
```

Response fields consumed:

- investigations: array of string or object-with-name

#### POST /select-investigations

Purpose:

- generate medications from selected investigations

Request payload:

```json
{
  "session_id": "string",
  "selected": ["investigation names"]
}
```

Response fields consumed:

- medications: array of string or object-with name/dose/route

#### POST /select-medications

Purpose:

- generate procedures from selected medications

Request payload:

```json
{
  "session_id": "string",
  "selected": ["medication names"]
}
```

Response fields consumed:

- procedures: array of string or object-with-name

### Summary API

#### GET /health

Purpose:

- service status in monitor panel

#### POST /api/v1/generate-summary-stream

Purpose:

- stream AI notes text for a given section

Request payload:

```json
{
  "patient_id": "string",
  "context": {
    "chief_complaint": "string",
    "diagnoses": ["string"],
    "investigations": ["string"],
    "medications": ["string"],
    "procedures": ["string"]
  },
  "section": "diagnosis|investigations|medications|procedures|advice",
  "debug": false
}
```

Response behavior:

- server-sent event style lines parsed from stream
- lines prefixed with data: contain JSON chunks
- consumed fields: token (append text), done (finish state)

## UI -> API Mapping

- Select Patient -> GET /api/v1/patient/{id}/complaints
- Select Complaint Chain (dropdown/popup) -> GET /api/v1/patient/{id}/complaint?complaint={chain_slug}&limit=20
- Generate Questions -> POST /start
- Answer Question -> POST /answer
- Proceed to Investigations -> POST /select-diagnoses
- Proceed to Medications -> POST /select-investigations
- Proceed to Procedures -> POST /select-medications
- Save Consultation -> POST /api/v1/consultation
- Generate Notes -> POST /api/v1/generate-summary-stream

## Failure Handling

- If /complaints fails:
  - dropdown is reset to only New Complaint
  - sidebar popup falls back to a New Complaint item
- If /complaint fails:
  - encounterHistory is set to []
  - tab bar is rendered without historical visits
- If /consultation fails:
  - success UI state is not applied
  - complaint counts/history are not reloaded
  - error is surfaced through apiRequest logging and alert path

Failure visibility:

- all wrapped API failures are logged in System Monitor with reason/explanation metadata
- health panel independently reports service reachability via /health checks

## 7. Full User Flow (CRITICAL)

### Flow 1 - Select Patient

1. user clicks patient in sidebar (patientUI.js)
2. selectedPatientId persisted in localStorage
3. app.selectPatient(patient) runs
4. app clears stale complaint/history state
5. complaint dropdown is ensured and temporarily shows loading
6. loadPatientComplaints fetches chains and populates dropdown + popup
7. startNewEncounter initializes clean draft visit context

### Flow 2 - Select Complaint Chain

1. user picks chain from dropdown or popup list
2. STATE.currentComplaintSlug is set to chain_slug
3. encounter history is cleared and tabs are temporarily reset
4. history endpoint fetches chain visits
5. history normalized + sorted
6. visit tabs rendered; form reset for a new draft in that chain

### Flow 3 - New Complaint

1. user chooses New Complaint from dropdown or popup
2. currentComplaintSlug becomes null
3. encounterHistory becomes empty
4. tabs render empty state (+ New Encounter)
5. form starts a clean encounter with no prior history

### Flow 4 - Answer Questions

1. clinician enters one or more chief complaints
2. Generate Questions calls triage /start
3. app stores session_id
4. each answer posts to /answer
5. UI either renders next question or final diagnosis suggestions

### Flow 5 - Save Consultation

1. app validates patient, complaint chain, and complaints
2. if complaint chain missing, first complaint chip is used as fallback slug
3. app assembles full consultation payload
4. POST /api/v1/consultation

### Flow 6 - Post-save refresh

1. app reloads complaint chains for selected patient
2. app fetches history for current complaint chain
3. app normalizes/sorts history and re-renders tabs
4. monitor logs "Post-save refresh complete"

## Save Flow Timeline

User clicks Save
-> issuePrescription()
-> POST /api/v1/consultation
-> reload GET /api/v1/patient/{id}/complaints
-> reload GET /api/v1/patient/{id}/complaint?complaint={chain_slug}&limit=20
-> update complaint dropdown and popup counts
-> render encounter tabs from refreshed history

## 8. Complaint Chain Logic

How grouping works:

- every saved consultation includes complaint_chain
- complaint chains are listed with visit_count by /complaints endpoint
- history view is strictly filtered by chain_slug

How dropdown works:

- injected at runtime by ensureComplaintDropdown
- populated by loadPatientComplaints
- always includes a New Complaint option (empty value)
- single global change listener bound once using window._complaintDropdownBound

How history is fetched:

- by patient_id + chain_slug
- endpoint includes limit=20 in app.js
- response normalized to array and sorted

How counts update:

- after save, app reloads /complaints
- refreshed visit_count values are shown in dropdown and popup list

Example chain continuity:

```text
Visit 1: chief complaints = ["fever"] -> complaint_chain = "fever"
Visit 2: chief complaints = ["fever", "cough"] -> complaint_chain can remain "fever"
```

In current implementation, complaint_chain is whatever slug is currently selected/derived at save time.

## Complaint Chain Generation Rules

Exactly how complaint_chain is determined in current code:

1. Existing chain selected (dropdown or popup):
  - complaint_chain uses selected chain_slug (STATE.currentComplaintSlug)
2. New complaint flow with no selected slug at save time:
  - complaint_chain is derived from the first chief complaint chip text

Normalization behavior currently applied:

- trimming: yes (chip text is trimmed)
- lowercase conversion: no
- strict slug formatting enforcement (spaces, punctuation replacement, canonicalization): no

Important implication:

- complaint_chain is currently frontend-controlled and can become inconsistent with backend canonical slug expectations unless backend normalizes/overrides it.

## Mental Model

Think of the system as:

- Patient = Folder
- Complaint Chain = Subfolder
- Encounter = File

Example:

```text
Patient A
  └── fever
     ├── Visit 1
     ├── Visit 2
```

## Example: Fever Follow-up

Visit 1:

- chief_complaint = "fever"
- complaint_chain = "fever"

Visit 2:

- chief_complaint = "fever, cough"
- complaint_chain = "fever"

Result in complaint list:

- Fever (2 visits)

## 9. UI Behavior

Dropdown injection (JS-only):

- no HTML template change needed
- inserted at top of consultation form when first needed
- supports chain switch and New Complaint reset

Encounter tabs:

- one tab per historical visit in selected chain
- + New Encounter tab always present
- selecting old visit hydrates full form data

Dynamic rendering:

- sections update as triage progresses
- "Next" buttons become available section-by-section
- unselected items can be removed from UI with animation helper

Backend synchronization:

- patient selection triggers chain fetch
- chain selection triggers history fetch
- save triggers chain + history refresh
- stale async responses are guarded when switching patient/chain rapidly

## 10. How to Run the Project

Prerequisites:

- modern browser (Chrome/Edge/Firefox)
- network access to configured backend hosts in config.js
- backend services reachable:
  - Redis API on port 8000
  - Triage API on port 9000
  - Summary API on port 8004

Run frontend locally:

1. from project folder, start a static file server

```bash
python3 -m http.server 5173
```

2. open in browser

```text
http://localhost:5173/index.html
```

3. registration page

```text
http://localhost:5173/register.html
```

Backend requirements:

- Redis API must implement patient, complaint-chain, and consultation endpoints listed above
- Triage API must support session-driven Q&A endpoints
- Summary API must support streamed note generation

Environment variables:

- none are used directly in frontend runtime
- endpoints are hard-coded in config.js

Recommended production setup:

- externalize CONFIG values via build-time or runtime environment injection
- serve over HTTPS and enforce CORS/auth policies

## 11. Expected Behavior

On patient selection:

- consultation form becomes visible
- complaint dropdown appears and loads complaint chains
- tabs reset to new encounter state

On complaint chain selection:

- dropdown reflects selected chain
- tabs show historical visits sorted by visit_number

On New Complaint selection:

- dropdown value clears
- no historical tabs except new encounter action

On triage progression:

- questions appear sequentially
- final diagnosis suggestions are shown when completed

On save:

- button shows Saving... then Prescription Issued checkmark
- complaint counts and encounter tabs refresh from backend

On cancel:

- consultation form hides
- state resets and selected patient is cleared

## 12. Edge Cases & Known Pitfalls

- Stale state between patient switches:
  - mitigated by clearing currentComplaintSlug and encounterHistory on selection/new complaint
- complaint_chain mismatch risk:
  - fallback derives chain from first complaint chip if slug missing
  - this may not match backend slug normalization strategy
- race conditions on rapid switching:
  - guarded by checking active patient/chain before applying async results
- localStorage vs backend divergence:
  - sidebar patient list comes from localStorage
  - backend registration failure/success and local cache can drift if not handled carefully
- limited history window:
  - history fetch uses limit=20
- legacy code artifacts:
  - clinical.js and backup files are historical snapshots, not runtime scripts on index/register pages

## Data Consistency Risks

- complaint_chain is frontend-controlled:
  - risk of semantic mismatch or duplicate chains if free-text variants are used
- localStorage patient list may diverge from backend patient records:
  - sidebar can show stale local entries not reflected by backend lookups
- no strict frontend normalization for complaint_chain:
  - trimming occurs, but no lowercase/canonical slug conversion is enforced
- partial failure windows:
  - save may succeed but post-save refresh may fail, temporarily leaving stale UI until next reload

## 13. Debugging Guide

Where to observe logs:

- System Monitor panel on dashboard
  - service health cards
  - request/response/error log feed
- browser console via log(...) output

Common failure points:

- backend unreachable or CORS issue -> error contains Failed to fetch
- validation failures from backend -> surfaced as status/detail errors
- malformed API response shapes -> empty render states (for arrays) or missing fields in hydrated view

How to verify API responses quickly:

1. confirm health cards are UP for all services
2. inspect monitor log entry payload for each request URL and method
3. verify complaint list returns display_name/chain_slug/visit_count
4. verify complaint history returns array with visit_number and consultation_id
5. verify triage /start returns session_id, question, options
6. verify summary stream emits data: JSON with token/done

Useful code-level checkpoints:

- apiRequest wrapper for error and payload handling
- loadPatientComplaints for dropdown/popover synchronization
- openComplaintChain and dropdown change handler for history fetch + race guards
- issuePrescription for payload composition and post-save refresh

## Performance Notes

- complaint list is re-fetched after every successful save to keep counts accurate
- encounter history is reloaded after chain changes and post-save refresh
- no dedicated caching layer is implemented for complaints/history
- history calls currently include limit=20, constraining payload size but potentially truncating long chains
- health checks run every 10 seconds and update monitor UI continuously

## Previously Fixed Issues

- stale encounterHistory when switching patients
- complaint counts not updating after save
- UI not reflecting backend state after consultation save
- stale async response overwriting newer patient/chain selection (guarded in chain load paths)

## 14. Future Improvements

- Framework migration:
  - move to React/Vue/Svelte for componentized state and predictable rendering
- State architecture:
  - introduce a formal state container and reducers to simplify transitions
- Complaint chain normalization:
  - enforce canonical backend slug generation and return normalized slug on save
- Data consistency:
  - replace localStorage patient source with backend-driven list endpoint
- API typing/contracts:
  - add shared schema validation (OpenAPI + runtime validation)
- Observability:
  - structured telemetry with correlation IDs across triage/summary/redis calls
- UX quality:
  - improve accessibility, keyboard navigation, and loading skeletons
- Performance/caching:
  - smart cache with invalidation after save and on patient switch

---

## Active vs Historical Files

Active runtime files for dashboard/registration:

- index.html
- register.html
- styles.css
- config.js
- patientService.js
- patientUI.js
- api.js
- app.js

Historical/snapshot files (not loaded by index/register script tags):

- clinical.js
- app.js.backup
- app.js.backup2
- app.js.backup3
- app.js.broken
- config.js.backup
- index.html.backup
