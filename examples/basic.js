/*
 * examples/basic.js: outline basic usage
 */

var util = require('util');
var skinner = require('../lib/skinner');
var datapoints, bucketizers;

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

/* Print the sum of all populations. */
console.log(skinner.aggregate(datapoints));

/* Print the sums of populations, broken out by state. */
console.log(skinner.aggregate(datapoints, [ 'state' ]));

/* Print the sums of populations, broken out by city name (NOT state) */
console.log(skinner.aggregate(datapoints, [ 'city' ]));

/*
 * Print the sums of populations, broken out by state *and* city
 * (same as the original dataset in this case).
 */
console.log(skinner.aggregate(datapoints, [ 'state', 'city' ]));

/*
 * When one of the fields is numeric, it may not make sense to break out all
 * discrete values, but to group them into buckets (i.e., a histogram).  Here's
 * a set of data points describing CPU utilization on four 2-CPU systems.  (As
 * above, the "value" here is the number of CPUs from host "host" with cpu name
 * "cpu" having utilization "util".  It's always 1 in this case.)
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

/*
 * We'll define a linear bucketizer with step "10", which means we'll group the
 * "util" values into equal-sized buckets of 10 units each.
 */
bucketizers = {
    'util': skinner.makeLinearBucketizer(10)
};

/*
 * Summarize overall CPU utilization in a single histogram.
 */
console.log(util.inspect(
    skinner.aggregate(datapoints, [ 'util' ], bucketizers), false, 5));

/*
 * Print a CPU utilization histogram *for each host*.
 */
console.log(util.inspect(
    skinner.aggregate(datapoints, [ 'host', 'util' ], bucketizers), false, 5));

/*
 * Print a CPU utilization histogram *for each CPU* (combining utilization from
 * different hosts into the same histogram).
 */
console.log(util.inspect(
    skinner.aggregate(datapoints, [ 'cpu', 'util' ], bucketizers), false, 5));
