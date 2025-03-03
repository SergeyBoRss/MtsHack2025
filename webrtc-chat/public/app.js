const wsUrl = 'wss://212.57.118.207:3000';
let ws;
let pc;
let localStream;
let remoteStream;
let isConnected = false;
let messageQueue = [];

let ws_sub;
let audioContext;
let processor;
let sourceNode;

const toggleConnectionButton = document.getElementById('toggleConnectionButton');
const muteButton = document.getElementById('muteButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const statusMessage = document.getElementById('status');
const localVolume = document.getElementById('localVolume');
const remoteVolume = document.getElementById('remoteVolume');
const subtitlesText = document.getElementById('subtitlesText');
const translationText = document.getElementById('translationText');
const increaseFontSize = document.getElementById('increaseFontSize');
const decreaseFontSize = document.getElementById('decreaseFontSize');

let isSubtitleInitialized = false;

function initWebSocket() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
        console.log('WebSocket соединение установлено');
        statusMessage.textContent = 'Соединение с сервером установлено';
        messageQueue.forEach(message => ws.send(message));
        messageQueue = [];
    };
    ws.onclose = () => {
        console.log('WebSocket закрыт. Переподключение...');
        statusMessage.textContent = 'Потеряно соединение с сервером. Переподключение...';
        setTimeout(initWebSocket, 3000);
    };
    ws.onerror = error => console.error('Ошибка WebSocket:', error);
    ws.onmessage = handleMessage;
}

async function initSubtitle() {
    if (isSubtitleInitialized) {
        console.log("Лишний вызов");
        return;
    }

    if (!remoteStream) {
        console.error('Remote stream is not available');
        return;
    }

    isSubtitleInitialized = true;

    const selectedLanguage = document.getElementById("language").value;

    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    sourceNode = audioContext.createMediaStreamSource(remoteStream);

    ws_sub = new WebSocket("wss://212.57.118.207:8000/ws");
    ws_sub.binaryType = "arraybuffer";
    ws_sub.onopen = function() {
        ws_sub.send(JSON.stringify({ language: selectedLanguage }));
        console.log("Соединение WebSocket для сабов открыто");
    };

    ws_sub.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.result) {
            console.log("Сабы: " + data.result);
            subtitlesText.innerHTML = data.result;
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(data.result));
        }
        // if (data.translation) {
        //     console.log("Перевод: " + data.translation);
        //     translationText.innerHTML = data.translation;
        // }
    };

    processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = function(e) {
        const inputData = e.inputBuffer.getChannelData(0);
        let buffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        if (ws_sub.readyState === WebSocket.OPEN) {
            ws_sub.send(buffer.buffer);
        }
    };

    sourceNode.connect(processor);
    processor.connect(audioContext.destination);
}

function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
    } else {
        console.log('WebSocket не открыт. Сообщение в очереди.');
        messageQueue.push(message);
    }
}

async function startConnection() {
    initWebSocket();

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        pc.candidateQueue = [];

        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        pc.onicecandidate = event => {
            if (event.candidate) sendMessage(JSON.stringify({ candidate: event.candidate }));
        };
        pc.ontrack = event => {
            remoteStream = event.streams[0];
            remoteVideo.srcObject = remoteStream;
            remoteVolume.disabled = false;

            initSubtitle();
        };
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'failed') {
                console.error('ICE Ошибка соединения');
                statusMessage.textContent = 'Ошибка соединения ICE';
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendMessage(JSON.stringify({ offer: pc.localDescription }));

        updateUIConnected();
    } catch (error) {
        console.error('Ошибка подключения:', error);
        statusMessage.textContent = 'Ошибка доступа к медиа устройствам';
    }
}

function disconnect() {
    isSubtitleInitialized = false;
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
    if (pc) pc.close();
    if (ws) ws.close();

    if (processor) {
        processor.disconnect();
    }
    if (sourceNode) {
        sourceNode.disconnect();
    }
    if (audioContext) {
        audioContext.close();
    }
    if (ws_sub && ws_sub.readyState === WebSocket.OPEN) {
        ws_sub.close();
    }

    updateUIDisconnected();
}

async function handleMessage(event) {
    try {
        const text = await event.data.text();
        const data = JSON.parse(text);
        console.log('Получено сообщение:', data);

        if (data.candidate) {
            if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
                pc.candidateQueue.push(data.candidate);
            }
        }

        if (data.offer) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendMessage(JSON.stringify({ answer: pc.localDescription }));
        }

        if (data.answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            pc.candidateQueue.forEach(candidate => pc.addIceCandidate(new RTCIceCandidate(candidate)));
            pc.candidateQueue = [];
        }
    } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
    }
}

function toggleMute() {
    const audioTracks = localStream?.getAudioTracks();
    if (audioTracks && audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        muteButton.innerHTML = audioTracks[0].enabled ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-microphone-slash"></i>';
    }
}

function updateUIConnected() {
    isConnected = true;
    toggleConnectionButton.classList.replace('btn-success', 'btn-danger');
    toggleConnectionButton.innerHTML = '<i class="fa-solid fa-phone-slash"></i>';
    muteButton.disabled = false;
    localVolume.disabled = false;
    statusMessage.textContent = 'Подключено';
}

function updateUIDisconnected() {
    isConnected = false;
    toggleConnectionButton.classList.replace('btn-danger', 'btn-success');
    toggleConnectionButton.innerHTML = '<i class="fa-solid fa-phone"></i>';
    muteButton.disabled = true;
    localVolume.disabled = true;
    remoteVolume.disabled = true;
    statusMessage.textContent = 'Соединение завершено';
}

toggleConnectionButton.addEventListener('click', () => {
    isConnected ? disconnect() : startConnection();
});

muteButton.addEventListener('click', toggleMute);
localVolume.addEventListener('input', () => localStream?.getAudioTracks().forEach(track => track.volume = localVolume.value));
remoteVolume.addEventListener('input', () => {
    if (remoteVideo.srcObject) {
        remoteVideo.volume = remoteVolume.value;
    }
});;

increaseFontSize.addEventListener('click', () => {
    subtitlesText.style.fontSize = `${parseFloat(getComputedStyle(subtitlesText).fontSize) + 2}px`
});

decreaseFontSize.addEventListener('click', () => {
    subtitlesText.style.fontSize = `${parseFloat(getComputedStyle(subtitlesText).fontSize) - 2}px`
});
