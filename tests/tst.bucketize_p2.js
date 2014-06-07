var mod_assert = require('assert');
var mod_skinner = require('../lib/skinner');

var func = mod_skinner.p2Bucketizer;
var dist = [];
var i;

/*
 * Test obvious special cases near the bottom of the range.
 */
func(dist, 1, 3);
mod_assert.deepEqual(dist, [
    [ [ 1, 1 ], 3 ]
]);

func(dist, 0, 5);
mod_assert.deepEqual(dist, [
    [ [ 0, 0 ], 5 ],
    [ [ 1, 1 ], 3 ]
]);

func(dist, 1, 7);
mod_assert.deepEqual(dist, [
    [ [ 0, 0 ], 5 ],
    [ [ 1, 1 ], 10 ]
]);

func(dist, 0, 2);
mod_assert.deepEqual(dist, [
    [ [ 0, 0 ], 7 ],
    [ [ 1, 1 ], 10 ]
]);

func(dist, 2, 9);
mod_assert.deepEqual(dist, [
    [ [ 0, 0 ], 7 ],
    [ [ 1, 1 ], 10 ],
    [ [ 2, 3 ], 9 ]
]);

func(dist, 3, 3);
mod_assert.deepEqual(dist, [
    [ [ 0, 0 ], 7 ],
    [ [ 1, 1 ], 10 ],
    [ [ 2, 3 ], 12 ]
]);

func(dist, 4, 1);
mod_assert.deepEqual(dist, [
    [ [ 0, 0 ], 7 ],
    [ [ 1, 1 ], 10 ],
    [ [ 2, 3 ], 12 ],
    [ [ 4, 7 ], 1 ]
]);

/*
 * Test filling in sparse areas.
 */
dist = [];
func(dist, 9, 1);
mod_assert.deepEqual(dist, [
    [ [ 8, 15 ], 1 ]
]);

func(dist, 3, 7);
mod_assert.deepEqual(dist, [
    [ [ 2, 3 ], 7 ],
    [ [ 8, 15 ], 1 ]
]);

func(dist, 4, 2);
mod_assert.deepEqual(dist, [
    [ [ 2, 3 ], 7 ],
    [ [ 4, 7 ], 2 ],
    [ [ 8, 15 ], 1 ]
]);

/* Test everything up to 31. */
dist = [];
for (i = 0; i < 32; i++)
	func(dist, i, 1);
mod_assert.deepEqual(dist, [
    [ [ 0,  0],  1 ],
    [ [ 1,  1],  1 ],
    [ [ 2,  3],  2 ],
    [ [ 4,  7],  4 ],
    [ [ 8, 15],  8 ],
    [ [16, 31], 16 ]
]);

/* Test *adding* someting to each of those. */
for (i = 0; i < 32; i++)
	func(dist, i, 2);
mod_assert.deepEqual(dist, [
    [ [ 0,  0],  3 ],
    [ [ 1,  1],  3 ],
    [ [ 2,  3],  6 ],
    [ [ 4,  7], 12 ],
    [ [ 8, 15], 24 ],
    [ [16, 31], 48 ]
]);

/* Test the same thing backwards. */
dist = [];
for (i = 31; i >= 0; i--)
	func(dist, i, 3);
mod_assert.deepEqual(dist, [
    [ [ 0,  0],  3 ],
    [ [ 1,  1],  3 ],
    [ [ 2,  3],  6 ],
    [ [ 4,  7], 12 ],
    [ [ 8, 15], 24 ],
    [ [16, 31], 48 ]
]);
console.log('test okay');
