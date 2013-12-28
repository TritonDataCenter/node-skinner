/*
 * skinner.js: aggregate multi-dimensional data points
 */

var mod_assert = require('assert');
var mod_jsprim = require('jsprim');

/* public interface */
exports.aggregate = skAggregate;
exports.linearBucketize = skLinearBucketize;
exports.logLinearBucketize = skLogLinearBucketize;
exports.makeLinearBucketizer = skMakeLinearBucketizer;
exports.makeLogLinearBucketizer = skMakeLogLinearBucketizer;

/*
 * Given a set of datapoints (described above), a list of fields representing a
 * decomposition, and an array of bucketizers for the numeric fields, compute
 * the value by adding fields which are not being decomposed.
 */
function skAggregate(datapts, decomps, bucketizers)
{
	var i, ndiscrete;

	if (arguments.length < 3) {
		bucketizers = {};

		if (arguments.length < 2)
			decomps = [];
	}

	for (i = 0; i < decomps.length; i++) {
		if (decomps[i] in bucketizers)
			break;
	}

	ndiscrete = i;
	for (; i < decomps.length; i++) {
		if (!(decomps[i] in bucketizers)) {
			throw (new Error('bucketized breakdowns must be ' +
			    'last, but found discrete breakdown ' +
			    JSON.stringify(decomps[i]) + ' after ' +
			    'bucketized breakdown ' +
			    JSON.stringify(decomps[ndiscrete])));
		}
	}

	return (mod_jsprim.flattenObject(
	    skComputeValueFrom(bucketizers, decomps, datapts, 0),
	    ndiscrete));
}

function skComputeValueFrom(bucketizers, decomps, datapts, i)
{
	var rv, key, fieldvalues, subdata, j;

	/*
	 * Simple case: scalar values.  Just add them up.
	 */
	if (i >= decomps.length) {
		return (datapts.reduce(function (sum, elt) {
			return (sum + elt['value']);
		}, 0));
	}

	if (decomps[i] in bucketizers) {
		/* numeric decompositions must be last */
		mod_assert.equal(i, decomps.length - 1);
		mod_assert.ok(decomps[i] in bucketizers);

		rv = [];
		for (j = 0; j < datapts.length; j++) {
			bucketizers[decomps[i]](rv,
			    datapts[j]['fields'][decomps[i]],
			    datapts[j]['value']);
		}

		return (rv);
	}

	rv = {};
	fieldvalues = {};
	for (j = 0; j < datapts.length; j++) {
		key = datapts[j]['fields'][decomps[i]];
		fieldvalues[key] = true;
	}

	/* XXX this is terribly inefficient */
	for (key in fieldvalues) {
		subdata = datapts.filter(function (elt) {
			return (elt['fields'][decomps[i]] == key);
		});

		rv[key] = skComputeValueFrom(bucketizers,
		    decomps, subdata, i + 1);
	}

	return (rv);
}

function skLinearBucketize(rv, value, card, step)
{
	var i, ent;

	for (i = 0; i < rv.length; i++) {
		if (value >= rv[i][0][0] && value <= rv[i][0][1]) {
			rv[i][1] += card;
			return;
		}

		if (value < rv[i][0][0])
			break;
	}

	mod_assert.ok(i == rv.length || value < rv[i][0][0]);
	mod_assert.ok(i === 0 || value > rv[i - 1][0][1]);

	ent = [ [ 0, 0 ], card ];
	ent[0][0] = Math.floor(value / step) * step;
	ent[0][1] = ent[0][0] + step - 1;
	rv.splice(i, 0, ent);
	return (rv);
}

function skLogLinearBucketize(rv, value, card, base, min, max, nbuckets)
{
	var i, ent, logbase, step, offset;

	for (i = 0; i < rv.length; i++) {
		if (value >= rv[i][0][0] && value <= rv[i][0][1]) {
			rv[i][1] += card;
			return;
		}

		if (value < rv[i][0][0])
			break;
	}

	mod_assert.ok(i == rv.length || value < rv[i][0][0]);
	mod_assert.ok(i === 0 || value > rv[i - 1][0][1]);

	ent = [ [ 0, 0 ], card ];

	if (value < Math.pow(base, min)) {
		ent[0][0] = 0;
		ent[0][1] = Math.pow(base, min);
	} else {
		logbase = skLogFloor(base, value);
		step = Math.pow(base, logbase + 1) / nbuckets;
		offset = value - Math.pow(base, logbase);

		ent[0][0] = Math.pow(base, logbase) +
		    (Math.floor(offset / step) * step);
		ent[0][1] = ent[0][0] + step - (step / base);
	}

	rv.splice(i, 0, ent);
	return (rv);
}

/*
 * Essentially computes Math.floor(logbase(base, value)), where
 * logbase(base, value) is the log-base-"base" of "value".
 */
function skLogFloor(base, input)
{
	var value, exp;

	exp = 0;
	value = input;
	for (exp = 0; value >= base; exp++)
		value /= base;

	return (exp);
}

function skMakeLinearBucketizer(step)
{
	return (function (rv, value, card) {
		return (skLinearBucketize(rv, value, card, step));
	});
}

function skMakeLogLinearBucketizer(base, min, max, nbuckets)
{
	return (function (rv, value, card) {
		return (skLogLinearBucketize(rv, value, card, base, min, max,
		    nbuckets));
	});
}
