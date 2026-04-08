function getSelectedPatientId() {
    return STATE.currentPatient?.patient_id || localStorage.getItem('selectedPatientId') || '';
}

function renderPatientList(selectedPatientId = getSelectedPatientId()) {
    const container = document.getElementById('patientList');
    if (!container) return;

    container.textContent = '';

    const patients = getPatients();
    if (!patients.length) {
        const emptyState = document.createElement('div');
        emptyState.className = 'patient-empty-state';

        const emptyText = document.createElement('p');
        emptyText.className = 'empty-state';
        emptyText.textContent = 'No patients registered';

        const registerLink = document.createElement('a');
        registerLink.className = 'register-patient-link';
        registerLink.href = 'register.html';
        registerLink.textContent = 'Register Patient';

        emptyState.appendChild(emptyText);
        emptyState.appendChild(registerLink);
        container.appendChild(emptyState);
        return;
    }

    patients.forEach((patient) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'patient-item';
        item.dataset.patientId = patient.patient_id;
        if (patient.patient_id === selectedPatientId) {
            item.classList.add('active');
        }

        const name = document.createElement('span');
        name.className = 'patient-name';
        name.textContent = patient.name;

        item.appendChild(name);
        item.addEventListener('click', () => handlePatientClick(patient.patient_id));
        container.appendChild(item);
    });
}

function handlePatientClick(patientId) {
    const patient = getPatientById(patientId);
    if (!patient) return;

    localStorage.setItem('selectedPatientId', patientId);

    if (typeof window.selectPatient === 'function') {
        window.selectPatient(patient);
        return;
    }

    window.location.href = 'index.html';
}

window.renderPatientList = renderPatientList;
window.handlePatientClick = handlePatientClick;

document.addEventListener('DOMContentLoaded', () => {
    renderPatientList();
});