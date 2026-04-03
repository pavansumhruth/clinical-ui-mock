// // ============================================================================
// // INITIALIZATION & UTILITY FUNCTIONS
// // ============================================================================
//
// function generateSessionId() {
//     return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
// }
//
// function log(message, data) {
//     console.log(`[Clinical UI] ${message}`, data || '');
// }
//
// // ============================================================================
// // PATIENT & ENCOUNTER MANAGEMENT
// // ============================================================================
//
// function newEncounter(patientKey) {
//     const patient = CONFIG.PATIENTS[patientKey];
//     if (!patient) {
//         alert('Patient not found');
//         return;
//     }
//
//     STATE.currentPatient = patient;
//     STATE.currentComplaint = null;
//     STATE.sessionId = generateSessionId();
//     STATE.questions = [];
//     STATE.answers = [];
//     STATE.selectedDiagnoses = [];
//     STATE.selectedInvestigations = [];
//     STATE.selectedMedications = [];
//     STATE.selectedProcedures = [];
//
//     document.getElementById('currentPatientName').textContent = patient.name;
//     document.getElementById('currentComplaint').textContent = 'New Consultation';
//     document.getElementById('emptyState').style.display = 'none';
//     document.getElementById('consultationForm').style.display = 'block';
//     document.querySelector('.encounter-selector').style.display = 'none';
//
//     clearForm();
//     log('New encounter started', { patient: patient.name, sessionId: STATE.sessionId });
// }
//
// function loadEncounter(patientKey, complaintKey, encounterNum) {
//     const patient = CONFIG.PATIENTS[patientKey];
//     const complaint = patient.complaints[complaintKey];
//
//     if (!patient || !complaint) {
//         alert('Patient or complaint not found');
//         return;
//     }
//
//     STATE.currentPatient = patient;
//     STATE.currentComplaint = complaintKey;
//     STATE.sessionId = generateSessionId();
//
//     document.getElementById('currentPatientName').textContent = patient.name;
//     document.getElementById('currentComplaint').textContent = `${complaint.name} - ${complaint.date || 'Today'} - Encounter ${encounterNum} of ${complaint.visits}`;
//     document.getElementById('emptyState').style.display = 'none';
//     document.getElementById('consultationForm').style.display = 'block';
//
//     if (complaint.visits > 1) {
//         const selector = document.querySelector('.encounter-selector');
//         selector.style.display = 'flex';
//
//         const dropdown = document.getElementById('encounterDropdown');
//         dropdown.innerHTML = '';
//         for (let i = 1; i <= complaint.visits; i++) {
//             const option = document.createElement('option');
//             option.value = i;
//             option.textContent = `Encounter ${i}`;
//             if (i === encounterNum) option.selected = true;
//             dropdown.appendChild(option);
//         }
//     }
//
//     if (encounterNum === 1) {
//         document.getElementById('chiefComplaintInput').value = complaint.name;
//         addChiefComplaint();
//     }
//
//     log('Loaded encounter', { patient: patient.name, complaint: complaint.name, encounter: encounterNum });
// }
//
// function switchEncounter() {
//     const encounterNum = parseInt(document.getElementById('encounterDropdown').value);
//     loadEncounter(STATE.currentPatient.id, STATE.currentComplaint, encounterNum);
// }
//
// function clearForm() {
//     document.getElementById('chiefComplaintChips').innerHTML = '';
//     document.getElementById('chiefComplaintInput').value = '';
//     document.getElementById('height').value = '';
//     document.getElementById('weight').value = '';
//     document.getElementById('headCirc').value = '';
//     document.getElementById('temp').value = '';
//     document.getElementById('bp').value = '';
//     document.getElementById('questionsContainer').innerHTML = '';
//     document.getElementById('diagnosisContainer').innerHTML = '<p class="empty-state">Answer questions to generate diagnoses</p>';
//     document.getElementById('investigationsContainer').innerHTML = '<p class="empty-state">Select diagnoses first</p>';
//     document.getElementById('medicationsContainer').innerHTML = '<p class="empty-state">Select investigations first</p>';
//     document.getElementById('proceduresContainer').innerHTML = '<p class="empty-state">Select medications first</p>';
//     document.getElementById('diagnosisNotes').value = '';
//     document.getElementById('investigationsNotes').value = '';
//     document.getElementById('medicationsNotes').value = '';
//     document.getElementById('proceduresNotes').value = '';
//     document.getElementById('adviceText').value = '';
//     document.getElementById('adviceNotes').value = '';
//     document.getElementById('manualQAList').innerHTML = '';
//     document.getElementById('manualDiagList').innerHTML = '';
//     document.getElementById('manualInvList').innerHTML = '';
//     document.getElementById('manualMedList').innerHTML = '';
//     document.getElementById('manualProcList').innerHTML = '';
// }
//
// // ============================================================================
// // CHIEF COMPLAINT
// // ============================================================================
//
// function addChiefComplaint() {
//     const input = document.getElementById('chiefComplaintInput');
//     const complaint = input.value.trim();
//
//     if (!complaint) return;
//
//     const container = document.getElementById('chiefComplaintChips');
//     const chip = document.createElement('div');
//     chip.className = 'chip';
//     chip.innerHTML = `
//         ${complaint}
//         <span class="chip-remove" onclick="removeChip(this)">×</span>
//     `;
//     container.appendChild(chip);
//     input.value = '';
//
//     log('Added chief complaint', complaint);
// }
//
// function removeChip(element) {
//     element.parentElement.remove();
// }
//
// document.addEventListener('DOMContentLoaded', () => {
//     const input = document.getElementById('chiefComplaintInput');
//     if (input) {
//         input.addEventListener('keypress', (e) => {
//             if (e.key === 'Enter') {
//                 addChiefComplaint();
//             }
//         });
//     }
// });
//
// // ============================================================================
// // QUESTIONS GENERATION
// // ============================================================================
//
// async function generateQuestions() {
//     const btn = document.getElementById('generateQuestionsBtn');
//     btn.disabled = true;
//     btn.textContent = 'Generating...';
//
//     const chips = document.querySelectorAll('#chiefComplaintChips .chip');
//     const complaints = Array.from(chips).map(chip => chip.textContent.replace('×', '').trim());
//
//     const vitals = {
//         height: document.getElementById('height').value,
//         weight: document.getElementById('weight').value,
//         temp: document.getElementById('temp').value,
//         bp: document.getElementById('bp').value
//     };
//
//     const complaint = complaints.join(', ') || 'General consultation';
//     const vitalsStr = `BP ${vitals.bp || 'N/A'}, Temp ${vitals.temp || 'N/A'}°C`;
//
//     try {
//         const response = await fetch(`${CONFIG.TRIAGE_API}/start`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 chief_complaint: complaint,
//                 clinical_history: vitalsStr
//             })
//         });
//
//         if (!response.ok) throw new Error('Failed to start session');
//
//         const data = await response.json();
//         STATE.sessionId = data.session_id;
//         STATE.questions.push(data.question);
//
//         renderQuestion(data.question, data.options, 0);
//
//         btn.textContent = 'Questions Generated';
//         setTimeout(() => {
//             btn.style.display = 'none';
//         }, 1000);
//
//         log('Generated first question', data);
//
//     } catch (error) {
//         console.error('Error generating questions:', error);
//         alert('Failed to generate questions. Check if port 9000 is running.');
//         btn.disabled = false;
//         btn.textContent = 'Generate Questions';
//     }
// }
//
// function renderQuestion(question, options, index) {
//     const container = document.getElementById('questionsContainer');
//
//     const questionDiv = document.createElement('div');
//     questionDiv.className = 'question-item';
//     questionDiv.id = `question-${index}`;
//
//     const questionText = document.createElement('div');
//     questionText.className = 'question-text';
//     questionText.textContent = `Q${index + 1}: ${question}`;
//
//     const optionsContainer = document.createElement('div');
//     optionsContainer.className = 'options-container';
//
//     options.forEach(option => {
//         const btn = document.createElement('button');
//         btn.className = 'option-btn';
//         btn.textContent = option;
//         btn.onclick = () => selectOption(index, option, btn);
//         optionsContainer.appendChild(btn);
//     });
//
//     questionDiv.appendChild(questionText);
//     questionDiv.appendChild(optionsContainer);
//     container.appendChild(questionDiv);
// }
//
// async function selectOption(questionIndex, answer, btnElement) {
//     const allBtns = btnElement.parentElement.querySelectorAll(".option-btn");
//     allBtns.forEach(b => b.classList.remove("selected"));
//     btnElement.classList.add("selected");
//
//     STATE.answers[questionIndex] = answer;
//
//     log(`Answered Q${questionIndex + 1}`, answer);
//
//     const questionDiv = document.getElementById(`question-${questionIndex}`);
//     const optionsContainer = questionDiv.querySelector(".options-container");
//     optionsContainer.innerHTML = `<div style="color: #10b981; font-weight: 500;">✓ Answer: ${answer}</div>`;
//
//     await getNextQuestion();
// }
//
// async function getNextQuestion() {
//     try {
//         const response = await fetch(`${CONFIG.TRIAGE_API}/answer`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 session_id: STATE.sessionId,
//                 selected_option: STATE.answers[STATE.answers.length - 1]
//             })
//         });
//
//         if (!response.ok) throw new Error('Failed to get next question');
//
//         const data = await response.json();
//         STATE.sessionId = data.session_id;
//
//         if (data.completed && data.considerations) {
//             const container = document.getElementById('diagnosisContainer');
//             container.innerHTML = '';
//             data.considerations.forEach(diag => {
//                 const item = document.createElement('div');
//                 item.className = 'checkbox-item';
//                 item.innerHTML = `
//                     <input type="checkbox" id="diag-${diag.name}" onchange="toggleDiagnosis('${diag.name}')">
//                     <div class="checkbox-content">
//                         <div class="checkbox-label">${diag.name}</div>
//                     </div>
//                 `;
//                 container.appendChild(item);
//             });
//             log('Diagnoses generated', data.considerations);
//             return;
//         }
//
//         if (data.question) {
//             STATE.questions.push(data.question);
//             renderQuestion(data.question, data.options, STATE.questions.length - 1);
//         }
//
//     } catch (error) {
//         console.error('Error getting next question:', error);
//     }
// }
//
// // ============================================================================
// // DIAGNOSIS
// // ============================================================================
//
// function toggleDiagnosis(diagnosis) {
//     const index = STATE.selectedDiagnoses.indexOf(diagnosis);
//     if (index > -1) {
//         STATE.selectedDiagnoses.splice(index, 1);
//     } else {
//         STATE.selectedDiagnoses.push(diagnosis);
//     }
//
//     log('Diagnosis toggled', { diagnosis, selected: STATE.selectedDiagnoses });
//     updateDiagnosisButton();
// }
//
// function updateDiagnosisButton() { return; // Disabled - save button controls Next {
//     const btn = document.getElementById('btnNextInv');
//     if (btn) {
//         btn.style.display = STATE.selectedDiagnoses.length > 0 ? 'block' : 'none';
//     }
// }
//
// // ============================================================================
// // INVESTIGATIONS, MEDICATIONS, PROCEDURES
// // ============================================================================
//
// // async function generateInvestigations() {
// //     const container = document.getElementById('investigationsContainer');
// //     container.innerHTML = '<p class="empty-state">Generating investigations...</p>';
// //
// //     try {
// //         const response = await fetch(`${CONFIG.TRIAGE_API}/select-diagnoses`, {
// //             method: 'POST',
// //             headers: { 'Content-Type': 'application/json' },
// //             body: JSON.stringify({
// //                 session_id: STATE.sessionId,
// //                 selected: [...STATE.selectedDiagnoses]
// //             })
// //         });
// //
// //         if (!response.ok) throw new Error('Failed to generate investigations');
// //
// //         const data = await response.json();
// //
// //         if (data.investigations && data.investigations.length > 0) {
// //             container.innerHTML = '';
// //             data.investigations.forEach(inv => {
// //                 const item = document.createElement('div');
// //                 item.className = 'checkbox-item';
// //                 item.innerHTML = `
// //                     <input type="checkbox" id="inv-${inv.name}" onchange="toggleInvestigation('${inv.name}')">
// //                     <div class="checkbox-content">
// //                         <div class="checkbox-label">${inv.name}</div>
// //                     </div>
// //                 `;
// //                 container.appendChild(item);
// //             });
// //         }
// //
// //     } catch (error) {
// //         console.error('Error generating investigations:', error);
// //         document.getElementById("btnNextInv").textContent = "Next: Investigations →";
// //         document.getElementById('btnNextInv').textContent = 'Investigations Generated ✓';
// //         document.getElementById('btnNextInv').disabled = false;
// //         container.innerHTML = '<p class="empty-state">Failed to generate investigations</p>';
// //     }
// // }
// async function generateInvestigations() {
//     const container = document.getElementById('investigationsContainer');
//     container.innerHTML = '<p class="empty-state">Generating investigations...</p>';
//
//     try {
//         const response = await fetch(`${CONFIG.TRIAGE_API}/select-diagnoses`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 session_id: STATE.sessionId,
//                 selected: [...STATE.selectedDiagnoses]
//             })
//         });
//
//         if (!response.ok) throw new Error('Failed to generate investigations');
//
//         const data = await response.json();
//
//         if (data.investigations && data.investigations.length > 0) {
//             container.innerHTML = '';
//             data.investigations.forEach(inv => {
//                 const item = document.createElement('div');
//                 item.className = 'checkbox-item';
//                 item.innerHTML = `
//                     <input type="checkbox" id="inv-${inv.name}" onchange="toggleInvestigation('${inv.name}')">
//                     <div class="checkbox-content">
//                         <div class="checkbox-label">${inv.name}</div>
//                     </div>
//                 `;
//                 container.appendChild(item);
//             });
//         }
//
//         // SUCCESS: Change button to Generated
//         const btn = document.getElementById('btnNextInv');
//         if (btn) {
//             btn.textContent = 'Investigations Generated ✓';
//             btn.disabled = true; // Prevents clicking it again
//             btn.style.backgroundColor = '#10b981'; // Optional: makes it green
//             btn.style.color = '#fff';
//         }
//
//     } catch (error) {
//         console.error('Error generating investigations:', error);
//         // ERROR: Revert button so user can try again
//         const btn = document.getElementById('btnNextInv');
//         if (btn) {
//             btn.textContent = 'Next: Investigations →';
//             btn.disabled = false;
//         }
//         container.innerHTML = '<p class="empty-state">Failed to generate investigations</p>';
//     }
// }
// function toggleInvestigation(investigation) {
//     const index = STATE.selectedInvestigations.indexOf(investigation);
//     if (index > -1) {
//         STATE.selectedInvestigations.splice(index, 1);
//     } else {
//         STATE.selectedInvestigations.push(investigation);
//     }
//
//     log('Investigation toggled', { investigation, selected: STATE.selectedInvestigations });
//     updateInvestigationsButton();
// }
//
// function updateInvestigationsButton() { return; // Disabled {
//     const btn = document.getElementById('btnNextMed');
//     if (btn) {
//         btn.style.display = STATE.selectedInvestigations.length > 0 ? 'block' : 'none';
//     }
// }
//
// // async function generateMedications() {
// //     const container = document.getElementById('medicationsContainer');
// //     container.innerHTML = '<p class="empty-state">Generating medications...</p>';
// //
// //     try {
// //         const response = await fetch(`${CONFIG.TRIAGE_API}/select-investigations`, {
// //             method: 'POST',
// //             headers: { 'Content-Type': 'application/json' },
// //             body: JSON.stringify({
// //                 session_id: STATE.sessionId,
// //                 selected: [...STATE.selectedInvestigations]
// //             })
// //         });
// //
// //         if (!response.ok) throw new Error('Failed to generate medications');
// //
// //         const data = await response.json();
// //
// //         if (data.medications && data.medications.length > 0) {
// //             container.innerHTML = '';
// //             data.medications.forEach(med => {
// //                 const item = document.createElement('div');
// //                 item.className = 'checkbox-item';
// //                 item.innerHTML = `
// //                     <input type="checkbox" id="med-${med.name}" onchange="toggleMedication('${med.name}')">
// //                     <div class="checkbox-content">
// //                         <div class="checkbox-label">${med.name}</div>
// //                     </div>
// //                 `;
// //                 container.appendChild(item);
// //             });
// //         }
// //
// //     } catch (error) {
// //         console.error('Error generating medications:', error);
// //         document.getElementById("btnNextMed").textContent = "Next: Medications →";
// //         document.getElementById("btnNextMed").disabled = false;
// //         container.innerHTML = '<p class="empty-state">Failed to generate medications</p>';
// //     }
// // }
// async function generateMedications() {
//     const container = document.getElementById('medicationsContainer');
//     container.innerHTML = '<p class="empty-state">Generating medications...</p>';
//
//     try {
//         const response = await fetch(`${CONFIG.TRIAGE_API}/select-investigations`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 session_id: STATE.sessionId,
//                 selected: [...STATE.selectedInvestigations]
//             })
//         });
//
//         if (!response.ok) throw new Error('Failed to generate medications');
//
//         const data = await response.json();
//
//         if (data.medications && data.medications.length > 0) {
//             container.innerHTML = '';
//             data.medications.forEach(med => {
//                 const item = document.createElement('div');
//                 item.className = 'checkbox-item';
//                 item.innerHTML = `
//                     <input type="checkbox" id="med-${med.name}" onchange="toggleMedication('${med.name}')">
//                     <div class="checkbox-content">
//                         <div class="checkbox-label">${med.name}</div>
//                     </div>
//                 `;
//                 container.appendChild(item);
//             });
//         }
//
//         // SUCCESS: Change button to Generated
//         const btn = document.getElementById('btnNextMed');
//         if (btn) {
//             btn.textContent = 'Medications Generated ✓';
//             btn.disabled = true;
//             btn.style.backgroundColor = '#10b981'; // Optional: makes it green
//             btn.style.color = '#fff';
//         }
//
//     } catch (error) {
//         console.error('Error generating medications:', error);
//         // ERROR: Revert button so user can try again
//         const btn = document.getElementById('btnNextMed');
//         if (btn) {
//             btn.textContent = 'Next: Medications →';
//             btn.disabled = false;
//         }
//         container.innerHTML = '<p class="empty-state">Failed to generate medications</p>';
//     }
// }
//
// function toggleMedication(medication) {
//     const index = STATE.selectedMedications.indexOf(medication);
//     if (index > -1) {
//         STATE.selectedMedications.splice(index, 1);
//     } else {
//         STATE.selectedMedications.push(medication);
//     }
//
//     log('Medication toggled', { medication, selected: STATE.selectedMedications });
//     updateMedicationsButton();
// }
//
// function updateMedicationsButton() { return; // Disabled {
//     const btn = document.getElementById('btnNextProc');
//     if (btn) {
//         btn.style.display = STATE.selectedMedications.length > 0 ? 'block' : 'none';
//     }
// }
//
// // async function generateProcedures() {
// //     const container = document.getElementById('proceduresContainer');
// //     container.innerHTML = '<p class="empty-state">Generating procedures...</p>';
// //
// //     try {
// //         const response = await fetch(`${CONFIG.TRIAGE_API}/select-medications`, {
// //             method: 'POST',
// //             headers: { 'Content-Type': 'application/json' },
// //             body: JSON.stringify({
// //                 session_id: STATE.sessionId,
// //                 selected: [...STATE.selectedMedications]
// //             })
// //         });
// //
// //         if (!response.ok) throw new Error('Failed to generate procedures');
// //
// //         const data = await response.json();
// //
// //         if (data.procedures && data.procedures.length > 0) {
// //             container.innerHTML = '';
// //             data.procedures.forEach(proc => {
// //                 const item = document.createElement('div');
// //                 item.className = 'checkbox-item';
// //                 item.innerHTML = `
// //                     <input type="checkbox" id="proc-${proc.name}">
// //                     <div class="checkbox-content">
// //                         <div class="checkbox-label">${proc.name}</div>
// //                     </div>
// //                 `;
// //                 container.appendChild(item);
// //             });
// //         }
// //
// //     } catch (error) {
// //         console.error('Error generating procedures:', error);
// //         document.getElementById("btnNextProc").textContent = "Next: Procedures →";
// //         document.getElementById("btnNextProc").disabled = false;
// //         container.innerHTML = '<p class="empty-state">Failed to generate procedures</p>';
// //     }
// // }
//
// async function generateProcedures() {
//     const container = document.getElementById('proceduresContainer');
//     container.innerHTML = '<p class="empty-state">Generating procedures...</p>';
//
//     try {
//         const response = await fetch(`${CONFIG.TRIAGE_API}/select-medications`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 session_id: STATE.sessionId,
//                 selected: [...STATE.selectedMedications]
//             })
//         });
//
//         if (!response.ok) throw new Error('Failed to generate procedures');
//
//         const data = await response.json();
//
//         if (data.procedures && data.procedures.length > 0) {
//             container.innerHTML = '';
//             data.procedures.forEach(proc => {
//                 const item = document.createElement('div');
//                 item.className = 'checkbox-item';
//                 item.innerHTML = `
//                     <input type="checkbox" id="proc-${proc.name}">
//                     <div class="checkbox-content">
//                         <div class="checkbox-label">${proc.name}</div>
//                     </div>
//                 `;
//                 container.appendChild(item);
//             });
//         }
//
//         // SUCCESS: Change button to Generated
//         const btn = document.getElementById('btnNextProc');
//         if (btn) {
//             btn.textContent = 'Procedures Generated ✓';
//             btn.disabled = true;
//             btn.style.backgroundColor = '#10b981'; // Optional: makes it green
//             btn.style.color = '#fff';
//         }
//
//     } catch (error) {
//         console.error('Error generating procedures:', error);
//         // ERROR: Revert button so user can try again
//         const btn = document.getElementById('btnNextProc');
//         if (btn) {
//             btn.textContent = 'Next: Procedures →';
//             btn.disabled = false;
//         }
//         container.innerHTML = '<p class="empty-state">Failed to generate procedures</p>';
//     }
// }
//
// // ============================================================================
// // NAVIGATION FUNCTIONS
// // ============================================================================
//
// function proceedToInvestigations() {
//     if (STATE.selectedDiagnoses.length === 0) {
//         alert('Please select at least one diagnosis');
//         return;
//     }
//     document.getElementById('btnNextInv').disabled = true;
//     document.getElementById('btnNextInv').textContent = 'Loading...';
//     generateInvestigations();
// }
//
// function proceedToMedications() {
//     if (STATE.selectedInvestigations.length === 0) {
//         alert('Please select at least one investigation');
//         return;
//     }
//     document.getElementById('btnNextMed').disabled = true;
//     document.getElementById('btnNextMed').textContent = 'Loading...';
//     generateMedications();
// }
//
// function proceedToProcedures() {
//     if (STATE.selectedMedications.length === 0) {
//         alert('Please select at least one medication');
//         return;
//     }
//     document.getElementById('btnNextProc').disabled = true;
//     document.getElementById('btnNextProc').textContent = 'Loading...';
//     generateProcedures();
// }
//
// // ============================================================================
// // SAVE FUNCTIONS
// // ============================================================================
//
// function hideUnselected(containerId, selectedArray) {
//     const container = document.getElementById(containerId);
//     const checkboxes = container.querySelectorAll('.checkbox-item');
//
//     checkboxes.forEach(item => {
//         const checkbox = item.querySelector('input[type="checkbox"]');
//         if (!checkbox.checked) {
//             item.classList.add('removing');
//             setTimeout(() => item.remove(), 300);
//         }
//     });
// }
//
//
//
//
// // ============================================================================
// // MANUAL ENTRY FUNCTIONS
// // ============================================================================
//
// function addManualQA() {
//     const container = document.getElementById('manualQAList');
//     const idx = container.children.length;
//
//     const item = document.createElement('div');
//     item.className = 'manual-qa-item';
//     item.innerHTML = `
//         <input type="text" placeholder="Enter your question..." data-idx="${idx}" data-type="question"/>
//         <input type="text" placeholder="Enter the answer..." data-idx="${idx}" data-type="answer"/>
//     `;
//     container.appendChild(item);
// }
//
// function getManualQAs() {
//     const questions = [];
//     const items = document.querySelectorAll('#manualQAList .manual-qa-item');
//     items.forEach(item => {
//         const q = item.querySelector('[data-type="question"]').value.trim();
//         const a = item.querySelector('[data-type="answer"]').value.trim();
//         if (q && a) {
//             questions.push({question: q, answer: a});
//         }
//     });
//     return questions;
// }
//
// function addManualEntry(containerId, placeholder) {
//     const container = document.getElementById(containerId);
//     const idx = container.children.length;
//
//     const item = document.createElement('div');
//     item.className = 'manual-entry-item';
//     item.innerHTML = `
//         <input type="text" placeholder="${placeholder}" data-idx="${idx}"/>
//         <button class="btn-remove" onclick="removeManualEntry('${containerId}', ${idx})">×</button>
//     `;
//     container.appendChild(item);
// }
//
// function removeManualEntry(containerId, idx) {
//     const container = document.getElementById(containerId);
//     const items = container.querySelectorAll('.manual-entry-item');
//     if (items[idx]) items[idx].remove();
// }
//
// function getManualEntries(containerId) {
//     const entries = [];
//     const inputs = document.querySelectorAll(`#${containerId} input`);
//     inputs.forEach(input => {
//         const val = input.value.trim();
//         if (val) entries.push(val);
//     });
//     return entries;
// }
//
// function addManualDiagnosis() {
//     addManualEntry('manualDiagList', 'Enter diagnosis...');
// }
//
// function addManualInvestigation() {
//     addManualEntry('manualInvList', 'Enter investigation...');
// }
//
// function addManualMedication() {
//     addManualEntry('manualMedList', 'Enter medication...');
// }
//
// function addManualProcedure() {
//     addManualEntry('manualProcList', 'Enter procedure...');
// }
//
// // ============================================================================
// // AI NOTES GENERATION
// // ============================================================================
//
// async function generateNotes(section) {
//     const textarea = document.getElementById(`${section}Notes`);
//     textarea.value = 'Streaming...';
//
//     const chips = document.querySelectorAll('#chiefComplaintChips .chip');
//     const complaints = Array.from(chips).map(chip => chip.textContent.replace('×', '').trim());
//
//     const manualQAs = getManualQAs();
//     const allQAs = STATE.questions.map((q, i) => ({
//         question: q,
//         answer: STATE.answers[i] || ''
//     })).concat(manualQAs);
//
//     const context = {
//         chief_complaint: complaints.join(', '),
//         vitals: document.getElementById('bp').value,
//         questions: allQAs
//     };
//
//     if (section === 'diagnosis' || section === 'investigations' || section === 'medications' || section === 'procedures') {
//         context.diagnoses = [...STATE.selectedDiagnoses, ...getManualEntries('manualDiagList')];
//     }
//
//     if (section === 'investigations' || section === 'medications' || section === 'procedures') {
//         context.investigations = [...STATE.selectedInvestigations, ...getManualEntries('manualInvList')];
//     }
//
//     if (section === 'medications' || section === 'procedures') {
//         context.medications = [...STATE.selectedMedications, ...getManualEntries('manualMedList')];
//     }
//
//     if (section === 'procedures') {
//         context.procedures = [...STATE.selectedProcedures, ...getManualEntries('manualProcList')];
//     }
//
//     const payload = {
//         patient_id: STATE.currentPatient.id,
//         context: context,
//         section: section,
//         debug: false
//     };
//
//     try {
//         const response = await fetch(`${CONFIG.SUMMARY_API}/api/v1/generate-summary-stream`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });
//
//         if (!response.ok) throw new Error('Failed to generate notes');
//
//         const reader = response.body.getReader();
//         const decoder = new TextDecoder();
//         let buffer = '';
//         textarea.value = '';
//
//         while (true) {
//             const { done, value } = await reader.read();
//             if (done) break;
//
//             buffer += decoder.decode(value, { stream: true });
//             const lines = buffer.split('\n');
//             buffer = lines.pop() || '';
//
//             for (const line of lines) {
//                 if (line.startsWith('data: ')) {
//                     try {
//                         const data = JSON.parse(line.slice(6));
//
//                         if (data.token) {
//                             textarea.value += data.token;
//                             textarea.scrollTop = textarea.scrollHeight;
//                         }
//
//                         if (data.done) {
//                             log(`Notes generated for ${section}`, { chars: textarea.value.length });
//                         }
//                     } catch (e) {
//                         console.warn('Failed to parse SSE line:', line);
//                     }
//                 }
//             }
//         }
//
//     } catch (error) {
//         console.error('Error generating notes:', error);
//         textarea.value = 'Failed to generate notes. Check if port 8004 is running.';
//     }
// }
//
// // ============================================================================
// // FORM ACTIONS
// // ============================================================================
//
// async function saveDraft() {
//     await saveConsultationToAPI();
//     alert('Draft saved! (This is a demo - no actual save)');
//     log('Draft saved', STATE);
// }
//
// function issuePrescription() {
//     alert('Prescription issued! (This is a demo)');
//     log('Prescription issued', STATE);
// }
//
// function cancel() {
//     if (confirm('Cancel consultation? Unsaved changes will be lost.')) {
//         document.getElementById('emptyState').style.display = 'flex';
//         document.getElementById('consultationForm').style.display = 'none';
//         STATE.currentPatient = null;
//     }
// }
//
// // ============================================================================
// // INITIALIZATION
// // ============================================================================
//
// log('Clinical UI Initialized', { config: CONFIG });
//
// function saveProcedures() {
//     hideUnselected('proceduresContainer', STATE.selectedProcedures);
//     alert(`Saved ${STATE.selectedProcedures.length} procedures`);
//     log('Procedures saved', STATE.selectedProcedures);
// }
//
// // Modified save functions that enable "Next" buttons
//
//
//
// // ============================================================================
// // SAVE CONSULTATION TO VIKAS API
// // ============================================================================
//
// async function saveConsultationToAPI() {
//     if (!STATE.currentPatient) {
//         alert('No patient loaded');
//         return;
//     }
//
//     const chips = document.querySelectorAll('#chiefComplaintChips .chip');
//     const complaints = Array.from(chips).map(chip => chip.textContent.replace('×', '').trim());
//
//     const manualQAs = getManualQAs();
//     const allQAs = STATE.questions.map((q, i) => ({
//         question: q,
//         answer: STATE.answers[i] || ''
//     })).concat(manualQAs);
//
//     const payload = {
//         patient_id: STATE.currentPatient.id,
//         doctor_id: "dr_demo_001",
//         visit_date: new Date().toISOString().split('T')[0],
//         chief_complaints: complaints,
//         vitals: {
//             height_cm: parseFloat(document.getElementById('height').value) || 0,
//             weight_kg: parseFloat(document.getElementById('weight').value) || 0,
//             head_circ_cm: parseFloat(document.getElementById('headCirc').value) || 0,
//             temp_celsius: parseFloat(document.getElementById('temp').value) || 0,
//             bp_mmhg: document.getElementById('bp').value || ''
//         },
//         key_questions: allQAs,
//         key_questions_ai_notes: "",
//         diagnoses: [...STATE.selectedDiagnoses, ...getManualEntries('manualDiagList')],
//         diagnoses_ai_notes: document.getElementById('diagnosisNotes').value,
//         investigations: [...STATE.selectedInvestigations, ...getManualEntries('manualInvList')],
//         investigations_ai_notes: document.getElementById('investigationsNotes').value,
//         medications: [...STATE.selectedMedications, ...getManualEntries('manualMedList')],
//         medications_ai_notes: document.getElementById('medicationsNotes').value,
//         procedures: [...STATE.selectedProcedures, ...getManualEntries('manualProcList')],
//         procedures_ai_notes: document.getElementById('proceduresNotes').value,
//         advice: document.getElementById('adviceText').value,
//         follow_up_date: document.getElementById('followupDate').value || '',
//         advice_ai_notes: document.getElementById('adviceNotes').value
//     };
//
//     console.log('Sending to Vikas API:', payload);
//
//     try {
//         const response = await fetch(`${CONFIG.VIKAS_API}/api/v1/consultation`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });
//
//         if (!response.ok) {
//             const error = await response.json();
//             throw new Error(error.detail || 'Save failed');
//         }
//
//         const data = await response.json();
//         alert(`✓ Consultation saved!\nID: ${data.consultation_id}\nVisit #${data.visit_number}`);
//         log('Consultation saved', data);
//         return true;
//
//     } catch (error) {
//         console.error('Error saving:', error);
//         alert('✗ Save failed: ' + error.message);
//         return false;
//     }
// }
//
// // ============================================================================
// // HISTORICAL ENCOUNTER LOADING
// // ============================================================================
//
// function loadHistoricalEncounter(patientKey, complaintKey, encounterNum) {
//     const patient = CONFIG.PATIENTS[patientKey];
//     const complaint = patient.complaints[complaintKey];
//     const encounter = complaint.encounters[encounterNum - 1]; // Array is 0-indexed
//
//     if (!encounter) {
//         alert('Encounter not found');
//         return;
//     }
//
//     STATE.currentPatient = patient;
//     STATE.currentComplaint = complaintKey;
//     STATE.currentEncounterNum = encounterNum;
//
//     document.getElementById('currentPatientName').textContent = patient.name;
//     document.getElementById('currentComplaint').textContent = `${complaint.name} - ${encounter.date} - Encounter ${encounterNum} of ${complaint.visits}`;
//     document.getElementById('emptyState').style.display = 'none';
//     document.getElementById('consultationForm').style.display = 'block';
//
//     // Show encounter selector
//     if (complaint.visits > 1) {
//         const selector = document.querySelector('.encounter-selector');
//         selector.style.display = 'flex';
//         const dropdown = document.getElementById('encounterDropdown');
//         dropdown.innerHTML = '';
//         for (let i = 1; i <= complaint.visits; i++) {
//             const option = document.createElement('option');
//             option.value = i;
//             option.textContent = `Encounter ${i} - ${complaint.encounters[i-1].date}`;
//             if (i === encounterNum) option.selected = true;
//             dropdown.appendChild(option);
//         }
//     }
//
//     // If this is a completed historical encounter (not the latest new one)
//     if (encounter.type !== 'new') {
//         fillHistoricalData(encounter);
//         disableEditing();
//     } else {
//         // New/current encounter - editable
//         clearForm();
//         if (encounter.chief_complaint) {
//             document.getElementById('chiefComplaintInput').value = encounter.chief_complaint;
//             addChiefComplaint();
//         }
//     }
//
//     log('Loaded encounter', { patient: patient.name, date: encounter.date, type: encounter.type });
// }
//
// function fillHistoricalData(encounter) {
//     // Fill chief complaint
//     if (encounter.chief_complaint) {
//         document.getElementById('chiefComplaintInput').value = encounter.chief_complaint;
//         addChiefComplaint();
//     }
//
//     // Fill vitals
//     if (encounter.vitals.bp) document.getElementById('bp').value = encounter.vitals.bp;
//     if (encounter.vitals.temp) document.getElementById('temp').value = encounter.vitals.temp;
//
//     // Fill questions
//     if (encounter.questions && encounter.questions.length > 0) {
//         const qContainer = document.getElementById('questionsContainer');
//         qContainer.innerHTML = '';
//         encounter.questions.forEach((qa, idx) => {
//             const div = document.createElement('div');
//             div.className = 'question-item';
//             div.innerHTML = `
//                 <div class="question-text">Q${idx + 1}: ${qa.question}</div>
//                 <div style="color: #10b981; font-weight: 500; margin-top: 8px;">✓ Answer: ${qa.answer}</div>
//             `;
//             qContainer.appendChild(div);
//         });
//     }
//
//     // Fill diagnoses
//     const diagContainer = document.getElementById('diagnosisContainer');
//     diagContainer.innerHTML = '';
//     encounter.diagnoses.forEach(diag => {
//         const item = document.createElement('div');
//         item.className = 'checkbox-item';
//         item.innerHTML = `
//             <input type="checkbox" checked disabled>
//             <div class="checkbox-content">
//                 <div class="checkbox-label">${diag}</div>
//             </div>
//         `;
//         diagContainer.appendChild(item);
//     });
//
//     // Fill investigations
//     const invContainer = document.getElementById('investigationsContainer');
//     invContainer.innerHTML = '';
//     encounter.investigations.forEach(inv => {
//         const item = document.createElement('div');
//         item.className = 'checkbox-item';
//         item.innerHTML = `
//             <input type="checkbox" checked disabled>
//             <div class="checkbox-content">
//                 <div class="checkbox-label">${inv}</div>
//             </div>
//         `;
//         invContainer.appendChild(item);
//     });
//
//     // Fill medications
//     const medContainer = document.getElementById('medicationsContainer');
//     medContainer.innerHTML = '';
//     encounter.medications.forEach(med => {
//         const item = document.createElement('div');
//         item.className = 'checkbox-item';
//         item.innerHTML = `
//             <input type="checkbox" checked disabled>
//             <div class="checkbox-content">
//                 <div class="checkbox-label">${med}</div>
//             </div>
//         `;
//         medContainer.appendChild(item);
//     });
//
//     // Fill notes
//     document.getElementById('diagnosisNotes').value = encounter.diagnosis_notes || '';
//     document.getElementById('investigationsNotes').value = encounter.investigations_notes || '';
//     document.getElementById('medicationsNotes').value = encounter.medications_notes || '';
//     document.getElementById('proceduresNotes').value = encounter.procedures_notes || '';
//     document.getElementById('adviceNotes').value = encounter.advice_notes || '';
// }
//
// function disableEditing() {
//     // Disable all inputs and buttons for historical encounters
//     document.querySelectorAll('input, textarea, button, select').forEach(el => {
//         if (el.id !== 'encounterDropdown') {
//             el.disabled = true;
//         }
//     });
//
//     // Hide action buttons
//     document.querySelectorAll('.btn-primary, .btn-secondary, .btn-success, .btn-ai').forEach(btn => {
//         if (btn.id !== 'encounterDropdown') {
//             btn.style.display = 'none';
//         }
//     });
// }
//
// function switchEncounter() {
//     const encounterNum = parseInt(document.getElementById('encounterDropdown').value);
//     loadHistoricalEncounter(
//         Object.keys(CONFIG.PATIENTS).find(key => CONFIG.PATIENTS[key].id === STATE.currentPatient.id),
//         STATE.currentComplaint,
//         encounterNum
//     );
// }

// ============================================================================
// INITIALIZATION & UTILITY
// ============================================================================

function log(message, data) {
    console.log(`[Clinical UI] ${message}`, data || '');
}

const STATE = {
    currentPatient: null,
    currentComplaint: null,
    currentEncounterNum: 1,
    sessionId: null,
    questions: [],
    answers: [],
    selectedDiagnoses: [],
    selectedInvestigations: [],
    selectedMedications: [],
    selectedProcedures: []
};

// ============================================================================
// PATIENT & ENCOUNTER LOADING
// ============================================================================

function newEncounter(patientKey) {
    const patient = CONFIG.PATIENTS[patientKey];
    if (!patient) return alert('Patient not found');

    STATE.currentPatient = patient;
    STATE.currentComplaint = null;
    STATE.sessionId = 'session_' + Date.now();
    STATE.questions = [];
    STATE.answers = [];
    STATE.selectedDiagnoses = [];
    STATE.selectedInvestigations = [];
    STATE.selectedMedications = [];
    STATE.selectedProcedures = [];

    document.getElementById('currentPatientName').textContent = patient.name;
    document.getElementById('currentComplaint').textContent = 'New Consultation';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('consultationForm').style.display = 'block';

    clearForm();
    log('New encounter started', patient.name);
}

function loadEncounter(patientKey, complaintKey, encounterNum) {
    loadHistoricalEncounter(patientKey, complaintKey, encounterNum);
}

function loadHistoricalEncounter(patientKey, complaintKey, encounterNum) {
    const patient = CONFIG.PATIENTS[patientKey];
    const complaint = patient.complaints[complaintKey];
    const encounter = complaint.encounters[encounterNum - 1];

    if (!encounter) return alert('Encounter not found');

    STATE.currentPatient = patient;
    STATE.currentComplaint = complaintKey;
    STATE.currentEncounterNum = encounterNum;

    document.getElementById('currentPatientName').textContent = patient.name;
    document.getElementById('currentComplaint').textContent = `${complaint.name} - ${encounter.date} - Encounter ${encounterNum} of ${complaint.visits}`;
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('consultationForm').style.display = 'block';

    // Show encounter selector if multiple visits
    if (complaint.visits > 1) {
        const selector = document.querySelector('.encounter-selector');
        if (selector) selector.style.display = 'flex';

        const dropdown = document.getElementById('encounterDropdown');
        if (dropdown) {
            dropdown.innerHTML = '';
            for (let i = 1; i <= complaint.visits; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Encounter ${i} - ${complaint.encounters[i-1].date}`;
                if (i === encounterNum) option.selected = true;
                dropdown.appendChild(option);
            }
        }
    }

    if (encounter.type !== 'new') {
        fillHistoricalData(encounter);
        disableEditing();
    } else {
        clearForm();
    }

    log('Loaded encounter', { patient: patient.name, encounter: encounterNum });
}

function fillHistoricalData(encounter) {
    // Chief complaint
    if (encounter.chief_complaint) {
        document.getElementById('chiefComplaintInput').value = encounter.chief_complaint;
        addChiefComplaint();
    }

    // Vitals
    if (encounter.vitals.bp) document.getElementById('bp').value = encounter.vitals.bp;
    if (encounter.vitals.temp) document.getElementById('temp').value = encounter.vitals.temp;
    if (encounter.vitals.height) document.getElementById('height').value = encounter.vitals.height;
    if (encounter.vitals.weight) document.getElementById('weight').value = encounter.vitals.weight;

    // Questions
    if (encounter.questions && encounter.questions.length > 0) {
        const qContainer = document.getElementById('questionsContainer');
        qContainer.innerHTML = '';
        encounter.questions.forEach((qa, idx) => {
            const div = document.createElement('div');
            div.className = 'question-item';
            div.innerHTML = `
                <div class="question-text">Q${idx + 1}: ${qa.question}</div>
                <div style="color: #10b981; font-weight: 500; margin-top: 8px;">✓ ${qa.answer}</div>
            `;
            qContainer.appendChild(div);
        });
    }

    // Diagnoses
    const diagContainer = document.getElementById('diagnosisContainer');
    diagContainer.innerHTML = '';
    encounter.diagnoses.forEach(diag => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <input type="checkbox" checked disabled>
            <div class="checkbox-content"><div class="checkbox-label">${diag}</div></div>
        `;
        diagContainer.appendChild(item);
    });

    // Investigations
    const invContainer = document.getElementById('investigationsContainer');
    invContainer.innerHTML = '';
    encounter.investigations.forEach(inv => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <input type="checkbox" checked disabled>
            <div class="checkbox-content"><div class="checkbox-label">${inv}</div></div>
        `;
        invContainer.appendChild(item);
    });

    // Medications
    const medContainer = document.getElementById('medicationsContainer');
    medContainer.innerHTML = '';
    encounter.medications.forEach(med => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <input type="checkbox" checked disabled>
            <div class="checkbox-content"><div class="checkbox-label">${med}</div></div>
        `;
        medContainer.appendChild(item);
    });

    // Notes
    document.getElementById('diagnosisNotes').value = encounter.diagnosis_notes || '';
    document.getElementById('investigationsNotes').value = encounter.investigations_notes || '';
    document.getElementById('medicationsNotes').value = encounter.medications_notes || '';
    document.getElementById('proceduresNotes').value = encounter.procedures_notes || '';
    document.getElementById('adviceNotes').value = encounter.advice_notes || '';
}

function disableEditing() {
    document.querySelectorAll('input, textarea, button, select').forEach(el => {
        if (el.id !== 'encounterDropdown') el.disabled = true;
    });

    document.querySelectorAll('.btn-primary, .btn-secondary, .btn-success, .btn-ai').forEach(btn => {
        if (btn.parentElement && !btn.parentElement.classList.contains('encounter-selector')) {
            btn.style.display = 'none';
        }
    });
}

function switchEncounter() {
    const encounterNum = parseInt(document.getElementById('encounterDropdown').value);
    loadHistoricalEncounter(
        Object.keys(CONFIG.PATIENTS).find(key => CONFIG.PATIENTS[key].id === STATE.currentPatient.id),
        STATE.currentComplaint,
        encounterNum
    );
}

function clearForm() {
    document.getElementById('chiefComplaintChips').innerHTML = '';
    document.getElementById('questionsContainer').innerHTML = '';
    document.getElementById('diagnosisContainer').innerHTML = '<p class="empty-state">Generate questions first</p>';
    document.getElementById('investigationsContainer').innerHTML = '<p class="empty-state">Select diagnoses first</p>';
    document.getElementById('medicationsContainer').innerHTML = '<p class="empty-state">Select investigations first</p>';
    document.getElementById('proceduresContainer').innerHTML = '<p class="empty-state">Select medications first</p>';

    ['chiefComplaintInput', 'height', 'weight', 'headCirc', 'temp', 'bp',
     'diagnosisNotes', 'investigationsNotes', 'medicationsNotes', 'proceduresNotes', 'adviceNotes']
        .forEach(id => document.getElementById(id).value = '');
}

// ============================================================================
// CHIEF COMPLAINT
// ============================================================================

function addChiefComplaint() {
    const input = document.getElementById('chiefComplaintInput');
    const value = input.value.trim();
    if (!value) return;

    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `${value} <span onclick="this.parentElement.remove()">×</span>`;
    document.getElementById('chiefComplaintChips').appendChild(chip);
    input.value = '';
    log('Added complaint', value);
}

// ============================================================================
// QUESTIONS FLOW
// ============================================================================

async function generateQuestions() {
    const btn = document.getElementById('generateQuestionsBtn');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    const complaints = [...document.querySelectorAll('#chiefComplaintChips .chip')]
        .map(c => c.textContent.replace('×', '').trim());

    try {
        const res = await fetch(`${CONFIG.TRIAGE_API}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chief_complaint: complaints.join(', ') || 'General consultation',
                clinical_history: ''
            })
        });

        const data = await res.json();
        STATE.sessionId = data.session_id;
        STATE.questions.push(data.question);

        renderQuestion(data.question, data.options, 0);
        btn.textContent = 'Questions Started';
        log('Generated first question');

    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Generate Questions';
        alert('Error: ' + e.message);
    }
}

function renderQuestion(question, options, idx) {
    const div = document.createElement('div');
    div.className = 'question-item';
    div.innerHTML = `
        <div class="question-text">Q${idx + 1}: ${question}</div>
        <div class="options-container">
            ${options.map(o => `<button class="option-btn" onclick="selectOption(${idx}, '${o}', this)">${o}</button>`).join('')}
        </div>
    `;
    document.getElementById('questionsContainer').appendChild(div);
}

async function selectOption(idx, answer, btn) {
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    STATE.answers[idx] = answer;
    log(`Answered Q${idx + 1}`, answer);

    await getNextQuestion();
}

async function getNextQuestion() {
    try {
        const res = await fetch(`${CONFIG.TRIAGE_API}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: STATE.sessionId,
                selected_option: STATE.answers[STATE.answers.length - 1]
            })
        });

        if (!res.ok) throw new Error('Failed to get next question');
        const data = await res.json();

        if (data.completed) {
            renderDiagnoses(data.considerations);
        } else {
            STATE.questions.push(data.question);
            renderQuestion(data.question, data.options, STATE.questions.length - 1);
        }
    } catch (e) {
        console.error('Error getting next question:', e);
        alert('Error getting next question: ' + e.message);
    }
}

// ============================================================================
// DIAGNOSES
// ============================================================================

function renderDiagnoses(considerations) {
    const container = document.getElementById('diagnosisContainer');
    container.innerHTML = '';

    considerations.forEach(diag => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <input type="checkbox" onchange="toggleDiagnosis('${diag.name}')">
            <div class="checkbox-content">
                <div class="checkbox-label">${diag.name}</div>
                <div class="checkbox-meta">Likelihood: ${diag.likelihood}</div>
            </div>
        `;
        container.appendChild(item);
    });

    log('Rendered diagnoses', considerations.length);
}

function toggleDiagnosis(diagnosis) {
    const idx = STATE.selectedDiagnoses.indexOf(diagnosis);
    if (idx > -1) {
        STATE.selectedDiagnoses.splice(idx, 1);
    } else {
        STATE.selectedDiagnoses.push(diagnosis);
    }
    log('Diagnosis toggled', { diagnosis, selected: STATE.selectedDiagnoses });
}

function toggleInvestigation(investigation) {
    const idx = STATE.selectedInvestigations.indexOf(investigation);
    if (idx > -1) {
        STATE.selectedInvestigations.splice(idx, 1);
    } else {
        STATE.selectedInvestigations.push(investigation);
    }
    log('Investigation toggled', { investigation, selected: STATE.selectedInvestigations });
}

function toggleMedication(medication) {
    const idx = STATE.selectedMedications.indexOf(medication);
    if (idx > -1) {
        STATE.selectedMedications.splice(idx, 1);
    } else {
        STATE.selectedMedications.push(medication);
    }
    log('Medication toggled', { medication, selected: STATE.selectedMedications });
}

function toggleProcedure(procedure) {
    const idx = STATE.selectedProcedures.indexOf(procedure);
    if (idx > -1) {
        STATE.selectedProcedures.splice(idx, 1);
    } else {
        STATE.selectedProcedures.push(procedure);
    }
    log('Procedure toggled', { procedure, selected: STATE.selectedProcedures });
}

// ============================================================================
// SAVE FUNCTIONS
// ============================================================================

function saveDiagnoses() {
    if (STATE.selectedDiagnoses.length === 0) {
        alert('Please select at least one diagnosis');
        return;
    }
    document.getElementById('btnNextInv').style.display = 'block';
    document.getElementById('btnNextInv').disabled = false;
    alert(`Saved ${STATE.selectedDiagnoses.length} diagnoses`);
    log('Diagnoses saved', STATE.selectedDiagnoses);
}

function saveInvestigations() {
    if (STATE.selectedInvestigations.length === 0) {
        alert('Please select at least one investigation');
        return;
    }
    document.getElementById('btnNextMed').style.display = 'block';
    document.getElementById('btnNextMed').disabled = false;
    alert(`Saved ${STATE.selectedInvestigations.length} investigations`);
    log('Investigations saved', STATE.selectedInvestigations);
}

function saveMedications() {
    if (STATE.selectedMedications.length === 0) {
        alert('Please select at least one medication');
        return;
    }
    document.getElementById('btnNextProc').style.display = 'block';
    document.getElementById('btnNextProc').disabled = false;
    alert(`Saved ${STATE.selectedMedications.length} medications`);
    log('Medications saved', STATE.selectedMedications);
}

// ============================================================================
// WORKFLOW NAVIGATION
// ============================================================================

async function proceedToInvestigations() {
    const container = document.getElementById('investigationsContainer');
    container.innerHTML = '<p>Loading investigations...</p>';

    try {
        const res = await fetch(`${CONFIG.TRIAGE_API}/select-diagnoses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: STATE.sessionId,
                selected: STATE.selectedDiagnoses
            })
        });

        const data = await res.json();
        container.innerHTML = '';

        data.investigations.forEach(inv => {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" onchange="toggleInvestigation('${inv.name}')">
                <div class="checkbox-content">
                    <div class="checkbox-label">${inv.name}</div>
                    <div class="checkbox-meta">${inv.reason || ''}</div>
                </div>
            `;
            container.appendChild(item);
        });

        log('Loaded investigations', data.investigations.length);
    } catch (e) {
        container.innerHTML = '<p>Error loading investigations</p>';
    }
}

async function proceedToMedications() {
    const container = document.getElementById('medicationsContainer');
    container.innerHTML = '<p>Loading medications...</p>';

    try {
        const res = await fetch(`${CONFIG.TRIAGE_API}/select-investigations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: STATE.sessionId,
                selected: STATE.selectedInvestigations
            })
        });

        const data = await res.json();
        container.innerHTML = '';

        data.medications.forEach(med => {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" onchange="toggleMedication('${med.name}')">
                <div class="checkbox-content">
                    <div class="checkbox-label">${med.name}</div>
                    <div class="checkbox-meta">${med.dose || ''} - ${med.route || ''}</div>
                </div>
            `;
            container.appendChild(item);
        });

        log('Loaded medications', data.medications.length);
    } catch (e) {
        container.innerHTML = '<p>Error loading medications</p>';
    }
}

async function proceedToProcedures() {
    const container = document.getElementById('proceduresContainer');
    container.innerHTML = '<p>Loading procedures...</p>';

    try {
        const res = await fetch(`${CONFIG.TRIAGE_API}/select-medications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: STATE.sessionId,
                selected: STATE.selectedMedications
            })
        });

        const data = await res.json();
        container.innerHTML = '';

        data.procedures.forEach(proc => {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" onchange="toggleProcedure('${proc.name}')">
                <div class="checkbox-content">
                    <div class="checkbox-label">${proc.name}</div>
                    <div class="checkbox-meta">${proc.indication || ''}</div>
                </div>
            `;
            container.appendChild(item);
        });

        log('Loaded procedures', data.procedures.length);
    } catch (e) {
        container.innerHTML = '<p>Error loading procedures</p>';
    }
}

// ============================================================================
// AI NOTES GENERATION
// ============================================================================

async function generateAllNotes() {
    const sections = ['diagnosis', 'investigations', 'medications', 'procedures', 'advice'];

    for (const section of sections) {
        await generateNotes(section);
    }
}


// ============================================================================
// SAVE TO VIKAS API
// ============================================================================

async function saveConsultationToAPI() {
    if (!STATE.currentPatient) {
        alert('No patient loaded');
        return false;
    }

    const payload = {
        patient_id: STATE.currentPatient.id,
        doctor_id: "dr_demo_001",
        visit_date: new Date().toISOString().split('T')[0],
        chief_complaints: [...document.querySelectorAll('#chiefComplaintChips .chip')]
            .map(c => c.textContent.replace('×', '').trim()),
        vitals: {
            height_cm: parseFloat(document.getElementById('height').value) || 0,
            weight_kg: parseFloat(document.getElementById('weight').value) || 0,
            head_circ_cm: parseFloat(document.getElementById('headCirc').value) || 0,
            temp_celsius: parseFloat(document.getElementById('temp').value) || 0,
            bp_mmhg: document.getElementById('bp').value || ''
        },
        key_questions: STATE.questions.map((q, i) => ({
            question: q,
            answer: STATE.answers[i] || ''
        })),
        key_questions_ai_notes: "",
        diagnoses: STATE.selectedDiagnoses,
        diagnoses_ai_notes: document.getElementById('diagnosisNotes').value,
        investigations: STATE.selectedInvestigations,
        investigations_ai_notes: document.getElementById('investigationsNotes').value,
        medications: STATE.selectedMedications,
        medications_ai_notes: document.getElementById('medicationsNotes').value,
        procedures: STATE.selectedProcedures,
        procedures_ai_notes: document.getElementById('proceduresNotes').value,
        advice: "",
        follow_up_date: "",
        advice_ai_notes: document.getElementById('adviceNotes').value
    };

    console.log('Sending to Vikas API:', payload);

    try {
        const response = await fetch(`${CONFIG.VIKAS_API}/api/v1/consultation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Save failed');
        }

        const data = await response.json();
        alert(`✓ Consultation saved!\nID: ${data.consultation_id}\nVisit #${data.visit_number}`);
        log('Consultation saved', data);
        return true;

    } catch (error) {
        console.error('Error saving:', error);
        alert('✗ Save failed: ' + error.message);
        return false;
    }
}

async function saveDraft() {
    await saveConsultationToAPI();
}

async function issuePrescription() {
    const saved = await saveConsultationToAPI();
    if (saved) {
        alert('Prescription issued and saved!');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chiefComplaintInput')
        ?.addEventListener('keypress', e => e.key === 'Enter' && addChiefComplaint());

    log('Clinical UI Initialized');
});
async function generateNotes(section) {
    const textareaId = section + 'Notes';
    const textarea = document.getElementById(textareaId);
    
    textarea.value = 'Generating...';
    
    const context = {
        chief_complaint: [...document.querySelectorAll('#chiefComplaintChips .chip')]
            .map(c => c.textContent.replace('×', '').trim()).join(', '),
        diagnoses: STATE.selectedDiagnoses,
        investigations: STATE.selectedInvestigations,
        medications: STATE.selectedMedications
    };
    
    try {
        const response = await fetch(`${CONFIG.SUMMARY_API}/api/v1/generate-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_id: STATE.currentPatient?.id || 'unknown',
                section: section,
                context: context
            })
        });
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        textarea.value = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data !== '[DONE]') {
                        textarea.value += data;
                    }
                }
            }
        }
        
        log(`Generated ${section} notes`);
    } catch (e) {
        console.error('Summary error:', e);
        textarea.value = 'Error generating notes';
    }
}
