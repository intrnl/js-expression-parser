export class Parser {
	/** @type {string} */
	_buf;
	/** @type {number} */
	_pos;

	constructor (buffer, position = 0) {
		this._buf = buffer;
		this._pos = position;
	}

	/**
	 * @param {string} message
	 * @param {number} index
	 * @returns {null}
	 */
	_error (message, index = this._pos) {
		throw { name: 'ParserError', message, index };
	}


	/**
	 * @returns {string}
	 */
	_get_char () {
		return this._buf.charAt(this._pos);
	}

	/**
	 * @returns {number}
	 */
	_get_code () {
		return this._buf.charCodeAt(this._pos);
	}


	/**
	 * @param {string} str
	 * @returns {string}
	 */
	_match (str) {
		if (this._buf.slice(this._pos, this._pos + str.length) === str) {
			return str;
		}

		return '';
	}

	/**
	 * @param {RegExp} pattern
	 * @returns {string}
	 */
	_match_regex (pattern) {
		let match = pattern.exec(this._buf.slice(this._pos));
		if (!match || match.index !== 0) return '';

		return match[0];
	}


	/**
	 * @param {RegExp} pattern
	 * @returns {string}
	 */
	_read (pattern) {
		let result = this._match_regex(pattern);
		if (result) this._pos += result.length;
		return result;
	}


	/**
	 * @param {strign} str
	 * @param {boolean} [required]
	 * @returns {string}
	 */
	_eat (str, required = false) {
		if (this._match(str)) {
			this._pos += str.length;
			return str;
		}

		if (required) {
			let msg = `expected ${typeof required == 'string' ? required : str}`;
			return this._error(msg);
		}

		return '';
	}

	/**
	 * @param {boolean} [required]
	 * @returns {void}
	 */
	_eat_whitespace (required = false) {
		let ws = this._read(/^[ \t\n\r]+/g);

		if (required && !ws) {
			return this._error('expected whitespace');
		}
	}
}
