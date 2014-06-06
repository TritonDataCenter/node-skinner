/*
 * examples/streaming.js: outline streaming interface
 */

var util = require('util');
var skinner = require('../lib/skinner');
var datapoints, bucketizers, stream;

/*
 * See the "basic" example first.
 */
bucketizers = {};
datapoints = [
    { 'fields': { 'city': 'Springfield', 'state': 'MA' }, 'value': 153000 },
    { 'fields': { 'city': 'Boston',      'state': 'MA' }, 'value': 636000 },
    { 'fields': { 'city': 'Worcestor',   'state': 'MA' }, 'value': 183000 },
    { 'fields': { 'city': 'Fresno',      'state': 'CA' }, 'value': 505000 },
    { 'fields': { 'city': 'Springfield', 'state': 'OR' }, 'value':  60000 },
    { 'fields': { 'city': 'Portland',    'state': 'OR' }, 'value': 600000 }
];

stream = skinner.createAggregator({
    'bucketizers': bucketizers,
    'decomps': [ 'city' ]
});

datapoints.forEach(function (pt) { stream.write(pt); });
stream.end();

/* These two print the same thing. */
console.log(stream.result());
stream.on('data', function (result) { console.log(result); });
