import * as errors from './errors';
import {ConfigParser} from './configparser';

/**
 * Regular Expression to match placeholders.
 * @type {RegExp}
 * @private
 */
const PLACEHOLDER: RegExp = new RegExp(/%\(([\w-]+)\)s/);

/**
 * Maximum recursion depth for parseValue
 * @type {number}
 */
const MAXIMUM_INTERPOLATION_DEPTH: number = 50;

/**
 * Recursively parses a string and replaces the placeholder ( %(key)s )
 * with the value the key points to.
 * @param {ParserConfig} parser - Parser Config Object
 * @param {string} section - Section Name
 * @param {string} key - Key Name
 */
function interpolate(parser:ConfigParser, section:string, key:string) : string|undefined {
    return interpolateRecurse(parser, section, key, 1);
}

/**
 * Interpolate Recurse
 * @param {ConfigParser} parser
 * @param {string} section 
 * @param {string} key
 * @param {number} depth
 * @private
 */
function interpolateRecurse(parser:ConfigParser, section:string, key:string, depth:number): string|undefined {
    let value = parser.get(section, key);//, true);
    if (value!==undefined){
        if(depth > MAXIMUM_INTERPOLATION_DEPTH){
            throw new errors.MaximumInterpolationDepthError(section, key, value, MAXIMUM_INTERPOLATION_DEPTH);
        }
        let res = PLACEHOLDER.exec(value);
        while(res !== null){
            const placeholder = res[1];
            const rep = interpolateRecurse(parser, section, placeholder, depth + 1);
            // replace %(key)s with the returned value next
            value = value.substr(0, res.index) + rep +
                value.substr(res.index + res[0].length);
            // get next placeholder
            res = PLACEHOLDER.exec(value);
        }
    }
    return value;
}

module.exports = {
    interpolate,
    MAXIMUM_INTERPOLATION_DEPTH
};