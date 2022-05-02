import {FunctionalComponent, h} from "preact";
import Row from "../row/row";
import {WordleState} from "../../utils/types";
import {useState} from "preact/hooks";
import style from './style.css';

/**
 * The initial state of a wordle board combined with whether this should use small styling
 */
type WordleProps = Omit<WordleState, 'removeLetter' | 'addLetter'> & { useSmall?: boolean };

const Wordle: FunctionalComponent<WordleProps> = ({width, height, rows, complete, ...rest}) => {
    // Random but consistent identifier used for rendering to ensure updates only happen when necessary, generated on
    // mount
    const [identifier] = useState(Math.round(Math.random() * 1000));

    // Just generate a <Row> for each row in the props. This manages no state which is quite nice
    return (
        <div className={style.wordle + (rest.useSmall ? ` ${style.small}` : '')}>
            {Array(height).fill(0).map((_, i) => (
                <Row
                    useSmall={rest.useSmall}
                    key={`${identifier}__${i}`}
                    width={width}
                    letter={i < rows.length ? rows[i].letter : undefined}
                    disabled={i >= rows.length}
                    ignoreColor={complete ? false : i === rows.length - 1}
                />
            ))}
        </div>
    )
};

export default Wordle;

