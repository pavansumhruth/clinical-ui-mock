// ============================================================================
// UTILITY
// ============================================================================

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function log(message, data) {
    console.log(`[Clinical UI] ${message}`, data || '');
}

// ============================================================================
// SIDEBAR — Patient complaint click → fetch history from Redis
// ============================================================================

async function openComplaint(patientKey, complaintName) {
    const patient = CONFIG.PATIENTS[patientKey];
    if (!patient) return;

    STATE.currentPatient     = patient;
    STATE.currentComplaint   = complaintName;
    STATE.encounterHistory   = [];
    STATE.viewMode           = false;
    STATE.currentEncounterId = null;

    document.getElementById('currentPatientName').textContent = patient.name;
    document.getElementById('currentComplaint').textContent   = complaintName;
    document.getElementById('emptyState').style.display       = 'none';
    document.getElementById('consultationForm').style.display = 'block';

    // Fetch complaint chain from Redis
    try {
        const res = await fetch(
            `${CONFIG.REDIS_API}/api/v1/patient/${patient.id}/complaint?complaint=${encodeURIComponent(complaintName)}&limit=20`
        );
        if (res.ok) {
            STATE.encounterHistory = await res.json();
            STATE.encounterHistory.sort((a, b) => a.visit_number - b.visit_number);
        }
    } catch (e) {
        log('Could not load encounter history', e);
    }

    renderEncounterTabs();
    startNewEncounter();
}

async function newComplaint(patientKey) {
    const patient = CONFIG.PATIENTS[patientKey];
    if (!patient) return;

    STATE.currentPatient     = patient;
    STATE.currentComplaint   = null;
    STATE.encounterHistory   = [];
    STATE.viewMode           = false;
    STATE.currentEncounterId = null;

    document.getElementById('currentPatientName').textContent = patient.name;
    document.getElementById('currentComplaint').textContent   = 'New Complaint';
    document.getElementById('emptyState').style.display       = 'none';
    document.getElementById('consultationForm').style.display = 'block';

    renderEncounterTabs();
    startNewEncounter();
    // Reset prescription button
    const rxBtn = document.querySelector('.btn-success');
    if (rxBtn) {
        rxBtn.disabled = false;
        rxBtn.textContent = 'Issue Prescription';
        rxBtn.style.backgroundColor = '';
    }
}

// ============================================================================
// ENCOUNTER TABS
// ============================================================================

function renderEncounterTabs() {
    let bar = document.getElementById('encounterTabBar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'encounterTabBar';
        bar.style.cssText = `
            display: flex; gap: 8px; flex-wrap: wrap;
            padding: 12px 32px; background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
        `;
        const form = document.getElementById('consultationForm');
        form.insertBefore(bar, form.firstChild);
    }
    bar.innerHTML = '';

    STATE.encounterHistory.forEach((enc) => {
        const tab = document.createElement('button');
        tab.className = 'encounter-tab';
        tab.style.cssText = `
            padding: 6px 14px; border-radius: 20px; font-size: 13px;
            cursor: pointer; border: 1.5px solid #e5e7eb;
            background: white; color: #475569; font-weight: 500;
        `;
        tab.textContent = `Visit ${enc.visit_number} — ${enc.visit_date}`;
        tab.onclick = () => loadEncounterIntoForm(enc);
        bar.appendChild(tab);
    });

    const newTab = document.createElement('button');
    newTab.id = 'newEncounterTab';
    newTab.style.cssText = `
        padding: 6px 14px; border-radius: 20px; font-size: 13px;
        cursor: pointer; border: 1.5px solid #3b82f6;
        background: #3b82f6; color: white; font-weight: 600;
    `;
    newTab.textContent = STATE.encounterHistory.length > 0
        ? `+ New Encounter (${STATE.encounterHistory.length + 1})`
        : '+ New Encounter';
    newTab.onclick = startNewEncounter;
    bar.appendChild(newTab);
}

function highlightTab(activeIdx) {
    const bar = document.getElementById('encounterTabBar');
    if (!bar) return;
    bar.querySelectorAll('.encounter-tab').forEach((t, i) => {
        if (i === activeIdx) {
            t.style.background  = '#eff6ff';
            t.style.borderColor = '#3b82f6';
            t.style.color       = '#1d4ed8';
        } else {
            t.style.background  = 'white';
            t.style.borderColor = '#e5e7eb';
            t.style.color       = '#475569';
        }
    });
    const newTab = document.getElementById('newEncounterTab');
    if (newTab) {
        newTab.style.background  = '#3b82f6';
        newTab.style.borderColor = '#3b82f6';
        newTab.style.color       = 'white';
    }
}

// ============================================================================
// LOAD PAST ENCOUNTER INTO FORM
// ============================================================================

function loadEncounterIntoForm(enc) {
    STATE.viewMode           = true;
    STATE.currentEncounterId = enc.consultation_id;

    const idx = STATE.encounterHistory.findIndex(e => e.consultation_id === enc.consultation_id);
    highlightTab(idx);

    document.getElementById('currentComplaint').textContent =
        `${enc.chief_complaints?.[0] || ''} — Visit ${enc.visit_number} — ${enc.visit_date}`;

    clearFormFields();

    // Chief complaint
    (enc.chief_complaints || []).forEach(c => {
        document.getElementById('chiefComplaintInput').value = c;
        addChiefComplaint();
    });

    // Vitals
    if (enc.vitals) {
        if (enc.vitals.height_cm)    document.getElementById('height').value   = enc.vitals.height_cm;
        if (enc.vitals.weight_kg)    document.getElementById('weight').value   = enc.vitals.weight_kg;
        if (enc.vitals.head_circ_cm) document.getElementById('headCirc').value = enc.vitals.head_circ_cm;
        if (enc.vitals.temp_celsius) document.getElementById('temp').value     = enc.vitals.temp_celsius;
        if (enc.vitals.bp_mmhg)      document.getElementById('bp').value       = enc.vitals.bp_mmhg;
    }

    // Q&A
    const qContainer = document.getElementById('questionsContainer');
    qContainer.innerHTML = '';
    STATE.questions = [];
    (enc.key_questions || []).forEach(kq => {
        STATE.questions.push({ question: kq.question, answer: kq.answer });
        const div = document.createElement('div');
        div.className = 'question-item';
        div.innerHTML = `
            <div class="question-text">${kq.question}</div>
            <div class="options-container">
                <button class="option-btn selected" disabled>${kq.answer}</button>
            </div>
        `;
        qContainer.appendChild(div);
    });

    // Diagnoses
    STATE.selectedDiagnoses = [];
    const diagContainer = document.getElementById('diagnosisContainer');
    diagContainer.innerHTML = '';
    (enc.diagnoses || []).forEach(d => {
        if (d.selected) STATE.selectedDiagnoses.push(d.name);
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <input type="checkbox" ${d.selected ? 'checked' : ''}
                onchange="toggleDiagnosis('${d.name.replace(/'/g, "\\'")}')">
            <div class="checkbox-content"><div class="checkbox-label">${d.name}</div></div>
        `;
        diagContainer.appendChild(item);
    });
    document.getElementById('diagnosisNotes').value = enc.diagnoses_ai_notes || '';
    const btnInv = document.getElementById('btnNextInv');
    if (btnInv) btnInv.style.display = 'inline-block';

    // Investigations
    STATE.selectedInvestigations = [];
    const invContainer = document.getElementById('investigationsContainer');
    invContainer.innerHTML = '';
    (enc.investigations || []).forEach(i => {
        if (i.selected) STATE.selectedInvestigations.push(i.name);
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <input type="checkbox" ${i.selected ? 'checked' : ''}
                onchange="toggleInvestigation('${i.name.replace(/'/g, "\\'")}')">
            <div class="checkbox-content"><div class="checkbox-label">${i.name}</div></div>
        `;
        invContainer.appendChild(item);
    });
    const btnMed = document.getElementById('btnNextMed');
    if (btnMed) btnMed.style.display = 'inline-block';

    // Medications
    STATE.selectedMedications = [];
    const medContainer = document.getElementById('medicationsContainer');
    medContainer.innerHTML = '';
    (enc.medications || []).forEach(m => {
        if (m.selected) STATE.selectedMedications.push(m.name);
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <input type="checkbox" ${m.selected ? 'checked' : ''}
                onchange="toggleMedication('${m.name.replace(/'/g, "\\'")}')">
            <div class="checkbox-content"><div class="checkbox-label">${m.name}</div></div>
        `;
        medContainer.appendChild(item);
    });
    document.getElementById('medicationsNotes').value = enc.medications_ai_notes || '';
    const btnProc = document.getElementById('btnNextProc');
    if (btnProc) btnProc.style.display = 'inline-block';

    // Procedures
    STATE.selectedProcedures = [];
    const procContainer = document.getElementById('proceduresContainer');
    procContainer.innerHTML = '';
    (enc.procedures || []).forEach(p => {
        if (p.selected) STATE.selectedProcedures.push(p.name);
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <input type="checkbox" ${p.selected ? 'checked' : ''}
                onchange="toggleProcedure('${p.name.replace(/'/g, "\\'")}')">
            <div class="checkbox-content"><div class="checkbox-label">${p.name}</div></div>
        `;
        procContainer.appendChild(item);
    });

    // Advice
    document.getElementById('adviceText').value   = enc.advice || '';
    document.getElementById('followupDate').value = enc.follow_up_date || '';
    document.getElementById('adviceNotes').value  = enc.advice_ai_notes || '';

    log('Loaded encounter', enc.consultation_id);
}

// ============================================================================
// NEW ENCOUNTER
// ============================================================================

function startNewEncounter() {
    STATE.viewMode           = false;
    STATE.currentEncounterId = null;
    STATE.sessionId          = generateSessionId();
    STATE.questions          = [];
    STATE.answers            = [];
    STATE.selectedDiagnoses      = [];
    STATE.selectedInvestigations = [];
    STATE.selectedMedications    = [];
    STATE.selectedProcedures     = [];

    const visitNum = STATE.encounterHistory.length + 1;
    document.getElementById('currentComplaint').textContent =
        `${STATE.currentComplaint || 'New Complaint'} — New Visit (${visitNum})`;

    clearFormFields();
    // Reset prescription button
    const rxBtn = document.querySelector('.btn-success');
    if (rxBtn) {
        rxBtn.disabled = false;
        rxBtn.textContent = 'Issue Prescription';
        rxBtn.style.backgroundColor = '';
    }


    if (STATE.currentComplaint) {
        document.getElementById('chiefComplaintInput').value = STATE.currentComplaint;
        addChiefComplaint();
    }

    const btn = document.getElementById('generateQuestionsBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Generate Questions'; btn.style.backgroundColor = ''; btn.style.color = ''; }

    // Reset new encounter tab highlight
    const bar = document.getElementById('encounterTabBar');
    if (bar) {
        bar.querySelectorAll('.encounter-tab').forEach(t => {
            t.style.background  = 'white';
            t.style.borderColor = '#e5e7eb';
            t.style.color       = '#475569';
        });
        const newTab = document.getElementById('newEncounterTab');
        if (newTab) { newTab.style.background = '#3b82f6'; newTab.style.color = 'white'; }
    }
}

// ============================================================================
// CLEAR FORM FIELDS
// ============================================================================

function clearFormFields() {
    document.getElementById('chiefComplaintChips').innerHTML = '';
    document.getElementById('chiefComplaintInput').value    = '';
    document.getElementById('height').value    = '';
    document.getElementById('weight').value    = '';
    document.getElementById('headCirc').value  = '';
    document.getElementById('temp').value      = '';
    document.getElementById('bp').value        = '';
    document.getElementById('questionsContainer').innerHTML = '';

    document.getElementById('diagnosisContainer').innerHTML     = '<p class="empty-state">Answer questions to generate diagnoses</p>';
    document.getElementById('investigationsContainer').innerHTML = '<p class="empty-state">Select diagnoses first</p>';
    document.getElementById('medicationsContainer').innerHTML    = '<p class="empty-state">Select investigations first</p>';
    document.getElementById('proceduresContainer').innerHTML     = '<p class="empty-state">Select medications first</p>';

    document.getElementById('diagnosisNotes').value      = '';
    document.getElementById('investigationsNotes').value = '';
    document.getElementById('medicationsNotes').value    = '';
    document.getElementById('proceduresNotes').value     = '';
    document.getElementById('adviceText').value          = '';
    document.getElementById('adviceNotes').value         = '';
    document.getElementById('followupDate').value        = '';

    document.getElementById('manualQAList').innerHTML   = '';
    document.getElementById('manualDiagList').innerHTML = '';
    document.getElementById('manualInvList').innerHTML  = '';
    document.getElementById('manualMedList').innerHTML  = '';
    document.getElementById('manualProcList').innerHTML = '';

    ['btnNextInv', 'btnNextMed', 'btnNextProc'].forEach(id => {
        const b = document.getElementById(id);
        if (b) { b.style.display = 'none'; b.disabled = false; b.textContent = id === 'btnNextInv' ? 'Next: Investigations →' : id === 'btnNextMed' ? 'Next: Medications →' : 'Next: Procedures →'; b.style.backgroundColor = ''; b.style.color = ''; }
    });
}

// ============================================================================
// CHIEF COMPLAINT
// ============================================================================

function addChiefComplaint() {
    const input = document.getElementById('chiefComplaintInput');
    const val   = input.value.trim();
    if (!val) return;
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `${val}<span class="chip-remove" onclick="removeChip(this)">×</span>`;
    document.getElementById('chiefComplaintChips').appendChild(chip);
    input.value = '';
}

function removeChip(el) { el.parentElement.remove(); }

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chiefComplaintInput');
    if (input) input.addEventListener('keypress', e => { if (e.key === 'Enter') addChiefComplaint(); });
});

// ============================================================================
// BUILD HISTORY CONTEXT FOR QWEN
// ============================================================================

function buildClinicalHistory() {
    if (!STATE.encounterHistory || STATE.encounterHistory.length === 0) return '';
    const lines = ['Previous encounters for this complaint:'];
    STATE.encounterHistory.forEach(enc => {
        const dx   = (enc.diagnoses     || []).filter(d => d.selected).map(d => d.name).join(', ') || 'None';
        const meds = (enc.medications   || []).filter(m => m.selected).map(m => m.name).join(', ') || 'None';
        const inv  = (enc.investigations|| []).filter(i => i.selected).map(i => i.name).join(', ') || 'None';
        lines.push(`Visit ${enc.visit_number} (${enc.visit_date}): Diagnoses: ${dx}. Investigations: ${inv}. Medications: ${meds}. Advice: ${enc.advice || 'None'}.`);
    });
    return lines.join('\n');
}

// ============================================================================
// GENERATE QUESTIONS
// ============================================================================

async function generateQuestions() {
    const chips = document.querySelectorAll('#chiefComplaintChips .chip');
    const complaints = Array.from(chips).map(c => c.textContent.replace('×', '').trim());
    if (complaints.length === 0) { alert('Please add a chief complaint first.'); return; }

    const chiefComplaint = complaints.join(', ');
    const vitals = [
        document.getElementById('height').value ? `Height: ${document.getElementById('height').value}cm` : '',
        document.getElementById('weight').value ? `Weight: ${document.getElementById('weight').value}kg` : '',
        document.getElementById('temp').value   ? `Temp: ${document.getElementById('temp').value}°C`    : '',
        document.getElementById('bp').value     ? `BP: ${document.getElementById('bp').value}`          : '',
    ].filter(Boolean).join(', ');

    const previousHistory = buildClinicalHistory();
    const clinicalHistory = [vitals, previousHistory].filter(Boolean).join('\n');

    const btn = document.getElementById('generateQuestionsBtn');
    btn.disabled = true; btn.textContent = 'Generating...';
    document.getElementById('questionsContainer').innerHTML = '<p class="empty-state">Calling triage engine...</p>';

    try {
        const res = await fetch(`${CONFIG.TRIAGE_API}/start`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chief_complaint:  chiefComplaint,
                clinical_history: clinicalHistory,
                patient_id:       STATE.currentPatient?.id || CONFIG.DEFAULT_PATIENT_ID,
            })
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();

        STATE.sessionId = data.session_id;
        STATE.questions = [];
        document.getElementById('questionsContainer').innerHTML = '';
        renderQuestion(data);

        btn.textContent = 'Questions Generated ✓';
        btn.style.backgroundColor = '#10b981'; btn.style.color = '#fff';
        log('Questions started', { history: !!previousHistory });
    } catch (e) {
        document.getElementById('questionsContainer').innerHTML = `<p class="empty-state" style="color:red;">Error: ${e.message}</p>`;
        btn.disabled = false; btn.textContent = 'Generate Questions';
    }
}

function renderQuestion(data) {
    const container = document.getElementById('questionsContainer');
    const qNum = STATE.questions.length + 1;
    const div = document.createElement('div');
    div.className = 'question-item';
    div.innerHTML = `
        <div class="question-text">Q${qNum}: ${data.question}</div>
        <div class="options-container">
            ${(data.options || []).map(opt =>
                `<button class="option-btn" onclick="answerQuestion(this, '${opt.replace(/'/g, "\\'")}', ${qNum})">${opt}</button>`
            ).join('')}
        </div>
    `;
    container.appendChild(div);
    STATE.questions.push({ question: data.question, answer: null });
}

async function answerQuestion(btn, selectedOption, qIndex) {
    btn.parentElement.querySelectorAll('.option-btn').forEach(b => { b.classList.remove('selected'); b.disabled = true; });
    btn.classList.add('selected');
    STATE.questions[qIndex - 1].answer = selectedOption;
    STATE.answers.push(selectedOption);

    try {
        const res = await fetch(`${CONFIG.TRIAGE_API}/answer`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: STATE.sessionId, selected_option: selectedOption })
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        if (data.completed) renderDiagnosisFromQuestions(data);
        else renderQuestion(data);
    } catch (e) {
        const err = document.createElement('p');
        err.className = 'empty-state'; err.style.color = 'red';
        err.textContent = `Error: ${e.message}`;
        document.getElementById('questionsContainer').appendChild(err);
    }
}

function renderDiagnosisFromQuestions(data) {
    const container = document.getElementById('diagnosisContainer');
    container.innerHTML = '';
    const diagnoses = data.considerations || data.diagnoses || [];

    if (!diagnoses.length) {
        container.innerHTML = '<p class="empty-state">No diagnoses returned. Add manually.</p>';
    } else {
        diagnoses.forEach(d => {
            const name = typeof d === 'string' ? d : d.name;
            const lk   = typeof d === 'object' ? (d.likelihood || '') : '';
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" onchange="toggleDiagnosis('${name.replace(/'/g, "\\'")}')">
                <div class="checkbox-content">
                    <div class="checkbox-label">${name}</div>
                    ${lk ? `<div class="checkbox-detail">Likelihood: ${lk}</div>` : ''}
                </div>
            `;
            container.appendChild(item);
        });
    }
    const btn = document.getElementById('btnNextInv');
    if (btn) btn.style.display = 'inline-block';
}

// ============================================================================
// DIAGNOSIS
// ============================================================================

function toggleDiagnosis(d) {
    const i = STATE.selectedDiagnoses.indexOf(d);
    if (i > -1) STATE.selectedDiagnoses.splice(i, 1); else STATE.selectedDiagnoses.push(d);
}

function saveDiagnoses()         { hideUnselected('diagnosisContainer'); }
function updateDiagnosisButton() { return; }

function proceedToInvestigations() {
    const all = [...STATE.selectedDiagnoses, ...getManualEntries('manualDiagList')];
    if (!all.length) { alert('Select or add at least one diagnosis.'); return; }
    STATE.selectedDiagnoses = [...new Set(all)];
    generateInvestigations();
}

// ============================================================================
// INVESTIGATIONS
// ============================================================================

async function generateInvestigations() {
    const container = document.getElementById('investigationsContainer');
    container.innerHTML = '<p class="empty-state">Generating investigations...</p>';
    try {
        const res = await fetch(`${CONFIG.TRIAGE_API}/select-diagnoses`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: STATE.sessionId, selected: [...STATE.selectedDiagnoses] })
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();

        container.innerHTML = '';
        (data.investigations || []).forEach(inv => {
            const name = inv.name || inv;
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" onchange="toggleInvestigation('${name.replace(/'/g, "\\'")}')">
                <div class="checkbox-content"><div class="checkbox-label">${name}</div></div>
            `;
            container.appendChild(item);
        });
        if (!data.investigations?.length) container.innerHTML = '<p class="empty-state">No investigations returned. Add manually.</p>';

        const nb = document.getElementById('btnNextMed'); if (nb) nb.style.display = 'inline-block';
        const ib = document.getElementById('btnNextInv'); if (ib) { ib.textContent = 'Investigations Generated ✓'; ib.disabled = true; ib.style.backgroundColor = '#10b981'; ib.style.color = '#fff'; }
    } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:red;">Error: ${e.message}</p>`;
    }
}

function toggleInvestigation(i) {
    const idx = STATE.selectedInvestigations.indexOf(i);
    if (idx > -1) STATE.selectedInvestigations.splice(idx, 1); else STATE.selectedInvestigations.push(i);
}

function saveInvestigations() { hideUnselected('investigationsContainer'); }

function proceedToMedications() {
    const all = [...STATE.selectedInvestigations, ...getManualEntries('manualInvList')];
    if (!all.length) { alert('Select or add at least one investigation.'); return; }
    STATE.selectedInvestigations = [...new Set(all)];
    generateMedications();
}

// ============================================================================
// MEDICATIONS
// ============================================================================

async function generateMedications() {
    const container = document.getElementById('medicationsContainer');
    container.innerHTML = '<p class="empty-state">Generating medications...</p>';
    try {
        const res = await fetch(`${CONFIG.TRIAGE_API}/select-investigations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: STATE.sessionId, selected: [...STATE.selectedInvestigations] })
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();

        container.innerHTML = '';
        (data.medications || []).forEach(med => {
            const name = med.name || med; const dose = med.dose || ''; const route = med.route || '';
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" onchange="toggleMedication('${name.replace(/'/g, "\\'")}')">
                <div class="checkbox-content">
                    <div class="checkbox-label">${name}</div>
                    ${dose  ? `<div class="checkbox-detail">${dose}</div>`         : ''}
                    ${route ? `<div class="checkbox-detail">Route: ${route}</div>` : ''}
                </div>
            `;
            container.appendChild(item);
        });
        if (!data.medications?.length) container.innerHTML = '<p class="empty-state">No medications returned. Add manually.</p>';

        const nb = document.getElementById('btnNextProc'); if (nb) nb.style.display = 'inline-block';
        const mb = document.getElementById('btnNextMed');  if (mb) { mb.textContent = 'Medications Generated ✓'; mb.disabled = true; mb.style.backgroundColor = '#10b981'; mb.style.color = '#fff'; }
    } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:red;">Error: ${e.message}</p>`;
    }
}

function toggleMedication(m) {
    const i = STATE.selectedMedications.indexOf(m);
    if (i > -1) STATE.selectedMedications.splice(i, 1); else STATE.selectedMedications.push(m);
}

function saveMedications() { hideUnselected('medicationsContainer'); }

function proceedToProcedures() {
    const all = [...STATE.selectedMedications, ...getManualEntries('manualMedList')];
    if (!all.length) { alert('Select or add at least one medication.'); return; }
    STATE.selectedMedications = [...new Set(all)];
    generateProcedures();
}

// ============================================================================
// PROCEDURES
// ============================================================================

async function generateProcedures() {
    const container = document.getElementById('proceduresContainer');
    container.innerHTML = '<p class="empty-state">Generating procedures...</p>';
    try {
        const res = await fetch(`${CONFIG.TRIAGE_API}/select-medications`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: STATE.sessionId, selected: [...STATE.selectedMedications] })
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();

        container.innerHTML = '';
        (data.procedures || []).forEach(proc => {
            const name = proc.name || proc;
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" onchange="toggleProcedure('${name.replace(/'/g, "\\'")}')">
                <div class="checkbox-content"><div class="checkbox-label">${name}</div></div>
            `;
            container.appendChild(item);
        });
        if (!data.procedures?.length) container.innerHTML = '<p class="empty-state">No procedures returned. Add manually.</p>';

        const pb = document.getElementById('btnNextProc'); if (pb) { pb.textContent = 'Procedures Generated ✓'; pb.disabled = true; pb.style.backgroundColor = '#10b981'; pb.style.color = '#fff'; }
    } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:red;">Error: ${e.message}</p>`;
    }
}

function toggleProcedure(p) {
    const i = STATE.selectedProcedures.indexOf(p);
    if (i > -1) STATE.selectedProcedures.splice(i, 1); else STATE.selectedProcedures.push(p);
}

function saveProcedures() { hideUnselected('proceduresContainer'); }

// ============================================================================
// MANUAL ENTRIES
// ============================================================================

function addManualQA() {
    const item = document.createElement('div');
    item.className = 'manual-qa-item';
    item.innerHTML = `
        <input type="text" placeholder="Enter your question..." data-type="question"/>
        <input type="text" placeholder="Enter the answer..."   data-type="answer"/>
    `;
    document.getElementById('manualQAList').appendChild(item);
}

function addManualEntry(containerId, placeholder) {
    const item = document.createElement('div');
    item.className = 'manual-entry-item';
    item.innerHTML = `
        <input type="text" placeholder="${placeholder}"/>
        <button class="btn-remove" onclick="this.parentElement.remove()">×</button>
    `;
    document.getElementById(containerId).appendChild(item);
}

function getManualEntries(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} input`))
        .map(i => i.value.trim()).filter(Boolean);
}

function addManualDiagnosis()     { addManualEntry('manualDiagList', 'Enter diagnosis...'); }
function addManualInvestigation() { addManualEntry('manualInvList',  'Enter investigation...'); }
function addManualMedication()    { addManualEntry('manualMedList',  'Enter medication...'); }
function addManualProcedure()     { addManualEntry('manualProcList', 'Enter procedure...'); }

// ============================================================================
// HIDE UNSELECTED
// ============================================================================

function hideUnselected(containerId) {
    document.querySelectorAll(`#${containerId} .checkbox-item`).forEach(item => {
        const cb = item.querySelector('input[type="checkbox"]');
        if (cb && !cb.checked) { item.classList.add('removing'); setTimeout(() => item.remove(), 300); }
    });
}

// ============================================================================
// AI NOTES — SSE streaming from 8004
// ============================================================================

async function generateNotes(section) {
    const notesMap = { diagnosis: 'diagnosisNotes', investigations: 'investigationsNotes', medications: 'medicationsNotes', procedures: 'proceduresNotes', advice: 'adviceNotes' };
    const notesId  = notesMap[section];
    if (!notesId) return;

    const notesArea = document.getElementById(notesId);
    const btn       = event?.target || null;
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
    notesArea.value = '';

    const chips = document.querySelectorAll('#chiefComplaintChips .chip');
    const payload = {
        patient_id: STATE.currentPatient?.id || CONFIG.DEFAULT_PATIENT_ID,
        context: {
            chief_complaint: Array.from(chips).map(c => c.textContent.replace('×', '').trim()).join(', '),
            diagnoses:       [...STATE.selectedDiagnoses,      ...getManualEntries('manualDiagList')],
            investigations:  [...STATE.selectedInvestigations, ...getManualEntries('manualInvList')],
            medications:     [...STATE.selectedMedications,    ...getManualEntries('manualMedList')],
            procedures:      [...STATE.selectedProcedures,     ...getManualEntries('manualProcList')],
        },
        section,
        debug: false
    };

    try {
        const res = await fetch(`${CONFIG.SUMMARY_API}/api/v1/generate-summary-stream`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const dec    = new TextDecoder();
        let buffer   = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += dec.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.token) { notesArea.value += data.token; notesArea.scrollTop = notesArea.scrollHeight; }
                        if (data.done && btn) { btn.textContent = 'Generated ✓'; setTimeout(() => { btn.textContent = 'Generate AI Notes'; }, 2000); }
                    } catch {}
                }
            }
        }
    } catch (e) {
        notesArea.value = `Error: ${e.message}`;
        if (btn) btn.textContent = 'Retry';
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ============================================================================
// ISSUE PRESCRIPTION
// ============================================================================

async function issuePrescription() {
    const chips           = document.querySelectorAll('#chiefComplaintChips .chip');
    const chiefComplaints = Array.from(chips).map(c => c.textContent.replace('×', '').trim());
    const allDx   = [...STATE.selectedDiagnoses,      ...getManualEntries('manualDiagList')];
    const allInv  = [...STATE.selectedInvestigations, ...getManualEntries('manualInvList')];
    const allMeds = [...STATE.selectedMedications,    ...getManualEntries('manualMedList')];
    const allProc = [...STATE.selectedProcedures,     ...getManualEntries('manualProcList')];

    if (!STATE.currentPatient)        { alert('No patient selected.'); return; }
    if (!chiefComplaints.length)      { alert('No chief complaint.'); return; }

    const payload = {
        patient_id:       STATE.currentPatient.id,
        visit_date:       new Date().toISOString().split('T')[0],
        chief_complaints: chiefComplaints,
        vitals: {
            height_cm:    parseFloat(document.getElementById('height').value)   || null,
            weight_kg:    parseFloat(document.getElementById('weight').value)   || null,
            head_circ_cm: parseFloat(document.getElementById('headCirc').value) || null,
            temp_celsius: parseFloat(document.getElementById('temp').value)     || null,
            bp_mmhg:      document.getElementById('bp').value || null
        },
        key_questions:          STATE.questions.filter(q => q.answer).map(q => ({ question: q.question, answer: q.answer })),
        key_questions_ai_notes: '',
        diagnoses:              allDx.map(d   => ({ name: d, selected: true, is_custom: false })),
        diagnoses_ai_notes:     document.getElementById('diagnosisNotes').value || '',
        investigations:         allInv.map(i  => ({ name: i, selected: true, is_custom: false })),
        investigations_ai_notes: '',
        medications:            allMeds.map(m => ({ name: m, selected: true, is_custom: false })),
        medications_ai_notes:   document.getElementById('medicationsNotes')?.value || '',
        procedures:             allProc.map(p => ({ name: p, selected: true, is_custom: false })),
        procedures_ai_notes:    '',
        advice:                 document.getElementById('adviceText').value || '',
        follow_up_date:         document.getElementById('followupDate').value || null,
        advice_ai_notes:        document.getElementById('adviceNotes').value || '',
        session_id: STATE.sessionId,  // add this field
    };

    const btn = document.querySelector('.btn-success');
    try {
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
        const res = await fetch(`${CONFIG.REDIS_API}/api/v1/consultation`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || `HTTP ${res.status}`); }
        const saved = await res.json();
        // Only add if not already in history
        const exists = STATE.encounterHistory.find(e => e.consultation_id === saved.consultation_id);
        if (!exists) {
            STATE.encounterHistory.push(saved);
            STATE.encounterHistory.sort((a, b) => a.visit_number - b.visit_number);
        }
        renderEncounterTabs();

        if (btn) { btn.textContent = 'Prescription Issued ✓'; btn.style.backgroundColor = '#10b981'; }
        alert(`Consultation saved!\nVisit ${saved.visit_number} — ${saved.visit_date}\nDiagnoses: ${allDx.join(', ') || 'none'}`);
        log('Saved', saved.consultation_id);
    } catch (e) {
        alert(`Failed: ${e.message}`);
        if (btn) { btn.disabled = false; btn.textContent = 'Issue Prescription'; }
    }
}

// ============================================================================
// FORM ACTIONS
// ============================================================================

function saveDraft() {
    console.log('Draft:', { patient: STATE.currentPatient?.name, diagnoses: STATE.selectedDiagnoses });
    alert('Draft saved (see console).');
}

function cancel() {
    if (confirm('Cancel this consultation?')) {
        document.getElementById('consultationForm').style.display = 'none';
        document.getElementById('emptyState').style.display       = 'flex';
        const bar = document.getElementById('encounterTabBar');
        if (bar) bar.remove();
        STATE.currentPatient   = null;
        STATE.currentComplaint = null;
        STATE.encounterHistory = [];
    }
}

// ============================================================================
// LEGACY COMPATIBILITY — index.html calls these
// ============================================================================

function loadEncounter(patientKey, complaintKey) {
    const nameMap = { fever: 'Fever', cough: 'Cough', headache: 'Headache' };
    openComplaint(patientKey, nameMap[complaintKey] || complaintKey);
}

function newEncounter(patientKey) { newComplaint(patientKey); }
function switchEncounter()        { /* replaced by tabs */ }
function clearForm()              { clearFormFields(); }

// ============================================================================
// INIT
// ============================================================================

log('Clinical UI v2.0 Initialized');