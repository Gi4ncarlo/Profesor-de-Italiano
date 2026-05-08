import { createConsultation } from '../services/consultations';
import { toast } from './Toast';

export const ConsultationModal = (user, onSaveCallback) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'none';
    
    const teacherId = import.meta.env.VITE_GIORGIO_ID || 'ba0fd656-e5f7-42f4-9969-098a80440002'; 

    let viewDate = new Date();
    let selectedDate = null;
    let selectedTime = "15:00"; // Default time slot

    const getDaysInMonth = (year, month) => {
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startOffset - 1; i >= 0; i--) {
            days.push({ day: prevMonthLastDay - i, month: month - 1, year, currentMonth: false });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, month, year, currentMonth: true });
        }
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, month: month + 1, year, currentMonth: false });
        }
        return days;
    };

    const render = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const monthName = viewDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        const days = getDaysInMonth(year, month);

        overlay.innerHTML = `
            <style>
                .custom-picker-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; }
                .picker-day { 
                    aspect-ratio: 1; display: flex; align-items: center; justify-content: center; 
                    border-radius: 12px; font-family: var(--font-ui); font-size: 1.1rem; cursor: pointer;
                    transition: all 0.2s; border: 1.5px solid transparent;
                }
                .picker-day:hover { background: rgba(166, 77, 50, 0.05); color: var(--color-terracota); }
                .picker-day.selected { background: var(--color-terracota); color: white; box-shadow: 0 4px 12px rgba(166, 77, 50, 0.3); }
                .picker-day.today { border-color: rgba(166, 77, 50, 0.2); font-weight: 900; }
                .picker-day.other-month { opacity: 0.2; pointer-events: none; }
                .time-slot { 
                    padding: 0.8rem; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.05); 
                    text-align: center; font-family: var(--font-ui); font-size: 1rem; cursor: pointer;
                    transition: all 0.2s;
                }
                .time-slot:hover { border-color: var(--color-terracota); color: var(--color-terracota); }
                .time-slot.selected { background: var(--color-ink); color: white; border-color: var(--color-ink); }

                @media (max-width: 768px) {
                    .modal-content.consultation-modal {
                        flex-direction: column !important;
                        max-width: 90% !important;
                        max-height: 85vh;
                        overflow-y: auto !important;
                    }
                    .calendar-pane {
                        border-right: none !important;
                        border-bottom: 1.5px solid rgba(0,0,0,0.03);
                        padding: 2rem !important;
                    }
                    .details-pane {
                        padding: 2.5rem !important;
                    }
                    .picker-day { font-size: 1rem; }
                    .modal-content h2 { font-size: 2.2rem !important; }
                }
            </style>
            <div class="modal-content consultation-modal animate-in" style="max-width: 750px; padding: 0; overflow: hidden; display: flex; flex-direction: row;">
                <!-- LEFT: CALENDAR -->
                <div class="calendar-pane" style="flex: 1.2; padding: 4rem; background: white; border-right: 1.5px solid rgba(0,0,0,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem;">
                        <h2 style="font-family: var(--font-titles); font-size: 2.8rem; color: var(--color-ink); margin: 0;">Scegli il <span style="font-style: italic; color: var(--color-terracota);">Giorno</span></h2>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <button id="prev-month" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; opacity: 0.4;">←</button>
                            <span style="font-family: var(--font-ui); font-size: 1.1rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; min-width: 140px; text-align: center;">${monthName}</span>
                            <button id="next-month" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; opacity: 0.4;">→</button>
                        </div>
                    </div>

                    <div class="custom-picker-grid" style="margin-bottom: 1rem; opacity: 0.3;">
                        ${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(d => `<div style="text-align: center; font-family: var(--font-ui); font-size: 0.8rem; font-weight: 950; padding-bottom: 1rem;">${d}</div>`).join('')}
                    </div>
                    <div class="custom-picker-grid">
                        ${days.map(d => {
                            const dateObj = new Date(d.year, d.month, d.day);
                            const isToday = dateObj.toDateString() === new Date().toDateString();
                            const isSelected = selectedDate && dateObj.toDateString() === selectedDate.toDateString();
                            return `<div class="picker-day ${d.currentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateObj.toISOString()}">${d.day}</div>`;
                        }).join('')}
                    </div>
                </div>

                <!-- RIGHT: DETAILS & TIME -->
                <div class="details-pane" style="flex: 0.8; padding: 4rem; background: var(--color-crema); display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: flex-end; margin-bottom: 2rem;">
                         <button class="btn-close" style="background: none; border: none; font-size: 2.5rem; cursor: pointer; color: var(--color-ink); opacity: 0.3;">&times;</button>
                    </div>

                    <div style="margin-bottom: 3rem;">
                        <label style="display: block; font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; letter-spacing: 0.1em; color: var(--color-ink); opacity: 0.5; margin-bottom: 1.5rem; text-transform: uppercase;">Orario</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                            ${['15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map(t => `
                                <div class="time-slot ${selectedTime === t ? 'selected' : ''}" data-time="${t}">${t}</div>
                            `).join('')}
                        </div>
                    </div>

                    <div style="margin-bottom: 4rem;">
                        <label style="display: block; font-family: var(--font-ui); font-size: 0.9rem; font-weight: 950; letter-spacing: 0.1em; color: var(--color-ink); opacity: 0.5; margin-bottom: 1.5rem; text-transform: uppercase;">Argomento</label>
                        <textarea id="consultation-topic" placeholder="Cosa vorresti ripassare?" style="width: 100%; padding: 1.2rem; border-radius: 12px; border: 1.5px solid rgba(0,0,0,0.05); font-family: var(--font-handwritten); font-size: 1.4rem; color: var(--color-ink); outline: none; min-height: 80px; resize: none; background: white;"></textarea>
                    </div>

                    <button id="btn-submit-consultation" style="width: 100%; background: var(--color-terracota); color: white; padding: 1.5rem; border: none; border-radius: 12px; font-family: var(--font-ui); font-size: 1.1rem; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.3s; box-shadow: 0 8px 15px rgba(166, 77, 50, 0.2);">
                        Prenota Ora ✨
                    </button>
                </div>
            </div>
        `;

        // Wiring events
        overlay.querySelector('.btn-close').onclick = close;
        overlay.querySelector('#prev-month').onclick = () => { viewDate.setMonth(viewDate.getMonth() - 1); render(); };
        overlay.querySelector('#next-month').onclick = () => { viewDate.setMonth(viewDate.getMonth() + 1); render(); };
        
        overlay.querySelectorAll('.picker-day:not(.other-month)').forEach(day => {
            day.onclick = () => {
                selectedDate = new Date(day.dataset.date);
                render();
            };
        });

        overlay.querySelectorAll('.time-slot').forEach(slot => {
            slot.onclick = () => {
                selectedTime = slot.dataset.time;
                render();
            };
        });

        const btnSubmit = overlay.querySelector('#btn-submit-consultation');
        btnSubmit.onclick = async () => {
            const topicVal = overlay.querySelector('#consultation-topic').value;

            if (!selectedDate) return toast.show("Per favore, seleziona un giorno.", "error");
            
            const [hours, minutes] = selectedTime.split(':');
            const finalDate = new Date(selectedDate);
            finalDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            const btnOrigText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = 'Pianificando...';
            btnSubmit.disabled = true;

            try {
                const { error } = await createConsultation({
                    studentId: user.id,
                    teacherId: teacherId,
                    requestedDatetime: finalDate.toISOString(),
                    topic: topicVal
                });
                if (error) throw error;
                toast.show("Richiesta inviata! ✨", "success");
                close();
                if (onSaveCallback) onSaveCallback();
            } catch (err) {
                console.error(err);
                toast.show("Errore nella richiesta.", "error");
            } finally {
                btnSubmit.innerHTML = btnOrigText;
                btnSubmit.disabled = false;
            }
        };
    };

    const close = () => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.classList.remove('fade-out');
            selectedDate = null;
        }, 300);
    };

    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    return {
        overlay,
        open: () => {
            overlay.style.display = 'flex';
            render();
        }
    };
};
