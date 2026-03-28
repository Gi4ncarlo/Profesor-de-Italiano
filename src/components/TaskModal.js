import { completeTask } from '../services/tasks';
import { toast } from './Toast';
import { getDraft, saveDraft } from '../services/submissions';


export const TaskModal = (onComplete) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay animate-in';
    overlay.style.display = 'flex';
    overlay.style.visibility = 'hidden';

    let currentTask = null;
    let autosaveInterval = null;
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
            <div style="font-family: var(--font-body); font-size: 1.15rem; font-weight: 700; opacity: 0.35; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 1.8rem;">Registro d'Apprendimento</div>
            <h2 style="font-family: var(--font-heading); font-size: 4rem; font-weight: 600; margin: 0; color: var(--color-ink); line-height: 1.1; letter-spacing: -0.5px;">${task.title || 'Senza Titolo'}</h2>
            <div style="width: 6rem; height: 1.5px; background: var(--color-bordo); margin: 3rem auto; opacity: 0.12;"></div>
            <div style="font-family: var(--font-body); font-size: 1.1rem; font-weight: 700; opacity: 0.3; text-transform: uppercase; letter-spacing: 0.2em;">A cura di ${task.master_name || 'Maestro Giancarlo'} 🎨</div>
            <div id="autosave-status" style="font-family: var(--font-body); font-size: 1rem; color: #a67d32; opacity: 0.8; margin-top: 1.5rem; display: none;">
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
                <div style="font-family: var(--font-body); font-size: 1rem; font-weight: 800; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.2rem; color: var(--color-bordo); display: flex; align-items: center; gap: 1.5rem;">
                    <span>CORREZIONE DEL MAESTRO</span>
                    <div style="flex: 1; height: 1.3px; background: var(--color-bordo); opacity: 0.1;"></div>
                </div>
                <div style="background: #fffcfb; border-radius: 2.8rem; padding: 4.5rem 5rem; box-shadow: 0 15px 40px rgba(107, 16, 36, 0.04); border: 1.5px solid rgba(107, 16, 36, 0.08); position: relative; overflow: hidden; transform: rotate(-0.5deg);">
                    <div style="position: absolute; right: 2rem; bottom: -2rem; font-size: 18rem; font-family: var(--font-heading); color: var(--color-bordo); opacity: 0.03; pointer-events: none;">"</div>
                    <div class="font-editorial" style="font-size: 3.2rem; color: #43191a; line-height: 1.45; font-weight: 400; text-shadow: 0 1px 1px rgba(0,0,0,0.01);">"${comment}"</div>
                    <div style="text-align: right; margin-top: 2.5rem; font-family: var(--font-body); font-size: 1rem; font-weight: 800; opacity: 0.4; text-transform: uppercase; letter-spacing: 0.18em;">— Maestro Giancarlo ✒️</div>
                </div>
            </div>
        `;
    };

    const renderFillContent = (task) => {
        const contentStr = getRawContent(task);
        const segments = contentStr.split(/___|----/);
        let answers = [];
        try { 
            const source = task.student_answer || task.answers;
            answers = typeof source === 'string' ? JSON.parse(source) : (source ? (source.data || source) : []);
        } catch(e) { console.error(e); }

        const isReadOnly = task.status !== 'pending';
        const answerColor = isReadOnly ? '#0057b7' : 'var(--color-bordo)';

        // ADD LOCAL STYLES FOR ORDER SENTENCE
        const osStyles = `
            .os-word-token {
                padding: 1.2rem 2.5rem; background: white; border-radius: 1.2rem;
                border: 2px solid rgba(0,0,0,0.06); font-family: var(--font-body);
                font-size: 2.2rem; color: var(--color-ink); cursor: pointer;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                box-shadow: 0 4px 12px rgba(0,0,0,0.02); user-select: none;
            }
            .os-word-token:hover:not(.disabled) {
                transform: translateY(-3px); border-color: var(--color-terracota);
                box-shadow: 0 8px 25px rgba(166, 77, 50, 0.1);
            }
            .os-word-token.selected {
                opacity: 0.3; pointer-events: none; transform: scale(0.9);
            }
            #os-target-zone {
                min-height: 12rem; background: #fffcfb; border: 2px dashed rgba(166, 77, 50, 0.08);
                border-radius: 2.5rem; display: flex; flex-wrap: wrap; gap: 1.2rem; padding: 2.5rem;
                align-items: center; justify-content: center;
            }
        `;
        if (!document.getElementById('os-styles')) {
            const s = document.createElement('style');
            s.id = 'os-styles';
            s.innerHTML = osStyles;
            document.head.appendChild(s);
        }

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; opacity: 0.45; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>ATTIVITÀ ASSEGNATA</span>
                    <div style="flex: 1; height: 1.3px; background: rgba(0,0,0,0.1);"></div>
                </div>
                <div style="background: white; border-radius: 3.5rem; padding: 8.5rem 7.5rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">
                    <div style="font-family: var(--font-body); font-size: 3.2rem; line-height: 2.4; color: var(--color-ink);">
                        ${segments.map((s, i) => i < segments.length - 1 
                            ? `${s}<input type="text" class="task-input" style="width: 28rem; font-size: 3rem; color: ${answerColor}; font-weight: 700; border-bottom: 3px solid ${isReadOnly ? '#e6eef8' : 'rgba(0,0,0,0.1)'}; background: ${isReadOnly ? '#f8fbfc' : 'transparent'}; margin: 0 1.2rem; border-radius: 1rem; padding: 0.2rem 1.5rem; transition: all 0.3s;" value="${Array.isArray(answers) ? (answers[i] || '') : ''}" ${isReadOnly ? 'readonly' : ''}>` 
                            : s).join('')}
                    </div>
                    <div style="text-align: center; margin-top: 6rem; font-family: var(--font-ui); font-size: 1.05rem; font-weight: 900; opacity: 0.18; text-transform: uppercase; letter-spacing: 0.45em;">${isReadOnly ? 'CONSEGNATO A GIANCARLO' : 'SCRIVI PER COMPLETARE IL CAMMINO'}</div>
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
        const isReadOnly = task.status !== 'pending';

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; opacity: 0.45; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 3.5rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>DETTAGLI ROLEPLAY</span>
                    <div style="flex: 1; height: 1.3px; background: rgba(0,0,0,0.1);"></div>
                </div>
                
                <div style="background: white; border-radius: 3.5rem; padding: 5rem 6rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">
                    <!-- Maestro Section -->
                    <div style="margin-bottom: 5rem;">
                        <div style="font-family: var(--font-ui); font-size: 1.05rem; font-weight: 950; opacity: 0.8; color: var(--color-bordo); text-transform: uppercase; letter-spacing: 0.35em; margin-bottom: 2rem;">Maestro dice..</div>
                        <p style="font-family: var(--font-body); font-size: 2.8rem; line-height: 1.8; color: var(--color-ink); opacity: 0.9;">${contentStr}</p>
                    </div>

                    <div style="width: 100%; height: 1.5px; background: rgba(0,0,0,0.03); margin: 5rem 0;"></div>

                    <!-- Student Section -->
                    <div>
                        <div style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; opacity: 0.6; color: var(--color-bordo); text-transform: uppercase; letter-spacing: 0.35em; margin-bottom: 2rem;">La mia risposta..</div>
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
        const segments = text.split(/___/);
        
        let savedAnswers = [];
        try {
            const source = task.student_answer || task.answers;
            savedAnswers = typeof source === 'string' ? JSON.parse(source) : (source?.data || source || []);
        } catch(e) {}

        const isReadOnly = task.status !== 'pending';

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; opacity: 0.45; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>SCELTA MULTIPLA</span>
                    <div style="flex: 1; height: 1.3px; background: rgba(0,0,0,0.1);"></div>
                </div>
                <div style="background: white; border-radius: 3.5rem; padding: 6.5rem 7.5rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">
                    <div style="font-family: var(--font-body); font-size: 2.8rem; line-height: 2.2; color: var(--color-ink);">
                        ${segments.map((s, i) => {
                            if (i >= segments.length - 1) return s;
                            const gap = gaps[i] || { options: [], correct: '' };
                            const studentVal = savedAnswers[i] || '';
                            const isCorrect = studentVal === gap.correct;
                            const showResult = isReadOnly && studentVal;
                            
                            let btnStyle = `
                                display: inline-flex; align-items: center; justify-content: center;
                                min-width: 18rem; padding: 0.2rem 1.8rem; margin: 0 1rem;
                                border-radius: 1.2rem; cursor: ${isReadOnly ? 'default' : 'pointer'};
                                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                                font-family: var(--font-body); font-size: 2.4rem; font-weight: 700;
                                border: 2.5px solid rgba(0,0,0,0.08); background: #fdfdfd;
                                color: var(--color-ink); vertical-align: middle; position: relative;
                            `;

                            if (showResult) {
                                if (isCorrect) {
                                    btnStyle += 'border-color: #10b981; background: #ecfdf5; color: #065f46;';
                                } else {
                                    btnStyle += 'border-color: #ef4444; background: #fef2f2; color: #991b1b;';
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
                                            display: none; position: absolute; top: calc(100% + 1rem); left: 0; 
                                            background: white; border-radius: 1.8rem; box-shadow: 0 20px 50px rgba(0,0,0,0.15);
                                            z-index: 100; min-width: 22rem; padding: 1rem; border: 1px solid rgba(0,0,0,0.05);
                                            overflow: hidden;
                                        ">
                                            ${gap.options.map(opt => `
                                                <div class="choice-option" data-val="${opt}" style="
                                                    padding: 1.2rem 2rem; border-radius: 1.2rem; transition: 0.2s;
                                                    font-size: 1.8rem; cursor: pointer; color: var(--color-ink);
                                                    ${opt === studentVal ? 'background: rgba(107, 16, 36, 0.05); font-weight: 700;' : ''}
                                                ">${opt}</div>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                    ${showResult && !isCorrect ? `<div style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); font-size: 1rem; color: #10b981; font-weight: 950; white-space: nowrap; margin-top: 0.5rem;">Vero: ${gap.correct}</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    };

    const renderOrderSentenceContent = (task) => {
        const content = task.content || {};
        const words = content.words || [];
        const isReadOnly = task.status !== 'pending';
        
        let studentOrder = [];
        try {
            const source = task.student_answer || task.answers;
            studentOrder = typeof source === 'string' ? JSON.parse(source) : (source?.data || source || []);
        } catch(e) {}

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; opacity: 0.45; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>RIORDINA LA FRASE 🧩</span>
                    <div style="flex: 1; height: 1.3px; background: rgba(0,0,0,0.1);"></div>
                </div>
                
                <div style="background: white; border-radius: 3.5rem; padding: 5rem 6.5rem; box-shadow: 0 15px 50px rgba(0,0,0,0.025); border: 1px solid rgba(0,0,0,0.02);">
                    <div id="os-target-zone" style="margin-bottom: 4rem;">
                        ${isReadOnly ? (Array.isArray(studentOrder) ? studentOrder.map(w => `<div class="os-word-token disabled">${w}</div>`).join('') : '') : ''}
                        ${!isReadOnly ? '<div style="opacity: 0.2; font-family: var(--font-handwritten); font-size: 2.2rem;">Clicca le parole nell\'ordine corretto...</div>' : ''}
                    </div>

                    ${!isReadOnly ? `
                        <div id="os-words-pool" style="display: flex; flex-wrap: wrap; gap: 1.2rem; justify-content: center; padding-top: 3rem; border-top: 1.5px solid rgba(0,0,0,0.03);">
                            ${words.map((w, idx) => `<div class="os-word-token" data-word="${w}" data-idx="${idx}">${w}</div>`).join('')}
                        </div>
                        <div style="margin-top: 4rem; display: flex; justify-content: center;">
                            <button id="os-reset" style="background: none; border: none; font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; color: var(--color-terracota); cursor: pointer; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.1em;">Ricomincia ↺</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    };

    const renderTranslationChoiceContent = (task) => {
        const c = task.content || {};
        const options = c.options || [];
        const isReadOnly = task.status !== 'pending';
        let chosen = null;
        try {
            const src = task.student_answer || task.answers;
            chosen = typeof src === 'string' ? src : (src?.data || src);
        } catch(e) {}

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; opacity: 0.45; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>SCEGLI LA TRADUZIONE CORRETTA 🌍</span>
                    <div style="flex: 1; height: 1.3px; background: rgba(0,0,0,0.1);"></div>
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
        const isReadOnly = task.status !== 'pending';
        let studentAnswer = '';
        try {
            const src = task.student_answer || task.answers;
            studentAnswer = typeof src === 'string' ? src : (src?.data || src || '');
        } catch(e) {}

        const normalize = (s) => (s || '').trim().toLowerCase();
        const isCorrect = isReadOnly && normalize(studentAnswer) === normalize(c.correct);

        return `
            <div style="margin-bottom: 4.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; opacity: 0.45; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 2.8rem; display: flex; align-items: center; gap: 1.5rem;">
                    <span>CORREGGI LA FRASE ✏️</span>
                    <div style="flex: 1; height: 1.3px; background: rgba(0,0,0,0.1);"></div>
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
    const close = () => {
        if (autosaveInterval) clearInterval(autosaveInterval);
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
        if (task.status === 'pending') {
            const { data: draft } = await getDraft(task.assignment_id);
            if (draft) {
                 draftAnswers = draft.answers;
                 // Pre-inject draft answers into task object for render functions
                 currentTask.student_answer = draftAnswers;
            }
        }

        modal.innerHTML = renderHeader(task);

        modal.innerHTML += renderFeedback(task);

        const type = task.type?.toLowerCase();
        if (type === 'fill' || type === 'completare') modal.innerHTML += renderFillContent(task);
        else if (type === 'roleplay' || type === 'conversazione') modal.innerHTML += renderRoleplayContent(task);
        else if (type === 'flashcard' || type === 'flashcards' || type === 'lessico') modal.innerHTML += renderFlashcardsContent(task);
        else if (type === 'fill_choice') modal.innerHTML += renderFillChoiceContent(task);
        else if (type === 'order_sentence') modal.innerHTML += renderOrderSentenceContent(task);
        else if (type === 'translation_choice') modal.innerHTML += renderTranslationChoiceContent(task);
        else if (type === 'error_correction') modal.innerHTML += renderErrorCorrectionContent(task);

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
        if (type === 'order_sentence' && task.status === 'pending') {
            const pool = modal.querySelector('#os-words-pool');
            const target = modal.querySelector('#os-target-zone');
            const resetBtn = modal.querySelector('#os-reset');
            let selections = [];

            const updateUI = () => {
                target.innerHTML = selections.length === 0 
                  ? '<div style="opacity: 0.2; font-family: var(--font-handwritten); font-size: 2.2rem;">Clicca le parole nell\'ordine corretto...</div>'
                  : selections.map(s => `<div class="os-word-token disabled">${s.word}</div>`).join('');
                
                pool.querySelectorAll('.os-word-token').forEach(token => {
                    const idx = token.dataset.idx;
                    const isUsed = selections.some(s => s.idx === idx);
                    token.classList.toggle('selected', isUsed);
                });
            };

            pool.onclick = (e) => {
                const token = e.target.closest('.os-word-token');
                if (!token || token.classList.contains('selected')) return;
                selections.push({ word: token.dataset.word, idx: token.dataset.idx });
                updateUI();
            };

            resetBtn.onclick = () => { selections = []; updateUI(); };
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

        if (task.status === 'pending') {
            const btnSubmit = document.createElement('button');
            btnSubmit.innerText = 'Consegnare';
            btnSubmit.className = 'btn-primary';
            btnSubmit.style.padding = '1.8rem 6rem';
            btnSubmit.style.borderRadius = '50px';
            btnSubmit.style.fontSize = '1.35rem';
            btnSubmit.style.fontWeight = '950';
            btnSubmit.style.letterSpacing = '0.15em';
            btnSubmit.onclick = async () => {
                let answer;
                if (type === 'fill' || type === 'completare') {
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
                } else {
                    answer = "visto";
                }

                try {
                    btnSubmit.disabled = true;
                    btnSubmit.innerText = '...';
                    await completeTask(task.assignment_id, answer);
                    toast.show("Brava! Consegnato con successo.", "success");
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
        if (task.status === 'pending') {
            const getAnswers = () => {
                const type = task.type?.toLowerCase();
                if (type === 'fill' || type === 'completare') {
                    return Array.from(modal.querySelectorAll('.task-input')).map(i => i.value);
                } else if (type === 'roleplay' || type === 'conversazione') {
                    return modal.querySelector('.task-textarea')?.value || '';
                } else if (type === 'fill_choice') {
                    return Array.from(modal.querySelectorAll('.choice-gap')).map(g => g.querySelector('.choice-label').innerText);
                } else if (type === 'order_sentence') {
                    return Array.from(modal.querySelectorAll('#os-target-zone .os-word-token')).map(t => t.innerText);
                } else if (type === 'error_correction') {
                    return modal.querySelector('#ec-input')?.value || '';
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
