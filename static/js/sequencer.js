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
        
        this.initializeUI();
        this.setupEventListeners();
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
                    this.players[slot].start();
                }
            });
        });
    }

    async loadSample(slot, file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
            
            if (this.players[slot]) {
                this.players[slot].disconnect();
            }
            
            this.players[slot] = new Tone.Player(audioBuffer).toDestination();
            this.samples[slot] = file.name;
            
            // Update UI
            const dragArea = document.querySelector(`.drag-area[data-slot="${slot}"]`);
            dragArea.textContent = file.name;
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
        this.updateStepIndicators();
    }

    playStep(time) {
        // Update visual indication
        this.updateStepIndicators();
        
        // Play active samples
        for (let row = 0; row < 4; row++) {
            if (this.grid[row][this.currentStep] && this.players[row]) {
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
