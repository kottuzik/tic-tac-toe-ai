# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A single-player Tic Tac Toe game (human `X` vs. computer `O`) implemented as a static site with no build step, no package manager, and no dependencies: `index.html`, `styles.css`, `main.js`.

## Running it

There is no server, bundler, or test suite. Open `index.html` directly in a browser, or serve the directory with any static file server (e.g. `python3 -m http.server`) if `file://` audio/module restrictions become an issue.

## Architecture

- `main.js` is a single IIFE with no modules/imports. All state (`board`, `playing`, `userTurn`, `computerTimer`) is closed over in module scope — there is no framework or state container.
- The user always goes first and always plays `X`; the computer is `O` and moves after a fixed `COMPUTER_DELAY_MS` timeout (via `setTimeout`, stored in `computerTimer` so `startGame` can cancel a pending move on restart).
- Computer move selection (`chooseComputerMove`) is a fixed priority list, not minimax: win if possible → block opponent's win → take center → take a random free corner → take a random free side.
- Game flow is linear: `startGame` → `giveTurnToUser` → `handleCellClick` (places `X`, checks game over, schedules computer move) → `computerMove` (places `O`, checks game over, hands turn back). `checkGameOver` is the single choke point that detects a win (`findWinningLine`) or draw and calls `finishGame`.
- DOM updates are hand-rolled: marks are drawn via CSS (`.cell.x`/`.cell.o` pseudo-elements in `styles.css`), not injected text/HTML; `placeMark` only toggles classes and `aria-label`.
- Sound is procedural, not sample-based: a `Web Audio` `AudioContext` synthesizes tones directly (`playTone`), driven by data tables (`SOUNDS` for mark placement, `RESULT_SOUNDS` for win/lose/draw melodies). `ensureAudio()` must run from a user gesture (the Start click) before any tone will play — browsers block autoplay otherwise.
- `styles.css` is organized by section (glass card → players → status → board → X/O marks → end-of-game state → start button) matching the DOM top-to-bottom; most visuals are driven by CSS variables declared in `:root` rather than hardcoded values. Respects `prefers-reduced-motion` by disabling all animations/transitions.
