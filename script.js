// prettier-ignore
let notes = [
	'1', '3', '1°', '2°', '3°', '2°', '1°', '5',
	'4', '6', '3°', '5°', '3°', '1°', '_', '_',
	'1', '3', '1°', '2°', '3°', '2°', '1°', '5',
	'4', '6', '3°', '5°', '3°', '1°', '_', '_',//
	'1-7', '_', '_', '_', '_', '_', '1°', '_',
	'4-6', '_', '_', '_', '_', '_', '5', '6',
	'1-7', '_', '_', '_', '_', '_', '2°', '3°',
	'_',  '6-4', '_', '_', '_', '_','3°',//

	'5°',  '2-4°', '_', '_','6°', '4°', '_', '1°',
	'_', '_', '_', '_', '_', '_', '_', '_',
	'2°', '_', '2-4°', '_', '6°', '_', '4°', '1°',
	'_', '_', '_', '_', '_', '_', '2°', '_',//

	'1°',

	'1-5',
	'1-5', '1°', '3°',
	'2-4°', '3°', '1°', '5', '6',
	'2', '4°', '2°', '3°',
	'2-4°', '3°', '4°', '6°',
	'1-3°', '2', '1',
	'5-2°',
	'5', '6',
	'2-4°', '6°', '5°', '4°', '5°', '4°', '5°', '6°',
	'1', '5°', '1°°',
	'5-7°', '5°', '2°', '7', '5',
	'2-2°', '7', '5', '2', '2',
];

/** @type {OscillatorType} */
let waveType = 'sawtooth';
let head = -1;
const context = new AudioContext();

let autoplayId = null;

const noteRegex = /(?<key>[A-G][#b]?)(?<octave>\d+)?(?<sustain>~*)/;
const keys = {
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

const savedSong = localStorage.getItem('song_autosave');
if (savedSong) {
	setSong(savedSong);
}

renderNotesAndHead();

function reset() {
	head = -1;
}

function onWaveTypeChange() {
	waveType = document.getElementById('waveType').value;
}

function setSong(song) {
	document.getElementById('song').value = song;
	onSongChange();
}

function onColumnsChange() {
	document
		.getElementById('notes')
		.style.setProperty(
			'--columns',
			document.getElementById('columns').value
		);
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

function onSongChange() {
	localStorage.setItem(
		'song_autosave',
		document.getElementById('song').value
	);
	const newNotes = parseSong(document.getElementById('song').value);

	if (arrayEqual(notes, newNotes)) {
		return;
	}
	notes = newNotes;
	// head = -1;
	renderNotesAndHead();
}

function onBpmChange() {
	if (autoplayId) {
		beginAutoplay();
	}
}
function beginAutoplay() {
	stopAutoplay();
	const bpm = parseInt(document.getElementById('bpm').value) * 2;
	const interval = 60000 / bpm;
	autoplayId = setInterval(() => {
		playNextNote(false);
	}, interval);
}

function stopAutoplay() {
	clearInterval(autoplayId);
	autoplayId = null;
}

function toggleAutoplay() {
	if (autoplayId) {
		stopAutoplay();
	} else {
		beginAutoplay();
	}
}

function getNextNote() {
	head = (head + 1) % notes.length;
	return (note = notes[head]);
}

function renderNotesAndHead() {
	const notesEl = document.getElementById('notes');
	notesEl.innerHTML = '';

	notes.forEach((note, i) => {
		if (parseChord(note).length === 0 && note !== '_') {
			return;
		}
		const el = document.createElement('div');
		el.classList.add('note');
		el.innerText = note;
		if (i === head) {
			el.classList.add('active');
		}
		el.addEventListener('click', () => {
			head = i - 1;
			playNextNote(false);
		});
		notesEl.appendChild(el);
	});
}

function playNextNote(skipBlanks) {
	let chord = getNextNote();

	if (skipBlanks) {
		while (chord === '_') chord = getNextNote();
	}

	const newType = {
		sine: 'sine',
		saw: 'sawtooth',
		square: 'square',
		tri: 'triangle',
		triangle: 'triangle',
		sawtooth: 'sawtooth',
	}[chord];

	if (newType) {
		waveType = newType;
		document.getElementById('waveType').value = waveType;
		return;
	}

	const keys = parseChord(chord);
	keys.forEach(({ frequency, sustain }) => {
		playNote(frequency, 400 * sustain);
	});
	renderNotesAndHead();
}

/**
 * @return {{frequency: number, sustain: number}|null}
 */
function parseNote(note) {
	if (note === '_') return null;

	const match = noteRegex.exec(note);

	if (!match) {
		return null;
	}

	const { key, octave, sustain } =
		/** @type {{key: string; octave?: string; sustain: string}} */ (
			match.groups
		);

	const step = keys[key];

	const octaveInt = parseInt(octave || '4');
	const sustainInt = sustain.length + 1;

	const a4 = 440;

	const frequency = a4 * Math.pow(2, octaveInt - 4 + (step - 1) / 12);

	return { frequency, sustain: sustainInt };
}

function parseChord(note) {
	/**
	 * @type {string[]}
	 */
	const parts = note.split('-');

	return /** @type {{frequency:number, sustain: number}[]} */ (
		parts.map(parseNote).filter((n) => n)
	);
}

function parseSong(song) {
	const notes = [];

	song.replace(
		/(([A-G][#b]?(?:\d+)?(?:~*))(\-[A-G][#b]?(?:\d+)?(?:~*))*|_|saw(tooth)?|square|sine|triangle)/g,
		(match) => {
			notes.push(match);
		}
	);

	return notes;
}

function playNote(frequency, duration) {
	const oscillator = context.createOscillator();

	oscillator.type = waveType;
	oscillator.frequency.value = frequency;

	const envelope = context.createGain();
	oscillator.connect(envelope);

	envelope.gain.value = 0;
	envelope.gain.exponentialRampToValueAtTime(1, context.currentTime + 0.1);

	const envelope2 = context.createGain();
	envelope.connect(envelope2);

	envelope2.gain.value = 1;
	envelope2.gain.linearRampToValueAtTime(0, context.currentTime + 0.4 * 16);

	const envelope3 = context.createGain();
	envelope2.connect(envelope3);

	envelope3.gain.value = 1;
	envelope3.gain.linearRampToValueAtTime(
		1,
		context.currentTime + duration / 1000 - 0.1
	);
	envelope3.gain.linearRampToValueAtTime(
		0,
		context.currentTime + duration / 1000
	);

	envelope3.connect(context.destination);

	oscillator.start();

	envelope.gain.linearRampToValueAtTime(
		0,
		context.currentTime + duration / 1000
	);

	setTimeout(() => {
		oscillator.stop();
		oscillator.disconnect();
		envelope.disconnect();
	}, duration);
}
