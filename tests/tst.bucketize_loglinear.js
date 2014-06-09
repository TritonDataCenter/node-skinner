var mod_assert = require('assert');
var mod_path = require('path');
var mod_skinner = require('../lib/skinner');

/*
 * Hardcode the distribution (and expanded distribution) for a power-of-10
 * log-linear distribution with 20 steps at each order of magnitude.
 */
var bucketizer = mod_skinner.makeLogLinearBucketizer(10, 20);
var func = bucketizer.bucketize.bind(bucketizer);
var expand = mod_skinner.ordinalToBounds.bind(null, bucketizer);
var dist, i;

/* BEGIN JSSTYLED */
var expectedMins = [
    /*
     * The first order of magnitude ranges from 0 to 10.  It has only 10 buckets
     * because the maximum value is less than the number of buckets requested at
     * each order.
     */
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,

    /*
     * The next order of magnitude ranges from 10 to 100 and has 18 unique
     * buckets (by starting with the requested 20 and subtracting the two
     * covered by the previous order of magnitude).
     */
    10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,

    /*
     * Each order continues to have 18 unique buckets, but the values between
     * them grows by a factor of 10 each time.
     */
    100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750,
    800, 850, 900, 950,

    1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500,
    7000, 7500, 8000, 8500, 9000, 9500
];
/* END JSSTYLED */

for (i = 0; i < expectedMins.length; i++) {
	mod_assert.equal(expectedMins[i], bucketizer.bucketMin(i),
	    'bucket ' + i + ' minimum value');
}

/*
 * Construct a distribution of the first 1500 integers and make sure we got the
 * correct number of values in each bucket.
 */
var expectedDist = [
    [  0,   1 ], [  1,   1 ], [  2,   1 ], [  3,   1 ], [  4,   1 ],
    [  5,   1 ], [  6,   1 ], [  7,   1 ], [  8,   1 ], [  9,   1 ],

    [ 10,   5 ], [ 11,   5 ], [ 12,   5 ], [ 13,   5 ], [ 14,   5 ],
    [ 15,   5 ], [ 16,   5 ], [ 17,   5 ], [ 18,   5 ], [ 19,   5 ],
    [ 20,   5 ], [ 21,   5 ], [ 22,   5 ], [ 23,   5 ], [ 24,   5 ],
    [ 25,   5 ], [ 26,   5 ], [ 27,   5 ],

    [ 28,  50 ], [ 29,  50 ], [ 30,  50 ], [ 31,  50 ], [ 32,  50 ],
    [ 33,  50 ], [ 34,  50 ], [ 35,  50 ], [ 36,  50 ], [ 37,  50 ],
    [ 38,  50 ], [ 39,  50 ], [ 40,  50 ], [ 41,  50 ], [ 42,  50 ],
    [ 43,  50 ], [ 44,  50 ], [ 45,  50 ],

    [ 46, 500 ]
];

dist = [];
for (i = 0; i < 1500; i++)
	func(dist, i, 1);
mod_assert.deepEqual(dist, expectedDist);

/*
 * Now do the same thing in reverse, to test creating buckets before others.
 */
dist = [];
for (i = 1499; i >= 0; i--)
	func(dist, i, 1);
mod_assert.deepEqual(dist, expectedDist);

/*
 * Now try a few random ones.
 */
dist = [];
func(dist, 927, 1);
func(dist, 253, 1);
func(dist, 1437, 1);
func(dist, 1, 1);
mod_assert.deepEqual(dist, [
    [  1, 1 ],
    [ 31, 1 ],
    [ 44, 1 ],
    [ 46, 1 ]
]);

console.log('test %s okay', mod_path.basename(process.argv[1]));
