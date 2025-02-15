let socket;
let displayDiv = document.getElementById('textDisplay');
let micAvailable = false;

navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        micAvailable = true;
        startStreaming(stream);
    })
    .catch(err => {
        console.error("Нет доступа к микрофону:", err);
        displayDiv.innerText = "Нет доступа к микрофону!";
    });

function startStreaming(stream) {
    socket = new WebSocket("ws://localhost:8000");

    socket.onopen = () => {
        console.log("Подключено к серверу");
        displayDiv.innerText = "Говорите...";
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        displayDiv.innerHTML += `<span class="yellow">${data.text}</span><br>`;
    };

    socket.onerror = (error) => {
        console.error("Ошибка WebSocket:", error);
        displayDiv.innerText = "Ошибка соединения с сервером.";
    };

    socket.onclose = () => {
        console.log("Соединение закрыто");
        displayDiv.innerText = "Соединение с сервером закрыто.";
    };

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16Bit = new Int16Array(inputData.length);

        for (let i = 0; i < inputData.length; i++) {
            pcm16Bit[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(pcm16Bit.buffer);
        }
    };
}