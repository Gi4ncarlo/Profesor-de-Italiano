import { LucianaDashboard } from './LucianaDashboard';
import { GiancarloDashboard } from './GiancarloDashboard';

/**
 * Dashboard Loader Page
 */
export const DashboardPage = (navigate, user) => {
    const container = document.createElement('div');
    
    // Clear any entry styles if necessary
    const entryStyle = document.getElementById('entry-styles');
    if (entryStyle) entryStyle.remove();

    if (user.role === 'student') {
        container.appendChild(LucianaDashboard(navigate, user));
    } else {
        container.appendChild(GiancarloDashboard(navigate, user));
    }

    return container;
};
