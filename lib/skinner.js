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
 *     {
 *         150: 2
 *     }
 *
 * This denotes "two requests in the 150-159ms bucket."  If we had another
 * request that took 133ms, we could aggregate that with the previous two to
 * get:
 *
 *     {
 *         130: 1,
 *         150: 2
 *     }
 *
 *
 * MULTI-DIMENSIONAL BREAKDOWNS
 *
 * So far we've looked at aggregating data points:
 *
 *   o with no breakdown (yields a number),
 *
 *   o with a breakdown on a discrete or quantized numeric field (which yields
 *     an object with key-value pairs, where values are numbers)
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
 * We can break down by "hostname" and "latency".  For the second example, this
 * would yield:
 *
 *    {
 *        "bigfoot": {
 *            130: 1,
 *            150: 2
 *        }
 *    }
 *
 * We can use this approach to support aggregating data points with any number
 * of breakdowns.
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
 *
 *
 * ORDINAL vs. VALUE FORM
 *
 * The above examples of quantized numeric values use the *value form*.  In this
 * form, each bucket is represented with the numeric value of the minimum value
 * in that bucket.
 *
 *     { 4: 10378 }
 *
 * denotes "10378 entries in the range between 4 and 7, inclusive".  This
 * form is sparse in that any buckets with no entries will not be represented,
 * so you may have:
 *
 *     {
 *         4:, 10378,
 *         16: 352
 *     }
 *
 * in the case that there were no entries between 8 and 15.  This form balances
 * readability with efficiency.  It's more readable for humans, and it's also
 * useful for generating some kinds of plots.
 *
 * For other use cases, particularly where a non-sparse representation is needed
 * (as when printing to a terminal), it's more useful to refer to each bucket by
 * its *ordinal* index.  A non-sparse representation of the above is:
 *
 *    {
 *         0:     0,
 *         1:     0,
 *         2:     0,
 *         4: 10378,
 *         8:     0,
 *        16:   352
 *    }
 *
 * The *ordinal* representation looks like this:
 *
 *    {
 *        3: 10378,
 *        5: 352
 *    }
 *
 * Each bucketizer provides a separate function for mapping the ordinal number
 * to the bucket range (e.g., mapping 3 to [4, 7]).
 */

var mod_assert = require('assert');
var mod_jsprim = require('jsprim');
var mod_stream = require('stream');
var mod_util = require('util');
var VError = require('verror');

/* public interface */
exports.aggregate = skAggregate;
exports.createAggregator = skCreateAggregator;
exports.makeLinearBucketizer = skMakeLinearBucketizer;
exports.makeLogLinearBucketizer = skMakeLogLinearBucketizer;
exports.makeP2Bucketizer = skMakeP2Bucketizer;
exports.ordinalToBounds = skOrdinalToBounds;

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
	datapts.forEach(function (p) { aggregator.aggregate(p); });
	aggregator.end();
	aggregator.read(0);
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
 *    decomps		Array of field names for breakdowns.  Numeric fields
 *    			must be also present in "bucketizers".  You can leave
 *    			this out if you just want a simple sum.
 *
 *    bucketizers	Object mapping numeric field names to a bucketizing
 *    			function.  A field is considered numeric iff it has an
 *    			entry in "bucketizers".  You can leave this out if you
 *    			have no numeric fields.
 *
 *    resultsAsPoints	If true, the results are emitted as data points suitable
 *    			for passing into another skinner-like aggregator (rather
 *    			than the default format, which is more suitable for
 *    			reporting).
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

	streamoptions = { 'highWaterMark': 0 };
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
	this.sa_aspoints = args.resultsAsPoints ? true : false;
	this.sa_nrecords = 0;
	this.sa_nnonnumeric = 0;
	this.sa_nparsed = 0;

	if (this.sa_decomps.length === 0)
		this.sa_value = 0;
	else
		this.sa_value = {};
}

mod_util.inherits(skAggregator, mod_stream.Transform);

skAggregator.prototype.stats = function ()
{
	return ({
	    'ninputs': this.sa_nrecords,
	    'nparsed': this.sa_nparsed,
	    'nerr_nonnumeric': this.sa_nnonnumeric
	});
};

skAggregator.prototype._transform = function (datapt, _, callback)
{
	this.aggregate(datapt);
	setImmediate(callback);
};

skAggregator.prototype.aggregate = function (datapt)
{
	var i, prev, o, field, fieldvalue, bucketizer;

	this.sa_nrecords++;
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
	 * In each iteration, "o" denotes where we are currently in the tree,
	 * and "prev" refers to its parent.  At the end of this loop, "o" refers
	 * to the leaf value that we'd like to update.  (We wouldn't need "prev"
	 * at all if we could update numbers by reference, but we need it to
	 * update the leaf by updating the corresponding property of its
	 * parent.)
	 */
	prev = null;
	o = this.sa_value;
	for (i = 0; i < this.sa_decomps.length; i++) {
		mod_assert.equal(typeof (o), 'object');
		mod_assert.ok(o !== null);
		field = this.sa_decomps[i];
		fieldvalue = mod_jsprim.pluck(datapt['fields'], field);
		prev = o;

		if (this.sa_bucketizers.hasOwnProperty(field)) {
			if (typeof (fieldvalue) == 'string') {
				this.sa_nparsed++;
				fieldvalue = parseFloat(fieldvalue);
			}

			if (typeof (fieldvalue) != 'number' ||
			    isNaN(fieldvalue)) {
				this.sa_nnonnumeric++;
				this.emit('invalid_object', datapt, new VError(
				    'value for field "%s" is not a number',
				    field), this.sa_nrecords);
				return;
			}

			bucketizer = this.sa_bucketizers[field];
			/* XXX private */
			fieldvalue = bucketizer._valueToBucketIndex(fieldvalue);
		}

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
		if (i < this.sa_decomps.length - 1)
			o[fieldvalue] = {};
		else
			o[fieldvalue] = 0;

		o = o[fieldvalue];
	}

	if (this.sa_decomps.length > 0) {
		/*
		 * If there was at least one decomposition, then update the
		 * value by updating the corresponding key of its parent.
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
};

skAggregator.prototype._flush = function (callback)
{
	if (!this.sa_aspoints) {
		this.push(this.result());
		callback();
		return;
	}

	var self, bucketizer;

	self = this;
	flattenIter(this.sa_value, this.sa_decomps.length, [], function (row) {
		var point, i, val, field;

		point = {
		    'fields': {},
		    'value': 0
		};

		for (i = 0; i < self.sa_decomps.length; i++) {
			field = self.sa_decomps[i];

			if (self.sa_bucketizers.hasOwnProperty(field)) {
				bucketizer = self.sa_bucketizers[field];

				/*
				 * The "+" conversion is necessary because the
				 * value has been turned into a string by virtue
				 * of using it as an object key.  bucketMin()
				 * (reasonably) assumes its input is numeric.
				 */
				val = bucketizer.bucketMin(+row[i]);
			} else {
				val = row[i];
			}

			point.fields[self.sa_decomps[i]] = val;
		}

		mod_assert.equal(i, row.length - 1);
		mod_assert.equal(typeof (row[i]), 'number');
		point.value = row[i];
		self.push(point);
	});

	callback();
};

skAggregator.prototype.result = function ()
{
	var self, rv;

	self = this;
	rv = mod_jsprim.flattenObject(this.sa_value,
	    this.sa_decomps.length);
	rv.forEach(function (row) {
		var i, field;

		/*
		 * Convert numeric values that were turned into strings back
		 * into numbers.
		 */
		for (i = 0; i < self.sa_decomps.length; i++) {
			field = self.sa_decomps[i];
			if (!self.sa_bucketizers.hasOwnProperty(field))
				continue;

			row[i] = +row[i];
		}
	});
	return (rv);
};


/*
 * Bucketizers.  skBucketizer is an abstract class.  Child classes must
 * implement the almost-inverse functions:
 *
 *     _bucketIndexToMin(bidx)		returns the minimum value in bucket
 *     					number "bidx"
 *
 *     _valueToBucketIndex(value)	returns the bucket index containing
 *     					value "value"
 *
 * Internally, distributions are stored in compact form (see above), and only
 * buckets that have had non-zero values will be included.  The interfaces here
 * differ from the corresponding DTrace distributions in that they have no "min"
 * and "max" arguments, but rather grow as needed.  (This also means they cannot
 * be clamped at either end the way DTrace distributions always are.  If useful,
 * we could add support for that.)
 */
function skBucketizer()
{
	mod_assert.equal(typeof (this._bucketIndexToMin), 'function',
	    'children of "skBucketizer" must implement _bucketIndexToMin');
	mod_assert.equal(typeof (this._valueToBucketIndex), 'function',
	    'children of "skBucketizer" must implement _valueToBucketIndex');
}

/*
 * Returns the minimum value contained in bucket "i".
 */
skBucketizer.prototype.bucketMin = function (i)
{
	mod_assert.ok(i >= 0);
	return (this._bucketIndexToMin(i));
};

/*
 * Returns an approximation of the maximum value contained in bucket "i".
 * This should never be used programmatically.  The problem is that we're
 * representing partitions over a continuous range (JavaScript numbers), and
 * traditionally the max was supposed to be exclusive (unless equal to the min).
 * To try to emulate the legacy behavior, we check whether the interval of size
 * at least 1.  In that case, the bucketMax is the *next* bucket's minimum,
 * minus 1.  Otherwise, the bucketMax is some small amount less than the next
 * bucket's minimum.
 */
skBucketizer.prototype.bucketMax = function (i)
{
	var min, nextmin;

	mod_assert.ok(i >= 0);
	min = this._bucketIndexToMin(i);
	mod_assert.ok(min >= 0);
	nextmin = this._bucketIndexToMin(i + 1);
	mod_assert.ok(nextmin > min);

	if (nextmin - min >= 1)
		return (nextmin - 1);

	return (nextmin - ((nextmin - min) / 10));
};

/*
 * Given a distribution "rv", a value in the distribution "value" (which
 * identifies a bucket within the distribution), and the cardinality of data
 * points "card" to add to the corresponding bucket, update the distribution in
 * place.
 */
skBucketizer.prototype.bucketize = function (rv, value, card)
{
	var i, ent, bmin, bmax, bidx;

	mod_assert.ok(Array.isArray(rv));
	mod_assert.equal(typeof (value), 'number');
	mod_assert.equal(typeof (card), 'number');
	mod_assert.ok(!isNaN(value) && !isNaN(card));

	for (i = 0; i < rv.length; i++) {
		bmin = this.bucketMin(rv[i][0]);
		bmax = this.bucketMin(rv[i][0] + 1);

		if (value >= bmin && value < bmax) {
			rv[i][1] += card;
			return;
		}

		if (value < bmin)
			break;
	}

	mod_assert.ok(i == rv.length || value < bmin);
	mod_assert.ok(i === 0 || value >= this.bucketMin(rv[i - 1][0] + 1));
	bidx = this._valueToBucketIndex(value);
	mod_assert.ok(value >= this.bucketMin(bidx));
	mod_assert.ok(value < this.bucketMin(bidx + 1));
	ent = [ bidx, card ];
	rv.splice(i, 0, ent);
	return (rv);
};

/*
 * Linear bucketizers group numbers into buckets of size "step".
 */
function skLinearBucketizer(step)
{
	this.lb_step = step;
	skBucketizer.call(this);
}

mod_util.inherits(skLinearBucketizer, skBucketizer);

skLinearBucketizer.prototype._bucketIndexToMin = function (bidx)
{
	return (this.lb_step * bidx);
};

skLinearBucketizer.prototype._valueToBucketIndex = function (value)
{
	return (Math.floor(value / this.lb_step));
};

/*
 * Log-linear bucketizers divide each order of "base" into buckets of size
 * "step" (or less, for orders of magnitude less than "step").  Consider a
 * base-10 log-linear bucketizer with nbuckets = 20.  Then the first ten buckets
 * range from [0, 10); the next twenty buckets range from [10, 100) by 5; the
 * next twenty buckets range from [100, 1000) by 50; and so on.  This
 * distribution's size scales like an exponential one, with the precision of
 * the linear one within each order of magnitude.
 */
function skLogLinearBucketizer(base, nbuckets)
{
	var maxorder;

	mod_assert.ok(nbuckets % base === 0,
	    '"base" must evenly divide "nbuckets"');

	for (maxorder = base; maxorder < nbuckets; maxorder *= base)
		continue;
	mod_assert.ok(maxorder % nbuckets === 0,
	    '"nbuckets" must evenly divide a power of "base"');

	skBucketizer.call(this);
	this.lb_base = base;
	this.lb_nbuckets = nbuckets;
}

mod_util.inherits(skLogLinearBucketizer, skBucketizer);

skLogLinearBucketizer.prototype._valueToBucketIndex = function (value)
{
	var totbuckets;		/* bucket index reached so far */
	var maxorder;		/* maximum value in the current magnitude */
	var prevorder;		/* maximum value in previous magnitude */
	var orderbuckets;	/* number of buckets in this magnitude */
	var prevbuckets;	/* number of buckets in lower magnitudes */
	var uniquebuckets;	/* number of buckets unique to this magnitude */
	var stepsize;		/* linear step size in last magnitude */

	totbuckets = 0;
	prevorder = 0;
	maxorder = this.lb_base;
	while (value >= maxorder) {
		orderbuckets = Math.min(maxorder, this.lb_nbuckets);
		if (prevorder === 0) {
			uniquebuckets = orderbuckets;
		} else {
			prevbuckets = orderbuckets / this.lb_base;
			uniquebuckets = orderbuckets - prevbuckets;
		}

		prevorder = maxorder;
		totbuckets += uniquebuckets;
		maxorder *= this.lb_base;
	}

	orderbuckets = Math.min(maxorder, this.lb_nbuckets);
	stepsize = maxorder / orderbuckets;
	totbuckets += Math.floor((value - prevorder) / stepsize);
	return (totbuckets);
};

skLogLinearBucketizer.prototype._bucketIndexToMin = function (bidx)
{
	var i;			/* bucket index reached so far, always the */
				/* start of an order of magnitude */
	var minorder;		/* minimum value in magnitude "i" */
	var maxorder;		/* maximum value in magnitude "i" */
	var orderbuckets;	/* number of buckets in this magnitude */
	var prevbuckets;	/* number of buckets in lower magnitudes */
	var uniquebuckets;	/* number of buckets unique to this magnitude */
	var bucketsize;		/* linear step size in last magnitude */

	i = 0;
	minorder = 0;
	maxorder = this.lb_base;
	for (;;) {
		orderbuckets = Math.min(maxorder, this.lb_nbuckets);
		if (i === 0) {
			uniquebuckets = orderbuckets;
		} else {
			prevbuckets = orderbuckets / this.lb_base;
			uniquebuckets = orderbuckets - prevbuckets;
		}

		if (i + uniquebuckets > bidx)
			break;

		minorder = maxorder;
		maxorder *= this.lb_base;
		i += uniquebuckets;
	}

	mod_assert.ok(i + uniquebuckets > bidx);
	mod_assert.ok(i <= bidx);
	bucketsize = maxorder / orderbuckets;
	return (minorder + Math.floor((bidx - i) * bucketsize));
};


/*
 * Power-of-two bucketizers group numers into the nearest power-of-two order of
 * magnitude.
 */
function skP2Bucketizer()
{
	skBucketizer.call(this);
}

mod_util.inherits(skP2Bucketizer, skBucketizer);

skP2Bucketizer.prototype._bucketIndexToMin = function (bidx)
{
	return (bidx === 0 ? 0 : Math.pow(2, bidx - 1));
};

skP2Bucketizer.prototype._valueToBucketIndex = function (value)
{
	var thresh, count;

	if (value === 0)
		return (0);

	thresh = 1;
	count = 1;
	while (2 * thresh <= value) {
		thresh *= 2;
		count++;
	}
	return (count);
};


/*
 * Constructors for bucketizers.
 */

function skMakeLinearBucketizer(step)
{
	return (new skLinearBucketizer(step));
}

function skMakeLogLinearBucketizer(base, nbuckets)
{
	return (new skLogLinearBucketizer(base, nbuckets));
}

function skMakeP2Bucketizer()
{
	return (new skP2Bucketizer());
}


/*
 * Expand the internal representation of a distribution into the legacy version
 * that includes the minimum and maximum for each range instead of the ordinal
 * number of each range.
 */
function skOrdinalToBounds(bucketizer, dist)
{
	return (dist.map(function (row, i) {
		mod_assert.ok(Array.isArray(row));
		mod_assert.equal(row.length, 2);
		mod_assert.equal(typeof (row[0]), 'number');
		var bmin = bucketizer.bucketMin(row[0]);
		var bmax = bucketizer.bucketMax(row[0]);
		return ([ [ bmin, bmax ], row[1] ]);
	}));
}

/* XXX This should be moved into jsprim. */
function flattenIter(data, depth, accum, callback)
{
	var each;
	var key;

	if (depth === 0) {
		each = accum.slice(0);
		each.push(data);
		callback(each);
		return;
	}

	mod_assert.ok(data !== null);
	mod_assert.equal(typeof (data), 'object');
	mod_assert.equal(typeof (depth), 'number');
	mod_assert.ok(depth >= 0);

	for (key in data) {
		each = accum.slice(0);
		each.push(key);
		flattenIter(data[key], depth - 1, each, callback);
	}
}
