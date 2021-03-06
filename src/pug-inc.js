import idom from 'incremental-dom';
import lexer from 'pug-lexer';
import parser from 'pug-parser';
import voidElts from 'void-elements';
import R from 'ramda';

/**
 * elementOpen(tagname, tracking key, static propValArr, propValArr)
 * elementVoid(tagname, tracking key, static propValArr, propValArr)
 * elementClose(tagname)
 * text(text)
 */

export const fixIdom = fn => (tagname, key, staticProp, rest) =>
	fn.apply(undefined, [tagname, key, staticProp].concat(rest));
export const elementOpen = fixIdom(idom.elementOpen);
export const elementClose = idom.elementClose;
export const elementVoid = fixIdom(idom.elementVoid);
export const text = (str, formatters = []) => idom.text.apply(undefined, [str].concat(formatters));

/**
 * Incremental dom backed pug templates
 */

/**
 * Pug node types
 * @enum {String}
 * @readonly
 */
const PugNodeType = {
	Block: 'Block',
	Tag: 'Tag',
	Text: 'Text',
	Code: 'Code',
	Each: 'Each',
	Conditional: 'Conditional',
};


/**
 * @typedef {Object} PugNode
 * @prop {PugNodeType} type
 */


/**
 * Checks if a given pug node should be a voidElt
 * @param {PugNode} node
 * @returns {Boolean}
 */
const isVoidElt = (node) =>
	node.selfClosing ||
	(
		node.type === PugNodeType.Tag &&
		voidElts[node.name.toLowerCase()]
	);

const attrToValue = ({ val }, props) => {
	if (R.is(String, val)) {
		if (val.startsWith('"') || val.startsWith('\'')) {
			return val.slice(1, -1);
		} else {
			return R.path(val.split('.'), props);
		}
	}
	return val;
};

const isEventAttr = (attr) => {
	return attr.startsWith('on');
};

/**
 * Parses an attribute list and produces pairs of args to bind
 * onto the incremental-dom element open calls
 *
 * @param {PugNode[]} attrs
 * @param {Object} props - The props object to use when parsing attrs
 * @returns {ParsedAttrs}
 */
const parseAttrs = (attrs, props) => {
	const staticAttrs = [];
	const dynamicAttrs = [];

	const {
		classes,
		events,
		rest,
	} = R.reduce(
		(acc, x) => {
			const token = x.name.toLowerCase();
			if (isEventAttr(token)) {
				acc.events.push(x);
			} else if (token === 'class') {
				acc.classes.push(x);
			} else if (token.startsWith('...')) {
				const src = R.path(x.name.slice(3).split('.'), props);
				staticAttrs.push(...R.flatten(R.toPairs(src)));
			} else {
				acc.rest.push(x);
			}

			return acc;
		},
		{ events: [], classes: [], rest: [] },
		attrs
	);

	if (classes.length) {
		staticAttrs.push('class', classes.map(attrToValue).join(' '));
	}

	if (events.length) {
		events.forEach(
			x => dynamicAttrs.push(x.name, R.path(x.val.split('.'), props))
		);
	}

	if (rest.length) {
		rest.forEach(
			x => staticAttrs.push(x.name, attrToValue(x, props))
		);
	}

	return {
		dynamicAttrs,
		staticAttrs,
	};
};


/**
 * Incremental dom render function to pass into 'patch'
 * Takes a props object to bind into the state model
 *
 * @typedef {Function} Renderer
 * @param {Object} props
 * @returns {void}
 */


const toAst = R.pipe(lexer, parser);


/**
 * Compile a pug AST into an incremental-dom update function
 *
 * @param {PugNode} ast
 * @returns {Renderer}
 */
export const astToRenderer = (ast) => {

	// "Compiled" function for now is a list of thunks to run
	const commands = [];

	// @todo: pivitol parts of state model changing / extraction
	// @todo: this can be so optimized.
	// @todo: static parts of the tree can stay fine
	// @todo: determine where my code goes to generate a sexy idom loop

	// Recurssive crawl of the pug AST
	(function recurse(node, parent) {
		switch (node.type) {
			case PugNodeType.Block:
				node.nodes.forEach(x => recurse(x, node));
				break;

			case PugNodeType.Tag: {
				// @todo: can compile args as a separate function -- precompute paths, etc
				commands.push((props) => {
					const { staticAttrs, dynamicAttrs } = parseAttrs(node.attrs, props);

					// @todo: figure out how to pass key in
					const args = [node.name, undefined, staticAttrs, dynamicAttrs];
					if (isVoidElt(node)) {
						elementVoid.apply(undefined, args);
					} else {
						elementOpen.apply(undefined, args);
					}
				});

				if (node.block) {
					node.block.nodes.forEach(x => recurse(x, node));
				}

				if (!isVoidElt(node)) {
					commands.push(() => elementClose(node.name));
				}
			}
				break;
				
			case PugNodeType.Conditional: {
				// @todo: exec? compile? allow it or just paths?
				const internalCompiled = astToRenderer(node.consequent);
				const getPropFn = R.path(node.test.split('.'));
				commands.push((props) => getPropFn(props) ? internalCompiled(props) : 0);
				break;
			}

			case PugNodeType.Text:
				commands.push(() => text(node.val));
				break;

			case PugNodeType.Code:
				// @todo: this is one of the only times we depend on props...
				// @todo: only paths for now?
				if (
					parent.type === PugNodeType.Tag ||
					parent.type === PugNodeType.Block
				) {
					// Interpret as interpolated text
					const path = node.val.split('.');
					commands.push((props) => text(R.path(path, props)));
				} else {
					console.debug('Parent is not tag?!!', node, parent);
				}
				break;

			case PugNodeType.Each: {
				// @todo: sub-compile
				const internalCompiled = astToRenderer(node.block);
				const itereePath = node.obj.split('.');
				const itereeKey = node.key || '__key__';
				const itereeVal = node.val || '__val__';

				commands.push((props) => {
					const obj = R.pathOr({}, itereePath, props);
					R.forEachObjIndexed((val, key) => {
						internalCompiled({
							...props,
							[itereeVal]: val,
							[itereeKey]: key,
						});
					}, obj);
				});
				break;
			}

			default:
				console.debug('Walking: ', node, 'from', parent);
				console.error('unhandled.');
		}
	}(ast, undefined));

	// The compiled fn list, injecting props
	return (props) => commands.forEach(cmd => cmd(props));
};

/**
 * Helper to parse pug template strings, since that's what
 * I'm using here
 */
export const compile = R.pipe(lexer, parser, astToRenderer);
