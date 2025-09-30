class KeySpin {
    constructor(key, action) {
        this.key = key;
        this.action = action;
    }

    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.action();
        this.interval = setInterval(() => {
            clearInterval(this.interval);
            this.action();
            this.interval = setInterval(() => this.action(), 40);
        }, 500);
    }

    stop() {
        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.interval = undefined;
    }
}

class GameKeyboard {
    static stopSpins() {
        for (const spin of GameKeyboard.spins) {
            spin.stop();
        }
    }

    static bind(key, callback, type) {
        Mousetrap.bind(key, callback, type);
    }

    static bindRepeatable(key, callback) {
        this._bindSpin(key, new KeySpin(key, callback));
    }

    static bindHotkey(key, callback, type) {
        Mousetrap.bind(key, () => executeHotkey(callback), type);
    }

    static bindRepeatableHotkey(key, callback) {
        this._bindSpin(key, new KeySpin(key, () => executeHotkey(callback)));
    }

    static _bindSpin(key, spin) {
        if (GameKeyboard.spins.find(s => s.key === key)) {
            throw `Duplicate spin binding for ${key}`;
        }
        GameKeyboard.spins.push(spin);
        Mousetrap.bind(key, () => spin.start(), "keydown");
        Mousetrap.bind(key, () => spin.stop(), "keyup");
    }

    static disable() {
        this.stopSpins();
        Mousetrap.reset();
    }
}

// Don't bind spacebar during button focus
Mousetrap.prototype.stopCallback = (
    (origStopCallback) => (e, element, combo) => (origStopCallback(e, element, combo) || (element.tagName === "BUTTON" && combo === "space"))
)(Mousetrap.prototype.stopCallback);

GameKeyboard.spins = [];

function executeHotkey(action) {
    // @ts-ignore
    if (!options.hotkeys || controlDown || document.activeElement.type === "text" || document.activeElement.type === "textarea") {
        return;
    }
    action();
}

// handle clicking on/off tab
window.onfocus = function() {
    setShiftKey(false);
    setControlKey(false);
    checkExtraSpeed();
};

window.onblur = function() {
    GameKeyboard.stopSpins();
    checkExtraSpeed();
};

// handle shift/control keys
let shiftDown = false;
function setShiftKey(isDown) {
    const wasDown = shiftDown;
    shiftDown = isDown;
    document.documentElement.classList.toggle("shift-key-pressed", isDown);
    if (shiftDown !== wasDown) {
        window.dispatchEvent(new Event("modifierkeychange"));
    }
}

let controlDown = false;
function setControlKey(isDown) {
    const wasDown = controlDown;
    controlDown = isDown;
    document.documentElement.classList.toggle("control-key-pressed", isDown);
    if (controlDown !== wasDown) {
        window.dispatchEvent(new Event("modifierkeychange"));
    }
}

// prevent spacebar scrolling
window.addEventListener("keydown", e => {
    if (e.keyCode === 32 && e.target === document.body) {
        e.preventDefault();
    }
});

// bind hotkeys

GameKeyboard.bindHotkey("space", () => pauseGame());
//GameKeyboard.bindHotkey("r", () => manualRestart());
GameKeyboard.bindHotkey("r", () => {exportSave();importSave();});
GameKeyboard.bindHotkey("b", () => toggleOffline());

for (let i = 1; i < 6; i++) {
    // eslint-disable-next-line no-loop-func
    GameKeyboard.bindHotkey(`shift+${i}`, () => loadLoadout(i));
}

for (let i = 1; i <= 9; i++) {
    GameKeyboard.bindHotkey(`${i}`, () => changeActionAmount(i));
}
GameKeyboard.bindHotkey("0", () => changeActionAmount(actions.addAmount * 10));
GameKeyboard.bindHotkey("backspace", () => changeActionAmount(Math.floor(actions.addAmount / 10)));

GameKeyboard.bindHotkey("shift+s", () => saveList());
GameKeyboard.bindHotkey("shift+l", () => loadList());
GameKeyboard.bindHotkey("shift+c", () => clearList());
//SL
GameKeyboard.bindHotkey("k", () => {if(!gameIsStopped) pauseGame();if(bonusActive)toggleOffline();exportSave();if(!bonusActive)toggleOffline();pauseGame();});
GameKeyboard.bindHotkey("l", () => {if(!gameIsStopped) pauseGame();if(bonusActive)toggleOffline();importSave();if(!bonusActive)toggleOffline();pauseGame();});
//GameKeyboard.bindHotkey("k", () => {exportSave();pauseGame();});
//GameKeyboard.bindHotkey("l", () => {importSave();pauseGame();});

GameKeyboard.bindRepeatableHotkey("=", () => adjustActionListSize(100));
GameKeyboard.bindRepeatableHotkey("-", () => adjustActionListSize(-100));
// devs need hotkeys too okay
if (window.location.href.includes("http://127.0.0.1:5111/")) GameKeyboard.bindHotkey("c", () => cheat());

GameKeyboard.bind("shift", () => setShiftKey(true), "keydown");
GameKeyboard.bind("shift", () => setShiftKey(false), "keyup");
GameKeyboard.bind(["ctrl", "command"], () => setControlKey(true), "keydown");
GameKeyboard.bind(["ctrl", "command"], () => setControlKey(false), "keyup");

function handleTownHotkey(townNum) {
    if (townNum === undefined) return;
    if (townsUnlocked.includes(townNum)) view.showTown(townNum);
}

function undo() {
    actions.undoLast();
    view.updateNextActions();
    view.updateLockedHidden();
}

GameKeyboard.bindHotkey("right", () => handleTownHotkey(townsUnlocked[townsUnlocked.indexOf(townShowing) + 1]));
GameKeyboard.bindHotkey("d", () => handleTownHotkey(townsUnlocked[townsUnlocked.indexOf(townShowing) + 1]));
GameKeyboard.bindHotkey("left", () => handleTownHotkey(townsUnlocked[townsUnlocked.indexOf(townShowing) - 1]));
GameKeyboard.bindHotkey("a", () => handleTownHotkey(townsUnlocked[townsUnlocked.indexOf(townShowing) - 1]));

GameKeyboard.bindHotkey("shift+right", () => view.showActions(true));
GameKeyboard.bindHotkey("shift+d", () => view.showActions(true));
GameKeyboard.bindHotkey("shift+left", () => view.showActions(false));
GameKeyboard.bindHotkey("shift+a", () => view.showActions(false));

GameKeyboard.bindHotkey("shift+z", () => undo());
