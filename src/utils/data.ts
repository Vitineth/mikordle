import {GameState, MikordleProps, WinState} from "../components/mikorle/mikordle";

/**
 * Type alias for a dictionary of words - the name is a bit of a misnomer, its just a list of words
 * TODO: this should probably be refactored out now that the way dictionaries are used has changed
 */
export type Dictionary = string[]

/**
 * Type for the metrics object held in local storage
 */
export type Metrics = {
    /**
     * The total number of wins of all time
     */
    totalWins: number;
    /**
     * The total number of losses of all time
     */
    totalLosses: number;
    /**
     * A storage of the distribution by wordle size to provide more in-depth analytics
     */
    bySize: Record<string, {
        /**
         * The total number of words for this board size
         */
        totalWins: number;
        /**
         * The total number of losses for this board size
         */
        totalLosses: number;
        /**
         * The distribution of wins by guesses for this board size
         */
        distribution: Record<string, number>;
    }>;
    /**
     * Distribution of wins by guesses
     */
    distribution: Record<string, number>;
};

/**
 * The cache of word size to dictionaries to avoid repeat loadings
 */
const wordCache: Record<number, Dictionary> = {};

/**
 * Fetch an item from local storage with handling for if local storage is not available. If local storage is not
 * available then returns null. This is to handle the SSR pre-compile by preact
 * @param key the key to load
 * @return the value or null if the value is undefined or if localStorage is not available
 */
export function localStorageGetItem(key: string): string | null {
    if (typeof window === 'undefined') {
        console.error('localStorage not available - are you running in node?');
        return null;
    }

    return localStorage.getItem(key);
}

/**
 * Sets an item in the local storage with handling for if local storage is not available. If local storage is not
 * available then nothing will happen. This is to handle SSR pre-compile by preact
 * @param key the key to set
 * @param value the value it should be set ot
 */
export function localStorageSetItem(key: string, value: string): void {
    if (typeof window === 'undefined') {
        console.error('localStorage not available - are you running in node?');
        return;
    }

    localStorage.setItem(key, value);
}

/**
 * Returns a value in the local storage set by {@link setTimeLimitedLocalStorageEntry}. This will only return the value
 * if it was set today. If it was not set today then null is returned instead
 * @param key the key to retrieve
 * @return the value if present or set today, or null if not set or not set today
 */
function getTimeLimitedLocalStorageEntry(key: string): string | null {
    try {
        const value = localStorageGetItem(key);
        if (value === null) return null;

        const parsed = JSON.parse(value);
        if (parsed.set !== getToday()) return null;

        return parsed.value;
    } catch (e) {
        console.error(e);
    }

    return null;
}

/**
 * Sets a value in the local storage and attaches data to it to say that it was done today. This should only be
 * retrieved through {@link getTimeLimitedLocalStorageEntry} as it is encoded within the object.
 * @param key the key to set
 * @param value the value to set
 */
function setTimeLimitedLocalStorageEntry(key: string, value: string): void {
    localStorageSetItem(key, JSON.stringify({
        set: getToday(),
        value: value,
    }));
}

/**
 * Returns the stats contained within mikordle-today if the value was set today
 */
export const getTodayStats = (): string | null => {
    return getTimeLimitedLocalStorageEntry("mikordle-today");
}

/**
 * Sets the stats contained within mikordle-today and updates the time.
 * @param stats the statistics from today
 */
export const saveTodayStats = (stats: string): void => {
    setTimeLimitedLocalStorageEntry("mikordle-today", stats);
}

/**
 * Returns the timestamp from today
 */
export const getToday = (): number => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/**
 * Returns whether the mikordle was done today
 */
export function isTodayComplete(): boolean {
    return Number(localStorageGetItem("mikordle-completed") ?? "0") >= getToday();
}

/**
 * Marks the mikordle as being completed today
 */
export function completeToday(): void {
    localStorageSetItem("mikordle-completed", String(getToday()));
}

/**
 * Validates whether the provided object is a valid metrics object. Returns false if any value or type is invalid
 * @param test the object to test
 * @return if this is a valid metric object
 */
function validateMetrics(test: any): boolean {
    if (typeof (test) !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(test, 'totalWins')) return false;
    if (!Object.prototype.hasOwnProperty.call(test, 'totalLosses')) return false;
    if (!Object.prototype.hasOwnProperty.call(test, 'bySize')) return false;
    if (!Object.prototype.hasOwnProperty.call(test, 'distribution')) return false;
    if (typeof (test.bySize) !== 'object') return false;
    if (!Object.keys(test.bySize).every((e) => /^[0-9]+$/.test(e))) return false;
    return Object.values(test.bySize).every((e) => Object.prototype.hasOwnProperty.call(e, 'totalLosses')
        && Object.prototype.hasOwnProperty.call(e, 'totalWins')
        && Object.prototype.hasOwnProperty.call(e, 'distribution'));
}

/**
 * Return the metrics currently contained in the local storage or returns a blank object. If it is not set it will
 * update it in the local storage to the empty object. This will also parse it through {@link validateMetrics} to
 * ensure that it is valid. If it is not valid it will be overwritten with an empty metrics
 * @return the metric object or null if it is failed to be loaded which should not be possible
 */
export function getMetrics(): Metrics | null {
    if (!localStorageGetItem("mikordle-metrics")) saveMetrics({
        bySize: {},
        totalLosses: 0,
        totalWins: 0,
        distribution: {}
    });
    const rawMetrics = localStorageGetItem("mikordle-metrics");
    if (rawMetrics === null) return null;
    let parsedMetrics = JSON.parse(rawMetrics);

    // TODO: any attempt to save data here?
    if (!validateMetrics(parsedMetrics)) {
        parsedMetrics = {bySize: {}, totalLosses: 0, totalWins: 0, distribution: {}};
        saveMetrics(parsedMetrics);
    }

    return parsedMetrics;
}

/**
 * Saves a new metrics object to the local storage
 * @param metrics the metric object to save
 */
function saveMetrics(metrics: Metrics): boolean {
    localStorageSetItem("mikordle-metrics", JSON.stringify(metrics));
    return true;
}

/**
 * Adds a new value to the metrics stored in the local storage.
 * @param wins the amount of wins to be added
 * @param losses the amount of losses to be added
 * @param distribution the distribution to be merged with the existing version
 */
function addToTotalMetrics(wins: number, losses: number, distribution: Record<string, number>): boolean {
    const metrics = getMetrics();
    if (metrics === null) return saveMetrics({
        totalWins: wins,
        totalLosses: losses,
        bySize: {},
        distribution: distribution
    });

    metrics.totalLosses += losses;
    metrics.totalWins += wins;

    Object.entries(distribution).forEach(([guesses, successes]) => {
        if (Object.prototype.hasOwnProperty.call(metrics.distribution, guesses)) {
            metrics.distribution[guesses] += successes;
        } else {
            metrics.distribution[guesses] = successes;
        }
    })

    return saveMetrics(metrics);
}

/**
 * Adds a single board size to the matrix object stored in the local storage
 * @param size the size of the board to which this was attributed
 * @param wins the wins which should be added
 * @param losses the losses which should be added
 * @param distribution the distribution which should be merged
 */
function addToBoardMetrics(size: number, wins: number, losses: number, distribution: Record<string, number>): boolean {
    const key = String(size);
    const metrics = getMetrics();
    if (metrics === null) return saveMetrics({totalWins: wins, totalLosses: losses, bySize: {}, distribution: {}});

    if (Object.prototype.hasOwnProperty.call(metrics.bySize, key)) {
        metrics.bySize[key].totalWins += wins;
        metrics.bySize[key].totalLosses += losses;

        Object.entries(distribution).forEach(([guesses, successes]) => {
            if (Object.prototype.hasOwnProperty.call(metrics.bySize[key].distribution, guesses)) {
                metrics.bySize[key].distribution[guesses] += successes;
            } else {
                metrics.bySize[key].distribution[guesses] = successes;
            }
        });
    } else {
        metrics.bySize[key] = {
            totalWins: wins,
            totalLosses: losses,
            distribution,
        };
    }

    return saveMetrics(metrics);
}

/**
 * Adds the provided values to both the global distribution and the local
 * @param size the size of the board to which this was attributed
 * @param wins the wins which should be added
 * @param losses the losses which should be added
 * @param distribution the distribution which should be merged
 */
export function addToBoardAndTotalMetrics(size: number, wins: number, losses: number, distribution: Record<string, number>): boolean {
    return addToTotalMetrics(wins, losses, distribution) && addToBoardMetrics(size, wins, losses, distribution);
}

/**
 * Returns the word lists currently stored in the cache if present. Will return undefined if not present but this is
 * an unsafe function so it is not marked in the type. This should only be used when you are sure the values are loaded.
 * Otherwise use {@link getWords}.
 * @param length the length of words to return.
 */
export function getWordsFromCache(length: number): Dictionary {
    return wordCache[length];
}

/**
 * Returns the word list loaded form the server for the given number of letters. If it is present in the wordCache then
 * it will be returned immediately, otherwise it will be fetched from local storage. If the length is not within 4-15
 * then this will raise an error as these are not stored on the server.
 * @param length the length of words to fetch
 * @return the word list loaded - will reject if there is an error of any kind
 */
export async function getWords(length: number): Promise<Dictionary> {
    if (Object.prototype.hasOwnProperty.call(wordCache, length)) {
        console.log('cache %chit', "color: green")
        return wordCache[length];
    }

    console.log('cache %cmiss', "color: red")
    if (length < 3 || length > 16) throw new Error('Invalid length - no words found');
    return fetch(`/assets/words_l${length}.json`)
        .then((d) => d.json())
        .then((d) => wordCache[length] = d);
}

/**
 * Seedable random number generator
 * @param a the seed for this generator
 */
export function mulberry32(a: number) {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

/**
 * Saves the intermediate state to the local storage to allow recovery of a game on relaunch
 * @param state the state of the game
 * @param props the props of the game to ensure only matching games are returned
 */
export const saveIntermediateState = (state: any, props: MikordleProps) => {
    localStorageSetItem("mikordle-intermediate", JSON.stringify({
        saved: Date.now(),
        content: state,
        letter: props.letterCount,
        guesses: props.guessesAllowed,
        columns: props.columns,
    }));
}

/**
 * Returns the intermediate state stored in the local storage only if the provided props match the configuration stored.
 * Otherwise this will return null and should be replaced with a brand new copy
 * @param props the props of the current configuration to be used to validate the stored state
 */
export const getIntermediateState = (props: MikordleProps): WinState | GameState | null => {
    const result = localStorageGetItem("mikordle-intermediate");
    if (result === null) return null;

    const parsed = JSON.parse(result);

    const inserted = new Date(parsed.saved);
    inserted.setHours(0, 0, 0, 0);
    if (inserted.getTime() !== getToday()) return null;

    if (parsed.letter !== props.letterCount) return null;
    if (parsed.guesses !== props.guessesAllowed) return null;
    if (parsed.columns !== props.columns) return null;

    return parsed.content;
}

