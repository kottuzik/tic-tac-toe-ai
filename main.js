(function () {
    'use strict';

    const USER = 'X';
    const COMPUTER = 'O';
    const COMPUTER_DELAY_MS = 1500;

    const WIN_LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    const CENTER = 4;
    const CORNERS = [0, 2, 6, 8];
    const SIDES = [1, 3, 5, 7];

    const boardEl = document.getElementById('board');
    const cells = Array.from(boardEl.querySelectorAll('.cell'));
    const statusEl = document.getElementById('status');
    const startBtn = document.getElementById('start');
    const playerXEl = document.getElementById('player-x');
    const playerOEl = document.getElementById('player-o');

    let board = Array(9).fill(null);
    let playing = false;
    let userTurn = false;
    let computerTimer = null;

    // Synthesized sounds: a bright rising blip for X, a soft falling tone for O.
    const SOUNDS = {
        X: { type: 'triangle', from: 660, to: 990, duration: 0.14, volume: 0.25 },
        O: { type: 'sine', from: 392, to: 262, duration: 0.3, volume: 0.3 }
    };
    // End-of-game melodies: a rising fanfare for a win, a sinking phrase for a loss,
    // and two flat neutral notes for a draw. They start after the last mark's sound.
    const RESULT_SOUND_DELAY = 0.35;
    const RESULT_SOUNDS = {
        win: {
            type: 'triangle', volume: 0.28, spacing: 0.8,
            notes: [
                { freq: 523, duration: 0.14 },
                { freq: 659, duration: 0.14 },
                { freq: 784, duration: 0.14 },
                { freq: 1047, duration: 0.45 }
            ]
        },
        lose: {
            type: 'sawtooth', volume: 0.16, spacing: 0.9,
            notes: [
                { freq: 392, duration: 0.22 },
                { freq: 330, duration: 0.22 },
                { freq: 262, duration: 0.22 },
                { freq: 196, to: 98, duration: 0.6 }
            ]
        },
        draw: {
            type: 'square', volume: 0.12, spacing: 1.2,
            notes: [
                { freq: 330, duration: 0.18 },
                { freq: 330, duration: 0.3 }
            ]
        }
    };
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    let audioContext = null;
    let masterGain = null;

    // Must first be called from a user gesture (the Start click) so the browser allows audio.
    function ensureAudio() {
        if (!AudioContextClass) return;
        if (!audioContext) audioContext = new AudioContextClass();
        if (audioContext.state === 'suspended') audioContext.resume();
    }

    // Each game routes its sounds through its own gain node, so a restart can silence the old melody.
    function resetMasterGain() {
        if (!audioContext) return;
        if (masterGain) masterGain.disconnect();
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
    }

    // Plays one tone gliding from sound.from to sound.to, starting `delay` seconds from now.
    function playTone(sound, delay) {
        if (!audioContext || !masterGain) return;
        const start = audioContext.currentTime + delay;
        const end = start + sound.duration;

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = sound.type;
        oscillator.frequency.setValueAtTime(sound.from, start);
        oscillator.frequency.exponentialRampToValueAtTime(sound.to, end);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(sound.volume, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gain);
        gain.connect(masterGain);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
    }

    function playMarkSound(mark) {
        playTone(SOUNDS[mark], 0);
    }

    function playResultSound(result) {
        const melody = RESULT_SOUNDS[result];
        let delay = RESULT_SOUND_DELAY;
        melody.notes.forEach(function (note) {
            playTone({
                type: melody.type,
                from: note.freq,
                to: note.to || note.freq,
                duration: note.duration,
                volume: melody.volume
            }, delay);
            delay += note.duration * melody.spacing;
        });
    }

    function randomFrom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function emptyCells() {
        return board.reduce(function (acc, value, index) {
            if (value === null) acc.push(index);
            return acc;
        }, []);
    }

    function findWinningLine(mark) {
        return WIN_LINES.find(function (line) {
            return line.every(function (index) {
                return board[index] === mark;
            });
        }) || null;
    }

    // Returns the cell that would complete a line for the given mark, or null.
    function findCompletingMove(mark) {
        for (const line of WIN_LINES) {
            const marks = line.filter(function (index) { return board[index] === mark; });
            const empties = line.filter(function (index) { return board[index] === null; });
            if (marks.length === 2 && empties.length === 1) return empties[0];
        }
        return null;
    }

    function chooseComputerMove() {
        const win = findCompletingMove(COMPUTER);
        if (win !== null) return win;

        const block = findCompletingMove(USER);
        if (block !== null) return block;

        if (board[CENTER] === null) return CENTER;

        const freeCorners = CORNERS.filter(function (index) { return board[index] === null; });
        if (freeCorners.length) return randomFrom(freeCorners);

        const freeSides = SIDES.filter(function (index) { return board[index] === null; });
        return randomFrom(freeSides);
    }

    function setStatus(text, modifier) {
        statusEl.textContent = text;
        statusEl.classList.remove('thinking', 'result');
        if (modifier) statusEl.classList.add(modifier);
    }

    function setActivePlayer(mark) {
        playerXEl.classList.toggle('active', mark === USER);
        playerOEl.classList.toggle('active', mark === COMPUTER);
    }

    function updateCellAvailability() {
        cells.forEach(function (cell, index) {
            cell.setAttribute('aria-disabled', String(!(playing && userTurn && board[index] === null)));
        });
    }

    function placeMark(index, mark) {
        board[index] = mark;
        const cell = cells[index];
        cell.classList.add(mark.toLowerCase());
        cell.setAttribute('aria-label', 'Cell ' + (index + 1) + ', ' + mark);
        playMarkSound(mark);
    }

    function finishGame(message, winningLine) {
        playing = false;
        userTurn = false;
        setActivePlayer(null);
        boardEl.classList.add('finished');
        if (winningLine) {
            winningLine.forEach(function (index) {
                cells[index].classList.add('win');
            });
        }
        setStatus(message, 'result');
        updateCellAvailability();
    }

    // Returns true if the game ended after the given player's move.
    function checkGameOver(mark) {
        const line = findWinningLine(mark);
        if (line) {
            finishGame(mark === COMPUTER ? 'Computer wins!' : 'You win!', line);
            playResultSound(mark === COMPUTER ? 'lose' : 'win');
            return true;
        }
        if (emptyCells().length === 0) {
            finishGame("It's a draw!", null);
            playResultSound('draw');
            return true;
        }
        return false;
    }

    function giveTurnToUser() {
        userTurn = true;
        setActivePlayer(USER);
        setStatus('Your turn');
        updateCellAvailability();
    }

    function computerMove(index) {
        if (!playing) return;
        placeMark(index, COMPUTER);
        if (!checkGameOver(COMPUTER)) giveTurnToUser();
    }

    function handleCellClick(event) {
        const index = Number(event.currentTarget.dataset.index);
        if (!playing || !userTurn || board[index] !== null) return;

        placeMark(index, USER);
        if (checkGameOver(USER)) return;

        userTurn = false;
        setActivePlayer(COMPUTER);
        setStatus('Computer is thinking', 'thinking');
        updateCellAvailability();

        computerTimer = setTimeout(function () {
            computerTimer = null;
            computerMove(chooseComputerMove());
        }, COMPUTER_DELAY_MS);
    }

    function startGame() {
        ensureAudio();
        resetMasterGain();
        clearTimeout(computerTimer);
        computerTimer = null;

        board = Array(9).fill(null);
        boardEl.classList.remove('finished');
        cells.forEach(function (cell, index) {
            cell.classList.remove('x', 'o', 'win');
            cell.setAttribute('aria-label', 'Cell ' + (index + 1) + ', empty');
        });

        playing = true;
        startBtn.textContent = 'Restart';

        // The user always opens.
        giveTurnToUser();
    }

    cells.forEach(function (cell) {
        cell.addEventListener('click', handleCellClick);
    });
    startBtn.addEventListener('click', startGame);
})();
