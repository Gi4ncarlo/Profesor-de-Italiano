/**
 * ConfirmModal.js - L'Atelier Confirmation Dialogue
 * A premium, glassmorphism modal to replace standard browser alerts.
 */
export const ConfirmModal = (onConfirm) => {
    const overlay = document.createElement('div');
    overlay.className = 'atelier-modal-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
        display: none; justify-content: center; align-items: center; z-index: 10000;
        opacity: 0; transition: all 0.3s ease;
    `;

    const content = document.createElement('div');
    content.className = 'confirm-card';
    content.style.cssText = `
        background: white; border-radius: 2rem; padding: 2.5rem;
        max-width: 400px; width: 90%; text-align: center;
        box-shadow: 0 20px 50px rgba(0,0,0,0.2);
        transform: scale(0.9); transition: all 0.3s ease;
    `;

    let activeTitle = "Vuoi procedere?";
    let activeMessage = "Sei sicuro di voler completare questa azione?";
    let currentData = null;

    const render = () => {
        content.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
            <h2 style="font-family: var(--font-titles); font-size: 1.8rem; margin-bottom: 0.8rem; color: var(--color-ink);">${activeTitle}</h2>
            <p style="font-family: var(--font-body); font-size: 1.1rem; color: #666; margin-bottom: 2rem; line-height: 1.5;">${activeMessage}</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button id="confirm-cancel" style="flex: 1; padding: 1rem; border-radius: 1rem; border: 1px solid #ddd; background: white; cursor: pointer; font-family: var(--font-ui); font-weight: 700;">Annulla</button>
                <button id="confirm-ok" style="flex: 1; padding: 1rem; border-radius: 1rem; border: none; background: #993333; color: white; cursor: pointer; font-family: var(--font-ui); font-weight: 700;">Elimina</button>
            </div>
        `;

        content.querySelector('#confirm-cancel').onclick = () => hide();
        content.querySelector('#confirm-ok').onclick = async () => {
            const btn = content.querySelector('#confirm-ok');
            btn.textContent = 'Eliminando...';
            btn.disabled = true;
            if (onConfirm) await onConfirm(currentData);
            hide();
        };
    };

    const show = (title, message, data) => {
        activeTitle = title;
        activeMessage = message;
        currentData = data;
        render();
        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.opacity = '1';
            content.style.transform = 'scale(1)';
        }, 10);
    };

    const hide = () => {
        overlay.style.opacity = '0';
        content.style.transform = 'scale(0.9)';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    };

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    return { show, hide };
};
