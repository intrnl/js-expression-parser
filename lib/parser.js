import * as t from './types.js';
import * as c from './code.js';


export function parse (buffer, position = 0) {
	let state = { buf: buffer, pos: position };
	let ast = _read_sequence_exp(state);

	return ast;
}

let expr = '} asd';
console.log(expr.length, parse(expr));


function _read_sequence_exp (s, group = false) {
	let start = s.pos;

	if (group && _read_code(s) !== c.PAREN_OPEN) {
		return _error(s, 'expected paren open');
	}

	let closed = false;
	let nodes = [];

	while (s.pos < s.buf.length) {
		let node = _read_exp(s);

		if (nodes.length !== 0 && !node) {
			return _error(s, 'expected expression after comma');
		}

		if (node) nodes.push(node);
		_eat_whitespace(s);

		let code = _get_code(s);
		if (code === c.COMMA) {
			if (nodes.length === 0) {
				return _error(s, 'expected expression before comma');
			}

			s.pos++;
			continue;
		}
		else if (group && code === c.PAREN_CLOSE) {
			closed = true;
			s.pos++;
		}

		break;
	}

	if (group && nodes.length < 1) {
		return _error(s, 'expected expression within paren');
	}
	if (group && !closed) {
		return _error(s, 'expected paren close');
	}

	if (nodes.length < 2) {
		return nodes[0];
	}

	return {
		type: t.SEQUENCE,
		expressions: nodes,
		start: start,
		end: group ? s.pos : nodes[nodes.length - 1].end,
	};
}

function _read_exp (s) {
	let expression = _read_binary_exp(s);
	_eat_whitespace(s);

	// if binary exp: check ternary [?]
	if (_get_code(s) === c.QUESTION) {
		if (!expression) {
			return _error(s, 'expected test expression');
		}

		s.pos++;
		let consequent = _read_exp(s);
		if (!consequent) {
			return _error(s, 'expected consequent expression');
		}

		_eat_whitespace(s);
		if (_read_code(s) !== c.COLON) {
			return _error(s, 'expected colon');
		}

		let alternate = _read_exp(s);
		if (!alternate) {
			return _error(s, 'expected alternate expression');
		}

		return {
			type: t.CONDITIONAL,
			test: expression,
			consequent: consequent,
			alternate: alternate,
			start: expression.start,
			end: alternate.end,
		};
	}

	return expression;
}

function _read_binary_exp (s, def) {
	let lhs = def || _read_token(s);
	let op = _read_binary_op(s);

	if (!op) return lhs;

	let rhs = _read_token(s);

	if (!rhs) {
		return _error(s, 'expected right hand expression');
	}

	return _error(s, 'not supposed to be here yet');
}

function _read_binary_op (s) {
	_eat_whitespace(s);
	// what the fuck do i do here?
}

function _read_token (s) {
	_eat_whitespace(s);

	let code = _get_code(s);
	let node;

	if (code === c.PAREN_OPEN) {
		node = _read_sequence_exp(s, true);
	}
	else if (is_update_op(code, _get_code(s, 1))) {
		node = _read_prefix_update_exp(s);
	}
	else if (is_decimal_digit(code) || code === c.PERIOD) {
		node = _read_number_literal(s);
	}
	// else if (code === c.DOUBLE_QUOTE || code === c.SINGLE_QUOTE) {
	// 	return _read_string_literal(s);
	// }
	// else if (code === c.TILDA) {
	// 	return _read_template_literal(s);
	// }

	// object expression: [{]
	// array expression: [\[]

	else if (is_identifier_start(code)) {
		node = _read_identifier(s);
	}

	/// if node:
	if (node) {
		code = _get_code(s);

		// member expression: (\.|\?\.|\[)
		// call expression: [\(]

		if (is_update_op(code, _get_code(s, 1))) {
			return _read_postfix_update_exp(s, node);
		}
	}

	return node;
}


function _read_postfix_update_exp (s, node) {
	if (!is_update_op(_get_code(s), _get_code(s, 1))) {
		return _error(s, 'expected update operator');
	}
	if (node.type !== t.IDENTIFIER && node.type !== t.MEMBER) {
		return _error(s, 'expected identifier or member expression');
	}

	let operator = _read(s, 2);

	return {
		type: t.UPDATE,
		prefix: false,
		operator: operator,
		argument: node,
		start: node.start,
		end: s.pos,
	};
}

function _read_prefix_update_exp (s) {
	let start = s.pos;

	if (!is_update_op(_get_code(s), _get_code(s, 1))) {
		return _error(s, 'expected update operator');
	}

	let operator = _read(s, 2);
	let node = _read_token(s);

	if (node.type !== t.IDENTIFIER && node.type !== t.MEMBER) {
		return _error(s, 'expected identifier or member expression');
	}

	return {
		type: t.UPDATE,
		prefix: true,
		operator: operator,
		argument: node,
		start: start,
		end: s.pos,
	};
}

function _read_identifier (s) {
	let start = s.pos;

	if (!is_identifier_start(_get_code(s))) {
		return _error(s, 'expected start of identifier');
	}

	let name = _read_char(s);
	while (is_identifier_part(_get_code(s))) {
		name += _read_char(s);
	}

	if (name === 'this') {
		return {
			type: t.THIS,
			start: start,
			end: s.pos,
		};
	} else {
		return {
			type: t.IDENTIFIER,
			name: name,
			start: start,
			end: s.pos,
		};
	}
}

function _read_number_literal (s) {
	let start = s.pos;
	let raw = '';

	while (is_decimal_digit(_get_code(s)))	{
		raw += _read_char(s);
	}

	if (_get_code(s) == c.PERIOD) {
		raw += _read_char(s);

		if (!is_decimal_digit(_get_code(s))) {
			return _error(s, 'expected decimal digit');
		}

		while (is_decimal_digit(_get_code(s))) {
			raw += _read_char(s);
		}
	}

	// read exponent [eE]
	let code = _get_code(s);
	if (code === c.E_LOWER || code === c.E_UPPER) {
		raw += _read_char(s);

		// read exponent sign [+-]
		code = _get_code(s);
		if (code === c.PLUS || code === c.MINUS) {
			raw += _read_char(s);
		}

		// read exponent value
		if (!is_decimal_digit(_get_code(s))) {
			return _error(s, 'expected exponent value');
		}

		while (is_decimal_digit(_get_code(s)))	{
			raw += _read_char(s);
		}
	}

	return {
		type: t.LITERAL,
		value: parseFloat(raw),
		raw: raw,
		start: start,
		end: s.pos,
	};
}

function _read_string_literal (s) {
	let start = s.pos;
	let raw = '';
	let closed = false;
	let quot = _read_char(s);

	while (s.pos < s.buf.length) {

	}
}

function _read_template_literal (state) {
	let start = state.pos;
	let raw = '';
}


function _error (s, message, index = s.pos) {
	throw { name: 'ParserError', message, index };
}

function _eat_whitespace (s, required = false) {
	if (required && !is_whitespace(_get_code(s))) {
		return _error(s, 'expected whitespace');
	}

	while (is_whitespace(_get_code(s))) {
		s.pos++;
	}
}


function _get (s, length = 1) {
	return s.buf.slice(s.pos, s.pos + length);
}

function _get_char (s, offset = 0) {
	return s.buf.charAt(s.pos + offset);
}

function _get_code (s, offset = 0) {
	return s.buf.charCodeAt(s.pos + offset);
}

function _read (s, length = 1) {
	let match = _get(s, length);
	s.pos += length;
	return match;
}

function _read_char (s) {
	return s.buf.charAt(s.pos++);
}

function _read_code (s) {
	return s.buf.charCodeAt(s.pos++);
}


function from_code (code) {
	return String.fromCharCode(code);
}

function is_identifier_start (code) {
	return (
		// [a-z]
		(code >= 97 && code <= 122) ||
		// [A-Z]
		(code >= 65 && code <= 90) ||
		// [$_]
		(code === 36) || (code === 95) ||
		// non-ascii, !o
		(code >= 128 && !is_binary_op(code))
	);
}

function is_identifier_part (code) {
	return is_identifier_start(code) || is_decimal_digit(code);
}

function is_whitespace (code) {
	return (code == c.SPACE || code == c.TAB || code == c.LF || code == c.CR);
}

function is_decimal_digit (code) {
	return (code >= 48 && code <= 57);
}

function is_binary_op (code) {
	return (
		code === c.EQUAL
	);
}

function is_update_op (a, b) {
	return (
		// ++
		(a === c.PLUS && b === c.PLUS) ||
		// --
		(a === c.MINUS && b === c.MINUS)
	);
}

function get_escaped_char (code) {

}
