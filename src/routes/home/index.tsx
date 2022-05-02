import {createContext, FunctionalComponent, h, Fragment, createRef} from 'preact';
import Mikordle from "../../components/mikorle/mikordle";
import {useEffect, useState} from "preact/hooks";
import {
    addToBoardAndTotalMetrics,
    completeToday,
    Dictionary,
    getToday, getTodayStats,
    getWords,
    isTodayComplete, localStorageGetItem, localStorageSetItem,
    mulberry32, saveTodayStats
} from "../../utils/data";
import {ValidWords} from "../../utils/types";
import style from './style.css';
import DistributionViewer from "../../components/distribution/distribution";

const withProfile = require('preact-perf-profiler').default;

/**
 * An alias for the on end function passed through the system. Takes the number of losses in the current game, the
 * distribution of how many games were won in a certain number of guesses, and finally the number of guesses it took for
 * each board
 */
export type OnEndFunction = (losses: number, distribution: Record<number, number>, stats: (number | false)[][]) => void;

/**
 * Random number generator which is seeded with todays date which ensures that the same words are generated each day
 */
let rand: (() => number) | undefined = mulberry32(getToday());

/**
 * Contains the array of todays unique generated numbers which should be used to select the words. This should be read
 * only as modifications will lead to gradual modifications which will give everyone different experiences if the
 * changes are not the same on every client (ie conditional)
 */
const todaysWords: number[] = [];
for (let i = 0; i < 100; i++) {
    todaysWords.push(rand());
}

// Once used this is cleared to prevent multiple usages - this might need cleaned up eventually
rand = undefined;

/**
 * A wrapping of two dictionaries, one used for all valid words and one for the selected words. This is a bit of a
 * misnomer because these dictionaries are just lists of words
 */
type DictionaryTuple = [Dictionary, Dictionary];

type AutoSelectProps = {
    /**
     * The length of words which should be generated
     */
    length: number;
    /**
     * The number of guesses which are given for each board
     */
    guesses: number;
    /**
     * The number of columns which are being used to arrange the boards
     */
    columns: number;
    /**
     * The amount of boards which are being displayed
     */
    amount: number;
    /**
     * The optional function to call when the game ends
     */
    onEnd?: OnEndFunction;
    /**
     * If this board should show the continue button that will all onEnd
     */
    continuing?: boolean;
} & ({
    /**
     * Indicates that todays words should not be used.
     */
    useToday?: false;
} | {
    /**
     * Indicates that todays words should be used
     */
    useToday: true;
    /**
     * The stage today's game is currently on which should be used to determine which elements to look up in today's
     * random numbers
     */
    stage: number,
})

/**
 * Maps a stage to the elements in {@link todaysWords} which should be accessed to prevent overlap and to choose the
 * right number of words
 */
const stageLookup: Record<number, number[]> = {
    0: [0],
    1: [1, 2],
    2: [3, 4, 5, 6],
    3: [7, 8, 9, 10, 11, 12, 13, 14],
    4: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    5: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62],
}

const AutoSelectMikordle: FunctionalComponent<AutoSelectProps> = (
    {
        columns,
        length,
        guesses,
        amount,
        onEnd,
        continuing,
        ...rest
    }
) => {
    // The currently selected words for this game which will be read in asynchronously
    // If it is a DictionaryTuple it means that it has been loaded successfully, undefined means it has not started
    // loading and Error means it failed
    const [words, setWords] = useState<DictionaryTuple | undefined | Error>(undefined);

    useEffect(() => {
        const fetch = async () => {
            // Fetch the words from either cache or the server and make a clone of them to avoid modifying the cache
            const loaded = [...await getWords(length)];
            // Make a new copy which is used to keep a 'pure' copy
            const clone = [...loaded];

            // And create a collection of selected words
            let selected: Dictionary = [];

            if (rest.useToday) {
                // If using todays words, then look up which random values we are accessing, read them, map them to
                // the set of loaded words and pick one. Then remove that from the set of words we are choosing from
                // to make sure we don't pick the same word more than once.
                selected = stageLookup[rest.stage]
                    .map((e) => {
                        const index = Math.round(todaysWords[e] * (loaded.length - 1));
                        const value = loaded[index];
                        loaded.splice(index, 1);
                        return value;
                    });
            } else {
                // Otherwise pick the words randomly but make sure you remove the words once selected to avoid
                // duplicate words. If it fails then throw an error which should only happen when running out of
                // words
                // TODO: this should probably be handled higher
                for (let i = 0; i < amount; i++) {
                    const index = rand
                        ? Math.round(rand() * (loaded.length - 1))
                        : undefined;
                    if (index === undefined) throw new Error('Ran out of words');
                    selected.push(loaded[index]);
                    loaded.splice(index, 1);
                }
            }

            // And finally update the words, ready to start the game
            setWords([clone, selected]);
        }

        fetch().catch((e) => setWords(e));
    }, [amount, length]);


    // On error just print out the error and be sad :(
    if (words instanceof Error) {
        return (<div className="error">Error: could not load words: {words.message}</div>)
    } else if (typeof (words) === 'undefined') {
        // Undefined indicates we are currently loading
        // TODO: is this going to cause lots of calls (does this need a loading state)
        return (<div>Loading</div>)
    } else {
        // Otherwise provide the complete valid word list through context and then start a mikordle game!
        return (
            <ValidWords.Provider value={words[0]}>
                <Mikordle
                    letterCount={length}
                    guessesAllowed={guesses}
                    columns={columns}
                    words={words[1]}
                    validWords={words[0]}
                    onEnd={onEnd}
                    continuing={continuing}
                />
            </ValidWords.Provider>
        )
    }
}

/**
 * A wrapper around {@link AutoSelectMikordle} which enabled advanced profiling statistics
 */
const ProfiledAuto = withProfile(AutoSelectMikordle);

/**
 * If the game is running in debug mode
 */
const DEBUG = false;
/**
 * The mapping of stage to the number of boards for that game
 */
const mapping = DEBUG ? [1] : [1, 2, 4, 8, 16, 32];
/**
 * The mapping of the stage to the number of columns boards should be presented in
 */
const columns = DEBUG ? [1] : [1, 2, 2, 2, 2, 4];
/**
 * The mapping of the stage to the number of guesses allowed for each word
 */
const guesses = DEBUG ? [6] : [6, 7, 9, 13, 21, 37];
/**
 * A wrapper around {@link ProfiledAuto} and {@link AutoSelectMikordle} which will swap based on whether this is running
 * in debug mode. Increasing profiling support in debug mode and using the raw element when not.
 */
const Auto = DEBUG ? ProfiledAuto : AutoSelectMikordle;

const Home: FunctionalComponent = () => {
    // TODO: this doesn't handle the day!
    // Stage holds where you are currently in the game. If the game has already been started, this should be loaded from
    // local storage
    const [stage, setStage] = useState(Number(localStorageGetItem('mikordle-stage') ?? 0));

    // Records if the game for today has already been completed. This should be loaded from local storage so it is
    // persistent
    const [finished, setFinished] = useState(isTodayComplete());

    // The copy-paste statistics for todays game. if provided in local storage for today that should be loaded,
    // otherwise it is just an empty string that will be built up
    const [copyStats, setCopyStats] = useState(getTodayStats() ?? '');

    // A reference to the textarea used to present the values - this is only populated on finish but as its a hook its
    // calling order needs to be consistent
    const ref = createRef();

    /**
     * Wrapper around setCopyStats which will cache the values into the local storage when called
     * @param s the new value for the copy statistics
     */
    const saveCopyStats = (s: string) => {
        saveTodayStats(s);
        setCopyStats(s);
    }
    /**
     * Wrapper around saveCopyStats which appends the given value instead of setting it
     * @param s the value to append
     */
    const addToCopyStats = (s: string) => saveCopyStats(copyStats + s);

    // If the game is finished, it should look like
    // [textarea]
    // [copy to clipboard]
    // [distribution of guesses]
    if (finished) {
        return (
            <>
                <div className={style.header}>
                    <h1>Mikordle</h1>
                </div>
                <div className={style.home}>
                    <div style={{marginTop: '1pc'}}>
                        <textarea ref={ref} className={style.textarea}>
                            {`Mikordle (https://mikordle.xiomi.org)\n--\n${copyStats}`}
                        </textarea>
                        <br/>
                        <button className={style.button} onClick={() => {
                            if (ref.current === null) return;
                            const element: HTMLTextAreaElement = ref.current;

                            element.select();
                            element.setSelectionRange(0, 99999);

                            void navigator.clipboard.writeText(element.value);
                        }}>
                            Copy to Clipboard
                        </button>
                        <DistributionViewer/>
                    </div>
                </div>
            </>
        );
    }

    // If its not finished then it should start an Auto selecting word game with all the properties for the current
    // stage.
    return (
        <>
            <div className={style.header}>
                <h1>Mikordle</h1>
            </div>
            <div className={style.home}>
                {<Auto
                    key={`stage${stage}`}
                    length={5}
                    guesses={guesses[stage]}
                    columns={columns[stage]}
                    amount={mapping[stage]}
                    onEnd={(losses: any, distribution: any, stats: (number | false)[][]) => {
                        // On ending the metrics need to be merged into the global ones to produce a consistent result
                        addToBoardAndTotalMetrics(mapping[stage], Object.keys(distribution).length, losses, distribution);

                        // Either move on to the next stage or if this is the last stage (there are no further mappings)
                        // then set that we are finished and cache the value into local storage for today
                        if (mapping[stage + 1] === undefined) {
                            completeToday();
                            setFinished(true);
                        } else {
                            localStorageSetItem('mikordle-stage', String(stage + 1));
                            setStage((s) => s + 1);
                        }

                        // Also convert the statistics into a format which is nice and copy-pastable and add it to the
                        // copy stats which will also cache it in local storage
                        const statString = stats
                            .map((e) => e.map((f) => f === false ? `X/${guesses[stage]}` : `${f}/${guesses[stage]}`).join('    '))
                            .join('\n');

                        const output = `Board ${stage + 1} (${mapping[stage]} words): \n${statString}\n\n`;
                        addToCopyStats(output);
                    }}
                    continuing={true}
                    useToday={true}
                    stage={stage}
                />}
            </div>
        </>
    );
};

export default Home;
