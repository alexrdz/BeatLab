class Sequencer {
    constructor() {
        this.bpm = 120;
        this.playing = false;
        this.currentStep = 0;
        this.samples = new Array(4).fill(null);
        this.grid = Array(4).fill().map(() => Array(8).fill(false));

        // Initialize Tone.js
        Tone.Transport.bpm.value = this.bpm;
        this.players = Array(4).fill(null);

        // Initialize effects
        this.reverb = new Tone.Reverb({
            decay: 1.5,
            wet: 0.3
        }).toDestination();

        this.delay = new Tone.FeedbackDelay({
            delayTime: 0.25,
            feedback: 0.3,
            wet: 0.3
        }).toDestination();

        // Main output channel
        this.mainChannel = new Tone.Channel().toDestination();

        // Effects are initially bypassed
        this.reverb.wet.value = 0;
        this.delay.wet.value = 0;

        this.initializeUI();
        this.setupEventListeners();
        this.setupEffectEventListeners();
    }

    initializeUI() {
        // Generate sample slots
        const sampleSlotsContainer = document.getElementById('sampleSlots');
        for (let i = 0; i < 4; i++) {
            const slot = document.createElement('div');
            slot.className = 'sample-slot';
            slot.innerHTML = `
                <div class="drag-area" data-slot="${i}">
                    Drag & drop audio file or click to upload
                    <input type="file" accept="audio/*" class="d-none">
                </div>
                <div class="controls">
                    <button class="btn btn-sm btn-secondary preview-btn" data-slot="${i}">
                        <i class="bi bi-play-fill"></i> Preview
                    </button>
                    <input type="range" class="volume-control form-range" 
                           min="0" max="1" step="0.1" value="0.7" data-slot="${i}">
                    <span class="volume-label">70%</span>
                </div>
            `;
            sampleSlotsContainer.appendChild(slot);
        }

        // Generate sequencer grid
        const gridContainer = document.getElementById('sequencerGrid');
        for (let row = 0; row < 4; row++) {
            const stepRow = document.createElement('div');
            stepRow.className = 'step-row';

            for (let step = 0; step < 8; step++) {
                const button = document.createElement('button');
                button.className = 'step-button';
                button.dataset.row = row;
                button.dataset.step = step;
                stepRow.appendChild(button);
            }

            gridContainer.appendChild(stepRow);
        }
    }

    setupEffectEventListeners() {
        // Reverb controls
        document.getElementById('reverbToggle').addEventListener('change', (e) => {
            this.reverb.wet.value = e.target.checked ?
                document.getElementById('reverbMix').value : 0;
        });

        document.getElementById('reverbDecay').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.reverb.decay = value;
            document.getElementById('reverbDecayValue').textContent = value.toFixed(1) + 's';
        });

        document.getElementById('reverbMix').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (document.getElementById('reverbToggle').checked) {
                this.reverb.wet.value = value;
            }
            document.getElementById('reverbMixValue').textContent =
                Math.round(value * 100) + '%';
        });

        // Delay controls
        document.getElementById('delayToggle').addEventListener('change', (e) => {
            this.delay.wet.value = e.target.checked ?
                document.getElementById('delayMix').value : 0;
        });

        document.getElementById('delayTime').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.delay.delayTime.value = value;
            document.getElementById('delayTimeValue').textContent = value.toFixed(2) + 's';
        });

        document.getElementById('delayFeedback').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.delay.feedback.value = value;
            document.getElementById('delayFeedbackValue').textContent =
                Math.round(value * 100) + '%';
        });

        document.getElementById('delayMix').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (document.getElementById('delayToggle').checked) {
                this.delay.wet.value = value;
            }
            document.getElementById('delayMixValue').textContent =
                Math.round(value * 100) + '%';
        });
    }

    setupEventListeners() {
        // Transport controls
        document.getElementById('playButton').addEventListener('click', () => this.togglePlay());
        document.getElementById('stopButton').addEventListener('click', () => this.stop());

        // BPM control
        const bpmControl = document.getElementById('bpmControl');
        bpmControl.addEventListener('input', (e) => {
            this.bpm = parseInt(e.target.value);
            document.getElementById('bpmValue').textContent = this.bpm;
            Tone.Transport.bpm.value = this.bpm;
        });

        // Step buttons
        document.querySelectorAll('.step-button').forEach(button => {
            button.addEventListener('click', () => {
                const row = parseInt(button.dataset.row);
                const step = parseInt(button.dataset.step);
                this.grid[row][step] = !this.grid[row][step];
                button.classList.toggle('active');
            });
        });

        // Sample slots
        document.querySelectorAll('.drag-area').forEach(area => {
            area.addEventListener('dragover', (e) => {
                e.preventDefault();
                area.classList.add('drag-over');
            });

            area.addEventListener('dragleave', () => {
                area.classList.remove('drag-over');
            });

            area.addEventListener('drop', async (e) => {
                e.preventDefault();
                area.classList.remove('drag-over');
                const slot = parseInt(area.dataset.slot);
                const file = e.dataTransfer.files[0];
                await this.loadSample(slot, file);
            });

            area.addEventListener('click', () => {
                const input = area.querySelector('input[type="file"]');
                input.click();
            });

            const input = area.querySelector('input[type="file"]');
            input.addEventListener('change', async (e) => {
                const slot = parseInt(area.dataset.slot);
                const file = e.target.files[0];
                await this.loadSample(slot, file);
            });
        });

        // Volume controls
        document.querySelectorAll('.volume-control').forEach(control => {
            control.addEventListener('input', (e) => {
                const slot = parseInt(e.target.dataset.slot);
                const volume = parseFloat(e.target.value);
                if (this.players[slot]) {
                    this.players[slot].volume.value = Tone.gainToDb(volume);
                }
                const label = e.target.nextElementSibling;
                label.textContent = `${Math.round(volume * 100)}%`;
            });
        });

        // Preview buttons
        document.querySelectorAll('.preview-btn').forEach(button => {
            button.addEventListener('click', () => {
                const slot = parseInt(button.dataset.slot);
                if (this.players[slot]) {
                    if (this.players[slot].state === 'started') {
                        this.players[slot].stop();
                        button.innerHTML = '<i class="bi bi-play-fill"></i> Preview';
                    } else {
                        this.players[slot].start();
                        button.innerHTML = '<i class="bi bi-stop-fill"></i> Stop';
                    }
                }
            });
        });
    }

    async loadSample(slot, file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);

            // Stop and clean up the old player if it exists
            if (this.players[slot]) {
                if (this.players[slot].state === 'started') {
                    this.players[slot].stop();
                }
                this.players[slot].disconnect();
                this.players[slot].dispose();
            }

            // Create new player and connect through effects chain
            this.players[slot] = new Tone.Player({
                url: audioBuffer,
                loop: false // Ensure samples don't loop by default
            });
            this.players[slot].chain(this.delay, this.reverb, this.mainChannel);

            this.samples[slot] = file.name;

            // Update UI
            const dragArea = document.querySelector(`.drag-area[data-slot="${slot}"]`);
            dragArea.textContent = file.name;

            // Reset preview button state
            const previewBtn = document.querySelector(`.preview-btn[data-slot="${slot}"]`);
            if (previewBtn) {
                previewBtn.innerHTML = '<i class="bi bi-play-fill"></i> Preview';
            }
        } catch (error) {
            console.error('Error loading sample:', error);
        }
    }

    togglePlay() {
        if (this.playing) {
            this.stop();
        } else {
            this.play();
        }
    }

    play() {
        this.playing = true;
        document.getElementById('playButton').innerHTML = '<i class="bi bi-pause-fill"></i> Pause';

        if (Tone.Transport.state !== 'started') {
            Tone.Transport.scheduleRepeat((time) => {
                this.playStep(time);
            }, '8n');

            Tone.Transport.start();
        }
    }

    stop() {
        this.playing = false;
        document.getElementById('playButton').innerHTML = '<i class="bi bi-play-fill"></i> Play';
        this.currentStep = 0;
        Tone.Transport.stop();

        // Stop all currently playing samples
        this.players.forEach((player, index) => {
            if (player && player.state === 'started') {
                player.stop();
                // Reset preview button state if it was in "Stop" mode
                const previewBtn = document.querySelector(`.preview-btn[data-slot="${index}"]`);
                if (previewBtn) {
                    previewBtn.innerHTML = '<i class="bi bi-play-fill"></i> Preview';
                }
            }
        });

        this.updateStepIndicators();
    }

    playStep(time) {
        // Update visual indication
        this.updateStepIndicators();

        // Play active samples
        for (let row = 0; row < 4; row++) {
            if (this.grid[row][this.currentStep] && this.players[row]) {
                // Stop any currently playing instance of this sample
                if (this.players[row].state === 'started') {
                    this.players[row].stop();
                }
                this.players[row].start(time);
            }
        }

        this.currentStep = (this.currentStep + 1) % 8;
    }

    updateStepIndicators() {
        document.querySelectorAll('.step-button').forEach(button => {
            button.classList.remove('current');
            if (parseInt(button.dataset.step) === this.currentStep) {
                button.classList.add('current');
            }
        });
    }
}

// Initialize after DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Tone.js
    Tone.start();

    // Create sequencer instance
    const sequencer = new Sequencer();
});