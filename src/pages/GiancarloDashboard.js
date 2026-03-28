import { createTaskWithAssignment, getTeacherTasks, deleteTask } from '../services/tasks';
import { addFeedback } from '../services/feedback';
import { getProfile, signOut, updateProfile } from '../services/supabase';
import { ReviewModal } from '../components/ReviewModal';
import { ProfileModal } from '../components/ProfileModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { LoadingSkeleton } from '../components/Loading';
import { toast } from '../components/Toast';
import { supabase } from '../services/supabaseClient';

const TYPE_TRANSLATIONS = {
    'roleplay': 'Conversazione', 'conversazione': 'Conversazione',
    'flashcard': 'Lessico', 'flashcards': 'Lessico', 'lessico': 'Lessico',
    'fill': 'Completare', 'completare': 'Completare',
    'fill_choice': 'Scelta Multipla',
    'order_sentence': 'Ordina Frase',
    'translation_choice': 'Traduzione',
    'error_correction': 'Correzione'
};

export const GiancarloDashboard = (navigate, user) => {
    const container = document.createElement('div');
    container.className = 'dashboard-root';
    container.style.cssText = 'display:flex; min-height:100vh; background-color:var(--color-parchment); padding-left: 28rem; padding-right: 2rem; overflow-x: hidden;';

    let cType = 'roleplay';
    let tasks = [];
    let students = [];         // All student profiles
    let selectedStudentId = null;
    let editTaskId = null;
    let isSubmitting = false;
    let isLoading = true;
    let studentName = "Studente";
    let flashcards = [{ word: '', translation: '', example: '' }];
    let fillChoices = [];
    let fcText = '';
    let tcOptions = [{ text: '' }, { text: '' }, { text: '' }]; // translation_choice options
    let tcCorrect = '';   // translation_choice correct option

    const modal = ReviewModal(async (submissionId, comment) => {
        try {
            const { error } = await addFeedback({ submissionId, comment });
            if (error) throw error;
            toast.show("Registro firmato. ✓");
            refresh();
        } catch (err) { console.error(err); toast.show("Errore nel registro.", "error"); }
    });

    const pModal = ProfileModal(user, async (newName, newAvatar) => {
        try {
            const updates = { name: newName };
            if (newAvatar) updates.avatar_url = newAvatar;
            
            const { data, error } = await updateProfile(user.id, updates);
            if (error) throw error;
            
            // Sync local data
            Object.assign(user, data);
            localStorage.setItem('luci_user', JSON.stringify(user));
            render();
            toast.show("Profilo salvato. ✓");
        } catch (err) { console.error(err); toast.show("Errore salvataggio.", "error"); }
    });

    const confirmModal = ConfirmModal(async (taskId) => {
        try {
            isLoading = true; render();
            const { error } = await deleteTask(taskId);
            if (error) throw error;
            toast.show("Attività eliminata. ✓");
            refresh();
        } catch (err) { console.error(err); toast.show("Errore nel borrado.", "error"); }
    });

    const refresh = async () => {
        isLoading = true;
        render();
        try {
            // Load students and tasks in parallel
            const [studentsRes, tasksRes] = await Promise.all([
                supabase.from('profiles').select('id, name, avatar_url').eq('role', 'student'),
                getTeacherTasks()
            ]);

            if (studentsRes.data && studentsRes.data.length > 0) {
                students = studentsRes.data;
                // Auto-select if only one, keep selection if already set
                if (!selectedStudentId || !students.find(s => s.id === selectedStudentId)) {
                    selectedStudentId = students[0].id;
                }
                studentName = students.find(s => s.id === selectedStudentId)?.name || "Studente";
            }

            if (tasksRes.error) throw tasksRes.error;
            tasks = (tasksRes.data || []).map(task => {
                const assignments = task.task_assignments || [];
                const submissions = assignments.flatMap(a => a.submissions || []);
                let computedStatus = 'PENDING';
                if (submissions.length > 0) {
                    const hasFeedback = submissions.some(s => s.feedback && s.feedback.length > 0);
                    computedStatus = hasFeedback ? 'COMPLETED' : 'TO REVIEW';
                }
                return { ...task, computedStatus };
            });
        } catch (err) { console.error(err); toast.show("Errore nel registro.", "error"); }
        finally { isLoading = false; render(); }
    };

    const handleCreateTask = async () => {
        const title = container.querySelector('#task-title').value.trim();
        if (!title) return toast.show("Manca il titolo.", "error");
        let content = {};
        if (cType === 'roleplay') {
            const dialogue = container.querySelector('#rp-desc').value.trim();
            if (!dialogue) return toast.show("Manca lo scenario.", "error");
            content = { type: 'roleplay', description: dialogue };
        } else if (cType === 'flashcard') {
            const validCards = flashcards.filter(c => c.word && c.translation);
            if (validCards.length === 0) return toast.show("Crea almeno una carta.", "error");
            content = { type: 'flashcards', items: validCards };
        } else if (cType === 'fill') {
            const text = container.querySelector('#fill-text').value.trim();
            if (!text) return toast.show("Inserisci il testo.", "error");
            content = { type: 'fill', text: text };
        } else if (cType === 'fill_choice') {
            const text = container.querySelector('#fc-text').value.trim();
            if (!text) return toast.show("Inserisci il testo.", "error");
            if (fillChoices.length === 0) return toast.show("Inserisci almeno uno spazio (___).", "error");
            
            // Check all choices have a correct answer
            const incomplete = fillChoices.some(fc => !fc.correct || fc.options.length < 2);
            if (incomplete) return toast.show("Completa tutte le opzioni per ogni spazio.", "error");
            
            content = { type: 'fill_choice', text: text, gaps: fillChoices };
        } else if (cType === 'order_sentence') {
            const text = container.querySelector('#os-text').value.trim();
            if (!text) return toast.show("Inserisci la frase.", "error");
            
            // Clean logic dividing it into words keeping simple punctuation
            const words = text.split(/\s+/).filter(w => w.length > 0);
            if (words.length < 2) return toast.show("La frase deve avere almeno due parole.", "error");
            
            let shuffled = [...words];
            do {
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
            } while (words.length > 2 && shuffled.join('') === words.join(''));
            
            content = { type: 'order_sentence', original: text, words: shuffled, correctOrder: words };
        } else if (cType === 'translation_choice') {
            const question = container.querySelector('#tc-question')?.value.trim();
            if (!question) return toast.show("Inserisci la frase da tradurre.", "error");
            const validOpts = tcOptions.map(o => o.text.trim()).filter(t => t);
            if (validOpts.length < 2) return toast.show("Inserisci almeno 2 opzioni.", "error");
            if (tcCorrect === '') return toast.show("Seleziona la risposta corretta.", "error");
            const correctText = tcOptions[parseInt(tcCorrect)]?.text.trim();
            if (!correctText) return toast.show("L'opzione corretta non può essere vuota.", "error");
            content = { type: 'translation_choice', question, options: validOpts, correct: correctText };
        } else if (cType === 'error_correction') {
            const incorrect = container.querySelector('#ec-incorrect')?.value.trim();
            const correct = container.querySelector('#ec-correct')?.value.trim();
            if (!incorrect) return toast.show("Inserisci la frase scorretta.", "error");
            if (!correct) return toast.show("Inserisci la frase corretta.", "error");
            content = { type: 'error_correction', incorrect, correct };
        }
        // Use the pre-loaded selectedStudentId
        if (!selectedStudentId) {
            return toast.show("Seleziona un allievo prima di assegnare.", "error");
        }
        try {
            isSubmitting = true; render();
            if (editTaskId) {
                const { error } = await supabase.from('tasks').update({
                    title, type: cType === 'flashcard' ? 'flashcards' : cType, content
                }).eq('id', editTaskId);
                if (error) throw error;
                toast.show("Atto modificato. ✓");
                editTaskId = null;
            } else {
                const { error } = await createTaskWithAssignment({
                    title, type: cType === 'flashcard' ? 'flashcards' : cType,
                    content, studentId: selectedStudentId
                });
                if (error) throw error;
                toast.show("Atto assegnato. ✓");
            }
            flashcards = [{ word: '', translation: '', example: '' }];
            fcText = ""; fillChoices = [];
            tcOptions = [{ text: '' }, { text: '' }, { text: '' }]; tcCorrect = '';
            refresh();
        } catch (err) { console.error(err); toast.show("Errore.", "error"); }
        finally { isSubmitting = false; render(); }
    };

    const render = () => {
        container.innerHTML = '';

        // SIDEBAR
        const sidebar = document.createElement('aside');
        sidebar.className = 'atelier-sidebar';
        sidebar.innerHTML = `
            <div>
                <div class="atelier-sidebar__brand">Atelier di <em>Lingue</em></div>
                <nav>
                    <button class="sidebar-nav-btn active">🏠 REGISTRO</button>
                    <div class="sidebar-section-label">GESTIONE</div>
                    <button class="sidebar-nav-btn" id="btn-nav-students">👥 ALLIEVI</button>
                </nav>
            </div>
            <div class="sidebar-profile">
                <div class="sidebar-profile__header">
                    <div class="sidebar-profile__avatar">
                        ${user.avatar_url ? '<img src="' + user.avatar_url + '">' : '👤'}
                    </div>
                    <div>
                        <div class="sidebar-profile__name">${user.name}</div>
                        <div class="sidebar-profile__role">MAESTRO</div>
                    </div>
                </div>
                <div class="sidebar-profile__divider"></div>
                <div class="sidebar-profile__actions">
                    <button id="btn-settings" class="sidebar-profile__btn">Profilo</button>
                    <button id="btn-logout" class="sidebar-profile__btn sidebar-profile__btn--danger">Esci</button>
                </div>
            </div>
        `;

        // MAIN
        const main = document.createElement('main');
        main.className = 'teacher-main animate-in';
        main.innerHTML = `
            <div class="teacher-grid">
                <div>
                    <header class="teacher-header">
                        <h1>Bentornato, Maestro Giancarlo.</h1>
                        <p>LA TUA BOTTEGA DIDATTICA DI OGGI</p>
                    </header>
                    <nav class="teacher-chips">
                        <div class="teacher-chip ${cType === 'roleplay' ? 'active' : ''}" data-type="roleplay">📍 Conversazione</div>
                        <div class="teacher-chip ${cType === 'flashcard' ? 'active' : ''}" data-type="flashcard">🎴 Lessico</div>
                        <div class="teacher-chip ${cType === 'fill' ? 'active' : ''}" data-type="fill">🖋️ Completare</div>
                        <div class="teacher-chip ${cType === 'fill_choice' ? 'active' : ''}" data-type="fill_choice">📝 Scelta Multipla</div>
                        <div class="teacher-chip ${cType === 'order_sentence' ? 'active' : ''}" data-type="order_sentence">🧩 Ordina Frase</div>
                        <div class="teacher-chip ${cType === 'translation_choice' ? 'active' : ''}" data-type="translation_choice">🌍 Traduzione</div>
                        <div class="teacher-chip ${cType === 'error_correction' ? 'active' : ''}" data-type="error_correction">✏️ Correzione</div>
                    </nav>
                    <div class="teacher-form">
                        <div style="margin-bottom: 3rem;">
                            <label class="teacher-label">Titolo della Lezione</label>
                            <input type="text" id="task-title" class="teacher-input" placeholder="Esempio: Una serata a Roma...">
                        </div>
                        <div id="dynamic-content"></div>

                        ${students.length > 1 ? `
                        <div style="margin-top: 2.5rem;">
                            <label class="teacher-label">Assegna a</label>
                            <select id="student-select" class="teacher-input" style="font-size: 1.4rem; cursor: pointer;">
                                ${students.map(s => `<option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''}>${s.name}</option>`).join('')}
                            </select>
                        </div>` : `
                        <div style="margin-top: 2rem; font-family: var(--font-body); font-size: 1.1rem; opacity: 0.45;">
                            👤 Assegnato a: <strong>${studentName}</strong>
                        </div>`}

                        <div style="margin-top: 4rem; display: flex; justify-content: flex-end;">
                            <button class="teacher-assign-btn" id="btn-assign" ${isSubmitting ? 'disabled' : ''}>
                                <span>${isSubmitting ? 'SOLCANDO...' : (editTaskId ? 'Salva Modifica' : 'Assegna Atto')}</span> <span>✒️</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div>
                    <span class="teacher-tasks-header">Cammino di ${studentName}</span>
                    <div id="tasks-list" style="display: flex; flex-direction: column; gap: 1.2rem;"></div>
                </div>
            </div>
        `;

        // Dynamic content
        const dContent = main.querySelector('#dynamic-content');

        // Wire student selector if present
        const studentSelect = main.querySelector('#student-select');
        if (studentSelect) {
            studentSelect.onchange = (e) => {
                selectedStudentId = e.target.value;
                studentName = students.find(s => s.id === selectedStudentId)?.name || studentName;
                // Update the "Cammino di" header live
                const header = main.querySelector('.teacher-tasks-header');
                if (header) header.textContent = `Cammino di ${studentName}`;
            };
        }

        if (cType === 'roleplay') {
            dContent.innerHTML = '<label class="teacher-label">Scenario del Dialogo</label><textarea id="rp-desc" class="teacher-textarea" placeholder="Crea la scena..."></textarea>';
        } else if (cType === 'flashcard') {
            dContent.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <span class="teacher-label" style="margin: 0;">Mazzo di Lessico</span>
                    <button id="add-card" style="width: 3.6rem; height: 3.6rem; border-radius: 50%; border: 2px dashed var(--color-terracota); background: none; color: var(--color-terracota); font-size: 1.6rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
                </div>
                <div id="flashcards-list"></div>
            `;
            const fList = dContent.querySelector('#flashcards-list');
            flashcards.forEach((card, idx) => {
                const row = document.createElement('div');
                row.className = 'teacher-card-row';
                row.innerHTML = `
                    <input type="text" class="teacher-input" placeholder="Parola" value="${card.word}" data-idx="${idx}" data-field="word" style="font-size: 1.4rem;">
                    <input type="text" class="teacher-input" placeholder="Traduzione" value="${card.translation}" data-idx="${idx}" data-field="translation" style="font-size: 1.4rem;">
                    <input type="text" class="teacher-input" placeholder="Esempio" value="${card.example}" data-idx="${idx}" data-field="example" style="font-size: 1.3rem; opacity: 0.6;">
                    <button style="background: none; border: none; font-size: 1.4rem; cursor: pointer; opacity: 0.25;" data-remove="${idx}">✕</button>
                `;
                fList.appendChild(row);
            });
            fList.querySelectorAll('input').forEach(i => i.oninput = (e) => flashcards[e.target.dataset.idx][e.target.dataset.field] = e.target.value);
            fList.querySelectorAll('[data-remove]').forEach(b => b.onclick = (e) => { flashcards.splice(e.target.dataset.remove, 1); render(); });
            dContent.querySelector('#add-card').onclick = () => { flashcards.push({ word: '', translation: '', example: '' }); render(); };
        } else if (cType === 'fill') {
            dContent.innerHTML = '<label class="teacher-label">Testo con Spazi (usa ___ )</label><textarea id="fill-text" class="teacher-textarea" placeholder="Io ___ (andare) al mercato."></textarea>';
        } else if (cType === 'fill_choice') {
            dContent.innerHTML = `
                <label class="teacher-label">Testo con Opzioni (usa ___ )</label>
                <textarea id="fc-text" class="teacher-textarea" placeholder="Oggi ___ (___) a Roma. Use ___ per ogni spazio.">${fcText}</textarea>
                
                <div id="fc-config-container" style="margin-top: 3rem;">
                    <div class="teacher-label" style="margin-bottom: 2rem;">Configurazione Opzioni</div>
                    <div id="fc-list" style="display: flex; flex-direction: column; gap: 2rem;"></div>
                </div>
            `;
            const fcList = dContent.querySelector('#fc-list');
            const textarea = dContent.querySelector('#fc-text');

            const renderGapConfig = () => {
                fcList.innerHTML = fillChoices.length === 0 ? '<div style="opacity: 0.3; font-style: italic;">Inserisci ___ nel testo per configurare le opzioni.</div>' : '';
                fillChoices.forEach((fc, idx) => {
                    const row = document.createElement('div');
                    row.className = 'animate-in';
                    row.style.background = 'white';
                    row.style.padding = '2rem';
                    row.style.borderRadius = '1.5rem';
                    row.style.border = '1px solid rgba(0,0,0,0.03)';
                    row.innerHTML = `
                        <div style="font-family: var(--font-ui); font-size: 0.75rem; font-weight: 950; opacity: 0.4; margin-bottom: 1.5rem; text-transform: uppercase;">Spazio #${idx + 1}</div>
                        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                            <input type="text" class="teacher-input" placeholder="Opzioni (separa con ,)" style="flex: 1; font-size: 1.3rem;" value="${fc.options.join(',')}">
                            <select class="teacher-input" style="width: 25rem; font-size: 1.3rem;">
                                <option value="">Scegli Corretta...</option>
                                ${fc.options.map(opt => `<option value="${opt}" ${opt === fc.correct ? 'selected' : ''}>${opt}</option>`).join('')}
                            </select>
                        </div>
                    `;
                    
                    const input = row.querySelector('input');
                    const select = row.querySelector('select');
                    
                    input.onchange = (e) => {
                        const opts = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                        fillChoices[idx].options = opts;
                        const currentCorrect = fillChoices[idx].correct;
                        select.innerHTML = '<option value="">Scegli Corretta...</option>' + 
                            opts.map(opt => `<option value="${opt}" ${opt === currentCorrect ? 'selected' : ''}>${opt}</option>`).join('');
                    };
                    
                    select.onchange = (e) => {
                        fillChoices[idx].correct = e.target.value;
                    };
                    
                    fcList.appendChild(row);
                });
            };

            const syncGaps = () => {
                const text = textarea.value;
                const gapCount = (text.match(/___/g) || []).length;
                if (fillChoices.length < gapCount) {
                    for (let i = fillChoices.length; i < gapCount; i++) fillChoices.push({ options: [], correct: '' });
                } else if (fillChoices.length > gapCount) {
                    fillChoices = fillChoices.slice(0, gapCount);
                }
                renderGapConfig();
            };

            textarea.oninput = (e) => {
                fcText = e.target.value;
                syncGaps();
            };
            syncGaps();
        } else if (cType === 'order_sentence') {
            dContent.innerHTML = `
                <label class="teacher-label">Frase Corretta</label>
                <textarea id="os-text" class="teacher-textarea" placeholder="Inserisci la frase esatta (es. Io sono andato al mercato ieri.)"></textarea>
                <div style="font-family: var(--font-body); font-size: 1.1rem; opacity: 0.5; margin-top: 1rem;">
                    Il sistema dividerà e mescolerà le parole automaticamente. L'allievo dovrà ricomporla trascinando i blocchi.
                </div>
            `;
        } else if (cType === 'translation_choice') {
            dContent.innerHTML = `
                <div style="margin-bottom: 2.5rem;">
                    <label class="teacher-label">Frase da Tradurre (Spagnolo)</label>
                    <textarea id="tc-question" class="teacher-textarea" style="min-height: 8rem;" placeholder="Es: Fui al mercado ayer">${tcOptions.question || ''}</textarea>
                </div>
                <label class="teacher-label">Opzioni di Risposta (Italiano)</label>
                <div id="tc-options-list" style="display: flex; flex-direction: column; gap: 1.4rem; margin-bottom: 1.5rem;">
                    ${tcOptions.map((opt, i) => `
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <input type="radio" name="tc-correct" id="tc-r-${i}" value="${i}" ${tcCorrect === String(i) ? 'checked' : ''} style="width: 1.8rem; height: 1.8rem; accent-color: var(--color-bordo); cursor: pointer; flex-shrink: 0;">
                            <input type="text" class="teacher-input tc-opt-input" data-idx="${i}" placeholder="Opzione ${i+1}" value="${opt.text}" style="flex: 1; font-size: 1.4rem;">
                            ${tcOptions.length > 2 ? `<button data-remove-tc="${i}" style="background:none; border:none; font-size:1.4rem; opacity:0.3; cursor:pointer;">✕</button>` : ''}
                        </div>
                    `).join('')}
                </div>
                <button id="tc-add-opt" style="background: none; border: 2px dashed var(--color-terracota); color: var(--color-terracota); font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.1em; padding: 1rem 2rem; border-radius: 1.2rem; cursor: pointer; opacity: 0.6;">+ Aggiungi Opzione</button>
                <div style="font-family: var(--font-body); font-size: 1.1rem; opacity: 0.5; margin-top: 1.5rem;">Seleziona il radio button accanto all'opzione corretta.</div>
            `;

            // Wire events
            dContent.querySelectorAll('.tc-opt-input').forEach(inp => {
                inp.oninput = (e) => { tcOptions[parseInt(e.target.dataset.idx)].text = e.target.value; };
            });
            dContent.querySelectorAll('[name="tc-correct"]').forEach(r => {
                r.onchange = (e) => { tcCorrect = e.target.value; };
            });
            dContent.querySelectorAll('[data-remove-tc]').forEach(b => {
                b.onclick = () => { tcOptions.splice(parseInt(b.dataset.removeTc), 1); if (parseInt(tcCorrect) >= tcOptions.length) tcCorrect = '0'; render(); };
            });
            dContent.querySelector('#tc-add-opt').onclick = () => { tcOptions.push({ text: '' }); render(); };

        } else if (cType === 'error_correction') {
            dContent.innerHTML = `
                <div style="margin-bottom: 2.5rem;">
                    <label class="teacher-label">Frase Scorretta (da mostrare all'allievo)</label>
                    <textarea id="ec-incorrect" class="teacher-textarea" style="min-height: 8rem; color: #dc2626;" placeholder="Es: Io andare al mercato ieri"></textarea>
                </div>
                <div>
                    <label class="teacher-label">Frase Corretta (soluzione)</label>
                    <textarea id="ec-correct" class="teacher-textarea" style="min-height: 8rem; color: #16a34a;" placeholder="Es: Io sono andato al mercato ieri"></textarea>
                </div>
                <div style="font-family: var(--font-body); font-size: 1.1rem; opacity: 0.5; margin-top: 1.5rem;">L'allievo vedrà la frase scorretta e dovrà riscriverla correttamente.</div>
            `;
        }

        // Task list
        const tList = main.querySelector('#tasks-list');
        if (isLoading) {
            tList.appendChild(LoadingSkeleton(5));
        } else {
            tasks.forEach((task, index) => {
                const card = document.createElement('div');
                card.className = 'teacher-task-card';
                card.style.animationDelay = `${index * 0.06}s`;
                let sColor = 'var(--color-terracota)', bColor = 'white', sText = 'In sospeso';
                let showDot = false;
                const lowerType = task.type?.toLowerCase();
                if (task.computedStatus === 'TO REVIEW') { 
                    sText = 'DA CORREGGERE ✒️'; sColor = 'white'; bColor = 'var(--color-terracota)'; 
                    showDot = true;
                } else if (task.computedStatus === 'COMPLETED') { 
                    sText = 'COMPLETATO ✓'; sColor = '#065f46'; bColor = '#ecfdf5'; 
                }
                card.innerHTML = `
                    <div style="flex: 1; display: flex; align-items: center; gap: 2.5rem;">
                        ${showDot ? '<div class="notif-dot"></div>' : '<div style="width: 0.9rem;"></div>'}
                        <div>
                            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.6rem;">
                                <span style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; opacity: 0.3; letter-spacing: 0.15em; text-transform: uppercase;">${TYPE_TRANSLATIONS[lowerType] || task.type}</span>
                                <span style="background: ${bColor}; color: ${sColor}; padding: 0.3rem 1.2rem; border-radius: 0.6rem; font-family: var(--font-ui); font-size: 0.95rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid rgba(0,0,0,0.02); transition: all 0.3s;">${sText}</span>
                            </div>
                            <h5 style="font-family: var(--font-titles); font-size: 1.6rem; margin: 0; color: var(--color-ink); font-weight: 500;">${task.title}</h5>
                        </div>
                    </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1.5rem; opacity: 0.3; transition: opacity 0.3s;" class="task-actions" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.3">
                        <div style="font-size: 1.1rem; font-family: var(--font-ui); font-weight: 850;">${new Date(task.created_at).toLocaleDateString('it-IT')}</div>
                        ${task.computedStatus === 'PENDING' ? `<button class="btn-edit-task" style="background: none; border: none; font-size: 1.4rem; cursor: pointer;" title="Modifica">✏️</button>` : ''}
                        <button class="btn-delete-task" style="background: none; border: none; font-size: 1.4rem; cursor: pointer;" title="Elimina">🗑️</button>
                    </div>
                `;
                card.onclick = () => navigate(`/task/${task.id}`);
                
                const btnDel = card.querySelector('.btn-delete-task');
                if (btnDel) btnDel.onclick = (e) => {
                    e.stopPropagation();
                    confirmModal.show(
                        "Vuoi eliminare?", 
                        `Sei seguro di voler eliminare "${task.title}"? L'azione è irreversibile.`,
                        task.id
                    );
                };

                const btnEdit = card.querySelector('.btn-edit-task');
                if (btnEdit) btnEdit.onclick = (e) => {
                    e.stopPropagation();
                    editTaskId = task.id;
                    const lType = task.type?.toLowerCase();
                    if (lType.includes('role')) cType = 'roleplay';
                    else if (lType.includes('flash') || lType.includes('lessico')) cType = 'flashcard';
                    else if (lType === 'fill_choice') cType = 'fill_choice';
                    else if (lType === 'order_sentence') cType = 'order_sentence';
                    else if (lType === 'translation_choice') cType = 'translation_choice';
                    else if (lType === 'error_correction') cType = 'error_correction';
                    else cType = 'fill';
                    
                    if (cType === 'flashcard') flashcards = task.content?.items || task.content?.cards || [{ word: '', translation: '', example: '' }];
                    else if (cType === 'fill_choice') {
                        fillChoices = task.content?.gaps || [];
                        fcText = task.content?.text || "";
                    } else if (cType === 'translation_choice') {
                        const opts = task.content?.options || [];
                        tcOptions = opts.map(t => ({ text: t }));
                        const corIdx = opts.indexOf(task.content?.correct);
                        tcCorrect = corIdx !== -1 ? String(corIdx) : '';
                    }
                    
                    render();
                    
                    setTimeout(() => {
                        const titleInput = container.querySelector('#task-title');
                        if (titleInput) titleInput.value = task.title;
                        
                        const rpDesc = container.querySelector('#rp-desc');
                        if (cType === 'roleplay' && rpDesc) rpDesc.value = task.content?.description || '';
                        
                        const ft = container.querySelector('#fill-text');
                        if (cType === 'fill' && ft) ft.value = task.content?.text || '';
                        
                        const os = container.querySelector('#os-text');
                        if (cType === 'order_sentence' && os) os.value = task.content?.original || task.content?.correctOrder?.join(' ') || '';

                        const tcQ = container.querySelector('#tc-question');
                        if (cType === 'translation_choice' && tcQ) tcQ.value = task.content?.question || '';

                        const ecI = container.querySelector('#ec-incorrect');
                        const ecC = container.querySelector('#ec-correct');
                        if (cType === 'error_correction' && ecI && ecC) {
                            ecI.value = task.content?.incorrect || '';
                            ecC.value = task.content?.correct || '';
                        }
                        
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 50);
                };

                tList.appendChild(card);
            });
        }

        // Event listeners
        main.querySelectorAll('.teacher-chip').forEach(chip => chip.onclick = (e) => { cType = e.target.closest('.teacher-chip').dataset.type; render(); });
        main.querySelector('#btn-assign').onclick = handleCreateTask;
        sidebar.querySelector('#btn-nav-students').onclick = () => navigate('/student/stats');
        sidebar.querySelector('#btn-logout').onclick = async () => { await signOut(); localStorage.removeItem('luci_user'); navigate('/login'); };
        sidebar.querySelector('#btn-settings').onclick = () => pModal.open(user);

        container.appendChild(sidebar);
        container.appendChild(main);
        if (!document.body.contains(modal.overlay)) document.body.appendChild(modal.overlay);
        if (!document.body.contains(pModal.overlay)) document.body.appendChild(pModal.overlay);
    };

    refresh();
    return container;
};
