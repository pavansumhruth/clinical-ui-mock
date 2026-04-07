// API Configuration
const CONFIG = {
    TRIAGE_API: 'http://34.180.37.249:9000',
    SUMMARY_API: 'http://34.180.37.249:8004',
    REDIS_API:   'http://34.180.37.249:8000',
    DEFAULT_PATIENT_ID: '791427b4-9cc4-8bcc-3fee-e3e14b6d3fea',

    PATIENTS: {
        'yolanda': {
            id: '791427b4-9cc4-8bcc-3fee-e3e14b6d3fea',
            name: 'Yolanda Delrío',
            complaints: ['Fever', 'Cough']
        },
        'dorene': {
            id: 'dorene-patient-id',
            name: 'Dorene Smith',
            complaints: ['Headache']
        }
    }
};

// Global state
const STATE = {
    currentPatient:      null,
    currentComplaint:    null,
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