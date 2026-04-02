import { completeTask } from '../services/tasks';
import { toast } from './Toast';
import { getDraft, saveDraft } from '../services/submissions';
import { AudioRecorder } from './AudioRecorder';
import { uploadAudio } from '../services/audioService';

const TASK_DESCRIPTIONS = {
    'fill': 'Leggi attentamente il testo e inserisci la parola corretta negli spazi vuoti per completare il senso della frase.',
    'completare': 'Leggi attentamente il testo e inserisci la parola corretta negli spazi vuoti per completare il senso della frase.',
    'roleplay': 'Immergiti nella situazione descritta e rispondi in modo naturale, come se stessi parlando con Giancarlo.',
    'conversazione': 'Immergiti nella situazione descritta e rispondi in modo naturale, come se stessi parlando con Giancarlo.',
    'flashcard': 'Ripassa il nuovo vocabolario. Gira le carte per vede la traduzzione',
    'flashcards': 'Ripassa il nuovo vocabolario. Gira le carte per ved la traduzzione.',
    'lessico': 'Ripassa il nuovo vocabolario. Gira le carte per vedere la traduzzione.',
    'order_sentence': 'Clicca sulle parole nell\'ordine corretto per formare una frase di senso compiuto.',
    'translation_choice': 'Scegli la traduzione più accurata tra le opzioni proposte per la frase presentata.',
    'error_correction': 'Individua l\'errore nella frase e scrivi la versione corretta. Fai molta attenzione ai dettagli!',
    'dictation': 'Ascolta l\'audio e trascrivi quello che senti. Puoi riascoltare il frammento al massimo 5 volte.',
    'dettato': 'Ascolta l\'audio e trascrivi quello che senti, oppure rispondi alle domande.',
    'pronuncia': 'Registra la tua voce. Hai a disposizione un massimo di 3 tentativi.',
    'memory': 'Abbina le parole italiane con le loro traduzioni corrispondenti. Trova tutte le coppie!',
    'speed': 'Traduci più parole possibili prima che scada il tempo. Sii veloce e preciso!'
};

export const TaskModal = (onComplete) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay animate-in';
    overlay.style.display = 'flex';
    overlay.style.visibility = 'hidden';

    let currentTask = null;
    let autosaveInterval = null;
    let speedTimerInterval = null;
    let lastSavedTime = null;


    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.transition = 'all 0.22s cubic-bezier(0.165, 0.84, 0.44, 1)'; 
    modal.style.width = '112rem';
    modal.style.maxWidth = '95vw';
    modal.style.maxHeight = '92vh';
    modal.style.overflowY = 'auto';
    modal.style.padding = '5rem 8rem';
    modal.style.scrollbarWidth = 'thin';
    modal.style.scrollbarColor = 'var(--color-bordo) transparent';

    const renderHeader = (task) => `
        <button class="modal-close" id="modal-close-btn" style="
            position: absolute; top: 2.8rem; left: 2.8rem; 
            width: 4.5rem; height: 4.5rem; border-radius: 50%;
            background: rgba(0,0,0,0.03); border: 1.5px solid rgba(0,0,0,0.04);
            display: flex; align-items: center; justify-content: center;
            font-size: 2.4rem; cursor: pointer; transition: all 0.25s; color: var(--color-ink);
            box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        ">×</button>
        <div style="text-align: center; margin-bottom: 5.5rem; position: relative;">
            <div style="font-family: var(--font-body); font-size: 1.2rem; font-weight: 800; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 2rem;">Registro d'Apprendimento</div>
            <h2 style="font-family: var(--font-heading); font-size: clamp(3.5rem, 6vw, 4.5rem); font-weight: 700; margin: 0; color: var(--color-ink); line-height: 1; letter-spacing: -0.5px;">${task.title || 'Senza Titolo'}</h2>
            <div style="width: 8rem; height: 1.5px; background: var(--color-bordo); margin: 3.5rem auto; opacity: 0.15;"></div>
            <div style="font-family: var(--font-body); font-size: 1.2rem; font-weight: 800; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.2em;">A cura di ${task.master_name || 'Maestro Giancarlo'} 🎨</div>
            <div id="autosave-status" style="font-family: var(--font-body); font-size: 1.15rem; color: #a67d32; opacity: 0.9; margin-top: 2rem; display: none;">
                Borrador guardado <span id="save-time"></span> ✓
            </div>
        </div>
    `;


    const getRawContent = (task) => {
        if (!task.content) return '';
        if (typeof task.content === 'string') return task.content;
        return task.content.text || task.content.description || JSON.stringify(task.content);
    };

    const renderFeedback = (task) => {
        const isReviewed = task.status === 'reviewed';
        if (!isReviewed || (!task.review_comment && (!task.feedback || task.feedback.length === 0))) return '';
        const comment = task.review_comment || (task.feedback && task.feedback[0] ? task.feedback[0].comment : '');
        if (!comment) return '';
        
        return `
            <div style="margin-bottom: 6rem; animation: coutureSlideIn 0.6s ease-out forwards;">
                <div style="font-family: var(--font-body); font-size: 1.15rem; font-weight: 900; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.2rem; color: var(--color-bordo); display: flex; align-items: center; gap: 1.5rem;">
                    <span>CORREZIONE DEL MAESTRO</span>
                    <div style="flex: 1; height: 1.5px; background: var(--color-bordo); opacity: 0.15;"></div>
                </div>
                <div style="background: #fffcfb; border-radius: 2.8rem; padding: 4.5rem 5rem; box-shadow: 0 15px 40px rgba(107, 16, 36, 0.04); border: 1.5px solid rgba(107, 16, 36, 0.08); position: relative; overflow: hidden; transform: rotate(-0.5deg);">
                    <div style="position: absolute; right: 2rem; bottom: -2rem; font-size: 18rem; font-family: var(--font-heading); color: var(--color-bordo); opacity: 0.03; pointer-events: none;">"</div>
                    <div class="font-editorial" style="font-size: 3.2rem; color: #43191a; line-height: 1.45; font-weight: 400; text-shadow: 0 1px 1px rgba(0,0,0,0.01);">"${comment}"</div>
                    <div style="text-align: right; margin-top: 2.5rem; font-family: var(--font-body); font-size: 1rem; font-weight: 800; opacity: 0.4; text-transform: uppercase; letter-spacing: 0.18em;">— Maestro Giancarlo ✒️</div>
                </div>
            </div>
        `;
    };

    const renderInstruction = (task) => {
        const type = task.type?.toLowerCase();
        const description = TASK_DESCRIPTIONS[type] || 'Segui le istruzioni del maestro per completare questa attività.';
        
        return `
            <div style="margin-bottom: 5rem; background: #fffcf8; border-radius: 2.2rem; padding: 2.5rem 3.5rem; border: 1.5px dashed rgba(166, 77, 50, 0.15); display: flex; align-items: center; gap: 2rem; animation: fadeIn 0.8s ease-out;">
                <div style="font-size: 2.8rem; filter: grayscale(0.2); opacity: 0.8;">💡</div>
                <div style="flex: 1;">
                    <div style="font-family: var(--font-ui); font-size: 0.95rem; font-weight: 950; color: var(--color-terracota); text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 0.5rem; opacity: 0.7;">Istruzioni d'Uso</div>
                    <div style="font-family: var(--font-body); font-size: 1.55rem; color: var(--color-ink); opacity: 0.85; line-height: 1.4; font-style: italic;">
                        ${description}
                    </div>
                </div>
            </div>
        `;
    };

    const renderFillContent = (task) => {
        const c = task.content || {};
        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';
        const answerColor = isReadOnly ? '#0057b7' : 'var(--color-bordo)';
        
        // Handle items-based fill (Alternative Tatoeba structure)
        if (c.items && Array.isArray(c.items)) {
            let answers = [];
            try { 
                const source = task.student_answer || task.answers;
                answers = (typeof source === 'string' ? JSON.parse(source) : (source?.data || source)) || [];
            } catch(e) { console.error(e); }

            return `
                <div style="margin-bottom: 4.5rem;">
                    <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                        <span>RIEMPI GLI SPAZI</span>
                        <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 3.5rem;">
                        ${c.items.map((it, idx) => {
                            const segments = (it.italiano || "").split(/_{2,}|-{2,}|\.{3,}/);
                            return `
                                <div style="background: white; border-radius: 2.5rem; padding: 4rem 5rem; box-shadow: 0 12px 40px rgba(0,0,0,0.02); border: 1.5px solid rgba(0,0,0,0.015);">
                                    <div style="font-family: var(--font-body); font-size: 2.4rem; line-height: 2; color: var(--color-ink);">
                                        ${segments.map((seg, sIdx) => sIdx < segments.length - 1 
                                            ? `${seg}<input type="text" class="task-input" data-idx="${idx}" style="width: 22rem; font-size: 2.2rem; color: ${answerColor}; font-weight: 700; border: none; border-bottom: 2.5px solid ${isReadOnly ? '#e6eef8' : 'rgba(0,0,0,0.1)'}; background: transparent; margin: 0 1rem; border-radius: 0.6rem; padding: 0.2rem 1rem; transition: all 0.3s;" value="${answers[idx] || ''}" ${isReadOnly ? 'readonly' : ''}>`
                                            : seg).join('')}
                                    </div>
                                    <div style="font-family: var(--font-body); font-size: 1.4rem; color: var(--color-ink); opacity: 0.35; margin-top: 1.5rem; font-style: italic;">
                                        💡 ${it.español}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        
        // Handle sentences-based fill (from Creation Panel with multiple individual sentences)
        if (c.sentences && Array.isArray(c.sentences)) {
            let answers = [];
            try { 
                const source = task.student_answer || task.answers;
                answers = (typeof source === 'string' ? JSON.parse(source) : (source?.data || source)) || [];
            } catch(e) { console.error(e); }

            return `
                <div style="margin-bottom: 4.5rem;">
                    <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                        <span>RIEMPI GLI SPAZI</span>
                        <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2.5rem;">
                        ${c.sentences.map((it, idx) => {
                            // GiancarloDashboard saves the actual original text and the 'blank' word.
                            // We need to replace that word in the text with an input.
                            const originalText = it.text || "";
                            const blank = it.blank || "";
                            
                            let sentenceHtml = originalText;
                            if (blank) {
                                const reg = new RegExp(`\\b${blank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                                const match = originalText.match(reg);
                                if (match) {
                                    const inputHtml = `<input type="text" class="task-input" data-idx="${idx}" style="width: 20rem; font-size: 2.2rem; color: ${answerColor}; font-weight: 700; border: none; border-bottom: 2.5px solid ${isReadOnly ? '#e6eef8' : 'rgba(166, 77, 50, 0.4)'}; background: transparent; margin: 0 1rem; border-radius: 0.6rem; padding: 0.2rem 1rem; transition: all 0.3s;" placeholder="..." value="${answers[idx] || ''}" ${isReadOnly ? 'readonly' : ''}>`;
                                    sentenceHtml = originalText.replace(reg, inputHtml);
                                } else {
                                    // Fallback if regex fails (e.g. word not found due to punctuation)
                                    sentenceHtml = originalText.replace(blank, `<input type="text" class="task-input" data-idx="${idx}" style="width: 20rem; font-size: 2.2rem; color: ${answerColor}; font-weight: 700; border: none; border-bottom: 2.5px solid ${isReadOnly ? '#e6eef8' : 'rgba(166, 77, 50, 0.4)'}; background: transparent; margin: 0 1rem; border-radius: 0.6rem; padding: 0.2rem 1rem; transition: all 0.3s;" placeholder="..." value="${answers[idx] || ''}" ${isReadOnly ? 'readonly' : ''}>`);
                                }
                            }

                            return `
                                <div style="background: white; border-radius: 2.2rem; padding: 3.5rem 4.5rem; box-shadow: 0 8px 30px rgba(0,0,0,0.02); border: 1.5px solid rgba(0,0,0,0.012);">
                                    <div style="font-family: var(--font-body); font-size: 2.2rem; line-height: 1.8; color: var(--color-ink);">
                                        ${sentenceHtml}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // Legacy string-based fill
        const contentStr = getRawContent(task);
        const segments = contentStr.split(/_{2,}|-{2,}|\.{3,}/);
        let answers = [];
        try { 
            const source = task.student_answer || task.answers;
            answers = (typeof source === 'string' ? JSON.parse(source) : (source?.data || source)) || [];
        } catch(e) { console.error(e); }

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>RIEMPI GLI SPAZI</span>
                    <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                </div>
                <div style="background: white; border-radius: 3.5rem; padding: 8.5rem 7.5rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">
                    <div style="font-family: var(--font-body); font-size: 3.2rem; line-height: 2.4; color: var(--color-ink);">
                        ${segments.map((s, i) => i < segments.length - 1 
                            ? `${s}<input type="text" class="task-input" style="width: 28rem; font-size: 3rem; color: ${answerColor}; font-weight: 700; border-bottom: 3px solid ${isReadOnly ? '#e6eef8' : 'rgba(0,0,0,0.1)'}; background: ${isReadOnly ? '#f8fbfc' : 'transparent'}; margin: 0 1.2rem; border-radius: 1rem; padding: 0.2rem 1.5rem; transition: all 0.3s;" value="${answers[i] || ''}" ${isReadOnly ? 'readonly' : ''}>` 
                            : s).join('')}
                    </div>
                </div>
            </div>
        `;
    };

    const renderRoleplayContent = (task) => {
        const contentStr = getRawContent(task);
        const source = task.student_answer || task.answers;
        
        const getAnswerText = (src) => {
            if (!src) return '';
            try {
                const parsed = typeof src === 'string' ? JSON.parse(src) : src;
                if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.data)) return parsed.data.join('\n');
                    if (parsed.data) return parsed.data;
                    if (parsed.text) return parsed.text;
                }
            } catch(e) {}
            return typeof src === 'string' ? src : JSON.stringify(src);
        };
        
        const answerStr = getAnswerText(source);
        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 3.5rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>DETTAGLI ROLEPLAY</span>
                    <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                </div>
                
                <div style="background: white; border-radius: 3.5rem; padding: 5rem 6rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">
                    <!-- Maestro Section -->
                    <div style="margin-bottom: 5rem;">
                        <div style="font-family: var(--font-ui); font-size: 1.2rem; font-weight: 950; opacity: 0.85; color: var(--color-bordo); text-transform: uppercase; letter-spacing: 0.35em; margin-bottom: 2.2rem;">Maestro dice..</div>
                        <p style="font-family: var(--font-body); font-size: 2.8rem; line-height: 1.8; color: var(--color-ink); opacity: 1;">${contentStr}</p>
                    </div>

                    <div style="width: 100%; height: 1.5px; background: rgba(0,0,0,0.06); margin: 5rem 0;"></div>

                    <!-- Student Section -->
                    <div>
                        <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; color: var(--color-bordo); text-transform: uppercase; letter-spacing: 0.35em; margin-bottom: 2.2rem;">La mia risposta..</div>
                        <textarea class="task-textarea" placeholder="La tua respuesta..." style="
                            min-height: 24rem; font-size: 2.6rem; padding: 3rem;
                            background: ${isReadOnly ? '#f8fbfc' : 'white'};
                            color: ${isReadOnly ? '#0057b7' : 'var(--color-ink)'};
                            border: 2px solid ${isReadOnly ? '#e1effa' : 'rgba(0,0,0,0.08)'};
                            border-radius: 2.8rem; font-weight: ${isReadOnly ? '600' : '400'};
                            box-shadow: ${isReadOnly ? 'none' : 'inset 0 4px 12px rgba(0,0,0,0.01)'};
                            line-height: 1.6;
                        " ${isReadOnly ? 'readonly' : ''}>${answerStr}</textarea>
                        
                        <div style="text-align: center; margin-top: 4.5rem; font-family: var(--font-ui); font-size: 1.05rem; font-weight: 950; opacity: 0.18; text-transform: uppercase; letter-spacing: 0.45em;">
                            ${isReadOnly ? 'CONSEGNATO A GIANCARLO' : 'ELABORA IL TUO SCRITTO'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    const renderFillChoiceContent = (task) => {
        const content = task.content || {};
        const text = content.text || "";
        const gaps = content.gaps || [];
        const segments = text.split(/_{2,}|-{2,}|\.{3,}/);
        
        let savedAnswers = [];
        try {
            const source = task.student_answer || task.answers;
            savedAnswers = typeof source === 'string' ? JSON.parse(source) : (source?.data || source || []);
        } catch(e) {}

        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>SCELTA MULTIPLA</span>
                    <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                </div>
                <div style="background: white; border-radius: 3.5rem; padding: 6.5rem 7.5rem 9.5rem 7.5rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">
                    <div style="font-family: var(--font-body); font-size: 3rem; line-height: 5.5; color: var(--color-ink); text-align: center;">
                        ${segments.map((s, i) => {
                            if (i >= segments.length - 1) return s;
                            const gap = gaps[i] || { options: [], correct: '' };
                            const studentVal = savedAnswers[i] || '';
                            const isCorrect = studentVal === gap.correct;
                            const showResult = isReadOnly && studentVal;
                            
                            let btnStyle = `
                                display: inline-flex; align-items: center; justify-content: center;
                                min-width: 24rem; padding: 1rem 2.2rem; margin: 0 1.2rem;
                                border-radius: 1.8rem; cursor: ${isReadOnly ? 'default' : 'pointer'};
                                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                                font-family: var(--font-body); font-size: 2.6rem; font-weight: 700;
                                border: 2.5px solid rgba(0,0,0,0.08); background: #fdfdfd;
                                color: var(--color-ink); vertical-align: middle; position: relative;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.01);
                                line-height: 1.4;
                            `;

                            if (showResult) {
                                if (isCorrect) {
                                    btnStyle += 'border-color: #10b981; background: #ecfdf5; color: #065f46; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.08);';
                                } else {
                                    btnStyle += 'border-color: #ef4444; background: #fef2f2; color: #991b1b; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.08);';
                                }
                            } else if (studentVal) {
                                btnStyle += 'border-color: var(--color-bordo); background: rgba(107, 16, 36, 0.03); color: var(--color-bordo);';
                            }

                            return `
                                ${s}
                                <div class="choice-gap" data-idx="${i}" style="${btnStyle}">
                                    <span class="choice-label">${studentVal || '...'}</span>
                                    ${!isReadOnly ? `
                                        <div class="choice-dropdown" style="
                                            display: none; position: absolute; top: calc(100% + 1.2rem); left: 50%; transform: translateX(-50%);
                                            background: white; border-radius: 2rem; box-shadow: 0 25px 60px rgba(0,0,0,0.18);
                                            z-index: 100; min-width: 26rem; padding: 1.2rem; border: 1.2px solid rgba(0,0,0,0.05);
                                            overflow: hidden;
                                        ">
                                            ${gap.options.map(opt => `
                                                <div class="choice-option" data-val="${opt}" style="
                                                    padding: 1.4rem 2.2rem; border-radius: 1.4rem; transition: 0.2s;
                                                    font-size: 2rem; cursor: pointer; color: var(--color-ink);
                                                    ${opt === studentVal ? 'background: rgba(107, 16, 36, 0.06); font-weight: 700; color: var(--color-bordo);' : ''}
                                                ">${opt}</div>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                    ${showResult && !isCorrect ? `
                                        <div style="
                                            position: absolute; top: calc(100% + 1rem); left: -2.5px; right: -2.5px;
                                            background: #f0fdf4; border: 2.5px solid #10b981; padding: 0.8rem 1rem; border-radius: 1.8rem;
                                            box-shadow: 0 12px 30px rgba(16, 185, 129, 0.15); z-index: 10;
                                            display: flex; flex-direction: column; align-items: center; justify-content: center;
                                            line-height: 1.2;
                                        ">
                                            <div style="position: absolute; top: -8px; left: 50%; transform: translateX(-50%); width: 12px; height: 12px; background: #f0fdf4; border-left: 2.5px solid #10b981; border-top: 2.5px solid #10b981; rotate: 45deg;"></div>
                                            <span style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 950; color: #059669; text-transform: uppercase; letter-spacing: 0.15em; opacity: 0.8; margin-bottom: 0.2rem;">Corretta</span>
                                            <span style="font-family: var(--font-body); font-size: 2.2rem; color: #064e3b; font-weight: 800; letter-spacing: -0.02em;">${gap.correct}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    };

    const renderTranslationContent = (task) => {
        const c = task.content || {};
        const pairs = c.pairs || c.items || [];
        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';
        const answerColor = isReadOnly ? '#0057b7' : 'var(--color-crema-scuro) !important';
        
        let answers = [];
        try { 
            const source = task.student_answer || task.answers;
            answers = (typeof source === 'string' ? JSON.parse(source) : (source?.data || source)) || [];
        } catch(e) {}

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 3.5rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>TRADUZIONE</span>
                    <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 4rem;">
                    ${pairs.map((p, idx) => {
                        const original = p.italiano || p.it || "";
                        const student = answers[idx] || "";
                        const correction = p.español || p.es || "";
                        
                        return `
                        <div style="background: white; border-radius: 3rem; padding: 5rem 6.5rem; box-shadow: 0 15px 45px rgba(0,0,0,0.02); border: 1.5px solid rgba(0,0,0,0.01);">
                            <div style="display: flex; gap: 3rem; align-items: start;">
                                <div style="flex: 1;">
                                    <div style="font-family: var(--font-ui); font-size: 1.1rem; font-weight: 950; color: var(--color-terracota); text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 2rem; opacity: 0.75;">Originale</div>
                                    <p style="font-family: var(--font-body); font-size: 2.22rem; line-height: 1.5; color: var(--color-ink); font-weight: 700;">"${original}"</p>
                                </div>
                                <div style="width: 5.5rem; height: 5.5rem; border-radius: 50%; background: #fffcfb; border: 1.5px solid rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; font-size: 2.4rem; color: var(--color-terracota); margin-top: 2rem;">→</div>
                                <div style="flex: 1.2;">
                                    <div style="font-family: var(--font-ui); font-size: 1.1rem; font-weight: 950; color: var(--color-bordo); text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 2rem; opacity: 0.75;">Tua Traduzione</div>
                                    <textarea class="task-input task-textarea-small" data-idx="${idx}" placeholder="Digita qui..." style="
                                        width: 100%; border: none; background: ${isReadOnly ? '#f8fbfc' : 'rgba(0,0,0,0.02)'}; 
                                        font-family: var(--font-handwritten); font-size: 2.4rem; color: ${isReadOnly ? '#1d4ed8' : 'var(--color-ink)'};
                                        padding: 1.5rem 2rem; border-radius: 1.5rem; min-height: 10rem; resize: none; outline: none; transition: all 0.3s;
                                    " ${isReadOnly ? 'readonly' : ''}>${student}</textarea>
                                    
                                    ${isReadOnly && correction ? `
                                        <div style="margin-top: 2.5rem; padding-top: 2rem; border-top: 1.5px dashed rgba(0,0,0,0.08);">
                                            <div style="font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; color: #059669; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 1.2rem; opacity: 0.7;">Versione Corretta ✨</div>
                                            <div style="font-family: var(--font-body); font-size: 1.6rem; color: #065f46; line-height: 1.4; font-style: italic;">
                                                "${correction}"
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    };

    const renderOrderSentenceContent = (task) => {
        const content = task.content || {};
        const words = content.words || [];
        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';
        const correctText = content.original || content.text || content.correct_sentence || "";
        const correctArray = content.correctOrder || (correctText ? correctText.split(/\s+/) : []);
        
        const clean = (s) => String(s || "").toLowerCase().replace(/[.,!?;]/g, '').trim();
        
        let studentOrder = [];
        try {
            const source = task.student_answer || task.answers;
            studentOrder = typeof source === 'string' ? JSON.parse(source) : (source?.data || source || []);
        } catch(e) {}

        const renderTokens = () => {
            if (!isReadOnly) return '';
            if (!Array.isArray(studentOrder)) return '';
            
            return studentOrder.map((w, i) => {
                const isCorrect = correctArray[i] && clean(w) === clean(correctArray[i]);
                const borderColor = isCorrect ? '#16a34a' : '#dc2626';
                const bgColor = isCorrect ? '#f0fdf4' : '#fff1f2';
                const tag = isCorrect ? '✅' : '❌';

                return `
                    <div class="os-word-token disabled" style="border-color: ${borderColor}; background: ${bgColor}; position: relative;">
                        ${w}
                        <span style="position: absolute; top: -10px; right: -10px; font-size: 1.2rem; background: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid ${borderColor};">${tag}</span>
                    </div>
                `;
            }).join('');
        };

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>RIORDINA LA FRASE 🧩</span>
                    <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                </div>

                <div style="background: white; border-radius: 3rem; padding: 4.5rem; box-shadow: 0 10px 40px rgba(0,0,0,0.02); border: 1.5px solid rgba(0,0,0,0.03); margin-bottom: 4rem;">
                    <div id="os-target-zone" style="display: flex; flex-wrap: wrap; gap: 1.2rem; min-height: 12rem; align-content: flex-start; padding: 1rem; background: rgba(0,0,0,0.01); border-radius: 2rem; border: 2px dashed rgba(0,0,0,0.05); transition: all 0.3s;">
                        ${isReadOnly ? renderTokens() : ''}
                        ${!isReadOnly ? '<div style="opacity: 0.2; font-family: var(--font-handwritten); font-size: 2.2rem; text-align: center; width: 100%;">Clicca le parole nell\'ordine corretto...</div>' : ''}
                    </div>

                    ${isReadOnly && correctText ? `
                        <div style="margin-top: 4rem; padding: 3rem; background: #f0fdf4; border-radius: 2rem; border: 1.5px solid rgba(22, 163, 74, 0.1);">
                            <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; color: #166534; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 1.5rem; opacity: 0.6; display: flex; align-items: center; gap: 1rem;">
                                ORDINE CORRETTO 💡
                            </div>
                            <div style="font-family: var(--font-handwritten); font-size: 2.8rem; color: #166534; line-height: 1.3; font-style: italic;">
                                "${correctText}"
                            </div>
                        </div>
                    ` : ''}

                    ${!isReadOnly ? `
                        <div style="margin-top: 4rem;">
                            <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 800; opacity: 0.3; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 2.2rem; text-align: center;">Tocca le parole sotto per formare la frase</div>
                            <div id="os-words-pool" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 1.2rem; padding: 1rem;">
                                ${words.map((w, idx) => `<div class="os-word-token" data-word="${w}" data-idx="${idx}">${w}</div>`).join('')}
                            </div>
                            <div style="text-align: center; margin-top: 3.5rem;">
                                <button id="os-reset-btn" style="background: transparent; border: 1.5px solid rgba(0,0,0,0.1); color: rgba(0,0,0,0.4); font-family: var(--font-ui); font-size: 1rem; font-weight: 800; padding: 1rem 3rem; border-radius: 1.5rem; cursor: pointer; text-transform: uppercase; letter-spacing: 0.15em; transition: all 0.3s; display: inline-flex; align-items: center; gap: 1rem;">
                                    <span>🔄</span> Ricomincia
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    };

    const renderTranslationChoiceContent = (task) => {
        const c = task.content || {};
        const options = c.options || [];
        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';
        let chosen = null;
        try {
            const src = task.student_answer || task.answers;
            chosen = typeof src === 'string' ? src : (src?.data || src);
        } catch(e) {}

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>SCEGLI LA TRADUZIONE CORRETTA 🌍</span>
                    <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                </div>
                <div style="background: white; border-radius: 3.5rem; padding: 5rem 6.5rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">
                    <div style="font-family: var(--font-handwritten); font-size: 3.8rem; color: var(--color-ink); text-align: center; margin-bottom: 5rem; line-height: 1.3; background: #fffcfb; border-radius: 2rem; padding: 3rem 4rem; border: 1.5px solid rgba(107,16,36,0.06);">
                        🇦🇷 <em>${c.question || ''}</em>
                    </div>
                    <div id="tc-options" style="display: flex; flex-direction: column; gap: 1.8rem;">
                        ${options.map((opt, i) => {
                            const isChosen = chosen === opt;
                            const isCorrect = opt === c.correct;
                            let bg = 'white'; let border = 'rgba(0,0,0,0.06)'; let icon = '';
                            if (isReadOnly && isChosen && isCorrect) { bg='#f0fdf4'; border='#16a34a'; icon='✅'; }
                            else if (isReadOnly && isChosen && !isCorrect) { bg='#fff1f2'; border='#dc2626'; icon='❌'; }
                            else if (isReadOnly && isCorrect) { bg='#f0fdf4'; border='#16a34a'; icon='✅'; }
                            return `<div class="tc-option" data-val="${opt}" data-correct="${c.correct}" style="
                                padding: 2.2rem 3.5rem; border-radius: 1.8rem; border: 2px solid ${border};
                                background: ${bg}; cursor: ${isReadOnly ? 'default' : 'pointer'};
                                font-family: var(--font-body); font-size: 2rem; color: var(--color-ink);
                                display: flex; align-items: center; justify-content: space-between;
                                transition: all 0.25s; box-shadow: 0 4px 12px rgba(0,0,0,0.02);
                            ">
                                <span>🇮🇹 ${opt}</span>
                                <span>${icon}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    };

    const renderErrorCorrectionContent = (task) => {
        const c = task.content || {};
        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';
        let studentAnswer = '';
        try {
            const src = task.student_answer || task.answers;
            studentAnswer = typeof src === 'string' ? src : (src?.data || src || '');
        } catch(e) {}

        const normalize = (s) => (s || '').trim().toLowerCase();
        const isCorrect = isReadOnly && normalize(studentAnswer) === normalize(c.correct);

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>CORREGGI LA FRASE ✏️</span>
                    <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                </div>
                <div style="background: white; border-radius: 3.5rem; padding: 5rem 6.5rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">
                    <div style="margin-bottom: 4rem;">
                        <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.35; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 1.5rem;">Frase da Correggere</div>
                        <div style="font-family: var(--font-handwritten); font-size: 3rem; color: #dc2626; background: #fff1f2; border-radius: 1.5rem; padding: 2.5rem 3.5rem; border: 1.5px solid #fecaca; line-height: 1.4;">
                            ❌ ${c.incorrect || ''}
                        </div>
                    </div>
                    <div>
                        <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.35; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 1.5rem;">La tua Correzione</div>
                        ${isReadOnly 
                            ? `<div style="font-family: var(--font-handwritten); font-size: 3rem; padding: 2.5rem 3.5rem; border-radius: 1.5rem; background: ${isCorrect ? '#f0fdf4' : '#fff1f2'}; border: 1.5px solid ${isCorrect ? '#16a34a' : '#dc2626'}; color: var(--color-ink);
                            ">${isCorrect ? '✅' : '❌'} ${studentAnswer}
                            ${!isCorrect ? `<div style="font-size:2.2rem; margin-top:1.5rem; opacity:0.7;">👉 Corretta: <em>${c.correct}</em></div>` : ''}
                            </div>`
                            : `<textarea id="ec-input" class="teacher-textarea" placeholder="Scrivi la frase corretta..." style="font-family: var(--font-handwritten); font-size: 2.6rem; color: var(--color-ink); border-radius: 1.5rem; border: 2px solid rgba(0,0,0,0.06); padding: 2.5rem; width: 100%; resize: vertical;">${studentAnswer}</textarea>`
                        }
                    </div>
                </div>
            </div>
        `;
    };

    const renderFlashcardsContent = (task) => {
        const c = task.content || {};
        const words = c.pairs || c.items || c.words || c.mazzo || c.flashcards || c.cards || (Array.isArray(c.data) ? c.data : []);

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 3.5rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>ATELIER DEL LESSICO 📚</span>
                    <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 4rem;">
                    ${words.map((w, idx) => {
                        const itWord = w.italiano || w.it || w.parola || w.word || '';
                        const esTrans = w.español || w.es || w.traduzione || w.traduccion || w.translation || '';
                        const ex = w.esempio || w.ejemplo || w.example || '';
                        
                        return `
                        <div class="flashcard-container" data-index="${idx}">
                            <div class="flashcard-inner">
                                <div class="flashcard-front">
                                    <div class="flashcard-pulse"></div>
                                    <div style="font-family: var(--font-body); font-size: 2.8rem; font-weight: 500; color: var(--color-ink); word-break: break-word; opacity: 0.9;">${esTrans || '?'}</div>
                                    <div class="flashcard-hint">
                                        <span style="font-size: 1.2rem;">✨</span>
                                        <span>GIRA PER TRADURRE</span>
                                    </div>
                                </div>
                                <div class="flashcard-back">
                                    <div style="font-family: var(--font-body); font-size: 3.4rem; color: var(--color-terracota); font-weight: 700; margin-bottom: 1.5rem; word-break: break-word;">${itWord || '?'}</div>
                                    <div style="width: 4rem; height: 3px; background: var(--color-terracota); opacity: 0.15; margin-bottom: 2.5rem; border-radius: 2px;"></div>
                                    ${ex ? `<div style="font-family: var(--font-body); font-size: 1.5rem; opacity: 0.5; font-style: italic; line-height: 1.6; max-width: 85%; text-align: center; color: var(--color-ink);">"${ex}"</div>` : ''}
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    };

    const renderDettatoContent = (task) => {
        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';
        const c = task.content || {};
        const isComprensione = !c.mode || c.mode === 'comprensione';
        const questions = c.questions || [];
        let studentAnswer = '';
        try {
            const src = task.student_answer || task.answers;
            if (typeof src === 'string') {
                if (src.startsWith('{') || src.startsWith('[')) {
                    studentAnswer = JSON.parse(src);
                } else {
                    studentAnswer = src;
                }
            } else {
                studentAnswer = src?.data ?? src ?? (isComprensione ? '' : {});
            }
        } catch(e) { 
            studentAnswer = isComprensione ? '' : {}; 
        }

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>DETTATO 🎧</span>
                    <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                </div>
                <div style="background: white; border-radius: 3.5rem; padding: 5rem 6.5rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">

                    <div style="display: flex; flex-direction: column; align-items: center; gap: 1.5rem; margin-bottom: 4rem;">
                        <audio id="dettato-audio" src="${task.audio_url || ''}" preload="auto"></audio>
                        <div style="display: flex; gap: 1.5rem; align-items: center;">
                            ${!isReadOnly ? `<button id="dettato-slow-btn" title="Cambia velocità" style="background: rgba(0,0,0,0.06); border: none; padding: 0.7rem 1.4rem; border-radius: 2rem; font-family: var(--font-ui); font-weight: 800; font-size: 1rem; color: var(--color-ink); cursor: pointer; transition: 0.2s;">1×</button>` : ''}
                            <button id="dettato-play-btn" style="width: 7rem; height: 7rem; border-radius: 50%; background: var(--color-terracota); color: white; border: none; font-size: 2.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; box-shadow: 0 10px 30px rgba(196,96,58,0.3);">▶</button>
                        </div>
                        ${!isReadOnly && isComprensione ? `<div id="dettato-plays-left" style="font-family: var(--font-ui); font-size: 1.05rem; font-weight: 800; color: var(--color-ink); opacity: 0.6;">Riproduzioni rimaste: <strong>5</strong></div>` : ''}
                    </div>

                    ${isReadOnly && (c.text || c.refText) ? `
                    <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.35; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 1.5rem;">Testo di Riferimento</div>
                    <div style="font-family: var(--font-body); font-size: 2.2rem; color: var(--color-terracota); background: rgba(196,96,58,0.05); padding: 3rem; border-radius: 1.5rem; margin-bottom: 3rem; border: 1.5px solid rgba(196,96,58,0.1);">${c.text || c.refText}</div>
                    ` : ''}

                    ${isComprensione ? `
                    <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.35; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 1.5rem;">Il Tuo Testo</div>
                    <textarea id="dettato-input" class="teacher-textarea" placeholder="Scrivi quello che senti..." style="font-family: var(--font-handwritten); font-size: 2.8rem; color: var(--color-ink); border-radius: 1.5rem; border: 2px solid rgba(0,0,0,0.06); padding: 3rem; width: 100%; min-height: 20rem; resize: vertical;" ${isReadOnly ? 'readonly' : ''}>${typeof studentAnswer === 'string' ? studentAnswer : ''}</textarea>
                    ` : `
                    <div style="display: flex; flex-direction: column; gap: 3rem;">
                        ${questions.map((q, i) => `
                            <div>
                                <div style="font-family: var(--font-body); font-size: 2rem; color: var(--color-ink); font-weight: 600; margin-bottom: 1rem;">${i + 1}. ${q}</div>
                                <textarea class="teacher-textarea dettato-q-ans" data-idx="${i}" placeholder="La tua risposta..." style="font-family: var(--font-handwritten); font-size: 2.4rem; color: var(--color-ink); border-radius: 1.5rem; border: 2px solid rgba(0,0,0,0.06); padding: 2rem; width: 100%; min-height: 10rem; resize: vertical;" ${isReadOnly ? 'readonly' : ''}>${(typeof studentAnswer === 'object' && studentAnswer !== null) ? (studentAnswer[i] || '') : ''}</textarea>
                            </div>
                        `).join('')}
                    </div>
                    `}
                </div>
            </div>
        `;
    };

    const renderPronunciaContent = (task) => {
        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';
        const c = task.content || {};
        let existingAudioUrl = '';
        if (isReadOnly) {
            try {
                const src = task.student_answer || task.answers;
                if (typeof src === 'string') {
                    if (src.startsWith('{')) {
                        const parsed = JSON.parse(src);
                        existingAudioUrl = parsed?.audio_url || '';
                    }
                } else {
                    existingAudioUrl = src?.audio_url || '';
                }
            } catch(e) {}
        }

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>PRONUNCIA 🎤</span>
                    <div style="flex: 1; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                </div>
                <div style="background: white; border-radius: 3.5rem; padding: 5rem 6.5rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">

                    ${c.mode === 'lettura' ? `
                        <div style="background: #fafafa; padding: 3rem; border-radius: 24px; border: 1px solid rgba(0,0,0,0.03); margin-bottom: 3rem;">
                            <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.35; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2rem;">Testo da Leggere</div>
                            <div style="font-family: var(--font-body); font-size: 2.8rem; color: var(--color-ink); font-weight: 600; line-height: 1.3; letter-spacing: -0.02em;">${c.text || c.refText || ''}</div>
                        </div>

                        ${c.note ? `
                        <div style="background: #fffcf8; padding: 2rem 2.5rem; border-radius: 20px; border: 1.5px dashed rgba(166,77,50,0.25); color: var(--color-terracota); font-family: var(--font-body); margin-bottom: 3rem; display: flex; gap: 1.5rem; align-items: flex-start;">
                            <div style="font-size: 2rem; margin-top: -0.2rem;">💡</div>
                            <div>
                                <div style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 950; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem;">Suggerimento del Maestro</div>
                                <div style="font-size: 1.4rem; line-height: 1.5; color: rgba(166,77,50,0.9);">${c.note}</div>
                            </div>
                        </div>` : ''}
                    ` : ''}

                    ${c.mode === 'ripetizione' ? `
                        <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.35; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 1.5rem;">Ascolta e Ripeti</div>
                        <audio controls src="${task.audio_url || ''}" style="width: 100%; max-width: 400px; margin-bottom: 2rem; display: block;"></audio>
                        ${c.text ? `<div style="font-family: var(--font-body); font-size: 2.2rem; color: var(--color-ink); margin-bottom: 3rem; opacity: 0.8; font-style: italic;">"${c.text}"</div>` : ''}
                    ` : ''}

                    ${c.mode === 'parlato_libero' ? `
                        <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.35; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 1.5rem;">La Consigna</div>
                        <div style="font-family: var(--font-body); font-size: 2.2rem; color: var(--color-ink); margin-bottom: 3rem; line-height: 1.4;">${c.text || ''}</div>
                    ` : ''}

                    <div style="width: 100%; height: 1.5px; background: rgba(0,0,0,0.06); margin: 3rem 0;"></div>

                    ${isReadOnly ? `
                        <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.35; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 1.5rem;">La Tua Registrazione</div>
                        ${existingAudioUrl ? `<audio controls src="${existingAudioUrl}" style="width: 100%; max-width: 420px; display: block;"></audio>` : `<div style="opacity:0.5; font-family:var(--font-ui);">Nessuna registrazione.</div>`}
                    ` : `
                        <div id="pronuncia-recorder-mount"></div>
                        <div id="pronuncia-attempts" style="text-align: center; margin-top: 1.5rem; font-family: var(--font-ui); font-size: 1.1rem; font-weight: 800; color: var(--color-ink); opacity: 0.6;">Tentativi rimasti: <strong>3</strong></div>
                    `}
                </div>
            </div>
        `;
    };


    const renderMemoryContent = (task) => {
        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';
        let attempts = 0;
        try {
            const src = task.student_answer || task.answers;
            attempts = parseInt(typeof src === 'string' ? JSON.parse(src) : (src?.data || src || 0));
        } catch(e) {}

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;">
                    <span style="display: flex; align-items: center; gap: 1.5rem;"><span>MEMORIA 🃏</span> <div style="height: 1.5px; width: 60px; background: rgba(0,0,0,0.15);"></div></span>
                    ${isReadOnly ? `<span style="font-size: 1.6rem; font-weight: 800; color: var(--color-olive);">Completato in ${attempts || '?'} tentativi</span>` : `<span id="memory-score" style="font-size: 1.6rem; font-weight: 800; color: var(--color-ink);">Tentativi: 0</span>`}
                </div>
                <div style="background: rgba(0,0,0,0.02); border-radius: 3.5rem; padding: 5rem 6.5rem; border: 1px solid rgba(0,0,0,0.03);">
                    ${isReadOnly ? 
                      `<div style="text-align: center; font-family: var(--font-body); font-size: 2.4rem; color: var(--color-olive); font-weight: 700; padding: 6rem 0;">🎉 Bravi! Gioco completato.</div>` 
                      : 
                      `<div id="memory-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 2rem; perspective: 1000px;"></div>`
                    }
                </div>
            </div>
        `;
    };

    const renderSpeedContent = (task) => {
        const isReadOnly = task.status !== 'pending' && task.status !== 'draft';
        let savedData = { score: 0, completedIndices: [] };
        try {
            const src = task.student_answer || task.answers;
            if (typeof src === 'string' && src.startsWith('{')) {
                savedData = JSON.parse(src);
            } else if (typeof src === 'object' && src !== null) {
                savedData = src;
            } else {
                savedData = { score: Number(src) || 0, completedIndices: [] };
            }
        } catch(e) {
            savedData = { score: 0, completedIndices: [] };
        }

        const words = task.content?.words || [];
        const completedIndices = Array.isArray(savedData.completedIndices) ? savedData.completedIndices.map(Number) : [];
        const score = savedData.score || completedIndices.length;

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;">
                    <span style="display: flex; align-items: center; gap: 1.5rem;"><span>VELOCITÀ ⚡</span> <div style="height: 1.5px; width: 60px; background: rgba(0,0,0,0.15);"></div></span>
                    ${isReadOnly ? `<span style="font-size: 1.6rem; font-weight: 800; color: var(--color-terracota);">Score: ${score} parole</span>` : `<span id="speed-timer" style="font-size: 2.4rem; font-weight: 900; color: var(--color-ink); font-variant-numeric: tabular-nums;">60s</span>`}
                </div>
                <div style="background: var(--color-espresso); border-radius: 3.5rem; padding: 6rem 5rem; position: relative; overflow: hidden; box-shadow: 0 20px 40px rgba(28,15,7,0.15);">
                    ${!isReadOnly ? `<div id="speed-progress" style="position: absolute; bottom: 0; left: 0; height: 6px; background: var(--color-terracota); width: 100%; transform-origin: left; transition: transform 1s linear;"></div>` : ''}
                    
                    ${isReadOnly ? 
                      `
                      <div style="text-align: center; margin-bottom: 5rem;">
                          <div style="font-family: var(--font-body); font-size: 3.5rem; color: var(--color-parchment); font-weight: 700;">Il tuo record: <span style="color: var(--color-terracota);">${score}</span> parole</div>
                      </div>
                      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.5rem;">
                        ${words.map((w, i) => {
                            const isDone = completedIndices.includes(Number(i));
                            const color = isDone ? '#10b981' : '#ef4444';
                            const bgColor = isDone ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                            return `
                                <div style="padding: 1.5rem; border-radius: 12px; background: ${bgColor}; border: 1.5px solid ${color}44; display: flex; flex-direction: column; gap: 0.5rem; text-align: center;">
                                    <div style="font-family: var(--font-body); font-size: 1.2rem; color: white; font-weight: 600; opacity: 0.9;">${task.content.direction === 'it-es' ? (w.it || w.word) : (w.es || w.translation)}</div>
                                    <div style="height: 1px; background: white; opacity: 0.1; margin: 0.3rem 0;"></div>
                                    <div style="font-family: var(--font-body); font-size: 1.2rem; color: ${color}; font-weight: 800;">${task.content.direction === 'it-es' ? (w.es || w.translation) : (w.it || w.word)}</div>
                                </div>
                            `;
                        }).join('')}
                      </div>
                      `
                      :
                      `
                      <div id="speed-start-screen" style="text-align: center;">
                          <div style="font-family: var(--font-body); font-size: 2.6rem; color: white; margin-bottom: 2rem; font-weight: 600;">Traduci più parole che puoi in 60s!</div>
                          <button id="speed-start-btn" style="background: var(--color-terracota); color: white; border: none; padding: 1.8rem 5rem; border-radius: 4rem; font-size: 1.8rem; font-weight: 800; cursor: pointer; text-transform: uppercase; letter-spacing: 0.15em; transition: transform 0.2s;">INIZIA</button>
                      </div>
                      <div id="speed-game-screen" style="display: none; text-align: center;">
                          <div id="speed-current-word" style="font-family: var(--font-heading); font-size: 6rem; color: var(--color-parchment); font-weight: 700; margin-bottom: 4rem; opacity: 1; transition: all 0.2s; transform-origin: center;">...</div>
                          <input type="text" id="speed-input" autocomplete="off" style="width: 100%; max-width: 40rem; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); border-radius: 2rem; padding: 2rem; font-size: 2.8rem; color: white; text-align: center; font-family: var(--font-body); outline: none; transition: border-color 0.2s;" placeholder="Scrivi qui...">
                          <div style="display: flex; justify-content: center; align-items: center; gap: 3rem; margin-top: 3.5rem;">
                              <div id="speed-counter-display" style="font-family: var(--font-ui); font-size: 1.1rem; font-weight: 900; color: var(--color-terracota); background: rgba(255,255,255,0.05); padding: 0.8rem 1.8rem; border-radius: 4rem; border: 1.5px solid rgba(255,255,255,0.1); letter-spacing: 0.15em; display: flex; align-items: center; gap: 1rem;">
                                  <span style="opacity: 0.5;">PROGRESO</span>
                                  <span id="speed-count-num" style="color: white; font-size: 1.6rem;">0 / ${words.length}</span>
                              </div>
                              <div id="speed-score-display" style="font-family: var(--font-ui); font-size: 1.1rem; font-weight: 800; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.2em;">CORRETTE: <span style="color: #10b981; font-size: 1.8rem; margin-left: 0.5rem;">0</span></div>
                          </div>
                          <button id="speed-skip-btn" style="margin-top: 4rem; background: transparent; border: 1.5px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.4); font-family: var(--font-ui); font-size: 1.1rem; font-weight: 800; padding: 1.2rem 3rem; border-radius: 1.5rem; cursor: pointer; text-transform: uppercase; letter-spacing: 0.15em; transition: all 0.3s;">Saltear palabra ⏭</button>
                      </div>
                      <div id="speed-end-screen" style="display: none; text-align: center;">
                          <div style="font-family: var(--font-heading); font-size: 4rem; color: white; margin-bottom: 1rem;">Tempo Esaurito!</div>
                          <div style="font-family: var(--font-body); font-size: 2.2rem; color: rgba(255,255,255,0.7); margin-bottom: 3rem;">Hai tradotto <span id="speed-final-score" style="color: var(--color-terracota); font-weight: 800; font-size: 3rem;">0</span> parole</div>
                      </div>
                      <div id="speed-perfect-msg" style="display: none; text-align: center; background: #10b981; padding: 2.5rem; border-radius: 2rem; margin-top: 2rem; animation: coutureSlideIn 0.5s ease;">
                           <div style="font-family: var(--font-heading); font-size: 2.2rem; color: white; margin-bottom: 0.5rem;">✨ ECCELSO! ✨</div>
                           <div style="font-family: var(--font-body); font-size: 1.4rem; color: white; opacity: 0.9;">Tutte le parole completate. Invio automatico...</div>
                      </div>
                      `
                    }
                </div>
            </div>
        `;
    };

    const close = () => {
        if (autosaveInterval) clearInterval(autosaveInterval);
        if (speedTimerInterval) clearInterval(speedTimerInterval);
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        overlay.style.opacity = '0';

        modal.style.transform = 'scale(0.96) translateY(15px)';
        modal.style.filter = 'blur(4px)';
        setTimeout(() => {
            overlay.style.visibility = 'hidden';
            overlay.style.display = 'none';
        }, 200); 
    };

    const open = async (task) => {
        currentTask = task;
        
        // --- 1. Load Draft if Pending ---
        let draftAnswers = null;
        if (task.status === 'pending' || task.status === 'draft') {
            const { data: draft } = await getDraft(task.assignment_id);
            if (draft) {
                 draftAnswers = draft.answers;
                 // Pre-inject draft answers into task object for render functions
                 currentTask.student_answer = draftAnswers;
            }
        }

        modal.innerHTML = renderHeader(task);
        
        // --- Instructions Block ---
        if (task.status === 'pending' || task.status === 'draft') {
            modal.innerHTML += renderInstruction(task);
        }

        modal.innerHTML += renderFeedback(task);

        const type = task.type?.toLowerCase();
        if (type === 'fill' || type === 'completare') modal.innerHTML += renderFillContent(task);
        else if (type === 'translation' || type === 'traduzione') modal.innerHTML += renderTranslationContent(task);
        else if (type === 'roleplay' || type === 'conversazione') modal.innerHTML += renderRoleplayContent(task);
        else if (type === 'flashcard' || type === 'flashcards' || type === 'lessico') modal.innerHTML += renderFlashcardsContent(task);
        else if (type === 'fill_choice') modal.innerHTML += renderFillChoiceContent(task);
        else if (type === 'order_sentence') modal.innerHTML += renderOrderSentenceContent(task);
        else if (type === 'translation_choice') modal.innerHTML += renderTranslationChoiceContent(task);
        else if (type === 'error_correction') modal.innerHTML += renderErrorCorrectionContent(task);
        else if (type === 'dictation') modal.innerHTML += renderDictationContent(task);
        else if (type === 'dettato') modal.innerHTML += renderDettatoContent(task);
        else if (type === 'pronuncia') modal.innerHTML += renderPronunciaContent(task);
        else if (type === 'memory') modal.innerHTML += renderMemoryContent(task);
        else if (type === 'speed') modal.innerHTML += renderSpeedContent(task);

        // CHOICE GAP LOGIC
        if (type === 'fill_choice' && task.status === 'pending') {
            const gaps = modal.querySelectorAll('.choice-gap');
            let studentAnswers = [];
            try {
                const src = task.student_answer || task.answers;
                studentAnswers = typeof src === 'string' ? JSON.parse(src) : (src?.data || src || []);
                if (!Array.isArray(studentAnswers)) studentAnswers = [];
            } catch(e) {}
            
            gaps.forEach(gap => {
                const idx = parseInt(gap.dataset.idx);
                const dropdown = gap.querySelector('.choice-dropdown');
                const label = gap.querySelector('.choice-label');
                
                gap.onclick = (e) => {
                    e.stopPropagation();
                    // Close other dropdowns
                    modal.querySelectorAll('.choice-dropdown').forEach(d => { if (d !== dropdown) d.style.display = 'none'; });
                    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                };
                
                dropdown.querySelectorAll('.choice-option').forEach(opt => {
                    opt.onclick = (e) => {
                        e.stopPropagation();
                        const val = opt.dataset.val;
                        label.innerText = val;
                        studentAnswers[idx] = val;
                        dropdown.style.display = 'none';
                        gap.style.borderColor = 'var(--color-bordo)';
                        gap.style.background = 'rgba(107, 16, 36, 0.03)';
                        gap.style.color = 'var(--color-bordo)';
                        gap.dataset.current = val;
                    };
                });
            });
            
            // Close dropdowns on outside click
            modal.onclick = (e) => {
                if (!e.target.closest('.choice-gap')) {
                    modal.querySelectorAll('.choice-dropdown').forEach(d => d.style.display = 'none');
                }
            };
        }

        // ORDER SENTENCE LOGIC
        if (type === 'order_sentence' && (task.status === 'pending' || task.status === 'draft')) {
            const pool = modal.querySelector('#os-words-pool');
            const target = modal.querySelector('#os-target-zone');
            const resetBtn = modal.querySelector('#os-reset-btn');
            let selections = [];

            const updateUI = () => {
                target.innerHTML = selections.length === 0 
                  ? '<div style="opacity: 0.2; font-family: var(--font-handwritten); font-size: 2.2rem; text-align: center; width: 100%;">Clicca le parole nell\'ordine corretto...</div>'
                  : selections.map((s, i) => `<div class="os-word-token os-target-zone-token" data-target-idx="${i}" style="position: relative;">${s.word}</div>`).join('');
                
                pool.querySelectorAll('.os-word-token').forEach(token => {
                    const idx = token.dataset.idx;
                    const isUsed = selections.some(s => String(s.idx) === String(idx));
                    token.classList.toggle('selected', isUsed);
                    token.style.display = isUsed ? 'none' : 'inline-flex';
                });
            };

            // Recover draft if available
            let draftOrder = [];
            try {
                const src = task.student_answer || task.answers;
                draftOrder = typeof src === 'string' ? JSON.parse(src) : (src?.data || src || []);
            } catch(e) {}

            if (Array.isArray(draftOrder) && draftOrder.length > 0) {
                const poolTokens = Array.from(pool.querySelectorAll('.os-word-token'));
                const usedIds = new Set();
                draftOrder.forEach(word => {
                    const token = poolTokens.find(t => t.dataset.word === word && !usedIds.has(t.dataset.idx));
                    if (token) {
                        selections.push({ word: token.dataset.word, idx: token.dataset.idx });
                        usedIds.add(token.dataset.idx);
                    }
                });

                // Show save status if we recovered something
                const statusEl = modal.querySelector('#autosave-status');
                if (statusEl) statusEl.style.display = 'block';
            }

            target.onclick = (e) => {
                const token = e.target.closest('.os-target-zone-token');
                if (!token) return;
                
                const targetIdx = parseInt(token.dataset.targetIdx);
                if (!isNaN(targetIdx)) {
                    selections.splice(targetIdx, 1);
                    updateUI();
                }
            };

            pool.onclick = (e) => {
                const token = e.target.closest('.os-word-token');
                if (!token || token.classList.contains('selected')) return;
                selections.push({ word: token.dataset.word, idx: token.dataset.idx });
                updateUI();
            };

            if (resetBtn) resetBtn.onclick = () => { selections = []; updateUI(); };
            
            // Initialization
            updateUI();
        }
        // TRANSLATION CHOICE - immediate feedback on click
        if (type === 'translation_choice' && task.status === 'pending') {
            let tcSelected = null;
            modal.querySelectorAll('.tc-option').forEach(opt => {
                opt.onmouseenter = () => { if (!tcSelected) opt.style.transform = 'translateX(6px)'; };
                opt.onmouseleave = () => { if (!tcSelected) opt.style.transform = ''; };
                opt.onclick = () => {
                    tcSelected = opt.dataset.val;
                    const correct = opt.dataset.correct;
                    modal.querySelectorAll('.tc-option').forEach(o => {
                        const isThis = o.dataset.val === tcSelected;
                        const isCorrect = o.dataset.val === correct;
                        o.style.transform = '';
                        o.style.opacity = (isThis || isCorrect) ? '1' : '0.35';
                        if (isThis && isCorrect) { o.style.background='#f0fdf4'; o.style.borderColor='#16a34a'; o.querySelector('span:last-child').textContent='✅'; }
                        else if (isThis && !isCorrect) { o.style.background='#fff1f2'; o.style.borderColor='#dc2626'; o.querySelector('span:last-child').textContent='❌'; }
                        else if (isCorrect) { o.style.background='#f0fdf4'; o.style.borderColor='#16a34a'; o.querySelector('span:last-child').textContent='✅'; }
                        if (isThis) o.setAttribute('data-selected', 'true');
                        o.style.cursor = 'default';
                        o.onclick = null;
                    });
                };
            });
        }

        // LEGACY DICTATION LOGIC (uses SpeechSynthesis)
        if (type === 'dictation' && task.status === 'pending') {
            const playBtn = modal.querySelector('#dettato-play');
            let utterance = null;
            playBtn.onclick = () => {
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.cancel();
                    playBtn.innerHTML = '▶';
                    playBtn.style.transform = 'scale(1)';
                    return;
                }
                utterance = new SpeechSynthesisUtterance(task.content?.text || '');
                utterance.lang = 'it-IT';
                utterance.rate = 0.85;
                utterance.onend = () => {
                    playBtn.innerHTML = '▶';
                    playBtn.style.transform = 'scale(1)';
                };
                playBtn.innerHTML = '⏸';
                playBtn.style.transform = 'scale(0.95)';
                window.speechSynthesis.speak(utterance);
            };
        }

        // DETTATO LOGIC (audio file from Giancarlo)
        if (type === 'dettato') {
            const audioEl = modal.querySelector('#dettato-audio');
            const playBtn = modal.querySelector('#dettato-play-btn');
            const slowBtn = modal.querySelector('#dettato-slow-btn');
            const playsLeftEl = modal.querySelector('#dettato-plays-left');
            const c = task.content || {};
            const isComprensione = !c.mode || c.mode === 'comprensione';
            const MAX_PLAYS = isComprensione ? 5 : Infinity;
            let playsLeft = MAX_PLAYS;
            let isSlow = false;

            if (!audioEl || !playBtn) return;

            if (slowBtn) {
                slowBtn.onclick = () => {
                    isSlow = !isSlow;
                    audioEl.playbackRate = isSlow ? 0.7 : 1.0;
                    slowBtn.innerText = isSlow ? '0.7×' : '1×';
                    slowBtn.style.background = isSlow ? 'rgba(196,96,58,0.15)' : 'rgba(0,0,0,0.06)';
                    slowBtn.style.color = isSlow ? 'var(--color-terracota)' : 'var(--color-ink)';
                };
            }

            audioEl.onended = () => {
                playBtn.innerHTML = '▶';
                playBtn.style.transform = 'scale(1)';
                playBtn.style.opacity = '1';
            };

            playBtn.onclick = () => {
                if (!audioEl.paused) {
                    audioEl.pause();
                    playBtn.innerHTML = '▶';
                    return;
                }
                if (MAX_PLAYS !== Infinity && playsLeft <= 0) {
                    toast.show('Hai esaurito le riproduzioni disponibili.', 'warning');
                    return;
                }
                audioEl.currentTime = 0;
                audioEl.playbackRate = isSlow ? 0.7 : 1.0;
                audioEl.play();
                playBtn.innerHTML = '⏸';
                if (isComprensione && MAX_PLAYS !== Infinity) {
                    playsLeft--;
                    if (playsLeftEl) {
                        playsLeftEl.innerHTML = playsLeft > 0
                            ? `Riproduzioni rimaste: <strong>${playsLeft}</strong>`
                            : `<span style="color:#dc2626;">Nessuna riproduzione rimasta.</span>`;
                    }
                    if (playsLeft <= 0) {
                        playBtn.style.opacity = '0.4';
                    }
                }
            };
        }

        // PRONUNCIA LOGIC
        if (type === 'pronuncia' && task.status === 'pending') {
            const mount = modal.querySelector('#pronuncia-recorder-mount');
            const attemptsEl = modal.querySelector('#pronuncia-attempts');
            if (!mount) return;

            const MAX_ATTEMPTS = 3;
            let attemptsLeft = MAX_ATTEMPTS;
            let currentBlob = null;

            const updateAttempts = () => {
                if (!attemptsEl) return;
                attemptsEl.innerHTML = attemptsLeft > 0
                    ? `Tentativi rimasti: <strong>${attemptsLeft}</strong>`
                    : `<span style="color:#dc2626;">Nessun tentativo rimasto.</span>`;
            };

            const recorder = AudioRecorder((blob, confirmed) => {
                if (blob) currentBlob = blob;
            }, 120, false);

            const origReset = recorder.querySelector ? null : null;
            // Intercept reset to track attempts
            const allBtns = recorder.querySelectorAll ? recorder.querySelectorAll('button') : [];
            allBtns.forEach(btn => {
                if (btn.innerText.includes('Volver') || btn.innerText.includes('grabar')) {
                    const origClick = btn.onclick;
                    btn.onclick = () => {
                        attemptsLeft--;
                        updateAttempts();
                        if (attemptsLeft <= 0) {
                            btn.disabled = true;
                            btn.style.opacity = '0.4';
                        }
                        if (origClick) origClick();
                    };
                }
            });

            mount.appendChild(recorder);
            // Store blob reference on mount for submit handler
            mount._getBlob = () => currentBlob;
            mount._attemptsLeft = () => attemptsLeft;
        }

        // MEMORY LOGIC
        if (type === 'memory' && task.status === 'pending') {
            const grid = modal.querySelector('#memory-grid');
            const scoreEl = modal.querySelector('#memory-score');
            let attempts = 0;
            let matchedPairs = 0;
            const pairs = task.content?.pairs || [];
            const totalPairs = pairs.length;
            
            let cards = [];
            pairs.forEach((p, i) => {
                cards.push({ text: p.it, matchId: i, lang: 'it' });
                cards.push({ text: p.es, matchId: i, lang: 'es' });
            });
            cards = cards.sort(() => Math.random() - 0.5);

            grid.innerHTML = cards.map((c, i) => `
                <div class="memory-card" data-id="${i}" data-match="${c.matchId}" style="width: 100%; aspect-ratio: 1; position: relative; cursor: pointer; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <div class="card-face card-front" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: white; border-radius: 2rem; border: 2px solid rgba(0,0,0,0.05); box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: center; font-size: 4rem; color: var(--color-terracota);">
                        ${c.lang === 'it' ? '🇮🇹' : '🇦🇷'}
                    </div>
                    <div class="card-face card-back" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: var(--color-parchment); border-radius: 2rem; border: 2px solid var(--color-terracota); display: flex; align-items: center; justify-content: center; transform: rotateY(180deg); padding: 1.5rem; text-align: center;">
                        <span style="font-family: var(--font-body); font-size: 2rem; font-weight: 600; color: var(--color-terracota); line-height: 1.2;">${c.text}</span>
                    </div>
                </div>
            `).join('');

            let flippedCards = [];
            let lockBoard = false;

            grid.querySelectorAll('.memory-card').forEach(card => {
                card.onclick = () => {
                    if (lockBoard) return;
                    if (card.classList.contains('flipped')) return;
                    
                    card.style.transform = 'rotateY(180deg)';
                    card.classList.add('flipped');
                    flippedCards.push(card);

                    if (flippedCards.length === 2) {
                        attempts++;
                        scoreEl.innerText = `Tentativi: ${attempts}`;
                        lockBoard = true;
                        const match1 = flippedCards[0].dataset.match;
                        const match2 = flippedCards[1].dataset.match;

                        if (match1 === match2) {
                            matchedPairs++;
                            flippedCards[0].style.borderColor = 'var(--color-olive)';
                            flippedCards[1].style.borderColor = 'var(--color-olive)';
                            flippedCards[0].querySelector('.card-back').style.background = '#f0fdf4';
                            flippedCards[1].querySelector('.card-back').style.background = '#f0fdf4';
                            flippedCards = [];
                            lockBoard = false;
                            
                            if (matchedPairs === totalPairs) {
                                setTimeout(() => {
                                    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; font-family: var(--font-body); font-size: 2.6rem; color: var(--color-olive); font-weight: 700; padding: 4rem 0; animation: coutureFadeIn 0.8s ease-out;">Hai vinto in ${attempts} tentativi! 🎉</div>`;
                                    grid.dataset.completed = "true";
                                    grid.dataset.attempts = attempts;
                                }, 500);
                            }
                        } else {
                            setTimeout(() => {
                                flippedCards[0].style.transform = 'rotateY(0)';
                                flippedCards[0].classList.remove('flipped');
                                flippedCards[1].style.transform = 'rotateY(0)';
                                flippedCards[1].classList.remove('flipped');
                                flippedCards = [];
                                lockBoard = false;
                            }, 1200);
                        }
                    }
                };
            });
        }

        // SPEED LOGIC
        if (type === 'speed' && task.status === 'pending') {
            const startBtn = modal.querySelector('#speed-start-btn');
            const startScreen = modal.querySelector('#speed-start-screen');
            const gameScreen = modal.querySelector('#speed-game-screen');
            const endScreen = modal.querySelector('#speed-end-screen');
            const wordDisplay = modal.querySelector('#speed-current-word');
            const inputMask = modal.querySelector('#speed-input');
            const scoreDisplay = modal.querySelector('#speed-score-display span');
            const finalScoreDisplay = modal.querySelector('#speed-final-score');
            const timerDisplay = modal.querySelector('#speed-timer');
            const progressBar = modal.querySelector('#speed-progress');
            const speedCountDisplay = modal.querySelector('#speed-count-num');
            
            let words = JSON.parse(JSON.stringify(task.content?.words || []));
            let dir = task.content?.direction || 'it-es';
            let score = 0;
            let timeLeft = 60;
            let currentWordObj = null;
            let completedIndices = [];
            let skippedIndices = [];
            
            const clean = (str) => String(str || "").toLowerCase().trim().replace(/[.,!?;]/g, '');
            
            const updateCountDisplay = () => {
                if (speedCountDisplay) {
                    speedCountDisplay.innerText = `${completedIndices.length + skippedIndices.length} / ${words.length}`;
                }
            };

            const nextWord = () => {
                const available = words.map((w, i) => i).filter(i => !completedIndices.includes(i) && !skippedIndices.includes(i));
                
                if (available.length === 0) {
                    // All words done (either completed or skipped)
                    endGame(skippedIndices.length === 0);
                    return;
                }
                
                const nextIdx = available[Math.floor(Math.random() * available.length)];
                currentWordObj = words[nextIdx];
                currentWordObj._idx = nextIdx;
                
                wordDisplay.style.transform = 'scale(0.8)';
                wordDisplay.style.opacity = '0';
                
                setTimeout(() => {
                    wordDisplay.innerText = dir === 'it-es' ? (currentWordObj.it || '') : (currentWordObj.es || '');
                    wordDisplay.style.transform = 'scale(1)';
                    wordDisplay.style.opacity = '1';
                }, 150);
                
                inputMask.value = '';
                updateCountDisplay();
            };

            const endGame = (isPerfect = false) => {
                clearInterval(speedTimerInterval);
                gameScreen.style.display = 'none';
                endScreen.style.display = 'block';
                finalScoreDisplay.innerText = score;
                inputMask.blur();
                
                gameScreen.dataset.completed = "true";
                // Store detailed data for the professor: { score, completedIndices, skippedIndices }
                gameScreen.dataset.score = JSON.stringify({ score, completedIndices, skippedIndices });

                if (isPerfect) {
                    const perfectMsg = modal.querySelector('#speed-perfect-msg');
                    if (perfectMsg) {
                        perfectMsg.style.display = 'block';
                    }
                    setTimeout(() => {
                        const btnSubmit = modal.querySelector('.btn-primary');
                        if (btnSubmit) {
                            btnSubmit.click();
                            toast.show("Record perfetto inviato! ✨");
                        }
                    }, 3000);
                }
            };

            startBtn.onclick = () => {
                startScreen.style.display = 'none';
                gameScreen.style.display = 'block';
                nextWord();
                inputMask.focus();
                timerDisplay.innerText = '60s';
                
                speedTimerInterval = setInterval(() => {
                    timeLeft--;
                    timerDisplay.innerText = `${timeLeft}s`;
                    progressBar.style.transform = `scaleX(${timeLeft / 60})`;
                    if (timeLeft <= 0) endGame();
                }, 1000);
            };

            const skipBtn = modal.querySelector('#speed-skip-btn');
            if (skipBtn) {
                skipBtn.onmouseenter = () => { skipBtn.style.background = 'rgba(255,255,255,0.05)'; skipBtn.style.color = 'white'; };
                skipBtn.onmouseleave = () => { skipBtn.style.background = 'transparent'; skipBtn.style.color = 'rgba(255,255,255,0.4)'; };
                skipBtn.onclick = () => {
                    if (isProcessingWord) return;
                    if (currentWordObj) {
                        skippedIndices.push(currentWordObj._idx);
                    }
                    
                    wordDisplay.style.transform = 'scale(0.85)';
                    wordDisplay.style.opacity = '0';
                    
                    setTimeout(() => {
                        updateCountDisplay();
                        nextWord();
                    }, 100);
                };
            }

            let isProcessingWord = false;
            
            inputMask.addEventListener('input', (e) => {
                if (isProcessingWord) return;

                const val = clean(e.target.value);
                const target = clean(dir === 'it-es' ? currentWordObj.es : currentWordObj.it);
                
                if (val && val === target) {
                    isProcessingWord = true;
                    score++;
                    if (!completedIndices.includes(currentWordObj._idx)) {
                        completedIndices.push(currentWordObj._idx);
                    }
                    updateCountDisplay();
                    scoreDisplay.innerText = score;
                    inputMask.style.borderColor = '#10b981';
                    inputMask.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';
                    
                    setTimeout(() => {
                        inputMask.style.borderColor = 'rgba(255,255,255,0.2)';
                        inputMask.style.boxShadow = 'none';
                        inputMask.value = '';
                        isProcessingWord = false;
                        nextWord();
                    }, 150);
                }
            });
        }


        const footer = document.createElement('div');
        footer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-top: 5rem;';

        const btnCancel = document.createElement('button');
        btnCancel.innerText = 'Chiudi Registro';
        btnCancel.className = 'btn-chiudi-modal';
        btnCancel.style.cssText = `
            font-family: var(--font-ui); font-size: 1.3rem; font-weight: 900; 
            text-transform: uppercase; letter-spacing: 0.3em; 
            opacity: 1; color: var(--color-ink); background: #f0f0f0; 
            border: 1.5px solid rgba(0,0,0,0.05); cursor: pointer; padding: 1.6rem 4.5rem; border-radius: 1.8rem;
            transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        `;
        btnCancel.onmouseover = () => { btnCancel.style.transform = 'translateY(-2px)'; btnCancel.style.background = '#e8e8e8'; btnCancel.style.boxShadow = '0 8px 20px rgba(0,0,0,0.06)'; };
        btnCancel.onmouseout = () => { btnCancel.style.transform = 'translateY(0)'; btnCancel.style.background = '#f0f0f0'; btnCancel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; };
        btnCancel.onclick = close;
        footer.appendChild(btnCancel);

        if (task.status === 'pending' || task.status === 'draft') {
            const btnSubmit = document.createElement('button');
            btnSubmit.innerText = 'Consegnare';
            btnSubmit.className = 'btn-primary';
            btnSubmit.style.padding = '1.8rem 6rem';
            btnSubmit.style.borderRadius = '50px';
            btnSubmit.style.fontSize = '1.35rem';
            btnSubmit.style.fontWeight = '950';
            btnSubmit.style.letterSpacing = '0.3em';
            btnSubmit.style.textTransform = 'uppercase';
            
            const celebrate = () => {
                const rect = btnSubmit.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                // 1. Full Screen Flare
                const flare = document.createElement('div');
                flare.className = 'submit-success-flare';
                document.body.appendChild(flare);
                setTimeout(() => flare.remove(), 1000);

                // 2. High Octane Confetti (Icons + Colors)
                const colors = ['#C4603A', '#6B1024', '#7A8B5A', '#C49A3C', '#EADCBE', '#1C0F07'];
                const particleCount = 100;

                for (let i = 0; i < particleCount; i++) {
                    const isIcon = Math.random() > 0.55; // 45% icons
                    const p = document.createElement(isIcon ? 'img' : 'div');
                    
                    if (isIcon) {
                        p.src = '/favicon.png';
                        p.style.objectFit = 'contain';
                    } else {
                        const color = colors[Math.floor(Math.random() * colors.length)];
                        p.style.backgroundColor = color;
                        p.style.borderRadius = '2px';
                    }

                    p.className = 'confetti-particle';
                    const size = isIcon ? (Math.random() * 35 + 35) : (Math.random() * 15 + 8);
                    
                    // High-velocity explosion
                    const dx = (Math.random() - 0.5) * 1600;
                    const dy = (Math.random() - 0.7) * 1200; // Stronger upward force
                    const rot = Math.random() * 1080;
                    const delay = Math.random() * 0.15;
                    
                    p.style.width = `${size}px`;
                    p.style.height = `${size}px`;
                    p.style.left = `${centerX}px`;
                    p.style.top = `${centerY}px`;
                    p.style.setProperty('--dx', `${dx}px`);
                    p.style.setProperty('--dy', `${dy}px`);
                    p.style.setProperty('--rot', `${rot}deg`);
                    p.style.animationDelay = `${delay}s`;
                    
                    document.body.appendChild(p);
                    setTimeout(() => p.remove(), 4500);
                }
                
                btnSubmit.classList.add('celebrating');
                btnSubmit.innerHTML = '<span>ECCELSO! ✨</span>';
            };

            btnSubmit.onclick = async () => {
                let answer;
                if (type === 'fill' || type === 'completare' || type === 'translation' || type === 'traduzione') {
                    answer = Array.from(modal.querySelectorAll('.task-input')).map(i => i.value);
                } else if (type === 'roleplay' || type === 'conversazione') {
                    answer = modal.querySelector('.task-textarea').value;
                    if (!answer.trim()) return toast.show("Scrivi qualcosa prima!", "warning");
                } else if (type === 'fill_choice') {
                    answer = Array.from(modal.querySelectorAll('.choice-gap')).map(g => g.querySelector('.choice-label').innerText);
                    if (answer.some(a => a === '...')) return toast.show("Completa tutti los espacios!", "warning");
                } else if (type === 'order_sentence') {
                    answer = Array.from(modal.querySelector('#os-target-zone').querySelectorAll('.os-word-token')).map(t => t.innerText);
                    if (answer.length < (currentTask.content?.words?.length || 0)) {
                        return toast.show("Usa tutte le parole per favore!", "warning");
                    }
                } else if (type === 'translation_choice') {
                    const selected = modal.querySelector('.tc-option[data-selected="true"]');
                    answer = selected ? selected.dataset.val : null;
                    if (!answer) return toast.show("Seleziona una risposta!", "warning");
                } else if (type === 'error_correction') {
                    answer = (modal.querySelector('#ec-input')?.value || '').trim();
                    if (!answer) return toast.show("Scrivi la tua correzione!", "warning");
                } else if (type === 'dictation') {
                    answer = (modal.querySelector('#dettato-input')?.value || '').trim();
                    if (!answer) return toast.show("Scrivi qualcosa nel dettato!", "warning");
                } else if (type === 'dettato') {
                    const c = task.content || {};
                    const isComprensione = !c.mode || c.mode === 'comprensione';
                    if (isComprensione) {
                        answer = (modal.querySelector('#dettato-input')?.value || '').trim();
                        if (!answer) return toast.show("Scrivi quello che hai sentito!", "warning");
                    } else {
                        const qAnswers = {};
                        modal.querySelectorAll('.dettato-q-ans').forEach(ta => {
                            qAnswers[ta.dataset.idx] = ta.value.trim();
                        });
                        const hasAny = Object.values(qAnswers).some(v => v);
                        if (!hasAny) return toast.show("Rispondi ad almeno una domanda!", "warning");
                        answer = qAnswers;
                    }
                } else if (type === 'pronuncia') {
                    const mount = modal.querySelector('#pronuncia-recorder-mount');
                    const blob = mount?._getBlob?.();
                    if (!blob) return toast.show("Registra la tua voce prima di consegnare!", "warning");
                    btnSubmit.disabled = true;
                    btnSubmit.innerText = 'Caricamento...';
                    try {
                        const { url, error } = await uploadAudio(blob, 'alumna');
                        if (error) throw new Error(error);
                        answer = { audio_url: url };
                    } catch(uploadErr) {
                        btnSubmit.disabled = false;
                        btnSubmit.innerText = 'Consegnare';
                        return toast.show("Errore nel caricamento audio. Riprova.", "error");
                    }
                } else if (type === 'memory') {
                    const grid = modal.querySelector('#memory-grid');
                    if (!grid || !grid.dataset.completed) return toast.show("Completa il gioco prima di consegnare!", "warning");
                    answer = grid.dataset.attempts;
                } else if (type === 'speed') {
                    const gameScreen = modal.querySelector('#speed-game-screen');
                    if (!gameScreen || !gameScreen.dataset.completed) return toast.show("Hai bisogno di finire i 60 secondi!", "warning");
                    answer = gameScreen.dataset.score;
                } else {
                    answer = "visto";
                }

                try {
                    btnSubmit.disabled = true;
                    btnSubmit.innerText = '...';
                    await completeTask(task.assignment_id, answer);

                    // TRIGGER CELEBRATION
                    celebrate();
                    await new Promise(r => setTimeout(r, 1200)); 
                    
                    toast.show("Brava! Registro completato ✨", "success");
                    close();
                    if (onComplete) onComplete();
                } catch (err) {
                    console.error(err);
                    toast.show("Errore nell'invio.", "error");
                } finally {
                    btnSubmit.disabled = false;
                }
            };
            footer.appendChild(btnSubmit);
        }

        modal.appendChild(footer);

        // --- 2. Setup Autosave Logic ---
        if (task.status === 'pending' || task.status === 'draft') {
            const getAnswers = () => {
                const type = task.type?.toLowerCase();
                if (type === 'fill' || type === 'completare' || type === 'translation' || type === 'traduzione') {
                    return Array.from(modal.querySelectorAll('.task-input')).map(i => i.value);
                } else if (type === 'roleplay' || type === 'conversazione') {
                    return modal.querySelector('.task-textarea')?.value || '';
                } else if (type === 'fill_choice') {
                    return Array.from(modal.querySelectorAll('.choice-gap')).map(g => g.querySelector('.choice-label').innerText);
                } else if (type === 'order_sentence') {
                    return Array.from(modal.querySelectorAll('#os-target-zone .os-word-token')).map(t => t.innerText);
                } else if (type === 'error_correction') {
                    return modal.querySelector('#ec-input')?.value || '';
                } else if (type === 'dictation' || type === 'dettato') {
                    // Collect answers based on mode
                    const isComprensione = !task.content?.mode || task.content?.mode === 'comprensione';
                    if (isComprensione) {
                        return modal.querySelector('#dettato-input')?.value || '';
                    } else {
                        const qAnswers = {};
                        modal.querySelectorAll('.dettato-q-ans').forEach(ta => {
                            qAnswers[ta.dataset.idx] = ta.value.trim();
                        });
                        return qAnswers;
                    }
                }
                return null;
            };

            const performAutosave = async () => {
                const answers = getAnswers();
                if (!answers || (Array.isArray(answers) && answers.length === 0)) return;
                
                const { data } = await saveDraft({ assignmentId: task.assignment_id, answers });
                if (data) {
                    const now = new Date();
                    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    const statusEl = modal.querySelector('#autosave-status');
                    const timeEl = modal.querySelector('#save-time');
                    if (statusEl && timeEl) {
                        timeEl.innerText = timeStr;
                        statusEl.style.display = 'block';
                    }
                }
            };

            // Event Listeners for blur
            modal.querySelectorAll('input, textarea').forEach(el => {
                el.addEventListener('blur', performAutosave);
            });

            // Timer (10 seconds)
            autosaveInterval = setInterval(performAutosave, 10000);
        }


        const closeBtn = modal.querySelector('#modal-close-btn');
        closeBtn.onmouseover = () => { closeBtn.style.transform = 'scale(1.1) rotate(90deg)'; closeBtn.style.background = 'var(--color-bordo)'; closeBtn.style.color = 'white'; closeBtn.style.boxShadow = '0 8px 20px rgba(107, 16, 36, 0.2)'; };
        closeBtn.onmouseout = () => { closeBtn.style.transform = 'scale(1) rotate(0)'; closeBtn.style.background = 'rgba(0,0,0,0.03)'; closeBtn.style.color = 'var(--color-ink)'; closeBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)'; };
        closeBtn.onclick = close;
 
        // ATTACH FLASHCARD EVENTS
        modal.querySelectorAll('.flashcard-container').forEach(card => {
            card.onclick = () => card.classList.toggle('flipped');
        });

        overlay.style.display = 'flex';
        overlay.style.visibility = 'visible';
        overlay.style.opacity = '1';
        modal.style.transform = 'scale(1) translateY(0)';
        modal.style.filter = 'blur(0)';
    };

    overlay.appendChild(modal);
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    return { overlay, open, close };
};
