import { createTaskWithAssignment, getTeacherTasks, deleteTask } from '../services/tasks';
import { addFeedback } from '../services/feedback';
import { getProfile, signOut, updateProfile } from '../services/supabase';
import { ReviewModal } from '../components/ReviewModal';
import { ProfileModal } from '../components/ProfileModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { LoadingSkeleton } from '../components/Loading';
import { toast } from '../components/Toast';
import { supabase } from '../services/supabaseClient';
import { searchTatoeba } from '../services/tatoebaService';
import { getNotifications, markAsRead, subscribeToNotifications, getNotificationContent, clearAllNotifications, cleanupOldNotifications } from '../services/notifications';
import { AudioRecorder } from '../components/AudioRecorder';
import { uploadAudio } from '../services/audioService';

const TYPE_TRANSLATIONS = {
    'roleplay': 'Conversazione', 'conversazione': 'Conversazione',
    'flashcard': 'Lessico', 'flashcards': 'Lessico', 'lessico': 'Lessico',
    'fill': '🖋️ Completare', 'completare': '🖋️ Completare',
    'fill_choice': '📝 Scelta Multipla',
    'order_sentence': '🧩 Ordina Frase',
    'translation': '🌍 Traduzione',
    'translation_choice': 'Traduzione', /* Legacy */
    'error_correction': '✏️ Correzione',
    'speed': '⚡ Velocità',
    'dettato': '🎧 Dettato',
    'pronuncia': '🎤 Pronuncia'
};

export const GiancarloDashboard = (navigate, user) => {
    const container = document.createElement('div');
    container.className = 'dashboard-container';

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
    let tcOptions = [{ text: '' }, { text: '' }, { text: '' }];
    let tcCorrect = '';

    // Tatoeba & New Types State
    let tatoebaQuery = '';
    let tatoebaResults = [];
    let tatoebaLoading = false;
    let tatoebaSearched = false;
    let tatoebaError = '';
    
    let fillSentences = [];
    let transPairs = [];
    let transDir = 'it-es';
    let speedPairs = [];
    let speedDir = 'it-es';
    let notifications = [];

    // Dettato & Pronuncia State
    let dettatoMode = 'comprensione';
    let dettatoQuestions = [''];
    let pronunciaMode = 'lettura';
    let audioBlob = null;
    let taskRefText = '';
    
    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return "adesso";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} h`;
        const days = Math.floor(hours / 24);
        return `${days} d`;
    };

    const renderNotifications = () => {
        const list = container.querySelector('#notifications-list');
        const badge = container.querySelector('#notif-count');
        const unread = notifications.filter(n => !n.read);
        
        if (badge) {
            badge.innerText = unread.length;
            badge.style.display = unread.length > 0 ? 'flex' : 'none';
        }

        if (list) {
            if (notifications.length === 0) {
                list.innerHTML = '<div class="notification-empty">Tutto tranquillo ✨</div>';
            } else {
                list.innerHTML = notifications.map(n => `
                    <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}" data-task="${n.task_id}">
                        <div class="notification-icon">${n.type === 'new_submission' ? '🎭' : '✒️'}</div>
                        <div class="notification-info">
                            <div class="notification-text">${getNotificationContent(n)}</div>
                            <div class="notification-time">${timeAgo(n.created_at)}</div>
                        </div>
                    </div>
                `).join('');

                list.querySelectorAll('.notification-item').forEach(item => {
                    item.onclick = async (e) => {
                        e.stopPropagation();
                        const id = item.dataset.id;
                        const taskId = item.dataset.task;
                        await markAsRead(id);
                        // Teachers go to correct review page
                        navigate(`/task/${taskId}`);
                    };
                });
            }
        }
    };

    const loadNotifications = async () => {
        try {
            const { data } = await getNotifications(user.id);
            notifications = data;
            renderNotifications();
        } catch (e) {
            console.error("Error loading notifications:", e);
        }
    };

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
            const [studentsRes, tasksRes] = await Promise.all([
                supabase.from('profiles').select('id, name, avatar_url').eq('role', 'student'),
                getTeacherTasks()
            ]);

            if (studentsRes.data && studentsRes.data.length > 0) {
                students = studentsRes.data;
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
        const titleInput = container.querySelector('#task-title');
        const title = titleInput ? titleInput.value.trim() : '';
        if (!title) return toast.show("Manca il titolo.", "error");
        
        let content = {};
        if (cType === 'roleplay') {
            const dialogue = container.querySelector('#rp-desc')?.value.trim();
            if (!dialogue) return toast.show("Manca lo scenario.", "error");
            content = { type: 'roleplay', description: dialogue };
        } else if (cType === 'flashcard') {
            const validCards = flashcards.filter(c => c.word && c.translation);
            if (validCards.length === 0) return toast.show("Crea almeno una carta.", "error");
            content = { type: 'flashcards', items: validCards };
        } else if (cType === 'fill') {
            if (fillSentences.length === 0) return toast.show("Aggiungi almeno una frase.", "error");
            const text = fillSentences.map(s => {
                if(!s.blank) return s.text;
                const reg = new RegExp(`\\\\b${s.blank}\\\\b`, 'i');
                return s.text.replace(reg, '___');
            }).join('\n');
            const sources = fillSentences.map(s => ({ id: s.tatoebaId, origin: s.source }));
            content = { type: 'fill', text: text, sources, sentences: fillSentences };
        } else if (cType === 'translation') {
            const valid = transPairs.filter(p => p.it && p.es);
            if (valid.length === 0) return toast.show("Aggiungi almeno un elemento.", "error");
            const sources = valid.map(s => ({ id: s.tatoebaId, origin: s.source }));
            const dir = container.querySelector('#trans-dir')?.value || 'it-es';
            content = { type: 'translation', pairs: valid, direction: dir, sources };
        } else if (cType === 'fill_choice') {
            const text = container.querySelector('#fc-text')?.value.trim();
            if (!text) return toast.show("Inserisci il testo.", "error");
            if (fillChoices.length === 0) return toast.show("Inserisci almeno uno spazio (___).", "error");
            const incomplete = fillChoices.some(fc => !fc.correct || fc.options.length < 2);
            if (incomplete) return toast.show("Completa tutte le opzioni per ogni spazio.", "error");
            content = { type: 'fill_choice', text: text, gaps: fillChoices };
        } else if (cType === 'order_sentence') {
            const text = container.querySelector('#os-text')?.value.trim();
            if (!text) return toast.show("Inserisci la frase.", "error");
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
        } else if (cType === 'speed') {
            const validWords = speedPairs.filter(w => w.it.trim() && w.es.trim());
            if (validWords.length < 8) return toast.show("Minimo 8 parole.", "error");
            if (validWords.length > 15) return toast.show("Massimo 15 parole.", "error");
            const sources = validWords.map(s => ({ id: s.tatoebaId, origin: s.source || 'manual' }));
            const direction = container.querySelector('#speed-dir')?.value || 'it-es';
            content = { type: 'speed', words: validWords, direction, sources };
        } else if (cType === 'dettato') {
            if (!audioBlob) return toast.show("Manca l'audio registrato.", "error");
            if (dettatoMode === 'comprensione') {
                const refText = container.querySelector('#dettato-ref')?.value.trim();
                if (!refText) return toast.show("Inserisci il testo di riferimento.", "error");
                content = { type: 'dettato', mode: 'comprensione', text: refText };
            } else {
                const validQs = dettatoQuestions.filter(q => q.trim());
                if (validQs.length === 0) return toast.show("Inserisci almeno una domanda.", "error");
                content = { type: 'dettato', mode: 'domande', questions: validQs };
            }
        } else if (cType === 'pronuncia') {
            if (pronunciaMode === 'lettura') {
                const text = container.querySelector('#pn-ref')?.value.trim();
                if (!text) return toast.show("Inserisci il testo.", "error");
                content = { type: 'pronuncia', mode: 'lettura', text: text, note: container.querySelector('#pn-note')?.value.trim() };
            } else if (pronunciaMode === 'ripetizione') {
                if (!audioBlob) return toast.show("Manca l'audio.", "error");
                content = { type: 'pronuncia', mode: 'ripetizione', text: container.querySelector('#pn-ref')?.value.trim() };
            } else {
                const text = container.querySelector('#pn-ref')?.value.trim();
                if (!text) return toast.show("Inserisci la consegna.", "error");
                content = { type: 'pronuncia', mode: 'parlato_libero', text: text };
            }
        }
        
        if (!selectedStudentId) return toast.show("Seleziona un allievo.", "error");
        
        try {
            isSubmitting = true; render();
            
            let finalAudioUrl = null;
            if (audioBlob) {
                const { url, error } = await uploadAudio(audioBlob, 'profesor');
                if (error) throw new Error("Errore nel caricamento audio");
                finalAudioUrl = url;
            }

            const taskType = cType === 'flashcard' ? 'flashcards' : cType;
            if (editTaskId) {
                const updates = { title, type: taskType, content };
                if (finalAudioUrl) updates.audio_url = finalAudioUrl;
                const { error } = await supabase.from('tasks').update(updates).eq('id', editTaskId);
                if (error) throw error;
                toast.show("Atto modificato. ✓");
                editTaskId = null;
            } else {
                const taskData = { title, type: taskType, content, studentId: selectedStudentId };
                if (finalAudioUrl) taskData.audio_url = finalAudioUrl;
                // Wait, createTaskWithAssignment uses an RPC or two-step insertion.
                // We need to modify the service `createTaskWithAssignment` to accept audio_url.
                // Let's pass it anyway:
                taskData.audio_url = finalAudioUrl; 
                const { error } = await createTaskWithAssignment(taskData);
                if (error) throw error;
                toast.show("Atto assegnato. ✓");
            }
            // Clear creation state
            flashcards = [{ word: '', translation: '', example: '' }];
            fcText = ""; fillChoices = []; fillSentences = []; transPairs = []; speedPairs = [];
            tcOptions = [{ text: '' }, { text: '' }, { text: '' }]; tcCorrect = '';
            dettatoQuestions = ['']; audioBlob = null;
            refresh();
        } catch (err) { console.error(err); toast.show("Errore.", "error"); }
        finally { isSubmitting = false; render(); }
    };

    const getLongestWord = (sentence) => {
        const stops = ['il', 'la', 'lo', 'le', 'gli', 'un', 'una', 'di', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'a', 'e', 'o', 'non', 'che', 'se', 'ma', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle', 'mi', 'ti', 'ci', 'vi', 'si', 'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'sono', 'sei', 'è', 'siamo', 'siete', 'era', 'ero', 'erano', 'sarà', 'saremo', 'siete', 'hanno', 'più', 'mio', 'tuo', 'suo', 'nostro', 'vostro', 'loro', 'questo', 'questa', 'quello', 'quella'];
        const words = sentence.replace(/[^\w\sàèéìòùáéíóúñ]/ig, '').split(/\s+/).filter(w => w.trim());
        let fw = '';
        for (const w of words) {
            if (!stops.includes(w.toLowerCase()) && w.length > fw.length) fw = w;
        }
        return fw || words[0] || '';
    };

    const handleTatoebaSearch = async () => {
        const input = container.querySelector('#tatoeba-input');
        if (!input) return;
        const query = input.value.trim();
        if (!query) return;
        tatoebaQuery = query;
        tatoebaLoading = true; tatoebaSearched = true; tatoebaError = '';
        render();
        try {
            const results = await searchTatoeba(query);
            tatoebaResults = results.map(r => ({ ...r, added: false }));
        } catch (err) {
            tatoebaError = err.message || "Errore Tatoeba";
            tatoebaResults = [];
        } finally {
            tatoebaLoading = false;
            render();
            // Restore focus safely
            const rInput = container.querySelector('#tatoeba-input');
            if(rInput) { 
                rInput.focus(); 
                rInput.setSelectionRange(tatoebaQuery.length, tatoebaQuery.length); 
            }
        }
    };

    const renderTatoebaPanel = () => {
        if (!['fill', 'translation', 'speed'].includes(cType)) return '';
        return `
            <div style="margin-bottom: 3.5rem; border: 1px solid rgba(166, 77, 50, 0.2); border-radius: 2rem; padding: 2.5rem; background: var(--glass); display: flex; flex-direction: column; gap: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="font-size: 1.8rem;">🔍</span>
                    <span style="font-family: var(--font-body); font-weight: 700; font-size: 1.2rem; color: var(--color-ink); text-transform: uppercase; letter-spacing: 0.1em;">Buscar frases reales en Tatoeba</span>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <input type="text" id="tatoeba-input" class="teacher-input" placeholder="Ej: caffè, famiglia, lavoro..." value="${tatoebaQuery}" style="flex: 1; font-size: 1.4rem; padding: 1.2rem; border-radius: 1rem;" onkeydown="if(event.key==='Enter') document.getElementById('tatoeba-search-btn').click();">
                    <button id="tatoeba-search-btn" style="background: var(--color-terracota); color: white; border: none; padding: 0 2.5rem; border-radius: 1rem; font-family: var(--font-ui); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer;">Buscar</button>
                </div>
                <div id="tatoeba-results-container" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
                    ${tatoebaLoading ? '<div style="font-family: var(--font-ui); font-style: italic; opacity: 0.5; font-size: 1.2rem; margin-top: 1rem; text-align: center;">Cercando su Tatoeba...</div>' : ''}
                    ${tatoebaError ? `<div style="font-family: var(--font-ui); color: #dc2626; font-size: 1.2rem; margin-top: 1rem; text-align: center;">${tatoebaError}</div>` : ''}
                    ${tatoebaSearched && !tatoebaLoading && tatoebaResults.length === 0 && !tatoebaError ? '<div style="font-family: var(--font-ui); font-style: italic; color: #a67d32; font-size: 1.2rem; margin-top: 1rem; text-align: center;">Nessun risultato. Prova con un\'altra parola.</div>' : ''}
                    ${tatoebaResults.map((r, idx) => `
                        <div class="tatoeba-card" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; background: var(--color-crema); border: 1px solid #d4c8b8; border-radius: 1.5rem; ${r.added ? 'opacity: 0.5;' : ''}">
                            <div style="flex: 1; padding-right: 2rem;">
                                <div style="font-family: var(--font-body); font-size: 1.5rem; color: var(--color-ink); margin-bottom: 0.4rem; font-weight: 500;">🇮🇹 ${r.italiano}</div>
                                <div style="font-family: var(--font-body); font-size: 1.35rem; color: rgba(0,0,0,0.6);">🇦🇷 ${r.español}</div>
                            </div>
                            ${r.added ? 
                                `<div style="font-family: var(--font-ui); color: #657e62; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; font-size: 1rem; padding: 0 1rem;">✓ Agregada</div>` : 
                                `<button class="tatoeba-add-btn" data-idx="${idx}" style="background: white; border: 1.5px solid var(--color-terracota); color: var(--color-terracota); padding: 0.8rem 1.6rem; border-radius: 0.8rem; font-family: var(--font-ui); font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 1rem; white-space: nowrap;">+ Agregar</button>`
                            }
                        </div>
                    `).join('')}
                </div>
            </div>`;
    };

    const render = () => {
        container.innerHTML = '';

        // SIDEBAR
        const sidebar = document.createElement('aside');
        sidebar.className = 'atelier-sidebar';
        sidebar.style.setProperty('--profile-accent', 'var(--color-terracota)');

        sidebar.innerHTML = `
            <div>
                <div class="atelier-sidebar__brand">Laboratorio <em>Lingue</em></div>
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
                    <header class="teacher-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4rem;">
                        <div>
                            <h1>Bentornato, Maestro Giancarlo.</h1>
                            <p>LA TUA CLASSE DI OGGI</p>
                        </div>

                        <div style="position: relative; margin-top: 0.5rem;">
                            <div class="notification-bell-container" id="notif-bell" style="background: white; border-radius: 50%; width: 4.2rem; height: 4.2rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05); cursor: pointer;">
                                <svg style="width: 2rem; height: 2rem; fill: var(--color-ink); opacity: 0.7;" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
                                <div class="notification-badge" id="notif-count" style="display:none; position: absolute; top: -0.2rem; right: -0.2rem; background: var(--color-terracota); color: white; min-width: 1.8rem; height: 1.8rem; padding: 0 0.5rem; border-radius: 50%; font-size: 0.95rem; align-items: center; justify-content: center; border: 2px solid white; font-weight: 950;">0</div>
                            </div>
                            
                            <div class="notification-dropdown" id="notif-dropdown" style="top: 120%; right: 0;">
                                <div class="notification-header">
                                    <span>Notifiche</span>
                                    <span id="clear-all" style="cursor:pointer; text-decoration: underline; font-size: 0.95rem; opacity: 0.8; font-weight: 800;">Svuota tutto</span>
                                </div>
                                <div class="notification-list" id="notifications-list"></div>
                            </div>
                        </div>
                    </header>
                    <nav class="teacher-chips">
                        <div class="teacher-chip ${cType === 'roleplay' ? 'active' : ''}" data-type="roleplay">📍 Conversazione</div>
                        <div class="teacher-chip ${cType === 'flashcard' ? 'active' : ''}" data-type="flashcard">🎴 Lessico</div>
                        <div class="teacher-chip ${cType === 'fill' ? 'active' : ''}" data-type="fill">🖋️ Completare</div>
                        <div class="teacher-chip ${cType === 'translation' ? 'active' : ''}" data-type="translation">🌍 Traduzione</div>
                        <div class="teacher-chip ${cType === 'translation_choice' ? 'active' : ''}" data-type="translation_choice">📝 Scelta Multipla</div>
                        <div class="teacher-chip ${cType === 'order_sentence' ? 'active' : ''}" data-type="order_sentence">🧩 Ordina Frase</div>
                        <div class="teacher-chip ${cType === 'error_correction' ? 'active' : ''}" data-type="error_correction">✏️ Correzione</div>
                        <div class="teacher-chip ${cType === 'speed' ? 'active' : ''}" data-type="speed">⚡ Velocità</div>
                        <div class="teacher-chip ${cType === 'dettato' ? 'active' : ''}" data-type="dettato">🎧 Dettato</div>
                        <div class="teacher-chip ${cType === 'pronuncia' ? 'active' : ''}" data-type="pronuncia">🎤 Pronuncia</div>
                    </nav>
                    <div class="teacher-form">
                        <div style="margin-bottom: 3rem;">
                            <label class="teacher-label">Titolo della Lezione</label>
                            <input type="text" id="task-title" class="teacher-input" placeholder="Esempio: Una serata a Roma...">
                        </div>
                        
                        ${renderTatoebaPanel()}

                        <div id="dynamic-content"></div>

                        ${students.length > 1 ? `
                        <div style="margin-top: 2.5rem;">
                            <label class="teacher-label">Assegna a</label>
                            <select id="student-select" class="teacher-input" style="font-size: 1.4rem; cursor: pointer;">
                                ${students.map(s => `<option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''}>${s.name}</option>`).join('')}
                            </select>
                        </div>` : `
                        <div style="margin-top: 2.5rem; font-family: var(--font-body); font-size: 1.3rem; opacity: 0.8; color: var(--color-ink);">
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

        const dContent = main.querySelector('#dynamic-content');

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
                const row = document.createElement('div');   row.className = 'teacher-card-row';
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
            dContent.innerHTML = `
                <div style="margin-bottom: 2rem;">
                    <label class="teacher-label">Frasi da Completare</label>
                    <div id="fill-list" style="display: flex; flex-direction: column; gap: 1rem;"></div>
                    <button id="add-manual-fill" style="margin-top: 1.5rem; background: none; border: 2px dashed rgba(0,0,0,0.1); width: 100%; padding: 1.5rem; border-radius: 1.5rem; color: rgba(0,0,0,0.4); font-family: var(--font-ui); text-transform: uppercase; font-weight: 700; letter-spacing: 0.1em; cursor: pointer;">+ Aggiungi frase manuale</button>
                </div>`;
            const fList = dContent.querySelector('#fill-list');
            const renderFills = () => {
                fList.innerHTML = fillSentences.length === 0 ? '<div style="opacity: 0.3; font-style: italic; font-size: 1.3rem;">Nessuna frase. Cerca su Tatoeba o aggiungi manualmente.</div>' : '';
                fillSentences.forEach((s, idx) => {
                    const row = document.createElement('div'); row.className = 'teacher-card-row'; row.style.background = 'white'; row.style.gridTemplateColumns = '1fr auto';
                    if (s.editMode) {
                        const words = s.text.split(/(\s+)/);
                        const clickableText = words.map(w => {
                            if (!w.trim() || /^[^\wàèéìòùáéíóúñ]+$/i.test(w)) return w;
                            return `<span class="word-token" style="cursor: pointer; padding: 0.2rem 0.5rem; border-radius: 0.5rem; background: rgba(0,0,0,0.03); margin: 0 0.2rem; transition: background 0.2s;">${w}</span>`;
                        }).join('');
                        row.innerHTML = `<div><div style="font-family: var(--font-body); font-size: 1.2rem; opacity: 0.5; margin-bottom: 0.5rem;">Clicca su una parola per nasconderla:</div><div style="font-size: 1.8rem; line-height: 1.6;">${clickableText}</div></div><button class="btn-remove" style="background: none; border: none; font-size: 1.4rem; cursor: pointer; opacity: 0.25; align-self: flex-start;" data-remove="${idx}">✕</button>`;
                        row.querySelectorAll('.word-token').forEach(span => {
                            span.onclick = () => { fillSentences[idx].blank = span.textContent.trim().replace(/[^\w\sàèéìòùáéíóúñ]/ig, ''); fillSentences[idx].editMode = false; renderFills(); };
                            span.onmouseover = () => span.style.background = 'rgba(166, 77, 50, 0.1)'; span.onmouseout = () => span.style.background = 'rgba(0,0,0,0.03)';
                        });
                    } else {
                        const reg = s.blank ? new RegExp(`\\b${s.blank}\\b`, 'i') : null;
                        let highlighted = (reg && s.text.match(reg)) ? s.text.replace(reg, `<span style="color: var(--color-terracota); font-weight: bold; border-bottom: 2px solid var(--color-terracota); padding-bottom: 2px; cursor: pointer;" class="blank-word" data-idx="${idx}">${s.blank} ✏️</span>`) : s.text + ` <span class="blank-word" data-idx="${idx}" style="cursor:pointer; color: var(--color-terracota); font-weight: bold; font-size:1.2rem;">Scegli parola ✏️</span>`;
                        row.innerHTML = `<div style="font-size: 1.6rem; font-family: var(--font-body);"><div style="margin-top: ${s.source==='manual'?'1rem':0};">${s.source === 'manual' ? `<input type="text" class="teacher-input manual-input" value="${s.text}" data-idx="${idx}" placeholder="Escribe tu frase aquí..." style="width: 100%; border-bottom: 1px dashed #ccc; font-size: 1.6rem; margin-bottom: 0.8rem; background: transparent; padding: 0.5rem 0;">` : ''}${highlighted}</div></div><button class="btn-remove" style="background: none; border: none; font-size: 1.4rem; cursor: pointer; opacity: 0.25; align-self: flex-start;" data-remove="${idx}">✕</button>`;
                        const manualInp = row.querySelector('.manual-input'); if (manualInp) manualInp.onchange = (e) => { fillSentences[idx].text = e.target.value; renderFills(); };
                        const bw = row.querySelector('.blank-word'); if (bw) bw.onclick = () => { fillSentences[idx].editMode = true; renderFills(); };
                    }
                    fList.appendChild(row);
                });
                fList.querySelectorAll('.btn-remove').forEach(b => b.onclick = (e) => { fillSentences.splice(e.target.closest('[data-remove]').dataset.remove, 1); renderFills(); });
            };
            renderFills();
            dContent.querySelector('#add-manual-fill').onclick = () => { fillSentences.push({ id: Date.now(), text: '', blank: '', source: 'manual', tatoebaId: null, editMode: false }); renderFills(); };
        } else if (cType === 'translation') {
            dContent.innerHTML = `<div style="margin-bottom: 2rem;">
                    <label class="teacher-label">Direzione</label>
                    <select id="trans-dir" class="teacher-input" style="font-size: 1.4rem; margin-bottom: 2rem;">
                        <option value="it-es" ${transDir === 'it-es' ? 'selected' : ''}>🇮🇹 Italiano → 🇦🇷 Español</option>
                        <option value="es-it" ${transDir === 'es-it' ? 'selected' : ''}>🇦🇷 Español → 🇮🇹 Italiano</option>
                    </select>
                    <label class="teacher-label">Traduzioni</label>
                    <div id="trans-list" style="display: flex; flex-direction: column; gap: 1rem;"></div>
                    <button id="add-manual-trans" style="margin-top: 1.5rem; background: none; border: 2px dashed rgba(0,0,0,0.1); width: 100%; padding: 1.5rem; border-radius: 1.5rem; color: rgba(0,0,0,0.4); font-family: var(--font-ui); text-transform: uppercase; font-weight: 700; letter-spacing: 0.1em; cursor: pointer;">+ Agregar par manual</button>
                </div>`;
            const tList = dContent.querySelector('#trans-list');
            const renderTransList = () => {
                tList.innerHTML = transPairs.length === 0 ? '<div style="opacity: 0.3; font-style: italic; font-size: 1.3rem;">Ningún par. Cerca en Tatoeba o agregá manualmente.</div>' : '';
                transPairs.forEach((pair, idx) => {
                    const row = document.createElement('div'); row.className = 'teacher-card-row'; row.style.background = 'white'; row.style.gridTemplateColumns = '1fr auto';
                    row.innerHTML = `<div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 1.5rem; font-family: var(--font-body);">
                             <div style="display: flex; align-items: center; gap: 0.5rem;"><span>🇮🇹</span>
                                ${pair.source === 'manual' ? `<input type="text" class="teacher-input" value="${pair.it}" data-idx="${idx}" data-field="it" placeholder="Italiano" style="flex:1; padding: 0.5rem; font-size:1.5rem; background:transparent;">` : `<span style="flex:1;">${pair.it}</span>`}</div>
                             <div style="display: flex; align-items: center; gap: 0.5rem; opacity: 0.6;"><span>🇦🇷</span>
                                ${pair.source === 'manual' ? `<input type="text" class="teacher-input" value="${pair.es}" data-idx="${idx}" data-field="es" placeholder="Español" style="flex:1; padding: 0.5rem; font-size:1.4rem; background:transparent;">` : `<span style="flex:1;">${pair.es}</span>`}</div></div>
                        <button class="btn-remove" style="background: none; border: none; font-size: 1.4rem; cursor: pointer; opacity: 0.25; align-self: flex-start;" data-remove="${idx}">✕</button>`;
                    tList.appendChild(row);
                });
                tList.querySelectorAll('.teacher-input').forEach(i => i.onchange = (e) => transPairs[e.target.dataset.idx][e.target.dataset.field] = e.target.value);
                tList.querySelectorAll('.btn-remove').forEach(b => b.onclick = (e) => { transPairs.splice(e.target.closest('[data-remove]').dataset.remove, 1); renderTransList(); });
            };
            renderTransList();
            dContent.querySelector('#add-manual-trans').onclick = () => { transPairs.push({ id: Date.now(), it: '', es: '', source: 'manual', tatoebaId: null }); renderTransList(); };
            dContent.querySelector('#trans-dir').onchange = (e) => { transDir = e.target.value; };
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
                    const row = document.createElement('div'); row.className = 'animate-in'; row.style.background = 'white'; row.style.padding = '2rem'; row.style.borderRadius = '1.5rem'; row.style.border = '1px solid rgba(0,0,0,0.03)';
                    row.innerHTML = `<div style="font-family: var(--font-ui); font-size: 0.75rem; font-weight: 950; opacity: 0.4; margin-bottom: 1.5rem; text-transform: uppercase;">Spazio #${idx + 1}</div><div style="display: flex; gap: 1.5rem; flex-wrap: wrap;"><input type="text" class="teacher-input" placeholder="Opzioni (separa con ,)" style="flex: 1; font-size: 1.3rem;" value="${fc.options.join(',')}"><select class="teacher-input" style="width: 25rem; font-size: 1.3rem;"><option value="">Scegli Corretta...</option>${fc.options.map(opt => `<option value="${opt}" ${opt === fc.correct ? 'selected' : ''}>${opt}</option>`).join('')}</select></div>`;
                    const input = row.querySelector('input'); const select = row.querySelector('select');
                    input.onchange = (e) => { const opts = e.target.value.split(',').map(s => s.trim()).filter(s => s); fillChoices[idx].options = opts; const curr = fillChoices[idx].correct; select.innerHTML = '<option value="">Scegli Corretta...</option>' + opts.map(opt => `<option value="${opt}" ${opt === curr ? 'selected' : ''}>${opt}</option>`).join(''); };
                    select.onchange = (e) => { fillChoices[idx].correct = e.target.value; };
                    fcList.appendChild(row);
                });
            };
            const syncGaps = () => {
                const text = textarea.value;
                const gapCount = (text.match(/___/g) || []).length;
                if (fillChoices.length < gapCount) for (let i = fillChoices.length; i < gapCount; i++) fillChoices.push({ options: [], correct: '' });
                else if (fillChoices.length > gapCount) fillChoices = fillChoices.slice(0, gapCount);
                renderGapConfig();
            };
            textarea.oninput = (e) => { fcText = e.target.value; syncGaps(); };
            syncGaps();
        } else if (cType === 'order_sentence') {
            dContent.innerHTML = `<label class="teacher-label">Frase Corretta</label><textarea id="os-text" class="teacher-textarea" placeholder="Inserisci la frase esatta (es. Io sono andato al mercato ieri.)"></textarea><div style="font-family: var(--font-body); font-size: 1.1rem; opacity: 0.5; margin-top: 1rem;">Il sistema dividerà e mescolerà le parole automaticamente.</div>`;
        } else if (cType === 'translation_choice') {
            dContent.innerHTML = `<div style="margin-bottom: 2.5rem;"><label class="teacher-label">Frase da Tradurre (Spagnolo)</label><textarea id="tc-question" class="teacher-textarea" style="min-height: 8rem;" placeholder="Es: Fui al mercado ayer"></textarea></div><label class="teacher-label">Opzioni di Risposta (Italiano)</label><div id="tc-options-list" style="display: flex; flex-direction: column; gap: 1.4rem; margin-bottom: 1.5rem;">${tcOptions.map((opt, i) => `<div style="display: flex; gap: 1rem; align-items: center;"><input type="radio" name="tc-correct" id="tc-r-${i}" value="${i}" ${tcCorrect === String(i) ? 'checked' : ''} style="width: 1.8rem; height: 1.8rem; accent-color: var(--color-bordo); flex-shrink: 0;"><input type="text" class="teacher-input tc-opt-input" data-idx="${i}" placeholder="Opzione ${i+1}" value="${opt.text}" style="flex: 1; font-size: 1.4rem;">${tcOptions.length > 2 ? `<button data-remove-tc="${i}" style="background:none; border:none; font-size:1.4rem; opacity:0.3; cursor:pointer;">✕</button>` : ''}</div>`).join('')}</div><button id="tc-add-opt" style="background: none; border: 2px dashed var(--color-terracota); color: var(--color-terracota); font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.1em; padding: 1rem 2rem; border-radius: 1.2rem; cursor: pointer; opacity: 0.6;">+ Aggiungi Opzione</button>`;
            dContent.querySelectorAll('.tc-opt-input').forEach(inp => inp.oninput = (e) => { tcOptions[parseInt(e.target.dataset.idx)].text = e.target.value; });
            dContent.querySelectorAll('[name="tc-correct"]').forEach(r => r.onchange = (e) => { tcCorrect = e.target.value; });
            dContent.querySelectorAll('[data-remove-tc]').forEach(b => b.onclick = () => { tcOptions.splice(parseInt(b.dataset.removeTc), 1); if (parseInt(tcCorrect) >= tcOptions.length) tcCorrect = '0'; render(); });
            dContent.querySelector('#tc-add-opt').onclick = () => { tcOptions.push({ text: '' }); render(); };
        } else if (cType === 'error_correction') {
            dContent.innerHTML = `<div style="margin-bottom: 2.5rem;"><label class="teacher-label">Frase Scorretta</label><textarea id="ec-incorrect" class="teacher-textarea" style="min-height: 8rem; color: #dc2626;" placeholder="Es: Io andare al mercato ieri"></textarea></div><div><label class="teacher-label">Frase Corretta (soluzione)</label><textarea id="ec-correct" class="teacher-textarea" style="min-height: 8rem; color: #16a34a;" placeholder="Es: Io sono andato al mercato ieri"></textarea></div>`;
        } else if (cType === 'speed') {
            dContent.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;"><span class="teacher-label" style="margin: 0;">Palabras Veloces (Mín: 8, Máx: 15)</span><button id="add-speed" style="width: 3.6rem; height: 3.6rem; border-radius: 50%; border: 2px dashed var(--color-terracota); background: none; color: var(--color-terracota); font-size: 1.6rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button></div><div style="margin-bottom: 2rem;"><label class="teacher-label">Direzione</label><select id="speed-dir" class="teacher-input" style="font-size: 1.4rem;"><option value="it-es" ${speedDir === 'it-es' ? 'selected' : ''}>Italiano → Español</option><option value="es-it" ${speedDir === 'es-it' ? 'selected' : ''}>Español → Italiano</option></select></div><div id="speed-list" style="display: flex; flex-direction: column; gap: 1rem;"></div>`;
            const sList = dContent.querySelector('#speed-list');
            const renderSpeedList = () => {
                sList.innerHTML = '';
                speedPairs.forEach((word, idx) => {
                    const row = document.createElement('div'); row.className = 'teacher-card-row'; row.style.gridTemplateColumns = '1fr 1fr auto';
                    row.innerHTML = `<input type="text" class="teacher-input" placeholder="Italiano" value="${word.it}" data-idx="${idx}" data-field="it" style="font-size: 1.4rem;"><input type="text" class="teacher-input" placeholder="Español" value="${word.es}" data-idx="${idx}" data-field="es" style="font-size: 1.4rem;"><button class="btn-remove" style="background: none; border: none; font-size: 1.4rem; cursor: pointer; opacity: 0.25;" data-remove="${idx}">✕</button>`;
                    sList.appendChild(row);
                });
                sList.querySelectorAll('.teacher-input').forEach(i => i.onchange = (e) => speedPairs[e.target.dataset.idx][e.target.dataset.field] = e.target.value);
                sList.querySelectorAll('.btn-remove').forEach(b => b.onclick = (e) => { speedPairs.splice(e.target.closest('[data-remove]').dataset.remove, 1); renderSpeedList(); });
            };
            dContent.querySelector('#add-speed').onclick = () => { if (speedPairs.length < 15) { speedPairs.push({ it: '', es: '', source: 'manual', tatoebaId: null }); renderSpeedList(); } else toast.show("Massimo 15 parole", "error"); };
            dContent.querySelector('#speed-dir').onchange = (e) => { speedDir = e.target.value; };
            renderSpeedList();
        } else if (cType === 'dettato') {
            dContent.innerHTML = `<div id="dettato-mode-bar" style="margin-bottom:2rem; display:flex; gap:1.5rem;">
                <button id="dmode-comprensione" class="teacher-chip ${dettatoMode === 'comprensione'?'active':''}" style="margin:0; cursor:pointer;">${dettatoMode==='comprensione'?'●':'○'} Comprensione</button>
                <button id="dmode-domande" class="teacher-chip ${dettatoMode === 'domande'?'active':''}" style="margin:0; cursor:pointer;">${dettatoMode==='domande'?'●':'○'} Domande</button>
            </div>
            <div id="recorder-mount" style="margin-bottom:3rem;"></div>
            <div id="dettato-subconfig"></div>`;

            const rMount = dContent.querySelector('#recorder-mount');
            rMount.appendChild(AudioRecorder((blob) => { audioBlob = blob; }, 180, true));

            const sub = dContent.querySelector('#dettato-subconfig');
            const renderDettatoSub = () => {
                // Refresh chips manually to avoid destroying recorder
                dContent.querySelector('#dmode-comprensione').className = `teacher-chip ${dettatoMode === 'comprensione' ? 'active' : ''}`;
                dContent.querySelector('#dmode-comprensione').textContent = `${dettatoMode==='comprensione'?'●':'○'} Comprensione`;
                dContent.querySelector('#dmode-domande').className = `teacher-chip ${dettatoMode === 'domande' ? 'active' : ''}`;
                dContent.querySelector('#dmode-domande').textContent = `${dettatoMode==='domande'?'●':'○'} Domande`;

                if (dettatoMode === 'comprensione') {
                    sub.innerHTML = `<label class="teacher-label">Texto de referencia (solo visible al corregir)</label><textarea id="dettato-ref" class="teacher-textarea" placeholder="Vorrei un caffè macchiato, per favore."></textarea>`;
                    const tRef = sub.querySelector('#dettato-ref');
                    if (tRef && taskRefText) tRef.value = taskRefText;
                    tRef.oninput = (e) => taskRefText = e.target.value;
                } else {
                    const renderQList = () => {
                        sub.innerHTML = `<label class="teacher-label">Preguntas (que responderá Luci después de escuchar)</label><div id="d-qs" style="display:flex; flex-direction:column; gap:1.5rem;"></div><button id="add-q" style="margin-top:2rem; padding:1rem 2rem; border-radius:1.5rem; background:none; border:2px dashed rgba(0,0,0,0.1); cursor:pointer;">+ Agregar domanda</button>`;
                        const qList = sub.querySelector('#d-qs');
                        dettatoQuestions.forEach((q, idx) => {
                            const row = document.createElement('div');
                            row.style.cssText = 'display:flex; gap:1rem;';
                            row.innerHTML = `<input type="text" class="teacher-input d-q-i" data-idx="${idx}" placeholder="Ej: ¿De qué está hablando el audio?" style="flex:1;"><button class="d-q-r" data-idx="${idx}" style="background:none; border:none; opacity:0.3; cursor:pointer; font-size:1.4rem;">✕</button>`;
                            const qi = row.querySelector('.d-q-i');
                            qi.value = q;
                            qi.oninput = (e) => { dettatoQuestions[e.target.dataset.idx] = e.target.value; };
                            row.querySelector('.d-q-r').onclick = () => { dettatoQuestions.splice(idx, 1); renderQList(); };
                            qList.appendChild(row);
                        });
                        sub.querySelector('#add-q').onclick = () => { if (dettatoQuestions.length < 5) { dettatoQuestions.push(''); renderQList(); } };
                    };
                    renderQList();
                }
            };
            dContent.querySelector('#dmode-comprensione').onclick = (e) => { e.preventDefault(); dettatoMode = 'comprensione'; renderDettatoSub(); };
            dContent.querySelector('#dmode-domande').onclick = (e) => { e.preventDefault(); dettatoMode = 'domande'; renderDettatoSub(); };
            renderDettatoSub();
        } else if (cType === 'pronuncia') {
            dContent.innerHTML = `<div id="pronuncia-mode-bar" style="margin-bottom:2rem; display:flex; gap:1.5rem;">
                <button id="pmode-lettura" class="teacher-chip ${pronunciaMode === 'lettura'?'active':''}" style="margin:0; cursor:pointer;">${pronunciaMode==='lettura'?'●':'○'} Lettura</button>
                <button id="pmode-ripetizione" class="teacher-chip ${pronunciaMode === 'ripetizione'?'active':''}" style="margin:0; cursor:pointer;">${pronunciaMode==='ripetizione'?'●':'○'} Ripetizione</button>
                <button id="pmode-parlato" class="teacher-chip ${pronunciaMode === 'parlato_libero'?'active':''}" style="margin:0; cursor:pointer;">${pronunciaMode==='parlato_libero'?'●':'○'} Parlato libero</button>
            </div>
            <div id="pronuncia-subconfig"></div>`;

            const pSub = dContent.querySelector('#pronuncia-subconfig');
            const renderPronunciaSub = () => {
                dContent.querySelector('#pmode-lettura').className = `teacher-chip ${pronunciaMode === 'lettura' ? 'active' : ''}`;
                dContent.querySelector('#pmode-lettura').textContent = `${pronunciaMode==='lettura'?'●':'○'} Lettura`;
                dContent.querySelector('#pmode-ripetizione').className = `teacher-chip ${pronunciaMode === 'ripetizione' ? 'active' : ''}`;
                dContent.querySelector('#pmode-ripetizione').textContent = `${pronunciaMode==='ripetizione'?'●':'○'} Ripetizione`;
                dContent.querySelector('#pmode-parlato').className = `teacher-chip ${pronunciaMode === 'parlato_libero' ? 'active' : ''}`;
                dContent.querySelector('#pmode-parlato').textContent = `${pronunciaMode==='parlato_libero'?'●':'○'} Parlato libero`;

                if (pronunciaMode === 'lettura') {
                    pSub.innerHTML = `<label class="teacher-label">Scrivi il testo da leggere</label><textarea id="pn-ref" class="teacher-textarea" placeholder="Vorrei un caffè..."></textarea>
                    <label class="teacher-label" style="margin-top:2rem;">Nota di pronuncia (opzionale)</label><input type="text" id="pn-note" class="teacher-input" placeholder="Prestá atención a la doble T in caffè">`;
                } else if (pronunciaMode === 'ripetizione') {
                    pSub.innerHTML = `<div id="rec-p-mount" style="margin-bottom:3rem;"></div>
                    <label class="teacher-label">Testo di riferimento (guida visiva per Luci)</label><textarea id="pn-ref" class="teacher-textarea" placeholder=""></textarea>`;
                    pSub.querySelector('#rec-p-mount').appendChild(AudioRecorder((blob) => { audioBlob = blob; }, 180, true));
                } else if (pronunciaMode === 'parlato_libero') {
                    pSub.innerHTML = `<label class="teacher-label">Consigna (en español)</label><textarea id="pn-ref" class="teacher-textarea" placeholder="Contame qué hiciste ayer usando el passato prossimo."></textarea>`;
                }
                const pnf = pSub.querySelector('#pn-ref'); if (pnf) { pnf.value = taskRefText; pnf.oninput = (e) => taskRefText = e.target.value; }
            };
            dContent.querySelector('#pmode-lettura').onclick = (e) => { e.preventDefault(); pronunciaMode = 'lettura'; renderPronunciaSub(); };
            dContent.querySelector('#pmode-ripetizione').onclick = (e) => { e.preventDefault(); pronunciaMode = 'ripetizione'; renderPronunciaSub(); };
            dContent.querySelector('#pmode-parlato').onclick = (e) => { e.preventDefault(); pronunciaMode = 'parlato_libero'; renderPronunciaSub(); };
            renderPronunciaSub();
        }

        // Student selector wire (again, as main is new)
        const studentSelect = main.querySelector('#student-select');
        if (studentSelect) {
            studentSelect.onchange = (e) => {
                selectedStudentId = e.target.value;
                studentName = students.find(s => s.id === selectedStudentId)?.name || studentName;
                const head = main.querySelector('.teacher-tasks-header'); if (head) head.textContent = `Cammino di ${studentName}`;
            };
        }

        // Wired event for Tatoeba search
        const btnSearch = main.querySelector('#tatoeba-search-btn');
        if (btnSearch) btnSearch.onclick = handleTatoebaSearch;

        // Tatoeba ADD btn logic
        main.querySelectorAll('.tatoeba-add-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = e.target.dataset.idx; const r = tatoebaResults[idx];
                r.added = true;
                if (cType === 'fill') {
                    const blank = getLongestWord(r.italiano);
                    fillSentences.push({ id: r.id, text: r.italiano, blank, source: 'tatoeba', tatoebaId: r.id, editMode: false });
                } else if (cType === 'translation') {
                    transPairs.push({ id: r.id, it: r.italiano, es: r.español, source: 'tatoeba', tatoebaId: r.id });
                } else if (cType === 'speed') {
                    if (speedPairs.length >= 15) { toast.show("Max 15 words", "error"); return; }
                    speedPairs.push({ it: getLongestWord(r.italiano), es: getLongestWord(r.español), source: 'tatoeba', tatoebaId: r.id });
                }
                render();
            };
        });

        // Task List Rendering
        const taskListDiv = main.querySelector('#tasks-list');
        if (isLoading) taskListDiv.appendChild(LoadingSkeleton(5));
        else {
            const groupTasksByDate = (taskList) => {
                const groups = {};
                taskList.forEach(t => {
                    const d = new Date(t.created_at);
                    const today = new Date();
                    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
                    
                    let label = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
                    if (d.toDateString() === today.toDateString()) label = "Oggi";
                    else if (d.toDateString() === yesterday.toDateString()) label = "Ieri";
                    
                    if (!groups[label]) groups[label] = [];
                    groups[label].push(t);
                });
                return groups;
            };

            const groups = groupTasksByDate(tasks);
            Object.keys(groups).forEach((dateLabel, gIdx) => {
                const dateHeader = document.createElement('div');
                dateHeader.className = 'task-list-date-group';
                dateHeader.style = 'margin: 4rem 0 2rem; display: flex; align-items: center; gap: 1.5rem;';
                dateHeader.innerHTML = `
                    <span style="font-family: var(--font-ui); font-size: 1.1rem; font-weight: 950; color: var(--color-terracota); text-transform: uppercase; letter-spacing: 0.15em; white-space: nowrap; opacity: 1;">${dateLabel}</span>
                    <div style="flex: 1; height: 1px; background: linear-gradient(to right, rgba(166, 77, 50, 0.25), transparent);"></div>
                `;
                taskListDiv.appendChild(dateHeader);

                groups[dateLabel].forEach((task, index) => {
                    const card = document.createElement('div');
                    card.className = 'teacher-task-card';
                    card.style.animationDelay = `${(gIdx * 3 + index) * 0.05}s`;
                    let sColor = 'var(--color-terracota)', bColor = 'white', sText = 'In sospeso', showDot = false;
                    const lowerType = task.type?.toLowerCase();
                    if (task.computedStatus === 'TO REVIEW') { sText = 'DA CORREGGERE ✒️'; sColor = 'white'; bColor = 'var(--color-terracota)'; showDot = true; }
                    else if (task.computedStatus === 'COMPLETED') { sText = 'COMPLETATO ✓'; sColor = '#065f46'; bColor = '#ecfdf5'; }
                    
                    card.innerHTML = `
                        <div style="flex:1; display:flex; align-items:center; gap:2.5rem;">
                            ${showDot ? '<div class="notif-dot"></div>' : '<div style="width:0.9rem;"></div>'}
                            <div>
                                <div style="display:flex; gap:1.2rem; align-items:center; margin-bottom:0.8rem;">
                                    <span style="font-family:var(--font-ui); font-size:1.15rem; font-weight:950; opacity:0.65; letter-spacing:0.15em; text-transform:uppercase; color:var(--color-ink);">${TYPE_TRANSLATIONS[lowerType] || task.type}</span>
                                    <span style="background:${bColor}; color:${sColor}; padding:0.4rem 1.4rem; border-radius:0.8rem; font-family:var(--font-ui); font-size:1.1rem; font-weight:950; text-transform:uppercase; letter-spacing:0.08em; border:1px solid rgba(0,0,0,0.05);">${sText}</span>
                                </div>
                                <h5 style="font-family:var(--font-titles); font-size:1.6rem; margin:0; color:var(--color-ink); font-weight:500;">${task.title}</h5>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:2rem; opacity:0.7;" class="task-actions">
                            <div style="font-size:1.25rem; font-family:var(--font-ui); font-weight:900; color:var(--color-ink);">${new Date(task.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
                            ${task.computedStatus === 'PENDING' ? `<button class="btn-edit-task" style="font-size:1.4rem; cursor:pointer; border:none;">✏️</button>` : ''}
                            <button class="btn-delete-task" style="font-size:1.4rem; cursor:pointer; border:none;">🗑️</button>
                        </div>
                    `;
                    
                    card.onclick = () => navigate(`/task/${task.id}`);
                    const btnD = card.querySelector('.btn-delete-task'); 
                    if (btnD) btnD.onclick = (e) => { e.stopPropagation(); confirmModal.show("Vuoi eliminare?", `Sei sicuro di voler eliminare "${task.title}"?`, task.id); };
                    const btnE = card.querySelector('.btn-edit-task'); 
                    if (btnE) btnE.onclick = (e) => {
                        e.stopPropagation(); editTaskId = task.id; const lType = task.type?.toLowerCase();
                        if (lType.includes('role')) cType = 'roleplay'; else if (lType.includes('flash') || lType.includes('lessico')) cType = 'flashcard'; else if (lType === 'fill_choice') cType = 'fill_choice'; else if (lType === 'order_sentence') cType = 'order_sentence'; else if (lType === 'translation_choice') cType = 'translation_choice'; else if (lType === 'error_correction') cType = 'error_correction'; else if (lType === 'translation') cType = 'translation'; else if (lType === 'speed') cType = 'speed'; else if (lType === 'dettato') cType = 'dettato'; else if (lType === 'pronuncia') cType = 'pronuncia'; else cType = 'fill';
                        
                        if (cType === 'flashcard') flashcards = task.content?.items || [];
                        else if (cType === 'fill_choice') { fillChoices = task.content?.gaps || []; fcText = task.content?.text || ""; }
                        else if (cType === 'translation_choice') { const opts = task.content?.options || []; tcOptions = opts.map(t => ({ text: t })); const cor = opts.indexOf(task.content?.correct); tcCorrect = cor !== -1 ? String(cor) : ''; }
                        else if (cType === 'fill') fillSentences = task.content?.sentences || [{ id: Date.now(), text: task.content?.text || '', blank: '', source: 'manual', editMode: true }];
                        else if (cType === 'translation') { transPairs = task.content?.pairs || []; transDir = task.content?.direction || 'it-es'; }
                        else if (cType === 'speed') { speedPairs = task.content?.words || []; speedDir = task.content?.direction || 'it-es'; }
                        else if (cType === 'dettato') { dettatoMode = task.content?.mode || 'comprensione'; dettatoQuestions = task.content?.questions || ['']; taskRefText = task.content?.refText || ''; audioUrl = task.content?.audio_url || null; }
                        else if (cType === 'pronuncia') { pronunciaMode = task.content?.mode || 'lettura'; taskRefText = task.content?.refText || ''; audioUrl = task.content?.audio_url || null; }
                        
                        render();
                        setTimeout(() => {
                            const tInp = container.querySelector('#task-title'); if (tInp) tInp.value = task.title;
                            const rD = container.querySelector('#rp-desc'); if (cType === 'roleplay' && rD) rD.value = task.content?.description || '';
                            const ft = container.querySelector('#fill-text'); if (cType === 'fill' && ft) ft.value = task.content?.text || '';
                            const os = container.querySelector('#os-text'); if (cType === 'order_sentence' && os) os.value = task.content?.original || '';
                            const tcQ = container.querySelector('#tc-question'); if (cType === 'translation_choice' && tcQ) tcQ.value = task.content?.question || '';
                            const ecI = container.querySelector('#ec-incorrect'); const ecC = container.querySelector('#ec-correct'); if (cType === 'error_correction' && ecI && ecC) { ecI.value = task.content?.incorrect || ''; ecC.value = task.content?.correct || ''; }
                            const dRef = container.querySelector('#dettato-ref'); if (dRef) dRef.value = taskRefText;
                            const pRef = container.querySelector('#pn-ref'); if (pRef) pRef.value = taskRefText;
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }, 50);
                    };
                    taskListDiv.appendChild(card);
                });
            });
        }

        main.querySelectorAll('.teacher-chips .teacher-chip').forEach(chip => chip.onclick = (e) => { cType = e.currentTarget.dataset.type; render(); });
        main.querySelector('#btn-assign').onclick = handleCreateTask;
        sidebar.querySelector('#btn-nav-students').onclick = () => navigate('/student/stats');
        sidebar.querySelector('#btn-logout').onclick = async () => { await signOut(); localStorage.removeItem('luci_user'); navigate('/login'); };
        sidebar.querySelector('#btn-settings').onclick = () => pModal.open(user);

        container.appendChild(sidebar);
        container.appendChild(main);

        // Event Listeners for Notifications
        const bell = main.querySelector('#notif-bell');
        const dropdown = main.querySelector('#notif-dropdown');
        if (bell && dropdown) {
            bell.onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            };
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#notif-dropdown') && !e.target.closest('#notif-bell')) {
                    dropdown.classList.remove('active');
                }
            });
        }

        const clearBtn = main.querySelector('#clear-all');
        if (clearBtn) {
            clearBtn.onclick = async (e) => {
                e.stopPropagation();
                const { success } = await clearAllNotifications(user.id);
                if (success) {
                    notifications = [];
                    renderNotifications();
                }
            };
        }

        // Subscriptions
        cleanupOldNotifications();
        loadNotifications();
        const sub = subscribeToNotifications(user.id, () => {
            loadNotifications();
        });

        if (!document.body.contains(modal.overlay)) document.body.appendChild(modal.overlay);
        if (!document.body.contains(pModal.overlay)) document.body.appendChild(pModal.overlay);
    };

    refresh();
    return container;
};
