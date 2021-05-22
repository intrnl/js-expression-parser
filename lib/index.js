import { ExpressionParser } from './ExpressionParser.js';


function parse (buffer, position) {
	return new ExpressionParser(buffer, position).parse();
}

export { parse, ExpressionParser };
