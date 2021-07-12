'use strict';
const {getStaticValue} = require('eslint-utils');

// Copied from https://github.com/eslint/eslint/blob/c3e9accce2f61b04ab699fd37c90703305281aa3/lib/rules/utils/ast-utils.js#L379

/**
Gets the property name of a given node.
The node can be a MemberExpression, a Property, or a MethodDefinition.

If the name is dynamic, this returns `null`.

For examples:

	a.b		   // => "b"
	a["b"]		// => "b"
	a['b']		// => "b"
	a[`b`]		// => "b"
	a[100]		// => "100"
	a[b]		  // => null
	a["a" + "b"]  // => null
	a[tag`b`]	 // => null
	a[`${b}`]	 // => null

	let a = {b: 1}			// => "b"
	let a = {["b"]: 1}		// => "b"
	let a = {['b']: 1}		// => "b"
	let a = {[`b`]: 1}		// => "b"
	let a = {[100]: 1}		// => "100"
	let a = {[b]: 1}		  // => null
	let a = {["a" + "b"]: 1}  // => null
	let a = {[tag`b`]: 1}	 // => null
	let a = {[`${b}`]: 1}	 // => null
@param {ASTNode} node The node to get.
@returns {string|undefined} The property name if static. Otherwise, undefined.
*/
function getStaticPropertyName(node) {
	let property;

	switch (node && node.type) {
		case 'MemberExpression':
			property = node.property;
			break;

		/* istanbul ignore next: Hard to test */
		case 'ChainExpression':
			return getStaticPropertyName(node.expression);

		/* istanbul ignore next: Only reachable when use this to get class/object member key */
		case 'Property':
		case 'MethodDefinition':
			/* istanbul ignore next */
			property = node.key;
			/* istanbul ignore next */
			break;

			// No default
	}

	if (property) {
		if (property.type === 'Identifier' && !node.computed) {
			return property.name;
		}

		const staticResult = getStaticValue(property);
		if (!staticResult) {
			return;
		}

		return String(staticResult.value);
	}
}

/**
Check if two literal nodes are the same value.
@param {ASTNode} left The Literal node to compare.
@param {ASTNode} right The other Literal node to compare.
@returns {boolean} `true` if the two literal nodes are the same value.
*/
function equalLiteralValue(left, right) {
	// RegExp literal.
	if (left.regex || right.regex) {
		return Boolean(
			left.regex &&
			right.regex &&
			left.regex.pattern === right.regex.pattern &&
			left.regex.flags === right.regex.flags,
		);
	}

	// BigInt literal.
	if (left.bigint || right.bigint) {
		return left.bigint === right.bigint;
	}

	return left.value === right.value;
}

/**
Check if two expressions reference the same value. For example:
	a = a
	a.b = a.b
	a[0] = a[0]
	a['b'] = a['b']
@param {ASTNode} left The left side of the comparison.
@param {ASTNode} right The right side of the comparison.
@returns {boolean} `true` if both sides match and reference the same value.
*/
function isSameReference(left, right) {
	if (left.type !== right.type) {
		// Handle `a.b` and `a?.b` are samely.
		if (left.type === 'ChainExpression') {
			return isSameReference(left.expression, right);
		}

		if (right.type === 'ChainExpression') {
			return isSameReference(left, right.expression);
		}

		return false;
	}

	switch (left.type) {
		case 'Super':
		case 'ThisExpression':
			return true;

		case 'Identifier':
			return left.name === right.name;

		case 'Literal':
			return equalLiteralValue(left, right);

		case 'ChainExpression':
			return isSameReference(left.expression, right.expression);

		case 'MemberExpression': {
			const nameA = getStaticPropertyName(left);

			// X.y = x["y"]
			return (
				typeof nameA !== 'undefined' &&
				isSameReference(left.object, right.object) &&
					nameA === getStaticPropertyName(right)
			);
		}

		default:
			return false;
	}
}

module.exports = isSameReference;
