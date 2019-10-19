/*
 * Copyright (c) 2017, Joyent, Inc.
 */

var mod_assertplus = require('assert');
var mod_path = require('path');
var mod_skinner = require('../lib/skinner');

var datapoints, bucketizers, stream;
var gotwarning = false, gotdata = false;

datapoints = [
    { 'fields': { 'city': 'Boston',      'pop': 636000 }, 'value': 1 },
    { 'fields': { 'city': 'Worcestor',   'pop': 'bogus!' }, 'value': 1 },
    { 'fields': { 'city': 'Springfield', 'pop': 153000 }, 'value': 1 }
];
bucketizers = {
    'pop': mod_skinner.makeLinearBucketizer(100000)
};
stream = mod_skinner.createAggregator({
    'decomps': [ 'pop' ],
    'bucketizers': bucketizers
});
stream.on('invalid_object', function (obj, err, num) {
	mod_assertplus.deepEqual(obj, {
	    'fields': {
		'city': 'Worcestor',
		'pop': 'bogus!'
	    },
	    'value': 1
	});
	mod_assertplus.equal(num, 2);
	mod_assertplus.equal(err.message,
	    'value for field "pop" is not a number');
	gotwarning = true;
});
datapoints.forEach(function (d) { stream.write(d); });
stream.end();
stream.on('data', function (results) {
	mod_assertplus.deepEqual(results, [ [ 1, 1 ], [ 6, 1 ] ]);
	gotdata = true;
});

stream.on('end', function () {
	console.log('test %s okay', mod_path.basename(process.argv[1]));
	mod_assertplus.ok(gotdata);
	mod_assertplus.ok(gotwarning);
});
