import { FunctionalComponent, h, Fragment, Component, RenderableProps, ComponentChild } from "preact";
import { add, enter, remove, WordleState } from "../../utils/types";
import WordleGrid from "../grid/grid";
import Keyboard from "../keyboard/keyboard";
import { Dictionary, getIntermediateState, saveIntermediateState } from "../../utils/data";
import style from './style.css';
import DictionaryLookup from "../dictionary/dictionary";
import { OnEndFunction } from "../../routes/home";
import { MikordleChat } from "../../utils/messenger";

/**
 * The state of the game when it has been won
 */
export interface WinState {
    type: 'WinState';
    /**
     * The number of letters in the word for this set of boards
     */
    letterCount: number;
    /**
     * The number of guesses that were allowed in this game
     */
    guessesAllowed: number;
    /**
     * How many columns the boards were presented in
     */
    columns: number;
    /**
     * The results of each board. False indicates that the board was not
     * won and a number represents in how many guesses it took to match the
     * word. This is a 1D array, running from horizontally through the rows
     */
    records: (false | number)[];
}

/**
 * The state of the game when it is currently in play
 */
export interface GameState {
    type: 'GameState';
    /**
     * The number of letters in the word for this set of boards
     */
    letterCount: number;
    /**
     * The number of guesses that are allowed in this game
     */
    guessesAllowed: number;
    /**
     * The letters that are currently in the guess being made
     */
    activeGuess: string;
    /**
     * How many columns the boards were presented in
     */
    columns: number;
    /**
     * The state of each board, minus their width and height
     */
    states: Omit<WordleState, 'width' | 'height'>[];
}

/**
 * The properties required to run a mikordle game
 */
export interface MikordleProps {
    /**
     * The number of letters in the word for this set of boards
     */
    letterCount: number;
    /**
     * The number of guesses that were allowed in this game
     */
    guessesAllowed: number;
    /**
     * How many columns the boards were presented in
     */
    columns: number;
    /**
     * The words that are being guessed
     */
    words: string[];
    /**
     * The set of words which are valid for this game
     */
    validWords: Dictionary;
    /**
     * The function to call on a board end if it has been specified
     */
    onEnd?: OnEndFunction;
    /**
     * If this board should show a continue button once it has been finished
     */
    continuing?: boolean;

    communicator?: MikordleChat;
}

/**
 * Adds a new letter to the current guess and child board states if it is allowed (there are characters left in the
 * guess word). This will return the updated state which can be returned to setState to update the current game
 * @param state the initial state which should be manipulated
 * @param letter
 */
const addLetter = (state: GameState, letter: string): GameState => {
    // Ensure that there are enough letters left to guess. If not return the initial state which will not produce a
    // change to the game
    if (state.activeGuess.length >= state.letterCount) {
        return state;
    }

    return {
        // Copy in the rest of the state
        ...state,
        // Add the letter to the guess
        activeGuess: state.activeGuess + letter,
        // And then make a copy of the child states and update them all. This aims to produce copies rather than
        // adjusting the objects to keep things as clean as possible. See add() for the actual code used to add a letter
        states: state.states.map((e) => {
            // Completed baords should not be updated, it would fuck things up
            if (e.complete) return e;
            const copy = { ...e };
            add(copy, state.letterCount, state.guessesAllowed, letter);
            return copy;
        })
    }
}

/**
 * Removes the last letter from the guess in this game state and returns a brand new state. All board states that are
 * modified within the game state will be returned as a new object to avoid indirect side effects to changing the
 * values.
 * @param state the game state which should be modified
 */
const removeLetter = (state: GameState): GameState => {
    // If the active guess has no letters in it, there is nothing that can be removed
    if (state.activeGuess.length <= 0) return state;

    return {
        ...state,
        // Delete the last letter
        activeGuess: state.activeGuess.substring(0, state.activeGuess.length - 1),
        // And for each state, remove the letter if its not complete
        states: state.states.map((e) => {
            if (e.complete) return e;
            const copy = { ...e };
            remove(copy);
            return copy;
        })
    };
}

/**
 * Handles pressing enter on the boards when a guess has been made. This will return a new state if one needs to be
 * produced or the same state if not. In the event a new state is produced, a copy of any of the boards changed will be
 * provided to reduce any possible side effects
 * @param state the original state to modify
 * @param validWords the set of valid words to ensure that the word entered is allowed to be submitted
 */
const onEnter = (state: GameState, validWords: string[]): GameState | WinState => {
    // Make sure they have guessed enough letters
    if (state.activeGuess.length !== state.letterCount) return state;

    // And that their word is valid
    if (!validWords.includes(state.activeGuess)) return state;


    // Offload the work to the enter() function and make it perform on a copy of the board state
    const states = state.states.map((e) => {
        if (e.complete) return e;
        const copy = { ...e };
        enter(copy, state.letterCount, state.guessesAllowed);
        return copy;
    });

    // If every board is completed as a result of this enter then the entire game state needs to swap aver to the win
    // state to update rendering so produce that instead
    if (states.every((e) => e.complete)) {
        return {
            type: 'WinState',
            records: states.map((e) => e.complete === 'SUCCESS' ? e.rows.length : false),
            guessesAllowed: state.guessesAllowed,
            letterCount: state.letterCount,
            columns: state.columns,
        };
    }

    // If we didn't win the game, however, then merge in the existing state with the new board states and also clear the
    // current guess as its committed to the boards.
    return {
        ...state,
        states,
        activeGuess: '',
    }
}

class Mikordle extends Component<MikordleProps, GameState | WinState> {

    private onExit: Function[] = [];

    constructor(props: MikordleProps, context: never) {
        super(props, context);

        // If a state has already been made for this configuration then we should recall that. This supports the ability
        // to come back to a game within the same day and restore where you were. Otherwise build up the default state
        // which is just an empty board with no guess
        this.state = getIntermediateState(this.props) ?? {
            type: 'GameState',
            activeGuess: '',
            letterCount: props.letterCount,
            columns: props.columns,
            guessesAllowed: props.guessesAllowed,
            states: props.words.map((target) => ({ rows: [], complete: false, target })),
        };

        // Bind a few functions for safe calling no matter where they are passed. Javascript be weird sometimes
        this.onKey = this.onKey.bind(this);
        this.end = this.end.bind(this);
    }

    /**
     * Wrapper around the parent shouldComponentUpdate (if its defined because apparently its an option to not be?) or
     * true if its not defined which also caches the new state for this props configuration to support restoring the
     * state at a later time.
     * @param nextProps the next set of props
     * @param nextState the next state
     * @param nextContext the next context being applied
     */
    shouldComponentUpdate(nextProps: Readonly<MikordleProps>, nextState: Readonly<GameState | WinState>, nextContext: never): boolean {
        saveIntermediateState(nextState, this.props);
        if (this.props.communicator !== nextProps.communicator) {
            if (nextProps.communicator) {
                this.onExit.push(nextProps.communicator.on('key-pressed', (key) => {
                    this.onKey({ keyCode: key.charCodeAt(0), key }, true);
                }));
                this.onExit.push(nextProps.communicator.on('key-removed', () => {
                    this.onKey({ keyCode: 8, key: '' }, true);
                }));
                this.onExit.push(nextProps.communicator.on('enter-pressed', () => {
                    this.onKey({ keyCode: 13, key: '' }, true);
                }));
                this.onExit.push(nextProps.communicator.on('initialise', (state) => {
                    this.setState(state);
                }))
                this.onExit.push(nextProps.communicator.on('request', () => {
                    console.log('got request');
                    if (this.state.type !== 'GameState') return;
                    nextProps.communicator?.initialise(this.state);
                }));
            }
            return true;
        }
        return super.shouldComponentUpdate?.(nextProps, nextState, nextContext) ?? true;
    }

    /**
     * Binds a listener to the window into 'keydown' to avoid having to focus on things
     */
    componentDidMount(): void {
        console.log('mounting');
        window.addEventListener('keydown', this.onKey);
    }

    /**
     * Unbinds a listener to the window into 'keydown' to clean up from the mounting
     */
    componentWillUnmount(): void {
        console.log('unmounting');
        window.removeEventListener('keydown', this.onKey);
        this.onExit.forEach((e) => e());
    }

    /**
     * Ends a game, calculating the distributions and properties and optionally calling the onEnd function
     * @private
     */
    private end(): void {
        // Can't end if we're not in the win state so bail out then
        if (this.state.type !== 'WinState') return;

        // Calculate the distribution of how many wins there were per number of guesses.
        const distribution: Record<number, number> = {};
        this.state.records
            .forEach((result) => {
                if (typeof (result) === 'number') distribution[result] = (distribution[result] ?? 0) + 1;
            })

        // Then convert the linear array style of results by looping it by column. This will be used for copy paste
        // results!
        const stats: (number | false)[][] = [];
        let ar: (number | false)[] = [];
        let c = 0;
        this.state.records.forEach((e) => {
            ar.push(e);
            c++;
            if (c >= this.props.columns) {
                stats.push(ar);
                ar = [];
                c = 0;
            }
        })

        // If the on end function was defined, pass on all these values to it.
        this.props.onEnd?.(
            this.state.records.filter((e) => e === false).length,
            distribution,
            stats,
        );
    }

    /**
     * On a key being pressed, execute the related action if it is one of a valid letter, backspace, or enter.
     * On a letter being pressed it will be passed on to {@link addLetter}.
     * On enter being pressed it will be passed on to {@link onEnter}
     * On backspace being pressed it will be passed on to {@link removeLetter}
     * @param e the event that took place, requires a numerical `keyCode` and a string `key`
     */
    onKey(e: { keyCode: number; key: string }, synthetic: boolean = false): void {
        console.log(e, synthetic);
        // Ignore undefined events - this is a bit weird but seemed to turn up in testing
        if (!e) return;

        // If its not in the A-Z range and not enter or backspace, it can be safely ignored so quit
        if ((e.keyCode < 65 || e.keyCode > 90) && e.keyCode !== 8 && e.keyCode !== 13) return;

        // If its a letter and the function is valid, add it and update the state
        if (e.keyCode >= 65 && e.keyCode <= 90 && addLetter) this.setState((s) => {
            if (s.type !== 'GameState') return s;
            if (this.props.communicator && !synthetic) this.props.communicator.keyPressed(e.key.toUpperCase());
            return addLetter(s, e.key.toUpperCase());
        });

        // If its a backspace and the remove letter function is valid, remove the letter and update the state
        if (e.keyCode === 8 && removeLetter) this.setState((s) => {
            if (s.type !== 'GameState') return s;
            if (this.props.communicator && !synthetic) this.props.communicator.keyRemoved();
            return removeLetter(s);
        });

        // On enter, try and submit, optionally calling end if it transitions to the win state
        if (e.keyCode === 13 && onEnter) this.setState((s) => {
            if (s.type !== 'GameState') return s;
            if (this.props.communicator && !synthetic) this.props.communicator.enterPressed();

            const result = onEnter(s, this.props.validWords);
            if (result.type === 'WinState' && !this.props.continuing) {
                this.end();
            }
            return result;
        });
    }

    render(props?: RenderableProps<MikordleProps>, state?: Readonly<GameState | WinState>): ComponentChild {
        console.log(this.props);
        if (state === undefined) return (<div>Unknown state</div>);
        if (props === undefined) return (<div>Unknown props</div>);

        if (state.type === 'WinState') {
            return (
                // Div to allow centering of the results
                <div>
                    {/*Div to contain all the results in place*/}
                    <div className={style.resultContainer}>
                        <div style={{ display: 'inline-block' }}>
                            {/*Produce a grid of results that matches the structure of the table - use emojis to*/}
                            {/*provide nice aesthetics*/}
                            {state.records.map((e, i) => {
                                const entry = typeof (e) === 'boolean'
                                    ? (<span className={style.result}>❌ X/{state.guessesAllowed}</span>)
                                    : (<span className={style.result}>✅ {e}/{state.guessesAllowed}</span>);

                                // If its the end of a column, add a line break
                                if ((i + 1) % state.columns === 0) return (
                                    <>
                                        {entry}
                                        <br
                                        />
                                    </>
                                );

                                // Otherwise just add next to the other one
                                return entry;
                            })}
                        </div>
                    </div>

                    <br
                    />

                    {/*Add a quickly accessed next button only if this game can be continued into another one*/}
                    {props.continuing ? <button onClick={(): void => this.end()}
                                                className={style.button}>Continue</button> : undefined}

                    {/*Then add a table of definitions for each of the words. This causes a lot of net requests and*/}
                    {/*could be batched together to improve performance but I don't really care too much right now*/}
                    <table className={style.table}>
                        {props.words.map((word) => (
                            <tr key={word}>
                                <th>{word}</th>
                                <td>
                                    <DictionaryLookup
                                        word={word}
                                    />
                                </td>
                            </tr>
                        ))}
                    </table>
                </div>
            )
        }

        // During game play render the grid of games using the internal states, and the keyboard which should be updated
        // with the colours. This links into the key function to emulate key events from the keyboard
        return (
            <>
                <WordleGrid
                    innerWidth={state.letterCount}
                    innerHeight={state.guessesAllowed}
                    columns={state.columns}
                    entries={state.states}
                />
                <Keyboard
                    onBack={(): void => this.onKey({ keyCode: 8, key: '' })}
                    onEnter={(): void => this.onKey({ keyCode: 13, key: '' })}
                    onKey={(k): void => this.onKey({ keyCode: k.charCodeAt(0), key: k })}
                    states={state.states}
                    columns={state.columns}
                />
            </>
        );
    }
}

export default Mikordle;
