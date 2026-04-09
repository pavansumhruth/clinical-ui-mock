// ============================================================================
// UTILITY
// ============================================================================

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function log(message, data) {
    console.log(`[Clinical UI] ${message}`, data || '');
}

const MONITOR = {
    logs: [],
    maxLogs: 100,
};

function addLog(type, message, details = {}) {
    const entry = {
        type,
        message,
        details,
        timestamp: new Date().toISOString()
    };

    MONITOR.logs.unshift(entry);
    if (MONITOR.logs.length > MONITOR.maxLogs) {
        MONITOR.logs = MONITOR.logs.slice(0, MONITOR.maxLogs);
    }

    renderLogs();
}

function renderLogs() {
    const container = document.getElementById('apiLogs');
    if (!container) return;

    container.textContent = '';

    MONITOR.logs.forEach((entry) => {
        const item = document.createElement('div');
        item.className = `log-item ${entry.type}`;

        const header = document.createElement('div');
        header.className = 'log-item-header';

        const message = document.createElement('span');
        message.className = 'log-item-message';
        message.textContent = entry.message;

        const time = document.createElement('span');
        time.className = 'log-item-time';
        time.textContent = new Date(entry.timestamp).toLocaleTimeString();

        header.appendChild(message);
        header.appendChild(time);

        const details = document.createElement('pre');
        details.className = 'log-item-details';
        details.textContent = JSON.stringify(entry.details, null, 2);

        item.appendChild(header);
        item.appendChild(details);
        container.appendChild(item);
    });
}

function clearLogs() {
    MONITOR.logs = [];
    renderLogs();
}

function interpretError(error) {
    const msg = error?.message || 'Unknown error';

    if (msg.includes('Failed to fetch')) {
        return {
            reason: 'Network/CORS issue',
            explanation: 'Backend unreachable or blocked by CORS'
        };
    }

    if (msg.includes('422')) {
        return {
            reason: 'Validation error',
            explanation: 'Invalid data sent to backend'
        };
    }

    if (msg.includes('500')) {
        return {
            reason: 'Server error',
            explanation: 'Backend crashed or failed internally'
        };
    }

    return {
        reason: 'Unknown error',
        explanation: msg
    };
}

async function apiRequest(url, options, serviceName, settings = {}) {
    const parseJson = settings.parseJson !== false;

    addLog('info', `${serviceName}: Request`, { url, method: options?.method || 'GET' });

    try {
        const res = await fetch(url, options);

        if (!res.ok) {
            let err = {};
            try {
                err = await res.json();
            } catch {}
            const detail = err?.detail ? `: ${err.detail}` : '';
            throw new Error(`${res.status}${detail}`);
        }

        if (!parseJson) {
            addLog('success', `${serviceName}: Success`, { url, status: res.status });
            return res;
        }

        const data = await res.json();
        addLog('success', `${serviceName}: Success`, data);
        return data;
    } catch (error) {
        const info = interpretError(error);

        addLog('error', `${serviceName}: Failed`, {
            url,
            error: error.message,
            reason: info.reason,
            explanation: info.explanation
        });

        throw error;
    }
}

async function syncConsultationToTriage(payload) {
    return apiRequest(
        `${CONFIG.TRIAGE_API}/api/v1/consultation`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        },
        'Triage API'
    );
}

async function checkAllServices() {
    const services = [
        { name: 'Redis API', url: `${CONFIG.REDIS_API}/health` },
        { name: 'Triage API', url: `${CONFIG.TRIAGE_API}/health` },
        { name: 'Summary API', url: `${CONFIG.SUMMARY_API}/health` }
    ];

    const container = document.getElementById('serviceStatus');
    if (!container) return;
    container.textContent = '';

    for (const svc of services) {
        const el = document.createElement('div');
        el.className = 'service-status-item';

        try {
            const res = await fetch(svc.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            el.textContent = `${svc.name} -> UP`;
            el.classList.add('up');
        } catch {
            el.textContent = `${svc.name} -> DOWN`;
            el.classList.add('down');
        }

        container.appendChild(el);
    }
}





function resolveComplaintChain(chiefComplaintText) {
    const fromState = (STATE.currentComplaintSlug || "").trim();
    if (fromState) return fromState;

    const fromInput = (document.getElementById("complaintChainInput")?.value || "").trim();
    if (fromInput) return fromInput;

    return (chiefComplaintText || "").trim();
}

function getCurrentPatientId() {
    return STATE.currentPatient?.patient_id || STATE.currentPatient?.id || CONFIG.DEFAULT_PATIENT_ID;
}

function resetEncounterState() {
    STATE.sessionId = null;
    STATE.viewMode = false;
    STATE.currentEncounterId = null;
    STATE.encounterHistory = [];
    STATE.questions = [];
    STATE.answers = [];
    STATE.selectedDiagnoses = [];
    STATE.selectedInvestigations = [];
    STATE.selectedMedications = [];
    STATE.selectedProcedures = [];
    STATE.manualQuestions = [];
    STATE.manualDiagnoses = [];
    STATE.manualInvestigations = [];
    STATE.manualMedications = [];
    STATE.manualProcedures = [];
}

function activatePatient(patient, options = {}) {
    if (!patient) return;

    resetEncounterState();
    STATE.currentPatient = patient;
    STATE.currentComplaint = options.complaint ?? null;
    STATE.currentComplaintSlug = options.complaintSlug ?? null;

    localStorage.setItem('selectedPatientId', patient.patient_id);

    const patientNameEl = document.getElementById('currentPatientName');
    if (patientNameEl) patientNameEl.textContent = patient.name;

    const complaintEl = document.getElementById('currentComplaint');
    if (complaintEl) complaintEl.textContent = options.complaintLabel || (options.complaint || 'New Complaint');

    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';

    const form = document.getElementById('consultationForm');
    if (form) form.style.display = 'block';

    const chainSection = document.getElementById('complaintChainSection');
    if (chainSection) chainSection.style.display = 'none';

    const bar = document.getElementById('encounterTabBar');
    if (bar) bar.remove();

    if (typeof renderPatientList === 'function') {
        renderPatientList(patient.patient_id);
    }
}

function selectPatient(patient) {
    activatePatient(patient);
    ensureComplaintDropdown();
    STATE.encounterHistory = [];
    STATE.currentComplaintSlug = null;

    const dropdown = document.getElementById('complaintDropdown');
    if (dropdown) {
        dropdown.innerHTML = '<option value="">New Complaint</option><option value="" disabled>Loading complaint chains...</option>';
        dropdown.value = '';
    }

    addLog('info', 'Patient selected', {
        patient_id: patient.patient_id,
        name: patient.name
    });
    startNewEncounter();
    loadPatientComplaints(patient.patient_id);
}

function ensureComplaintDropdown() {
    let container = document.getElementById('complaintDropdownContainer');

    if (!container) {
        container = document.createElement('div');
        container.id = 'complaintDropdownContainer';
        container.style.margin = '12px 32px';

        const label = document.createElement('label');
        label.setAttribute('for', 'complaintDropdown');
        label.textContent = 'Complaint Chain';
        label.style.display = 'block';
        label.style.fontWeight = '600';
        label.style.marginBottom = '6px';

        const select = document.createElement('select');
        select.id = 'complaintDropdown';
        select.style.width = '100%';
        select.style.padding = '8px';
        select.style.border = '1px solid #cbd5e1';
        select.style.borderRadius = '6px';
        select.style.background = '#ffffff';

        container.appendChild(label);
        container.appendChild(select);

        const form = document.getElementById('consultationForm');
        if (!form) return;
        form.insertBefore(container, form.firstChild);
    }

    bindComplaintDropdownOnce();
}

function bindComplaintDropdownOnce() {
    if (window._complaintDropdownBound) return;

    document.addEventListener('change', async (e) => {
        if (e.target.id !== 'complaintDropdown') return;

        const slug = e.target.value;
        const patient = STATE.currentPatient;
        if (!patient) return;

        if (!slug) {
            STATE.currentComplaintSlug = null;
            STATE.encounterHistory = [];
            renderEncounterTabs();
            startNewEncounter();
            return;
        }

        STATE.currentComplaintSlug = slug;
        STATE.encounterHistory = [];
        renderEncounterTabs();

        const activePatientId = patient.patient_id;
        const activeChainSlug = slug;

        try {
            const data = await apiRequest(
                `${CONFIG.REDIS_API}/api/v1/patient/${activePatientId}/complaint?complaint=${encodeURIComponent(activeChainSlug)}&limit=20`,
                { method: 'GET' },
                'Redis API'
            );

            if (STATE.currentPatient?.patient_id !== activePatientId || STATE.currentComplaintSlug !== activeChainSlug) {
                return;
            }

            STATE.encounterHistory = Array.isArray(data) ? data : [];
            STATE.encounterHistory.sort((a, b) => a.visit_number - b.visit_number);
        } catch (error) {
            if (STATE.currentPatient?.patient_id !== activePatientId || STATE.currentComplaintSlug !== activeChainSlug) {
                return;
            }
            STATE.encounterHistory = [];
            log('Could not load encounter history from dropdown', error);
        }

        renderEncounterTabs();
        startNewEncounter();
    });

    window._complaintDropdownBound = true;
}
// ============================================================================
// SIDEBAR — Patient complaint click → fetch history from Redis
// ============================================================================

async function loadPatientComplaints(patientKey) {
    const patient = getPatientById(patientKey);
    if (!patient) return;

    const popup = document.getElementById(`complaints-${patientKey}`);
    if (popup) {
        popup.innerHTML = '<div class="complaint-item">Loading complaints...</div>';
    }

    try {
        const complaints = await apiRequest(
            `${CONFIG.REDIS_API}/api/v1/patient/${patient.patient_id}/complaints`,
            { method: 'GET' },
            'Redis API'
        );

        ensureComplaintDropdown();
        const dropdown = document.getElementById('complaintDropdown');
        if (dropdown) {
            dropdown.innerHTML = '<option value="">New Complaint</option>';

            (complaints || []).forEach((item) => {
                const opt = document.createElement('option');
                opt.value = item.chain_slug;
                opt.textContent = `${item.display_name} (${item.visit_count})`;
                dropdown.appendChild(opt);
            });

            const hasActiveSlug = Array.from(dropdown.options).some((opt) => opt.value === STATE.currentComplaintSlug);
            if (STATE.currentComplaintSlug && hasActiveSlug) {
                dropdown.value = STATE.currentComplaintSlug;
            } else {
                dropdown.value = '';
            }
        }

        if (popup) {
            popup.innerHTML = '';
        }

        (complaints || []).forEach((item) => {
            if (popup) {
                const complaintItem = document.createElement('div');
                complaintItem.className = 'complaint-item';
                complaintItem.textContent = `${item.display_name} (${item.visit_count} visits)`;
                complaintItem.onclick = () => openComplaintChain(patientKey, item.display_name, item.chain_slug);
                popup.appendChild(complaintItem);
            }
        });

        if (popup) {
            const newComplaintItem = document.createElement('div');
            newComplaintItem.className = 'complaint-item new';
            newComplaintItem.textContent = 'New Complaint';
            newComplaintItem.onclick = () => startNewComplaint(patientKey);
            popup.appendChild(newComplaintItem);
        }

        if (popup) {
            popup.dataset.loaded = 'false';
        }
    } catch (e) {
        ensureComplaintDropdown();
        const dropdown = document.getElementById('complaintDropdown');
        if (dropdown) {
            dropdown.innerHTML = '<option value="">New Complaint</option>';
            dropdown.value = '';
        }

        if (popup) {
            popup.innerHTML = '';
            const newComplaintItem = document.createElement('div');
            newComplaintItem.className = 'complaint-item new';
            newComplaintItem.textContent = 'New Complaint';
            newComplaintItem.onclick = () => startNewComplaint(patientKey);
            popup.appendChild(newComplaintItem);
        }
        log('Could not load complaints', e);
    }
}

async function openComplaintChain(patientKey, displayName, chainSlug) {
    const patient = getPatientById(patientKey);
    if (!patient) return;

    activatePatient(patient, { complaint: displayName, complaintSlug: chainSlug, complaintLabel: displayName });
    STATE.currentComplaintSlug = chainSlug;
    STATE.encounterHistory = [];

    const dropdown = document.getElementById('complaintDropdown');
    if (dropdown) dropdown.value = chainSlug;

    renderEncounterTabs();

    const activePatientId = patient.patient_id;
    const activeChainSlug = STATE.currentComplaintSlug;

    try {
        const data = await apiRequest(
            `${CONFIG.REDIS_API}/api/v1/patient/${activePatientId}/complaint?complaint=${encodeURIComponent(activeChainSlug)}&limit=20`,
            { method: 'GET' },
            'Redis API'
        );

        if (STATE.currentPatient?.patient_id !== activePatientId || STATE.currentComplaintSlug !== activeChainSlug) {
            return;
        }

        STATE.encounterHistory = Array.isArray(data) ? data : [];
        STATE.encounterHistory.sort((a, b) => a.visit_number - b.visit_number);

        addLog('info', 'Encounters rendered', {
            patient_id: activePatientId,
            complaint_chain: activeChainSlug,
            count: STATE.encounterHistory.length
        });
    } catch (e) {
        if (STATE.currentPatient?.patient_id !== activePatientId || STATE.currentComplaintSlug !== activeChainSlug) {
            return;
        }
        STATE.encounterHistory = [];
        log('Could not load encounter history', e);
    }

    renderEncounterTabs();
    startNewEncounter();
}

function startNewComplaint(patientKey) {
    const patient = getPatientById(patientKey);
    if (!patient) return;

    STATE.currentComplaintSlug = null;
    STATE.encounterHistory = [];

    const dropdown = document.getElementById('complaintDropdown');
    if (dropdown) dropdown.value = '';

    activatePatient(patient, { complaintLabel: 'New Complaint' });

    renderEncounterTabs();
    startNewEncounter();
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
    }

    const form = document.getElementById('consultationForm');
    const dropdownContainer = document.getElementById('complaintDropdownContainer');
    if (dropdownContainer && dropdownContainer.nextSibling) {
        form.insertBefore(bar, dropdownContainer.nextSibling);
    } else {
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

    addLog('info', 'Encounter started', {
        patient_id: getCurrentPatientId(),
        visit_number: visitNum,
        complaint: STATE.currentComplaint || 'New Complaint'
    });

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
        addChiefComplaint(true);
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
    document.getElementById('complaintChainInput').value = '';
    document.getElementById('complaintChainPreview').textContent = '';

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

function sectionHasContent(containerId) {
    return document.querySelectorAll(
        `#${containerId} .checkbox-item`
    ).length > 0;
}

function resetNextButton(btnId, label) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = label;
    btn.style.cssText = '';
    btn.style.display = 'none';
}

function setContainerEmptyState(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
        container.innerHTML = `<p class="empty-state">${message}</p>`;
    }
}

function clearDownstreamFromChiefComplaint() {
    const qc = document.getElementById('questionsContainer');
    if (qc) {
        qc.innerHTML = '<p class="empty-state">Add chief complaint and click Generate Questions</p>';
    }
    setContainerEmptyState('diagnosisContainer', 'Answer questions to generate diagnoses');
    setContainerEmptyState('investigationsContainer', 'Select diagnoses first');
    setContainerEmptyState('medicationsContainer', 'Select investigations first');
    setContainerEmptyState('proceduresContainer', 'Select medications first');

    ['diagnosisNotes', 'investigationsNotes', 'medicationsNotes', 'proceduresNotes', 'adviceNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.dispatchEvent(new Event('input'));
        }
    });

    resetNextButton('btnNextInv', 'Next: Investigations →');
    resetNextButton('btnNextMed', 'Next: Medications →');
    resetNextButton('btnNextProc', 'Next: Procedures →');

    const generateBtn = document.getElementById('generateQuestionsBtn');
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Questions';
        generateBtn.style.backgroundColor = '';
        generateBtn.style.color = '';
        generateBtn.style.border = '';
        generateBtn.style.opacity = '';
    }

    STATE.sessionId = null;
    STATE.questions = [];
    STATE.answers = [];
    STATE.selectedDiagnoses = [];
    STATE.selectedInvestigations = [];
    STATE.selectedMedications = [];
    STATE.selectedProcedures = [];
    STATE.manualDiagnoses = [];
    STATE.manualInvestigations = [];
    STATE.manualMedications = [];
    STATE.manualProcedures = [];

    ['manualQAList', 'manualDiagList', 'manualInvList', 'manualMedList', 'manualProcList'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
}

function clearDownstreamFromDiagnosis() {
    ['investigationsContainer','medicationsContainer','proceduresContainer'].forEach(id => {
        const w = document.getElementById(id)?.querySelector('.regenerate-warning');
        if (w) w.remove();
    });

    setContainerEmptyState('investigationsContainer', 'Select diagnoses first');
    setContainerEmptyState('medicationsContainer', 'Select investigations first');
    setContainerEmptyState('proceduresContainer', 'Select medications first');

    ['investigationsNotes', 'medicationsNotes', 'proceduresNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.dispatchEvent(new Event('input'));
        }
    });

    resetNextButton('btnNextMed', 'Next: Medications →');
    resetNextButton('btnNextProc', 'Next: Procedures →');
    resetNextButton('btnNextInv', 'Next: Investigations →');
    const btnNextInv = document.getElementById('btnNextInv');
    if (btnNextInv) btnNextInv.style.display = 'inline-block';

    STATE.selectedInvestigations = [];
    STATE.selectedMedications = [];
    STATE.selectedProcedures = [];

    ['manualInvList', 'manualMedList', 'manualProcList'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
}

function clearDownstreamFromInvestigation() {
    ['medicationsContainer','proceduresContainer'].forEach(id => {
        const w = document.getElementById(id)?.querySelector('.regenerate-warning');
        if (w) w.remove();
    });

    setContainerEmptyState('medicationsContainer', 'Select investigations first');
    setContainerEmptyState('proceduresContainer', 'Select medications first');

    ['medicationsNotes', 'proceduresNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.dispatchEvent(new Event('input'));
        }
    });

    resetNextButton('btnNextProc', 'Next: Procedures →');
    resetNextButton('btnNextMed', 'Next: Medications →');
    const btnNextMed = document.getElementById('btnNextMed');
    if (btnNextMed) btnNextMed.style.display = 'inline-block';

    STATE.selectedMedications = [];
    STATE.selectedProcedures = [];

    ['manualMedList', 'manualProcList'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
}

function clearDownstreamFromMedication() {
    const w = document.getElementById('proceduresContainer')?.querySelector('.regenerate-warning');
    if (w) w.remove();

    setContainerEmptyState('proceduresContainer', 'Select medications first');

    const proceduresNotes = document.getElementById('proceduresNotes');
    if (proceduresNotes) {
        proceduresNotes.value = '';
        proceduresNotes.dispatchEvent(new Event('input'));
    }

    resetNextButton('btnNextProc', 'Next: Procedures →');
    const btnNextProc = document.getElementById('btnNextProc');
    if (btnNextProc) btnNextProc.style.display = 'inline-block';

    STATE.selectedProcedures = [];

    const manualProcList = document.getElementById('manualProcList');
    if (manualProcList) manualProcList.innerHTML = '';
}

function handleManualEntryDownstream(containerId) {
    if (containerId === 'manualDiagList' && sectionHasContent('investigationsContainer')) {
        clearDownstreamFromDiagnosis();
    }
    if (containerId === 'manualInvList' && sectionHasContent('medicationsContainer')) {
        clearDownstreamFromInvestigation();
    }
    if (containerId === 'manualMedList' && sectionHasContent('proceduresContainer')) {
        clearDownstreamFromMedication();
    }
}

function removeManualEntry(btn, containerId) {
    if (btn && btn.parentElement) {
        btn.parentElement.remove();
    }
    handleManualEntryDownstream(containerId);
}

function showComplaintChainInput() {
    document.getElementById('complaintChainSection').style.display = 'block';
    document.getElementById('complaintChainInput').value = '';
    document.getElementById('complaintChainPreview').textContent = '';
    STATE.currentComplaintSlug = null;
}

function onComplaintChainInput(inputEl) {
    const raw = inputEl.value.trim();
    STATE.currentComplaintSlug = raw;

    document.getElementById("complaintChainPreview").textContent =
        raw ? `Chain: "${raw}"` : "";
}

// ============================================================================
// CHIEF COMPLAINT
// ============================================================================

function addChiefComplaint(silent = false) {
    const input = document.getElementById('chiefComplaintInput');
    const val   = input.value.trim();
    if (!val) return;
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `${val}<span class="chip-remove" onclick="removeChip(this)">×</span>`;
    document.getElementById('chiefComplaintChips').appendChild(chip);
    input.value = '';
    if (!silent) {
    clearDownstreamFromChiefComplaint();
}
}

function removeChip(el) {
    el.parentElement.remove();
    clearDownstreamFromChiefComplaint();
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chiefComplaintInput');
    if (input) input.addEventListener('keypress', e => { if (e.key === 'Enter') addChiefComplaint(); });

    const clearBtn = document.getElementById('clearLogsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearLogs);
    }

    checkAllServices();

    ensureComplaintDropdown();

    if (typeof renderPatientList === 'function') {
        renderPatientList();
    }

    const selectedPatientId = localStorage.getItem('selectedPatientId');
    if (selectedPatientId && typeof getPatientById === 'function') {
        const patient = getPatientById(selectedPatientId);
        if (patient) {
            selectPatient(patient);
        }
    }
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
    const manualQuestionAnswers = getManualQuestionAnswers();
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
        const complaintChain = resolveComplaintChain(chiefComplaint);

        const data = await apiRequest(
            `${CONFIG.TRIAGE_API}/start`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chief_complaint:  chiefComplaint,
                    complaint_chain:  complaintChain,
                    clinical_history: clinicalHistory,
                    patient_id:       getCurrentPatientId(),
                    manual_key_questions: manualQuestionAnswers,
                })
            },
            'Triage API'
        );

        STATE.sessionId = data.session_id;
        STATE.questions = [];
        document.getElementById('questionsContainer').innerHTML = '';
        renderQuestion(data);

        addLog('info', 'Questions generated', {
            patient_id: getCurrentPatientId(),
            session_id: STATE.sessionId
        });

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
        const data = await apiRequest(
            `${CONFIG.TRIAGE_API}/answer`,
            {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id:           STATE.sessionId,
                    selected_option:      selectedOption,
                    manual_key_questions: getManualQuestionAnswers(),
                })
            },
            'Triage API'
        );
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

function showRegenerateWarning(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    // remove any existing warning first
    const existing = container.querySelector('.regenerate-warning');
    if (existing) existing.remove();

    const warning = document.createElement('div');
    warning.className = 'regenerate-warning';
    warning.style.cssText = `
        background: #fefce8; border: 1.5px solid #facc15;
        border-radius: 8px; padding: 12px 16px; margin-bottom: 10px;
        display: flex; align-items: center; gap: 10px;
    `;
    warning.innerHTML = `
        <span style="font-size:18px;">⚠️</span>
        <span class="warning-text" style="font-size:13px; color:#854d0e; font-weight:500; flex:1;">${message}</span>
    `;
    container.insertBefore(warning, container.firstChild);
}

function toggleDiagnosis(d) {
    const i = STATE.selectedDiagnoses.indexOf(d);
    if (i > -1) STATE.selectedDiagnoses.splice(i, 1);
    else STATE.selectedDiagnoses.push(d);

    if (sectionHasContent('investigationsContainer')) {
        clearDownstreamFromDiagnosis();
        showRegenerateWarning('investigationsContainer', 
            'Diagnosis changed — click "Next: Investigations →" to regenerate');
    }
}

function saveDiagnoses()         { hideUnselected('diagnosisContainer'); }
function updateDiagnosisButton() { return; }

function proceedToInvestigations() {
    const all = [...STATE.selectedDiagnoses, ...getManualEntries('manualDiagList')];
    if (!all.length) { alert('Select or add at least one diagnosis.'); return; }
    STATE.selectedDiagnoses = [...new Set(all)];
    clearDownstreamFromDiagnosis();
    generateInvestigations();
}

// ============================================================================
// INVESTIGATIONS
// ============================================================================

async function generateInvestigations() {
    const container = document.getElementById('investigationsContainer');
    container.innerHTML = '<p class="empty-state">Generating investigations...</p>';
    try {
        const data = await apiRequest(
            `${CONFIG.TRIAGE_API}/select-diagnoses`,
            {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id:           STATE.sessionId,
                    selected:             [...STATE.selectedDiagnoses],
                    manual_key_questions: getManualQuestionAnswers(),
                    manual_diagnoses:     getManualEntries('manualDiagList'),
                })
            },
            'Triage API'
        );

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
    if (idx > -1) STATE.selectedInvestigations.splice(idx, 1);
    else STATE.selectedInvestigations.push(i);

    if (sectionHasContent('medicationsContainer')) {
        clearDownstreamFromInvestigation();
        showRegenerateWarning('medicationsContainer', 
            'Investigation changed — click "Next: Medications →" to regenerate');
    }
}

function saveInvestigations() { hideUnselected('investigationsContainer'); }

function proceedToMedications() {
    const all = [...STATE.selectedInvestigations, ...getManualEntries('manualInvList')];
    if (!all.length) { alert('Select or add at least one investigation.'); return; }
    STATE.selectedInvestigations = [...new Set(all)];
    clearDownstreamFromInvestigation();
    generateMedications();
}

// ============================================================================
// MEDICATIONS
// ============================================================================

async function generateMedications() {
    const container = document.getElementById('medicationsContainer');
    container.innerHTML = '<p class="empty-state">Generating medications...</p>';
    try {
        const data = await apiRequest(
            `${CONFIG.TRIAGE_API}/select-investigations`,
            {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id:              STATE.sessionId,
                    selected:                [...STATE.selectedInvestigations],
                    manual_key_questions:    getManualQuestionAnswers(),
                    manual_investigations:   getManualEntries('manualInvList'),
                })
            },
            'Triage API'
        );

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
    if (i > -1) STATE.selectedMedications.splice(i, 1);
    else STATE.selectedMedications.push(m);

    if (sectionHasContent('proceduresContainer')) {
        clearDownstreamFromMedication();
        showRegenerateWarning('proceduresContainer', 
            'Medication changed — click "Next: Procedures →" to regenerate');
    }
}

function saveMedications() { hideUnselected('medicationsContainer'); }

function proceedToProcedures() {
    const all = [...STATE.selectedMedications, ...getManualEntries('manualMedList')];
    if (!all.length) { alert('Select or add at least one medication.'); return; }
    STATE.selectedMedications = [...new Set(all)];
    clearDownstreamFromMedication();
    generateProcedures();
}

// ============================================================================
// PROCEDURES
// ============================================================================

async function generateProcedures() {
    const container = document.getElementById('proceduresContainer');
    container.innerHTML = '<p class="empty-state">Generating procedures...</p>';
    try {
        const data = await apiRequest(
            `${CONFIG.TRIAGE_API}/select-medications`,
            {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id:           STATE.sessionId,
                    selected:             [...STATE.selectedMedications],
                    manual_key_questions: getManualQuestionAnswers(),
                    manual_medications:   getManualEntries('manualMedList'),
                    manual_procedures:    getManualEntries('manualProcList'),
                })
            },
            'Triage API'
        );

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
    item.dataset.confirmed = 'false';
    item.style.cssText = `
        display: flex; flex-direction: column; gap: 6px;
        padding: 10px 12px; margin-bottom: 8px;
        border: 1.5px solid #e2e8f0; border-radius: 8px;
        background: #f8fafc;
    `;
    item.innerHTML = `
        <input type="text" placeholder="Question e.g. Fever duration?"
            data-type="question"
            style="padding:7px 10px; border:1px solid #cbd5e1;
                   border-radius:6px; font-size:13px; width:100%; box-sizing:border-box;"/>
        <input type="text" placeholder="Answer e.g. 3 days"
            data-type="answer"
            style="padding:7px 10px; border:1px solid #cbd5e1;
                   border-radius:6px; font-size:13px; width:100%; box-sizing:border-box;"/>
        <div style="display:flex; gap:8px; align-items:center; margin-top:2px;">
            <button
                onclick="confirmManualQA(this)"
                style="padding:5px 16px; background:#3b82f6; color:white;
                       border:none; border-radius:6px; font-size:12px;
                       cursor:pointer; font-weight:600;">
                ✓ Add Question
            </button>
            <button
                onclick="removeManualQAItem(this)"
                style="padding:5px 12px; background:#fee2e2; color:#dc2626;
                       border:none; border-radius:6px; font-size:12px; cursor:pointer;">
                × Remove
            </button>
            <span class="qa-confirmed-badge"
                style="display:none; color:#10b981; font-size:12px; font-weight:600;">
                ✓ Question Added
            </span>
        </div>
    `;
    document.getElementById('manualQAList').appendChild(item);
}

function confirmManualQA(btn) {
    const item = btn.closest('.manual-qa-item');
    const qInput = item.querySelector('[data-type="question"]');
    const aInput = item.querySelector('[data-type="answer"]');
    const q = qInput.value.trim();
    const a = aInput.value.trim();

    if (!q || !a) {
        alert('Please enter both a question and an answer before adding.');
        return;
    }

    // Lock inputs so they cannot be changed after confirm
    qInput.disabled = true;
    aInput.disabled = true;
    qInput.style.background = '#f1f5f9';
    aInput.style.background = '#f1f5f9';
    qInput.style.color = '#334155';
    aInput.style.color = '#334155';

    // Mark as confirmed
    item.dataset.confirmed = 'true';
    item.style.borderColor = '#10b981';
    item.style.background = '#f0fdf4';

    // Hide confirm button, show badge
    btn.style.display = 'none';
    item.querySelector('.qa-confirmed-badge').style.display = 'inline';
}

function removeManualQAItem(btn) {
    btn.closest('.manual-qa-item').remove();
}

function addManualEntry(containerId, placeholder) {
    const item = document.createElement('div');
    item.className = 'manual-entry-item';
    item.dataset.confirmed = 'false';
    item.style.cssText = `
        display: flex; align-items: center; gap: 8px;
        padding: 6px 8px; margin-bottom: 6px;
        border: 1.5px solid #e2e8f0; border-radius: 8px;
        background: #f8fafc;
    `;
    item.innerHTML = `
        <input type="text" placeholder="${placeholder}"
            style="flex:1; padding:7px 10px; border:1px solid #cbd5e1;
                   border-radius:6px; font-size:13px;"/>
        <button
            onclick="confirmManualEntry(this, '${containerId}')"
            style="padding:5px 14px; background:#3b82f6; color:white;
                   border:none; border-radius:6px; font-size:12px;
                   cursor:pointer; font-weight:600; white-space:nowrap;">
            ✓ Add
        </button>
        <button
            onclick="removeManualEntry(this, '${containerId}')"
            style="padding:5px 10px; background:#fee2e2; color:#dc2626;
                   border:none; border-radius:6px; font-size:12px;
                   cursor:pointer; font-weight:600;">
            ×
        </button>
        <span class="entry-confirmed-badge"
            style="display:none; color:#10b981; font-size:12px;
                   font-weight:600; white-space:nowrap;">
            ✓ Added
        </span>
    `;
    document.getElementById(containerId).appendChild(item);
}

function confirmManualEntry(btn, containerId) {
    const item = btn.closest('.manual-entry-item');
    const input = item.querySelector('input[type="text"]');
    const val = input.value.trim();

    if (!val) {
        alert('Please type a value before adding.');
        return;
    }

    // Lock input
    input.disabled = true;
    input.style.background = '#f1f5f9';
    input.style.color = '#334155';

    // Mark confirmed
    item.dataset.confirmed = 'true';
    item.style.borderColor = '#10b981';
    item.style.background = '#f0fdf4';

    // Hide confirm button, show badge
    btn.style.display = 'none';
    item.querySelector('.entry-confirmed-badge').style.display = 'inline';

    // Trigger downstream clear if needed
    handleManualEntryDownstream(containerId);
}

function getManualEntries(containerId) {
    return Array.from(
        document.querySelectorAll(`#${containerId} .manual-entry-item`)
    )
    .filter(item => item.dataset.confirmed === 'true')
    .map(item => item.querySelector('input[type="text"]')?.value?.trim())
    .filter(Boolean);
}

function getManualQuestionAnswers() {
    return Array.from(document.querySelectorAll('#manualQAList .manual-qa-item'))
        .filter(item => item.dataset.confirmed === 'true')
        .map(item => ({
            question: item.querySelector('[data-type="question"]')?.value?.trim() || '',
            answer:   item.querySelector('[data-type="answer"]')?.value?.trim()   || '',
        }))
        .filter(({ question, answer }) => question && answer);
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
        patient_id: getCurrentPatientId(),
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
        const res = await apiRequest(
            `${CONFIG.SUMMARY_API}/api/v1/generate-summary-stream`,
            {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            },
            'Summary API',
            { parseJson: false }
        );

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
    const manualQuestionAnswers = getManualQuestionAnswers();
    const allDx   = [...STATE.selectedDiagnoses,      ...getManualEntries('manualDiagList')];
    const allInv  = [...STATE.selectedInvestigations, ...getManualEntries('manualInvList')];
    const allMeds = [...STATE.selectedMedications,    ...getManualEntries('manualMedList')];
    const allProc = [...STATE.selectedProcedures,     ...getManualEntries('manualProcList')];
    const btn = document.querySelector('.btn-success');

    if (btn?.disabled) return;

    // Auto-derive slug from first chief complaint chip if slug not already set
        if (!STATE.currentComplaintSlug) {
        const autoChips = [...document.querySelectorAll("#chiefComplaintChips .chip")]
            .map(c => c.textContent.replace("×", "").trim())
            .filter(Boolean);

        if (autoChips.length > 0) {
            STATE.currentComplaintSlug = autoChips[0];
        }
        }

    if (!STATE.currentPatient) { alert('No patient selected.'); return; }
    if (!STATE.currentComplaintSlug) { alert('Please add a chief complaint first.'); return; }
    if (!chiefComplaints.length) { alert('Please add at least one chief complaint'); return; }

    const payload = {
        patient_id:              getCurrentPatientId(),
        complaint_chain:         STATE.currentComplaintSlug,
        visit_date:   new Date().toISOString().split('T')[0],  // back to "2026-04-08"
        visit_number: STATE.encounterHistory.length + 1,
        chief_complaints:        chiefComplaints,
        vitals: {
            height_cm:    parseFloat(document.getElementById('height').value)   || null,
            weight_kg:    parseFloat(document.getElementById('weight').value)   || null,
            head_circ_cm: parseFloat(document.getElementById('headCirc').value) || null,
            temp_celsius: parseFloat(document.getElementById('temp').value)     || null,
            bp_mmhg:      document.getElementById('bp').value || null,
        },
        key_questions: [
            ...STATE.questions.map(q => ({
                question: q.question || q,
                answer: q.answer || ''
            })),
            ...getManualQuestionAnswers().map(({ question, answer }) => ({ question, answer })),
        ],
        key_questions_ai_notes:  '',
        diagnoses:               allDx.map(d => ({ name: d, selected: true, is_custom: false })),
        diagnoses_ai_notes:      document.getElementById('diagnosisNotes').value || '',
        investigations:          allInv.map(i => ({ name: i, selected: true, is_custom: false })),
        investigations_ai_notes: document.getElementById('investigationsNotes').value || '',
        medications:             allMeds.map(m => ({ name: m, selected: true, is_custom: false })),
        medications_ai_notes:    document.getElementById('medicationsNotes').value || '',
        procedures:              allProc.map(p => ({ name: p, selected: true, is_custom: false })),
        procedures_ai_notes:     document.getElementById('proceduresNotes').value || '',
        advice:                  document.getElementById('adviceText').value || '',
        follow_up_date:          document.getElementById('followupDate').value || null,
        advice_ai_notes:         document.getElementById('adviceNotes').value || '',
    };

    try {
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
        addLog('info', 'Prescription payload', payload);
        let saved = null;
        let triageSaved = null;

        saved = await apiRequest(
            `${CONFIG.REDIS_API}/api/v1/consultation`,
            {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            },
            'Redis API'
        );

        try {
            triageSaved = await syncConsultationToTriage(payload);
            addLog('success', 'Triage consultation sync complete', {
                patient_id: payload.patient_id,
                complaint_chain: payload.complaint_chain,
                consultation_id: triageSaved?.consultation_id || saved?.consultation_id || null
            });
        } catch (triageError) {
            addLog('error', 'Triage consultation sync failed', {
                patient_id: payload.patient_id,
                complaint_chain: payload.complaint_chain,
                error: triageError.message || 'Unknown error'
            });
            alert(`Saved to Redis, but Triage sync failed: ${triageError.message}`);
        }

        const patientId = getCurrentPatientId();
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadPatientComplaints(patientId);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (STATE.currentComplaintSlug) {
            const refreshed = await apiRequest(
                `${CONFIG.REDIS_API}/api/v1/patient/${patientId}/complaint?complaint=${encodeURIComponent(STATE.currentComplaintSlug)}&limit=20`,
                { method: 'GET' },
                'Redis API'
            );
            STATE.encounterHistory = Array.isArray(refreshed) ? refreshed : [];
            STATE.encounterHistory.sort((a, b) => a.visit_number - b.visit_number);
        } else {
            STATE.encounterHistory = [];
        }

        renderEncounterTabs();

        addLog('success', 'Post-save refresh complete', {
            patient_id: patientId,
            complaint_chain: STATE.currentComplaintSlug,
            encounter_count: STATE.encounterHistory.length
        });

        if (btn) {
            btn.disabled = false;
            btn.textContent = triageSaved ? 'Prescription Issued ✓' : 'Saved to Redis ✓';
            btn.style.backgroundColor = '#10b981';
            btn.style.color = '#fff';
        }
        log('Saved', saved.consultation_id);
    } catch (e) {
        alert(e.message || 'Save failed');
        addLog('error', 'Prescription save/sync failed', {
            patient_id: getCurrentPatientId(),
            complaint_chain: STATE.currentComplaintSlug,
            error: e.message || 'Unknown error'
        });
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
        document.getElementById('complaintChainSection').style.display = 'none';
        const bar = document.getElementById('encounterTabBar');
        if (bar) bar.remove();
        const dropdownContainer = document.getElementById('complaintDropdownContainer');
        if (dropdownContainer) dropdownContainer.remove();
        window._complaintDropdownBound = false;
        resetEncounterState();
        localStorage.removeItem('selectedPatientId');
        STATE.currentPatient   = null;
        STATE.currentComplaint = null;
        STATE.currentComplaintSlug = null;
        if (typeof renderPatientList === 'function') {
            renderPatientList();
        }
    }
}

// ============================================================================
// LEGACY COMPATIBILITY — index.html calls these
// ============================================================================

function loadEncounter(patientKey, complaintKey, encounterNum) {
    openComplaintChain(patientKey, complaintKey, complaintKey);
}

function newEncounter(patientKey) { startNewComplaint(patientKey); }
function newComplaint(patientKey) { startNewComplaint(patientKey); }
function switchEncounter()        { /* replaced by tabs */ }
function clearForm()              { clearFormFields(); }

// ============================================================================
// INIT
// ============================================================================

log('Clinical UI v2.0 Initialized');      
