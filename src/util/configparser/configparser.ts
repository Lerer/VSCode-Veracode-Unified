import util = require('util');
import fs = require('fs');
import errors = require('./errors');
import log = require('loglevel');


/**
 * Regular Expression to match section headers.
 * @type {RegExp}
 * @private
 */
const SECTION: RegExp = new RegExp(/\s*\[([^\]]+)]/);

/**
 * Regular expression to match key, value pairs.
 * @type {RegExp}
 * @private
 */
const KEY: RegExp = new RegExp(/\s*(.*?)\s*[=:]\s*(.*)/);

/**
 * Regular expression to match comments. Either starting with a
 * semi-colon or a hash.
 * @type {RegExp}
 * @private
 */
const COMMENT: RegExp = new RegExp(/^\s*[;#]/);

// RL1.6 Line Boundaries (for unicode)
// ... it shall recognize not only CRLF, LF, CR,
// but also NEL, PS and LS.
const LINE_BOUNDARY = new RegExp(/\r\n|[\n\r\u0085\u2028\u2029]/g);

const readFileAsync = util.promisify(fs.readFile);

/**
 * @constructor
 */
export class ConfigParser{
    _sections:any;

    constructor() {
        this._sections = {};
    }


    /**
     * Returns an array of the sections.
     * @returns {Array}
     */
    sections (): Array<string>  {
        return Object.keys(this._sections);
    }


    /**
     * Adds a section named section to the instance. If the section already
     * exists, a DuplicateSectionError is thrown.
     * @param {string} section - Section Name
     */
    addSection (section:string) {
        if(this._sections.hasOwnProperty(section)){
            throw new errors.DuplicateSectionError(section)
        }
        this._sections[section] = {};
    }


    /**
     * Return the list of sections 
     * @returns {Array}
     */
    getSections (): Array<string> {
        return Array.from( this._sections.keys() );
    }


    /**
     * Indicates whether the section is present in the configuration
     * file.
     * @param {string} section - Section Name
     * @returns {boolean}
     */
    hasSection (section:string): boolean {
        return this._sections.hasOwnProperty(section);
    }


    /**
     * Returns an array of all keys in the specified section.
     * @param {string} section - Section Name
     * @returns {Array}
     */
    keys (section:string):Array<string> {
        try {
            return Object.keys(this._sections[section]);
        } catch(err){
            throw new errors.NoSectionError(section);
        }
    }


    /**
     * Indicates whether the specified key is in the section.
     * @param {string} section - Section Name
     * @param {string} key - Key Name
     * @returns {boolean}
     */
    hasKey (section:string, key:string): boolean {
        return this._sections.hasOwnProperty(section) &&
            this._sections[section].hasOwnProperty(key);
    }


    /**
     * Reads a file and parses the configuration data.
     * @param {string|Buffer|int} file - Filename or File Descriptor
     */
    read (file:string) {
        const lines = fs.readFileSync(file)
            .toString('utf8')
            .split(LINE_BOUNDARY);
        this.parseLines(file, lines);
    }


    /**
     * Reads a file asynchronously and parses the configuration data.
     * @param {string|Buffer|int} file - Filename or File Descriptor
     */
    async readAsync (file:string) {
        const lines = (await readFileAsync(file))
            .toString('utf8')
            .split(LINE_BOUNDARY);
        this.parseLines(file, lines);
    }


    /**
     * Gets the value for the key in the named section.
     * @param {string} section - Section Name
     * @param {string} key - Key Name
     * @param {boolean} [raw=false] - Whether or not to replace placeholders
     * @returns {string|undefined}
     */
    get (section:string, key:string):string|undefined {
        if(this._sections.hasOwnProperty(section)){
            return this._sections[section][key];
            // } else {
            //     return interpolation.interpolate(this, section, key);
            // }
        }
        return undefined;
    }


    /**
     * Coerces value to an integer of the specified radix.
     * @param {string} section - Section Name
     * @param {string} key - Key Name
     * @param {int} [radix=10] - An integer between 2 and 36 that represents the base of the string.
     * @returns {number|undefined|NaN}
     */
    getInt (section:string, key:string, radix:number): number|undefined {
        if(this._sections.hasOwnProperty(section)){
            if(!radix) radix = 10;
            return parseInt(this._sections[section][key], radix);
        }
        return undefined;
    }


    /**
     * Coerces value to a float.
     * @param {string} section - Section Name
     * @param {string} key - Key Name
     * @returns {number|undefined|NaN}
     */
    getFloat (section:string, key:string) : number|undefined {
        if(this._sections.hasOwnProperty(section)){
            return parseFloat(this._sections[section][key]);
        }
        return undefined;
    }

    /**
     * Returns an object with every key, value pair for the named section.
     * @param {string} section - Section Name
     * @returns {Object}
     */
    items (section:string) : any{
        return this._sections[section];
    }


    /**
     * Sets the given key to the specified value.
     * @param {string} section - Section Name
     * @param {string} key - Key Name
     * @param {*} value - New Key Value
     */
    set (section:string, key:string, value:any) {
        if(this._sections.hasOwnProperty(section)){
            this._sections[section][key] = value;
        }
    }

    /**
     * Removes the property specified by key in the named section.
     * @param {string} section - Section Name
     * @param {string} key - Key Name
     * @returns {boolean}
     */
    removeKey (section:string, key:string): boolean {
        // delete operator returns true if the property doesn't not exist
        if(this._sections.hasOwnProperty(section) &&
            this._sections[section].hasOwnProperty(key)){
            return delete this._sections[section][key];
        }
        return false;
    }


    /**
     * Removes the named section (and associated key, value pairs).
     * @param {string} section - Section Name
     * @returns {boolean}
     */
    removeSection (section:string):boolean {
        if(this._sections.hasOwnProperty(section)){
            return delete this._sections[section];
        }
        return false;
    }


    parseLines (file:string,lines:Array<string>) {
        let currentSectionName:string = '';
        lines.forEach((line, lineNumber) => {
            if(!line || line.match(COMMENT)) return;
            let res = SECTION.exec(line);
            if(res){
                const header = res[1];

                this.addSection(header);
                currentSectionName = header;

            } else if(currentSectionName.length===0) {
                throw new errors.MissingSectionHeaderError(file, lineNumber, line);
            } else {
                res = KEY.exec(line);
                if(res){
                    const key = res[1];

                    this.set(currentSectionName,key,res[2]);
                } else {
                    throw new errors.ParseError(file, lineNumber, line);
                }
            }
        });
    }


    getSectionsAsString () {
        let out = '';
        let section;
        for(section in this._sections){
            if(!this._sections.hasOwnProperty(section)) continue;
            out += ('[' + section + ']\n');
            const keys = this._sections[section];
            let key;
            for(key in keys){
                if(!keys.hasOwnProperty(key)) continue;
                let value = keys[key];
                out += (key + '=' + value + '\n');
            }
            out += '\n';
        }
        return out;
    }
}

