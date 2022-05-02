import {FunctionalComponent, h} from "preact";

import styles from './style.css';
import {WordleState} from "../../utils/types";

interface KeyboardProps {
    /**
     * Handler to be called when a key is pressed
     * @param key the string version of the key which is pressed
     */
    onKey: (key: string) => void;
    /**
     * Handler to be called when the backspace key is pressed
     */
    onBack: () => void;
    /**
     * Handler to be called when the enter key is pressed
     */
    onEnter: () => void;
    /**
     * The current states of the worlde boards, used to extract out the key colours
     */
    states: Omit<WordleState, 'width' | 'height'>[];
    /**
     * The number of columns the boards are being presented in, used to derive the art for the keys
     */
    columns: number;
}

/**
 * Each region of the key can be POSITION (orange), MATCH (green), BLANK (N/A) or INVALID (gray)
 */
type KeyState = 'POSITION' | 'MATCH' | 'BLANK' | 'INVALID';

/**
 * Derives a new key state from the current state of the wordle boards. This will return a dictionary of key value to
 * a key state in a 2D array which is in [row][column] format
 * @param columns the number of columns which the boards are being shown in
 * @param states the current state of the wordle boards
 * @return the new key states for the keyboard
 */
const deriveKeyState = (columns: number, states: Omit<WordleState, 'width' | 'height'>[]): Record<string, (KeyState)[][]> => {
    // noinspection SpellCheckingInspection
    const keys = 'ABCDEFGHIJLKMNOPQRSTUVWXYZ'.split('');
    const output: Record<string, (KeyState)[][]> = {};
    for (const key of keys) {
        // If there are no states then bail out early with no decorations
        if (states === undefined) {
            output[key] = [];
            continue;
        }

        // Calculate the number of rows which is used for some hacky array mapping to produce a blank array
        const rows = Math.ceil(states.length / columns);
        const state: KeyState[][] = Array(rows).fill(0).map(() => Array(Math.min(columns, states.length)).fill('BLANK'));
        let columnIndex = 0;
        let rowIndex = 0;

        // For each board being played, check if that letter is a match, position or not included in any of the rows.
        // This is a general simple thing but with some complex code surrounding it
        for (let i = 0; i < states.length; i++) {
            const active = states[i];
            if (active.rows.some((e) => e.letter && e.letter.some((f) => f.letter === key && f.state === 'MATCH'))) state[rowIndex][columnIndex] = 'MATCH';
            else if (active.rows.some((e) => e.letter && e.letter.some((f) => f.letter === key && f.state === 'POSITION'))) state[rowIndex][columnIndex] = 'POSITION';
            else if (active.rows.some((e, i) => {
                if (e.letter === undefined) return false;
                if (e.letter.length !== active.target.length) return false;
                if (!active.complete && active.rows[i + 1] === undefined) return false;

                return e.letter.some((f) => f.letter === key && f.state === 'INVALID');
            })) state[rowIndex][columnIndex] = 'INVALID';

            // Update the indexes to make sure that we move across the grid properly
            columnIndex++;
            if (columnIndex >= columns) {
                columnIndex = 0;
                rowIndex++;
            }
        }

        // And save the result for this key
        output[key] = state;
    }

    return output;
};

/**
 * The mapping ot KeyStates to their CSS classes to provide the appropriate styling
 */
const typeToClass: Record<KeyState, string> = {
    POSITION: styles.position,
    MATCH: styles.match,
    BLANK: styles.blank,
    INVALID: styles.invalid,
};

/**
 * Converts the key state result to a DOM structure which is a div styled with CSS grids containing a set of blocks
 * styled in different colours
 * @param output the key state which needs to be converted
 * @return the DOM structure representing this key state
 */
const resultToDOM = (output: (KeyState)[][]) => {
    // Convert each of the rows and columns into coloured blocks and then flatten it into one chain
    const blocks = output.map((row) => row.map((entry) => (
        <div className={`${styles.block} ${typeToClass[entry]}`}/>))).flat();

    // The column and row styles which are used to style the CSS grid
    const rows = `repeat(${output.length}, 1fr)`;
    const columns = `repeat(${output[0].length}, 1fr)`;

    // And then just build up the output grid which will produce a nice pretty grid
    return (
        <div className={styles.back} style={{
            gridTemplateColumns: columns,
            gridTemplateRows: rows,
        }}>
            {blocks}
        </div>
    );
}

const Keyboard: FunctionalComponent<KeyboardProps> = ({onKey, onBack, onEnter, states, columns}) => {
    // Convert the states into their derived versions which can be presented with the keys
    const derived = deriveKeyState(columns, states);

    // In each bank of keys, turn the letters in that row into a div that calls onKey and fill it in with the letter and
    // its background is produced from the derived key state
    // Exceptions are written in for the enter and backspace keys
    return (
        <div className={styles.keyboardContainer}>
            <div className={styles.keyboard}>
                <div className={`${styles.row} ${styles.one}`}>
                    {'QWERTYUIOP'.split('').map((letter) => (
                        <div className={styles.key} onClick={() => onKey(letter)}>
                            <div className={styles.front}>{letter}</div>
                            {resultToDOM(derived[letter])}
                        </div>
                    ))}
                </div>
                <div className={`${styles.row} ${styles.two}`}>
                    {'ASDFGHJKL'.split('').map((letter) => (
                        <div className={styles.key} onClick={() => onKey(letter)}>
                            <div className={styles.front}>{letter}</div>
                            {resultToDOM(derived[letter])}
                        </div>
                    ))}
                </div>
                <div className={`${styles.row} ${styles.three}`}>
                    <div className={styles.key} onClick={onBack}>
                        <svg style="width:18px;height:18px" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M10.05 16.94V12.94H18.97L19 10.93H10.05V6.94L5.05 11.94Z"/>
                        </svg>
                    </div>
                    {'ZXCVBNM'.split('').map((letter) => (
                        <div className={styles.key} onClick={() => onKey(letter)}>
                            <div className={styles.front}>{letter}</div>
                            {resultToDOM(derived[letter])}
                        </div>
                    ))}
                    <div className={`${styles.key} ${styles.enter}`} onClick={onEnter}>
                        <svg style="width:18px;height:18px" viewBox="0 0 24 24">
                            <path fill="currentColor"
                                  d="M20 4V10.5C20 14.09 17.09 17 13.5 17H7.83L10.92 20.09L9.5 21.5L4 16L9.5 10.5L10.91 11.91L7.83 15H13.5C16 15 18 13 18 10.5V4H20Z"/>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Keyboard;