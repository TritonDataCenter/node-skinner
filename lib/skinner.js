/*
 * skinner.js: Sum the values of the given data points, breaking out the results
 * by one or more fields.
 *
 *
 * DATA POINTS
 *
 * Each data point is represented as a JavaScript object with *fields*, which
 * are arbitrary key-value pairs, and a *value*.  For example, this data point
 * might represent 15 "GET" requests made on hostname "bigfoot" by user "dap":
 *
 *     {
 *         "value": 15,
 *         "fields": {
 *             "hostname": "bigfoot",
 *             "method": "GET",
 *             "user": "dap"
 *         }
 *     }
 *
 *
 * AGGREGATING DATA POINTS
 *
 * We can add a similar data point representing 18 "GET" requests by user "mark"
 * on hostname "sharptooth":
 *
 *    {
 *        "value": 18,
 *        "fields": {
 *            "hostname": "sharptooth",
 *            "method": "GET",
 *            "user": "mark"
 *        }
 *    }
 *
 * We can aggregate points by just adding the numbers in the "value" fields.
 * The result is a plain number: 33.
 *
 *
 * BREAKDOWNS
 *
 * We can also aggregate these points and break out the results by "hostname".
 * In that case, the value is an object rather than a single number.  The keys
 * of the object are all possible values of "hostname": in this case, "bigfoot"
 * and "sharptooth":
 *
 *     {
 *         "bigfoot": 15,
 *         "sharptooth": 18
 *     }
 *
 * We can instead break the result out by "user", in which case the keys are
 * "dap" and "mark", respectively.  Or we can break the result out by "method",
 * in which case we'd get only one key, since both data points had the same
 * value for "method":
 *
 *     {
 *         "GET": 33
 *     }
 *
 *
 * DISCRETE vs. NUMERIC FIELDS
 *
 * In these examples, "hostname", "user", and "method" are called *discrete*
 * fields because each value is totally distinct.  The "hostname" values
 * "bigfoot" and "sharptooth" cannot usefully be grouped together.
 *
 * By contrast, suppose we included a "latency" field.  This data point might
 * represent 1 GET request on hostname "bigfoot" by user "dap" that took 153ms:
 *
 *    {
 *        "value": 1,
 *        "fields": {
 *            "hostname": "bigfoot",
 *            "user": "dap",
 *            "method": "GET",
 *            "latency": 153
 *        }
 *    }
 *
 * If we treated "latency" the same way we treat "hostname" when we aggregate
 * data points, then we'd end up with an enormous result, since there are many
 * possible values of "latency".i  Instead, it's more useful to *bucketize*
 * latency by grouping close values into buckets.  If we combined that data
 * point with a similar one with latency 156, and grouped latency values into
 * 10ms buckets, the result would be:
 *
 *     [
 *         [ [ 150, 159 ], 2 ]
 *     ]
 *
 * This denotes "two requests in the 150-159ms bucket."  If we had another
 * request that took 133ms, we could aggregate that with the previous two to
 * get:
 *
 *     [
 *         [ [ 130, 139 ], 1 ],
 *         [ [ 150, 159 ], 2 ]
 *     ]
 *
 *
 * MULTI-DIMENSIONAL BREAKDOWNS
 *
 * So far we've looked at aggregating data points:
 *
 *   o with no breakdown (yields a number),
 *
 *   o with a breakdown on a discrete field (which yields an object with
 *     key-value pairs, where values are numbers), and
 *
 *   o with a breakdown on a numeric field (which yields an array of buckets,
 *     each bucket containing a [start, end) pair and a number).
 *
 * We can generalize this to break out results by more than one field.  For
 * example, we can break down the first example by "hostname" *and* "user", in
 * which case we'd get:
 *
 *     {
 *         "bigfoot": {
 *             "dap": 15
 *         },
 *         "sharptooth": {
 *             "mark": 18
 *         }
 *     }
 *
 * Or we could break down by "method" and "hostname", in which case there would
 * be only one entry in the top-level object:
 *
 *    {
 *        "GET": {
 *            "bigfoot": 15,
 *            "sharptooth": 18
 *        }
 *    }
 *
 * The order of breakdowns matters.  If you break down by "hostname" and then
 * "method", you'd get a different object:
 *
 *    {
 *        "bigfoot": {
 *            "GET": 15
 *        },
 *        "sharptooth": {
 *            "GET": 18
 *        }
 *    }
 *
 * We can even break down by "hostname" and "latency".  For the second example,
 * this would yield:
 *
 *    {
 *        "bigfoot": [
 *            [ [ 130, 139 ], 1 ],
 *            [ [ 150, 159 ], 2 ]
 *        ]
 *    }
 *
 * We can use this approach to support aggregating data points with any number
 * of breakdowns.  This implementation supports an arbitrary number of discrete
 * breakdowns, but imposes two constraints on numeric breakdowns:
 *
 *     o There must be at most one numeric breakdown.
 *
 *     o The numeric breakdown must be the last breakdown.
 *
 * These constraints could be removed, but those use cases haven't been useful
 * (yet) and the natural representations for those cases are fairly complex to
 * work with.
 *
 *
 * FLATTENED RESULTS
 *
 * For multi-dimensional breakdowns, it's usually more convenient to work with a
 * flattened representation, which looks like this:
 *
 *     break down by: "hostname", "method"
 *             value: [ [ "bigfoot",    "GET",  15 ],
 *                      [ "sharptooth", "GET",  18 ] ]
 *
 * Internally, we avoid converting to the final representation until we've
 * computed everything else, since it's easier to modify the unflattened
 * version.
 */

var mod_assert = require('assert');
var mod_jsprim = require('jsprim');
var mod_stream = require('stream');
var mod_util = require('util');

/* public interface */
exports.aggregate = skAggregate;
exports.createAggregator = skCreateAggregator;
exports.linearBucketize = skLinearBucketize;
exports.logLinearBucketize = skLogLinearBucketize;
exports.makeLinearBucketizer = skMakeLinearBucketizer;
exports.makeLogLinearBucketizer = skMakeLogLinearBucketizer;

/*
 * Function interface for aggregating a fixed number of data points.  This
 * returns the result of aggregating points "datapts", breaking out the results
 * by the fields named in "decomps" using bucketizers "bucketizers".  See
 * Aggregator for details.
 */
function skAggregate(datapts, decomps, bucketizers)
{
	var aggregator;

	aggregator = new skAggregator({
	    'decomps': decomps,
	    'bucketizers': bucketizers
	});
	aggregator.read(0);
	datapts.forEach(function (p) { aggregator.write(p); });
	aggregator.end();
	return (aggregator.result());
}

/*
 * An Aggregator is an object-mode streaming interface for aggregating data
 * points.  You preconfigure the set of breakdowns you want to maintain and then
 * write() data points to the stream.  Data points are described in the block
 * comment above.  When you end the stream, it emits an object representing the
 * flattened sum of points received, broken out by the preconfigured fields.  At
 * any point, you can also get that sum using the result() method.
 *
 * To construct this object, you may specify:
 *
 *    decomps		Array of field names for breakdowns.  As discussed
 *    			above, there may be any number of discrete fields here
 *    			followed by at most one numeric field.  Numeric fields
 *    			must be also present in "bucketizers".  You can leave
 *    			this out if you just want a simple sum.
 *
 *    bucketizers	Object mapping numeric field names to a bucketizing
 *    			function.  A field is considered numeric iff it has an
 *    			entry in "bucketizers".  You can leave this out if you
 *    			have no numeric fields.
 *
 *    streamOptions	Options to pass through to Node's Stream constructor.
 */
function skCreateAggregator(args)
{
	return (new skAggregator(args));
}

function skAggregator(args)
{
	var streamoptions, i;

	mod_assert.equal(typeof (args), 'object');
	mod_assert.ok(args !== null);

	if (args.decomps)
		mod_assert.ok(Array.isArray(args.decomps));

	if (args.bucketizers) {
		mod_assert.ok(typeof (args.bucketizers) == 'object');
		mod_assert.ok(args.bucketizers !== null);
	}

	streamoptions = {};
	if (args.streamOptions) {
		mod_assert.equal(typeof (args.streamOptions), 'object');
		mod_assert.ok(args.streamOptions !== null);
		for (i in args.streamOptions)
			streamoptions[i] = args.streamOptions[i];
	}
	streamoptions['objectMode'] = true;
	mod_stream.Transform.call(this, streamoptions);

	this.sa_decomps = args.decomps ? args.decomps.slice(0) : [];
	this.sa_bucketizers = args.bucketizers || {};

	for (i = 0; i < this.sa_decomps.length; i++) {
		if (this.sa_decomps[i] in this.sa_bucketizers)
			break;
	}

	this.sa_ndiscrete = i;

	for (; i < this.sa_decomps.length; i++) {
		if (!(this.sa_decomps[i] in this.sa_bucketizers)) {
			throw (new Error('bucketized breakdowns must be ' +
			    'last, but found discrete breakdown ' +
			    JSON.stringify(this.sa_decomps[i]) + ' after ' +
			    'bucketized breakdown ' +
			    JSON.stringify(
			    this.sa_decomps[this.sa_ndiscrete])));
		}
	}

	if (this.sa_decomps.length === 0)
		this.sa_value = 0;
	else if (this.sa_discrete > 0)
		this.sa_value = {};
	else
		this.sa_value = [];
}

mod_util.inherits(skAggregator, mod_stream.Transform);

skAggregator.prototype._transform = function (datapt, _, callback)
{
	var i, prev, o, field, fieldvalue, bucketizer;

	mod_assert.equal(typeof (datapt), 'object');
	mod_assert.ok(datapt !== null);
	mod_assert.equal(typeof (datapt['value']), 'number');

	/*
	 * Recall that we store the current accumulated value as a tree, where
	 * the keys at level "i" (from the top) denote the values of field "i"
	 * in the decomposition list that we've seen so far.  To find the value
	 * that we need to update, we construct a path through the tree based on
	 * the field values for this data point.  Specifically, we walk the list
	 * of decomposition fields, pull out the corresponding value of that
	 * field from this data point, and use that value to descend in the
	 * tree.  If we need a node that doesn't exist, we create it here.
	 *
	 *
	 * In each iteration, "o" denotes where we are currently in the tree,
	 * and "prev" refers to its parent.  At the end of this loop, "o" refers
	 * to the leaf value that we'd like to update.  (We wouldn't need "prev"
	 * at all if we could update numbers by reference, but we need it to
	 * update the leaf by updating the corresponding property of its
	 * parent.)
	 */
	prev = null;
	o = this.sa_value;
	for (i = 0; i < this.sa_ndiscrete; i++) {
		mod_assert.equal(typeof (o), 'object');
		mod_assert.ok(o !== null);
		field = this.sa_decomps[i];
		fieldvalue = datapt['fields'][field];
		prev = o;

		if (o.hasOwnProperty(fieldvalue)) {
			/* The node already exists.  Descend into the tree. */
			o = o[fieldvalue];
			continue;
		}

		/*
		 * This is the first time we've seen this value for this field,
		 * so create a "zero" node for it and then descend into that
		 * node.
		 */
		if (i < this.sa_ndiscrete - 1)
			o[fieldvalue] = {};
		else if (this.sa_ndiscrete < this.sa_decomps.length)
			o[fieldvalue] = [];
		else
			o[fieldvalue] = 0;

		o = o[fieldvalue];
	}

	if (i < this.sa_decomps.length) {
		/*
		 * We only descend to the last discrete decomposition level.  If
		 * there's a numeric decomposition after that, then just pass
		 * the current value to the appropriate bucketizer, which will
		 * update it in place.
		 */
		field = this.sa_decomps[i];
		fieldvalue = datapt['fields'][field];
		mod_assert.ok(this.sa_bucketizers.hasOwnProperty(field));
		mod_assert.ok(Array.isArray(o));
		bucketizer = this.sa_bucketizers[field];
		bucketizer(o, fieldvalue, datapt['value']);
	} else if (this.sa_decomps.length > 0) {
		/*
		 * Otherwise, if there was at least one discrete decomposition,
		 * then update the value by updating the corresponding key of
		 * its parent.
		 */
		mod_assert.equal(typeof (o), 'number');
		mod_assert.ok(prev[fieldvalue] === o);
		prev[fieldvalue] += datapt['value'];
	} else {
		/* Otherwise, sa_value is a number, so just increment it. */
		mod_assert.ok(this.sa_value === o);
		mod_assert.equal(typeof (this.sa_value), 'number');
		this.sa_value += datapt['value'];
	}

	callback();
};

skAggregator.prototype._flush = function (callback)
{
	this.push(this.result());
	callback();
};

skAggregator.prototype.result = function ()
{
	return (mod_jsprim.flattenObject(this.sa_value, this.sa_ndiscrete));
};


/*
 * Bucketizers
 */

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
