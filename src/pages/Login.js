import { signIn, signUp, getProfile } from '../services/supabase';
import { toast } from '../components/Toast';

export const LoginPage = (navigate) => {
    let mode = 'login';
    const container = document.createElement('div');
    container.className = 'login-root animate-in';

    const render = () => {
        container.innerHTML = '';

        const bg1 = document.createElement('div');
        bg1.className = 'login-bg-orb login-bg-orb--top';
        const bg2 = document.createElement('div');
        bg2.className = 'login-bg-orb login-bg-orb--bottom';
        container.appendChild(bg1);
        container.appendChild(bg2);

        const card = document.createElement('main');
        card.className = 'login-card';
        card.innerHTML = `
            <div class="login-card__accent"></div>
            <div style="margin-bottom: 4rem;">
                <h1 class="login-title">
                    El Rincón de <span class="login-title__highlight">Luci</span>
                </h1>
                <div style="width: 3.5rem; height: 1px; background: var(--color-terracota); margin: 1.5rem auto; opacity: 0.2;"></div>
            </div>

            <form id="auth-form" class="login-form">
                <div id="loading" class="login-loading">Attesa in corso... ⏳</div>

                ${mode === 'register' ? `
                    <div>
                        <label class="login-label">Nome Completo</label>
                        <input type="text" id="name" class="login-input" placeholder="Giancarlo" required>
                    </div>
                ` : ''}

                <div>
                    <label class="login-label">Identità Atelier (Email)</label>
                    <input type="email" id="email" class="login-input" placeholder="giancarlo@luci.it" required>
                </div>

                <div>
                    <label class="login-label">Codice di Ingresso</label>
                    <div class="login-pwd-wrap">
                        <input type="password" id="password" class="login-input" placeholder="••••••••" required style="padding-right: 3rem;">
                        <button type="button" id="toggle-pwd" class="login-pwd-toggle">👁️</button>
                    </div>
                </div>

                <div style="margin-top: 2rem;">
                    <button type="submit" class="login-btn" id="btn-submit">
                        <span>${mode === 'login' ? 'Entra nell\'Atelier' : 'Crea Identità'}</span>
                        <span>✨</span>
                    </button>
                    <button type="button" id="toggle-mode" class="login-toggle">
                        ${mode === 'login' ? 'Non hai un account? Registrati qui' : 'Hai già un account? Entra'}
                    </button>
                </div>
            </form>

            <footer class="login-footer">— Insegnare è amare —</footer>
        `;
        container.appendChild(card);

        const form = container.querySelector('#auth-form');
        const toggleBtn = container.querySelector('#toggle-mode');
        const loader = container.querySelector('#loading');
        const submitBtn = container.querySelector('#btn-submit');
        const togglePwd = container.querySelector('#toggle-pwd');

        if (togglePwd) {
            togglePwd.onclick = () => {
                const pwdInput = form.querySelector('#password');
                const isPwd = pwdInput.type === 'password';
                pwdInput.type = isPwd ? 'text' : 'password';
                togglePwd.style.opacity = isPwd ? '0.8' : '0.3';
            };
        }

        toggleBtn.onclick = () => { mode = mode === 'login' ? 'register' : 'login'; render(); };

        form.onsubmit = async (e) => {
            e.preventDefault();
            loader.style.display = 'block';
            submitBtn.disabled = true;
            const email = form.querySelector('#email').value.trim();
            const password = form.querySelector('#password').value;

            try {
                if (mode === 'login') {
                    const { data, error } = await signIn(email, password);
                    if (error) throw new Error(error);
                    const { data: profile, error: pError } = await getProfile(data.user.id);
                    if (pError) throw new Error(pError);
                    localStorage.setItem('luci_user', JSON.stringify(profile));
                    toast.show(`Benvenuto, ${profile.name}! 👋`);
                } else {
                    const name = form.querySelector('#name').value.trim();
                    const { error } = await signUp(email, password, name);
                    if (error) throw new Error(error);
                    toast.show("Registrazione riuscita! Accedi ora. ✨");
                    mode = 'login';
                    render();
                    return;
                }
                setTimeout(() => navigate('/dashboard'), 500);
            } catch (err) {
                console.error("[Login Error]", err);
                const msg = err.message.includes('Invalid login credentials') ? 'Codice o Identità non validi.' :
                           err.message.includes('User already registered') ? 'Questa email ha già un Atelier.' :
                           "Ops, c'è stato un problema técnico.";
                toast.show(msg, "error");
                loader.style.display = 'none';
                submitBtn.disabled = false;
            }
        };
    };

    render();
    return container;
};
