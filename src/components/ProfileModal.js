import { supabase } from '../services/supabaseClient';
import { toast } from '../components/Toast';

/**
 * Profile Modal - Identity Management
 */
export const ProfileModal = (user, onUpdate) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay animate-in';
    overlay.style.cssText = 'display:none; align-items:center; justify-content:center; position:fixed; inset:0; background:rgba(67, 25, 26, 0.4); backdrop-filter:blur(10px); z-index:9000; opacity:0; transition: opacity 0.4s ease;';

    const render = () => {
        overlay.innerHTML = `
            <div class="modal-content profile-modal-content" style="
                width: 60rem; max-width: 90vw; background: #fff; border-radius: 4rem; 
                padding: 0; box-shadow: 0 40px 100px rgba(0,0,0,0.18); 
                overflow: hidden; border: 1px solid rgba(255,255,255,0.2);
            ">
                <!-- Cover Area -->
                <div style="height: 22rem; background: url('/assets/roses.png') center/cover no-repeat; position: relative;">
                    <div style="position: absolute; inset:0; background: linear-gradient(180deg, rgba(107, 16, 36, 0.3), rgba(107, 16, 36, 0.8));"></div>
                </div>

                <!-- Avatar with Overlap -->
                <div style="position: relative; margin-top: -10rem; display: flex; flex-direction: column; align-items: center; padding: 0 6rem 6rem;">
                    <div id="p-avatar-container" style="
                        width: 18rem; height: 18rem; border-radius: 50%; 
                        background: white; border: 4px solid white; 
                        box-shadow: 0 15px 45px rgba(0,0,0,0.12); cursor: pointer; 
                        overflow: hidden; position: relative; transition: all 0.4s ease;
                    ">
                        ${user.avatar_url ? `<img src="${user.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:4rem; background:#f9f9f9; color:#ccc;">👤</div>`}
                        <div id="p-avatar-hover" style="position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(107, 16, 36, 0.6); opacity:0; display:flex; align-items:center; justify-content:center; color:white; font-family:var(--font-ui); font-size:1rem; font-weight:950; text-transform:uppercase; letter-spacing:0.2em; transition:0.3s; backdrop-filter: blur(4px);">Cambia Foto</div>
                    </div>
                    <input type="file" id="p-avatar-input" accept="image/png, image/jpeg, image/jpg" style="display: none;">

                    <!-- Identity Info -->
                    <div style="text-align: center; margin-top: 3.5rem; width: 100%;">
                        <h2 style="font-family: var(--font-heading); font-size: 3.2rem; font-weight: 500; color: var(--color-ink); margin-bottom: 0.8rem; letter-spacing: -0.01em;">Il mio Profilo</h2>
                        <div style="width: 4rem; height: 1.5px; background: var(--color-bordo); margin: 0 auto 3rem; opacity: 0.2;"></div>

                        <div style="display: flex; flex-direction: column; gap: 3rem; text-align: left;">
                            <div class="input-group">
                                <label style="opacity: 0.45; font-family: var(--font-body); font-size: 1.2rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; display: block; margin-bottom: 1.2rem; color: var(--color-bordo);">Nome Completo</label>
                                <input type="text" class="input-elegant" id="p-name" value="${user.name}" placeholder="Il tuo nome" style="
                                    background: #fdfdfd; border: 2px solid rgba(0,0,0,0.04); 
                                    padding: 2rem 2.5rem; font-size: 1.8rem; width:100%; border-radius: 1.8rem; 
                                    font-family: var(--font-body); outline:none; transition: all 0.3s;
                                ">
                            </div>

                            <div style="background: #fffcfc; border: 1.5px solid rgba(107, 16, 36, 0.04); padding: 2.5rem 3rem; border-radius: 2.5rem; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <label style="opacity: 0.45; font-family: var(--font-body); font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; display: block; margin-bottom: 0.5rem; color: var(--color-bordo);">Ruolo nel Atelier</label>
                                    <div style="font-family: var(--font-heading); font-size: 2.8rem; font-weight: 500; color: #43191a; line-height: 1;">
                                        ${user.role === 'teacher' ? 'Maestro Giancarlo' : 'Studentessa'}
                                    </div>
                                </div>
                                <div style="font-size: 3rem; opacity: 0.15; transform: rotate(15deg);">✨</div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 2rem; margin-top: 6rem; justify-content: center;">
                            <button id="p-close" style="
                                background: #f5f5f5; border: 1.5px solid rgba(0,0,0,0.03); 
                                cursor:pointer; font-family: var(--font-body); font-size: 1.15rem; 
                                font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; 
                                opacity: 0.6; transition: all 0.3s; padding: 1.8rem 5rem; border-radius: 20px;
                            ">Chiudi</button>
                            <button class="btn-primary" id="p-save" style="
                                background: var(--color-ink); color: white; border: none; 
                                cursor:pointer; font-family: var(--font-body); font-size: 1.25rem; 
                                font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; 
                                padding: 1.8rem 6.5rem; border-radius: 50px; 
                                box-shadow: 0 10px 30px rgba(0,0,0,0.15); transition: all 0.3s;
                            ">
                                Salva Modifiche
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const avatarContainer = overlay.querySelector('#p-avatar-container');
        const avatarInput = overlay.querySelector('#p-avatar-input');
        const avatarHover = overlay.querySelector('#p-avatar-hover');
        let currentAvatar = user.avatar_url;

        avatarContainer.onmouseover = () => avatarHover.style.opacity = '1';
        avatarContainer.onmouseout = () => avatarHover.style.opacity = '0';
        avatarContainer.onclick = () => avatarInput.click();

        avatarInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 8 * 1024 * 1024) return toast.show("Il file è troppo grande (>8MB)", "error");

            toast.show("Ottimizzazione... ✨");
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 512;
                    canvas.height = 512;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 512, 512);
                    currentAvatar = canvas.toDataURL('image/webp', 0.85);
                    const imgEl = avatarContainer.querySelector('img');
                    if (imgEl) imgEl.src = currentAvatar;
                    else avatarContainer.innerHTML = `<img src="${currentAvatar}" style="width: 100%; height: 100%; object-fit: cover;">`;
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        };

        const closeBtn = overlay.querySelector('#p-close');
        closeBtn.onmouseover = () => { closeBtn.style.background = '#eee'; closeBtn.style.opacity = '1'; };
        closeBtn.onmouseout = () => { closeBtn.style.background = '#f5f5f5'; closeBtn.style.opacity = '0.6'; };
        closeBtn.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => { 
                overlay.style.display = 'none'; 
            }, 400);
        };
        
        overlay.querySelector('#p-save').onclick = async (e) => {
            const saveBtn = overlay.querySelector('#p-save');
            const newName = overlay.querySelector('#p-name').value.trim();
            if (!newName) return toast.show("Il nome non può essere vuoto", "error");

            saveBtn.disabled = true;
            saveBtn.innerHTML = "<span>Salvataggio...</span>";

            try {
                // Delegate saving to the parent dashboard callback (single source of truth)
                await onUpdate(newName, currentAvatar);
                closeBtn.click();
            } catch (err) {
                console.error(err); toast.show("Errore nell'aggiornamento.", "error");
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = "<span>Salva Modifiche</span>";
            }
        };
    };

    return {
        overlay,
        open: (updatedUser) => { 
            if (updatedUser) user = updatedUser;
            render(); 
            overlay.style.display = 'flex'; 
            setTimeout(() => { overlay.style.opacity = '1'; }, 10);
        }
    };
};
