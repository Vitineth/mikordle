import {createContext} from "preact";
import { MikordleChat } from "./messenger";

export const ValidWords = createContext<string[]>([]);
export const Communicator = createContext<MikordleChat|undefined>(undefined);

export interface Letter {
    /**
     * The letter stored in this position
     */
    letter: string;
    /**
     * The state of this letter, MATCH means in the right place, POSITION means present in the word but in the wronng
     * position and INVALID means not in the word
     */
    state: 'MATCH' | 'POSITION' | 'INVALID';
}

export interface WordleRow {
    /**
     * The width of this row
     */
    width: number;
    /**
     * Each of the letters stored in the row, if this row is defined
     */
    letter?: Letter[];
}

export interface WordleState {
    /**
     * With width of the board (number of letters)
     */
    width: number;
    /**
     * The height of the board (number of guesses)
     */
    height: number;
    /**
     * The rows contained in this board
     */
    rows: WordleRow[];
    /**
     * If this board has been completed and whether it was won or lost
     */
    complete: false | 'SUCCESS' | 'FAIL';
    /**
     * The target word for this row
     */
    target: string;
}

/**
 * Adds a letter to the given wordle board and returns the updated version. Width is the width of the board and height
 * is the number of guesses. Letter is the letter to be added. Letters when allowed to be injected will be assigned
 * INVALID. Letters will only be added when the game is not complete and there are letters remaining in the word
 * @param instance
 * @param width
 * @param height
 * @param letter
 */
export const add = (instance: Omit<WordleState, 'width' | 'height'>, width: number, height: number, letter: string) => {
    if (instance.complete) return;
    if (instance.rows.length === 0) {
        instance.rows.push({letter: [], width});
    }

    if (!instance.rows[instance.rows.length - 1].letter) instance.rows[instance.rows.length - 1].letter = [];
    const entry = instance.rows[instance.rows.length - 1];
    if (!entry.letter) throw new Error('Cant happen');
    if (entry.letter.length >= entry.width) return;

    entry.letter.push({letter, state: 'INVALID'});
};

/**
 * Removes the last letter from the current guess. Will only happen when there are letters available in the row
 * @param instance the instance from which the letter should be removed
 */
export const remove = (instance: Omit<WordleState, 'width' | 'height'>) => {
    if (instance.complete) return;
    if (instance.rows.length === 0) return;
    if (!instance.rows[instance.rows.length - 1].letter) instance.rows[instance.rows.length - 1].letter = [];
    const entry = instance.rows[instance.rows.length - 1];
    if (!entry.letter) throw new Error('Cant happen');
    if (entry.letter.length <= 0) return;

    entry.letter.splice(entry.letter.length - 1, 1);
};

/**
 * When enter is pressed, if the current final row is full it will calculate the state of each of the letters and return
 * the updated state. The board will also be marked as complete if the answer is correct or if the board is full.
 * @param instance the instance to update
 * @param width the width (letters) of the board
 * @param height the height (guesses) of the board
 */
export const enter = (instance: Omit<WordleState, 'width' | 'height'>, width: number, height: number) => {
    if (!instance.rows[instance.rows.length - 1].letter) instance.rows[instance.rows.length - 1].letter = [];
    const entry = instance.rows[instance.rows.length - 1];
    if (!entry.letter) throw new Error('Cant happen');
    if (entry.letter.length !== entry.width) return;

    // On enter we work out the result
    // In response to issue #1 - this is now done in two passes, one to determine matches
    // and then a second for position. This ensures that a position match can't accidentally
    // eliminate an actual match, even at the cost of another iteration
    let targetCopy = instance.target + "";
    for (let i = 0; i < entry.letter.length; i++) {
        if (targetCopy[i] === entry.letter[i].letter) {
            entry.letter[i].state = 'MATCH';
            targetCopy = `${targetCopy.substring(0, i)}_${targetCopy.substring(i + 1)}`;
        }
    }
    for (let i = 0; i < entry.letter.length; i++) {
        if (entry.letter[i].state === 'MATCH') continue;
        const letter = entry.letter[i].letter;
        const index = targetCopy.split('').findIndex((e) => e === letter);
        if (index === -1) {
            entry.letter[i].state = 'INVALID';
        } else {
            entry.letter[i].state = 'POSITION';
            targetCopy = `${targetCopy.substring(0, index)}_${targetCopy.substring(index + 1)}`;
        }
    }

    if (entry.letter.every((e) => e.state === 'MATCH')) {
        instance.complete = 'SUCCESS';
        return;
    }

    if (instance.rows.length >= height) {
        instance.complete = 'FAIL';
    } else {
        instance.rows.push({letter: [], width});
    }
};
