import { Header } from '../components/Header';
import { getStudentCorrections } from '../services/submissions';
import { LoadingSkeleton } from '../components/Loading';
import { ProfileModal } from '../components/ProfileModal';
import { updateProfile } from '../services/supabase';
import { toast } from '../components/Toast';

const TYPE_TRANSLATIONS = {
    'fill': 'Completare', 'roleplay': 'Conversazione',
    'flashcard': 'Lessico', 'flashcards': 'Lessico',
    'order_sentence': 'Ordina Frase',
    'translation_choice': 'Traduzione',
    'error_correction': 'Correzione',
    'fill_choice': 'Scelta Multipla',
    'dictation': 'Dettato',
    'memory': 'Memoria',
    'speed': 'Velocità'
};

const TYPE_ICONS = {
    'fill': '✒️', 'roleplay': '🎭',
    'flashcard': '🗂️', 'flashcards': '🗂️',
    'order_sentence': '🧩',
    'translation_choice': '🌍',
    'error_correction': '✏️',
    'fill_choice': '✅',
    'dictation': '🎧',
    'memory': '🃏',
    'speed': '⚡'
};

export const CorrectionsHistoryPage = (navigate, user) => {
    const container = document.createElement('div');
    container.className = 'animate-in';
    container.style.maxWidth = '100rem';
    container.style.margin = '0 auto';
    container.style.padding = '0 2rem 10rem';

    let corrections = [];
    let filteredCorrections = [];
    let isLoading = true;
    let filter = 'Tutte';

    const pModal = ProfileModal(user, async (newName, newAvatar) => {
        try {
            const { data, error } = await updateProfile(user.id, {
                name: newName,
                avatar_url: newAvatar || user.avatar_url
            });
            if (error) throw error;

            // Sync local state
            Object.assign(user, data);
            localStorage.setItem('luci_user', JSON.stringify(user));
            render();
            toast.show("Profilo aggiornato! ✨");
        } catch (err) { console.error(err); toast.show("Errore profilo.", "error"); }
    });

    const refresh = async () => {
        isLoading = true; render();
        try {
            const { data } = await getStudentCorrections(user.id);
            corrections = data || [];
            applyFilter();
        } catch (e) { console.error(e); }
        finally { isLoading = false; render(); }
    };

    const applyFilter = () => {
        if (filter === 'Tutte') {
            filteredCorrections = corrections;
        } else {
            const map = {
                'Traduzioni': ['translation', 'translation_choice'],
                'Ordina Frase': ['order_sentence'],
                'Scelta Multipla': ['fill_choice'],
                'Esercizi': ['fill', 'completare', 'error_correction', 'dictation', 'memory'],
                'Lessico': ['flashcard', 'flashcards'],
                'Conversazione': ['roleplay'],
                'Velocità': ['speed']
            };
            const targets = map[filter] || [];
            filteredCorrections = corrections.filter(c => targets.includes(c.task.type?.toLowerCase()));
        }
    };

    const clean = (s) => String(s || "").toLowerCase().replace(/[.,!?;]/g, '').trim();

    const renderAnswers = (c) => {
        const type = c.task.type?.toLowerCase();
        const ans = c.answers;
        if (!ans) return '<p style="opacity:0.5;">Nessuna risposta salvata.</p>';

        const getAnswerText = (src) => {
            if (!src) return '';
            try {
                const parsed = typeof src === 'string' ? JSON.parse(src) : src;
                if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.data)) return parsed.data.join('\n');
                    if (parsed.data) return parsed.data;
                    if (parsed.text) return parsed.text;
                    if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed.join('\n');
                }
                return typeof src === 'string' ? src : JSON.stringify(src);
            } catch (e) { return String(src); }
        };

        if (type === 'dettato' || type === 'dictation') {
            const content = c.task.content || {};
            const isDomande = content.mode === 'domande';
            const questions = content.questions || [];
            let answersParsed = null;
            
            try {
                answersParsed = typeof ans === 'string' ? JSON.parse(ans) : ans;
                if (answersParsed && answersParsed.data) answersParsed = answersParsed.data;
            } catch(e) { 
                answersParsed = ans; 
            }

            let responseHtml = '';
            if (isDomande && questions.length > 0) {
                responseHtml = questions.map((q, i) => {
                    const studentAnswer = (typeof answersParsed === 'object' && answersParsed !== null) 
                        ? (answersParsed[i] || answersParsed[String(i)] || '...') 
                        : (i === 0 ? answersParsed : '...');
                        
                    return `
                        <div style="${i === questions.length - 1 ? 'margin-bottom: 0;' : 'margin-bottom: 3.5rem;'}">
                            <div style="font-family: var(--font-ui); font-size: 0.95rem; font-weight: 950; color: #0369a1; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.8rem; opacity: 0.4;">Domanda ${i+1}</div>
                            <div style="font-family: var(--font-titles); font-size: 1.8rem; color: #075985; font-weight: 500; margin-bottom: 1.5rem; line-height: 1.4;">${q}</div>
                            <div style="font-family: var(--font-body); font-size: 2rem; color: #0369a1; background: white; padding: 2rem 2.5rem; border-radius: 1.8rem; border-left: 5px solid #0ea5e9; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                                ${studentAnswer}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                const text = typeof answersParsed === 'string' ? answersParsed : (answersParsed?.text || answersParsed?.data || (typeof answersParsed === 'object' ? JSON.stringify(answersParsed) : String(answersParsed)));
                responseHtml = `<div style="font-family: var(--font-body); font-size: 2.1rem; line-height: 1.6; color: #075985; font-weight: 500; white-space: pre-wrap;">${text || '<span style="opacity:0.3; font-style:italic;">Nessuna risposta.</span>'}</div>`;
            }
            
            return `
                <div style="display: flex; flex-direction: column; gap: 3rem; margin-top: 1rem;">
                    <!-- Original audio from Giancarlo -->
                    <div style="padding: 2.5rem; background: #fffdfa; border-radius: 20px; border: 1.5px solid rgba(0,0,0,0.03); box-shadow: 0 4px 15px rgba(0,0,0,0.01);">
                        <div style="font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; color: var(--color-terracota); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 2rem; opacity: 0.7;">Ascolta l'audio originale 🎧</div>
                        <audio controls src="${c.task.audio_url || ''}" style="width: 100%; border-radius: 1rem; filter: saturate(0.8);"></audio>
                    </div>

                    <!-- Student's transcription or answers -->
                    <div style="background: #f0f9ff; padding: 3.5rem; border-radius: 2.5rem; border: 1.5px solid rgba(14, 165, 233, 0.15); box-shadow: 0 10px 35px rgba(14, 165, 233, 0.04);">
                        <div style="font-family: var(--font-ui); font-size: 0.95rem; font-weight: 950; color: #0369a1; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 2.5rem; opacity: 0.6; display: flex; align-items: center; gap: 1rem;">
                            <span>LA MIA RISPOSTA ✨</span>
                            <div style="flex: 1; height: 1px; background: rgba(3, 105, 161, 0.1);"></div>
                        </div>
                        <div id="student-response-content">
                            ${responseHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        if (type === 'order_sentence') {
            const content = c.task.content || {};
            const correctText = content.original || content.text || content.correct_sentence || "";
            const correctArray = content.correctOrder || (correctText ? correctText.split(/\s+/) : []);
            const studentWords = Array.isArray(ans) ? ans : (ans?.data || []);

            const isCorrect = studentWords.length === correctArray.length && studentWords.every((w, i) => clean(w) === clean(correctArray[i]));

            return `
                <div style="display: flex; flex-direction: column; gap: 2rem;">
                    <div style="display: flex; flex-wrap: wrap; gap: 0.8rem;">
                        ${studentWords.map((w, i) => {
                const isWordCorrect = correctArray[i] && clean(w) === clean(correctArray[i]);
                const borderColor = isWordCorrect ? '#10b981' : '#ef4444';
                const bgColor = isWordCorrect ? '#f0fdf4' : '#fff1f2';
                return `
                                <div style="
                                    padding: 0.8rem 1.6rem; background: ${bgColor}; border-radius: 12px;
                                    border: 1.5px solid ${borderColor};
                                    font-family: var(--font-body); font-size: 1.4rem; color: var(--color-ink);
                                    box-shadow: 0 4px 10px rgba(0,0,0,0.02);
                                ">${w}</div>
                            `;
            }).join('')}
                    </div>
                    ${!isCorrect ? `
                        <div style="margin-top: 1rem; padding: 1.8rem; background: #ecfdf5; border-radius: 15px; border: 1px solid rgba(16, 185, 129, 0.1);">
                            <span style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 900; color: #065f46; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 0.5rem;">ORDINE CORRETTO 💡</span>
                            <div class="font-editorial" style="font-size: 1.6rem; color: #064e3b; line-height: 1.3;">
                                "${correctText || correctArray.join(' ')}"
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        if (type === 'speed') {
            let data = { score: 0, completedIndices: [] };
            try {
                const src = ans?.data || ans;
                if (typeof src === 'string' && src.startsWith('{')) {
                    data = JSON.parse(src);
                } else if (typeof src === 'object' && src !== null) {
                    data = src;
                } else {
                    data = { score: Number(src) || 0, completedIndices: [] };
                }
            } catch (e) {
                data = { score: Number(ans) || 0, completedIndices: [] };
            }

            const words = c.task.content?.words || [];
            const completedIndices = Array.isArray(data.completedIndices) ? data.completedIndices.map(Number) : [];
            const score = data.score || completedIndices.length;

            return `
                <div style="display: flex; flex-direction: column; gap: 2rem;">
                    <div style="font-family: var(--font-body); font-size: 1.8rem; color: var(--color-terracota); font-weight: 700; margin-bottom: 1rem;">
                        Hai tradotto ${score} parole! ⚡
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem;">
                        ${words.map((w, i) => {
                const isDone = completedIndices.includes(Number(i));
                const color = isDone ? '#10b981' : '#ef4444';
                const bgColor = isDone ? '#f0fdf4' : '#fff1f2';
                return `
                                <div style="padding: 1.2rem; border-radius: 12px; background: ${bgColor}; border: 1px solid ${color}33; display: flex; flex-direction: column; gap: 0.3rem;">
                                    <div style="font-family: var(--font-body); font-size: 1.1rem; color: var(--color-ink); font-weight: 600;">${c.task.content.direction === 'it-es' ? (w.it || w.word) : (w.es || w.translation)}</div>
                                    <div style="height: 1px; background: ${color}22; margin: 0.2rem 0;"></div>
                                    <div style="font-family: var(--font-body); font-size: 1.1rem; color: ${color}; font-weight: 800;">${c.task.content.direction === 'it-es' ? (w.es || w.translation) : (w.it || w.word)}</div>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }

        if (type === 'flashcard' || type === 'flashcards' || type === 'lessico') {
            const content = c.task.content || {};
            const words = content.pairs || content.items || content.words || content.mazzo || content.flashcards || content.cards || (Array.isArray(content.data) ? content.data : []);

            return `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2.5rem; margin-top: 1rem;">
                    ${words.map((w, idx) => {
                const itWord = w.italiano || w.it || w.parola || w.word || '';
                const esTrans = w.español || w.es || w.traduzione || w.traduccion || w.translation || '';
                const ex = w.esempio || w.ejemplo || w.example || '';

                return `
                        <div class="flashcard-container history-flashcard" style="height: 280px; width: 100%; cursor: pointer;">
                            <div class="flashcard-inner">
                                <div class="flashcard-front" style="padding: 2.2rem; border-radius: 2rem; border: 1.5px solid rgba(0,0,0,0.04); background: #ffffff;">
                                    <div style="font-family: var(--font-body); font-size: 1.8rem; font-weight: 500; color: var(--color-ink); opacity: 0.9;">${esTrans || '?'}</div>
                                    <div class="flashcard-hint" style="font-size: 0.65rem; padding: 0.4rem 1rem;">
                                        <span>✨ CLICCA PER GIRARE</span>
                                    </div>
                                </div>
                                <div class="flashcard-back" style="padding: 2.2rem; border-radius: 2rem; border: 1.5px solid rgba(196, 96, 58, 0.1); background: #fffcf9;">
                                    <div style="font-family: var(--font-body); font-size: 2.2rem; color: var(--color-terracota); font-weight: 700; margin-bottom: 0.8rem;">${itWord || '?'}</div>
                                    <div style="width: 2rem; height: 2px; background: var(--color-terracota); opacity: 0.1; margin-bottom: 1.5rem;"></div>
                                    ${ex ? `<div style="font-family: var(--font-body); font-size: 1.15rem; opacity: 0.5; font-style: italic; line-height: 1.4; text-align: center; color: var(--color-ink);">"${ex}"</div>` : ''}
                                </div>
                            </div>
                        </div>
                        `;
            }).join('')}
                </div>
            `;
        }

        if (type === 'roleplay' || type === 'conversazione') {
            const content = c.task.content || {};
            const instruction = content.text || content.description || (typeof content === 'string' ? content : "");
            const studentText = getAnswerText(ans);

            return `
                <div style="display: flex; flex-direction: column; gap: 2.5rem;">
                    ${instruction ? `
                        <div style="padding: 2.5rem; background: #fffcf8; border-radius: 20px; border-left: 4px solid var(--color-terracota); box-shadow: 0 4px 15px rgba(0,0,0,0.01);">
                            <div style="font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; color: var(--color-terracota); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 1.2rem; opacity: 0.7;">Atto Originale</div>
                            <div style="font-family: var(--font-body); font-size: 1.7rem; color: var(--color-ink); line-height: 1.5; font-style: italic;">
                                "${instruction}"
                            </div>
                        </div>
                    ` : ''}
                    <div>
                        <div style="font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; color: var(--color-ink); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 1.5rem; opacity: 0.4;">La mia risposta</div>
                        <div style="font-family: var(--font-body); font-size: 1.8rem; line-height: 1.7; color: var(--color-ink); white-space: pre-wrap;">${studentText}</div>
                    </div>
                </div>
            `;
        }

        if (type === 'translation' || type === 'traduzione' || (c.task.content?.items && !c.task.content?.question)) {
            const items = c.task.content?.pairs || c.task.content?.items || [];
            const studentAnswers = Array.isArray(ans) ? ans : (ans?.data || ans || []);

            return `
                <div style="display: flex; flex-direction: column; gap: 4rem; margin-top: 1rem;">
                    ${items.map((item, idx) => {
                const original = item.it || item.italiano || item.text || "";
                const correct = item.es || item.español || "";
                const student = studentAnswers[idx] || "...";

                return `
                            <div style="background: white; border-radius: 2.5rem; padding: 4rem; border: 1.5px solid rgba(0,0,0,0.04); box-shadow: 0 10px 40px rgba(0,0,0,0.01);">
                                <div style="font-family: var(--font-ui); font-size: 0.95rem; font-weight: 950; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 2.5rem; display: flex; align-items: center; gap: 1rem;">
                                    <span>ESERCIZIO #${idx + 1}</span>
                                    <div style="flex: 1; height: 1px; background: rgba(0,0,0,0.1);"></div>
                                </div>
                                
                                <div style="margin-bottom: 3.5rem;">
                                    <div style="font-family: var(--font-ui); font-size: 0.75rem; font-weight: 950; color: var(--color-terracota); text-transform: uppercase; opacity: 0.7; margin-bottom: 1.2rem;">TESTO ORIGINALE 🇮🇹</div>
                                    <div style="font-family: var(--font-titles); font-size: 2.4rem; font-style: italic; color: var(--color-ink); border-left: 4px solid var(--color-terracota); padding-left: 2.5rem; line-height: 1.5;">
                                        "${original}"
                                    </div>
                                </div>

                                <div style="display: flex; flex-direction: column; gap: 2.5rem;">
                                    <div style="background: #eff6ff; padding: 2.2rem 2.8rem; border-radius: 1.8rem; border: 1.2px solid rgba(29, 78, 216, 0.08);">
                                        <div style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 950; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6; margin-bottom: 1rem;">LA MIA RISPOSTA ✒️</div>
                                        <div style="font-family: var(--font-handwritten); font-size: 2.6rem; color: #1d4ed8; line-height: 1.3;">
                                            "${student}"
                                        </div>
                                    </div>

                                    <div style="background: #f0fdf4; padding: 2.2rem 2.8rem; border-radius: 1.8rem; border: 1.2px solid rgba(5, 150, 105, 0.08);">
                                        <div style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 950; color: #059669; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6; margin-bottom: 1rem;">VERSIONE CORRETTA ✨</div>
                                        <div style="font-family: var(--font-body); font-size: 2.1rem; color: #065f46; line-height: 1.4; font-weight: 600;">
                                            "${correct || 'Senza riferimento'}"
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        }

        const content = c.task?.content || {};
        if (type === 'fill' || type === 'completare' || type === 'fill_choice' || type === 'scelta_multipla' || (content?.text && (content.text.includes('___') || content.text.includes('---')))) {
            const studentAnswers = Array.isArray(ans) ? ans : (ans?.data || ans || []);

            // Support for modern sentence-based activities
            if (content.sentences && Array.isArray(content.sentences)) {
                return `
                    <div style="display: flex; flex-direction: column; gap: 4rem; margin-top: 3rem;">
                    ${content.sentences.map((it, idx) => {
                    const studentVal = (studentAnswers[idx] || '...').trim();
                    const correctVal = (it.blank || '').trim();
                    const clean = (s) => (s || "").toLowerCase().replace(/[.,!?;:]/g, '').trim();
                    const isCorrect = clean(studentVal) === clean(correctVal);

                    const blankTerm = correctVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const reg = new RegExp(`\\b${blankTerm}\\b`, 'i');

                    let studentSentence = it.text || "";
                    if (correctVal) {
                        const match = studentSentence.match(reg);
                        if (match) {
                            studentSentence = studentSentence.replace(reg, `
                                    <span style="display: inline-block; position: relative; margin: 0 1rem; vertical-align: middle;">
                                        <span style="
                                            display: flex; align-items: center; justify-content: center;
                                            min-width: 18rem; padding: 0.6rem 1.6rem; border-radius: 1.2rem;
                                            color: ${isCorrect ? '#065f46' : '#991b1b'};
                                            background: ${isCorrect ? '#ecfdf5' : '#fef2f2'};
                                            border: 2.5px solid ${isCorrect ? '#10b981' : '#ef4444'};
                                            box-shadow: 0 4px 12px ${isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'};
                                            font-weight: 800; font-family: var(--font-body); font-size: 2.2rem;
                                            line-height: 1.2;
                                        ">${studentVal}</span>
                                        ${!isCorrect ? `
                                            <div style="
                                                position: absolute; top: calc(100% + 0.8rem); left: -2.5px; right: -2.5px;
                                                background: #f0fdf4; border: 2.5px solid #10b981; padding: 0.6rem 0.8rem; border-radius: 1.2rem;
                                                box-shadow: 0 10px 25px rgba(16, 185, 129, 0.15); z-index: 5;
                                                display: flex; flex-direction: column; align-items: center; justify-content: center;
                                                line-height: 1.1;
                                            ">
                                                <div style="position: absolute; top: -7px; left: 50%; transform: translateX(-50%); width: 10px; height: 10px; background: #f0fdf4; border-left: 2.5px solid #10b981; border-top: 2.5px solid #10b981; rotate: 45deg;"></div>
                                                <span style="font-family: var(--font-ui); font-size: 0.75rem; font-weight: 950; color: #059669; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.8; margin-bottom: 0.2rem;">VERA</span>
                                                <span style="font-family: var(--font-body); font-size: 1.8rem; color: #064e3b; font-weight: 800; letter-spacing: -0.01em;">${correctVal}</span>
                                            </div>
                                        ` : ''}
                                    </span>
                                `);
                        }
                    }

                    return `
                            <div style="background: white; border-radius: 3rem; padding: 5rem; border: 1.2px solid rgba(0,0,0,0.04); box-shadow: 0 15px 45px rgba(0,0,0,0.02); margin-bottom: 2rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4rem; border-bottom: 1.2px solid rgba(0,0,0,0.03); padding-bottom: 2rem;">
                                    <div style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; color: var(--color-ink); text-transform: uppercase; letter-spacing: 0.15em; opacity: 0.5;">ESERCIZIO #${idx + 1}</div>
                                    <div style="background: ${isCorrect ? '#10b981' : '#ef4444'}; color: white; padding: 0.8rem 2rem; border-radius: 1.2rem; font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.12em; box-shadow: 0 8px 20px ${isCorrect ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'};">
                                        ${isCorrect ? 'OTTIMO ✓' : 'DA RIVEDERE ✕'}
                                    </div>
                                </div>
                                <div style="font-family: var(--font-body); font-size: 2.8rem; line-height: 5.5; color: var(--color-ink); font-weight: 450; text-align: center;">
                                    ${studentSentence}
                                </div>
                            </div>
                        `;
                }).join('')}
                    </div>
                `;
            }

            // Legacy fallback structure (old simple tasks)
            const segments = (content.text || "").split(/_{2,}|-{2,}|\.{3,}/);
            const legacyGaps = content.gaps || [];
            let h = `<div style="line-height: 5.5; text-align: center; font-family: var(--font-body); font-size: 2.6rem; color: var(--color-ink); background: white; padding: 5rem; border-radius: 3rem; border: 1.2px solid rgba(0,0,0,0.04); box-shadow: 0 15px 45px rgba(0,0,0,0.02); margin-top: 2rem;">`;
            segments.forEach((p, i) => {
                h += `<span>${p}</span>`;
                if (i < segments.length - 1) {
                    const studentVal = (studentAnswers[i] || '...').trim();
                    
                    let gapCorrect = '';
                    if (legacyGaps[i]) {
                        gapCorrect = typeof legacyGaps[i] === 'object' ? (legacyGaps[i].correct || '') : legacyGaps[i];
                    }
                    const correctVal = (gapCorrect || (content.answers ? content.answers[i] : null) || '').trim();
                    
                    const clean = (s) => (s || "").toLowerCase().replace(/[.,!?;:]/g, '').trim();
                    const isCorrect = clean(studentVal) === clean(correctVal);

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
                                    position: absolute; top: calc(100% + 1rem); left: -2.5px; right: -2.5px;
                                    background: #f0fdf4; border: 2.5px solid #10b981; padding: 0.6rem 0.8rem; border-radius: 1.5rem;
                                    box-shadow: 0 12px 30px rgba(16, 185, 129, 0.15); z-index: 5;
                                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                                    line-height: 1.2;
                                ">
                                    <div style="position: absolute; top: -8px; left: 50%; transform: translateX(-50%); width: 12px; height: 12px; background: #f0fdf4; border-left: 2.5px solid #10b981; border-top: 2.5px solid #10b981; rotate: 45deg;"></div>
                                    <span style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 950; color: #059669; text-transform: uppercase; letter-spacing: 0.15em; opacity: 0.8; margin-bottom: 0.2rem;">VERA</span>
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

        if (type === 'error_correction' || type === 'translation_choice' || (c.task.content?.question && c.task.content?.correct)) {
            const content = c.task.content || {};
            const incorrectStr = content.incorrect || content.question || '';
            const correctStr = content.correct || '';
            const studentResp = getAnswerText(ans);
            const isCorrect = studentResp.toLowerCase().trim() === correctStr.toLowerCase().trim();

            return `
                <div style="display: flex; flex-direction: column; gap: 3rem; margin-top: 1rem;">
                    <div style="padding: 3.5rem; background: #fffdfa; border-radius: 2.5rem; border: 1.5px solid rgba(0,0,0,0.03); box-shadow: 0 10px 30px rgba(0,0,0,0.01);">
                        <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; color: var(--color-terracota); text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 1.5rem; opacity: 0.6;">CONSEGNA / DOMANDA</div>
                        <div style="font-family: var(--font-titles); font-size: 2.6rem; color: var(--color-ink); line-height: 1.4; border-left: 5px solid var(--color-terracota); padding-left: 2.5rem;">
                            "${incorrectStr}"
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-top: 4rem;">
                            <div>
                                <div style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 950; color: ${isCorrect ? '#065f46' : '#991b1b'}; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 1.5rem; opacity: 0.5;">LA MIA SCELTA</div>
                                <div style="padding: 2.5rem; border-radius: 1.8rem; background: ${isCorrect ? '#ecfdf5' : '#fff1f2'}; border: 2.5px solid ${isCorrect ? '#10b981' : '#ef4444'};">
                                    <div style="font-family: var(--font-handwritten); font-size: 2.4rem; color: ${isCorrect ? '#065f46' : '#921b1b'}; line-height: 1.2;">
                                        "${studentResp || '...'}"
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 950; color: #059669; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 1.5rem; opacity: 0.5;">VERSIONE CORRETTA</div>
                                <div style="padding: 2.5rem; border-radius: 1.8rem; background: #f0fdf4; border: 1.5px dashed rgba(16, 185, 129, 0.2);">
                                    <div style="font-family: var(--font-body); font-size: 1.9rem; color: #064e3b; font-weight: 700;">
                                        "${correctStr}"
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (Array.isArray(ans)) {
            return `<ul style="list-style: none; padding: 0;">
                ${ans.map((a, i) => `<li style="margin-bottom: 0.5rem; opacity: 0.8;">${i + 1}. ${a}</li>`).join('')}
            </ul>`;
        }
        return `<div style="opacity:0.8; font-family: var(--font-body);">${typeof ans === 'object' ? JSON.stringify(ans) : ans}</div>`;
    };

    const render = () => {
        container.innerHTML = '';
        container.appendChild(Header(navigate, user, { onProfile: () => pModal.open(user) }));

        const content = document.createElement('div');

        // --- HEADER & COUNTER ---
        const totalCount = corrections.length;
        content.innerHTML = `
            <div style="margin-bottom: 6rem; text-align: center;">
                <h1 style="font-family: var(--font-heading); font-style: italic; font-size: 4.8rem; margin-bottom: 1rem;">Le mie correzioni</h1>
                <p style="font-family: var(--font-ui); font-size: 1.3rem; font-weight: 950; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.2em; color: var(--color-ink);">
                    ${totalCount} correzioni ricevute nel tuo cuaderno digitale 📓
                </p>
            </div>

            <!-- FILTERS -->
            <div class="filters-container" style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 5rem; flex-wrap: wrap;">
                ${['Tutte', 'Traduzioni', 'Ordina Frase', 'Scelta Multipla', 'Esercizi', 'Lessico', 'Conversazione', 'Velocità'].map(p => `
                    <button class="pill-filter ${filter === p ? 'active' : ''}" data-val="${p}" style="
                        padding: 0.8rem 1.8rem; border-radius: 50px; border: 1.5px solid ${filter === p ? 'var(--color-bordo)' : 'rgba(0,0,0,0.06)'};
                        background: ${filter === p ? 'var(--color-bordo)' : 'white'};
                        color: ${filter === p ? 'white' : 'var(--color-ink)'};
                        font-family: var(--font-ui); font-size: 1.05rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.08em;
                        cursor: pointer; transition: all 0.25s; white-space: nowrap; flex-shrink: 0;
                    ">${p}</button>
                `).join('')}
            </div>

            <div id="history-list" style="display: flex; flex-direction: column; gap: 2.2rem;"></div>
        `;

        // Filter events
        content.querySelectorAll('.pill-filter').forEach(btn => {
            btn.onclick = () => {
                filter = btn.dataset.val;
                applyFilter();
                render();
            };
        });

        const list = content.querySelector('#history-list');
        if (isLoading) {
            list.appendChild(LoadingSkeleton(5));
        } else if (filteredCorrections.length === 0) {
            list.innerHTML = `
                <div style="padding: 10rem 2rem; text-align: center;">
                    <div style="font-size: 6rem; margin-bottom: 3rem; opacity: 0.3;">📓</div>
                    <div style="font-family: var(--font-handwritten); font-size: 2.8rem; color: var(--color-ink); opacity: 0.4;">
                        Nessuna correzione ancora... continua così! 💪
                    </div>
                </div>
            `;
        } else {
            filteredCorrections.forEach((c, idx) => {
                const card = document.createElement('div');
                card.style.animationDelay = `${idx * 0.05}s`;
                card.className = 'correction-card';
                card.style.cssText = `
                    background: white; border-radius: 2.2rem; border-left: 5px solid var(--color-dorado-viejo);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.02); overflow: hidden; transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
                    cursor: pointer;
                `;

                const feedbackComment = c.feedback?.[0]?.comment || "";
                const dateStr = new Date(c.feedback?.[0]?.created_at || c.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

                card.innerHTML = `
                    <div style="padding: 3rem 4rem; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 2.5rem; align-items: center; flex: 1;">
                            <div style="width: 5rem; height: 5rem; background: var(--color-parchment); border-radius: 1.5rem; display: flex; align-items: center; justify-content: center; font-size: 2rem; flex-shrink: 0;">
                                ${TYPE_ICONS[c.task.type?.toLowerCase()] || '✒️'}
                            </div>
                            <div>
                                <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 0.5rem; color: var(--color-ink);">
                                    ${TYPE_TRANSLATIONS[c.task.type?.toLowerCase()] || c.task.type}
                                </div>
                                <h3 style="font-family: var(--font-titles); font-size: 2.2rem; font-weight: 600; margin: 0; color: var(--color-ink);">${c.task.title}</h3>
                                <p style="font-family: var(--font-body); font-size: 1.3rem; margin-top: 0.8rem; opacity: 0.5; max-width: 50rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    "${feedbackComment}"
                                </p>
                            </div>
                        </div>
                        <div style="text-align: right; min-width: 12rem;">
                            <div style="font-family: var(--font-handwritten); font-size: 2.2rem; color: var(--color-dorado-viejo);">${dateStr}</div>
                            <div class="expand-indicator" style="font-size: 1.2rem; opacity: 0.4; margin-top: 0.5rem; transition: transform 0.3s; color: var(--color-ink);">▼ Espandi</div>
                        </div>
                    </div>
                    
                    <div class="correction-details" style="display: none; padding: 0 4rem 5rem; animation: coutureSlideIn 0.4s ease-out;">
                        <div style="width: 100%; height: 1px; background: rgba(0,0,0,0.04); margin-bottom: 4rem;"></div>
                        
                        <div style="display: flex; flex-direction: column; gap: 4rem;">
                            <!-- Giancarlo's feedback (Special Highlight) -->
                            <div style="background: var(--color-parchment); padding: 3rem 4rem; border-radius: 2.5rem; border: 1.5px solid rgba(166, 77, 50, 0.1); box-shadow: 0 15px 45px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
                                <div style="position: absolute; top: 0; right: 0; width: 15rem; height: 15rem; background: radial-gradient(circle at center, rgba(166, 77, 50, 0.03) 0%, transparent 70%); pointer-events: none;"></div>
                                <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; color: var(--color-terracota); text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 2rem; display: flex; align-items: center; gap: 1.5rem; opacity: 0.6;">
                                    <span>IL MIO SIGILLO ✒️</span>
                                    <div style="flex: 1; height: 1px; background: rgba(166, 77, 50, 0.1);"></div>
                                </div>
                                <div style="font-family: var(--font-titles); font-style: italic; font-size: 2.4rem; color: #43191a; line-height: 1.35; margin-bottom: 2.5rem; position: relative; z-index: 1;">
                                    "${feedbackComment || 'Ottimo lavoro, Luci!'}"
                                </div>
                                <div style="text-align: right; font-family: var(--font-handwritten); font-size: 2.6rem; color: var(--color-bordo); border-top: 1.5px solid rgba(0,0,0,0.05); padding-top: 2rem; opacity: 0.9;">
                                    — Giancarlo
                                </div>
                            </div>

                            <!-- Detailed answers (Full Width) -->
                            <div>
                                <div style="font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; opacity: 0.4; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 3rem; display: flex; align-items: center; gap: 1.5rem;">
                                    <span>DETTAGLI RISPOSTE</span>
                                    <div style="flex: 1; height: 1px; background: rgba(0,0,0,0.1);"></div>
                                </div>
                                ${renderAnswers(c)}
                            </div>
                        </div>
                    </div>
                `;

                card.onclick = () => {
                    const details = card.querySelector('.correction-details');
                    const indicator = card.querySelector('.expand-indicator');
                    const isClosing = details.style.display === 'block';

                    // Close others (optional, accordion style)
                    container.querySelectorAll('.correction-details').forEach(d => d.style.display = 'none');
                    container.querySelectorAll('.expand-indicator').forEach(i => { i.innerText = '▼ Espandi'; i.style.transform = ''; });
                    container.querySelectorAll('.correction-card').forEach(c => { c.style.borderColor = 'var(--color-dorado-viejo)'; c.style.transform = 'translateY(0)'; });

                    if (!isClosing) {
                        details.style.display = 'block';
                        indicator.innerText = '▲ Comprimi';
                        indicator.style.transform = 'rotate(180deg)';
                        card.style.borderColor = 'var(--color-bordo)';
                        card.style.transform = 'translateY(-2px)';
                    }
                };

                list.appendChild(card);
            });
        }

        container.appendChild(content);

        // --- Attach Flashcard Flip Events ---
        content.querySelectorAll('.history-flashcard').forEach(card => {
            card.onclick = (e) => {
                e.stopPropagation(); // Prevents closing the parent correction card
                card.classList.toggle('flipped');
            };
        });

        // Add internal styles
        if (!document.getElementById('history-styles')) {
            const style = document.createElement('style');
            style.id = 'history-styles';
            style.innerHTML = `
                .correction-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-hover); }
                .pill-filter:hover:not(.active) { border-color: var(--color-bordo); opacity: 0.7; }
            `;
            document.head.appendChild(style);
        }

        if (!document.body.contains(pModal.overlay)) document.body.appendChild(pModal.overlay);
    };

    refresh();
    return container;
};

