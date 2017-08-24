/*
 * Copyright (c) 2017, Joyent, Inc.
 */

var mod_assertplus = require('assert-plus');
var mod_path = require('path');
var mod_skinner = require('../lib/skinner');

var bucketizer, func, expand;
var dist, dist2, i;

bucketizer = mod_skinner.makeLinearBucketizer(10);
func = bucketizer.bucketize.bind(bucketizer);
expand = mod_skinner.ordinalToBounds.bind(null, bucketizer);
dist = [];

/* Test some basic values in the first few buckets. */
func(dist, 3, 1);
mod_assertplus.deepEqual(dist, [ [ 0, 1 ] ]);

func(dist, 0, 2);
mod_assertplus.deepEqual(dist, [ [ 0, 3 ] ]);

func(dist, 9, 2);
mod_assertplus.deepEqual(dist, [ [ 0, 5 ] ]);

func(dist, 10, 2);
mod_assertplus.deepEqual(dist, [ [ 0, 5 ], [ 1, 2 ] ]);

func(dist, 14, 7);
mod_assertplus.deepEqual(dist, [ [ 0, 5 ], [ 1, 9 ] ]);

/*
 * Test values from 9 to 99.  There should be 10 buckets, in order, with 10
 * values in each one.
 */
dist = [];
for (i = 0; i < 100; i++)
	func(dist, i, 1);
mod_assertplus.equal(dist.length, 10);
dist.forEach(function (d, j) {
	mod_assertplus.equal(j, d[0]);
	mod_assertplus.equal(10, d[1]);
});

/*
 * Do the same thing backwards to test creating buckets before previous ones.
 */
dist2 = [];
for (i = 0; i < 100; i++)
	func(dist2, i, 1);
mod_assertplus.deepEqual(dist, dist2);

/* Now test filling in some sparse values. */
dist = [];
func(dist, 853, 12);
func(dist, 396, 7);
func(dist, 858, 2);
func(dist, 10345, 17);
mod_assertplus.deepEqual(dist, [
    [ 39,  7 ],
    [ 85, 14 ],
    [ 1034, 17 ]
]);

/* Test bucket expansion. */
mod_assertplus.deepEqual(expand(dist), [
    [ [ 390, 399 ],  7 ],
    [ [ 850, 859 ], 14 ],
    [ [ 10340, 10349 ], 17 ]
]);

mod_assertplus.deepEqual(expand(dist2), [
    [ [  0,  9 ], 10 ],
    [ [ 10, 19 ], 10 ],
    [ [ 20, 29 ], 10 ],
    [ [ 30, 39 ], 10 ],
    [ [ 40, 49 ], 10 ],
    [ [ 50, 59 ], 10 ],
    [ [ 60, 69 ], 10 ],
    [ [ 70, 79 ], 10 ],
    [ [ 80, 89 ], 10 ],
    [ [ 90, 99 ], 10 ]
]);


/* Finally, do a quick test on ranges other than size "10". */
bucketizer = mod_skinner.makeLinearBucketizer(7);
func = bucketizer.bucketize.bind(bucketizer);
expand = mod_skinner.ordinalToBounds.bind(null, bucketizer);
dist = [];
func(dist, 37, 3);
func(dist, 88, 2);
func(dist, 35, 1);
mod_assertplus.deepEqual(dist, [ [ 5, 4 ], [ 12, 2 ] ]);
mod_assertplus.deepEqual(expand(dist), [
    [ [ 35, 41 ], 4 ],
    [ [ 84, 90 ], 2 ]
]);

console.log('test %s okay', mod_path.basename(process.argv[1]));
