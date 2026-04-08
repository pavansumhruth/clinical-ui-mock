function getPatients() {
    return JSON.parse(localStorage.getItem('patients') || '[]');
}

function savePatient(patient) {
    const patients = getPatients();
    patients.push(patient);
    localStorage.setItem('patients', JSON.stringify(patients));
}

function getPatientById(patientId) {
    return getPatients().find((patient) => patient.patient_id === patientId) || null;
}

window.getPatients = getPatients;
window.savePatient = savePatient;
window.getPatientById = getPatientById;