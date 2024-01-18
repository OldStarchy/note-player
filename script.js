"use strict";
const HELP_CONTENT = `\
// comments start with //


// Play some notes

C C# D D#
E F F# G
G# A5 A#5 B5



// _ for a rest
_ _ _ _



// Octave is 4 by default

C C4 C C4
_ _ _ _



// add ~ to hold notes longer
// following notes will overlap unless you add rests

C~~~ _ _ _  _ _ _ _
G3~~~~~ _ B~~~~ _ D~~~ _ F~ _
C~~~ _ _ _  _ _ _ _



// use - to create chords

G#~~~-B5~~~-E5~~~ ___
F#~~~-B5~~~ ___
G#~~~-C#5~~~-E5~~~ ___
A5~~~-C#5~~~-E5~~~ ___



// Repeat sections by surrounding them with |: and :|

|: A4~~ _ _ F3~~ _ _ G3~~ _ _ C3~~ _ _
C3~~ _ _ G3~~ _ _ A4~~ _ _ F3~~ _ _ :|



// Repeated sections can be nested

|:
|: |: G#-B5-E5  E  :| :|
|: |: F#-B5     B  :| :|
|: |: G#-C#5-E5 C# :| :|
|: |: A5-C#5-E5 A  :| :|
                      :|


// You can change the wave type

sine
C E G _

sawtooth
C E G _

square
C E G _

triangle
C E G _



// And finally, you can halt the autoplay with a double bar ||

C  E  G  C5
C5 E5 G5 C6 ||



// Click any of the squares to play that note.

sawtooth

C~~~   E~~   G~    B5
F~~~   A5#~~ C5~   E5
G~~~   B5~~  D5~   G6

C5~~~~-E~~~~-G~~~~ _ _ _

sine

C~~~   E~~   G~    B5
F~~~   A5#~~ C5~   E5
G~~~   B5~~  D5~   G6

C5~~~~-E~~~~-G~~~~ _ _ _

// If you don't put a halt at the end, it will loop forever
||
`;
const KEYS = {
    A: 1,
    'A#': 2,
    Bb: 2,
    B: 3,
    C: 4,
    'C#': 5,
    Db: 5,
    D: 6,
    'D#': 7,
    Eb: 7,
    E: 8,
    F: 9,
    'F#': 10,
    Gb: 10,
    G: 11,
    'G#': 12,
    Ab: 12,
};
const noteRegex = /(?<key>[A-G][#b]?)(?<octave>\d+)?(?<sustain>~*)/;
class Player extends EventTarget {
    context;
    _notes = [];
    get directives() {
        return this._notes;
    }
    set directives(val) {
        this._notes = val;
        this.dispatchEvent(new Event('notesChange'));
    }
    _waveType = 'sine';
    get waveType() {
        return this._waveType;
    }
    set waveType(val) {
        this._waveType = val;
        this.dispatchEvent(new Event('waveTypeChange'));
    }
    _head = -1;
    get head() {
        return this._head;
    }
    set head(val) {
        this._head = val;
        this.dispatchEvent(new Event('headChange'));
    }
    _bpm = 60;
    get bpm() {
        return this._bpm;
    }
    set bpm(val) {
        this._bpm = val;
        this.dispatchEvent(new Event('bpmChange'));
    }
    _notesPerBeat = 2;
    get notesPerBeat() {
        return this._notesPerBeat;
    }
    set notesPerBeat(val) {
        this._notesPerBeat = val;
        this.dispatchEvent(new Event('notesPerBeatChange'));
        this.dispatchEvent(new Event('bpmChange'));
    }
    msPerNote = 400;
    constructor() {
        super();
        this.context = null;
        this.addEventListener('bpmChange', () => {
            if (this.isAutoplaying()) {
                this.beginAutoplay();
            }
        });
    }
    autoplayId = null;
    beginRepeatIndex = [];
    endRepeatIndex = [];
    beginAutoplay() {
        this.stopAutoplay();
        const interval = 60000 / this.bpm / this.notesPerBeat;
        if (this.peekNextDirective().type === 'halt') {
            this._head++;
        }
        this.autoplayId = setInterval(() => {
            this.processNextBeat();
        }, interval);
    }
    stopAutoplay() {
        if (this.autoplayId !== null) {
            clearInterval(this.autoplayId);
            this.autoplayId = null;
        }
    }
    reset() {
        this.stopAutoplay();
        this.head = -1;
        this.beginRepeatIndex = [];
        this.endRepeatIndex = [];
    }
    isAutoplaying() {
        return !!this.autoplayId;
    }
    getNextDirective() {
        this.head = (this.head + 1) % this.directives.length;
        return this.directives[this.head];
    }
    peekNextDirective() {
        return this.directives[(this.head + 1) % this.directives.length];
    }
    processNextDirective() {
        const directive = this.getNextDirective();
        switch (directive.type) {
            case 'chord':
                this.playChord(directive);
            //no break;
            case 'rest':
                return true;
            case 'voice':
                this.waveType = directive.voice;
                return false;
            case 'halt':
                if (this.isAutoplaying()) {
                    this.head -= 1;
                    this.stopAutoplay();
                    return true;
                }
                return false;
            case 'beginRepeat':
                this.beginRepeatIndex.unshift(this.head);
                return false;
            case 'endRepeat':
                if (this.endRepeatIndex.length > 0) {
                    if (this.endRepeatIndex[0] === this.head) {
                        this.endRepeatIndex.shift();
                        this.beginRepeatIndex.shift();
                        return false;
                    }
                }
                if (this.beginRepeatIndex.length === 0) {
                    return false;
                }
                this.endRepeatIndex.unshift(this.head);
                this.head = this.beginRepeatIndex[0];
                return false;
        }
    }
    processNextBeat() {
        if (this.directives.length === 0)
            return;
        const head = (this.head + this.directives.length) % this.directives.length;
        while (!this.processNextDirective() && this.head !== head)
            ;
    }
    playChord(chord) {
        chord.notes.forEach((note) => {
            this.playNote(note);
        });
    }
    clearRepeats() {
        this.beginRepeatIndex = [];
        this.endRepeatIndex = [];
    }
    playNote({ key, octave, sustain, }) {
        if (this.context === null) {
            this.context = new AudioContext();
        }
        const frequency = getFrequency(key, octave);
        const oscillator = this.context.createOscillator();
        oscillator.frequency.value = frequency;
        oscillator.type = this.waveType;
        const sustainMs = sustain * this.msPerNote;
        const sustainS = sustainMs / 1000;
        const envelope = this.createEnvelope(sustainS);
        oscillator.connect(envelope.rise);
        envelope.fall.connect(this.context.destination);
        oscillator.start();
        oscillator.stop(this.context.currentTime + sustainS);
        oscillator.onended = () => {
            oscillator.disconnect();
            envelope.rise.disconnect();
            envelope.sustain.disconnect();
            envelope.fall.disconnect();
        };
    }
    createEnvelope(duration) {
        if (this.context === null) {
            this.context = new AudioContext();
        }
        const rise = this.context.createGain();
        const sustain = this.context.createGain();
        const fall = this.context.createGain();
        rise.connect(sustain);
        sustain.connect(fall);
        rise.gain.value = 0;
        rise.gain.exponentialRampToValueAtTime(1, this.context.currentTime + (0.1 * this.msPerNote) / 1000);
        sustain.gain.value = 1;
        fall.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration - (0.2 * this.msPerNote) / 1000);
        return { rise, sustain, fall };
    }
}
class PlayerController {
    player;
    songInput;
    autoplayButton;
    playNextButton;
    resetButton;
    bpmInput;
    notesPerBeatInput;
    beatsPerBarInput;
    waveTypeSelect;
    notesContainer;
    loadHelpContentButton;
    abortController;
    static AUTOSAVE_NAME = `song_autosave`;
    dispose() {
        this.abortController.abort();
    }
    constructor(player, songInput, autoplayButton, playNextButton, resetButton, bpmInput, notesPerBeatInput, beatsPerBarInput, waveTypeSelect, notesContainer, loadHelpContentButton) {
        this.player = player;
        this.songInput = songInput;
        this.autoplayButton = autoplayButton;
        this.playNextButton = playNextButton;
        this.resetButton = resetButton;
        this.bpmInput = bpmInput;
        this.notesPerBeatInput = notesPerBeatInput;
        this.beatsPerBarInput = beatsPerBarInput;
        this.waveTypeSelect = waveTypeSelect;
        this.notesContainer = notesContainer;
        this.loadHelpContentButton = loadHelpContentButton;
        this.abortController = new AbortController();
        this.loadHelpContentButton.addEventListener('click', () => {
            if (confirm('This will reset your current song. Are you sure?')) {
                this.setSong(HELP_CONTENT);
            }
        }, { signal: this.abortController.signal });
        this.songInput.addEventListener('input', () => {
            localStorage.setItem(PlayerController.AUTOSAVE_NAME, this.songInput.value);
            this.setSong(this.songInput.value);
        }, { signal: this.abortController.signal });
        this.player.addEventListener('notesChange', () => {
            this.renderNotes();
        }, { signal: this.abortController.signal });
        this.player.addEventListener('headChange', () => {
            this.renderNotes();
        }, { signal: this.abortController.signal });
        this.autoplayButton.addEventListener('click', () => {
            this.toggleAutoplay();
        }, { signal: this.abortController.signal });
        this.playNextButton.addEventListener('click', () => {
            this.player.processNextBeat();
        }, { signal: this.abortController.signal });
        this.resetButton.addEventListener('click', () => {
            this.player.reset();
        }, { signal: this.abortController.signal });
        this.bpmInput.addEventListener('input', () => {
            const intVal = parseInt(this.bpmInput.value, 10);
            if (!isNaN(intVal) && intVal > 0) {
                this.player.bpm = intVal;
            }
        }, { signal: this.abortController.signal });
        this.notesPerBeatInput.addEventListener('input', () => {
            const val = parseInt(this.notesPerBeatInput.value, 10);
            if (!isNaN(val) && val > 0) {
                this.player.notesPerBeat = val;
            }
            this.updateColumns();
            this.renderNotes();
        }, { signal: this.abortController.signal });
        this.beatsPerBarInput.addEventListener('input', () => {
            this.updateColumns();
            this.renderNotes();
        }, { signal: this.abortController.signal });
        this.waveTypeSelect.addEventListener('change', () => {
            if (isValidWaveType(this.waveTypeSelect.value)) {
                this.player.waveType = this.waveTypeSelect.value;
            }
        }, { signal: this.abortController.signal });
        this.player.addEventListener('waveTypeChange', () => {
            this.waveTypeSelect.value = this.player.waveType;
        }, { signal: this.abortController.signal });
    }
    updateColumns() {
        const notesPerBeat = parseInt(this.notesPerBeatInput.value, 10);
        const beatsPerBar = parseInt(this.beatsPerBarInput.value, 10);
        if (notesPerBeat > 0 && beatsPerBar > 0) {
            this.notesContainer.style.setProperty('--columns', `${notesPerBeat * beatsPerBar}`);
        }
    }
    setSong(song) {
        this.songInput.value = song;
        const newNotes = parseSong(song);
        if (!arrayEqual(newNotes, this.player.directives)) {
            this.player.directives = newNotes;
        }
    }
    toggleAutoplay() {
        if (this.player.isAutoplaying()) {
            this.player.stopAutoplay();
        }
        else {
            this.player.beginAutoplay();
        }
    }
    renderNotes() {
        const noteCount = this.player.directives.length;
        const eleCount = this.notesContainer.childElementCount;
        let modifier = null;
        let pre = null;
        let lastElement = null;
        let directiveStart = -1;
        let elementIndex = -1;
        for (let directiveIndex = 0; directiveIndex < noteCount; directiveIndex++) {
            const directive = this.player.directives[directiveIndex];
            if (directive.type === 'voice') {
                modifier = directive.voice;
                continue;
            }
            if (directive.type === 'beginRepeat') {
                pre = `${pre ?? ''}|:`;
                continue;
            }
            if (directive.type === 'endRepeat') {
                if (lastElement) {
                    lastElement.innerText += ':|';
                }
                continue;
            }
            if (directive.type === 'halt') {
                if (lastElement) {
                    lastElement.innerText += '||';
                }
                continue;
            }
            elementIndex++;
            let ele = null;
            if (elementIndex >= eleCount) {
                ele = document.createElement('div');
                ele.classList.add('note');
                this.notesContainer.appendChild(ele);
            }
            else {
                ele = this.notesContainer.children[elementIndex];
            }
            const index = directiveStart;
            ele.onclick = () => {
                this.player.head = index;
                this.player.clearRepeats();
                this.player.processNextBeat();
            };
            lastElement = ele;
            directiveStart = directiveIndex;
            if (elementIndex > 0) {
                ele.style.marginRight =
                    this.notesPerBeatInput.value !== '1' &&
                        (elementIndex + 1) %
                            parseInt(this.notesPerBeatInput.value) ===
                            0
                        ? '1rem'
                        : '0';
                ele.style.marginBottom =
                    (elementIndex + 1) %
                        (parseInt(this.notesPerBeatInput.value) *
                            parseInt(this.beatsPerBarInput.value) *
                            4) ===
                        0
                        ? '2rem'
                        : '0';
            }
            ele.innerText = [
                modifier,
                [pre, directiveToString(directive)].filter((n) => n).join(' '),
            ]
                .filter((n) => n)
                .join('\n');
            modifier = null;
            pre = null;
            ele.classList.toggle('active', directiveIndex === this.player.head);
        }
        while (elementIndex < eleCount - 1) {
            this.notesContainer.removeChild(this.notesContainer.lastChild);
            elementIndex++;
        }
    }
}
const songInput = document.getElementById('song');
if (!songInput || !(songInput instanceof HTMLTextAreaElement)) {
    throw new Error('Could not find song input');
}
const autoplayButton = document.getElementById('autoplay');
if (!autoplayButton || !(autoplayButton instanceof HTMLButtonElement)) {
    throw new Error('Could not find autoplay button');
}
const playNextButton = document.getElementById('playNext');
if (!playNextButton || !(playNextButton instanceof HTMLButtonElement)) {
    throw new Error('Could not find play next button');
}
const resetButton = document.getElementById('reset');
if (!resetButton || !(resetButton instanceof HTMLButtonElement)) {
    throw new Error('Could not find reset button');
}
const bpmInput = document.getElementById('bpm');
if (!bpmInput || !(bpmInput instanceof HTMLInputElement)) {
    throw new Error('Could not find bpm input');
}
const notesPerBeatInput = document.getElementById('notesPerBeat');
if (!notesPerBeatInput || !(notesPerBeatInput instanceof HTMLInputElement)) {
    throw new Error('Could not find notes per beat input');
}
const beatsPerBarInput = document.getElementById('beatsPerBar');
if (!beatsPerBarInput || !(beatsPerBarInput instanceof HTMLInputElement)) {
    throw new Error('Could not find beats per bar input');
}
const waveTypeSelect = document.getElementById('waveType');
if (!waveTypeSelect || !(waveTypeSelect instanceof HTMLSelectElement)) {
    throw new Error('Could not find wave type select');
}
const notesContainer = document.getElementById('notes');
if (!notesContainer || !(notesContainer instanceof HTMLDivElement)) {
    throw new Error('Could not find notes container');
}
const loadHelpContentButton = document.getElementById('loadHelpContent');
if (!loadHelpContentButton ||
    !(loadHelpContentButton instanceof HTMLButtonElement)) {
    throw new Error('Could not find load help content button');
}
const player = new Player();
const playerController = new PlayerController(player, songInput, autoplayButton, playNextButton, resetButton, bpmInput, notesPerBeatInput, beatsPerBarInput, waveTypeSelect, notesContainer, loadHelpContentButton);
const savedSong = localStorage.getItem(PlayerController.AUTOSAVE_NAME);
if (savedSong) {
    playerController.setSong(savedSong);
}
function isValidWaveType(val) {
    return ['sine', 'sawtooth', 'square', 'triangle'].includes(val);
}
function arrayEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
function directiveToString(directive) {
    switch (directive.type) {
        case 'rest':
            return '_';
        case 'voice':
            return directive.voice;
        case 'halt':
            return '||';
        case 'beginRepeat':
            return '|:';
        case 'endRepeat':
            return ':|';
        case 'chord':
            return directive.notes.map(noteToString).join('-');
    }
}
function noteToString(note) {
    return `${note.key}${note.octave}${'~'.repeat(note.sustain - 1)}`;
}
function parseNote(note) {
    if (note === '_')
        return null;
    const match = noteRegex.exec(note);
    if (!match) {
        return null;
    }
    const { key, octave, sustain } = match.groups;
    if (!isValidKey(key)) {
        return null;
    }
    const octaveInt = parseInt(octave || '4');
    const sustainInt = sustain.length + 1;
    return { key, octave: octaveInt, sustain: sustainInt };
}
function isValidKey(key) {
    return key in KEYS;
}
function getFrequency(key, octave) {
    const step = KEYS[key];
    const a4 = 440;
    return a4 * Math.pow(2, octave - 4 + (step - 1) / 12);
}
function parseChord(chord) {
    const parts = chord.split('-');
    return parts.map(parseNote).filter((n) => !!n);
}
function parseWord(word) {
    if (word === '_') {
        return { type: 'rest' };
    }
    if (word === '||') {
        return { type: 'halt' };
    }
    if (word === '|:') {
        return { type: 'beginRepeat' };
    }
    if (word === ':|') {
        return { type: 'endRepeat' };
    }
    if (isValidWaveType(word)) {
        return { type: 'voice', voice: word };
    }
    const chord = parseChord(word);
    if (chord.length > 0) {
        return { type: 'chord', notes: chord };
    }
    return null;
}
function parseSong(song) {
    const songNoComments = song
        .split('\n')
        .map((l) => l.replace(/\/\/.*$/, '').trim())
        .filter((l) => l.length > 0)
        .join('');
    const words = [];
    songNoComments.replace(/(([A-G][#b]?(?:\d+)?(?:~*))(\-[A-G][#b]?(?:\d+)?(?:~*))*|_|sawtooth|square|sine|triangle|\|\||\|\:|\:\|)/g, (match) => {
        words.push(match);
        return match;
    });
    return words.map(parseWord).filter((w) => !!w);
}
//# sourceMappingURL=script.js.map