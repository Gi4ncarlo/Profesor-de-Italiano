import { toast } from './Toast';

export const ReviewModal = (onReview) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay animate-in';
    overlay.style.display = 'none';

    let currentItem = null;

    const open = (item) => {
        currentItem = item;
        overlay.style.display = 'flex';
        render();
    };

    const close = () => { overlay.style.display = 'none'; };

    const render = () => {
        const item = currentItem;
        const title = item.title;
        const status = item.computedStatus;
        const answers = item.answers;

        overlay.innerHTML = `
            <div class="modal-content animate-in" style="width: 100rem; padding: 5.5rem 7.5rem;">
                <button class="modal-close">×</button>
                <div style="position: absolute; top: 0; left: 0; right: 0; height: 10px; background: var(--color-terracota); border-radius: 2px 2px 0 0;"></div>

                <div style="margin-bottom: 5rem; text-align: center;">
                    <div style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 950; opacity: 0.3; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 1.2rem;">Revisione Interna Atelier</div>
                    <h2 style="font-family: var(--font-titles); font-size: 3.8rem; color: var(--color-ink); line-height: 1.15;">${title}</h2>
                    <div style="font-family: var(--font-handwritten); font-size: 2.2rem; color: var(--color-terracota); margin-top: 1rem;">Per Luciana ✉️</div>
                </div>
                
                ${answers && answers.data ? `
                    <div style="margin-bottom: 5rem;">
                        <h4 style="font-family: var(--font-ui); font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.2em; opacity: 0.45; margin-bottom: 2.5rem; border-bottom: 1.5px solid rgba(0,0,0,0.03); padding-bottom: 1rem;">Risposte di Luci</h4>
                        <div style="padding: 4.5rem; background: #fafafa; border: 1.5px dashed rgba(67, 25, 26, 0.12); border-radius: 2.4rem; font-family: var(--font-handwritten); font-size: 2.2rem; line-height: 1.8; color: var(--color-ink); box-shadow: inset 0 4px 12px rgba(0,0,0,0.01);">
                            ${(Array.isArray(answers.data) ? answers.data : [answers.data]).map(ans => `<div style="margin-bottom: 1.5rem;">"${ans}"</div>`).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="input-group">
                    <label style="font-family: var(--font-ui); font-size: 1.05rem; font-weight: 850; text-transform: uppercase; letter-spacing: 0.15em; color: var(--color-ink); display: block; margin-bottom: 2rem; opacity: 0.5;">Firma la tua correzione:</label>
                    <textarea class="input" id="rm-feedback" style="min-height: 24rem; font-family: var(--font-handwritten); font-size: 2.4rem; padding: 3rem; background: white; border-radius: 2rem; box-shadow: 0 4px 16px rgba(0,0,0,0.01); border: 1.5px solid rgba(0,0,0,0.06);" placeholder="Brava Luci! Solo un piccolo errore sul passato prossimo..."></textarea>
                </div>
                
                <div style="display: flex; gap: 3rem; margin-top: 5rem; justify-content: flex-end; align-items: center;">
                    <button style="background:none; border:none; font-family: var(--font-ui); font-size: 1.1rem; font-weight: 850; letter-spacing: 0.2em; text-transform: uppercase; cursor:pointer; opacity: 0.4;" id="closeReview">Chiudi</button>
                    ${status === 'TO REVIEW' ? '<button class="btn btn-primary" id="review-submit" style="font-size: 1.1rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.15em; padding: 1.4rem 4rem; border-radius: 50px;">Firma Revisione ✉️</button>' : ''}
                </div>
            </div>
        `;

        overlay.querySelector('#closeReview').onclick = close;
        overlay.querySelector('.modal-close').onclick = close;

        const submitBtn = overlay.querySelector('#review-submit');
        if (submitBtn) {
            submitBtn.onclick = async () => {
                const feed = overlay.querySelector('#rm-feedback').value;
                if (!feed) return toast.show('Scrivi un commento!', 'warning');
                await onReview(currentItem.id, feed);
                close();
            };
        }
    };

    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    return { overlay, open, close };
};
