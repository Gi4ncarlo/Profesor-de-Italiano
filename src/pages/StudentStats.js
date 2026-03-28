import { supabase } from '../services/supabaseClient';
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
                <div class="stats-student-role">ALLIEVO DELL'ATELIER</div>
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
        let html = '<h3 class="stats-section-title">Cronaca dell\'Apprendimento</h3>';

        if (studentData.recentActivity.length === 0) {
            html += '<div class="stats-empty">Ancora nessuna impronta...</div>';
        } else {
            studentData.recentActivity.forEach((act, idx) => {
                let badgeClass = 'stats-badge--pending', badgeText = 'IN SVOLGIMENTO';
                if (act.status === 'COMPLETED') { badgeClass = 'stats-badge--completed'; badgeText = 'COMPLETATO ✓'; }
                else if (act.status === 'NEEDS_REVIEW') { badgeClass = 'stats-badge--review'; badgeText = 'DA CORREGGERE ✒️'; }
                html += `
                    <div class="stats-activity-row" data-task-id="${act.task_id}">
                        <div>
                            <div style="display: flex; gap: 0.8rem; align-items: center; margin-bottom: 0.5rem;">
                                <span class="stats-badge ${badgeClass}">${badgeText}</span>
                                <span style="font-family: var(--font-ui); font-size: 1rem; font-weight: 900; opacity: 0.25; text-transform: uppercase; letter-spacing: 0.08em;">${act.type}</span>
                            </div>
                            <h4 style="font-family: var(--font-titles); font-size: 1.6rem; margin: 0; color: var(--color-ink); font-weight: 500;">${act.title}</h4>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-family: var(--font-ui); font-size: 1.05rem; font-weight: 850; opacity: 0.35;">${new Date(act.date).toLocaleDateString('it-IT')}</div>
                            <div style="font-family: var(--font-body); font-size: 1.2rem; opacity: 0.4; margin-top: 0.2rem;">${new Date(act.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    </div>
                `;
            });
        }
        rightCol.innerHTML = html;
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
                const conf = confirm(`Attenzione Giancarlo!\n\nStai per eliminare definitivamente l'account di ${studentData.name} e tutto il suo storico di apprendimento.\n\nQuesta azione non può essere annullata. Vuoi davvero procedere?`);
                if (conf) {
                    try {
                        const { error } = await supabase.auth.admin?.deleteUser(studentData.id) || await supabase.from('profiles').delete().eq('id', studentData.id);
                        if (error) throw error;
                        alert("Account eliminato con successo.");
                        window.history.back();
                    } catch (e) {
                        console.error(e);
                        alert("Impossibile eliminare l'account in questo momento. Magari controlla i permessi o le dipendenze.");
                    }
                }
            };
        }
    };

    renderView();
    loadStudentData();
    return container;
};
