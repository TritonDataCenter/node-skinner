var mod_assert = require('assert');
var mod_path = require('path');
var mod_skinner = require('../lib/skinner');
var datapoints, bucketizers;

/*
 * Skip style-checking on this whole file because it's more useful in this
 * particular case to have manually laid-out data structures that don't quite
 * line up with jsstyle.
 */
/* BEGIN JSSTYLED */

/*
 * Example data points: populations of US cities
 */
datapoints = [
    { 'fields': { 'city': 'Springfield', 'state': 'MA' }, 'value': 153000 },
    { 'fields': { 'city': 'Boston',      'state': 'MA' }, 'value': 636000 },
    { 'fields': { 'city': 'Worcestor',   'state': 'MA' }, 'value': 183000 },
    { 'fields': { 'city': 'Fresno',      'state': 'CA' }, 'value': 505000 },
    { 'fields': { 'city': 'Springfield', 'state': 'OR' }, 'value':  60000 },
    { 'fields': { 'city': 'Portland',    'state': 'OR' }, 'value': 600000 }
];

/* Check the sum of all populations. */
mod_assert.deepEqual(mod_skinner.aggregate(datapoints), [ 2137000 ]);

/* Check the sums of populations by state. */
mod_assert.deepEqual(mod_skinner.aggregate(datapoints, [ 'state' ]),
    [ [ 'MA', 972000 ],
      [ 'CA', 505000 ],
      [ 'OR', 660000 ] ]);

/* Check the sums of populations, broken out by city name (NOT state) */
mod_assert.deepEqual(mod_skinner.aggregate(datapoints, [ 'city' ]),
    [ [ 'Springfield', 213000 ],
      [ 'Boston',      636000 ],
      [ 'Worcestor',   183000 ],
      [ 'Fresno',      505000 ],
      [ 'Portland',    600000 ] ]);

/*
 * Check the sums of populations, broken out by state *and* city
 * (same as the original dataset, in this case).
 */
mod_assert.deepEqual(mod_skinner.aggregate(datapoints, [ 'state', 'city' ]),
    [ [ 'MA', 'Springfield', 153000 ],
      [ 'MA', 'Boston',      636000 ],
      [ 'MA', 'Worcestor',   183000 ],
      [ 'CA', 'Fresno',      505000 ],
      [ 'OR', 'Springfield', 60000 ],
      [ 'OR', 'Portland',    600000 ] ]);


/*
 * Test nested properties, which should use pluck().
 */
datapoints = [
    { 'fields': { 'data': { 'city': 'Springfield', 'state': 'MA' } }, 'value': 153000 },
    { 'fields': { 'data': { 'city': 'Boston',      'state': 'MA' } }, 'value': 636000 },
    { 'fields': { 'data': { 'city': 'Worcestor',   'state': 'MA' } }, 'value': 183000 },
    { 'fields': { 'data': { 'city': 'Fresno',      'state': 'CA' } }, 'value': 505000 },
    { 'fields': { 'data': { 'city': 'Springfield', 'state': 'OR' } }, 'value':  60000 },
    { 'fields': { 'data': { 'city': 'Portland',    'state': 'OR' } }, 'value': 600000 }
];
mod_assert.deepEqual(mod_skinner.aggregate(datapoints, [ 'data.state' ]),
    [ [ 'MA', 972000 ],
      [ 'CA', 505000 ],
      [ 'OR', 660000 ] ]);

/*
 * Test bucketizers.
 */
datapoints = [
    { 'fields': { 'host': 'host1', 'cpu': 'cpu0', 'util': 83 }, 'value': 1 },
    { 'fields': { 'host': 'host1', 'cpu': 'cpu1', 'util': 13 }, 'value': 1 },
    { 'fields': { 'host': 'host2', 'cpu': 'cpu0', 'util': 37 }, 'value': 1 },
    { 'fields': { 'host': 'host2', 'cpu': 'cpu1', 'util': 53 }, 'value': 1 },
    { 'fields': { 'host': 'host3', 'cpu': 'cpu0', 'util': 88 }, 'value': 1 },
    { 'fields': { 'host': 'host3', 'cpu': 'cpu1', 'util':  9 }, 'value': 1 },
    { 'fields': { 'host': 'host4', 'cpu': 'cpu0', 'util': 98 }, 'value': 1 },
    { 'fields': { 'host': 'host4', 'cpu': 'cpu1', 'util':  5 }, 'value': 1 }
];

bucketizers = {
    'util': mod_skinner.makeLinearBucketizer(10)
};

/*
 * Summarize overall CPU utilization in a single histogram.
 */
var expand = mod_skinner.ordinalToBounds.bind(null, bucketizers.util);
mod_assert.deepEqual(
    expand(mod_skinner.aggregate(datapoints, [ 'util' ], bucketizers)),
    [ [ [  0,  9 ], 2 ],
      [ [ 10, 19 ], 1 ],
      [ [ 30, 39 ], 1 ],
      [ [ 50, 59 ], 1 ],
      [ [ 80, 89 ], 2 ],
      [ [ 90, 99 ], 1 ] ]);

/*
 * Check CPU utilization histograms for each host.
 */
mod_assert.deepEqual(
    mod_skinner.aggregate(datapoints, [ 'host', 'util' ], bucketizers),
    [ [ 'host1', 1, 1 ],
      [ 'host1', 8, 1 ],
      [ 'host2', 3, 1 ],
      [ 'host2', 5, 1 ],
      [ 'host3', 0, 1 ],
      [ 'host3', 8, 1 ],
      [ 'host4', 0, 1 ],
      [ 'host4', 9, 1 ] ]);

/*
 * Check CPU utilization histograms for each CPU name.
 */
mod_assert.deepEqual(
    mod_skinner.aggregate(datapoints, [ 'cpu', 'util' ], bucketizers),
    [ [ 'cpu0', 3, 1 ],
      [ 'cpu0', 8, 2 ],
      [ 'cpu0', 9, 1 ],
      [ 'cpu1', 0, 2 ],
      [ 'cpu1', 1, 1 ],
      [ 'cpu1', 5, 1 ] ]);

console.log('test %s okay', mod_path.basename(process.argv[1]));
/* END JSSTYLED */
