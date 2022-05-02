// TWEAK CONSTANTS
const PATH = '../src/assets/corncob_caps.txt';
const OUTPUT_DIR = '../src/assets'
const REGEX_FILTER = /^[A-Z]+$/
const MINIMUM_WORD_COUNT = 30;

// HERE BE CODE
const path = require('path');
const fs = require('fs');

/**
 * @type {string}
 */
const fileContent = fs.readFileSync(path.join(__dirname, PATH), {encoding: 'utf8'});
/**
 * @type {string[]}
 */
const words = fileContent
    .split('\n')
    .map((e) => e.trim())
    .filter((e) => REGEX_FILTER.test(e));

const byLength = {};
words.forEach((e) => {
    if (byLength[e.length] === undefined) byLength[e.length] = [];
    byLength[e.length].push(e);
});

const result = Object.fromEntries(
    Object.entries(byLength)
        .filter(([key, value]) => value.length > MINIMUM_WORD_COUNT)
);

Object.keys(result)
    .forEach((key) => {
        fs.writeFileSync(path.join(__dirname, OUTPUT_DIR, `words_l${key}.json`), JSON.stringify(result[key]), {encoding: 'utf8'});
    })
