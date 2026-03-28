import { Header } from '../components/Header';
import { getStudentCorrections } from '../services/submissions';
import { LoadingSkeleton } from '../components/Loading';

const TYPE_TRANSLATIONS = {
    'fill': 'Completare', 'roleplay': 'Conversazione',
    'flashcard': 'Lessico', 'flashcards': 'Lessico',
    'order_sentence': 'Ordina Frase',
    'translation_choice': 'Traduzione',
    'error_correction': 'Correzione',
    'fill_choice': 'Scelta Multipla'
};

const TYPE_ICONS = {
    'fill': '✒️', 'roleplay': '🎭',
    'flashcard': '🗂️', 'flashcards': '🗂️',
    'order_sentence': '🧩',
    'translation_choice': '🌍',
    'error_correction': '✏️',
    'fill_choice': '✅'
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
            // Simplified mapping for the Pills
            const map = {
                'Roleplay': ['roleplay', 'conversazione'],
                'Flashcards': ['flashcard', 'flashcards', 'lessico'],
                'Frases': ['fill', 'completare', 'order_sentence', 'error_correction', 'fill_choice', 'translation_choice']
            };
            const targets = map[filter] || [];
            filteredCorrections = corrections.filter(c => targets.includes(c.task.type?.toLowerCase()));
        }
    };

    const renderAnswers = (c) => {
        const type = c.task.type?.toLowerCase();
        const ans = c.answers;
        if (!ans) return '<p style="opacity:0.5;">Nessuna risposta salvata.</p>';

        if (type === 'roleplay' || type === 'conversazione' || type === 'error_correction') {
            return `<div style="font-family: var(--font-body); line-height: 1.6;">${ans}</div>`;
        }
        if (Array.isArray(ans)) {
            return `<ul style="list-style: none; padding: 0;">
                ${ans.map((a, i) => `<li style="margin-bottom: 0.5rem; opacity: 0.8;">${i+1}. ${a}</li>`).join('')}
            </ul>`;
        }
        return `<div style="opacity:0.8;">${JSON.stringify(ans)}</div>`;
    };

    const render = () => {
        container.innerHTML = '';
        container.appendChild(Header(navigate, user));

        const content = document.createElement('div');
        
        // --- HEADER & COUNTER ---
        const totalCount = corrections.length;
        content.innerHTML = `
            <div style="margin-bottom: 6rem; text-align: center;">
                <h1 style="font-family: var(--font-heading); font-style: italic; font-size: 4.8rem; margin-bottom: 1rem;">Le mie correzioni</h1>
                <p style="font-family: var(--font-ui); font-size: 1.1rem; font-weight: 900; opacity: 0.4; text-transform: uppercase; letter-spacing: 0.2em;">
                    ${totalCount} correzioni ricevute nel tuo cuaderno digitale 📓
                </p>
            </div>

            <!-- FILTERS -->
            <div style="display: flex; gap: 1.2rem; justify-content: center; margin-bottom: 5rem;">
                ${['Tutte', 'Roleplay', 'Flashcards', 'Frases'].map(p => `
                    <button class="pill-filter ${filter === p ? 'active' : ''}" data-val="${p}" style="
                        padding: 1rem 2.8rem; border-radius: 50px; border: 1.5px solid ${filter === p ? 'var(--color-bordo)' : 'rgba(0,0,0,0.06)'};
                        background: ${filter === p ? 'var(--color-bordo)' : 'white'};
                        color: ${filter === p ? 'white' : 'var(--color-ink)'};
                        font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.1em;
                        cursor: pointer; transition: all 0.25s;
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
                                <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.3; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 0.4rem;">
                                    ${TYPE_TRANSLATIONS[c.task.type?.toLowerCase()] || c.task.type}
                                </div>
                                <h3 style="font-family: var(--font-titles); font-size: 2.2rem; font-weight: 600; margin: 0; color: var(--color-ink);">${c.task.title}</h3>
                                <p style="font-family: var(--font-body); font-size: 1.3rem; margin-top: 0.8rem; opacity: 0.5; max-width: 50rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    "${feedbackComment}"
                                </p>
                            </div>
                        </div>
                        <div style="text-align: right; min-width: 12rem;">
                            <div style="font-family: var(--font-handwritten); font-size: 1.8rem; color: var(--color-dorado-viejo);">${dateStr}</div>
                            <div class="expand-indicator" style="font-size: 1.1rem; opacity: 0.2; margin-top: 0.5rem; transition: transform 0.3s;">▼ Espandi</div>
                        </div>
                    </div>
                    
                    <div class="correction-details" style="display: none; padding: 0 4rem 5rem; animation: coutureSlideIn 0.4s ease-out;">
                        <div style="width: 100%; height: 1px; background: rgba(0,0,0,0.04); margin-bottom: 4rem;"></div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5rem;">
                            <!-- Luci's section -->
                            <div>
                                <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.4; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
                                    <span>LA MIA RISPOSTA</span>
                                    <div style="flex: 1; height: 1px; background: rgba(0,0,0,0.05);"></div>
                                </div>
                                <div style="background: #fdfdfd; padding: 3rem; border-radius: 1.8rem; border: 1px solid rgba(0,0,0,0.03);">
                                    ${renderAnswers(c)}
                                </div>
                            </div>

                            <!-- Giancarlo's feedback -->
                            <div>
                                <div style="font-family: var(--font-ui); font-size: 0.85rem; font-weight: 950; opacity: 0.4; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem; color: var(--color-bordo);">
                                    <span>CORREZIONE DEL MAESTRO</span>
                                    <div style="flex: 1; height: 1px; background: var(--color-bordo); opacity: 0.1;"></div>
                                </div>
                                <div style="background: var(--color-parchment); padding: 4rem; border-radius: 2.2rem; border-left: 4px solid var(--color-dorado-viejo); box-shadow: 0 8px 30px rgba(107, 16, 36, 0.03); position: relative;">
                                    <div style="font-family: var(--font-heading); font-style: italic; font-size: 2.4rem; color: #43191a; line-height: 1.5; margin-bottom: 2.5rem;">
                                        "${feedbackComment}"
                                    </div>
                                    <div style="text-align: right; font-family: var(--font-handwritten); font-size: 2.2rem; color: var(--color-bordo); border-top: 1px solid rgba(0,0,0,0.04); padding-top: 1.5rem; opacity: 0.8;">
                                        — Giancarlo ✒️
                                    </div>
                                </div>
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
    };

    refresh();
    return container;
};
