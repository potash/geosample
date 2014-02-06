// sample uniformly from the unit square
// (0,0), (1,0), (0,1), (1,1) 
function sampleUnitSquare() {
	return [Math.random(), Math.random()];
}

// sample uniformly from parallelogram
// at origin spanned by v1,v2
function sampleParallelogram(v1,v2) {
	return add(scale(Math.random(), v1), 
		       scale(Math.random(), v2));
}

function subtract(v1,v2) {
	return [v1[0] - v2[0], v1[1]-v2[1]];
}

function add(v1,v2) {
	return [v1[0] + v2[0], v1[1] + v2[1]];
}

function dot(v1,v2) {
	return v1[0]*v2[0] + v1[1]*v2[1];
}

function norm(v) {
	return v[0]*v[0] + v[1]*v[1];
}

function scale(a,v) {
	return [a*v[0], a*v[1]];
}

// orthogonal complement
function complement(v) {
	return [-v[1], v[0]];
}

// check whether p and q are on the same side 
// of the line spanned by v
function sameSide(p,q,v) {
	var n = complement(v);

	return dot(p,n)*dot(q,n) >= 0;
}

function fromPolar(r,t) {
	return [r*Math.cos(t), r*Math.sin(t)];
}

function sampleTriangle(v1,v2,v3) {
	if (v3 == null) {
		var p = sampleParallelogram(v1,v2);

		// if it's in the wrong half, reflect it back
		if (sameSide(subtract(p,v2), v1, subtract(v1,v2))) {
			p = subtract(add(v1,v2),p);
		} 

		return p;
	} else {
		return add(v3, sampleTriangle(subtract(v1,v3), subtract(v2,v3)));
	}
}

// generate random polygon with n vertices
// radius at least r0 at most r1
// the origin will be in the interior
function randomPolygon(n, r0,r1) {
	var angles = [];
	// generate angles
	for (var i = 0; i < n; i++) {
		angles[i] = Math.random()*2*Math.PI;
	}
	angles.sort(function(a,b) { return a-b });

	var points = [];
	for (var i = 0; i < n; i++) {
		points[i] = fromPolar(Math.random() * (r1 - r0) + r0, angles[i]);
	}

	return points;
}

function triangulate(v) {
	var contour = v.map(function(p) { return new poly2tri.Point(p[0],p[1]); });
	var swctx = new poly2tri.SweepContext(contour);
	swctx.triangulate();
	var triangles = swctx.getTriangles();

	return triangles.map(function(t) {
		return t.getPoints().map(function(p) { return [p.x,p.y]; });
	});
}

function distance(v1,v2) {
	return Math.sqrt(norm(subtract(v1,v2)));
}

// calculate area of triangle using Heron's formula
function triangleArea(t) {
	var a = distance(t[0],t[1]),
		b = distance(t[1],t[2]),
		c = distance(t[2],t[0]);

	var s = (a + b + c)/2;

	return Math.sqrt(s*(s-a)*(s-b)*(s-c));
}

function sampleCDF(cdf) {
	var x = Math.random();
	var i = 0;
	while(x > cdf[i] && i < cdf.length) { i++ }
	return i;
}

// take n samples from the triangulation t
function sampleTriangulation(triangles, n) {
	var areas = triangles.map(function(t) { return triangleArea(t); });
	var totalArea = areas.reduce(function(a, b) { return a + b; }, 0);

	// build triangle cdf
	var cdf = [];
	for (var i = 0; i < areas.length; i++) {
		cdf[i] = areas[i]/totalArea + (i > 0 ? cdf[i-1] : 0);
	}

	var points = [];
	for (var i = 0; i < n; i++) {
		var j = sampleCDF(cdf);
		points[i] = sampleTriangle(triangles[j][0],triangles[j][1],triangles[j][2]);
	}

	return points;
}

function draw(svg) { 
	var width = Math.max(svg.root().getAttribute("width"), 300);
	var height = Math.max(svg.root().getAttribute("height"), 300);
	console.log(height);

	var s = Math.min(width,height)/2;
	var px = 1/s;

	var g = svg.group({transform: 'translate(' + width/2 +','+ height/2+') scale('+ s +') matrix(1,0,0,-1,0,0)'});

	// generate random polygon
	var v = randomPolygon(100,.25,1);
	triangles = triangulate(v);
	
	triangles.forEach(function(t) { 
		svg.polygon(g, t, {fill:'none', stroke:'lightgrey', strokeWidth:1, 'vector-effect':'non-scaling-stroke'});
	});

	// draw it
	svg.polygon(g, v, {fill:'none', stroke:'black', strokeWidth:2, 'vector-effect':'non-scaling-stroke'});

	sampleTriangulation(triangles, 1000).forEach(function(p) {
		svg.circle(g,p[0],p[1],1*px, {fill: 'black'});
	});
}

// map stuff
var map;
var defaultLatLng = new L.LatLng(41.878247, -87.629767); // Chicago
var defaultZoom = 9;

function sampleLocation(address, n, options) {
	$.getJSON('http://nominatim.openstreetmap.org/search?format=json&limit=1&polygon=1&q=' + address, 
		function(data) {  
			if (data.length > 0) {
				var poly = data[0].polygonpoints;
				drawPolygon(toLeafletPoints(poly), options);

				poly.pop(); // first and last points are the same so remove one
				var triangles = triangulate(poly);
				points = sampleTriangulation(triangles, n);
				points.forEach( function(p) {
					L.marker([p[1],p[0]]).addTo(map);
				});
			}
		}
	);
}

function drawPolygon(polygon, options) {
	var p = L.polyline(polygon, options);
	map.addLayer(p);
	map.fitBounds(p.getBounds());
}

function toLeafletPoints(polygonpoints) {
	return polygonpoints.map(function(p) { return new L.LatLng(p[1],p[0]) })
}

function initMap(selector) {
	map = new L.Map(selector);
	map.setView(defaultLatLng, defaultZoom);

	var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	var osmAttrib='Map data &copy; OpenStreetMap contributors';
	var osm = new L.TileLayer(osmUrl, {minZoom: 7, maxZoom: 19, attribution: osmAttrib});
	map.addLayer(osm);
}
