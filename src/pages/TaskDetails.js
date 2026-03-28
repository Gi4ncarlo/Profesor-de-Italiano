import { getTaskById } from '../services/tasks';
import { getSubmissionsByTask } from '../services/submissions';
import { addFeedback } from '../services/feedback';
import { LoadingSkeleton } from '../components/Loading';
import { toast } from '../components/Toast';

const TYPE_TRANSLATIONS = {
    'fill': 'Completare',
    'roleplay': 'Conversazione',
    'flashcards': 'Lessico',
    'flashcard': 'Lessico',
    'order_sentence': 'Ordina Frase',
    'translation_choice': 'Traduzione',
    'error_correction': 'Correzione'
};

/**
 * TASK DETAILS PAGE - "IL REGISTRO DELL'ATELIER"
 */
export const TaskDetailsPage = (navigate, user, params) => {
    const container = document.createElement('div');
    container.className = 'details-root';
    
    const taskId = params.id;
    let task = null;
    let submissions = [];
    let isLoading = true;

    // LOCAL STYLE DEFINITIONS
    const styles = document.createElement('style');
    styles.innerHTML = `
        .details-root { min-height: 100vh; background-color: var(--color-parchment); display: flex; flex-direction: column; }
        .details-nav { padding: 1.5rem 5rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid rgba(0,0,0,0.03); background: white; }
        .btn-back { display: flex; align-items: center; gap: 0.8rem; background: none; border: none; font-family: var(--font-ui); font-size: 0.85rem; font-weight: 850; text-transform: uppercase; letter-spacing: 0.12em; cursor: pointer; color: var(--color-ink); opacity: 0.5; transition: opacity 0.3s; }
        .btn-back:hover { opacity: 1; }
        
        .details-main { padding: 5rem 6.5rem; max-width: 140rem; margin: 0 auto; width: 100%; flex: 1; display: grid; grid-template-columns: 1.6fr 1fr; gap: 6rem; align-items: start; }
        
        .task-info-hero { background: white; border-radius: 30px; padding: 4rem; box-shadow: var(--shadow-premium); border: 1px solid rgba(0,0,0,0.01); margin-bottom: 3.5rem; position: sticky; top: 1.5rem; }
        .history-title { font-family: var(--font-titles); font-size: 2.8rem; margin-bottom: 3rem; border-bottom: 1.5px solid rgba(0,0,0,0.05); padding-bottom: 1.5rem; color: var(--color-ink); }

        .submission-card { background: white; border-radius: 30px; padding: 4rem; box-shadow: var(--shadow-card); margin-bottom: 3rem; border: 1.5px solid rgba(0,0,0,0.01); transition: all 0.4s; }
        .submission-card:hover { transform: translateY(-4px); box-shadow: 0 15px 45px rgba(0,0,0,0.04); }
        
        .response-box { background: #fdfaf4; border-radius: 20px; padding: 3rem; border: 1px solid rgba(166, 77, 50, 0.04); margin-bottom: 2.5rem; position: relative; }
        
        .task-fragment { color: var(--color-ink); opacity: 0.75; font-family: var(--font-body); font-size: 1.5rem; line-height: 2; }
        .student-val { color: #1d4ed8; font-family: var(--font-handwritten); font-size: 2rem; font-weight: 900; padding: 0 0.8rem; border-bottom: 2.5px solid rgba(29, 78, 216, 0.15); }

        .bubble-g { background: white; border: 1.5px solid rgba(0,0,0,0.04); padding: 1.2rem 2.2rem; border-radius: 12px 12px 12px 4px; margin-bottom: 1rem; font-family: var(--font-body); font-size: 1.3rem; align-self: flex-start; max-width: 85%; line-height: 1.5; }
        .bubble-l { background: #eff6ff; border: 2px solid rgba(29, 78, 216, 0.08); padding: 2rem 2.8rem; border-radius: 20px 20px 4px 20px; margin-bottom: 2rem; font-family: var(--font-handwritten); font-size: 1.8rem; color: #1d4ed8; align-self: flex-end; width: 92%; line-height: 1.4; box-shadow: 0 10px 30px rgba(29, 78, 216, 0.03); }

        .feedback-note { background: #fdf6e3; border-radius: 10px; padding: 3rem; border-left: 6px solid var(--color-terracota); margin-top: 3rem; position: relative; transform: rotate(-0.5deg); box-shadow: 0 10px 30px rgba(0,0,0,0.03); }
        .feedback-note::after { content: 'MAESTRO'; position: absolute; bottom: 0.8rem; right: 1.2rem; font-family: var(--font-ui); font-size: 0.6rem; font-weight: 950; text-transform: uppercase; opacity: 0.2; letter-spacing: 0.2em; }
        .feedback-comment { font-family: var(--font-handwritten); font-size: 2.1rem; color: #3e1b1b; line-height: 1.3; font-style: italic; }

        .btn-feedback { background: var(--color-ink); color: white; border: none; border-radius: 50px; padding: 1.4rem 4rem; font-family: var(--font-ui); font-size: 0.9rem; font-weight: 850; text-transform: uppercase; letter-spacing: 0.15em; cursor: pointer; transition: all 0.4s; }
        .btn-feedback:hover { background: var(--color-terracota); transform: translateY(-3px); box-shadow: 0 15px 35px rgba(166, 77, 50, 0.3); }
        
        .ui-label { font-family: var(--font-ui); font-size: 0.8rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.25em; opacity: 0.4; margin-bottom: 1.2rem; display: block; }
    `;
    document.head.appendChild(styles);

    const loadData = async () => {
        try {
            const [tRes, sRes] = await Promise.all([
                getTaskById(taskId),
                getSubmissionsByTask(taskId)
            ]);
            if (tRes.error) throw tRes.error;
            if (sRes.error) throw sRes.error;
            task = tRes.data;
            submissions = sRes.data;
        } catch (err) {
            console.error(err);
            toast.show("Errore di rete.", "error");
        } finally {
            isLoading = false;
            render();
        }
    };

    const handleFeedbackSave = async (subId, comment) => {
        if (!comment.trim()) return toast.show("Manca il commento.", "error");
        try {
            const { error } = await addFeedback({ submissionId: subId, comment: comment });
            if (error) throw error;
            toast.show("Sigillo inviato. ✨");
            await loadData(); 
        } catch (err) {
            console.error(err);
            toast.show("Errore nel sigillo.", "error");
        }
    };

    const renderSubmissionContent = (sub) => {
        const type = task.type?.toLowerCase();
        // Fallback flexible: si sub.answers es string lo usa, si es objeto busca .data, si no []
        const rawAnswers = sub.answers || sub.content;
        const answers = (typeof rawAnswers === 'object' && rawAnswers !== null) 
            ? (rawAnswers.data || rawAnswers) 
            : (rawAnswers || []);
        
        // 1. FLASHCARDS (Check by property if it exists)
        const cards = task.content?.items || task.content?.cards || task.content?.flashcards || (Array.isArray(task.content?.data) ? task.content.data : []);
        if (cards.length > 0 || type?.includes('flash') || type?.includes('lessico')) {
            let h = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem;">`;
            if (cards.length === 0) {
                h += `<div style="padding: 3rem; font-family: var(--font-body); opacity: 0.5;">Caricamento carte in corso o nessun dato trovato...</div>`;
            } else {
                cards.forEach(c => {
                    const front = c.front || c.word || c.termine || "...";
                    const back = c.translation || c.back || c.traduzione || "...";
                    const example = c.example || c.esempio || "";
                    h += `
                        <div style="background: white; border: 1px solid rgba(0,0,0,0.03); border-radius: 18px; padding: 2.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.01);">
                            <div style="font-family: var(--font-titles); font-size: 1.6rem; color: var(--color-ink); margin-bottom: 0.8rem;">${front}</div>
                            <div style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 850; color: var(--color-bordo); text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6; margin-bottom: 0.4rem;">TRADUZZIONE</div>
                            <div style="font-family: var(--font-body); font-size: 1.3rem; margin-bottom: 1.5rem; color: var(--color-ink);">${back}</div>
                            ${example ? `
                                <div style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 850; color: var(--color-bordo); text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6; margin-bottom: 0.4rem;">ESEMPIO</div>
                                <div style="font-family: var(--font-handwritten); font-size: 1.5rem; color: var(--color-ink); opacity: 0.8; line-height: 1.3;">"${example}"</div>
                            ` : ''}
                        </div>
                    `;
                });
            }
            h += `</div>`;
            return h;
        }

        // 2. ROLEPLAY / CONVERSAZIONE (Check by property)
        if (type?.includes('role') || type?.includes('conversazione') || task.content?.description || task.content?.dialogue) {
            let h = `<div style="display: flex; flex-direction: column; gap: 2.5rem;">`;
            
            // Support for old dialogue format if it exists
            if (task.content?.dialogue && task.content.dialogue.length > 0) {
                task.content.dialogue.forEach((d, i) => {
                    h += `<div class="bubble-g">${d.giancarlo || d.giorgio || "..."}</div>`;
                    h += `<div class="bubble-l">${answers[i] || '...'}</div>`;
                });
            } else {
                // Support for current description-based format
                const scenario = task.content?.description || "Inizia la conversazione.";
                const studentResp = Array.isArray(answers) ? (answers[0] || '...') : (typeof answers === 'string' ? answers : JSON.stringify(answers));
                
                h += `<div>
                    <div style="font-family: var(--font-handwritten); font-size: 1.8rem; color: var(--color-ink); margin-bottom: 0.8rem; opacity: 0.8;">"Maestro dice..."</div>
                    <div class="bubble-g" style="margin: 0; max-width: 100%;">${scenario}</div>
                </div>`;
                
                h += `<div>
                    <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 850; color: var(--color-terracota); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 1rem;">LA MIA RISPOSTA...</div>
                    <div class="bubble-l" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;">${studentResp}</div>
                </div>`;
            }
            h += `</div>`;
            return h;
        }

        // 3. COMPLETAR / FILL CHOICE
        if (type?.includes('fill') || type?.includes('completare') || (task.content?.text && task.content.text.includes('___'))) {
            const segments = (task.content?.text || "").split(/___|----/);
            let h = `<div style="line-height: 2.8; display: flex; flex-wrap: wrap; align-items: baseline;">`;
            segments.forEach((p, i) => {
                h += ` <span class="task-fragment">${p}</span> `;
                if (i < segments.length - 1) {
                    h += ` <span class="student-val">${Array.isArray(answers) ? (answers[i] || '...') : '...'}</span> `;
                }
            });
            h += `</div>`;
            return h;
        }

        // 4. ORDER SENTENCE
        if (type?.includes('order') || task.content?.type === 'order_sentence') {
            const correctWords = task.content?.correctOrder || [];
            const studentWords = Array.isArray(answers) ? answers : (answers?.data || []);
            const isCorrect = JSON.stringify(studentWords) === JSON.stringify(correctWords);

            return `
                <div style="display: flex; flex-direction: column; gap: 2.5rem;">
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
                        ${studentWords.map((w, i) => `
                            <div style="
                                padding: 1.2rem 2.2rem; background: white; border-radius: 12px;
                                border: 2px solid ${w === correctWords[i] ? '#10b981' : '#ef4444'};
                                font-family: var(--font-body); font-size: 1.6rem; color: var(--color-ink);
                                box-shadow: 0 4px 10px rgba(0,0,0,0.02);
                            ">${w}</div>
                        `).join('')}
                    </div>
                    ${!isCorrect ? `
                        <div style="margin-top: 2rem; padding: 2.5rem; background: #ecfdf5; border-radius: 18px; border: 1.5px solid rgba(16, 185, 129, 0.1);">
                            <span class="ui-label" style="color: #065f46; opacity: 0.6; margin-bottom: 0.8rem;">ORDINE CORRETTO 💡</span>
                            <div class="font-editorial" style="font-size: 2rem; color: #064e3b; line-height: 1.3;">
                                "${correctWords.join(' ')}"
                            </div>
                        </div>
                    ` : `
                        <div style="font-family: var(--font-ui); font-size: 1rem; color: #10b981; font-weight: 950; letter-spacing: 0.1em; text-transform: uppercase;">
                            Perfetto, il capitolo è stato ordinato correttamente. ✨
                        </div>
                    `}
                </div>
            `;
        }

        // 5. TRANSLATION CHOICE
        if (type?.includes('translation') || task.content?.type === 'translation_choice' || task.content?.question) {
            const getCleanAns = (a) => {
                if (typeof a === 'string') return a.trim();
                if (a?.data) return getCleanAns(a.data);
                if (Array.isArray(a)) {
                    const found = a.find(x => x && (typeof x === 'string' || x.data));
                    return found ? getCleanAns(found) : "";
                }
                return "";
            };
            const correctText = task.content?.correct || "";
            const studentChoice = getCleanAns(answers);
            const isCorrect = studentChoice === correctText;

            return `
                <div style="display: flex; flex-direction: column; gap: 2rem;">
                    <div style="font-family: var(--font-ui); font-size: 0.9rem; opacity: 0.4; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: -1rem; color: var(--color-ink);">Domanda (Spagnolo)</div>
                    <div style="font-family: var(--font-body); font-size: 2rem; color: var(--color-ink); line-height: 1.4; border-left: 5px solid var(--color-terracota); padding-left: 2rem; margin-bottom: 2rem;">
                        "${task.content?.question || 'Senza testo'}"
                    </div>

                    <div style="font-family: var(--font-body); font-size: 0.9rem; opacity: 0.4; letter-spacing: 0.1em; text-transform: uppercase;">Traduzione Scelta</div>
                    <div style="display: flex; align-items: center; gap: 1.5rem; padding: 2.5rem; border-radius: 20px; background: ${isCorrect ? '#f0fdf4' : '#fff1f2'}; border: 2.5px solid ${isCorrect ? '#16a34a' : '#dc2626'};">
                        <span style="font-size: 2.4rem;">${isCorrect ? '✅' : '❌'}</span>
                        <div class="font-editorial" style="font-size: 2.22rem; color: ${isCorrect ? '#166534' : '#991b1b'};">
                            ${studentChoice ? `"${studentChoice}"` : '<span style="opacity:0.3;">Nessuna risposta rilevata</span>'}
                        </div>
                    </div>

                    ${!isCorrect && correctText ? `
                        <div style="padding: 2.5rem; background: #f0fdf4; border-radius: 18px; border: 1.5px solid rgba(22, 163, 74, 0.15); margin-top: 1rem;">
                            <span class="ui-label" style="color: #166534; opacity: 0.6; margin-bottom: 1rem;">CORRETTO 💡</span>
                            <div class="font-editorial" style="font-size: 2rem; color: #14532d;">
                                "${correctText}"
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // 6. ERROR CORRECTION
        if (type?.includes('error') || task.content?.type === 'error_correction' || task.content?.incorrect) {
            const getCleanAns = (a) => {
                if (typeof a === 'string') return a.trim();
                if (a?.data) return getCleanAns(a.data);
                if (Array.isArray(a)) {
                    const found = a.find(x => x && (typeof x === 'string' || x.data));
                    return found ? getCleanAns(found) : "";
                }
                return "";
            };
            const incorrectStr = task.content?.incorrect || '';
            const correctStr = task.content?.correct || '';
            const studentResp = getCleanAns(answers);
            const isCorrect = studentResp.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"") === correctStr.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");

            return `
                <div style="display: flex; flex-direction: column; gap: 2.5rem;">
                    <div style="padding: 2.5rem; background: #fff1f2; border-radius: 18px; border: 1.5px solid rgba(220, 38, 38, 0.1);">
                        <span class="ui-label" style="color: #991b1b; opacity: 0.6; margin-bottom: 1rem;">FRASE SCORRETTA ⚠️</span>
                        <div style="font-family: var(--font-body); font-size: 1.8rem; color: #991b1b; opacity: 0.8; text-decoration: line-through;">
                            "${incorrectStr}"
                        </div>
                    </div>

                    <div>
                        <span class="ui-label" style="color: var(--color-ink); opacity: 0.6; margin-bottom: 1.5rem;">LA MIA CORREZIONE ✒️</span>
                        <div class="font-editorial" style="padding: 3.5rem; background: ${isCorrect ? '#f0fdf4' : '#fff1f2'}; border-radius: 20px; border: 2.5px solid ${isCorrect ? '#16a34a' : '#dc2626'}; font-size: 2.22rem; color: ${isCorrect ? '#166534' : '#991b1b'}; box-shadow: 0 10px 30px rgba(0,0,0,0.02); opacity: 1;">
                            ${studentResp ? `"${studentResp}"` : '<span style="opacity:0.3;">Nessuna risposta rilevata</span>'}
                        </div>
                    </div>

                    ${!isCorrect && correctStr ? `
                        <div style="padding: 2.5rem; background: #f0fdf4; border-radius: 18px; border: 1.5px solid rgba(22, 163, 74, 0.15); margin-top: 1rem;">
                            <span class="ui-label" style="color: #166534; opacity: 0.6; margin-bottom: 1rem;">SOLUZIONE ATELIER 💡</span>
                            <div class="font-editorial" style="font-size: 2rem; color: #14532d; opacity: 1;">
                                "${correctStr}"
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        return `
            <div style="font-family: var(--font-body); font-size: 1.5rem; color: var(--color-ink); line-height: 1.6;">
                <div style="opacity: 0.4; font-family: var(--font-ui); font-size: 0.8rem; margin-bottom: 1rem; letter-spacing: 0.1em; text-transform: uppercase;">Detalle Risposta</div>
                ${typeof answers === 'object' ? JSON.stringify(answers) : `"${answers}"`}
                <div style="margin-top: 2rem; font-style: italic; opacity: 0.5;">Capitolo completato senza dettagli specifici di correzione automatica.</div>
            </div>
        `;
    };

    const render = () => {
        container.innerHTML = '';
        const nav = document.createElement('nav');
        nav.className = 'details-nav';
        nav.innerHTML = `
            <button class="btn-back" id="btn-back"><span>←</span> RITORNA</button>
            <div style="font-family: var(--font-titles); font-size: 1.8rem; font-weight: 700; letter-spacing: -0.01em;">Registro <span style="font-style: italic; color: var(--color-terracota);">Atelier</span></div>
            <div style="width: 45px; height: 45px; background: var(--color-ink); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-family: var(--font-titles);">${user.name.charAt(0)}</div>
        `;
        nav.querySelector('#btn-back').onclick = () => navigate('/dashboard');
        
        const main = document.createElement('main');
        main.className = 'details-main';

        if (isLoading) {
            console.log("Loading task details data...");
            main.appendChild(LoadingSkeleton(3));
            container.appendChild(nav);
            container.appendChild(main);
            return;
        }

        console.log("Rendering Task:", task);
        console.log("Submissions:", submissions);

        const historyCol = document.createElement('div');
        historyCol.innerHTML = `
            <h3 class="history-title">Consegne</h3>
            <div id="submissions-list">
                ${submissions.length === 0 ? `<div style="padding: 10rem; text-align: center; font-family: var(--font-handwritten); font-size: 2.5rem; opacity: 0.2;">Al calamaio...</div>` : ''}
            </div>
        `;

        const listContainer = historyCol.querySelector('#submissions-list');
        submissions.forEach(sub => {
            const subCard = document.createElement('div');
            subCard.className = 'submission-card animate-in';
            const isReviewed = sub.feedback && sub.feedback.length > 0;
            const studentName = sub.profiles?.name || "Luci"; // "Luci" better than "L" if null

            subCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 3.5rem;">
                    <div style="display: flex; gap: 1.8rem; align-items: center;">
                        <div style="width: 55px; height: 55px; border-radius: 12px; background: var(--color-crema-oscuro); display: flex; align-items: center; justify-content: center; font-family: var(--font-titles); font-size: 1.6rem; color: var(--color-terracota);">${studentName.charAt(0)}</div>
                        <div>
                            <div style="font-family: var(--font-titles); font-size: 1.8rem; color: var(--color-ink);">${studentName}</div>
                            <div style="font-family: var(--font-ui); font-size: 0.75rem; opacity: 0.3; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 850; margin-top: 0.3rem;">Entregado el: ${new Date(sub.created_at).toLocaleString('it-IT')}</div>
                        </div>
                    </div>
                </div>

                <div>
                    <span class="ui-label" style="margin-bottom: 1.5rem; color: var(--color-bordo); opacity: 0.6;">RISPOSTA DELLO STUDENTE ✨</span>
                    <div class="response-box">
                        ${renderSubmissionContent(sub)}
                    </div>
                </div>

                <div id="feedback-display-${sub.id}" style="margin-top: 3.5rem;">
                    ${isReviewed ? `
                        <span class="ui-label" style="margin-bottom: 1.5rem; color: var(--color-terracota); opacity: 0.7;">IL MIO SIGILLO ✒️</span>
                    ` : ''}
                    ${sub.feedback ? sub.feedback.map(f => `
                        <div class="feedback-note">
                            <div class="feedback-comment">"${f.comment}"</div>
                        </div>
                    `).join('') : ''}
                </div>

                ${!isReviewed ? `
                    <div style="margin-top: 4rem; padding-top: 3.5rem; border-top: 1.5px solid rgba(0,0,0,0.03);">
                        <span class="ui-label" style="margin-bottom: 1.5rem; color: var(--color-terracota); opacity: 0.7;">DEVOLUZIONE DEL MAESTRO</span>
                        <textarea id="feedback-input-${sub.id}" style="width: 100%; border: none; background: #fffdfa; font-family: var(--font-handwritten); font-size: 1.8rem; color: var(--color-ink); outline: none; min-height: 12rem; resize: none; border-bottom: 1.5px solid rgba(0,0,0,0.04); margin-bottom: 3rem; padding: 1.5rem;" placeholder="Escribe tu corrección aquí..."></textarea>
                        <div style="display: flex; justify-content: flex-end;">
                            <button class="btn-feedback" id="btn-save-feedback-${sub.id}">Firma Giancarlo ✒️</button>
                        </div>
                    </div>
                ` : ''}
            `;
            const btnSave = subCard.querySelector(`#btn-save-feedback-${sub.id}`);
            if (btnSave) btnSave.onclick = async () => await handleFeedbackSave(sub.id, subCard.querySelector(`#feedback-input-${sub.id}`).value);
            listContainer.appendChild(subCard);
        });

        const infoCol = document.createElement('div');
        infoCol.innerHTML = `
            <div class="task-info-hero">
                <span class="ui-label">ATTO DIDATTICO</span>
                <h1 style="font-family: var(--font-titles); font-size: 2.8rem; margin-bottom: 3rem; color: var(--color-ink); border-bottom: 1.5px solid rgba(0,0,0,0.04); padding-bottom: 1.5rem;">${task.title}</h1>
                <div style="padding: 2.5rem; background: #fffcf8; border-radius: 20px; border: 1px solid rgba(0,0,0,0.02); margin-bottom: 3rem;">
                    <span class="ui-label" style="font-size: 0.7rem; opacity: 0.3;">CONTESTO</span>
                    <p style="font-family: var(--font-body); font-size: 1.4rem; line-height: 1.6; color: var(--color-ink); font-style: italic; opacity: 0.8;">
                        "${task.type === 'translation_choice' ? task.content?.question : (task.type === 'error_correction' ? task.content?.incorrect : (task.content?.description || "Lezione registrata."))}"
                    </p>
                </div>
            </div>
            <div style="background: #43191a; color: white; border-radius: 30px; padding: 4.5rem; box-shadow: 0 15px 50px rgba(67, 25, 26, 0.3);">
                <h4 style="font-family: var(--font-titles); font-size: 2.2rem; margin-bottom: 1.5rem;">Libro del Maestro</h4>
                <p style="font-family: var(--font-body); font-size: 1.25rem; opacity: 0.75; line-height: 1.6;">
                    Cada trazo de Luci es valentía. Tu luz guía su pluma. ✨
                </p>
            </div>
        `;

        main.appendChild(historyCol);
        main.appendChild(infoCol);
        container.appendChild(nav);
        container.appendChild(main);
    };

    render();
    loadData();
    return container;
};
