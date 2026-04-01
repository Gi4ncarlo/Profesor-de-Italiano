export const AudioRecorder = (onAudioReady, maxDuration = 180, isTeacher = false) => {
    const container = document.createElement('div');
    container.className = 'audio-recorder-container animate-in';
    container.style.border = '2px dashed var(--color-terracota)';
    container.style.padding = '2rem';
    container.style.borderRadius = '1.5rem';
    container.style.background = 'rgba(166, 77, 50, 0.03)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '1.5rem';

    let mediaRecorder = null;
    let audioChunks = [];
    let audioBlob = null;
    let audioUrl = null;
    let isRecording = false;
    let recordingTimer = null;
    let secondsElapsed = 0;
    
    // Web Audio API for waveform
    let audioContext = null;
    let analyser = null;
    let microphone = null;
    let animationFrameId = null;

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 60;
    canvas.style.display = 'none';
    const ctx = canvas.getContext('2d');

    const statusText = document.createElement('div');
    statusText.style.fontFamily = 'var(--font-ui)';
    statusText.style.fontSize = '1.3rem';
    statusText.style.fontWeight = '700';
    statusText.style.color = 'var(--color-ink)';
    statusText.innerText = '🎙️ Grabar audio';

    const controlsContainer = document.createElement('div');
    controlsContainer.style.display = 'flex';
    controlsContainer.style.gap = '1rem';
    controlsContainer.style.alignItems = 'center';

    const timeDisplay = document.createElement('div');
    timeDisplay.style.fontFamily = 'var(--font-ui)';
    timeDisplay.style.fontSize = '1.4rem';
    timeDisplay.style.fontWeight = '900';
    timeDisplay.style.color = 'var(--color-terracota)';
    timeDisplay.style.display = 'none';

    const recordBtn = document.createElement('button');
    recordBtn.style.padding = '1rem 2.5rem';
    recordBtn.style.borderRadius = '2rem';
    recordBtn.style.border = 'none';
    recordBtn.style.background = 'var(--color-terracota)';
    recordBtn.style.color = 'white';
    recordBtn.style.fontFamily = 'var(--font-ui)';
    recordBtn.style.fontWeight = '800';
    recordBtn.style.fontSize = '1.2rem';
    recordBtn.style.cursor = 'pointer';
    recordBtn.style.transition = 'all 0.2s ease';
    recordBtn.innerText = '⏺ Iniciar grabación';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';

    const uploadBtn = document.createElement('button');
    uploadBtn.style.padding = '1rem 2.5rem';
    uploadBtn.style.borderRadius = '2rem';
    uploadBtn.style.border = '1px solid var(--color-terracota)';
    uploadBtn.style.background = 'transparent';
    uploadBtn.style.color = 'var(--color-terracota)';
    uploadBtn.style.fontFamily = 'var(--font-ui)';
    uploadBtn.style.fontWeight = '800';
    uploadBtn.style.fontSize = '1.2rem';
    uploadBtn.style.cursor = 'pointer';
    uploadBtn.innerText = '📁 Subir archivo audio';

    const playerContainer = document.createElement('div');
    playerContainer.style.display = 'none';
    playerContainer.style.flexDirection = 'column';
    playerContainer.style.alignItems = 'center';
    playerContainer.style.gap = '1rem';
    playerContainer.style.width = '100%';

    const audioElement = document.createElement('audio');
    audioElement.controls = true;
    audioElement.style.width = '100%';

    const resetBtn = document.createElement('button');
    resetBtn.style.padding = '0.8rem 2rem';
    resetBtn.style.borderRadius = '2rem';
    resetBtn.style.border = '1px dashed var(--color-ink)';
    resetBtn.style.background = 'transparent';
    resetBtn.style.color = 'var(--color-ink)';
    resetBtn.style.fontFamily = 'var(--font-ui)';
    resetBtn.style.fontWeight = '700';
    resetBtn.style.fontSize = '1rem';
    resetBtn.style.opacity = '0.7';
    resetBtn.style.cursor = 'pointer';
    resetBtn.innerText = '🗑 Volver a grabar';

    const useBtn = document.createElement('button');
    useBtn.style.padding = '1rem 2.5rem';
    useBtn.style.borderRadius = '2rem';
    useBtn.style.border = 'none';
    useBtn.style.background = '#065f46';
    useBtn.style.color = 'white';
    useBtn.style.fontFamily = 'var(--font-ui)';
    useBtn.style.fontWeight = '800';
    useBtn.style.fontSize = '1.2rem';
    useBtn.style.cursor = 'pointer';
    useBtn.innerText = '✓ Usar este audio';

    const drawWaveform = () => {
        if (!isRecording) return;
        animationFrameId = requestAnimationFrame(drawWaveform);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = 4;
        const gap = 2;
        const barCount = Math.floor(canvas.width / (barWidth + gap));
        
        // Use center of frequencies
        for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor((i / barCount) * dataArray.length);
            const value = dataArray[dataIndex];
            const percent = value / 255;
            const height = canvas.height * percent;
            const y = (canvas.height - height) / 2; // Center vertically
            
            ctx.fillStyle = '#C4603A'; // Terracota
            ctx.fillRect(i * (barWidth + gap), y, barWidth, height || 2);
        }
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const updateTimer = () => {
        secondsElapsed++;
        timeDisplay.innerText = formatTime(secondsElapsed);
        
        if (secondsElapsed >= maxDuration - 15) {
            timeDisplay.style.color = 'red';
        }
        if (secondsElapsed >= maxDuration) {
            stopRecording();
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
            analyser.fftSize = 256;

            let options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'audio/mp4' }; 
            }
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = {};
            }

            mediaRecorder = new MediaRecorder(stream, options);
            
            mediaRecorder.addEventListener("dataavailable", event => {
                if (event.data.size > 0) audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                audioUrl = URL.createObjectURL(audioBlob);
                audioElement.src = audioUrl;
                
                // Cleanup stream
                stream.getTracks().forEach(track => track.stop());
                if (audioContext) audioContext.close();
                if (animationFrameId) cancelAnimationFrame(animationFrameId);

                showPlayer();
                if (onAudioReady) onAudioReady(audioBlob);
            });

            mediaRecorder.start();
            isRecording = true;
            secondsElapsed = 0;
            timeDisplay.innerText = '0:00';
            timeDisplay.style.color = 'var(--color-terracota)';
            timeDisplay.style.display = 'block';
            
            canvas.style.display = 'block';
            drawWaveform();
            
            recordingTimer = setInterval(updateTimer, 1000);

            statusText.innerText = 'Grabando...';
            recordBtn.innerText = '⏺ Detener';
            recordBtn.style.animation = 'pulse 1.5s infinite';
            recordBtn.style.background = '#dc2626';
            
            // Allow pulsing animation
            if (!document.getElementById('pulse-anim')) {
                const style = document.createElement('style');
                style.id = 'pulse-anim';
                style.innerHTML = `@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }`;
                document.head.appendChild(style);
            }

            uploadBtn.style.display = 'none';
            if (isTeacher) container.querySelector('.or-text').style.display = 'none';
        } catch (err) {
            console.error(err);
            alert("Tu navegador no soporta grabación de audio. Intentá desde Chrome o Safari.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        clearInterval(recordingTimer);
        isRecording = false;
        recordBtn.style.animation = 'none';
        recordBtn.style.background = 'var(--color-terracota)';
        recordBtn.innerText = '⏺ Iniciar grabación';
        timeDisplay.style.display = 'none';
        canvas.style.display = 'none';
    };

    const showPlayer = () => {
        controlsContainer.style.display = 'none';
        statusText.style.display = 'none';
        playerContainer.style.display = 'flex';
    };

    const resetRecorder = () => {
        audioBlob = null;
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        audioUrl = null;
        if (onAudioReady) onAudioReady(null);

        controlsContainer.style.display = 'flex';
        statusText.style.display = 'block';
        statusText.innerText = '🎙️ Grabar audio';
        playerContainer.style.display = 'none';
        
        if (isTeacher) {
            uploadBtn.style.display = 'block';
            container.querySelector('.or-text').style.display = 'block';
        }
    };

    recordBtn.onclick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    resetBtn.onclick = resetRecorder;

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            audioBlob = file;
            audioUrl = URL.createObjectURL(file);
            audioElement.src = audioUrl;
            showPlayer();
            if (onAudioReady) onAudioReady(audioBlob);
        }
    };

    uploadBtn.onclick = () => fileInput.click();
    useBtn.onclick = () => {
        if (onAudioReady) onAudioReady(audioBlob, true); // true = confirmed
    };

    container.appendChild(statusText);
    container.appendChild(timeDisplay);
    container.appendChild(canvas);
    
    controlsContainer.appendChild(recordBtn);
    if (isTeacher) {
        const orText = document.createElement('span');
        orText.className = 'or-text';
        orText.innerText = '— o —';
        orText.style.fontFamily = 'var(--font-ui)';
        orText.style.fontSize = '1.1rem';
        orText.style.opacity = '0.5';
        controlsContainer.appendChild(orText);
        controlsContainer.appendChild(uploadBtn);
        container.appendChild(fileInput);
    }
    container.appendChild(controlsContainer);
    
    playerContainer.appendChild(audioElement);
    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.gap = '1rem';
    actionsRow.appendChild(resetBtn);
    // useBtn could be external context or here if we return it immediately. The requested flow is `Giancarlo` sees `[✓ Usar este audio]` but maybe the parent handles confirmation to upload. 
    // Let's defer "Usar audio" to parent form submission. But Giancarlo requested a button "Usar este audio"
    // Wait, the prompt says "Después de grabar/subir: Reproductor inline, Botón Volver a grabar, Botón Usar este audio".
    // I can provide `useBtn` and let it hide the player controls to indicate it's ready.
    if (isTeacher) {
        actionsRow.appendChild(useBtn);
        useBtn.onclick = () => {
            actionsRow.innerHTML = '<span style="color:var(--color-terracota); font-family:var(--font-ui); font-weight:700;">Audio listo ✓</span> <button style="background:none; border:none; color:var(--color-ink); opacity:0.6; cursor:pointer;" onclick="this.parentNode.parentNode.querySelector(\'button\').click()"> Cambiar</button>';
            if (onAudioReady) onAudioReady(audioBlob, true);
        };
    }
    playerContainer.appendChild(actionsRow);

    container.appendChild(playerContainer);

    return container;
};
