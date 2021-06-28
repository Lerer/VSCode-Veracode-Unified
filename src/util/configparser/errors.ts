/**
 * Error thrown when addSection is called with a section
 * that already exists.
 * @param {string} section - Section Name
 * @constructor
 */

export class DuplicateSectionError extends Error {
  public readonly name: 'DuplicateSectionError';

  constructor(section: string) {
    super();
    this.name = 'DuplicateSectionError';
    this.message = section + ' already exists';
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, Error.prototype);

  }
}



/**
 * Error thrown when the section being accessed, does
 * not exist.
 * @param {string} section - Section Name
 * @constructor
 */
export class NoSectionError extends Error {
    public readonly name: 'NoSectionError';
  
    constructor(section: string) {
      super();
      this.name = 'NoSectionError';
      this.message = 'Section ' + section + ' does not exist.';
      Error.captureStackTrace(this, this.constructor);
      Object.setPrototypeOf(this, Error.prototype);
  
    }
  }

/**
 * Error thrown when a file is being parsed.
 * @param {string} filename - File name
 * @param {int} lineNumber - Line Number
 * @param {string} line - Contents of the line
 * @constructor
 */
export class ParseError extends Error {
    public readonly name: 'ParseError';
  
    constructor(filename:string, lineNumber:number, line:string) {
      super();
      this.name = 'ParseError';
      this.message = 'Source contains parsing errors.\nfile: ' + filename +
        ' line: ' + lineNumber + '\n' + line;
      Error.captureStackTrace(this, this.constructor);
      Object.setPrototypeOf(this, Error.prototype);
  
    }
  }

/**
 * Error thrown when there are no section headers present
 * in a file.
 * @param {string} filename - File name
 * @param {int} lineNumber - Line Number
 * @param {string} line - Contents of the line
 * @constructor
 */
export class MissingSectionHeaderError extends Error {
    public readonly name: 'MissingSectionHeaderError';
  
    constructor(filename:string, lineNumber:number, line:string) {
      super();
      this.name = 'MissingSectionHeaderError';
      this.message = 'File contains no section headers.\nfile: ' + filename +
      ' line: ' + lineNumber + '\n' + line;
      Error.captureStackTrace(this, this.constructor);
      Object.setPrototypeOf(this, Error.prototype);
  
    }
  }

/**
 * Error thrown when the interpolate function exceeds the maximum recursion
 * depth.
 * @param {string} section - Section Name
 * @param {string} key - Key Name
 * @param {string} value - Key Value
 * @param {int} maxDepth - Maximum recursion depth
 * @constructor
 */
export class MaximumInterpolationDepthError extends Error {
    public readonly name: 'MaximumInterpolationDepthError';
  
    constructor(section:string, key:string, value:string, maxDepth:number) {
      super();
      this.name = 'MaximumInterpolationDepthError';
      this.message = 'Exceeded Maximum Recursion Depth (' + maxDepth +
      ') for key ' + key + ' in section ' + section + '\nvalue: ' + value;
      Error.captureStackTrace(this, this.constructor);
      Object.setPrototypeOf(this, Error.prototype);
  
    }
  }

module.exports = {
    DuplicateSectionError,
    NoSectionError,
    ParseError,
    MissingSectionHeaderError,
    MaximumInterpolationDepthError
};