import { getStudentTasks } from '../services/tasks';
import { signOut, updateProfile } from '../services/supabase';
import { TaskModal } from '../components/TaskModal';
import { ProfileModal } from '../components/ProfileModal';
import { LoadingSkeleton } from '../components/Loading';
import { toast } from '../components/Toast';

const TYPE_TRANSLATIONS = {
    'fill': 'Completare', 'roleplay': 'Conversazione',
    'flashcard': 'Lessico', 'flashcards': 'Lessico',
    'order_sentence': 'Ordina Frase',
    'translation_choice': 'Traduzione',
    'error_correction': 'Correzione'
};

export const LucianaDashboard = (navigate, user) => {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex; min-height:100vh; background-color:var(--color-parchment); padding-left: 28rem; padding-right: 2rem;';

    let assignments = [];
    let isLoading = true;
    let currentTab = 'pending'; // 'pending' or 'history'

    const taskModal = TaskModal(() => refresh());
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
            const { data, error } = await getStudentTasks(user.id);
            if (error) throw error;
            assignments = data;
        } catch (err) { console.error(err); toast.show("Errore nel caricamento.", "error"); }
        finally { isLoading = false; render(); }
    };

    const render = () => {
        container.innerHTML = '';

        // SIDEBAR
        const sidebar = document.createElement('aside');
        sidebar.className = 'atelier-sidebar';
        sidebar.innerHTML = `
            <div>
                <div class="atelier-sidebar__brand">El Rincón de <em>Luci</em></div>
                <nav>
                    <button class="sidebar-nav-btn active">🏠 DASHBOARD</button>
                </nav>
            </div>
            <div class="sidebar-profile">
                <div class="sidebar-profile__header">
                    <div class="sidebar-profile__avatar">
                        ${user.avatar_url ? '<img src="' + user.avatar_url + '">' : '👤'}
                    </div>
                    <div>
                        <div class="sidebar-profile__name">${user.name}</div>
                        <div class="sidebar-profile__role">STUDENTESSA ATELIER</div>
                    </div>
                </div>
                <div class="sidebar-profile__divider"></div>
                <div class="sidebar-profile__actions">
                    <button id="btn-settings" class="sidebar-profile__btn">Profilo</button>
                    <button id="btn-logout" class="sidebar-profile__btn sidebar-profile__btn--danger">Esci</button>
                </div>
            </div>
        `;

        // Progress calc
        const getArgDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        const todayStr = getArgDate(new Date());
        const todayAssignments = assignments.filter(a => getArgDate(new Date(a.assigned_at)) === todayStr);
        const completedCount = todayAssignments.filter(s => s.status === 'submitted' || s.status === 'reviewed').length;
        const totalCount = todayAssignments.length;
        const progressVal = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const itDate = new Intl.DateTimeFormat('it-IT', { dateStyle: 'full' }).format(new Date());

        // FILTER LISTS
        const listToShow = currentTab === 'pending' 
            ? assignments.filter(s => s.status !== 'reviewed')
            : assignments.filter(s => s.status === 'reviewed').sort((a,b) => new Date(b.assigned_at) - new Date(a.assigned_at));

        // MAIN
        const main = document.createElement('main');
        main.className = 'luciana-main animate-in';
        main.innerHTML = `
            <div class="luciana-four-deco">4</div>
            <div class="luciana-grid">
                <div>
                    <header class="luciana-header" style="margin-bottom: 5rem;">
                        <span class="luciana-date">Oggi è ${itDate}</span>
                        <h1>Benvenuta, ${user.name}. <span class="luciana-lucky-badge">★ 4</span></h1>
                        <p>IL TUO ATELIER DELL'ITALIANO</p>
                    </header>
                    
                    <div class="luciana-tabs">
                        <button class="luciana-tab ${currentTab === 'pending' ? 'active' : ''}" id="tab-pending">Atelier di Oggi</button>
                        <button class="luciana-tab ${currentTab === 'history' ? 'active' : ''}" id="tab-history">Registro Storico</button>
                    </div>

                    <section>
                        <h3 class="luciana-section-title">
                            ${currentTab === 'pending' ? 'Lezioni in sospeso' : 'Fogli Completati'}
                        </h3>
                        <div id="tasks-list" style="display: flex; flex-direction: column; gap: 1.5rem;"></div>
                    </section>
                </div>
                <div class="luciana-progress-wrap">
                    <div class="luciana-ring">
                        <svg viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#F4EFE6" stroke-width="6" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-bordo)" stroke-width="6"
                                stroke-dasharray="282.7" stroke-dashoffset="${282.7 - (282.7 * progressVal) / 100}"
                                style="transition: stroke-dashoffset 1.2s cubic-bezier(0.165, 0.84, 0.44, 1);" stroke-linecap="round" />
                        </svg>
                        <div class="luciana-ring__label">
                            <span class="luciana-ring__value">${progressVal}%</span>
                            <span class="luciana-ring__unit">Il Tuo Cammino</span>
                        </div>
                    </div>
                    <div id="btn-cuaderno" class="luciana-cuaderno-card">
                        <div style="font-size: 2.2rem; margin-bottom: 0.8rem;">📓</div>
                        <h4 style="font-family: var(--font-titles); font-size: 1.5rem; margin: 0; color: var(--color-ink);">Il mio quaderno</h4>
                        <p style="font-family: var(--font-ui); font-size: 0.8rem; font-weight: 900; opacity: 0.4; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.4rem;">Le mie correzioni</p>
                    </div>

                    <div class="luciana-quote">
                        <p>"Ogni parola imparata è un passo verso la libertà dell'anima."</p>
                    </div>
                </div>
            </div>
        `;

        // Task list
        const tList = main.querySelector('#tasks-list');
        if (isLoading) {
            tList.appendChild(LoadingSkeleton(4));
        } else if (listToShow.length === 0) {
            tList.innerHTML = `<div style="padding: 6rem 2rem; text-align: center; font-family: var(--font-handwritten); font-size: 1.8rem; opacity: 0.2;">${currentTab === 'pending' ? 'Il tavolo è pulito... per ora. 🏛️' : 'Nessuna impronta nel passato.'}</div>`;
        } else {
            listToShow.forEach((a, i) => {
                const card = document.createElement('div');
                card.className = 'luciana-task-card';
                card.style.animationDelay = `${i * 0.08}s`;
                let sClass = 'luciana-badge--pending', sText = 'Pendente';
                if (a.status === 'submitted') { sClass = 'luciana-badge--submitted'; sText = 'Consegnato'; }
                if (a.status === 'reviewed') { sClass = 'luciana-badge--reviewed'; sText = 'Visto'; }
                card.innerHTML = `
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 1.2rem; align-items: center; margin-bottom: 0.6rem;">
                            <span style="font-family: var(--font-ui); font-size: 1rem; font-weight: 950; opacity: 0.3; letter-spacing: 0.15em; text-transform: uppercase;">${TYPE_TRANSLATIONS[a.type] || a.type}</span>
                            <span class="luciana-badge ${sClass}">${sText}</span>
                        </div>
                        <h4 style="font-family: var(--font-titles); font-size: 1.7rem; margin: 0; font-weight: 600; color: var(--color-ink);">${a.title}</h4>
                    </div>
                    <div style="font-family: var(--font-ui); font-size: 1.1rem; opacity: 0.25; font-weight: 800;">${new Date(a.assigned_at).toLocaleDateString('it-IT')}</div>
                `;
                card.onclick = () => taskModal.open(a);
                tList.appendChild(card);
            });
        }

        // TABS Events
        main.querySelector('#tab-pending').onclick = () => { currentTab = 'pending'; render(); };
        main.querySelector('#tab-history').onclick = () => { currentTab = 'history'; render(); };
        
        // General Events
        sidebar.querySelector('#btn-logout').onclick = async () => { await signOut(); localStorage.removeItem('luci_user'); navigate('/login'); };
        sidebar.querySelector('#btn-settings').onclick = () => pModal.open(user);
        
        const btnCuaderno = main.querySelector('#btn-cuaderno');
        if (btnCuaderno) btnCuaderno.onclick = () => navigate('/mis-correcciones');


        container.appendChild(sidebar);
        container.appendChild(main);
        if (!document.body.contains(taskModal.overlay)) document.body.appendChild(taskModal.overlay);
        if (!document.body.contains(pModal.overlay)) document.body.appendChild(pModal.overlay);
        if (!document.getElementById('cuaderno-styles')) {
            const style = document.createElement('style');
            style.id = 'cuaderno-styles';
            style.innerHTML = `
                .luciana-cuaderno-card {
                    background: var(--color-parchment);
                    border: 1.5px solid var(--color-dorado-viejo);
                    border-radius: 2rem;
                    padding: 2.5rem 2rem;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
                    margin-top: 2rem;
                    box-shadow: 0 4px 15px rgba(184, 134, 11, 0.05);
                }
                .luciana-cuaderno-card:hover {
                    box-shadow: 0 10px 25px rgba(184, 134, 11, 0.15);
                    transform: translateY(-4px);
                    background: white;
                }
            `;
            document.head.appendChild(style);
        }
    };

    refresh();
    return container;
};
