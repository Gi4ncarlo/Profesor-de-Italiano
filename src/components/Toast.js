/**
 * Reusable Toast Notification Component
 */
export const Toast = () => {
    const element = document.createElement('div');
    element.id = 'toast-container';
    element.style.cssText = `
        position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
        display: flex; flex-direction: column; gap: 1rem; pointer-events: none;
    `;
    document.body.appendChild(element);

    const show = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = 'animate-in';
        toast.style.cssText = `
            padding: 1.2rem 2.5rem; 
            background: ${type === 'success' ? 'var(--color-terracota)' : '#800000'};
            color: white; 
            font-family: var(--font-ui); 
            font-size: 0.7rem; 
            font-weight: 800;
            letter-spacing: 0.15em;
            text-transform: uppercase; 
            border-radius: 50px; 
            box-shadow: 0 15px 45px rgba(0,0,0,0.2);
            pointer-events: auto; 
            min-width: 280px; 
            text-align: center;
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
        `;
        toast.innerText = message;
        element.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.5s ease-out';
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    };

    return { show };
};

// Singleton instance
export const toast = Toast();
