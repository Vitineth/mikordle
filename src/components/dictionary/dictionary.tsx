import {FunctionalComponent, h} from "preact";
import {useEffect, useState} from "preact/hooks";

type APIResult = {
    word: string;
    phonetic: string;
    phonetics: {
        text: string;
        audio?: string;
    }[];
    origin: string;
    meanings: {
        partOfSpeech: string;
        definitions: {
            definition: string;
            example: string;
            synonyms: string[];
            antonyms: string[];
        }[];
    }[];
}[]

/**
 * A custom, very limited markup type which can be converted easily into HTML. A string is interpreted as simple text
 * with no formatting. An array is turned into an unordered list. An empty object is treated as a line break and an
 * object containing a bold keyword is emitted as a 'strong' element.
 */
type DefinitionPseudoMarkup = (string | string[] | {} | { bold: string })[] | string;

const DictionaryLookup: FunctionalComponent<{ word: string }> = ({word}) => {
    // State of the definition is either not started loading or failed (undefined), in progress (LOADING) or a markup
    // result
    const [definition, setDefinition] = useState<undefined | 'LOADING' | DefinitionPseudoMarkup>(undefined);

    useEffect(() => {
        // Create an async function which loads the result and then parses the result into a pseudo markup before
        // updating the state.
        const lookup = async (): Promise<void> => {
            try {
                // Initially lookup the definition and if its valid parse the result and do a blind cast to the API type
                // Could be a bit dangerous but oh well
                const result = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
                    .then((d) => d.json()) as APIResult;

                // And then convert the results to pseudo markdown!
                const layout = result.map((word) => {
                    // If it has no meanings just skip this one. The result of this is being flattened down so an empty
                    // array will just be removed
                    if (!word.meanings) {
                        return [];
                    }

                    // If phonetics are provided, list them all in brackets
                    const phonetic = word.phonetics.length === 0
                        ? ''
                        : `(${word.phonetics.map((e: { text: string }) => e.text).join('')})`;

                    // And list every meaning in the form '[new line] as a [part of speech]: [definitions as unordered list]
                    const meanings: DefinitionPseudoMarkup[] = word.meanings.map((entry): DefinitionPseudoMarkup => [
                        {},
                        `as a ${entry.partOfSpeech}: `,
                        entry.definitions.map((define) => define.definition),
                    ]).flat() as unknown as DefinitionPseudoMarkup[];

                    // Then return it with the word itself at the start as some searches come back with multiple word
                    // entries
                    return [{bold: `${word.word} ${phonetic}`}, ...meanings];
                }).flat();

                // Then update the layout which will cause a repaint
                setDefinition(
                    layout,
                );
            } catch (e: any) {
                // If it fails, just update with an error
                setDefinition(`Failed to find definition - an error occurred: ${e.message}`);
                console.error(e);
            }
        }

        // Only look it up is nothing is provided. If its in process this will be LOADING, and if it loaded or failed it
        // will be pseud markdown
        if (definition === undefined) {
            setDefinition('LOADING');
            lookup().catch(console.error);
        }
    }, [definition, word]);

    // Bail out early if there are no definitions
    if (definition === undefined || definition === 'LOADING') return (<span>loading...</span>);

    // If the definition is a basic string theres no need to try and go through and do the parsing
    if (typeof (definition) === 'string') return (<span>{definition}</span>);

    // Otherwise convert the markdown to a set of elements ready to be rendered
    const internal = definition.map((entry) => {
        // Strings are produced inline
        if (typeof (entry) === 'string') return (<span>{entry}</span>);
        // Arrays are converted to unordered lists of elements
        if (Array.isArray(entry)) return (<ul>{entry.map((row, i) => (<li key={i}>{row}</li>))}</ul>);
        // Objects with a bold property are produced inline as a strong element
        if (typeof (entry) === 'object' && Object.prototype.hasOwnProperty.call(entry, 'bold')) return (
            <strong>{(entry as { bold: string }).bold}</strong>);
        // Objects without a bold entry produces a new line
        else if (typeof (entry) === 'object') return (
            <br
            />
        );

        // Anything else is undefined which forces a result and won't break rendering
        return undefined;
    });

    // Then finally just render everything
    return (<span>{internal}</span>);
}

export default DictionaryLookup;