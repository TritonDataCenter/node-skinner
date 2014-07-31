# skinner: aggregate multi-dimensional data points

Skinner provides functions for summarizing a bunch of multi-dimensional data
points.  It's best described by example.  Here are some data points describing
populations of US cities:

```javascript
datapoints = [
    { 'fields': { 'city': 'Springfield', 'state': 'MA' }, 'value': 153000 },
    { 'fields': { 'city': 'Boston',      'state': 'MA' }, 'value': 636000 },
    { 'fields': { 'city': 'Worcestor',   'state': 'MA' }, 'value': 183000 },
    { 'fields': { 'city': 'Fresno',      'state': 'CA' }, 'value': 505000 },
    { 'fields': { 'city': 'Springfield', 'state': 'OR' }, 'value':  60000 },
    { 'fields': { 'city': 'Portland',    'state': 'OR' }, 'value': 600000 }
];
```

You can sum all of the values:

```javascript
assert.deepEqual(skinner.aggregate(datapoints), [ 2137000 ]);
```

In this case, `aggregate` returned an array of one aggregated data point, which
was just the number `2137000`.

You can break out the results by 'state':

```javascript
assert.deepEqual(skinner.aggregate(datapoints, [ 'state' ]),
    [ [ 'MA', 972000 ],
      [ 'CA', 505000 ],
      [ 'OR', 660000 ] ]);
```

In this case, `aggregate` summed the values and grouped the sums by state.

Obviously, you can do the same with city name (*not* including state), which
sums results of Springfield, since that's in two states:

```javascript
assert.deepEqual(skinner.aggregate(datapoints, [ 'city' ]),
    [ [ 'Springfield', 213000 ],
      [ 'Boston',      636000 ],
      [ 'Worcestor',   183000 ],
      [ 'Fresno',      505000 ],
      [ 'Portland',    600000 ] ]);
```

You can also break out the results by more than one column:

```javascript
assert.deepEqual(skinner.aggregate(datapoints, [ 'state', 'city' ]),
    [ [ 'MA', 'Springfield', 153000 ],
      [ 'MA', 'Boston',      636000 ],
      [ 'MA', 'Worcestor',   183000 ],
      [ 'CA', 'Fresno',      505000 ],
      [ 'OR', 'Springfield', 60000 ],
      [ 'OR', 'Portland',    600000 ] ]);

```

The order that you specify breakdowns determines the order in which the values
are output.  If you do `[ 'city', 'state' ]`, you'll get data points that look
like `[ 'Springfield', 'MA', 153000 ]`.  If you do `[ 'state', 'city' ]`, you'll
get `[ 'MA', 'Springfield', 153000 ]`.



## Bucketizing numbers

Here's a set of data points describing CPU utilization on four 2-CPU systems
where the CPUs are called "cpu0" and "cpu1" on each system:

```javascript
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
```

As above, the "value" here is the *count* of data points having the specified
fields (e.g., the count of CPUs on host "host1" with name "cpu0" and utilization
"83", which is always 1 in this case).

The difference between this data set and the previous one is that "util" is an
arbitrary number, and if we want to break out results by "util", we probably
don't want a separate result for every possible utilization value.  Instead, we
*bucketize* the utilization values.  We'll use a linear bucketizer with step
"10", which means we'll group the "util" values into equal-sized buckets of 10
units each:

```javascript
bucketizers = {
    'util': skinner.makeLinearBucketizer(10)
};
```

Now, you can summarize CPU utilization across all systems with a single
histogram:

```javascript
var expand = mod_skinner.ordinalToBounds.bind(null, bucketizers.util);
assert.deepEqual(
    expand(skinner.aggregate(datapoints, [ 'util' ], bucketizers)),
    [ [ [ [ 0, 9 ], 2 ],
        [ [ 10, 19 ], 1 ],
        [ [ 30, 39 ], 1 ],
        [ [ 50, 59 ], 1 ],
        [ [ 80, 89 ], 2 ],
        [ [ 90, 99 ], 1 ] ] ]);
```

These results tell us that we had 2 CPUs with utilization between 0 and 9
(inclusive), 2 CPUs with utilization between 80 and 89, and 1 CPU each having
utilizations 10-19, 30-39, and 90-99.

If you leave out the "expand" bit, then you get bucket indexes rather than
values.  For a linear bucketizer of step 10, bucket index 2 covers ranges 20 to
30.  This format is generally more useful when you're shipping data around or
doing other aggregations or calculations with it.

You can break out these results by host (and using the un-expanded form):

```javascript
assert.deepEqual(
    skinner.aggregate(datapoints, [ 'host', 'util' ], bucketizers),
    [ [ 'host1', 1, 1 ],
      [ 'host1', 8, 1 ],
      [ 'host2', 3, 1 ],
      [ 'host2', 5, 1 ],
      [ 'host3', 0, 1 ],
      [ 'host3', 8, 1 ],
      [ 'host4', 0, 1 ],
      [ 'host4', 9, 1 ] ]);

```

Besides the linear bucketizer, there's a log-linear bucketizer.  For details on
what that does, see the DTrace llquantize() function.  To see how to use it,
check the source for `makeLogLinearBucketizer`.


## Streaming interface

For large numbers of data points where you don't want to keep all data points in
memory at once, you can use the object-mode streaming interface.  You write JSON
objects to it, and it emits the final summary.  You can also fetch the summary
so far at any time using the result() method.  For example, using the city/state
datapoints above:

```javascript
bucketizers = {};

stream = skinner.createAggregator({
    'bucketizers': bucketizers,
    'decomps': [ 'city' ]
});

datapoints.forEach(function (pt) { stream.write(pt); });
stream.end();

/* These two print the same thing. */
console.log(stream.result());
stream.on('data', function (result) { console.log(result); });
```


## Notes

Error checking is not great at the moment.  (Most input errors result in
assertion failures.)  Patches welcome.

You might also want to check out [krill](http://github.com/joyent/node-krill),
which filters similar-looking data points.  Between krill and skinner, you can
slice and dice data points in lots of different ways.
