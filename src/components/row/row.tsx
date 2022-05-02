import {FunctionalComponent, h} from "preact";
import style from './style.css';
import {Letter, WordleRow} from "../../utils/types";
import {useState} from "preact/hooks";
import {getWordsFromCache} from "../../utils/data";

type RowProps = {
    /**
     * If this row has been disabled (originally for collapsed elements but not currently in use)
     */
    disabled?: boolean;
    /**
     * If the colours on the row should be ignored
     */
    ignoreColor?: boolean;
    /**
     * If it should use small font and borders
     */
    useSmall?: boolean;
} & WordleRow;

/**
 * A mapping of a cell state to its CSS class to provide colours.
 */
const mapping: Record<Letter['state'], string> = {
    INVALID: '',
    MATCH: style.match,
    POSITION: style.position,
};

const Row: FunctionalComponent<RowProps> = ({width, letter, disabled, ignoreColor, useSmall}) => {
    // Static identifier generated on mount to produce consistent keys
    const [identifier] = useState(Math.round(Math.random() * 1000));

    // Fetch the list of valid words from cache. This will fail if the word list is not loaded but by this point then we
    // must have loaded this because
    const valid = getWordsFromCache(width);

    // Build up the row classes in a better way than awful string concatenation and ternary statements!
    const classes = [style.row];
    if (disabled) classes.push(style.disabled);
    if (letter && letter.length === width && !valid.includes(letter.map((e) => e.letter.toUpperCase()).join(''))) classes.push(style.invalid);

    return (
        <div
            className={classes.join(' ')}
        >
            {Array(width).fill(0).map((_, i) => {
                // For each cell, build up its classes based on its current state and if it should be small or not
                const cellClass = [style.cell];
                if (!ignoreColor) cellClass.push(mapping[letter && letter[i] ? letter[i].state : 'INVALID']);
                if (useSmall) cellClass.push(style.small);

                // And then return it with a semi-unique key
                return (
                    <div key={`${identifier}__${i}`}
                         className={cellClass.join(' ')}>{letter && letter[i] ? letter[i].letter : ''}</div>
                )
            })}
        </div>
    )
};

export default Row;
