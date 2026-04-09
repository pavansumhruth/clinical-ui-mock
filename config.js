// API Configuration
const CONFIG = {
    TRIAGE_API: 'http://34.14.197.45:9000',
    SUMMARY_API: 'http://34.14.197.45:8004',
    REDIS_API:   'http://34.14.197.45:8000',
    DEFAULT_PATIENT_ID: '791427b4-9cc4-8bcc-3fee-e3e14b6d3fea'
};

// Global state
const STATE = {
    currentPatient:      null,
    currentComplaint:    null,
    currentComplaintSlug: null,
    sessionId:           null,
    viewMode:            false,
    currentEncounterId:  null,
    encounterHistory:    [],
    questions:           [],
    answers:             [],
    selectedDiagnoses:      [],
    selectedInvestigations: [],
    selectedMedications:    [],
    selectedProcedures:     [],
    manualQuestions:        [],
    manualDiagnoses:        [],
    manualInvestigations:   [],
    manualMedications:      [],
    manualProcedures:       []
};