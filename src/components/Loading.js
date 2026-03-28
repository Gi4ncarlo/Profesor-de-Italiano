/**
 * Loading states & Skeletons
 */
export const LoadingSkeleton = (count = 3) => {
    const list = document.createElement('div');
    list.style.cssText = `display: flex; flex-direction: column; gap: 2rem; width: 100%;`;
    
    for(let i=0; i<count; i++) {
        const item = document.createElement('div');
        item.style.cssText = `
            height: 120px; background: rgba(0,0,0,0.03); border-radius: 4px;
            animation: pulse 1.5s infinite ease-in-out;
        `;
        list.appendChild(item);
    }

    if (!document.getElementById('skeleton-styles')) {
        const style = document.createElement('style');
        style.id = 'skeleton-styles';
        style.innerHTML = `
            @keyframes pulse {
                0% { opacity: 0.5; }
                50% { opacity: 0.8; }
                100% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }

    return list;
};

export const FullScreenLoading = () => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: var(--color-crema-oscuro); display: flex; align-items: center; justify-content: center;
        z-index: 10000; transition: opacity 0.5s ease-out;
    `;
    overlay.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 2rem; opacity: 0.3; animation: bounce 2s infinite;">☕</div>
            <div style="font-family: var(--font-titles); font-size: 1.5rem; letter-spacing: 0.2em; text-transform: uppercase;">Un momento...</div>
        </div>
        <style>@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }</style>
    `;
    return overlay;
};
