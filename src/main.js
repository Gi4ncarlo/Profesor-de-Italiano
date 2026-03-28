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

const render = async () => {
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
        app.appendChild(TaskDetailsPage(navigate, profile, { id: taskId }));
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
