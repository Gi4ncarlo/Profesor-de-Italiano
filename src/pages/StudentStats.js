import { supabase, deleteStudentData } from '../services/supabase';
import { LoadingSkeleton } from '../components/Loading';

export const StudentStatsPage = (navigate, user) => {
    const container = document.createElement('div');
    container.className = 'stats-root';

    let isLoading = true;
    let studentData = {
        name: "Studente", avatar_url: null, joined_at: null,
        stats: { assigned: 0, completed: 0, pendingReview: 0 },
        recentActivity: []
    };

    let filter = 'Tutte';
    let statusFilter = 'Tutti';
    let filteredActivity = [];

    const groupActivityByMonth = (activities) => {
        const groups = {};
        activities.forEach(act => {
            const date = new Date(act.date);
            const monthYear = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
            if (!groups[monthYear]) groups[monthYear] = [];
            groups[monthYear].push(act);
        });
        return groups;
    };

    const applyFilter = () => {
        let results = studentData.recentActivity;

        // Type Filter
        if (filter !== 'Tutte') {
            const map = {
                'Traduzioni': ['translation', 'translation_choice'],
                'Dettato': ['dettato', 'dictation'],
                'Pronuncia': ['pronuncia'],
                'Ordina Frase': ['order_sentence'],
                'Scelta Multipla': ['fill_choice'],
                'Esercizi': ['fill', 'error_correction', 'memory', 'lessico', 'completare'],
                'Lessico': ['flashcard', 'flashcards'],
                'Conversazione': ['roleplay', 'conversazione'],
                'Velocità': ['speed']
            };
            const targets = map[filter] || [];
            results = results.filter(act => targets.includes(act.type?.toLowerCase()));
        }

        // Status Filter
        if (statusFilter !== 'Tutti') {
            const statusMap = {
                'Completati': 'COMPLETED',
                'Da Correggere': 'NEEDS_REVIEW',
                'In Svolgimento': 'PENDING'
            };
            results = results.filter(act => act.status === statusMap[statusFilter]);
        }

        filteredActivity = results;
    };

    const loadStudentData = async () => {
        try {
            console.log("Caricamento profilo allievo...");
            // Use case-insensitive role match to avoid missing 'Student' vs 'student'
            let { data: profileData, error: profileErr } = await supabase
                .from('profiles').select('*').ilike('role', 'student').limit(1).maybeSingle();

            if (!profileData || profileErr) {
                // Fallback: get any profile that isn't the teacher
                const { data: allProfs } = await supabase.from('profiles').select('*');
                if (allProfs) {
                    profileData = allProfs.find(p => p.role?.toLowerCase() === 'student' || p.id !== user.id);
                }
            }

            if (profileData && profileData.id !== user.id) {
                studentData.id = profileData.id;
                studentData.name = profileData.name || "Studente";
                studentData.avatar_url = profileData.avatar_url;
                studentData.joined_at = profileData.created_at;
            } else {
                studentData.name = "Allievo Sconosciuto"; // Avoid displaying Giancarlo
            }

            console.log("Recupero dati missioni e statistiche...");
            // Fetch all assignments since it's a 1-to-1 setup, avoids silent failures if student_id is null
            const { data: assignments, error: assignErr } = await supabase
                .from('task_assignments')
                .select('id, assigned_at, task_id, tasks(id, title, type), submissions(id, created_at, feedback(id))')
                .order('assigned_at', { ascending: false });

            if (assignErr) {
                console.error("Errore task_assignments:", assignErr);
                throw assignErr;
            }

            if (assignments) {
                studentData.stats.assigned = assignments.length;
                studentData.stats.completed = 0;
                studentData.stats.pendingReview = 0;
                const activityFeed = [];

                assignments.forEach(assign => {
                    const submissions = assign.submissions || [];
                    const isSubmitted = submissions.length > 0;
                    const hasFeedback = isSubmitted && submissions.some(s => s.feedback && s.feedback.length > 0);

                    if (hasFeedback) studentData.stats.completed++;
                    if (isSubmitted && !hasFeedback) studentData.stats.pendingReview++;

                    if (assign.tasks) {
                        activityFeed.push({
                            task_id: assign.tasks.id, title: assign.tasks.title,
                            type: assign.tasks.type,
                            date: isSubmitted ? submissions[0].created_at : assign.assigned_at,
                            status: hasFeedback ? 'COMPLETED' : (isSubmitted ? 'NEEDS_REVIEW' : 'PENDING')
                        });
                    }
                });
                studentData.recentActivity = activityFeed;
                applyFilter();
            }
        } catch (err) { console.error("Error loading stats:", err); }
        finally { isLoading = false; renderView(); }
    };

    const renderView = () => {
        container.innerHTML = '';

        // NAV
        const nav = document.createElement('nav');
        nav.className = 'stats-nav';
        nav.innerHTML = `
            <button class="stats-back-btn" id="btn-back"><span style="font-size:1.4rem;">←</span> Ritorna</button>
            <div class="stats-nav__title">Registro <span style="font-style: italic; color: var(--color-terracota);">Allievi</span></div>
            <div class="stats-nav__avatar">${user.name.charAt(0)}</div>
        `;
        nav.querySelector('#btn-back').onclick = () => window.history.back();

        // MAIN
        const main = document.createElement('main');
        main.className = 'stats-main animate-in';

        if (isLoading) {
            main.appendChild(LoadingSkeleton(3));
            container.appendChild(nav);
            container.appendChild(main);
            return;
        }

        // LEFT: Profile
        const leftCol = document.createElement('div');
        leftCol.innerHTML = `
            <div class="stats-profile">
                <div class="stats-avatar">
                    ${studentData.avatar_url ? '<img src="' + studentData.avatar_url + '">' : studentData.name.charAt(0)}
                </div>
                <h2 class="stats-student-name">${studentData.name}</h2>
                <div class="stats-student-role">ALLIEVO DEL LABORATORIO</div>
                ${studentData.joined_at ? '<div class="stats-joined">Ha iniziato il cammino: ' + new Date(studentData.joined_at).toLocaleDateString('it-IT') + '</div>' : ''}
                <div class="stats-grid">
                    <div class="stats-box" style="background: white; border-color: rgba(166, 77, 50, 0.08);">
                        <div class="stats-box__value">${studentData.stats.assigned}</div>
                        <div class="stats-box__label">Capitoli Assegnati</div>
                    </div>
                    <div class="stats-box" style="background: #f0f4e8; border-color: rgba(107, 122, 77, 0.08);">
                        <div class="stats-box__value" style="color: #6b7a4d;">${studentData.stats.completed}</div>
                        <div class="stats-box__label">Completati</div>
                    </div>
                    <div class="stats-box" style="grid-column: span 2; background: #fffcf8; border-color: rgba(166, 77, 50, 0.1);">
                        <div class="stats-box__value" style="font-size: 3.2rem;">${studentData.stats.pendingReview}</div>
                        <div class="stats-box__label">In attesa del tuo sigillo ✒️</div>
                    </div>
                </div>
                          <button id="btn-delete-account" style="margin-top: 3rem; width: 100%; border: 1px solid rgba(220, 53, 69, 0.2); background: transparent; color: #dc3545; padding: 1.2rem; border-radius: 12px; font-family: var(--font-titles); font-size: 1.2rem; cursor: pointer; transition: all 0.3s;">
                    Elimina Account Allievo
                </button>
            </div>
        `;

        // RIGHT: Activity feed
        const rightCol = document.createElement('div');
        let html = `
            <h3 class="stats-section-title">Cronaca dell'Apprendimento</h3>
            
            <div style="margin-bottom: 2rem;">
                <div style="font-family: var(--font-ui); font-size: 1.2rem; font-weight: 950; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1.2rem; color: var(--color-ink);">Filtra per Stato</div>
                <div class="status-filters" style="display: flex; gap: 0.8rem; flex-wrap: wrap;">
                    ${['Tutti', 'Completati', 'Da Correggere', 'In Svolgimento'].map(s => `
                        <button class="status-chip ${statusFilter === s ? 'active' : ''}" data-status="${s}" style="
                            padding: 1rem 2rem; border-radius: 14px; border: 1.5px solid ${statusFilter === s ? 'var(--color-ink)' : 'rgba(0,0,0,0.08)'};
                            background: ${statusFilter === s ? 'var(--color-ink)' : 'white'};
                            color: ${statusFilter === s ? 'white' : 'var(--color-ink)'};
                            font-family: var(--font-ui); font-size: 1.1rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.05em;
                            cursor: pointer; transition: all 0.3s;
                        ">
                            ${s}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div style="margin-bottom: 3.5rem;">
                <div style="font-family: var(--font-ui); font-size: 1.2rem; font-weight: 950; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1.2rem; color: var(--color-ink);">Filtra per Tipologia</div>
                <div class="history-filters" style="display: flex; gap: 0.8rem; flex-wrap: wrap;">
                    ${['Tutte', 'Traduzioni', 'Dettato', 'Pronuncia', 'Ordina Frase', 'Scelta Multipla', 'Esercizi', 'Lessico', 'Conversazione', 'Velocità'].map(f => `
                        <button class="filter-chip ${filter === f ? 'active' : ''}" data-filter="${f}" style="
                            padding: 1rem 2rem; border-radius: 50px; border: 1.5px solid ${filter === f ? 'var(--color-terracota)' : 'rgba(0,0,0,0.08)'};
                            background: ${filter === f ? 'var(--color-terracota)' : 'white'};
                            color: ${filter === f ? 'white' : 'var(--color-ink)'};
                            font-family: var(--font-ui); font-size: 1.1rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.05em;
                            cursor: pointer; transition: all 0.3s;
                        ">
                            ${f}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        if (filteredActivity.length === 0) {
            html += '<div class="stats-empty">Nessun capitolo trovato con questi filtri. 🔎</div>';
        } else {
            const groups = groupActivityByMonth(filteredActivity);
            Object.keys(groups).forEach(month => {
                html += `<div class="month-header" style="
                    margin-top: 5rem; margin-bottom: 2.5rem; padding-bottom: 1.2rem;
                    border-bottom: 1.5px solid rgba(0,0,0,0.08);
                    font-family: var(--font-titles); font-size: 2rem; color: var(--color-terracota); font-weight: 700;
                    text-transform: capitalize;
                ">${month}</div>`;

                groups[month].forEach(act => {
                    let badgeClass = 'stats-badge--pending', badgeText = 'IN SVOLGIMENTO';
                    if (act.status === 'COMPLETED') { badgeClass = 'stats-badge--completed'; badgeText = 'COMPLETATO'; }
                    else if (act.status === 'NEEDS_REVIEW') { badgeClass = 'stats-badge--review'; badgeText = 'DA CORREGGERE'; }

                    html += `
                        <div class="stats-activity-row compact" data-task-id="${act.task_id}" style="
                            padding: 1.4rem 2rem; margin-bottom: 1rem; border-radius: 14px;
                            display: flex; justify-content: space-between; align-items: center;
                            background: white; border: 1.2px solid rgba(0,0,0,0.02);
                            box-shadow: 0 4px 15px rgba(0,0,0,0.02); transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
                            cursor: pointer;
                        ">
                            <div style="flex: 1;">
                                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem;">
                                    <span class="stats-badge ${badgeClass}" style="font-size: 0.95rem; padding: 0.4rem 1.2rem; border-radius: 10px; font-weight: 950;">${badgeText}</span>
                                    <span style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.6; text-transform: uppercase; color: var(--color-ink);">${act.type}</span>
                                </div>
                                <h4 style="font-family: var(--font-titles); font-size: 1.8rem; margin: 0; color: var(--color-ink); font-weight: 500;">${act.title}</h4>
                            </div>
                            <div style="text-align: right; opacity: 1; color: var(--color-ink);">
                                <div style="font-family: var(--font-ui); font-size: 1.2rem; font-weight: 950;">${new Date(act.date).getDate()} ${month.split(' ')[0]}</div>
                                <div style="font-family: var(--font-body); font-size: 1.3rem; opacity: 0.5;">${new Date(act.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>
                    `;
                });
            });
        }
        rightCol.innerHTML = html;

        rightCol.querySelectorAll('.filter-chip').forEach(btn => {
            btn.onclick = () => {
                filter = btn.dataset.filter;
                applyFilter();
                renderView();
            };
        });

        rightCol.querySelectorAll('.status-chip').forEach(btn => {
            btn.onclick = () => {
                statusFilter = btn.dataset.status;
                applyFilter();
                renderView();
            };
        });

        rightCol.querySelectorAll('.stats-activity-row').forEach(row => {
            row.onclick = () => navigate('/task/' + row.dataset.taskId);
        });

        main.appendChild(leftCol);
        main.appendChild(rightCol);
        container.appendChild(nav);
        container.appendChild(main);

        const btnDeleteAcc = container.querySelector('#btn-delete-account');
        if (btnDeleteAcc) {
            btnDeleteAcc.onclick = async () => {
                if (!studentData.id) return alert("Nessun account allievo trovato.");
                const conf = confirm(`Attenzione Giancarlo!\n\nStai per eliminare definitivamente l'account di ${studentData.name} e tutto il suo storico di aprendizaje.\n\nQuesta azione non puede essere annullata. Vuoi davvero procedere?`);
                if (conf) {
                    try {
                        const { success, error } = await deleteStudentData(studentData.id);
                        if (!success) throw error;
                        alert("Account e dati eliminati con successo dal laboratorio.");
                        window.history.back();
                    } catch (e) {
                        console.error(e);
                        alert("Impossibile procedere con la pulizia profonda. Potrebbero esserci vincoli di sistema.");
                    }
                }
            };
        }
    };

    renderView();
    loadStudentData();
    return container;
};
