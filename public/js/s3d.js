// Copyright 2014, SRI International

'use strict';

var G2JS = require('grouping2js'),
    $ = require('jquery');

var shootingRangeS3D = '\
<?xml version="1.0" encoding="utf-8"?>\
<!-- Copyright 2014, SRI International -->\
<S3D>\
    <head>\
        <description>Semantic 3D mapping file for: Shooting Range environment</description>\
        <author>cgreuel</author>\
        <created>2014-08-13</created>\
        <modified>2014-11-13</modified>  <!-- John Pywtorak -->\
    </head>\
    <flora_base id="M4_ont" uri="../../../knowledge/weapons/M4/m4.flr" />  <!-- Using the M4 ontology for the shooting range for 1.0 -->\
    <semantic_mapping>\
        <asset name="ShootingRange" uri="/SAVE/models/environments/range/ShootingRange.dae" sid="M4_ont" flora_ref="ShootingRange">\
            <object name="targets" node="targets" sid="M4_ont" flora_ref="ShootingTarget" /> <!-- Proxy. For now these two point to the same class -->\
        </asset>\
    </semantic_mapping>\
    <grouping name="ShootingRange">\
        <group name="environment" node="environment">\
            <part node="grass"/>\
            <part node="tree_line"/>\
            <part node="sky"/>\
            <part node="targets"/>\
            <part node="ShootingRangeArea1"/>\
            <part node="ShootingRangeArea2"/>\
            <part node="ShootingRangeArea3"/>\
            <part node="ShootingRangeArea4"/>\
            <part node="ShootingRangeArea5"/>\
            <part node="ShootingRangeArea6"/>\
            <part node="ShootingRangeArea7"/>\
            <part node="ShootingRangeArea8"/>\
        </group>\
    </grouping>\
    </S3D>\
';

console.log(G2JS.g2js(shootingRangeS3D));

var o = G2JS.g2html(shootingRangeS3D);

console.log(o.text);
