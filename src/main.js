import './styles/design-system.css';
import './styles/sidebar.css';
import './styles/login.css';
import './styles/giancarlo.css';
import './styles/luciana.css';
import './styles/student-stats.css';

import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { TaskDetailsPage } from './pages/TaskDetails';
import { StudentStatsPage } from './pages/StudentStats';
import { CorrectionsHistoryPage } from './pages/CorrectionsHistory';

import { getSession, getProfile, signOut } from './services/supabase';
import { FullScreenLoading } from './components/Loading';
import { toast } from './components/Toast';


const app = document.getElementById('app');

const navigate = (path) => {
    window.location.hash = path;
    const loader = FullScreenLoading();
    document.body.appendChild(loader);
    setTimeout(() => {
        render();
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
    }, 600);
};

// --- Inactivity Timer Logic ---
let inactivityTimer = null;
const INACTIVITY_LIMIT = 60 * 60 * 1000; // 60 minutes
const LAST_ACTIVITY_KEY = 'luci_last_activity';

const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    // Don't update if we're on the login page (prevents keeping session alive accidentally during login)
    if (window.location.hash !== '#/login') {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }
    inactivityTimer = setTimeout(handleInactivitySignOut, INACTIVITY_LIMIT);
};

const handleInactivitySignOut = async () => {
    const { data } = await getSession();
    if (data?.session) {
        await signOut();
        localStorage.removeItem('luci_user');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        toast.show("Sessione terminata per inattività (60 min) 🏛️", "info");
        window.location.hash = '#/login';
    }
};

const checkPersistentInactivity = async () => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity && window.location.hash !== '#/login') {
        const diff = Date.now() - parseInt(lastActivity, 10);
        if (diff > INACTIVITY_LIMIT) {
            await handleInactivitySignOut();
            return true;
        }
    }
    return false;
};

// Attach listeners to common user interactions
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(name => {
    document.addEventListener(name, resetInactivityTimer, true);
});
// Start the initial timer
resetInactivityTimer();



const render = async () => {
    // Check if session has expired due to persistent inactivity
    const hasExpired = await checkPersistentInactivity();
    if (hasExpired) return;

    const rawPath = window.location.hash || '#/login';
    const path = rawPath.replace('#', '') || '/login';

    let session, profile;
    try {
        const sessionRes = await getSession();
        session = sessionRes.data;


        if (session) {
            const cachedProfile = localStorage.getItem('luci_user');
            if (cachedProfile && cachedProfile !== 'undefined') {
                profile = JSON.parse(cachedProfile);
                // Ensure profile is the data object, not the wrapper
                if (profile.data) profile = profile.data;
            } else {
                const profileRes = await getProfile(session.user.id);
                profile = profileRes.data;
                localStorage.setItem('luci_user', JSON.stringify(profile));
            }
        }
    } catch (err) {
        console.error("Session Fail:", err);
        session = null;
    }

    if (!session && path !== '/login') {
        localStorage.removeItem('luci_user');
        window.location.hash = '#/login';
        return;
    }
    if (session && path === '/login') {
        window.location.hash = '#/dashboard';
        return;
    }

    app.innerHTML = '';

    if (path === '/login') {
        app.appendChild(LoginPage(navigate));
    } else if (path === '/dashboard') {
        app.appendChild(DashboardPage(navigate, profile));
    } else if (path.startsWith('/task/')) {
        const taskId = path.split('/')[2];
        if (profile.role === 'teacher') {
            app.appendChild(TaskDetailsPage(navigate, profile, { id: taskId }));
        } else {
            // Students shouldn't usually land here, but if they do, we can redirect or show dashboard
            window.location.hash = '#/dashboard';
        }
    } else if (path.startsWith('/assignment/')) {
        const assignId = path.split('/')[2];
        // This is a special virtual route for students to open the modal directly on dashboard
        window.location.hash = '#/dashboard';
        // We'll handle the actual opening in the Dashboard component by looking at the URL or a shared state
        // For now, let's keep it simple and ensure the Dashboard knows which one to open
        localStorage.setItem('open_assignment_id', assignId);
    } else if (path === '/student/stats') {
        app.appendChild(StudentStatsPage(navigate, profile));
    } else if (path === '/mis-correcciones') {
        app.appendChild(CorrectionsHistoryPage(navigate, profile));
    } else {

        app.innerHTML = `
            <div class="animate-in" style="padding: 10rem; text-align: center;">
                <h1 style="font-size: 5rem; opacity: 0.08; font-family: var(--font-titles);">404</h1>
                <p style="font-size: 1.4rem; font-family: var(--font-body); margin-top: 1rem;">Pagina non trovata.</p>
                <button onclick="location.hash='#/dashboard'" style="margin-top: 2rem; padding: 1rem 2rem; border: 1px solid rgba(0,0,0,0.1); background: white; border-radius: 1rem; cursor: pointer; font-family: var(--font-ui); font-size: 1.1rem;">Torna in classe</button>
            </div>
        `;
    }
};

window.onpopstate = () => render();
window.onload = render;
