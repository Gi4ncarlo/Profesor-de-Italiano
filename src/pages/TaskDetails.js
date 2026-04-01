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
    'error_correction': 'Correzione',
    'dictation': '🎧 Dettato',
    'dettato': '🎧 Dettato Audio',
    'pronuncia': '🎤 Pronuncia',
    'memory': '🃏 Memoria',
    'speed': '⚡ Velocità'
};

/**
 * TASK DETAILS PAGE - "IL REGISTRO DIDATTICO"
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
        .btn-back { display: flex; align-items: center; gap: 0.8rem; background: none; border: none; font-family: var(--font-ui); font-size: 1.25rem; font-weight: 850; text-transform: uppercase; letter-spacing: 0.12em; cursor: pointer; color: var(--color-ink); opacity: 0.75; transition: opacity 0.3s; }
        .btn-back:hover { opacity: 1; }
        
        .details-main { padding: 5rem 6.5rem 10rem; max-width: 155rem; margin: 0 auto; width: 100%; flex: 1; display: grid; grid-template-columns: 1.6fr 1fr; gap: 10rem; align-items: start; }
        
        .task-info-hero { background: white; border-radius: 30px; padding: 4rem; box-shadow: var(--shadow-premium); border: 1px solid rgba(0,0,0,0.01); margin-bottom: 3.5rem; position: sticky; top: 1.5rem; }
        .history-title { font-family: var(--font-heading); font-size: 2.8rem; font-weight: 500; font-style: italic; margin-bottom: 3rem; border-bottom: 1.5px solid rgba(0,0,0,0.05); padding-bottom: 1.5rem; color: var(--color-ink); }

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
        
        .ui-label { font-family: var(--font-ui); font-size: 1.2rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.25em; opacity: 0.7; margin-bottom: 1.5rem; display: block; color: var(--color-ink); }
        
        /* Status Badge */
        .status-badge { display: inline-flex; align-items: center; gap: 0.8rem; padding: 1rem 2.5rem; border-radius: 50px; font-family: var(--font-ui); font-size: 1.1rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 2.5rem; }
        .status-pending { background: #fef3c7; color: #92400e; border: 1.5px solid rgba(146, 64, 14, 0.1); }
        .status-submitted { background: #dcfce7; color: #166534; border: 1.5px solid rgba(22, 101, 52, 0.1); }
        .status-reviewed { background: #eff6ff; color: #1e40af; border: 1.5px solid rgba(30, 64, 175, 0.1); }

        /* Task Content Preview */
        .content-preview { background: #fffdfa; border: 1px dashed rgba(0,0,0,0.1); border-radius: 20px; padding: 2.5rem; margin-top: 2rem; }
        .content-item { display: flex; align-items: flex-start; gap: 1.5rem; padding: 1.2rem 0; border-bottom: 1px solid rgba(0,0,0,0.03); }
        .content-item:last-child { border-bottom: none; }
        .content-it { font-family: var(--font-titles); font-size: 1.2rem; min-width: 45%; color: var(--color-ink); }
        .content-arrow { opacity: 0.2; font-size: 0.8rem; padding-top: 0.3rem; }
        .content-es { font-family: var(--font-body); font-size: 1.1rem; color: var(--color-ink); opacity: 0.7; }
        
        @media (max-width: 768px) {
            .details-nav { padding: 1.5rem 2.5rem; }
            .details-main { grid-template-columns: 1fr; padding: 3rem 2rem; gap: 4rem; }
            .task-info-hero { position: static; padding: 3rem 2.5rem; }
            .submission-card { padding: 3rem 2.5rem; }
            .submission-card > div:first-child { flex-direction: column; align-items: flex-start !important; gap: 2rem; }
            .response-box { padding: 2.5rem; }
            .history-title { font-size: 2.4rem; }
            .btn-feedback { width: 100%; padding: 1.5rem 2rem; }
        }
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

            // --- AUTO-REVIEW LOGIC for Auto-correct Tasks ---
            const type = task.type?.toLowerCase();
            const isAutoCorrect = ['fill', 'completare', 'flashcard', 'flashcards', 'lessico', 'order_sentence', 'translation_choice', 'error_correction', 'speed'].includes(type);
            
            if (isAutoCorrect && submissions.length > 0) {
                const pendingSub = submissions.find(s => s.status === 'submitted');
                if (pendingSub) {
                    console.log(`Auto-reviewing ${type} task...`);
                    let feedbackMsg = "Letto e registrato. Ottimo lavoro! ✨";
                    if (type === 'order_sentence') feedbackMsg = "Ottimo lavoro con l'ordinamento delle frasi! Ho registrato i tuoi progressi. ✨";
                    else if (type === 'speed') feedbackMsg = "Record di velocità registrato! Continua così. ⚡";

                    // We don't await this to keep the UI fast, but we fire the update
                    addFeedback({ 
                        submissionId: pendingSub.id, 
                        comment: feedbackMsg 
                    }).then(() => {
                        // Silently refresh the local state to show 'reviewed'
                        pendingSub.status = 'reviewed';
                        pendingSub.review_comment = feedbackMsg;
                        render();
                    });
                }
            }
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
                            <div style="font-family: var(--font-ui); font-size: 1.1rem; font-weight: 950; color: var(--color-bordo); text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.7; margin-bottom: 0.6rem;">TRADUZZIONE</div>
                            <div style="font-family: var(--font-body); font-size: 1.5rem; margin-bottom: 2rem; color: var(--color-ink);">${back}</div>
                            ${example ? `
                                <div style="font-family: var(--font-ui); font-size: 1.1rem; font-weight: 950; color: var(--color-bordo); text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.7; margin-bottom: 0.6rem;">ESEMPIO</div>
                                <div style="font-family: var(--font-handwritten); font-size: 1.8rem; color: var(--color-ink); opacity: 0.9; line-height: 1.3;">"${example}"</div>
                            ` : ''}
                        </div>
                    `;
                });
            }
            h += `</div>`;
            return h;
        }

        // 2. MULTI-ITEM TRANSLATION (Tatoeba-style)
        if (type === 'translation' || type === 'traduzione' || (task.content?.items && !task.content?.question)) {
            const items = task.content?.pairs || task.content?.items || [];
            // Robust answer extraction
            let studentAnswers = [];
            try {
                const raw = sub.answers || sub.content;
                studentAnswers = (typeof raw === 'string' ? JSON.parse(raw) : (raw?.data || raw)) || [];
                if (!Array.isArray(studentAnswers)) studentAnswers = [studentAnswers];
            } catch(e) {
                studentAnswers = [];
            }

            return items.map((item, idx) => {
                const originalText = item.it || item.italiano || item.text || "Senza testo";
                const correctVersion = item.es || item.español || "";
                const studentTranslation = studentAnswers[idx] || "";
                
                return `
                    <div style="margin-bottom: 3.5rem; padding: 3rem; background: #fffdfa; border-radius: 24px; border: 1.5px solid rgba(0,0,0,0.03); box-shadow: 0 4px 20px rgba(0,0,0,0.01);">
                        <div style="font-family: var(--font-ui); font-size: 1.1rem; font-weight: 950; color: var(--color-terracota); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 1.5rem; opacity: 0.6;">CONSEGNA / FRASE ORIGINALE</div>
                        <div style="font-family: var(--font-heading); font-size: 2.2rem; color: var(--color-ink); margin-bottom: 2.5rem; padding-left: 2rem; border-left: 4px solid var(--color-terracota);">
                            "${originalText}"
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; margin-top: 1rem;">
                            <div>
                                <div style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; color: var(--color-bordo); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 1.5rem; opacity: 0.7;">RISPOSTA DI LUCI</div>
                                <div style="padding: 2.5rem; background: white; border: 2.5px solid ${studentTranslation ? 'rgba(0,0,0,0.05)' : '#991b1b'}; border-radius: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.01);">
                                    <div style="font-family: var(--font-handwritten); font-size: 2.22rem; color: #1d4ed8; line-height: 1.2;">
                                        ${studentTranslation ? `"${studentTranslation}"` : '<span style="opacity:0.3; font-style: italic;">Nessuna risposta...</span>'}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; color: #059669; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 1.5rem; opacity: 0.7;">VERSIONE CORRETTA</div>
                                <div style="padding: 2.5rem; background: #f0fdf4; border: 1.5px solid rgba(5, 150, 105, 0.1); border-radius: 1.5rem;">
                                    <div style="font-family: var(--font-body); font-size: 1.8rem; color: #065f46; line-height: 1.3;">
                                        "${correctVersion || 'Senza riferimento'}"
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 3. ROLEPLAY / CONVERSAZIONE (Check by property)
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
                    <div style="font-family: var(--font-ui); font-size: 1.2rem; font-weight: 950; color: var(--color-terracota); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 1.5rem; opacity: 0.7;">LA MIA RISPOSTA...</div>
                    <div class="bubble-l" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;">${studentResp}</div>
                </div>`;
            }
            h += `</div>`;
            return h;
        }

        // 3. COMPLETAR / FILL CHOICE (SCELTA MULTIPLA)
        if (type === 'fill' || type === 'completare' || (task.content?.text && (task.content.text.includes('___') || task.content.text.includes('---')))) {
            const segments = (task.content?.text || "").split(/_{2,}|-{2,}|\.{3,}/);
            const gaps = task.content?.gaps || [];
            let h = `<div style="line-height: 5.5; text-align: center; font-family: var(--font-body); font-size: 2.6rem; color: var(--color-ink); padding: 4rem 3rem 8rem 3rem; background: #fffdf9; border-radius: 2.5rem; border: 1.5px solid rgba(0,0,0,0.03);">`;
            segments.forEach((p, i) => {
                h += `<span>${p}</span>`;
                if (i < segments.length - 1) {
                    const studentVal = Array.isArray(answers) ? (answers[i] || '...') : '...';
                    
                    let gapCorrect = '';
                    if (gaps[i]) {
                        gapCorrect = typeof gaps[i] === 'object' ? (gaps[i].correct || '') : gaps[i];
                    }
                    const correctVal = (gapCorrect || (task.content.answers ? task.content.answers[i] : null) || '').trim();
                    
                    const clean = (s) => (s || "").toLowerCase().replace(/[.,!?;:]/g, '').trim();
                    const isCorrect = correctVal && clean(studentVal) === clean(correctVal);
                    
                    h += `
                        <span style="display: inline-block; position: relative; margin: 0 1rem; vertical-align: middle;">
                            <span style="
                                display: flex; align-items: center; justify-content: center;
                                min-width: 20rem; padding: 0.8rem 1.8rem; border-radius: 1.5rem;
                                color: ${isCorrect ? '#065f46' : '#991b1b'};
                                background: ${isCorrect ? '#ecfdf5' : '#fef2f2'};
                                border: 2.5px solid ${isCorrect ? '#10b981' : '#ef4444'};
                                box-shadow: 0 4px 12px ${isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'};
                                font-weight: 700; font-family: var(--font-body); font-size: 2.4rem;
                                line-height: 1.2;
                            ">${studentVal}</span>
                            ${!isCorrect && correctVal ? `
                                <div style="
                                    position: absolute; top: calc(100% + 0.8rem); left: -2.5px; right: -2.5px;
                                    background: #f0fdf4; border: 2.5px solid #10b981; padding: 0.6rem 0.8rem; border-radius: 1.5rem;
                                    box-shadow: 0 10px 25px rgba(16, 185, 129, 0.15); z-index: 5;
                                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                                    line-height: 1.2;
                                ">
                                    <div style="position: absolute; top: -7px; left: 50%; transform: translateX(-50%); width: 10px; height: 10px; background: #f0fdf4; border-left: 2.5px solid #10b981; border-top: 2.5px solid #10b981; rotate: 45deg;"></div>
                                    <span style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 950; color: #059669; text-transform: uppercase; letter-spacing: 0.15em; opacity: 0.8; margin-bottom: 0.2rem;">Corretta</span>
                                    <span style="font-family: var(--font-body); font-size: 2rem; color: #064e3b; font-weight: 800; letter-spacing: -0.02em;">${correctVal}</span>
                                </div>
                            ` : ''}
                        </span>
                    `;
                }
            });
            h += `</div>`;
            return h;
        }

        // 4. ORDER SENTENCE
        if (type?.includes('order') || task.content?.type === 'order_sentence') {
            const correctText = task.content?.text || task.content?.correct_sentence || "";
            const correctWords = task.content?.correctOrder || (correctText ? correctText.split(/\s+/) : []);
            const studentWords = Array.isArray(answers) ? answers : (answers?.data || []);
            
            const clean = (s) => String(s || "").toLowerCase().replace(/[.,!?;]/g, '').trim();
            const isCorrect = studentWords.length === correctWords.length && studentWords.every((w, i) => clean(w) === clean(correctWords[i]));

            return `
                <div style="display: flex; flex-direction: column; gap: 2.5rem;">
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
                        ${studentWords.map((w, i) => {
                            const isWordCorrect = correctWords[i] && clean(w) === clean(correctWords[i]);
                            return `
                                <div style="
                                    padding: 1.2rem 2.2rem; background: white; border-radius: 12px;
                                    border: 2px solid ${isWordCorrect ? '#10b981' : '#ef4444'};
                                    font-family: var(--font-body); font-size: 1.6rem; color: var(--color-ink);
                                    box-shadow: 0 4px 10px rgba(0,0,0,0.02);
                                ">${w}</div>
                            `;
                        }).join('')}
                    </div>
                    ${!isCorrect ? `
                        <div style="margin-top: 2rem; padding: 2.5rem; background: #ecfdf5; border-radius: 18px; border: 1.5px solid rgba(16, 185, 129, 0.1);">
                            <span class="ui-label" style="color: #065f46; opacity: 0.6; margin-bottom: 0.8rem;">ORDINE CORRETTO 💡</span>
                            <div class="font-editorial" style="font-size: 2rem; color: #064e3b; line-height: 1.3;">
                                "${correctText || correctWords.join(' ')}"
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
                            <span class="ui-label" style="color: #166534; opacity: 0.6; margin-bottom: 1rem;">SOLUZIONE CORRETTA 💡</span>
                            <div class="font-editorial" style="font-size: 2rem; color: #14532d; opacity: 1;">
                                "${correctStr}"
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // 7. SPEED (VELOCITY)
        if (type === 'speed' || task.content?.type === 'speed') {
            let data = { score: 0, completedIndices: [] };
            try {
                const src = answers?.data || answers;
                if (typeof src === 'string' && src.startsWith('{')) {
                    data = JSON.parse(src);
                } else if (typeof src === 'object' && src !== null) {
                    data = src;
                } else {
                    data = { score: Number(src) || 0, completedIndices: [] };
                }
            } catch(e) {
                data = { score: Number(answers) || 0, completedIndices: [] };
            }
            
            const words = task.content?.words || [];
            const completedIndices = Array.isArray(data.completedIndices) ? data.completedIndices.map(Number) : [];
            const score = data.score || completedIndices.length;
            const isPerfect = completedIndices.length === words.length && words.length > 0;

            return `
                <div style="display: flex; flex-direction: column; gap: 3rem;">
                    <div style="display: flex; justify-content: space-between; align-items: end;">
                        <div>
                            <span class="ui-label" style="color: var(--color-ink); opacity: 0.6; margin-bottom: 0.8rem;">RISULTATO VELOCITÀ ⚡</span>
                            <div class="font-editorial" style="font-size: 3.5rem; color: var(--color-terracota); font-weight: 800;">
                                ${score} <span style="font-size: 1.8rem; font-weight: 400; opacity: 0.5; color: var(--color-ink);">parole corrette</span>
                            </div>
                        </div>
                        ${isPerfect ? `
                            <div style="background: #f0fdf4; padding: 1rem 2rem; border-radius: 50px; border: 1.5px solid #16a34a; color: #166534; font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; text-transform: uppercase;">
                                ✨ Record Perfetto ✨
                            </div>
                        ` : ''}
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.2rem;">
                        ${words.map((w, i) => {
                            const isDone = completedIndices.includes(Number(i));
                            const color = isDone ? '#10b981' : '#ef4444';
                            const bgColor = isDone ? '#f0fdf4' : '#fff1f2';
                            return `
                                <div style="padding: 1.5rem; border-radius: 12px; background: ${bgColor}; border: 1px solid ${color}33; display: flex; flex-direction: column; gap: 0.4rem;">
                                    <div style="font-family: var(--font-ui); font-size: 0.75rem; opacity: 0.4; text-transform: uppercase;">${task.content.direction === 'it-es' ? 'Italiano' : 'Spagnolo'}</div>
                                    <div style="font-family: var(--font-body); font-size: 1.4rem; color: var(--color-ink); font-weight: 600;">${task.content.direction === 'it-es' ? (w.it || w.word) : (w.es || w.translation)}</div>
                                    <div style="height: 1px; background: ${color}22; margin: 0.4rem 0;"></div>
                                    <div style="font-family: var(--font-body); font-size: 1.4rem; color: ${color}; font-weight: 800;">${task.content.direction === 'it-es' ? (w.es || w.translation) : (w.it || w.word)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // 8. DETTATO AUDIO
        if (type === 'dettato') {
            const c = task.content || {};
            const isComprensione = !c.mode || c.mode === 'comprensione';
            let studentAns = '';
            try {
                const raw = sub.answers || sub.content;
                if (typeof raw === 'string') {
                    if (raw.startsWith('{') || raw.startsWith('[')) {
                        studentAns = JSON.parse(raw);
                    } else {
                        studentAns = raw;
                    }
                } else {
                    studentAns = raw?.data ?? raw ?? (isComprensione ? '' : {});
                }
            } catch(e) { studentAns = isComprensione ? '' : {}; }

            let html = '';
            if (task.audio_url) {
                html += `
                    <div style="margin-bottom: 2.5rem;">
                        <span class="ui-label" style="color: var(--color-terracota); opacity: 0.6; margin-bottom: 1rem;">AUDIO DEL MAESTRO 🎧</span>
                        <audio controls src="${task.audio_url}" style="width: 100%; max-width: 400px; display: block; margin-top: 1rem;"></audio>
                    </div>
                `;
            }

            if (isComprensione) {
                const text = typeof studentAns === 'string' ? studentAns : JSON.stringify(studentAns);
                html += `
                    <span class="ui-label" style="opacity: 0.6; margin-bottom: 1rem;">TRASCRIZIONE DI LUCI ✍️</span>
                    <div style="font-family: var(--font-handwritten); font-size: 2.2rem; color: #1d4ed8; background: white; padding: 2.5rem; border-radius: 1.5rem; border: 2px solid rgba(29,78,216,0.1); line-height: 1.4;">
                        ${text || '<span style="opacity:0.35; font-style:italic;">Nessuna risposta.</span>'}
                    </div>
                `;
            } else {
                const questions = c.questions || [];
                const answers = (typeof studentAns === 'object' && studentAns !== null) ? studentAns : {};
                html += `<div style="display: flex; flex-direction: column; gap: 2.5rem;">`;
                questions.forEach((q, i) => {
                    const ans = answers[i] || '';
                    html += `
                        <div style="background: #fffdf9; border-radius: 1.5rem; padding: 2.5rem; border: 1px solid rgba(0,0,0,0.04);">
                            <div style="font-family: var(--font-body); font-size: 1.6rem; font-weight: 700; color: var(--color-ink); margin-bottom: 1.2rem;">${i+1}. ${q}</div>
                            <div style="font-family: var(--font-handwritten); font-size: 2rem; color: #1d4ed8; line-height: 1.3;">
                                ${ans || '<span style="opacity:0.35;">Nessuna risposta.</span>'}
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
            }
            return html;
        }

        // 9. PRONUNCIA AUDIO
        if (type === 'pronuncia') {
            let audioUrl = '';
            try {
                const raw = sub.answers || sub.content;
                if (typeof raw === 'string') {
                    if (raw.startsWith('{')) {
                        const parsed = JSON.parse(raw);
                        audioUrl = parsed?.audio_url || '';
                    }
                } else {
                    audioUrl = raw?.audio_url || '';
                }
            } catch(e) {}

            return `
                <div style="display: flex; flex-direction: column; gap: 2.5rem;">
                    ${task.audio_url ? `
                        <div>
                            <span class="ui-label" style="color: var(--color-terracota); opacity: 0.6; margin-bottom: 1rem;">AUDIO DI RIFERIMENTO 🎧</span>
                            <audio controls src="${task.audio_url}" style="width: 100%; max-width: 400px; display: block; margin-top: 1rem;"></audio>
                        </div>
                    ` : ''}
                    <div>
                        <span class="ui-label" style="opacity: 0.6; margin-bottom: 1rem;">REGISTRAZIONE DI LUCI 🎤</span>
                        ${audioUrl
                            ? `<audio controls src="${audioUrl}" style="width: 100%; max-width: 400px; display: block; margin-top: 1rem; border-radius: 2rem;"></audio>`
                            : `<div style="font-family: var(--font-body); font-size: 1.5rem; opacity: 0.4; font-style: italic; padding: 2rem;">Nessuna registrazione caricata.</div>`
                        }
                    </div>
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
            <div style="font-family: var(--font-titles); font-size: 2.8rem; font-weight: 700; letter-spacing: -0.01em;">Registro <span style="font-style: italic; color: var(--color-terracota);">Didattico</span></div>
            <div style="width: 55px; height: 55px; background: var(--color-ink); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-family: var(--font-titles);">${user.name.charAt(0)}</div>
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
        console.log("Submissions/Assignments:", submissions);

        const historyCol = document.createElement('div');
        historyCol.innerHTML = `
            <h3 class="history-title">Registro Consegne</h3>
            <div id="submissions-list"></div>
        `;

        const listContainer = historyCol.querySelector('#submissions-list');
        submissions.forEach(sub => {
            const subCard = document.createElement('div');
            subCard.className = 'submission-card animate-in';
            const isReviewed = sub.status === 'reviewed' || (sub.feedback && sub.feedback.length > 0);
            const isPending = sub.status === 'pending';
            const studentName = sub.profiles?.name || "Luci";

            if (isPending) {
                subCard.style.opacity = '0.6';
                subCard.style.border = '2px dashed rgba(0,0,0,0.05)';
                subCard.style.background = 'rgba(0,0,0,0.01)';
                subCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 1.8rem; align-items: center;">
                            <div style="width: 55px; height: 55px; border-radius: 12px; background: #fef3c7; display: flex; align-items: center; justify-content: center; font-family: var(--font-titles); font-size: 1.6rem; color: #92400e;">${studentName.charAt(0)}</div>
                            <div>
                                <div style="font-family: var(--font-titles); font-size: 2.2rem; color: var(--color-ink);">${studentName}</div>
                                <div style="font-family: var(--font-ui); font-size: 1rem; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 950; margin-top: 0.5rem; color: var(--color-ink);">Status: Pendente 🪶</div>
                            </div>
                        </div>
                        <div style="font-family: var(--font-ui); font-size: 0.9rem; font-weight: 900; color: #92400e; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.1em;">In attesa di Luci</div>
                    </div>
                `;
            } else {
                subCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 3.5rem;">
                        <div style="display: flex; gap: 1.8rem; align-items: center;">
                            <div style="width: 55px; height: 55px; border-radius: 12px; background: var(--color-crema-oscuro); display: flex; align-items: center; justify-content: center; font-family: var(--font-titles); font-size: 1.6rem; color: var(--color-terracota);">${studentName.charAt(0)}</div>
                            <div>
                                <div style="font-family: var(--font-titles); font-size: 2.2rem; color: var(--color-ink);">${studentName}</div>
                                <div style="font-family: var(--font-ui); font-size: 1rem; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 950; margin-top: 0.5rem; color: var(--color-ink);">Consegnato il: ${new Date(sub.created_at).toLocaleString('it-IT')}</div>
                            </div>
                        </div>
                        <div class="status-badge ${isReviewed ? 'status-reviewed' : 'status-submitted'}">
                            ${isReviewed ? 'Sigillato ✒️' : 'Da Correggere ✒️'}
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
            }
            listContainer.appendChild(subCard);
        });

        const getStatusBadge = () => {
            if (submissions.length === 0) return `<div class="status-badge status-pending">🪶 Pendente (Assente)</div>`;
            const hasReviewed = submissions.some(s => s.feedback && s.feedback.length > 0);
            if (hasReviewed) return `<div class="status-badge status-reviewed">🏛️ Recensito (Sigillato)</div>`;
            return `<div class="status-badge status-submitted">📮 Consegnato (Attesa)</div>`;
        };

        const renderTaskItems = () => {
            const c = task.content || {};
            // Gather items from different possible property names
            const items = c.items || c.pairs || c.words || c.data || [];
            
            if (!items.length && !c.text) {
                // If it's a dettato task, use its special properties for the summary
                let summary = c.description || 'Nessun dettaglio aggiuntivo.';
                if (task.type === 'dettato') {
                    summary = c.mode === 'comprensione' 
                        ? `Trascrizione audio: "${c.refText?.substring(0, 50) || ''}..."`
                        : `Domande su audio (${c.questions?.length || 0} quesiti)`;
                }
                
                return `<p style="font-family: var(--font-body); font-size: 1.3rem; line-height: 1.6; color: var(--color-ink); font-style: italic; opacity: 0.6;">
                    "${summary}"
                </p>`;
            }

            if (task.type === 'order_sentence' || (Array.isArray(c.words) && !c.words[0]?.it)) {
                const words = c.words || [];
                return `<div class="content-preview" style="display: flex; flex-wrap: wrap; gap: 0.8rem;">
                    ${words.map(w => `<span style="padding: 0.6rem 1.2rem; background: rgba(0,0,0,0.03); border-radius: 8px; font-family: var(--font-body);">${w}</span>`).join('')}
                </div>`;
            }

            if (c.text) {
                return `<div class="content-preview">
                    <p style="font-family: var(--font-body); font-size: 1.2rem; line-height: 1.6; color: var(--color-ink);">${c.text}</p>
                </div>`;
            }

            return `
                <div class="content-preview">
                    ${items.map(it => `
                        <div class="content-item">
                            <div class="content-it">${it.italiano || it.it || it.word || it.phrase || '...'}</div>
                            <div class="content-arrow">→</div>
                            <div class="content-es">${it.español || it.es || it.translation || '...'}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        const infoCol = document.createElement('div');
        infoCol.innerHTML = `
            <div class="task-info-hero">
                ${getStatusBadge()}
                <span class="ui-label">ATTO DIDATTICO</span>
                <h1 style="font-family: var(--font-heading); font-size: 3.5rem; font-weight: 700; line-height: 1; margin-bottom: 3rem; color: var(--color-ink); border-bottom: 1.5px solid rgba(0,0,0,0.04); padding-bottom: 1.5rem;">${task.title}</h1>
                
                <div style="margin-bottom: 4rem;">
                    <span class="ui-label" style="font-size: 1.1rem; opacity: 0.6;">CONTENUTO DELL'ATTO</span>
                    ${renderTaskItems()}
                </div>

                ${task.audio_url ? `
                <div style="margin-bottom: 4rem; padding: 2.5rem; background: #fffcf8; border-radius: 15px; border: 1.5px solid rgba(196,96,58,0.1);">
                    <span class="ui-label" style="font-size: 1.1rem; opacity: 0.6; margin-bottom: 1rem;">AUDIO DEL MAESTRO 🎧</span>
                    <audio controls src="${task.audio_url}" style="width: 100%; display: block; margin-top: 1rem;"></audio>
                </div>
                ` : ''}

                <div style="padding: 2.5rem; background: #fffcf8; border-radius: 15px; border: 1.5px solid rgba(166, 77, 50, 0.08);">
                    <span class="ui-label" style="font-size: 1.1rem; opacity: 0.6; margin-bottom: 0.8rem;">TIPO ATTO</span>
                    <div style="font-family: var(--font-ui); font-size: 1.3rem; font-weight: 950; color: var(--color-terracota); letter-spacing: 0.1em;">
                        ${TYPE_TRANSLATIONS[task.type] || task.type.toUpperCase()}
                    </div>
                </div>
            </div>

            <div style="background: #43191a; color: white; border-radius: 30px; padding: 5.5rem; box-shadow: 0 15px 50px rgba(67, 25, 26, 0.3);">
                <h4 style="font-family: var(--font-titles); font-size: 2.8rem; margin-bottom: 2rem;">Libro del Maestro</h4>
                <p style="font-family: var(--font-body); font-size: 1.5rem; opacity: 0.95; line-height: 1.6;">
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
