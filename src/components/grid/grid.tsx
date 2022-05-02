import {FunctionalComponent, h} from "preact";
import Wordle from "../wordle/wordle";
import styles from './style.css'
import {WordleState} from "../../utils/types";
import {useState} from "preact/hooks";

/**
 * The properties for a grid of wordle games
 */
interface GridProps {
    /**
     * The width of each board (number of letters)
     */
    innerWidth: number;
    /**
     * The height of each board (number of guesses)
     */
    innerHeight: number;

    /**
     * The number of columns in which these boards should be presented
     */
    columns: number;
    /**
     * The state of each wordle board in a linear flat array
     */
    entries: Omit<WordleState, 'width' | 'height'>[];
}


const WordleGrid: FunctionalComponent<GridProps> = (props) => {
    // Need to produce keys for each of the worlde games and as they determine repainting we need to ensure that these
    // aren't unnecessarily changing as it causes lag. So general an identifier at mount and never change it.
    const [identifier] = useState(Math.round(Math.random() * 1000));

    // Divide up the generated elements into a 2D array row-wise
    const subdivision = [];
    let active = [];

    for (const entries of props.entries) {
        active.push(
            <Wordle
                useSmall={props.columns > 2}
                key={`wordle_${entries.target}`}
                target={entries.target}
                width={props.innerWidth}
                rows={entries.rows}
                complete={entries.complete}
                height={props.innerHeight}
            />
        );
        if (active.length >= props.columns) {
            subdivision.push(active);
            active = [];
        }
    }

    // Handle the case of the last one not dividing nicely
    if (active.length !== 0) subdivision.push(active);

    // And then just map it into rows!
    return (
        <div className="grid">
            {subdivision.map((e, i) => (
                <div
                    className={styles.row}
                    key={`${identifier}__row__${i}`}
                >
                    {e}
                </div>
            ))}
            <div
                className={styles.spacer}
            />
        </div>
    )
};

export default WordleGrid;

