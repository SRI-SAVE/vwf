(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright 2015, SRI International

'use strict';

var G2JS = require('../../scripts/grouping2js'),
    $ = require('../../scripts/node_modules/jquery'),
    $dae,
    tween,
    focusedNodeName,
    meshCache = { },
    semantic = G2JS.emptySjs,
    hostname;

var transformGroupingTojsTree = function(groupingObj, parent, treeList) {
    var treeList = treeList || [ ],
        parent = parent || groupingObj.name;

    if (treeList.length == 0) {
        treeList.push({
            id: groupingObj.name,
            parent: '#',
            text: groupingObj.name
        });
    }

    for (var p in groupingObj) {
        if (p == 'groups') {
            groupingObj.groups.forEach(function(group) {
                treeList.push({
                    id: group.name,
                    parent: parent,
                    text: group.name
                });
                transformGroupingTojsTree(group, group.name, treeList);
            });
        } else if (p == 'parts') {
            groupingObj.parts.forEach(function(part) {
                treeList.push({
                    id: part,
                    parent: parent,
                    text: part
                });
            });
        }
    }

    return treeList;
};

var updateModelTree = function(treeList) {
    $('#assetHierarchy').jstree({
        core : {
            multiple : false,
            data : treeList,
            check_callback: true
        },
        plugins : [ 'contextmenu', 'search' ],
        contextmenu : {
            items : {
                Link : {
                    label : 'Link',
                    action : function (obj) { window.addLink(); } // from s3d.refactor.js todo: future refactor
                },
                Unlink : {
                    label : 'Unlink',
                    action : function (obj) { window.removeLink(); } // from s3d.refactor.js todo: future refactor
                }
            },
            ccp : false,
            create : false,
            rename : false,
            remove : false
        }
    }).on('changed.jstree', function(e, data) {
        var r = [ ];

        for (var i = 0, j = data.selected.length; i < j; i++) r.push(data.instance.get_node(data.selected[ i ]).text);

        window.currentNode = r.join(', '); // from s3d.refactor.js todo: future refactor

        if (data.node.parent == '#') {
            TOW.cancelOnRenders();
            // TOW.restoreCenteredGeometryOffsetPivot(TOW.findMeshByName(focusedNodeName, $dae), $dae); // Experimental, not functioning
            TOW.visibleSceneChildren($dae);
        } else if (data.node.id == 'Trigger') focusTween(data.node.id); // Experimental tween support, will need ui for it
        else focusSelected(data.node.id);

        focusedNodeName = data.node.id;
    });
    $("#searchHierarchy").submit(function(e) {
        e.preventDefault();
        $("#assetHierarchy").jstree(true).search($("#queryHierarchy").val());
    });
};

var createTaxonomyTree =  function(tax, floraname) {
    var taxdiv = window.document.getElementById("taxonomy"), // from s3d.refactor.js todo: future refactor
        classList = window.document.createElement("ul"), // from s3d.refactor.js todo: future refactor
        rootNode = window.document.createElement("li"); // from s3d.refactor.js todo: future refactor

    rootNode.appendChild(window.document.createTextNode(floraname)); // from s3d.refactor.js todo: future refactor

    var elementList = window.document.createElement("ul"); // from s3d.refactor.js todo: future refactor

    rootNode.appendChild(elementList);
    classList.appendChild(rootNode);

    // Takes a flora term string and returns an HTML DOM representation of it
    function createListItem(floraTerm) {
        var item = window.document.createElement("li");

        item.appendChild(window.document.createTextNode(floraTerm));
        return item;
    }

    for (var i = 0; i < tax.length; i++) elementList.appendChild(createListItem(tax[ i ]));

    taxdiv.appendChild(classList);
    $('#taxonomy').jstree({
        core : {
            multiple : false,
            check_callback: true
        },
        plugins : [ 'contextmenu', 'search' ],
        contextmenu : {
            items : {
                Link : {
                    label : 'Link',
                    action : function(obj) { window.addLink(); } // from s3d.refactor.js todo: future refactor
                },
                Unlink : {
                    label : 'Unlink',
                    action : function(obj) { window.removeLink(); } // from s3d.refactor.js todo: future refactor
                },
                Info : {
                    label : 'Info',
                    action : function(obj) { getTaxonomyInfo(); }
                },
                ccp : false,
                create : false,
                rename : false,
                remove : false
            }
        }
    }).on('changed.jstree', function(jqe, data) {
        var r = [ ]; // reset the selected classes, from s3d.refactor.js todo: future refactor

        for (var i = 0, j = data.selected.length; i < j; i++) {
            var nodeText = data.instance.get_node(data.selected[ i ]).text;

            r.push(nodeText); // from s3d.refactor.js todo: future refactor
        }

        window.currentClass = r.join(', '); // from s3d.refactor.js todo: future refactor

        var fclass = r[ 0 ];

        if (data.selected.length === 1) {
            window.floraClass = fclass; // from s3d.refactor.js todo: future refactor

            if ($.jstree.reference('#taxonomy').is_leaf(data.selected[ 0 ]) === true) getSubClasses(fclass); // from s3d.refactor.js todo: future refactor
        }
    });
    $("#searchTaxonomy").submit(function(e) {
        e.preventDefault();
        $("#taxonomy").jstree(true).search($("#queryTaxonomy").val());
    });
};

var updateTaxonomyTreeSubclasses = function(tax) {
    if (tax.subclasses === undefined) return

    var tref = $.jstree.reference('#taxonomy');

    if (tref.is_leaf(window.floraClass) != true) return; // from s3d.refactor.js todo: future refactor

    var parent = tref.get_selected();

    console.info("Updating taxonomy super class: " + tax.superclass + ' with: ' + tax.subclasses.join(', '));

    for (var i = 0, l = tax.subclasses.length; i < l; i++) tref.create_node(parent, tax.subclasses[ i ], 'last', null, null);
};

var showTaxonomyClassDetails = function(details) {
    window.addClassDetailsToTable(details); // from s3d.refactor.js todo: future refactor
};

// $.ajax({ url:  '/SAVE/testdata/s3d/ShootingRange.xml', type: 'get', cache: false })
var loadS3D = function(url, s3dname) {
    var instance = $.jstree.reference('#assetHierarchy'); 

    if (instance) instance.destroy();

    $('#assetHierarchy').html('<p>Loading selected s3d...</p>');
    console.info('Loading ' + url);
    $.ajax({ url: url, type: 'get', cache: false })
    .done(function(data) {
        var xmlString;

        if ($.isXMLDoc(data)) xmlString = (new window.XMLSerializer()).serializeToString(data);
        else xmlString = data;

        var sjs = G2JS.s2js(xmlString),
            grouping = G2JS.g2js(xmlString),
            treeList = transformGroupingTojsTree(grouping),
            florauri = sjs.flora_base.uri,
            daename = getNameFromUrl(sjs.semantic_mapping.asset.uri);

        console.info('S3D references taxonomy: ' + florauri);
        console.info('S3D references asset: ' + daename);
        // semantic = G2JS._sjs = sjs;
        semantic = window.__sjs = sjs; // for s3d.refactor.js todo: future refactor
        semantic.grouping = grouping;
        loadFlora(florauri, getNameFromUrl(florauri));
        $('#semantic-filename').prop('value', url);
        $('#semantic-desc').prop('value', semantic.head.description);
        $('#semantic-auth').prop('value', semantic.head.author);
        $('#semantic-created').prop('value', semantic.head.created);
        $('#semantic-modified').prop('value', semantic.head.modified);
        $('#semantic-florabase-id').prop('value', semantic.flora_base.id);

        var asset = semantic.semantic_mapping.asset;

        if (asset.uri) {
            loadDAE(asset.uri, daename, treeList);
            window.linkCollection.push({ floraClass: asset.flora_ref,  modelNode: semantic.grouping.name }); // from s3d.refactor.js todo: future refactor
            window.tableBody.appendChild(window.createTableRow(asset.flora_ref, semantic.grouping.name, window.linkCollection.length)); // from s3d.refactor.js todo: future refactor
            semantic.semantic_mapping.asset.objs.forEach(function(obj) {
                window.linkCollection.push({ floraClass: obj.flora_ref,  modelNode: obj.node }); // from s3d.refactor.js todo: future refactor
                window.tableBody.appendChild(window.createTableRow(obj.flora_ref, obj.node, window.linkCollection.length)); // from s3d.refactor.js todo: future refactor
            });
        } else {
            console.warn('S3D semantic_mapping asset uri is missing or invalid');
        }
    })
    .fail(ajaxFail);
};

var loadDAE = function(url, daename, treeList) {
    var instance = $.jstree.reference('#assetHierarchy');

    if (instance) instance.destroy();

    $('#assetHierarchy').html('<p>Loading selected asset...</p>');
    console.info('Loading ' + url);

    if ($dae) TOW.Scene.remove($dae);

    if (treeList) {
        TOW.loadCollada(url, function(dae) {
            updateModelTree(treeList);
            $dae = dae;
            TOW.render();
        });
    } else {
        $.ajax({ url: url, type: 'get', cache: false })
        .done(function(data) {
            var xmlString;

            if ($.isXMLDoc(data)) xmlString = (new window.XMLSerializer()).serializeToString(data);
            else xmlString = data;

            var grouping = G2JS.dae2g(xmlString),
                treeList = transformGroupingTojsTree(grouping);

            semantic.semantic_mapping.asset.name = grouping.name;
            semantic.semantic_mapping.asset.uri = url;
            semantic.semantic_mapping.asset.sid = semantic.flora_base.id;
            semantic.grouping = grouping;
            TOW.loadColladaFromXmlString(xmlString, url, function(dae) {
                updateModelTree(treeList);
                $dae = dae;
                TOW.render();
            });
        })
        .fail(ajaxFail);
    }
};

var loadFlora = function(url, floraname) {
    var instance = $.jstree.reference('#taxonomy'),
        loadurl = 'http://' + hostname + ':3001/flora/server?method=loadFile&filename=' + encodeURIComponent(floraname);

    if (instance) instance.destroy();

    console.info('Requesting ' + floraname);
    $('#taxonomy').html('<p>Loading selected taxonomy...</p>');
    $.ajax({ url: loadurl, type: 'get', cache: false })
    .done(function(data) {
        semantic.flora_base.uri = url;
        getTaxonomyRoots(data, floraname)
    })
    .fail(ajaxFail);
};

// => [ "ChargingHandlePosition", "Action", "SwitchPosition", "ActionType", "PhysicalEntity", "EnumeratedType", "PinState", "BoltCarrierGroupState", "RoundLocation", "ActionParameter" ]
var getTaxonomyRoots = function(data, floraname) {
    var url = 'http://' + hostname + ':3001/flora/server?method=getTaxonomyRoots';

    $.ajax({ url: url, type: 'get', cache: false })
    .done(function(data) {
        if (Object.prototype.toString.call(data) != '[object Array]') data = JSON.parse(data);

        console.info('Fetched taxonomy roots: ' + JSON.stringify(data));
        createTaxonomyTree(data, floraname); // from s3d.refactor.js todo: future refactor
    })
    .fail(ajaxFail);
};

// ChargingHandlePosition => { superclass: "ChargingHandlePosition", subclasses: [ ] }
// Action => { superclass: "Action", subclasses: [ "Pull", "PullAndHold", "Attach", "TightenScrew", "Extract", "Point", "Insert", "Lift", "Open", "Inspect", "PushAndHold", "Close", "Push", "Detach", "SelectSwitchPosition", "Release", "Press", "LoosenScrew" ] }
// PhysicalEntity => { superclass: "PhysicalEntity", subclasses: [ "SafeTarget", "Region", "PhysicalObject" ] }
// PhysicalObject => { superclass: "PhysicalObject", subclasses: [ "FiringPin", "Hammer", "CleaningRodTip", "ShootingTarget", "M4", "Sling", "FiringPinRetainingPin", "Brush", "CleaningRodHandle", "LowerHalf", "ChargingHandle", "SlipRing", "LowerReceiverExtension", "Trigger", "CleaningRodSegment", "SlingSwivel", "Round", "ButtStockLockLever", "Extractor", "Buffer", "PipeCleaner", "WipeCloth", "CarryHandle", "BoltCarrierGroup", "BufferRetainer", "MagazineReleaseButton", "Bolt", "SlingLoop", "Casing", "UpperHalf", "CleaningRod", "Liquid", "Switch", "UpperHandGuard", "Pin", "Screw", "BoltCam", "ButtStock", "LowerHandGuard", "CleaningPatch", "BoltCatch", "Magazine" ] }
var getSubClasses = function(id) {
    var url = 'http://' + hostname + ':3001/flora/server?method=getSubClasses&id=' + encodeURIComponent(id);

    $.ajax({ url: url, type: 'get', cache: false })
    .done(function(data) {
        if (Object.prototype.toString.call(data) != '[object Object]') data = JSON.parse(data);

        console.info('Fetched ' + id + ' subclasses: ' + JSON.stringify(data));
        updateTaxonomyTreeSubclasses(data);
    })
    .fail(ajaxFail);
};

// ChargingHandlePosition => { id: "ChargingHandlePosition", superclasses: [ ], classproperties: [ ], types: [ ], individualproperties: [ ] }
var getTaxonomyInfo = function() {
    var url = 'http://' + hostname + ':3001/flora/server?method=getClassDetails&id=' + encodeURIComponent(window.currentClass); // from s3d.refactor.js todo: future refactor

    $.ajax({ url: url, type: 'get', cache: false })
    .done(function(data) {
        if (Object.prototype.toString.call(data) != '[object Object]') data = JSON.parse(data);

        console.info('Fetched ' + window.currentClass + ' class details: ' + JSON.stringify(data)); // from s3d.refactor.js todo: future refactor
        showTaxonomyClassDetails(data);
    })
    .fail(ajaxFail);
};

var getListOfRepoFiles = function(type) {
    return $.ajax({
        url: 'http://' + hostname + ':3001/listfiles/' + type + '/json',
        type: 'get',
        cache: false
    })
    .fail(ajaxFail);
};

var getNameFromUrl = function(url) {
    var lslashIdx = url.lastIndexOf('/'),
        name = lslashIdx === -1 ? url : url.substring(lslashIdx + 1, url.length);

    return name;
};

var createRepoTree = function(data, elemSelector, repoName, onSelect) {
    var repo = repoName + ' Repository',
        treeList = [{
            id: repo,
            parent: '#',
            text: repo
        }],
        treeId2Url = { };

    data.forEach(function(url) {
        console.info('Adding: ' + url + ' to ' + repo + ' tree');

        var name = getNameFromUrl(url);

        treeList.push({
            id: name,
            parent: repo,
            text: name
        });
        treeId2Url[ name ] = url;
    });
    $(elemSelector).jstree({
        core : {
            multiple : false,
            data : treeList,
            check_callback: true
        }
    }).on('changed.jstree', function(jqe, data) {
        if (data.node.parent == '#') { // The repository titled root deselect if selected
            $.jstree.reference(elemSelector).deselect_node(data.selected);
            return;
        }

        if (data.action == 'select_node') {
            var id = data.selected[ 0 ];

            console.info('Repository selection: ' + id);
            onSelect(treeId2Url[ id ], id);
        }
    });
};

var createS3DRepoTree = function(data) {
    if (Object.prototype.toString.call(data) != '[object Array]') console.warn('S3D listfiles request not an array, data: ' + Object.prototype.toString.call(data));

    createRepoTree(data, '#s3ds', 'S3D', loadS3D);
};

var createDAERepoTree = function(data) {
    if (Object.prototype.toString.call(data) != '[object Array]') console.warn('S3D listfiles request not an array, data: ' + Object.prototype.toString.call(data));

    createRepoTree(data, '#daes', '3D', loadDAE);
};

var createFloraRepoTree = function(data) {
    if (Object.prototype.toString.call(data) != '[object Array]') console.warn('S3D listfiles request not an array, data: ' + Object.prototype.toString.call(data));

    createRepoTree(data, '#floras', 'Flora', loadFlora);
};

var createAssetTreeSelectionGUI = function() {
    getListOfRepoFiles('s3d').done(createS3DRepoTree);
    getListOfRepoFiles('collada').done(createDAERepoTree);
    getListOfRepoFiles('flora').done(createFloraRepoTree);
};

var ajaxFail = function(jqXHR, textStatus, errorThrown) {
  console.warn(textStatus + ':' + errorThrown);
};

var focusSelected = function(n, onRender) {
    var logged = false;

    TOW.cancelOnRenders();
    TOW.invisibleSceneChildren($dae);

    if (tween) tween.stop();

    if (meshCache[ n ] === undefined) {
        onRender = onRender || function(delta, pivot) {
            if (!logged) { console.log(pivot.children[ 0 ].matrix.elements); logged = true; } // log the offset matrix

            pivot.rotation.y += Math.PI / 6 * delta;
        };
        
        meshCache[ n ] = TOW.findMeshVisibleAndCenterRender(n, $dae, onRender);
    } else {
        var pivot = TOW.findMeshByName(n, $dae, { visible: true }).parent.parent;

        TOW.render(function(delta) { pivot.rotation.y += Math.PI / 6 * delta; });
    }
};


var focusTween = function(n) {
    TOW.cancelOnRenders();
    TOW.invisibleSceneChildren($dae);

    var pivot = TOW.findMeshAndVisibleMesh(n, $dae); // "n" has local transform, "pivot" point, not at world 0, 0, 0

    if (meshCache[ n ] === undefined) {
        meshCache[ n ] = pivot;
        // TOW.render(function(delta) { pivot.rotation.x += Math.PI / 2 * delta; });
    } else {
        if (tween) tween.start();

        return;
    }

    pivot.position.set(0, 0, 0);

    var curY = { y:  pivot.rotation.y },
        pull = new TWEEN.Tween(curY)
            .to({ y: 0.52 }, 1000) // radians and milliseconds
            // .easing(TWEEN.Easing.Elastic.InOut)
            .easing(TWEEN.Easing.Exponential.InOut)
            .onUpdate(function() { curY = pivot.rotation.y = this.y; }),
        release = new TWEEN.Tween(curY)
            .to({ y: 0 }, 500)
            .onUpdate(function() { curY =  pivot.rotation.y = this.y })
            .delay(250);

    pull.chain(release);
    release.chain(pull);
    pull.start();
    tween = pull;
};

var onClickSaveShow = function(jqe) {
    $('#b-semantic-info').show();
}

var onClickSaveHide = function(jqe) {
    $('#b-semantic-info').hide();
}

var onClickSaveS3D = function(jqe) {
    updateSemanticInfoFromHtml();

    var sx = G2JS.so2xml(semantic, semantic.grouping),
        url = 'http://' + hostname + ':3001' + $('#semantic-filename').val();

    console.info('s3d:\n' + G2JS.sx2html(sx).text);
    console.info('Saving s3d to: ' + url);
    $.ajax({
        url: url,
        type: 'put',
        data: sx,
        cache: false,
        processData: false,
        crossDomain: true,
        xhrFields: { withCredentials: true } // prompt
    })
    .done(function(data) {
        console.info(data); 
        onClickSaveHide();
    })
    .fail(ajaxFail);
};

var updateSemanticInfoFromHtml = function() {
    var desc = $('#semantic-desc').val(),
        auth = $('#semantic-auth').val(),
        created = $('#semantic-created').val(),
        modified = $('#semantic-modified').val(),
        flora_base_id = $('#semantic-florabase-id').val();

    semantic.head.description = desc;
    semantic.head.author = auth;
    semantic.head.created = created;
    semantic.head.modified = modified;
    semantic.flora_base.id = flora_base_id;

    var asset = semantic.semantic_mapping.asset;

    asset.sid = flora_base_id;
    asset.objs.forEach(function(obj) {
        obj.sid = flora_base_id;
    })
};

var onBlurSemanticInfo = function(jqe) {
    updateSemanticInfoFromHtml();
};

var onClickDeleteMappingRow = function(jqe) {
    var tr = $(this).closest('tr'),
        fclass = tr.children('td:nth-child(2)').text(),
        node = tr.children('td:nth-child(4)').text();

    window.removeLinkByClassAndNode(fclass, node); // from s3d.refactor.js todo: refactor
    tr.remove();
};

window.$ = $;
window.jQuery = $;
window.__sjs = semantic; // for s3d.refactor.js todo: future refactor
window.addEventListener('DOMContentLoaded', function(event) {
    console.info('DOM fully loaded and parsed, ready to create the asset selection trees');
    hostname = window.document.location.hostname;
    createAssetTreeSelectionGUI();

    $('#b-semantic-info').hide();
    $('#save-button').click(onClickSaveShow);
    $('#cancel-button').click(onClickSaveHide);
    $('#save-button-s3d').click(onClickSaveS3D);
    $('#b-semantic-info input[type=text]').on('blur', onBlurSemanticInfo);
    $('table').on('click', 'input[type="button"]', onClickDeleteMappingRow); // from s3d.refactor.js todo: more refactor needed, broad selector

    TOW.changeContainerById('3d');
    TOW.loadCollada('/SAVE/models/xyzbar.dae', function() {
        $xyzbar_dae.scale.set(0.005, 0.005, 0.005);
        TOW.render();
        TOW.cancelRender(); // clear the requestAnimationFrame interval, not needed initially until dae loaded
    });
    TOW.intow(-1, 0.5, 0.5, -0.25, 0.025, 0.25); // light, camera => x, y, z
    // TOW.intow(-1, 0.5, 0.5, -10, 2, 10); // light, camera => x, y, z
});

},{"../../scripts/grouping2js":2,"../../scripts/node_modules/jquery":12}],2:[function(require,module,exports){
// Copyright 2015, SRI International

'use strict';

var g2js = require('./lib/grouping2js')({ strict: true }),
    dae2g = require('./lib/dae2grouping')({ strict: true }),
    s2js = require('./lib/semantic2js')({ strict: true }),
    pretty = require('js-object-pretty-print').pretty,
    beautify_html = require('js-beautify').html;

// public via exports.module
var grouping2html = function(sourceXml) {
    var groupingObj = g2js.grouping2js(sourceXml);

    return groupingObj2html(groupingObj);
};

var groupingObj2html = function(groupingObj) {
    var text = pretty(groupingObj),
        html = simpleText2html(text);

    return { html: html, text: text };
};

var groupingXml2html = function(sourceXml) {
    var text =  beautify_html(sourceXml),
        html = simpleText2html(text);

    return { html: html, text: text };
};

var groupingObj2xml = function(groupingObj) {
    groupingObj = groupingObj || { };

    var groupingXml = '<grouping name="' + groupingObj.name + '">';

    groupingXml = groupsparts2xml(groupingObj, groupingXml);
    return groupingXml + '</grouping>';
};

var semantic2html = function(sourceXml) {
    var semanticObj = g2js.grouping2js(sourceXml);

    return semanticObj2html(semanticObj);
};

var semanticObj2html = function(semanticObj) {
    var text = pretty(semanticObj),
        html = simpleText2html(text);

    return { html: html, text: text };
};

var semanticXml2html = function(sourceXml) {
    var text =  beautify_html(sourceXml),
        html = simpleText2html(text);

    return { html: html, text: text };    
};

var semanticObj2xml = function(semanticObj, groupingObj) {
    semanticObj = semanticObj || { };

    var semanticXml = '<S3D>';

    for (var p in semanticObj) {
        if (p == 'head') {
            semanticXml += '<head>';
            semanticXml += '<description>' + semanticObj.head.description + '</description>';
            semanticXml += '<author>' + semanticObj.head.author + '</author>';
            semanticXml += '<created>' + semanticObj.head.created + '</created>';
            semanticXml += '<modified>' + semanticObj.head.modified + '</modified>';
            semanticXml += '</head>';
        } else if (p == 'flora_base') {
            semanticXml += '<flora_base id="' + semanticObj.flora_base.id  + '" uri="' + semanticObj.flora_base.uri + '"/>';
        } else if (p == 'semantic_mapping') {
            var assetObj = semanticObj.semantic_mapping.asset;

            semanticXml += '<semantic_mapping>';
            semanticXml += '<asset name="' + assetObj.name + '" uri="' + assetObj.uri + '" sid="' + assetObj.sid + '" flora_ref="' + assetObj.flora_ref + '">';

            assetObj.groups.forEach(function(group) {
                var node = group.node === undefined? '' : ' node="' + group.node + '"';

                semanticXml += '<group name="' + group.name + '"' + node + ' sid="' + group.sid + '" flora_ref="' + group.flora_ref + '"/>';
            });

            assetObj.objs.forEach(function(obj) {
                semanticXml += '<object name="' + obj.name + '" node="' + obj.node + '" sid="' + obj.sid + '" flora_ref="' + obj.flora_ref + '"/>';
            });

            semanticXml += '</asset>';
            semanticXml += '</semantic_mapping>';

            if (groupingObj) semanticXml += groupingObj2xml(groupingObj);
        }
    }

    return semanticXml + '</S3D>';
};

// private
var simpleText2html = function(text) {
    var html;

    html =  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/\s/g, '&nbsp;');
    return html;
};

var groupsparts2xml = function(groupingObj, groupingXml) {
    for (var p in groupingObj) {
        if (p == 'groups') {
            groupingObj.groups.forEach(function(group) {
                groupingXml += '<group name="' + group.name + '"';

                if (group.node) {
                    groupingXml += ' node="' + group.node + '">';
                } else {
                    groupingXml += '>';
                }

                groupingXml = groupsparts2xml(group, groupingXml);
                groupingXml += '</group>';
            });
        } else if (p == 'parts') {
            groupingObj.parts.forEach(function(part) {
                groupingXml += '<part node="' + part + '"/>';
            });
        }
    }

    return groupingXml;
};

module.exports = {
    g2js: g2js.grouping2js,
    g2html: grouping2html,
    go2html: groupingObj2html,
    go2xml: groupingObj2xml,
    gx2html: groupingXml2html,
    dae2g: dae2g.dae2grouping,
    s2js: s2js.semantic2js,
    s2html: semantic2html,
    so2html: semanticObj2html,
    so2xml: semanticObj2xml,
    sx2html: semanticXml2html,
    emptySjs: {
        head: {
            description: undefined,
            author: undefined,
            created: undefined,
            modified: undefined
        },
        flora_base: {
            id: undefined,
            uri: undefined
        },
        semantic_mapping: {
            asset: {
                name: undefined,
                uri: undefined,
                sid: undefined,
                flora_ref: undefined,
                groups: [ ], // { name:, node:, sid:, flora_ref: }, ...
                objs: [ ] // { name:, node:, sid:, flora_ref: }, ...
            }
        }
    },
    s3dParser: g2js.parser,
    daeParser: dae2g.parser
};

try {
    window.G2JS = module.exports;
} catch(e) { } // ignore "ReferenceError: window is not defined" when running on the server

},{"./lib/dae2grouping":3,"./lib/grouping2js":4,"./lib/semantic2js":5,"js-beautify":6,"js-object-pretty-print":10}],3:[function(require,module,exports){
// Copyright 2015, SRI International

'use strict';

var sax = require("sax");

function dae2grouping(options) {
    var options = options || { },
        strict = options.strict || true,
        onerror = options.onerror || function(error) { /* an error happened */ },
        ontext = options.ontext || function(text) { /* got some text. text is the string body of the tag, called twice after open and before end */ },
        onattribute = options.onattribute || function(attr) { /* an attribute.  attr has "name" and "value" */ },
        onend = options.onend || function() { /* parser stream is done, and ready to have more stuff written to it */ },
        parser = sax.parser(strict),
        groupingObj,
        currentObj,
        currentGroup,
        currentPart,
        beginNode, // false
        endNode; // false

    parser.onerror = onerror; // be sure to parser.close() or parser.resume()
    parser.ontext = ontext;

    parser.onclosetag = function(name) { // closing a tag. name is the name from onopentag node.name
        if (name == 'node') {
            if (beginNode && !endNode) {
                currentObj.parts = currentObj.parts || [ ];
                currentObj.parts.push(currentPart);
                beginNode = false;
                endNode = true;
            } else {
                var p = currentObj.parent;
                delete currentObj.parent;
                currentObj = p;
                endNode = false;
            }
        }
    };

    parser.onopentag = function(node) { // opened a tag. node has "name" and "attributes", isSelfClosing
        switch (node.name) {
        case 'visual_scene':
            groupingObj.name = node.attributes.name;
            currentObj = groupingObj;
            break;
        case 'node':
            if (beginNode) { // nested node means it is goruping node elements
                currentObj.groups = currentObj.groups || [ ];
                currentObj.groups.push(currentGroup);
                currentGroup.parent = currentObj;
                currentObj = currentGroup;
            } else {
                beginNode = true;
                endNode = false;
            }

            currentGroup = { name: node.attributes.name, node: node.attributes.name, parent: undefined }; // parent is a temporary reference, removed on ending the group
            currentPart = node.attributes.name;
            break;
        }
    };

    parser.onattribute = onattribute;
    parser.onend = onend;

    return {
        dae2grouping: function(xml) {
            groupingObj = { };
            currentObj = undefined;
            currentGroup = undefined;
            currentPart = undefined;
            beginNode = false;
            endNode = false;
            parser.write(xml).close();
            return groupingObj;
        },
        parser: parser
    };
};

module.exports = dae2grouping;

},{"sax":11}],4:[function(require,module,exports){
// Copyright 2015, SRI International

'use strict';

var sax = require("sax");

function grouping2js(options) {
    var options = options || { },
        strict = options.strict || true,
        onerror = options.onerror || function(error) { /* an error happened */ },
        ontext = options.ontext || function(text) { /* got some text. text is the string body of the tag, called twice after open and before end  */ },
        onattribute = options.onattribute || function(attr) { /* an attribute.  attr has "name" and "value" */ },
        onend = options.onend || function() { /* parser stream is done, and ready to have more stuff written to it */ },
        parser = sax.parser(strict),
        groupingObj,
        currentObj,
        beginGrouping; // false

    parser.onerror = onerror; // be sure to parser.close() or parser.resume()
    parser.ontext = ontext;

    parser.onclosetag = function(name) { // closing a tag. name is the name from onopentag node.name
        if (!beginGrouping) return;

        if (name == 'group') {
            var p = currentObj.parent;
            delete currentObj.parent;
            currentObj = p;
        }
    };

    parser.onopentag = function(node) { // opened a tag. node has "name" and "attributes", isSelfClosing
        switch (node.name) {
        case 'grouping':
            groupingObj.name = node.attributes.name;
            currentObj = groupingObj;
            beginGrouping = true;
            break;
        case 'group':
            if (!beginGrouping) break;

            var g = { name: node.attributes.name, node: node.attributes.node };

            currentObj.groups = currentObj.groups || [ ];
            currentObj.groups.push(g);
            g.parent = currentObj;
            currentObj = g;
            break;
        case 'part':
            if (!beginGrouping) break;

            currentObj.parts = currentObj.parts || [ ];
            currentObj.parts.push(node.attributes.node);
            break;
        }
    };

    parser.onattribute = onattribute;
    parser.onend = onend;

    return {
        grouping2js: function(xml) {
            groupingObj = { };
            currentObj = undefined;
            beginGrouping = false;
            parser.write(xml).close();
            return groupingObj;
        },
        parser: parser
    };
};

module.exports = grouping2js;

},{"sax":11}],5:[function(require,module,exports){
// Copyright 2015, SRI International

'use strict';

var sax = require("sax");

function semantic2js(options) {
    var options = options || { },
        strict = options.strict || true,
        onerror = options.onerror || function(error) { /* an error happened. */ },
        onattribute = options.onattribute || function(attr) { /* an attribute.  attr has "name" and "value" */ },
        onend = options.onend || function() { /* parser stream is done, and ready to have more stuff written to it. */ },
        parser = sax.parser(strict),
        semanticObj,
        currentObj,
        currentNode,
        beginS3D, // false
        beginOntext; // false

    parser.onerror = onerror; // be sure to parser.close() or parser.resume()

    parser.ontext = function(text) { // got some text. text is the string body of the tag, called twice after open and before end 
        if (!beginS3D) return;

        beginOntext = !beginOntext;

        if (!beginOntext || text.trim() == '') return;

        switch (currentNode) {
        case 'description':
            currentObj.description = text;
            break;
        case 'author':
            currentObj.author = text;
            break;
        case 'created':
            currentObj.created = text;
            break;
        case 'modified':
            currentObj.modified = text;
            break;
        }
    };

    parser.onclosetag = function(name) { // closing a tag. name is the name from onopentag node.name
        if (!beginS3D) return;

        currentNode = name;

        if (name == 'head') currentObj = semanticObj;
        else if (name == 'semantic_mapping') beginS3D = false;
    };

    parser.onopentag = function(node) { // opened a tag. node has "name" and "attributes", isSelfClosing
        currentNode = node.name;

        if (currentNode == 'S3D') beginS3D = true;

        if (!beginS3D) return;

        switch (currentNode) {
        case 'S3D':
            currentObj = semanticObj;
            break;
        case 'head':
            currentObj.head = { };
            currentObj = currentObj.head;
            break;
        case 'description':
            currentObj.description = undefined;
            break;
        case 'author':
            currentObj.author = undefined;
            break;
        case 'created':
            currentObj.created = undefined;
            break;
        case 'modified':
            currentObj.modified = undefined;
            break;
        case 'flora_base':
            currentObj.flora_base = {
                id: node.attributes.id,
                uri: node.attributes.uri
            };
            break;
        case 'semantic_mapping':
            currentObj.semantic_mapping = { };
            currentObj = currentObj.semantic_mapping;
            break;
        case 'asset':
            currentObj.asset = {
                name: node.attributes.name,
                uri: node.attributes.uri,
                sid: node.attributes.sid,
                flora_ref: node.attributes.flora_ref,
                groups: [ ],
                objs: [ ]
            };
            currentObj = currentObj.asset;
            break;
        case 'group':
            currentObj.groups.push({
                name: node.attributes.name,
                node: node.attributes.node,
                sid: node.attributes.sid,
                flora_ref: node.attributes.flora_ref
            });
            break;
        case 'object':
            currentObj.objs.push({
                name: node.attributes.name,
                node: node.attributes.node,
                sid: node.attributes.sid,
                flora_ref: node.attributes.flora_ref
            });
            break;
        }
    };

    parser.onattribute = onattribute;
    parser.onend = onend;

    return {
        semantic2js: function(xml) {
            semanticObj = { };
            currentObj = undefined;
            currentNode = undefined;
            beginS3D = false;
            beginOntext = false;
            parser.write(xml).close();
            return semanticObj;
        },
        parser: parser
    };
};

module.exports = semantic2js;

},{"sax":11}],6:[function(require,module,exports){
/**
The following batches are equivalent:

var beautify_js = require('js-beautify');
var beautify_js = require('js-beautify').js;
var beautify_js = require('js-beautify').js_beautify;

var beautify_css = require('js-beautify').css;
var beautify_css = require('js-beautify').css_beautify;

var beautify_html = require('js-beautify').html;
var beautify_html = require('js-beautify').html_beautify;

All methods returned accept two arguments, the source string and an options object.
**/

function get_beautify(js_beautify, css_beautify, html_beautify) {
    // the default is js
    var beautify = function (src, config) {
        return js_beautify.js_beautify(src, config);
    };

    // short aliases
    beautify.js   = js_beautify.js_beautify;
    beautify.css  = css_beautify.css_beautify;
    beautify.html = html_beautify.html_beautify;

    // legacy aliases
    beautify.js_beautify   = js_beautify.js_beautify;
    beautify.css_beautify  = css_beautify.css_beautify;
    beautify.html_beautify = html_beautify.html_beautify;

    return beautify;
}

if (typeof define === "function" && define.amd) {
    // Add support for AMD ( https://github.com/amdjs/amdjs-api/wiki/AMD#defineamd-property- )
    define([
        "./lib/beautify",
        "./lib/beautify-css",
        "./lib/beautify-html"
    ], function(js_beautify, css_beautify, html_beautify) {
        return get_beautify(js_beautify, css_beautify, html_beautify);
    });
} else {
    (function(mod) {
        var js_beautify = require('./lib/beautify');
        var css_beautify = require('./lib/beautify-css');
        var html_beautify = require('./lib/beautify-html');

        mod.exports = get_beautify(js_beautify, css_beautify, html_beautify);

    })(module);
}


},{"./lib/beautify":9,"./lib/beautify-css":7,"./lib/beautify-html":8}],7:[function(require,module,exports){
(function (global){
/*jshint curly:true, eqeqeq:true, laxbreak:true, noempty:false */
/*

  The MIT License (MIT)

  Copyright (c) 2007-2013 Einar Lielmanis and contributors.

  Permission is hereby granted, free of charge, to any person
  obtaining a copy of this software and associated documentation files
  (the "Software"), to deal in the Software without restriction,
  including without limitation the rights to use, copy, modify, merge,
  publish, distribute, sublicense, and/or sell copies of the Software,
  and to permit persons to whom the Software is furnished to do so,
  subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
  BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
  ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.


 CSS Beautifier
---------------

    Written by Harutyun Amirjanyan, (amirjanyan@gmail.com)

    Based on code initially developed by: Einar Lielmanis, <einar@jsbeautifier.org>
        http://jsbeautifier.org/

    Usage:
        css_beautify(source_text);
        css_beautify(source_text, options);

    The options are (default in brackets):
        indent_size (4)                   — indentation size,
        indent_char (space)               — character to indent with,
        selector_separator_newline (true) - separate selectors with newline or
                                            not (e.g. "a,\nbr" or "a, br")
        end_with_newline (false)          - end with a newline

    e.g

    css_beautify(css_source_text, {
      'indent_size': 1,
      'indent_char': '\t',
      'selector_separator': ' ',
      'end_with_newline': false,
    });
*/

// http://www.w3.org/TR/CSS21/syndata.html#tokenization
// http://www.w3.org/TR/css3-syntax/

(function() {
    function css_beautify(source_text, options) {
        options = options || {};
        var indentSize = options.indent_size || 4;
        var indentCharacter = options.indent_char || ' ';
        var selectorSeparatorNewline = (options.selector_separator_newline === undefined) ? true : options.selector_separator_newline;
        var end_with_newline = (options.end_with_newline === undefined) ? false : options.end_with_newline;

        // compatibility
        if (typeof indentSize === "string") {
            indentSize = parseInt(indentSize, 10);
        }


        // tokenizer
        var whiteRe = /^\s+$/;
        var wordRe = /[\w$\-_]/;

        var pos = -1,
            ch;

        function next() {
            ch = source_text.charAt(++pos);
            return ch || '';
        }

        function peek(skipWhitespace) {
            var prev_pos = pos;
            if (skipWhitespace) {
                eatWhitespace();
            }
            result = source_text.charAt(pos + 1) || '';
            pos = prev_pos - 1;
            next();
            return result;
        }

        function eatString(endChars) {
            var start = pos;
            while (next()) {
                if (ch === "\\") {
                    next();
                } else if (endChars.indexOf(ch) !== -1) {
                    break;
                } else if (ch === "\n") {
                    break;
                }
            }
            return source_text.substring(start, pos + 1);
        }

        function peekString(endChar) {
            var prev_pos = pos;
            var str = eatString(endChar);
            pos = prev_pos - 1;
            next();
            return str;
        }

        function eatWhitespace() {
            var result = '';
            while (whiteRe.test(peek())) {
                next()
                result += ch;
            }
            return result;
        }

        function skipWhitespace() {
            var result = '';
            if (ch && whiteRe.test(ch)) {
                result = ch;
            }
            while (whiteRe.test(next())) {
                result += ch
            }
            return result;
        }

        function eatComment(singleLine) {
            var start = pos;
            var singleLine = peek() === "/";
            next();
            while (next()) {
                if (!singleLine && ch === "*" && peek() === "/") {
                    next();
                    break;
                } else if (singleLine && ch === "\n") {
                    return source_text.substring(start, pos);
                }
            }

            return source_text.substring(start, pos) + ch;
        }


        function lookBack(str) {
            return source_text.substring(pos - str.length, pos).toLowerCase() ===
                str;
        }

        // Nested pseudo-class if we are insideRule
        // and the next special character found opens
        // a new block
        function foundNestedPseudoClass() {
            for (var i = pos + 1; i < source_text.length; i++){
                var ch = source_text.charAt(i);
                if (ch === "{"){
                    return true;
                } else if (ch === ";" || ch === "}" || ch === ")") {
                    return false;
                }
            }
            return false;
        }

        // printer
        var basebaseIndentString = source_text.match(/^[\t ]*/)[0];
        var singleIndent = new Array(indentSize + 1).join(indentCharacter);
        var indentLevel = 0;
        var nestedLevel = 0;

        function indent() {
            indentLevel++;
            basebaseIndentString += singleIndent;
        }

        function outdent() {
            indentLevel--;
            basebaseIndentString = basebaseIndentString.slice(0, -indentSize);
        }

        var print = {};
        print["{"] = function(ch) {
            print.singleSpace();
            output.push(ch);
            print.newLine();
        };
        print["}"] = function(ch) {
            print.newLine();
            output.push(ch);
            print.newLine();
        };

        print._lastCharWhitespace = function() {
            return whiteRe.test(output[output.length - 1]);
        };

        print.newLine = function(keepWhitespace) {
            if (!keepWhitespace) {
                print.trim();
            }

            if (output.length) {
                output.push('\n');
            }
            if (basebaseIndentString) {
                output.push(basebaseIndentString);
            }
        };
        print.singleSpace = function() {
            if (output.length && !print._lastCharWhitespace()) {
                output.push(' ');
            }
        };

        print.trim = function() {
            while (print._lastCharWhitespace()) {
                output.pop();
            }
        };

        
        var output = [];
        if (basebaseIndentString) {
            output.push(basebaseIndentString);
        }
        /*_____________________--------------------_____________________*/

        var insideRule = false;
        var enteringConditionalGroup = false;
        var top_ch = '';
        var last_top_ch = '';

        while (true) {
            var whitespace = skipWhitespace();
            var isAfterSpace = whitespace !== '';
            var isAfterNewline = whitespace.indexOf('\n') !== -1;
            var last_top_ch = top_ch;
            var top_ch = ch;

            if (!ch) {
                break;
            } else if (ch === '/' && peek() === '*') { /* css comment */
                var header = lookBack("");
                print.newLine();
                output.push(eatComment());
                print.newLine();
                if (header) {
                    print.newLine(true);
                }
            } else if (ch === '/' && peek() === '/') { // single line comment
                if (!isAfterNewline && last_top_ch !== '{') {
                    print.trim();
                }
                print.singleSpace();
                output.push(eatComment());
                print.newLine();
            } else if (ch === '@') {
                // pass along the space we found as a separate item
                if (isAfterSpace) {
                    print.singleSpace();
                }
                output.push(ch);

                // strip trailing space, if present, for hash property checks
                var variableOrRule = peekString(": ,;{}()[]/='\"").replace(/\s$/, '');

                // might be a nesting at-rule
                if (variableOrRule in css_beautify.NESTED_AT_RULE) {
                    nestedLevel += 1;
                    if (variableOrRule in css_beautify.CONDITIONAL_GROUP_RULE) {
                        enteringConditionalGroup = true;
                    }
                } else if (': '.indexOf(variableOrRule[variableOrRule.length -1]) >= 0) {
                    //we have a variable, add it and insert one space before continuing
                    next();
                    variableOrRule = eatString(": ").replace(/\s$/, '');
                    output.push(variableOrRule);
                    print.singleSpace();
                }
            } else if (ch === '{') {
                if (peek(true) === '}') {
                    eatWhitespace();
                    next();
                    print.singleSpace();
                    output.push("{}");
                } else {
                    indent();
                    print["{"](ch);
                    // when entering conditional groups, only rulesets are allowed
                    if (enteringConditionalGroup) {
                        enteringConditionalGroup = false;
                        insideRule = (indentLevel > nestedLevel);
                    } else {
                        // otherwise, declarations are also allowed
                        insideRule = (indentLevel >= nestedLevel);
                    }
                }
            } else if (ch === '}') {
                outdent();
                print["}"](ch);
                insideRule = false;
                if (nestedLevel) {
                    nestedLevel--;
                }
            } else if (ch === ":") {
                eatWhitespace();
                if ((insideRule || enteringConditionalGroup) && 
                        !(lookBack("&") || foundNestedPseudoClass())) {
                    // 'property: value' delimiter
                    // which could be in a conditional group query
                    output.push(':');
                    print.singleSpace();
                } else {
                    // sass/less parent reference don't use a space
                    // sass nested pseudo-class don't use a space
                    if (peek() === ":") {
                        // pseudo-element
                        next();
                        output.push("::");
                    } else {
                        // pseudo-class
                        output.push(':');
                    }
                }
            } else if (ch === '"' || ch === '\'') {
                if (isAfterSpace) {
                    print.singleSpace();
                }
                output.push(eatString(ch));
            } else if (ch === ';') {
                output.push(ch);
                print.newLine();
            } else if (ch === '(') { // may be a url
                if (lookBack("url")) {
                    output.push(ch);
                    eatWhitespace();
                    if (next()) {
                        if (ch !== ')' && ch !== '"' && ch !== '\'') {
                            output.push(eatString(')'));
                        } else {
                            pos--;
                        }
                    }
                } else {
                    if (isAfterSpace) {
                        print.singleSpace();
                    }
                    output.push(ch);
                    eatWhitespace();
                }
            } else if (ch === ')') {
                output.push(ch);
            } else if (ch === ',') {
                output.push(ch);
                eatWhitespace();
                if (!insideRule && selectorSeparatorNewline) {
                    print.newLine();
                } else {
                    print.singleSpace();
                }
            } else if (ch === ']') {
                output.push(ch);
            } else if (ch === '[') {
                if (isAfterSpace) {
                    print.singleSpace();
                }
                output.push(ch);
            } else if (ch === '=') { // no whitespace before or after
                eatWhitespace();
                output.push(ch);
            } else {
                if (isAfterSpace) {
                    print.singleSpace();
                }

                output.push(ch);
            }
        }


        var sweetCode = output.join('').replace(/[\r\n\t ]+$/, '');

        // establish end_with_newline
        if (end_with_newline) {
            sweetCode += "\n";
        }

        return sweetCode;
    }

    // https://developer.mozilla.org/en-US/docs/Web/CSS/At-rule
    css_beautify.NESTED_AT_RULE = {
        "@page": true,
        "@font-face": true,
        "@keyframes": true,
        // also in CONDITIONAL_GROUP_RULE below
        "@media": true,
        "@supports": true,
        "@document": true
    };
    css_beautify.CONDITIONAL_GROUP_RULE = {
        "@media": true,
        "@supports": true,
        "@document": true
    };

    /*global define */
    if (typeof define === "function" && define.amd) {
        // Add support for AMD ( https://github.com/amdjs/amdjs-api/wiki/AMD#defineamd-property- )
        define([], function() {
            return {
                css_beautify: css_beautify
            };
        });
    } else if (typeof exports !== "undefined") {
        // Add support for CommonJS. Just put this file somewhere on your require.paths
        // and you will be able to `var html_beautify = require("beautify").html_beautify`.
        exports.css_beautify = css_beautify;
    } else if (typeof window !== "undefined") {
        // If we're running a web page and don't have either of the above, add our one global
        window.css_beautify = css_beautify;
    } else if (typeof global !== "undefined") {
        // If we don't even have window, try global.
        global.css_beautify = css_beautify;
    }

}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],8:[function(require,module,exports){
(function (global){
/*jshint curly:true, eqeqeq:true, laxbreak:true, noempty:false */
/*

  The MIT License (MIT)

  Copyright (c) 2007-2013 Einar Lielmanis and contributors.

  Permission is hereby granted, free of charge, to any person
  obtaining a copy of this software and associated documentation files
  (the "Software"), to deal in the Software without restriction,
  including without limitation the rights to use, copy, modify, merge,
  publish, distribute, sublicense, and/or sell copies of the Software,
  and to permit persons to whom the Software is furnished to do so,
  subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
  BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
  ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.


 Style HTML
---------------

  Written by Nochum Sossonko, (nsossonko@hotmail.com)

  Based on code initially developed by: Einar Lielmanis, <einar@jsbeautifier.org>
    http://jsbeautifier.org/

  Usage:
    style_html(html_source);

    style_html(html_source, options);

  The options are:
    indent_inner_html (default false)  — indent <head> and <body> sections,
    indent_size (default 4)          — indentation size,
    indent_char (default space)      — character to indent with,
    wrap_line_length (default 250)            -  maximum amount of characters per line (0 = disable)
    brace_style (default "collapse") - "collapse" | "expand" | "end-expand"
            put braces on the same line as control statements (default), or put braces on own line (Allman / ANSI style), or just put end braces on own line.
    unformatted (defaults to inline tags) - list of tags, that shouldn't be reformatted
    indent_scripts (default normal)  - "keep"|"separate"|"normal"
    preserve_newlines (default true) - whether existing line breaks before elements should be preserved
                                        Only works before elements, not inside tags or for text.
    max_preserve_newlines (default unlimited) - maximum number of line breaks to be preserved in one chunk
    indent_handlebars (default false) - format and indent {{#foo}} and {{/foo}}
    end_with_newline (false)          - end with a newline


    e.g.

    style_html(html_source, {
      'indent_inner_html': false,
      'indent_size': 2,
      'indent_char': ' ',
      'wrap_line_length': 78,
      'brace_style': 'expand',
      'unformatted': ['a', 'sub', 'sup', 'b', 'i', 'u'],
      'preserve_newlines': true,
      'max_preserve_newlines': 5,
      'indent_handlebars': false
    });
*/

(function() {

    function trim(s) {
        return s.replace(/^\s+|\s+$/g, '');
    }

    function ltrim(s) {
        return s.replace(/^\s+/g, '');
    }

    function rtrim(s) {
        return s.replace(/\s+$/g,'');
    }

    function style_html(html_source, options, js_beautify, css_beautify) {
        //Wrapper function to invoke all the necessary constructors and deal with the output.

        var multi_parser,
            indent_inner_html,
            indent_size,
            indent_character,
            wrap_line_length,
            brace_style,
            unformatted,
            preserve_newlines,
            max_preserve_newlines,
            indent_handlebars,
            end_with_newline;

        options = options || {};

        // backwards compatibility to 1.3.4
        if ((options.wrap_line_length === undefined || parseInt(options.wrap_line_length, 10) === 0) &&
                (options.max_char !== undefined && parseInt(options.max_char, 10) !== 0)) {
            options.wrap_line_length = options.max_char;
        }

        indent_inner_html = (options.indent_inner_html === undefined) ? false : options.indent_inner_html;
        indent_size = (options.indent_size === undefined) ? 4 : parseInt(options.indent_size, 10);
        indent_character = (options.indent_char === undefined) ? ' ' : options.indent_char;
        brace_style = (options.brace_style === undefined) ? 'collapse' : options.brace_style;
        wrap_line_length =  parseInt(options.wrap_line_length, 10) === 0 ? 32786 : parseInt(options.wrap_line_length || 250, 10);
        unformatted = options.unformatted || ['a', 'span', 'img', 'bdo', 'em', 'strong', 'dfn', 'code', 'samp', 'kbd', 'var', 'cite', 'abbr', 'acronym', 'q', 'sub', 'sup', 'tt', 'i', 'b', 'big', 'small', 'u', 's', 'strike', 'font', 'ins', 'del', 'pre', 'address', 'dt', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        preserve_newlines = (options.preserve_newlines === undefined) ? true : options.preserve_newlines;
        max_preserve_newlines = preserve_newlines ?
            (isNaN(parseInt(options.max_preserve_newlines, 10)) ? 32786 : parseInt(options.max_preserve_newlines, 10))
            : 0;
        indent_handlebars = (options.indent_handlebars === undefined) ? false : options.indent_handlebars;
        end_with_newline = (options.end_with_newline === undefined) ? false : options.end_with_newline;

        function Parser() {

            this.pos = 0; //Parser position
            this.token = '';
            this.current_mode = 'CONTENT'; //reflects the current Parser mode: TAG/CONTENT
            this.tags = { //An object to hold tags, their position, and their parent-tags, initiated with default values
                parent: 'parent1',
                parentcount: 1,
                parent1: ''
            };
            this.tag_type = '';
            this.token_text = this.last_token = this.last_text = this.token_type = '';
            this.newlines = 0;
            this.indent_content = indent_inner_html;

            this.Utils = { //Uilities made available to the various functions
                whitespace: "\n\r\t ".split(''),
                single_token: 'br,input,link,meta,!doctype,basefont,base,area,hr,wbr,param,img,isindex,?xml,embed,?php,?,?='.split(','), //all the single tags for HTML
                extra_liners: 'head,body,/html'.split(','), //for tags that need a line of whitespace before them
                in_array: function(what, arr) {
                    for (var i = 0; i < arr.length; i++) {
                        if (what === arr[i]) {
                            return true;
                        }
                    }
                    return false;
                }
            };

            // Return true iff the given text is composed entirely of
            // whitespace.
            this.is_whitespace = function(text) {
                for (var n = 0; n < text.length; text++) {
                    if (!this.Utils.in_array(text.charAt(n), this.Utils.whitespace)) {
                        return false;
                    }
                }
                return true;
            }

            this.traverse_whitespace = function() {
                var input_char = '';

                input_char = this.input.charAt(this.pos);
                if (this.Utils.in_array(input_char, this.Utils.whitespace)) {
                    this.newlines = 0;
                    while (this.Utils.in_array(input_char, this.Utils.whitespace)) {
                        if (preserve_newlines && input_char === '\n' && this.newlines <= max_preserve_newlines) {
                            this.newlines += 1;
                        }

                        this.pos++;
                        input_char = this.input.charAt(this.pos);
                    }
                    return true;
                }
                return false;
            };

            // Append a space to the given content (string array) or, if we are
            // at the wrap_line_length, append a newline/indentation.
            this.space_or_wrap = function(content) {
                if (this.line_char_count >= this.wrap_line_length) { //insert a line when the wrap_line_length is reached
                    this.print_newline(false, content);
                    this.print_indentation(content);
                } else {
                    this.line_char_count++;
                    content.push(' ');
                }
            };

            this.get_content = function() { //function to capture regular content between tags
                var input_char = '',
                    content = [],
                    space = false; //if a space is needed

                while (this.input.charAt(this.pos) !== '<') {
                    if (this.pos >= this.input.length) {
                        return content.length ? content.join('') : ['', 'TK_EOF'];
                    }

                    if (this.traverse_whitespace()) {
                        this.space_or_wrap(content);
                        continue;
                    }

                    if (indent_handlebars) {
                        // Handlebars parsing is complicated.
                        // {{#foo}} and {{/foo}} are formatted tags.
                        // {{something}} should get treated as content, except:
                        // {{else}} specifically behaves like {{#if}} and {{/if}}
                        var peek3 = this.input.substr(this.pos, 3);
                        if (peek3 === '{{#' || peek3 === '{{/') {
                            // These are tags and not content.
                            break;
                        } else if (this.input.substr(this.pos, 2) === '{{') {
                            if (this.get_tag(true) === '{{else}}') {
                                break;
                            }
                        }
                    }

                    input_char = this.input.charAt(this.pos);
                    this.pos++;
                    this.line_char_count++;
                    content.push(input_char); //letter at-a-time (or string) inserted to an array
                }
                return content.length ? content.join('') : '';
            };

            this.get_contents_to = function(name) { //get the full content of a script or style to pass to js_beautify
                if (this.pos === this.input.length) {
                    return ['', 'TK_EOF'];
                }
                var input_char = '';
                var content = '';
                var reg_match = new RegExp('</' + name + '\\s*>', 'igm');
                reg_match.lastIndex = this.pos;
                var reg_array = reg_match.exec(this.input);
                var end_script = reg_array ? reg_array.index : this.input.length; //absolute end of script
                if (this.pos < end_script) { //get everything in between the script tags
                    content = this.input.substring(this.pos, end_script);
                    this.pos = end_script;
                }
                return content;
            };

            this.record_tag = function(tag) { //function to record a tag and its parent in this.tags Object
                if (this.tags[tag + 'count']) { //check for the existence of this tag type
                    this.tags[tag + 'count']++;
                    this.tags[tag + this.tags[tag + 'count']] = this.indent_level; //and record the present indent level
                } else { //otherwise initialize this tag type
                    this.tags[tag + 'count'] = 1;
                    this.tags[tag + this.tags[tag + 'count']] = this.indent_level; //and record the present indent level
                }
                this.tags[tag + this.tags[tag + 'count'] + 'parent'] = this.tags.parent; //set the parent (i.e. in the case of a div this.tags.div1parent)
                this.tags.parent = tag + this.tags[tag + 'count']; //and make this the current parent (i.e. in the case of a div 'div1')
            };

            this.retrieve_tag = function(tag) { //function to retrieve the opening tag to the corresponding closer
                if (this.tags[tag + 'count']) { //if the openener is not in the Object we ignore it
                    var temp_parent = this.tags.parent; //check to see if it's a closable tag.
                    while (temp_parent) { //till we reach '' (the initial value);
                        if (tag + this.tags[tag + 'count'] === temp_parent) { //if this is it use it
                            break;
                        }
                        temp_parent = this.tags[temp_parent + 'parent']; //otherwise keep on climbing up the DOM Tree
                    }
                    if (temp_parent) { //if we caught something
                        this.indent_level = this.tags[tag + this.tags[tag + 'count']]; //set the indent_level accordingly
                        this.tags.parent = this.tags[temp_parent + 'parent']; //and set the current parent
                    }
                    delete this.tags[tag + this.tags[tag + 'count'] + 'parent']; //delete the closed tags parent reference...
                    delete this.tags[tag + this.tags[tag + 'count']]; //...and the tag itself
                    if (this.tags[tag + 'count'] === 1) {
                        delete this.tags[tag + 'count'];
                    } else {
                        this.tags[tag + 'count']--;
                    }
                }
            };

            this.indent_to_tag = function(tag) {
                // Match the indentation level to the last use of this tag, but don't remove it.
                if (!this.tags[tag + 'count']) {
                    return;
                }
                var temp_parent = this.tags.parent;
                while (temp_parent) {
                    if (tag + this.tags[tag + 'count'] === temp_parent) {
                        break;
                    }
                    temp_parent = this.tags[temp_parent + 'parent'];
                }
                if (temp_parent) {
                    this.indent_level = this.tags[tag + this.tags[tag + 'count']];
                }
            };

            this.get_tag = function(peek) { //function to get a full tag and parse its type
                var input_char = '',
                    content = [],
                    comment = '',
                    space = false,
                    tag_start, tag_end,
                    tag_start_char,
                    orig_pos = this.pos,
                    orig_line_char_count = this.line_char_count;

                peek = peek !== undefined ? peek : false;

                do {
                    if (this.pos >= this.input.length) {
                        if (peek) {
                            this.pos = orig_pos;
                            this.line_char_count = orig_line_char_count;
                        }
                        return content.length ? content.join('') : ['', 'TK_EOF'];
                    }

                    input_char = this.input.charAt(this.pos);
                    this.pos++;

                    if (this.Utils.in_array(input_char, this.Utils.whitespace)) { //don't want to insert unnecessary space
                        space = true;
                        continue;
                    }

                    if (input_char === "'" || input_char === '"') {
                        input_char += this.get_unformatted(input_char);
                        space = true;

                    }

                    if (input_char === '=') { //no space before =
                        space = false;
                    }

                    if (content.length && content[content.length - 1] !== '=' && input_char !== '>' && space) {
                        //no space after = or before >
                        this.space_or_wrap(content);
                        space = false;
                    }

                    if (indent_handlebars && tag_start_char === '<') {
                        // When inside an angle-bracket tag, put spaces around
                        // handlebars not inside of strings.
                        if ((input_char + this.input.charAt(this.pos)) === '{{') {
                            input_char += this.get_unformatted('}}');
                            if (content.length && content[content.length - 1] !== ' ' && content[content.length - 1] !== '<') {
                                input_char = ' ' + input_char;
                            }
                            space = true;
                        }
                    }

                    if (input_char === '<' && !tag_start_char) {
                        tag_start = this.pos - 1;
                        tag_start_char = '<';
                    }

                    if (indent_handlebars && !tag_start_char) {
                        if (content.length >= 2 && content[content.length - 1] === '{' && content[content.length - 2] == '{') {
                            if (input_char === '#' || input_char === '/') {
                                tag_start = this.pos - 3;
                            } else {
                                tag_start = this.pos - 2;
                            }
                            tag_start_char = '{';
                        }
                    }

                    this.line_char_count++;
                    content.push(input_char); //inserts character at-a-time (or string)

                    if (content[1] && content[1] === '!') { //if we're in a comment, do something special
                        // We treat all comments as literals, even more than preformatted tags
                        // we just look for the appropriate close tag
                        content = [this.get_comment(tag_start)];
                        break;
                    }

                    if (indent_handlebars && tag_start_char === '{' && content.length > 2 && content[content.length - 2] === '}' && content[content.length - 1] === '}') {
                        break;
                    }
                } while (input_char !== '>');

                var tag_complete = content.join('');
                var tag_index;
                var tag_offset;

                if (tag_complete.indexOf(' ') !== -1) { //if there's whitespace, thats where the tag name ends
                    tag_index = tag_complete.indexOf(' ');
                } else if (tag_complete[0] === '{') {
                    tag_index = tag_complete.indexOf('}');
                } else { //otherwise go with the tag ending
                    tag_index = tag_complete.indexOf('>');
                }
                if (tag_complete[0] === '<' || !indent_handlebars) {
                    tag_offset = 1;
                } else {
                    tag_offset = tag_complete[2] === '#' ? 3 : 2;
                }
                var tag_check = tag_complete.substring(tag_offset, tag_index).toLowerCase();
                if (tag_complete.charAt(tag_complete.length - 2) === '/' ||
                    this.Utils.in_array(tag_check, this.Utils.single_token)) { //if this tag name is a single tag type (either in the list or has a closing /)
                    if (!peek) {
                        this.tag_type = 'SINGLE';
                    }
                } else if (indent_handlebars && tag_complete[0] === '{' && tag_check === 'else') {
                    if (!peek) {
                        this.indent_to_tag('if');
                        this.tag_type = 'HANDLEBARS_ELSE';
                        this.indent_content = true;
                        this.traverse_whitespace();
                    }
                } else if (this.is_unformatted(tag_check, unformatted)) { // do not reformat the "unformatted" tags
                    comment = this.get_unformatted('</' + tag_check + '>', tag_complete); //...delegate to get_unformatted function
                    content.push(comment);
                    tag_end = this.pos - 1;
                    this.tag_type = 'SINGLE';
                } else if (tag_check === 'script' &&
                    (tag_complete.search('type') === -1 ||
                    (tag_complete.search('type') > -1 &&
                    tag_complete.search(/\b(text|application)\/(x-)?(javascript|ecmascript|jscript|livescript)/) > -1))) {
                    if (!peek) {
                        this.record_tag(tag_check);
                        this.tag_type = 'SCRIPT';
                    }
                } else if (tag_check === 'style' &&
                    (tag_complete.search('type') === -1 ||
                    (tag_complete.search('type') > -1 && tag_complete.search('text/css') > -1))) {
                    if (!peek) {
                        this.record_tag(tag_check);
                        this.tag_type = 'STYLE';
                    }
                } else if (tag_check.charAt(0) === '!') { //peek for <! comment
                    // for comments content is already correct.
                    if (!peek) {
                        this.tag_type = 'SINGLE';
                        this.traverse_whitespace();
                    }
                } else if (!peek) {
                    if (tag_check.charAt(0) === '/') { //this tag is a double tag so check for tag-ending
                        this.retrieve_tag(tag_check.substring(1)); //remove it and all ancestors
                        this.tag_type = 'END';
                    } else { //otherwise it's a start-tag
                        this.record_tag(tag_check); //push it on the tag stack
                        if (tag_check.toLowerCase() !== 'html') {
                            this.indent_content = true;
                        }
                        this.tag_type = 'START';
                    }

                    // Allow preserving of newlines after a start or end tag
                    if (this.traverse_whitespace()) {
                        this.space_or_wrap(content);
                    }

                    if (this.Utils.in_array(tag_check, this.Utils.extra_liners)) { //check if this double needs an extra line
                        this.print_newline(false, this.output);
                        if (this.output.length && this.output[this.output.length - 2] !== '\n') {
                            this.print_newline(true, this.output);
                        }
                    }
                }

                if (peek) {
                    this.pos = orig_pos;
                    this.line_char_count = orig_line_char_count;
                }

                return content.join(''); //returns fully formatted tag
            };

            this.get_comment = function(start_pos) { //function to return comment content in its entirety
                // this is will have very poor perf, but will work for now.
                var comment = '',
                    delimiter = '>',
                    matched = false;

                this.pos = start_pos;
                input_char = this.input.charAt(this.pos);
                this.pos++;

                while (this.pos <= this.input.length) {
                    comment += input_char;

                    // only need to check for the delimiter if the last chars match
                    if (comment[comment.length - 1] === delimiter[delimiter.length - 1] &&
                        comment.indexOf(delimiter) !== -1) {
                        break;
                    }

                    // only need to search for custom delimiter for the first few characters
                    if (!matched && comment.length < 10) {
                        if (comment.indexOf('<![if') === 0) { //peek for <![if conditional comment
                            delimiter = '<![endif]>';
                            matched = true;
                        } else if (comment.indexOf('<![cdata[') === 0) { //if it's a <[cdata[ comment...
                            delimiter = ']]>';
                            matched = true;
                        } else if (comment.indexOf('<![') === 0) { // some other ![ comment? ...
                            delimiter = ']>';
                            matched = true;
                        } else if (comment.indexOf('<!--') === 0) { // <!-- comment ...
                            delimiter = '-->';
                            matched = true;
                        }
                    }

                    input_char = this.input.charAt(this.pos);
                    this.pos++;
                }

                return comment;
            };

            this.get_unformatted = function(delimiter, orig_tag) { //function to return unformatted content in its entirety

                if (orig_tag && orig_tag.toLowerCase().indexOf(delimiter) !== -1) {
                    return '';
                }
                var input_char = '';
                var content = '';
                var min_index = 0;
                var space = true;
                do {

                    if (this.pos >= this.input.length) {
                        return content;
                    }

                    input_char = this.input.charAt(this.pos);
                    this.pos++;

                    if (this.Utils.in_array(input_char, this.Utils.whitespace)) {
                        if (!space) {
                            this.line_char_count--;
                            continue;
                        }
                        if (input_char === '\n' || input_char === '\r') {
                            content += '\n';
                            /*  Don't change tab indention for unformatted blocks.  If using code for html editing, this will greatly affect <pre> tags if they are specified in the 'unformatted array'
                for (var i=0; i<this.indent_level; i++) {
                  content += this.indent_string;
                }
                space = false; //...and make sure other indentation is erased
                */
                            this.line_char_count = 0;
                            continue;
                        }
                    }
                    content += input_char;
                    this.line_char_count++;
                    space = true;

                    if (indent_handlebars && input_char === '{' && content.length && content[content.length - 2] === '{') {
                        // Handlebars expressions in strings should also be unformatted.
                        content += this.get_unformatted('}}');
                        // These expressions are opaque.  Ignore delimiters found in them.
                        min_index = content.length;
                    }
                } while (content.toLowerCase().indexOf(delimiter, min_index) === -1);
                return content;
            };

            this.get_token = function() { //initial handler for token-retrieval
                var token;

                if (this.last_token === 'TK_TAG_SCRIPT' || this.last_token === 'TK_TAG_STYLE') { //check if we need to format javascript
                    var type = this.last_token.substr(7);
                    token = this.get_contents_to(type);
                    if (typeof token !== 'string') {
                        return token;
                    }
                    return [token, 'TK_' + type];
                }
                if (this.current_mode === 'CONTENT') {
                    token = this.get_content();
                    if (typeof token !== 'string') {
                        return token;
                    } else {
                        return [token, 'TK_CONTENT'];
                    }
                }

                if (this.current_mode === 'TAG') {
                    token = this.get_tag();
                    if (typeof token !== 'string') {
                        return token;
                    } else {
                        var tag_name_type = 'TK_TAG_' + this.tag_type;
                        return [token, tag_name_type];
                    }
                }
            };

            this.get_full_indent = function(level) {
                level = this.indent_level + level || 0;
                if (level < 1) {
                    return '';
                }

                return Array(level + 1).join(this.indent_string);
            };

            this.is_unformatted = function(tag_check, unformatted) {
                //is this an HTML5 block-level link?
                if (!this.Utils.in_array(tag_check, unformatted)) {
                    return false;
                }

                if (tag_check.toLowerCase() !== 'a' || !this.Utils.in_array('a', unformatted)) {
                    return true;
                }

                //at this point we have an  tag; is its first child something we want to remain
                //unformatted?
                var next_tag = this.get_tag(true /* peek. */ );

                // test next_tag to see if it is just html tag (no external content)
                var tag = (next_tag || "").match(/^\s*<\s*\/?([a-z]*)\s*[^>]*>\s*$/);

                // if next_tag comes back but is not an isolated tag, then
                // let's treat the 'a' tag as having content
                // and respect the unformatted option
                if (!tag || this.Utils.in_array(tag, unformatted)) {
                    return true;
                } else {
                    return false;
                }
            };

            this.printer = function(js_source, indent_character, indent_size, wrap_line_length, brace_style) { //handles input/output and some other printing functions

                this.input = js_source || ''; //gets the input for the Parser
                this.output = [];
                this.indent_character = indent_character;
                this.indent_string = '';
                this.indent_size = indent_size;
                this.brace_style = brace_style;
                this.indent_level = 0;
                this.wrap_line_length = wrap_line_length;
                this.line_char_count = 0; //count to see if wrap_line_length was exceeded

                for (var i = 0; i < this.indent_size; i++) {
                    this.indent_string += this.indent_character;
                }

                this.print_newline = function(force, arr) {
                    this.line_char_count = 0;
                    if (!arr || !arr.length) {
                        return;
                    }
                    if (force || (arr[arr.length - 1] !== '\n')) { //we might want the extra line
                        if ((arr[arr.length - 1] !== '\n')) {
                            arr[arr.length - 1] = rtrim(arr[arr.length - 1]);
                        }
                        arr.push('\n');
                    }
                };

                this.print_indentation = function(arr) {
                    for (var i = 0; i < this.indent_level; i++) {
                        arr.push(this.indent_string);
                        this.line_char_count += this.indent_string.length;
                    }
                };

                this.print_token = function(text) {
                    // Avoid printing initial whitespace.
                    if (this.is_whitespace(text) && !this.output.length) {
                        return;
                    }
                    if (text || text !== '') {
                        if (this.output.length && this.output[this.output.length - 1] === '\n') {
                            this.print_indentation(this.output);
                            text = ltrim(text);
                        }
                    }
                    this.print_token_raw(text);
                };

                this.print_token_raw = function(text) {
                    // If we are going to print newlines, truncate trailing
                    // whitespace, as the newlines will represent the space.
                    if (this.newlines > 0) {
                        text = rtrim(text);
                    }

                    if (text && text !== '') {
                        if (text.length > 1 && text[text.length - 1] === '\n') {
                            // unformatted tags can grab newlines as their last character
                            this.output.push(text.slice(0, -1));
                            this.print_newline(false, this.output);
                        } else {
                            this.output.push(text);
                        }
                    }

                    for (var n = 0; n < this.newlines; n++) {
                        this.print_newline(n > 0, this.output);
                    }
                    this.newlines = 0;
                };

                this.indent = function() {
                    this.indent_level++;
                };

                this.unindent = function() {
                    if (this.indent_level > 0) {
                        this.indent_level--;
                    }
                };
            };
            return this;
        }

        /*_____________________--------------------_____________________*/

        multi_parser = new Parser(); //wrapping functions Parser
        multi_parser.printer(html_source, indent_character, indent_size, wrap_line_length, brace_style); //initialize starting values

        while (true) {
            var t = multi_parser.get_token();
            multi_parser.token_text = t[0];
            multi_parser.token_type = t[1];

            if (multi_parser.token_type === 'TK_EOF') {
                break;
            }

            switch (multi_parser.token_type) {
                case 'TK_TAG_START':
                    multi_parser.print_newline(false, multi_parser.output);
                    multi_parser.print_token(multi_parser.token_text);
                    if (multi_parser.indent_content) {
                        multi_parser.indent();
                        multi_parser.indent_content = false;
                    }
                    multi_parser.current_mode = 'CONTENT';
                    break;
                case 'TK_TAG_STYLE':
                case 'TK_TAG_SCRIPT':
                    multi_parser.print_newline(false, multi_parser.output);
                    multi_parser.print_token(multi_parser.token_text);
                    multi_parser.current_mode = 'CONTENT';
                    break;
                case 'TK_TAG_END':
                    //Print new line only if the tag has no content and has child
                    if (multi_parser.last_token === 'TK_CONTENT' && multi_parser.last_text === '') {
                        var tag_name = multi_parser.token_text.match(/\w+/)[0];
                        var tag_extracted_from_last_output = null;
                        if (multi_parser.output.length) {
                            tag_extracted_from_last_output = multi_parser.output[multi_parser.output.length - 1].match(/(?:<|{{#)\s*(\w+)/);
                        }
                        if (tag_extracted_from_last_output === null ||
                            tag_extracted_from_last_output[1] !== tag_name) {
                            multi_parser.print_newline(false, multi_parser.output);
                        }
                    }
                    multi_parser.print_token(multi_parser.token_text);
                    multi_parser.current_mode = 'CONTENT';
                    break;
                case 'TK_TAG_SINGLE':
                    // Don't add a newline before elements that should remain unformatted.
                    var tag_check = multi_parser.token_text.match(/^\s*<([a-z-]+)/i);
                    if (!tag_check || !multi_parser.Utils.in_array(tag_check[1], unformatted)) {
                        multi_parser.print_newline(false, multi_parser.output);
                    }
                    multi_parser.print_token(multi_parser.token_text);
                    multi_parser.current_mode = 'CONTENT';
                    break;
                case 'TK_TAG_HANDLEBARS_ELSE':
                    multi_parser.print_token(multi_parser.token_text);
                    if (multi_parser.indent_content) {
                        multi_parser.indent();
                        multi_parser.indent_content = false;
                    }
                    multi_parser.current_mode = 'CONTENT';
                    break;
                case 'TK_CONTENT':
                    multi_parser.print_token(multi_parser.token_text);
                    multi_parser.current_mode = 'TAG';
                    break;
                case 'TK_STYLE':
                case 'TK_SCRIPT':
                    if (multi_parser.token_text !== '') {
                        multi_parser.print_newline(false, multi_parser.output);
                        var text = multi_parser.token_text,
                            _beautifier,
                            script_indent_level = 1;
                        if (multi_parser.token_type === 'TK_SCRIPT') {
                            _beautifier = typeof js_beautify === 'function' && js_beautify;
                        } else if (multi_parser.token_type === 'TK_STYLE') {
                            _beautifier = typeof css_beautify === 'function' && css_beautify;
                        }

                        if (options.indent_scripts === "keep") {
                            script_indent_level = 0;
                        } else if (options.indent_scripts === "separate") {
                            script_indent_level = -multi_parser.indent_level;
                        }

                        var indentation = multi_parser.get_full_indent(script_indent_level);
                        if (_beautifier) {
                            // call the Beautifier if avaliable
                            text = _beautifier(text.replace(/^\s*/, indentation), options);
                        } else {
                            // simply indent the string otherwise
                            var white = text.match(/^\s*/)[0];
                            var _level = white.match(/[^\n\r]*$/)[0].split(multi_parser.indent_string).length - 1;
                            var reindent = multi_parser.get_full_indent(script_indent_level - _level);
                            text = text.replace(/^\s*/, indentation)
                                .replace(/\r\n|\r|\n/g, '\n' + reindent)
                                .replace(/\s+$/, '');
                        }
                        if (text) {
                            multi_parser.print_token_raw(text);
                            multi_parser.print_newline(true, multi_parser.output);
                        }
                    }
                    multi_parser.current_mode = 'TAG';
                    break;
                default:
                    // We should not be getting here but we don't want to drop input on the floor
                    // Just output the text and move on
                    if (multi_parser.token_text !== '') {
                        multi_parser.print_token(multi_parser.token_text);
                    }
                    break;
            }
            multi_parser.last_token = multi_parser.token_type;
            multi_parser.last_text = multi_parser.token_text;
        }
        var sweet_code = multi_parser.output.join('').replace(/[\r\n\t ]+$/, '');
        if (end_with_newline) {
            sweet_code += '\n';
        }
        return sweet_code;
    }

    if (typeof define === "function" && define.amd) {
        // Add support for AMD ( https://github.com/amdjs/amdjs-api/wiki/AMD#defineamd-property- )
        define(["require", "./beautify", "./beautify-css"], function(requireamd) {
            var js_beautify =  requireamd("./beautify");
            var css_beautify =  requireamd("./beautify-css");

            return {
              html_beautify: function(html_source, options) {
                return style_html(html_source, options, js_beautify.js_beautify, css_beautify.css_beautify);
              }
            };
        });
    } else if (typeof exports !== "undefined") {
        // Add support for CommonJS. Just put this file somewhere on your require.paths
        // and you will be able to `var html_beautify = require("beautify").html_beautify`.
        var js_beautify = require('./beautify.js');
        var css_beautify = require('./beautify-css.js');

        exports.html_beautify = function(html_source, options) {
            return style_html(html_source, options, js_beautify.js_beautify, css_beautify.css_beautify);
        };
    } else if (typeof window !== "undefined") {
        // If we're running a web page and don't have either of the above, add our one global
        window.html_beautify = function(html_source, options) {
            return style_html(html_source, options, window.js_beautify, window.css_beautify);
        };
    } else if (typeof global !== "undefined") {
        // If we don't even have window, try global.
        global.html_beautify = function(html_source, options) {
            return style_html(html_source, options, global.js_beautify, global.css_beautify);
        };
    }

}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./beautify-css.js":7,"./beautify.js":9}],9:[function(require,module,exports){
(function (global){
/*jshint curly:true, eqeqeq:true, laxbreak:true, noempty:false */
/*

  The MIT License (MIT)

  Copyright (c) 2007-2013 Einar Lielmanis and contributors.

  Permission is hereby granted, free of charge, to any person
  obtaining a copy of this software and associated documentation files
  (the "Software"), to deal in the Software without restriction,
  including without limitation the rights to use, copy, modify, merge,
  publish, distribute, sublicense, and/or sell copies of the Software,
  and to permit persons to whom the Software is furnished to do so,
  subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
  BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
  ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

 JS Beautifier
---------------


  Written by Einar Lielmanis, <einar@jsbeautifier.org>
      http://jsbeautifier.org/

  Originally converted to javascript by Vital, <vital76@gmail.com>
  "End braces on own line" added by Chris J. Shull, <chrisjshull@gmail.com>
  Parsing improvements for brace-less statements by Liam Newman <bitwiseman@gmail.com>


  Usage:
    js_beautify(js_source_text);
    js_beautify(js_source_text, options);

  The options are:
    indent_size (default 4)          - indentation size,
    indent_char (default space)      - character to indent with,
    preserve_newlines (default true) - whether existing line breaks should be preserved,
    max_preserve_newlines (default unlimited) - maximum number of line breaks to be preserved in one chunk,

    jslint_happy (default false) - if true, then jslint-stricter mode is enforced.

            jslint_happy        !jslint_happy
            ---------------------------------
            function ()         function()

            switch () {         switch() {
            case 1:               case 1:
              break;                break;
            }                   }

    space_after_anon_function (default false) - should the space before an anonymous function's parens be added, "function()" vs "function ()",
          NOTE: This option is overriden by jslint_happy (i.e. if jslint_happy is true, space_after_anon_function is true by design)

    brace_style (default "collapse") - "collapse" | "expand" | "end-expand"
            put braces on the same line as control statements (default), or put braces on own line (Allman / ANSI style), or just put end braces on own line.

    space_before_conditional (default true) - should the space before conditional statement be added, "if(true)" vs "if (true)",

    unescape_strings (default false) - should printable characters in strings encoded in \xNN notation be unescaped, "example" vs "\x65\x78\x61\x6d\x70\x6c\x65"

    wrap_line_length (default unlimited) - lines should wrap at next opportunity after this number of characters.
          NOTE: This is not a hard limit. Lines will continue until a point where a newline would
                be preserved if it were present.

    end_with_newline (default false)  - end output with a newline


    e.g

    js_beautify(js_source_text, {
      'indent_size': 1,
      'indent_char': '\t'
    });

*/

(function() {

    var acorn = {};
    (function (exports) {
      // This section of code is taken from acorn.
      //
      // Acorn was written by Marijn Haverbeke and released under an MIT
      // license. The Unicode regexps (for identifiers and whitespace) were
      // taken from [Esprima](http://esprima.org) by Ariya Hidayat.
      //
      // Git repositories for Acorn are available at
      //
      //     http://marijnhaverbeke.nl/git/acorn
      //     https://github.com/marijnh/acorn.git

      // ## Character categories

      // Big ugly regular expressions that match characters in the
      // whitespace, identifier, and identifier-start categories. These
      // are only applied when a character is found to actually have a
      // code point above 128.

      var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
      var nonASCIIidentifierStartChars = "\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc";
      var nonASCIIidentifierChars = "\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u0620-\u0649\u0672-\u06d3\u06e7-\u06e8\u06fb-\u06fc\u0730-\u074a\u0800-\u0814\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0840-\u0857\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962-\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09d7\u09df-\u09e0\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5f-\u0b60\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2-\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d46-\u0d48\u0d57\u0d62-\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e34-\u0e3a\u0e40-\u0e45\u0e50-\u0e59\u0eb4-\u0eb9\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f41-\u0f47\u0f71-\u0f84\u0f86-\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1029\u1040-\u1049\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u170e-\u1710\u1720-\u1730\u1740-\u1750\u1772\u1773\u1780-\u17b2\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1920-\u192b\u1930-\u193b\u1951-\u196d\u19b0-\u19c0\u19c8-\u19c9\u19d0-\u19d9\u1a00-\u1a15\u1a20-\u1a53\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b46-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1bb0-\u1bb9\u1be6-\u1bf3\u1c00-\u1c22\u1c40-\u1c49\u1c5b-\u1c7d\u1cd0-\u1cd2\u1d00-\u1dbe\u1e01-\u1f15\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2d81-\u2d96\u2de0-\u2dff\u3021-\u3028\u3099\u309a\ua640-\ua66d\ua674-\ua67d\ua69f\ua6f0-\ua6f1\ua7f8-\ua800\ua806\ua80b\ua823-\ua827\ua880-\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8f3-\ua8f7\ua900-\ua909\ua926-\ua92d\ua930-\ua945\ua980-\ua983\ua9b3-\ua9c0\uaa00-\uaa27\uaa40-\uaa41\uaa4c-\uaa4d\uaa50-\uaa59\uaa7b\uaae0-\uaae9\uaaf2-\uaaf3\uabc0-\uabe1\uabec\uabed\uabf0-\uabf9\ufb20-\ufb28\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f";
      var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
      var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

      // Whether a single character denotes a newline.

      var newline = exports.newline = /[\n\r\u2028\u2029]/;

      // Matches a whole line break (where CRLF is considered a single
      // line break). Used to count lines.

      var lineBreak = /\r\n|[\n\r\u2028\u2029]/g;

      // Test whether a given character code starts an identifier.

      var isIdentifierStart = exports.isIdentifierStart = function(code) {
        if (code < 65) return code === 36;
        if (code < 91) return true;
        if (code < 97) return code === 95;
        if (code < 123)return true;
        return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code));
      };

      // Test whether a given character is part of an identifier.

      var isIdentifierChar = exports.isIdentifierChar = function(code) {
        if (code < 48) return code === 36;
        if (code < 58) return true;
        if (code < 65) return false;
        if (code < 91) return true;
        if (code < 97) return code === 95;
        if (code < 123)return true;
        return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code));
      };
    })(acorn);

    function in_array(what, arr) {
        for (var i = 0; i < arr.length; i += 1) {
            if (arr[i] === what) {
                return true;
            }
        }
        return false;
    }

    function trim(s) {
        return s.replace(/^\s+|\s+$/g, '');
    }

    function js_beautify(js_source_text, options) {
        "use strict";
        var beautifier = new Beautifier(js_source_text, options);
        return beautifier.beautify();
    }

    var MODE = {
            BlockStatement: 'BlockStatement', // 'BLOCK'
            Statement: 'Statement', // 'STATEMENT'
            ObjectLiteral: 'ObjectLiteral', // 'OBJECT',
            ArrayLiteral: 'ArrayLiteral', //'[EXPRESSION]',
            ForInitializer: 'ForInitializer', //'(FOR-EXPRESSION)',
            Conditional: 'Conditional', //'(COND-EXPRESSION)',
            Expression: 'Expression' //'(EXPRESSION)'
        };

    function Beautifier(js_source_text, options) {
        "use strict";
        var output
        var tokens = [], token_pos;
        var Tokenizer;
        var current_token;
        var last_type, last_last_text, indent_string;
        var flags, previous_flags, flag_store;
        var prefix;

        var handlers, opt;
        var baseIndentString = '';

        handlers = {
            'TK_START_EXPR': handle_start_expr,
            'TK_END_EXPR': handle_end_expr,
            'TK_START_BLOCK': handle_start_block,
            'TK_END_BLOCK': handle_end_block,
            'TK_WORD': handle_word,
            'TK_RESERVED': handle_word,
            'TK_SEMICOLON': handle_semicolon,
            'TK_STRING': handle_string,
            'TK_EQUALS': handle_equals,
            'TK_OPERATOR': handle_operator,
            'TK_COMMA': handle_comma,
            'TK_BLOCK_COMMENT': handle_block_comment,
            'TK_INLINE_COMMENT': handle_inline_comment,
            'TK_COMMENT': handle_comment,
            'TK_DOT': handle_dot,
            'TK_UNKNOWN': handle_unknown,
            'TK_EOF': handle_eof
        };

        function create_flags(flags_base, mode) {
            var next_indent_level = 0;
            if (flags_base) {
                next_indent_level = flags_base.indentation_level;
                if (!output.just_added_newline() &&
                    flags_base.line_indent_level > next_indent_level) {
                    next_indent_level = flags_base.line_indent_level;
                }
            }

            var next_flags = {
                mode: mode,
                parent: flags_base,
                last_text: flags_base ? flags_base.last_text : '', // last token text
                last_word: flags_base ? flags_base.last_word : '', // last 'TK_WORD' passed
                declaration_statement: false,
                declaration_assignment: false,
                multiline_frame: false,
                if_block: false,
                else_block: false,
                do_block: false,
                do_while: false,
                in_case_statement: false, // switch(..){ INSIDE HERE }
                in_case: false, // we're on the exact line with "case 0:"
                case_body: false, // the indented case-action block
                indentation_level: next_indent_level,
                line_indent_level: flags_base ? flags_base.line_indent_level : next_indent_level,
                start_line_index: output.get_line_number(),
                ternary_depth: 0
            };
            return next_flags;
        }

        // Some interpreters have unexpected results with foo = baz || bar;
        options = options ? options : {};
        opt = {};

        // compatibility
        if (options.braces_on_own_line !== undefined) { //graceful handling of deprecated option
            opt.brace_style = options.braces_on_own_line ? "expand" : "collapse";
        }
        opt.brace_style = options.brace_style ? options.brace_style : (opt.brace_style ? opt.brace_style : "collapse");

        // graceful handling of deprecated option
        if (opt.brace_style === "expand-strict") {
            opt.brace_style = "expand";
        }


        opt.indent_size = options.indent_size ? parseInt(options.indent_size, 10) : 4;
        opt.indent_char = options.indent_char ? options.indent_char : ' ';
        opt.preserve_newlines = (options.preserve_newlines === undefined) ? true : options.preserve_newlines;
        opt.break_chained_methods = (options.break_chained_methods === undefined) ? false : options.break_chained_methods;
        opt.max_preserve_newlines = (options.max_preserve_newlines === undefined) ? 0 : parseInt(options.max_preserve_newlines, 10);
        opt.space_in_paren = (options.space_in_paren === undefined) ? false : options.space_in_paren;
        opt.space_in_empty_paren = (options.space_in_empty_paren === undefined) ? false : options.space_in_empty_paren;
        opt.jslint_happy = (options.jslint_happy === undefined) ? false : options.jslint_happy;
        opt.space_after_anon_function = (options.space_after_anon_function === undefined) ? false : options.space_after_anon_function;
        opt.keep_array_indentation = (options.keep_array_indentation === undefined) ? false : options.keep_array_indentation;
        opt.space_before_conditional = (options.space_before_conditional === undefined) ? true : options.space_before_conditional;
        opt.unescape_strings = (options.unescape_strings === undefined) ? false : options.unescape_strings;
        opt.wrap_line_length = (options.wrap_line_length === undefined) ? 0 : parseInt(options.wrap_line_length, 10);
        opt.e4x = (options.e4x === undefined) ? false : options.e4x;
        opt.end_with_newline = (options.end_with_newline === undefined) ? false : options.end_with_newline;


        // force opt.space_after_anon_function to true if opt.jslint_happy
        if(opt.jslint_happy) {
            opt.space_after_anon_function = true;
        }

        if(options.indent_with_tabs){
            opt.indent_char = '\t';
            opt.indent_size = 1;
        }

        //----------------------------------
        indent_string = '';
        while (opt.indent_size > 0) {
            indent_string += opt.indent_char;
            opt.indent_size -= 1;
        }

        var preindent_index = 0;
        if(js_source_text && js_source_text.length) {
            while ( (js_source_text.charAt(preindent_index) === ' ' ||
                    js_source_text.charAt(preindent_index) === '\t')) {
                baseIndentString += js_source_text.charAt(preindent_index);
                preindent_index += 1;
            }
            js_source_text = js_source_text.substring(preindent_index);
        }

        last_type = 'TK_START_BLOCK'; // last token type
        last_last_text = ''; // pre-last token text
        output = new Output(indent_string, baseIndentString);


        // Stack of parsing/formatting states, including MODE.
        // We tokenize, parse, and output in an almost purely a forward-only stream of token input
        // and formatted output.  This makes the beautifier less accurate than full parsers
        // but also far more tolerant of syntax errors.
        //
        // For example, the default mode is MODE.BlockStatement. If we see a '{' we push a new frame of type
        // MODE.BlockStatement on the the stack, even though it could be object literal.  If we later
        // encounter a ":", we'll switch to to MODE.ObjectLiteral.  If we then see a ";",
        // most full parsers would die, but the beautifier gracefully falls back to
        // MODE.BlockStatement and continues on.
        flag_store = [];
        set_mode(MODE.BlockStatement);

        this.beautify = function() {

            /*jshint onevar:true */
            var local_token, sweet_code;
            Tokenizer = new tokenizer(js_source_text, opt, indent_string);
            tokens = Tokenizer.tokenize();
            token_pos = 0;

            while (local_token = get_token()) {
                for(var i = 0; i < local_token.comments_before.length; i++) {
                    // The cleanest handling of inline comments is to treat them as though they aren't there.
                    // Just continue formatting and the behavior should be logical.
                    // Also ignore unknown tokens.  Again, this should result in better behavior.
                    handle_token(local_token.comments_before[i]);
                }
                handle_token(local_token);

                last_last_text = flags.last_text;
                last_type = local_token.type;
                flags.last_text = local_token.text;

                token_pos += 1;
            }

            sweet_code = output.get_code();
            if (opt.end_with_newline) {
                sweet_code += '\n';
            }

            return sweet_code;
        };

        function handle_token(local_token) {
            var newlines = local_token.newlines;
            var keep_whitespace = opt.keep_array_indentation && is_array(flags.mode);

            if (keep_whitespace) {
                for (i = 0; i < newlines; i += 1) {
                    print_newline(i > 0);
                }
            } else {
                if (opt.max_preserve_newlines && newlines > opt.max_preserve_newlines) {
                    newlines = opt.max_preserve_newlines;
                }

                if (opt.preserve_newlines) {
                    if (local_token.newlines > 1) {
                        print_newline();
                        for (var i = 1; i < newlines; i += 1) {
                            print_newline(true);
                        }
                    }
                }
            }

            current_token = local_token;
            handlers[current_token.type]();
        }

        // we could use just string.split, but
        // IE doesn't like returning empty strings

        function split_newlines(s) {
            //return s.split(/\x0d\x0a|\x0a/);

            s = s.replace(/\x0d/g, '');
            var out = [],
                idx = s.indexOf("\n");
            while (idx !== -1) {
                out.push(s.substring(0, idx));
                s = s.substring(idx + 1);
                idx = s.indexOf("\n");
            }
            if (s.length) {
                out.push(s);
            }
            return out;
        }

        function allow_wrap_or_preserved_newline(force_linewrap) {
            force_linewrap = (force_linewrap === undefined) ? false : force_linewrap;

            if (output.just_added_newline()) {
                return
            }

            if ((opt.preserve_newlines && current_token.wanted_newline) || force_linewrap) {
                print_newline(false, true);
            } else if (opt.wrap_line_length) {
                // We never wrap the first token of a line due to newline check above.
                var proposed_line_length = output.current_line.get_character_count() + current_token.text.length +
                    (output.space_before_token ? 1 : 0);
                if (proposed_line_length >= opt.wrap_line_length) {
                    print_newline(false, true);
                }
            }
        }

        function print_newline(force_newline, preserve_statement_flags) {
            if (!preserve_statement_flags) {
                if (flags.last_text !== ';' && flags.last_text !== ',' && flags.last_text !== '=' && last_type !== 'TK_OPERATOR') {
                    while (flags.mode === MODE.Statement && !flags.if_block && !flags.do_block) {
                        restore_mode();
                    }
                }
            }

            if (output.add_new_line(force_newline)) {
                flags.multiline_frame = true;
            }
        }

        function print_token_line_indentation() {
            if (output.just_added_newline()) {
                if (opt.keep_array_indentation && is_array(flags.mode) && current_token.wanted_newline) {
                    // prevent removing of this whitespace as redundant
                    output.current_line.push('');
                    for (var i = 0; i < current_token.whitespace_before.length; i += 1) {
                        output.current_line.push(current_token.whitespace_before[i]);
                    }
                    output.space_before_token = false;
                } else if (output.add_indent_string(flags.indentation_level)) {
                    flags.line_indent_level = flags.indentation_level;
                }
            }
        }

        function print_token(printable_token) {
            printable_token = printable_token || current_token.text;
            print_token_line_indentation();
            output.add_token(printable_token);
        }

        function indent() {
            flags.indentation_level += 1;
        }

        function deindent() {
            if (flags.indentation_level > 0 &&
                ((!flags.parent) || flags.indentation_level > flags.parent.indentation_level))
                flags.indentation_level -= 1;
        }

        function set_mode(mode) {
            if (flags) {
                flag_store.push(flags);
                previous_flags = flags;
            } else {
                previous_flags = create_flags(null, mode);
            }

            flags = create_flags(previous_flags, mode);
        }

        function is_array(mode) {
            return mode === MODE.ArrayLiteral;
        }

        function is_expression(mode) {
            return in_array(mode, [MODE.Expression, MODE.ForInitializer, MODE.Conditional]);
        }

        function restore_mode() {
            if (flag_store.length > 0) {
                previous_flags = flags;
                flags = flag_store.pop();
                if (previous_flags.mode === MODE.Statement) {
                    output.remove_redundant_indentation(previous_flags);
                }
            }
        }

        function start_of_object_property() {
            return flags.parent.mode === MODE.ObjectLiteral && flags.mode === MODE.Statement && (
                (flags.last_text === ':' && flags.ternary_depth === 0) || (last_type === 'TK_RESERVED' && in_array(flags.last_text, ['get', 'set'])));
        }

        function start_of_statement() {
            if (
                    (last_type === 'TK_RESERVED' && in_array(flags.last_text, ['var', 'let', 'const']) && current_token.type === 'TK_WORD') ||
                    (last_type === 'TK_RESERVED' && flags.last_text === 'do') ||
                    (last_type === 'TK_RESERVED' && flags.last_text === 'return' && !current_token.wanted_newline) ||
                    (last_type === 'TK_RESERVED' && flags.last_text === 'else' && !(current_token.type === 'TK_RESERVED' && current_token.text === 'if')) ||
                    (last_type === 'TK_END_EXPR' && (previous_flags.mode === MODE.ForInitializer || previous_flags.mode === MODE.Conditional)) ||
                    (last_type === 'TK_WORD' && flags.mode === MODE.BlockStatement
                        && !flags.in_case
                        && !(current_token.text === '--' || current_token.text === '++')
                        && current_token.type !== 'TK_WORD' && current_token.type !== 'TK_RESERVED') ||
                    (flags.mode === MODE.ObjectLiteral && (
                        (flags.last_text === ':' && flags.ternary_depth === 0) || (last_type === 'TK_RESERVED' && in_array(flags.last_text, ['get', 'set']))))
                ) {

                set_mode(MODE.Statement);
                indent();

                if (last_type === 'TK_RESERVED' && in_array(flags.last_text, ['var', 'let', 'const']) && current_token.type === 'TK_WORD') {
                    flags.declaration_statement = true;
                }

                // Issue #276:
                // If starting a new statement with [if, for, while, do], push to a new line.
                // if (a) if (b) if(c) d(); else e(); else f();
                if (!start_of_object_property()) {
                    allow_wrap_or_preserved_newline(
                        current_token.type === 'TK_RESERVED' && in_array(current_token.text, ['do', 'for', 'if', 'while']));
                }

                return true;
            }
            return false;
        }

        function all_lines_start_with(lines, c) {
            for (var i = 0; i < lines.length; i++) {
                var line = trim(lines[i]);
                if (line.charAt(0) !== c) {
                    return false;
                }
            }
            return true;
        }

        function each_line_matches_indent(lines, indent) {
            var i = 0,
                len = lines.length,
                line;
            for (; i < len; i++) {
                line = lines[i];
                // allow empty lines to pass through
                if (line && line.indexOf(indent) !== 0) {
                    return false;
                }
            }
            return true;
        }

        function is_special_word(word) {
            return in_array(word, ['case', 'return', 'do', 'if', 'throw', 'else']);
        }

        function get_token(offset) {
            var index = token_pos + (offset || 0);
            return (index < 0 || index >= tokens.length) ? null : tokens[index];
        }

        function handle_start_expr() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
            }

            var next_mode = MODE.Expression;
            if (current_token.text === '[') {

                if (last_type === 'TK_WORD' || flags.last_text === ')') {
                    // this is array index specifier, break immediately
                    // a[x], fn()[x]
                    if (last_type === 'TK_RESERVED' && in_array(flags.last_text, Tokenizer.line_starters)) {
                        output.space_before_token = true;
                    }
                    set_mode(next_mode);
                    print_token();
                    indent();
                    if (opt.space_in_paren) {
                        output.space_before_token = true;
                    }
                    return;
                }

                next_mode = MODE.ArrayLiteral;
                if (is_array(flags.mode)) {
                    if (flags.last_text === '[' ||
                        (flags.last_text === ',' && (last_last_text === ']' || last_last_text === '}'))) {
                        // ], [ goes to new line
                        // }, [ goes to new line
                        if (!opt.keep_array_indentation) {
                            print_newline();
                        }
                    }
                }

            } else {
                if (last_type === 'TK_RESERVED' && flags.last_text === 'for') {
                    next_mode = MODE.ForInitializer;
                } else if (last_type === 'TK_RESERVED' && in_array(flags.last_text, ['if', 'while'])) {
                    next_mode = MODE.Conditional;
                } else {
                    // next_mode = MODE.Expression;
                }
            }

            if (flags.last_text === ';' || last_type === 'TK_START_BLOCK') {
                print_newline();
            } else if (last_type === 'TK_END_EXPR' || last_type === 'TK_START_EXPR' || last_type === 'TK_END_BLOCK' || flags.last_text === '.') {
                // TODO: Consider whether forcing this is required.  Review failing tests when removed.
                allow_wrap_or_preserved_newline(current_token.wanted_newline);
                // do nothing on (( and )( and ][ and ]( and .(
            } else if (!(last_type === 'TK_RESERVED' && current_token.text === '(') && last_type !== 'TK_WORD' && last_type !== 'TK_OPERATOR') {
                output.space_before_token = true;
            } else if ((last_type === 'TK_RESERVED' && (flags.last_word === 'function' || flags.last_word === 'typeof')) ||
                (flags.last_text === '*' && last_last_text === 'function')) {
                // function() vs function ()
                if (opt.space_after_anon_function) {
                    output.space_before_token = true;
                }
            } else if (last_type === 'TK_RESERVED' && (in_array(flags.last_text, Tokenizer.line_starters) || flags.last_text === 'catch')) {
                if (opt.space_before_conditional) {
                    output.space_before_token = true;
                }
            }

            // Support of this kind of newline preservation.
            // a = (b &&
            //     (c || d));
            if (current_token.text === '(') {
                if (last_type === 'TK_EQUALS' || last_type === 'TK_OPERATOR') {
                    if (!start_of_object_property()) {
                        allow_wrap_or_preserved_newline();
                    }
                }
            }

            set_mode(next_mode);
            print_token();
            if (opt.space_in_paren) {
                output.space_before_token = true;
            }

            // In all cases, if we newline while inside an expression it should be indented.
            indent();
        }

        function handle_end_expr() {
            // statements inside expressions are not valid syntax, but...
            // statements must all be closed when their container closes
            while (flags.mode === MODE.Statement) {
                restore_mode();
            }

            if (flags.multiline_frame) {
                allow_wrap_or_preserved_newline(current_token.text === ']' && is_array(flags.mode) && !opt.keep_array_indentation);
            }

            if (opt.space_in_paren) {
                if (last_type === 'TK_START_EXPR' && ! opt.space_in_empty_paren) {
                    // () [] no inner space in empty parens like these, ever, ref #320
                    output.trim();
                    output.space_before_token = false;
                } else {
                    output.space_before_token = true;
                }
            }
            if (current_token.text === ']' && opt.keep_array_indentation) {
                print_token();
                restore_mode();
            } else {
                restore_mode();
                print_token();
            }
            output.remove_redundant_indentation(previous_flags);

            // do {} while () // no statement required after
            if (flags.do_while && previous_flags.mode === MODE.Conditional) {
                previous_flags.mode = MODE.Expression;
                flags.do_block = false;
                flags.do_while = false;

            }
        }

        function handle_start_block() {
            // Check if this is should be treated as a ObjectLiteral
            var next_token = get_token(1)
            var second_token = get_token(2)
            if (second_token && (
                    (second_token.text === ':' && in_array(next_token.type, ['TK_STRING', 'TK_WORD', 'TK_RESERVED']))
                    || (in_array(next_token.text, ['get', 'set']) && in_array(second_token.type, ['TK_WORD', 'TK_RESERVED']))
                )) {
                // We don't support TypeScript,but we didn't break it for a very long time.
                // We'll try to keep not breaking it.
                if (!in_array(last_last_text, ['class','interface'])) {
                    set_mode(MODE.ObjectLiteral);
                } else {
                    set_mode(MODE.BlockStatement);
                }
            } else {
                set_mode(MODE.BlockStatement);
            }

            var empty_braces = !next_token.comments_before.length &&  next_token.text === '}';
            var empty_anonymous_function = empty_braces && flags.last_word === 'function' &&
                last_type === 'TK_END_EXPR';

            if (opt.brace_style === "expand") {
                if (last_type !== 'TK_OPERATOR' &&
                    (empty_anonymous_function ||
                        last_type === 'TK_EQUALS' ||
                        (last_type === 'TK_RESERVED' && is_special_word(flags.last_text) && flags.last_text !== 'else'))) {
                    output.space_before_token = true;
                } else {
                    print_newline(false, true);
                }
            } else { // collapse
                if (last_type !== 'TK_OPERATOR' && last_type !== 'TK_START_EXPR') {
                    if (last_type === 'TK_START_BLOCK') {
                        print_newline();
                    } else {
                        output.space_before_token = true;
                    }
                } else {
                    // if TK_OPERATOR or TK_START_EXPR
                    if (is_array(previous_flags.mode) && flags.last_text === ',') {
                        if (last_last_text === '}') {
                            // }, { in array context
                            output.space_before_token = true;
                        } else {
                            print_newline(); // [a, b, c, {
                        }
                    }
                }
            }
            print_token();
            indent();
        }

        function handle_end_block() {
            // statements must all be closed when their container closes
            while (flags.mode === MODE.Statement) {
                restore_mode();
            }
            var empty_braces = last_type === 'TK_START_BLOCK';

            if (opt.brace_style === "expand") {
                if (!empty_braces) {
                    print_newline();
                }
            } else {
                // skip {}
                if (!empty_braces) {
                    if (is_array(flags.mode) && opt.keep_array_indentation) {
                        // we REALLY need a newline here, but newliner would skip that
                        opt.keep_array_indentation = false;
                        print_newline();
                        opt.keep_array_indentation = true;

                    } else {
                        print_newline();
                    }
                }
            }
            restore_mode();
            print_token();
        }

        function handle_word() {
            if (current_token.type === 'TK_RESERVED' && flags.mode !== MODE.ObjectLiteral &&
                in_array(current_token.text, ['set', 'get'])) {
                current_token.type = 'TK_WORD';
            }

            if (current_token.type === 'TK_RESERVED' && flags.mode === MODE.ObjectLiteral) {
                var next_token = get_token(1);
                if (next_token.text == ':') {
                    current_token.type = 'TK_WORD';
                }
            }

            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
            } else if (current_token.wanted_newline && !is_expression(flags.mode) &&
                (last_type !== 'TK_OPERATOR' || (flags.last_text === '--' || flags.last_text === '++')) &&
                last_type !== 'TK_EQUALS' &&
                (opt.preserve_newlines || !(last_type === 'TK_RESERVED' && in_array(flags.last_text, ['var', 'let', 'const', 'set', 'get'])))) {

                print_newline();
            }

            if (flags.do_block && !flags.do_while) {
                if (current_token.type === 'TK_RESERVED' && current_token.text === 'while') {
                    // do {} ## while ()
                    output.space_before_token = true;
                    print_token();
                    output.space_before_token = true;
                    flags.do_while = true;
                    return;
                } else {
                    // do {} should always have while as the next word.
                    // if we don't see the expected while, recover
                    print_newline();
                    flags.do_block = false;
                }
            }

            // if may be followed by else, or not
            // Bare/inline ifs are tricky
            // Need to unwind the modes correctly: if (a) if (b) c(); else d(); else e();
            if (flags.if_block) {
                if (!flags.else_block && (current_token.type === 'TK_RESERVED' && current_token.text === 'else')) {
                    flags.else_block = true;
                } else {
                    while (flags.mode === MODE.Statement) {
                        restore_mode();
                    }
                    flags.if_block = false;
                    flags.else_block = false;
                }
            }

            if (current_token.type === 'TK_RESERVED' && (current_token.text === 'case' || (current_token.text === 'default' && flags.in_case_statement))) {
                print_newline();
                if (flags.case_body || opt.jslint_happy) {
                    // switch cases following one another
                    deindent();
                    flags.case_body = false;
                }
                print_token();
                flags.in_case = true;
                flags.in_case_statement = true;
                return;
            }

            if (current_token.type === 'TK_RESERVED' && current_token.text === 'function') {
                if (in_array(flags.last_text, ['}', ';']) || (output.just_added_newline() && ! in_array(flags.last_text, ['[', '{', ':', '=', ',']))) {
                    // make sure there is a nice clean space of at least one blank line
                    // before a new function definition
                    if ( !output.just_added_blankline() && !current_token.comments_before.length) {
                        print_newline();
                        print_newline(true);
                    }
                }
                if (last_type === 'TK_RESERVED' || last_type === 'TK_WORD') {
                    if (last_type === 'TK_RESERVED' && in_array(flags.last_text, ['get', 'set', 'new', 'return', 'export'])) {
                        output.space_before_token = true;
                    } else if (last_type === 'TK_RESERVED' && flags.last_text === 'default' && last_last_text === 'export') {
                        output.space_before_token = true;
                    } else {
                        print_newline();
                    }
                } else if (last_type === 'TK_OPERATOR' || flags.last_text === '=') {
                    // foo = function
                    output.space_before_token = true;
                } else if (!flags.multiline_frame && (is_expression(flags.mode) || is_array(flags.mode))) {
                    // (function
                } else {
                    print_newline();
                }
            }

            if (last_type === 'TK_COMMA' || last_type === 'TK_START_EXPR' || last_type === 'TK_EQUALS' || last_type === 'TK_OPERATOR') {
                if (!start_of_object_property()) {
                    allow_wrap_or_preserved_newline();
                }
            }

            if (current_token.type === 'TK_RESERVED' &&  in_array(current_token.text, ['function', 'get', 'set'])) {
                print_token();
                flags.last_word = current_token.text;
                return;
            }

            prefix = 'NONE';

            if (last_type === 'TK_END_BLOCK') {
                if (!(current_token.type === 'TK_RESERVED' && in_array(current_token.text, ['else', 'catch', 'finally']))) {
                    prefix = 'NEWLINE';
                } else {
                    if (opt.brace_style === "expand" || opt.brace_style === "end-expand") {
                        prefix = 'NEWLINE';
                    } else {
                        prefix = 'SPACE';
                        output.space_before_token = true;
                    }
                }
            } else if (last_type === 'TK_SEMICOLON' && flags.mode === MODE.BlockStatement) {
                // TODO: Should this be for STATEMENT as well?
                prefix = 'NEWLINE';
            } else if (last_type === 'TK_SEMICOLON' && is_expression(flags.mode)) {
                prefix = 'SPACE';
            } else if (last_type === 'TK_STRING') {
                prefix = 'NEWLINE';
            } else if (last_type === 'TK_RESERVED' || last_type === 'TK_WORD' ||
                (flags.last_text === '*' && last_last_text === 'function')) {
                prefix = 'SPACE';
            } else if (last_type === 'TK_START_BLOCK') {
                prefix = 'NEWLINE';
            } else if (last_type === 'TK_END_EXPR') {
                output.space_before_token = true;
                prefix = 'NEWLINE';
            }

            if (current_token.type === 'TK_RESERVED' && in_array(current_token.text, Tokenizer.line_starters) && flags.last_text !== ')') {
                if (flags.last_text === 'else' || flags.last_text === 'export') {
                    prefix = 'SPACE';
                } else {
                    prefix = 'NEWLINE';
                }

            }

            if (current_token.type === 'TK_RESERVED' && in_array(current_token.text, ['else', 'catch', 'finally'])) {
                if (last_type !== 'TK_END_BLOCK' || opt.brace_style === "expand" || opt.brace_style === "end-expand") {
                    print_newline();
                } else {
                    output.trim(true);
                    var line = output.current_line;
                    // If we trimmed and there's something other than a close block before us
                    // put a newline back in.  Handles '} // comment' scenario.
                    if (line.last() !== '}') {
                        print_newline();
                    }
                    output.space_before_token = true;
                }
            } else if (prefix === 'NEWLINE') {
                if (last_type === 'TK_RESERVED' && is_special_word(flags.last_text)) {
                    // no newline between 'return nnn'
                    output.space_before_token = true;
                } else if (last_type !== 'TK_END_EXPR') {
                    if ((last_type !== 'TK_START_EXPR' || !(current_token.type === 'TK_RESERVED' && in_array(current_token.text, ['var', 'let', 'const']))) && flags.last_text !== ':') {
                        // no need to force newline on 'var': for (var x = 0...)
                        if (current_token.type === 'TK_RESERVED' && current_token.text === 'if' && flags.last_text === 'else') {
                            // no newline for } else if {
                            output.space_before_token = true;
                        } else {
                            print_newline();
                        }
                    }
                } else if (current_token.type === 'TK_RESERVED' && in_array(current_token.text, Tokenizer.line_starters) && flags.last_text !== ')') {
                    print_newline();
                }
            } else if (flags.multiline_frame && is_array(flags.mode) && flags.last_text === ',' && last_last_text === '}') {
                print_newline(); // }, in lists get a newline treatment
            } else if (prefix === 'SPACE') {
                output.space_before_token = true;
            }
            print_token();
            flags.last_word = current_token.text;

            if (current_token.type === 'TK_RESERVED' && current_token.text === 'do') {
                flags.do_block = true;
            }

            if (current_token.type === 'TK_RESERVED' && current_token.text === 'if') {
                flags.if_block = true;
            }
        }

        function handle_semicolon() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
                // Semicolon can be the start (and end) of a statement
                output.space_before_token = false;
            }
            while (flags.mode === MODE.Statement && !flags.if_block && !flags.do_block) {
                restore_mode();
            }
            print_token();
        }

        function handle_string() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
                // One difference - strings want at least a space before
                output.space_before_token = true;
            } else if (last_type === 'TK_RESERVED' || last_type === 'TK_WORD') {
                output.space_before_token = true;
            } else if (last_type === 'TK_COMMA' || last_type === 'TK_START_EXPR' || last_type === 'TK_EQUALS' || last_type === 'TK_OPERATOR') {
                if (!start_of_object_property()) {
                    allow_wrap_or_preserved_newline();
                }
            } else {
                print_newline();
            }
            print_token();
        }

        function handle_equals() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
            }

            if (flags.declaration_statement) {
                // just got an '=' in a var-line, different formatting/line-breaking, etc will now be done
                flags.declaration_assignment = true;
            }
            output.space_before_token = true;
            print_token();
            output.space_before_token = true;
        }

        function handle_comma() {
            if (flags.declaration_statement) {
                if (is_expression(flags.parent.mode)) {
                    // do not break on comma, for(var a = 1, b = 2)
                    flags.declaration_assignment = false;
                }

                print_token();

                if (flags.declaration_assignment) {
                    flags.declaration_assignment = false;
                    print_newline(false, true);
                } else {
                    output.space_before_token = true;
                }
                return;
            }

            print_token();
            if (flags.mode === MODE.ObjectLiteral ||
                (flags.mode === MODE.Statement && flags.parent.mode === MODE.ObjectLiteral)) {
                if (flags.mode === MODE.Statement) {
                    restore_mode();
                }
                print_newline();
            } else {
                // EXPR or DO_BLOCK
                output.space_before_token = true;
            }

        }

        function handle_operator() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
            }

            if (last_type === 'TK_RESERVED' && is_special_word(flags.last_text)) {
                // "return" had a special handling in TK_WORD. Now we need to return the favor
                output.space_before_token = true;
                print_token();
                return;
            }

            // hack for actionscript's import .*;
            if (current_token.text === '*' && last_type === 'TK_DOT') {
                print_token();
                return;
            }

            if (current_token.text === ':' && flags.in_case) {
                flags.case_body = true;
                indent();
                print_token();
                print_newline();
                flags.in_case = false;
                return;
            }

            if (current_token.text === '::') {
                // no spaces around exotic namespacing syntax operator
                print_token();
                return;
            }

            // http://www.ecma-international.org/ecma-262/5.1/#sec-7.9.1
            // if there is a newline between -- or ++ and anything else we should preserve it.
            if (current_token.wanted_newline && (current_token.text === '--' || current_token.text === '++')) {
                print_newline(false, true);
            }

            // Allow line wrapping between operators
            if (last_type === 'TK_OPERATOR') {
                allow_wrap_or_preserved_newline();
            }

            var space_before = true;
            var space_after = true;

            if (in_array(current_token.text, ['--', '++', '!', '~']) || (in_array(current_token.text, ['-', '+']) && (in_array(last_type, ['TK_START_BLOCK', 'TK_START_EXPR', 'TK_EQUALS', 'TK_OPERATOR']) || in_array(flags.last_text, Tokenizer.line_starters) || flags.last_text === ','))) {
                // unary operators (and binary +/- pretending to be unary) special cases

                space_before = false;
                space_after = false;

                if (flags.last_text === ';' && is_expression(flags.mode)) {
                    // for (;; ++i)
                    //        ^^^
                    space_before = true;
                }

                if (last_type === 'TK_RESERVED' || last_type === 'TK_END_EXPR') {
                    space_before = true;
                } else if (last_type === 'TK_OPERATOR') {
                    space_before =
                        (in_array(current_token.text, ['--', '-']) && in_array(flags.last_text, ['--', '-'])) ||
                        (in_array(current_token.text, ['++', '+']) && in_array(flags.last_text, ['++', '+']));
                }

                if ((flags.mode === MODE.BlockStatement || flags.mode === MODE.Statement) && (flags.last_text === '{' || flags.last_text === ';')) {
                    // { foo; --i }
                    // foo(); --bar;
                    print_newline();
                }
            } else if (current_token.text === ':') {
                if (flags.ternary_depth === 0) {
                    // Colon is invalid javascript outside of ternary and object, but do our best to guess what was meant.
                    space_before = false;
                } else {
                    flags.ternary_depth -= 1;
                }
            } else if (current_token.text === '?') {
                flags.ternary_depth += 1;
            } else if (current_token.text === '*' && last_type === 'TK_RESERVED' && flags.last_text === 'function') {
                space_before = false;
                space_after = false;
            }
            output.space_before_token = output.space_before_token || space_before;
            print_token();
            output.space_before_token = space_after;
        }

        function handle_block_comment() {
            var lines = split_newlines(current_token.text);
            var j; // iterator for this case
            var javadoc = false;
            var starless = false;
            var lastIndent = current_token.whitespace_before.join('');
            var lastIndentLength = lastIndent.length;

            // block comment starts with a new line
            print_newline(false, true);
            if (lines.length > 1) {
                if (all_lines_start_with(lines.slice(1), '*')) {
                    javadoc = true;
                }
                else if (each_line_matches_indent(lines.slice(1), lastIndent)) {
                    starless = true;
                }
            }

            // first line always indented
            print_token(lines[0]);
            for (j = 1; j < lines.length; j++) {
                print_newline(false, true);
                if (javadoc) {
                    // javadoc: reformat and re-indent
                    print_token(' ' + trim(lines[j]));
                } else if (starless && lines[j].length > lastIndentLength) {
                    // starless: re-indent non-empty content, avoiding trim
                    print_token(lines[j].substring(lastIndentLength));
                } else {
                    // normal comments output raw
                    output.add_token(lines[j]);
                }
            }

            // for comments of more than one line, make sure there's a new line after
            print_newline(false, true);
        }

        function handle_inline_comment() {
            output.space_before_token = true;
            print_token();
            output.space_before_token = true;
        }

        function handle_comment() {
            if (current_token.wanted_newline) {
                print_newline(false, true);
            } else {
                output.trim(true);
            }

            output.space_before_token = true;
            print_token();
            print_newline(false, true);
        }

        function handle_dot() {
            if (start_of_statement()) {
                // The conditional starts the statement if appropriate.
            }

            if (last_type === 'TK_RESERVED' && is_special_word(flags.last_text)) {
                output.space_before_token = true;
            } else {
                // allow preserved newlines before dots in general
                // force newlines on dots after close paren when break_chained - for bar().baz()
                allow_wrap_or_preserved_newline(flags.last_text === ')' && opt.break_chained_methods);
            }

            print_token();
        }

        function handle_unknown() {
            print_token();

            if (current_token.text[current_token.text.length - 1] === '\n') {
                print_newline();
            }
        }

        function handle_eof() {
            // Unwind any open statements
            while (flags.mode === MODE.Statement) {
                restore_mode();
            }
        }
    }

    function OutputLine() {
        var character_count = 0;
        var line_items = [];

        this.get_character_count = function() {
            return character_count;
        }

        this.get_item_count = function() {
            return line_items.length;
        }

        this.get_output = function() {
            return line_items.join('');
        }

        this.last = function() {
            if (line_items.length) {
              return line_items[line_items.length - 1];
            } else {
              return null;
            }
        }

        this.push = function(input) {
            line_items.push(input);
            character_count += input.length;
        }

        this.remove_indent = function(indent_string, baseIndentString) {
            var splice_index = 0;

            // skip empty lines
            if (line_items.length === 0) {
                return;
            }

            // skip the preindent string if present
            if (baseIndentString && line_items[0] === baseIndentString) {
                splice_index = 1;
            }

            // remove one indent, if present
            if (line_items[splice_index] === indent_string) {
                character_count -= line_items[splice_index].length;
                line_items.splice(splice_index, 1);
            }
        }

        this.trim = function(indent_string, baseIndentString) {
            while (this.get_item_count() &&
                (this.last() === ' ' ||
                    this.last() === indent_string ||
                    this.last() === baseIndentString)) {
                var item = line_items.pop();
                character_count -= item.length;
            }
        }
    }

    function Output(indent_string, baseIndentString) {
        var lines =[];
        this.baseIndentString = baseIndentString;
        this.current_line = null;
        this.space_before_token = false;

        this.get_line_number = function() {
            return lines.length;
        }

        // Using object instead of string to allow for later expansion of info about each line
        this.add_new_line = function(force_newline) {
            if (this.get_line_number() === 1 && this.just_added_newline()) {
                return false; // no newline on start of file
            }

            if (force_newline || !this.just_added_newline()) {
                this.current_line = new OutputLine();
                lines.push(this.current_line);
                return true;
            }

            return false;
        }

        // initialize
        this.add_new_line(true);

        this.get_code = function() {
            var sweet_code = lines[0].get_output();
            for (var line_index = 1; line_index < lines.length; line_index++) {
                sweet_code += '\n' + lines[line_index].get_output();
            }
            sweet_code = sweet_code.replace(/[\r\n\t ]+$/, '');
            return sweet_code;
        }

        this.add_indent_string = function(indentation_level) {
            if (baseIndentString) {
                this.current_line.push(baseIndentString);
            }

            // Never indent your first output indent at the start of the file
            if (lines.length > 1) {
                for (var i = 0; i < indentation_level; i += 1) {
                    this.current_line.push(indent_string);
                }
                return true;
            }
            return false;
        }

        this.add_token = function(printable_token) {
            this.add_space_before_token();
            this.current_line.push(printable_token);
        }

        this.add_space_before_token = function() {
            if (this.space_before_token && this.current_line.get_item_count()) {
                var last_output = this.current_line.last();
                if (last_output !== ' ' && last_output !== indent_string && last_output !== baseIndentString) { // prevent occassional duplicate space
                    this.current_line.push(' ');
                }
            }
            this.space_before_token = false;
        }

        this.remove_redundant_indentation = function (frame) {
            // This implementation is effective but has some issues:
            //     - less than great performance due to array splicing
            //     - can cause line wrap to happen too soon due to indent removal
            //           after wrap points are calculated
            // These issues are minor compared to ugly indentation.

            if (frame.multiline_frame ||
                frame.mode === MODE.ForInitializer ||
                frame.mode === MODE.Conditional) {
                return;
            }

            // remove one indent from each line inside this section
            var index = frame.start_line_index;
            var line;

            var output_length = lines.length;
            while (index < output_length) {
                lines[index].remove_indent(indent_string, baseIndentString);
                index++;
            }
        }

        this.trim = function(eat_newlines) {
            eat_newlines = (eat_newlines === undefined) ? false : eat_newlines;

            this.current_line.trim(indent_string, baseIndentString);

            while (eat_newlines && lines.length > 1 &&
                this.current_line.get_item_count() === 0) {
                lines.pop();
                this.current_line = lines[lines.length - 1]
                this.current_line.trim(indent_string, baseIndentString);
            }
        }

        this.just_added_newline = function() {
            return this.current_line.get_item_count() === 0;
        }

        this.just_added_blankline = function() {
            if (this.just_added_newline()) {
                if (lines.length === 1) {
                    return true; // start of the file and newline = blank
                }

                var line = lines[lines.length - 2];
                return line.get_item_count() === 0;
            }
            return false;
        }
    }


    var Token = function(type, text, newlines, whitespace_before, mode, parent) {
        this.type = type;
        this.text = text;
        this.comments_before = [];
        this.newlines = newlines || 0;
        this.wanted_newline = newlines > 0;
        this.whitespace_before = whitespace_before || [];
        this.parent = null;
    }

    function tokenizer(input, opts, indent_string) {

        var whitespace = "\n\r\t ".split('');
        var digit = /[0-9]/;

        var punct = ('+ - * / % & ++ -- = += -= *= /= %= == === != !== > < >= <= >> << >>> >>>= >>= <<= && &= | || ! ~ , : ? ^ ^= |= :: =>'
                +' <%= <% %> <?= <? ?>').split(' '); // try to be a good boy and try not to break the markup language identifiers

        // words which should always start on new line.
        this.line_starters = 'continue,try,throw,return,var,let,const,if,switch,case,default,for,while,break,function,yield,import,export'.split(',');
        var reserved_words = this.line_starters.concat(['do', 'in', 'else', 'get', 'set', 'new', 'catch', 'finally', 'typeof']);

        var n_newlines, whitespace_before_token, in_html_comment, tokens, parser_pos;
        var input_length;

        this.tokenize = function() {
            // cache the source's length.
            input_length = input.length
            parser_pos = 0;
            in_html_comment = false
            tokens = [];

            var next, last;
            var token_values;
            var open = null;
            var open_stack = [];
            var comments = [];

            while (!(last && last.type === 'TK_EOF')) {
                token_values = tokenize_next();
                next = new Token(token_values[1], token_values[0], n_newlines, whitespace_before_token);
                while(next.type === 'TK_INLINE_COMMENT' || next.type === 'TK_COMMENT' ||
                    next.type === 'TK_BLOCK_COMMENT' || next.type === 'TK_UNKNOWN') {
                    comments.push(next);
                    token_values = tokenize_next();
                    next = new Token(token_values[1], token_values[0], n_newlines, whitespace_before_token);
                }

                if (comments.length) {
                    next.comments_before = comments;
                    comments = [];
                }

                if (next.type === 'TK_START_BLOCK' || next.type === 'TK_START_EXPR') {
                    next.parent = last;
                    open = next;
                    open_stack.push(next);
                }  else if ((next.type === 'TK_END_BLOCK' || next.type === 'TK_END_EXPR') &&
                    (open && (
                        (next.text === ']' && open.text === '[') ||
                        (next.text === ')' && open.text === '(') ||
                        (next.text === '}' && open.text === '}')))) {
                    next.parent = open.parent;
                    open = open_stack.pop();
                }

                tokens.push(next);
                last = next;
            }

            return tokens;
        }

        function tokenize_next() {
            var i, resulting_string;

            n_newlines = 0;
            whitespace_before_token = [];

            if (parser_pos >= input_length) {
                return ['', 'TK_EOF'];
            }

            var last_token;
            if (tokens.length) {
                last_token = tokens[tokens.length-1];
            } else {
                // For the sake of tokenizing we can pretend that there was on open brace to start
                last_token = new Token('TK_START_BLOCK', '{');
            }


            var c = input.charAt(parser_pos);
            parser_pos += 1;

            while (in_array(c, whitespace)) {

                if (c === '\n') {
                    n_newlines += 1;
                    whitespace_before_token = [];
                } else if (n_newlines) {
                    if (c === indent_string) {
                        whitespace_before_token.push(indent_string);
                    } else if (c !== '\r') {
                        whitespace_before_token.push(' ');
                    }
                }

                if (parser_pos >= input_length) {
                    return ['', 'TK_EOF'];
                }

                c = input.charAt(parser_pos);
                parser_pos += 1;
            }

            if (digit.test(c)) {
                var allow_decimal = true;
                var allow_e = true;
                var local_digit = digit;

                if (c === '0' && parser_pos < input_length && /[Xx]/.test(input.charAt(parser_pos))) {
                    // switch to hex number, no decimal or e, just hex digits
                    allow_decimal = false;
                    allow_e = false;
                    c += input.charAt(parser_pos);
                    parser_pos += 1;
                    local_digit = /[0123456789abcdefABCDEF]/
                } else {
                    // we know this first loop will run.  It keeps the logic simpler.
                    c = '';
                    parser_pos -= 1
                }

                // Add the digits
                while (parser_pos < input_length && local_digit.test(input.charAt(parser_pos))) {
                    c += input.charAt(parser_pos);
                    parser_pos += 1;

                    if (allow_decimal && parser_pos < input_length && input.charAt(parser_pos) === '.') {
                        c += input.charAt(parser_pos);
                        parser_pos += 1;
                        allow_decimal = false;
                    }

                    if (allow_e && parser_pos < input_length && /[Ee]/.test(input.charAt(parser_pos))) {
                        c += input.charAt(parser_pos);
                        parser_pos += 1;

                        if (parser_pos < input_length && /[+-]/.test(input.charAt(parser_pos))) {
                            c += input.charAt(parser_pos);
                            parser_pos += 1;
                        }

                        allow_e = false;
                        allow_decimal = false;
                    }
                }

                return [c, 'TK_WORD'];
            }

            if (acorn.isIdentifierStart(input.charCodeAt(parser_pos-1))) {
                if (parser_pos < input_length) {
                    while (acorn.isIdentifierChar(input.charCodeAt(parser_pos))) {
                        c += input.charAt(parser_pos);
                        parser_pos += 1;
                        if (parser_pos === input_length) {
                            break;
                        }
                    }
                }

                if (!(last_token.type === 'TK_DOT' ||
                        (last_token.type === 'TK_RESERVED' && in_array(last_token.text, ['set', 'get'])))
                    && in_array(c, reserved_words)) {
                    if (c === 'in') { // hack for 'in' operator
                        return [c, 'TK_OPERATOR'];
                    }
                    return [c, 'TK_RESERVED'];
                }

                return [c, 'TK_WORD'];
            }

            if (c === '(' || c === '[') {
                return [c, 'TK_START_EXPR'];
            }

            if (c === ')' || c === ']') {
                return [c, 'TK_END_EXPR'];
            }

            if (c === '{') {
                return [c, 'TK_START_BLOCK'];
            }

            if (c === '}') {
                return [c, 'TK_END_BLOCK'];
            }

            if (c === ';') {
                return [c, 'TK_SEMICOLON'];
            }

            if (c === '/') {
                var comment = '';
                // peek for comment /* ... */
                var inline_comment = true;
                if (input.charAt(parser_pos) === '*') {
                    parser_pos += 1;
                    if (parser_pos < input_length) {
                        while (parser_pos < input_length && !(input.charAt(parser_pos) === '*' && input.charAt(parser_pos + 1) && input.charAt(parser_pos + 1) === '/')) {
                            c = input.charAt(parser_pos);
                            comment += c;
                            if (c === "\n" || c === "\r") {
                                inline_comment = false;
                            }
                            parser_pos += 1;
                            if (parser_pos >= input_length) {
                                break;
                            }
                        }
                    }
                    parser_pos += 2;
                    if (inline_comment && n_newlines === 0) {
                        return ['/*' + comment + '*/', 'TK_INLINE_COMMENT'];
                    } else {
                        return ['/*' + comment + '*/', 'TK_BLOCK_COMMENT'];
                    }
                }
                // peek for comment // ...
                if (input.charAt(parser_pos) === '/') {
                    comment = c;
                    while (input.charAt(parser_pos) !== '\r' && input.charAt(parser_pos) !== '\n') {
                        comment += input.charAt(parser_pos);
                        parser_pos += 1;
                        if (parser_pos >= input_length) {
                            break;
                        }
                    }
                    return [comment, 'TK_COMMENT'];
                }

            }

            if (c === '`' || c === "'" || c === '"' || // string
                (
                    (c === '/') || // regexp
                    (opts.e4x && c === "<" && input.slice(parser_pos - 1).match(/^<([-a-zA-Z:0-9_.]+|{[^{}]*}|!\[CDATA\[[\s\S]*?\]\])\s*([-a-zA-Z:0-9_.]+=('[^']*'|"[^"]*"|{[^{}]*})\s*)*\/?\s*>/)) // xml
                ) && ( // regex and xml can only appear in specific locations during parsing
                    (last_token.type === 'TK_RESERVED' && in_array(last_token.text , ['return', 'case', 'throw', 'else', 'do', 'typeof', 'yield'])) ||
                    (last_token.type === 'TK_END_EXPR' && last_token.text === ')' &&
                        last_token.parent && last_token.parent.type === 'TK_RESERVED' && in_array(last_token.parent.text, ['if', 'while', 'for'])) ||
                    (in_array(last_token.type, ['TK_COMMENT', 'TK_START_EXPR', 'TK_START_BLOCK',
                        'TK_END_BLOCK', 'TK_OPERATOR', 'TK_EQUALS', 'TK_EOF', 'TK_SEMICOLON', 'TK_COMMA'
                    ]))
                )) {

                var sep = c,
                    esc = false,
                    has_char_escapes = false;

                resulting_string = c;

                if (sep === '/') {
                    //
                    // handle regexp
                    //
                    var in_char_class = false;
                    while (parser_pos < input_length &&
                            ((esc || in_char_class || input.charAt(parser_pos) !== sep) &&
                            !acorn.newline.test(input.charAt(parser_pos)))) {
                        resulting_string += input.charAt(parser_pos);
                        if (!esc) {
                            esc = input.charAt(parser_pos) === '\\';
                            if (input.charAt(parser_pos) === '[') {
                                in_char_class = true;
                            } else if (input.charAt(parser_pos) === ']') {
                                in_char_class = false;
                            }
                        } else {
                            esc = false;
                        }
                        parser_pos += 1;
                    }
                } else if (opts.e4x && sep === '<') {
                    //
                    // handle e4x xml literals
                    //
                    var xmlRegExp = /<(\/?)([-a-zA-Z:0-9_.]+|{[^{}]*}|!\[CDATA\[[\s\S]*?\]\])\s*([-a-zA-Z:0-9_.]+=('[^']*'|"[^"]*"|{[^{}]*})\s*)*(\/?)\s*>/g;
                    var xmlStr = input.slice(parser_pos - 1);
                    var match = xmlRegExp.exec(xmlStr);
                    if (match && match.index === 0) {
                        var rootTag = match[2];
                        var depth = 0;
                        while (match) {
                            var isEndTag = !! match[1];
                            var tagName = match[2];
                            var isSingletonTag = ( !! match[match.length - 1]) || (tagName.slice(0, 8) === "![CDATA[");
                            if (tagName === rootTag && !isSingletonTag) {
                                if (isEndTag) {
                                    --depth;
                                } else {
                                    ++depth;
                                }
                            }
                            if (depth <= 0) {
                                break;
                            }
                            match = xmlRegExp.exec(xmlStr);
                        }
                        var xmlLength = match ? match.index + match[0].length : xmlStr.length;
                        parser_pos += xmlLength - 1;
                        return [xmlStr.slice(0, xmlLength), "TK_STRING"];
                    }
                } else {
                    //
                    // handle string
                    //
                    // Template strings can travers lines without escape characters.
                    // Other strings cannot
                    while (parser_pos < input_length &&
                            (esc || (input.charAt(parser_pos) !== sep &&
                            (sep === '`' || !acorn.newline.test(input.charAt(parser_pos)))))) {
                        resulting_string += input.charAt(parser_pos);
                        if (esc) {
                            if (input.charAt(parser_pos) === 'x' || input.charAt(parser_pos) === 'u') {
                                has_char_escapes = true;
                            }
                            esc = false;
                        } else {
                            esc = input.charAt(parser_pos) === '\\';
                        }
                        parser_pos += 1;
                    }

                }

                if (has_char_escapes && opts.unescape_strings) {
                    resulting_string = unescape_string(resulting_string);
                }

                if (parser_pos < input_length && input.charAt(parser_pos) === sep) {
                    resulting_string += sep;
                    parser_pos += 1;

                    if (sep === '/') {
                        // regexps may have modifiers /regexp/MOD , so fetch those, too
                        // Only [gim] are valid, but if the user puts in garbage, do what we can to take it.
                        while (parser_pos < input_length && acorn.isIdentifierStart(input.charCodeAt(parser_pos))) {
                            resulting_string += input.charAt(parser_pos);
                            parser_pos += 1;
                        }
                    }
                }
                return [resulting_string, 'TK_STRING'];
            }

            if (c === '#') {

                if (tokens.length === 0 && input.charAt(parser_pos) === '!') {
                    // shebang
                    resulting_string = c;
                    while (parser_pos < input_length && c !== '\n') {
                        c = input.charAt(parser_pos);
                        resulting_string += c;
                        parser_pos += 1;
                    }
                    return [trim(resulting_string) + '\n', 'TK_UNKNOWN'];
                }



                // Spidermonkey-specific sharp variables for circular references
                // https://developer.mozilla.org/En/Sharp_variables_in_JavaScript
                // http://mxr.mozilla.org/mozilla-central/source/js/src/jsscan.cpp around line 1935
                var sharp = '#';
                if (parser_pos < input_length && digit.test(input.charAt(parser_pos))) {
                    do {
                        c = input.charAt(parser_pos);
                        sharp += c;
                        parser_pos += 1;
                    } while (parser_pos < input_length && c !== '#' && c !== '=');
                    if (c === '#') {
                        //
                    } else if (input.charAt(parser_pos) === '[' && input.charAt(parser_pos + 1) === ']') {
                        sharp += '[]';
                        parser_pos += 2;
                    } else if (input.charAt(parser_pos) === '{' && input.charAt(parser_pos + 1) === '}') {
                        sharp += '{}';
                        parser_pos += 2;
                    }
                    return [sharp, 'TK_WORD'];
                }
            }

            if (c === '<' && input.substring(parser_pos - 1, parser_pos + 3) === '<!--') {
                parser_pos += 3;
                c = '<!--';
                while (input.charAt(parser_pos) !== '\n' && parser_pos < input_length) {
                    c += input.charAt(parser_pos);
                    parser_pos++;
                }
                in_html_comment = true;
                return [c, 'TK_COMMENT'];
            }

            if (c === '-' && in_html_comment && input.substring(parser_pos - 1, parser_pos + 2) === '-->') {
                in_html_comment = false;
                parser_pos += 2;
                return ['-->', 'TK_COMMENT'];
            }

            if (c === '.') {
                return [c, 'TK_DOT'];
            }

            if (in_array(c, punct)) {
                while (parser_pos < input_length && in_array(c + input.charAt(parser_pos), punct)) {
                    c += input.charAt(parser_pos);
                    parser_pos += 1;
                    if (parser_pos >= input_length) {
                        break;
                    }
                }

                if (c === ',') {
                    return [c, 'TK_COMMA'];
                } else if (c === '=') {
                    return [c, 'TK_EQUALS'];
                } else {
                    return [c, 'TK_OPERATOR'];
                }
            }

            return [c, 'TK_UNKNOWN'];
        }


        function unescape_string(s) {
            var esc = false,
                out = '',
                pos = 0,
                s_hex = '',
                escaped = 0,
                c;

            while (esc || pos < s.length) {

                c = s.charAt(pos);
                pos++;

                if (esc) {
                    esc = false;
                    if (c === 'x') {
                        // simple hex-escape \x24
                        s_hex = s.substr(pos, 2);
                        pos += 2;
                    } else if (c === 'u') {
                        // unicode-escape, \u2134
                        s_hex = s.substr(pos, 4);
                        pos += 4;
                    } else {
                        // some common escape, e.g \n
                        out += '\\' + c;
                        continue;
                    }
                    if (!s_hex.match(/^[0123456789abcdefABCDEF]+$/)) {
                        // some weird escaping, bail out,
                        // leaving whole string intact
                        return s;
                    }

                    escaped = parseInt(s_hex, 16);

                    if (escaped >= 0x00 && escaped < 0x20) {
                        // leave 0x00...0x1f escaped
                        if (c === 'x') {
                            out += '\\x' + s_hex;
                        } else {
                            out += '\\u' + s_hex;
                        }
                        continue;
                    } else if (escaped === 0x22 || escaped === 0x27 || escaped === 0x5c) {
                        // single-quote, apostrophe, backslash - escape these
                        out += '\\' + String.fromCharCode(escaped);
                    } else if (c === 'x' && escaped > 0x7e && escaped <= 0xff) {
                        // we bail out on \x7f..\xff,
                        // leaving whole string escaped,
                        // as it's probably completely binary
                        return s;
                    } else {
                        out += String.fromCharCode(escaped);
                    }
                } else if (c === '\\') {
                    esc = true;
                } else {
                    out += c;
                }
            }
            return out;
        }

    }


    if (typeof define === "function" && define.amd) {
        // Add support for AMD ( https://github.com/amdjs/amdjs-api/wiki/AMD#defineamd-property- )
        define([], function() {
            return { js_beautify: js_beautify };
        });
    } else if (typeof exports !== "undefined") {
        // Add support for CommonJS. Just put this file somewhere on your require.paths
        // and you will be able to `var js_beautify = require("beautify").js_beautify`.
        exports.js_beautify = js_beautify;
    } else if (typeof window !== "undefined") {
        // If we're running a web page and don't have either of the above, add our one global
        window.js_beautify = js_beautify;
    } else if (typeof global !== "undefined") {
        // If we don't even have window, try global.
        global.js_beautify = js_beautify;
    }

}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],10:[function(require,module,exports){
"use strict";

// outputTo -> print, json, html; Note html does not handle strings with &, <, > and other html codes
module.exports.pretty = function (jsObject, indentLength, outputTo, fullFunction) {
    var indentString,
        newLine,
        newLineJoin,
        TOSTRING,
        HASOWN,
        TYPES,
        valueType,
        repeatString,
        prettyObject,
        prettyObjectJSON,
        prettyObjectPrint,
        prettyArray,
        functionSignature,
        pretty,
        visited;

    TOSTRING = Object.prototype.toString;
    HASOWN = Object.prototype.hasOwnProperty; //JPP patched to hancle unpopulated Object.create(null) which does not inherit the prototype hasOwnProperty, thanks https://github.com/cvadillo/js-object-pretty-print/pull/1

    TYPES = {
        'undefined'        : 'undefined',
        'number'           : 'number',
        'boolean'          : 'boolean',
        'string'           : 'string',
        '[object Function]': 'function',
        '[object RegExp]'  : 'regexp',
        '[object Array]'   : 'array',
        '[object Date]'    : 'date',
        '[object Error]'   : 'error'
    };

    valueType = function (o) {
        var type = TYPES[typeof o] || TYPES[TOSTRING.call(o)] || (o ? 'object' : 'null');
        return type;
    };

    repeatString = function (src, length) {
        var dst = '',
            index;
        for (index = 0; index < length; index += 1) {
            dst += src;
        }

        return dst;
    };

    prettyObjectJSON = function (object, indent) {
        var value = [],
            property;

        indent += indentString;
        for (property in object) {
            if (HASOWN.call(object, property)) {
                value.push(indent + '"' + property + '": ' + pretty(object[property], indent));
            }
        }

        return value.join(newLineJoin) + newLine;
    };

    prettyObjectPrint = function (object, indent) {
        var value = [],
            property;

        indent += indentString;
        for (property in object) {
            if (HASOWN.call(object, property)) {
                value.push(indent + property + ': ' + pretty(object[property], indent));
            }
        }

        return value.join(newLineJoin) + newLine;
    };

    prettyArray = function (array, indent) {
        var index,
            length = array.length,
            value = [];

        indent += indentString;
        for (index = 0; index < length; index += 1) {
            value.push(pretty(array[index], indent, indent));
        }

        return value.join(newLineJoin) + newLine;
    };

    functionSignature = function (element) {
        var signatureExpression,
            signature;

        element = element.toString();
        signatureExpression = new RegExp('function\\s*.*\\s*\\(.*\\)');
        signature = signatureExpression.exec(element);
        signature = signature ? signature[0] : '[object Function]';
        return fullFunction ? element : '"' + signature + '"';
    };

    pretty = function (element, indent, fromArray) {
        var type;

        type = valueType(element);
        fromArray = fromArray || '';
        if (visited.indexOf(element) === -1) {
            switch (type) {
            case 'array':
                visited.push(element);
                return fromArray + '[' + newLine + prettyArray(element, indent) + indent + ']';

            case 'boolean':
                return fromArray + (element ? 'true' : 'false');

            case 'date':
                return fromArray + '"' + element.toString() + '"';

            case 'number':
                return fromArray + element;

            case 'object':
                visited.push(element);
                return fromArray + '{' + newLine + prettyObject(element, indent) + indent + '}';

            case 'string':
                return fromArray + '"' + element + '"';

            case 'function':
                return fromArray + functionSignature(element);

            default:
                return fromArray + ((element !== undefined)? element.toString() : 'undefined'); //JPP patched to handle undefined key value, https://github.com/cvadillo/js-object-pretty-print/issues/2
            }
        }
        return fromArray + 'circular reference to ' + element.toString();
    };

    if (jsObject) {
        if (indentLength === undefined) {
            indentLength = 4;
        }

        outputTo = (outputTo || 'print').toLowerCase();
        indentString = repeatString(outputTo === 'html' ? '&nbsp;' : ' ', indentLength);
        prettyObject = outputTo === 'json' ? prettyObjectJSON : prettyObjectPrint;
        newLine = outputTo === 'html' ? '<br/>' : '\n';
        newLineJoin = ',' + newLine;
        visited = [];
        return pretty(jsObject, '') + newLine;
    }

    return 'Error: no Javascript object provided';
};

},{}],11:[function(require,module,exports){
(function (Buffer){
// wrapper for non-node envs
;(function (sax) {

sax.parser = function (strict, opt) { return new SAXParser(strict, opt) }
sax.SAXParser = SAXParser
sax.SAXStream = SAXStream
sax.createStream = createStream

// When we pass the MAX_BUFFER_LENGTH position, start checking for buffer overruns.
// When we check, schedule the next check for MAX_BUFFER_LENGTH - (max(buffer lengths)),
// since that's the earliest that a buffer overrun could occur.  This way, checks are
// as rare as required, but as often as necessary to ensure never crossing this bound.
// Furthermore, buffers are only tested at most once per write(), so passing a very
// large string into write() might have undesirable effects, but this is manageable by
// the caller, so it is assumed to be safe.  Thus, a call to write() may, in the extreme
// edge case, result in creating at most one complete copy of the string passed in.
// Set to Infinity to have unlimited buffers.
sax.MAX_BUFFER_LENGTH = 64 * 1024

var buffers = [
  "comment", "sgmlDecl", "textNode", "tagName", "doctype",
  "procInstName", "procInstBody", "entity", "attribName",
  "attribValue", "cdata", "script"
]

sax.EVENTS = // for discoverability.
  [ "text"
  , "processinginstruction"
  , "sgmldeclaration"
  , "doctype"
  , "comment"
  , "attribute"
  , "opentag"
  , "closetag"
  , "opencdata"
  , "cdata"
  , "closecdata"
  , "error"
  , "end"
  , "ready"
  , "script"
  , "opennamespace"
  , "closenamespace"
  ]

function SAXParser (strict, opt) {
  if (!(this instanceof SAXParser)) return new SAXParser(strict, opt)

  var parser = this
  clearBuffers(parser)
  parser.q = parser.c = ""
  parser.bufferCheckPosition = sax.MAX_BUFFER_LENGTH
  parser.opt = opt || {}
  parser.opt.lowercase = parser.opt.lowercase || parser.opt.lowercasetags
  parser.looseCase = parser.opt.lowercase ? "toLowerCase" : "toUpperCase"
  parser.tags = []
  parser.closed = parser.closedRoot = parser.sawRoot = false
  parser.tag = parser.error = null
  parser.strict = !!strict
  parser.noscript = !!(strict || parser.opt.noscript)
  parser.state = S.BEGIN
  parser.ENTITIES = Object.create(sax.ENTITIES)
  parser.attribList = []

  // namespaces form a prototype chain.
  // it always points at the current tag,
  // which protos to its parent tag.
  if (parser.opt.xmlns) parser.ns = Object.create(rootNS)

  // mostly just for error reporting
  parser.trackPosition = parser.opt.position !== false
  if (parser.trackPosition) {
    parser.position = parser.line = parser.column = 0
  }
  emit(parser, "onready")
}

if (!Object.create) Object.create = function (o) {
  function f () { this.__proto__ = o }
  f.prototype = o
  return new f
}

if (!Object.getPrototypeOf) Object.getPrototypeOf = function (o) {
  return o.__proto__
}

if (!Object.keys) Object.keys = function (o) {
  var a = []
  for (var i in o) if (o.hasOwnProperty(i)) a.push(i)
  return a
}

function checkBufferLength (parser) {
  var maxAllowed = Math.max(sax.MAX_BUFFER_LENGTH, 10)
    , maxActual = 0
  for (var i = 0, l = buffers.length; i < l; i ++) {
    var len = parser[buffers[i]].length
    if (len > maxAllowed) {
      // Text/cdata nodes can get big, and since they're buffered,
      // we can get here under normal conditions.
      // Avoid issues by emitting the text node now,
      // so at least it won't get any bigger.
      switch (buffers[i]) {
        case "textNode":
          closeText(parser)
        break

        case "cdata":
          emitNode(parser, "oncdata", parser.cdata)
          parser.cdata = ""
        break

        case "script":
          emitNode(parser, "onscript", parser.script)
          parser.script = ""
        break

        default:
          error(parser, "Max buffer length exceeded: "+buffers[i])
      }
    }
    maxActual = Math.max(maxActual, len)
  }
  // schedule the next check for the earliest possible buffer overrun.
  parser.bufferCheckPosition = (sax.MAX_BUFFER_LENGTH - maxActual)
                             + parser.position
}

function clearBuffers (parser) {
  for (var i = 0, l = buffers.length; i < l; i ++) {
    parser[buffers[i]] = ""
  }
}

function flushBuffers (parser) {
  closeText(parser)
  if (parser.cdata !== "") {
    emitNode(parser, "oncdata", parser.cdata)
    parser.cdata = ""
  }
  if (parser.script !== "") {
    emitNode(parser, "onscript", parser.script)
    parser.script = ""
  }
}

SAXParser.prototype =
  { end: function () { end(this) }
  , write: write
  , resume: function () { this.error = null; return this }
  , close: function () { return this.write(null) }
  , flush: function () { flushBuffers(this) }
  }

try {
  var Stream = require("stream").Stream
} catch (ex) {
  var Stream = function () {}
}


var streamWraps = sax.EVENTS.filter(function (ev) {
  return ev !== "error" && ev !== "end"
})

function createStream (strict, opt) {
  return new SAXStream(strict, opt)
}

function SAXStream (strict, opt) {
  if (!(this instanceof SAXStream)) return new SAXStream(strict, opt)

  Stream.apply(this)

  this._parser = new SAXParser(strict, opt)
  this.writable = true
  this.readable = true


  var me = this

  this._parser.onend = function () {
    me.emit("end")
  }

  this._parser.onerror = function (er) {
    me.emit("error", er)

    // if didn't throw, then means error was handled.
    // go ahead and clear error, so we can write again.
    me._parser.error = null
  }

  this._decoder = null;

  streamWraps.forEach(function (ev) {
    Object.defineProperty(me, "on" + ev, {
      get: function () { return me._parser["on" + ev] },
      set: function (h) {
        if (!h) {
          me.removeAllListeners(ev)
          return me._parser["on"+ev] = h
        }
        me.on(ev, h)
      },
      enumerable: true,
      configurable: false
    })
  })
}

SAXStream.prototype = Object.create(Stream.prototype,
  { constructor: { value: SAXStream } })

SAXStream.prototype.write = function (data) {
  if (typeof Buffer === 'function' &&
      typeof Buffer.isBuffer === 'function' &&
      Buffer.isBuffer(data)) {
    if (!this._decoder) {
      var SD = require('string_decoder').StringDecoder
      this._decoder = new SD('utf8')
    }
    data = this._decoder.write(data);
  }

  this._parser.write(data.toString())
  this.emit("data", data)
  return true
}

SAXStream.prototype.end = function (chunk) {
  if (chunk && chunk.length) this.write(chunk)
  this._parser.end()
  return true
}

SAXStream.prototype.on = function (ev, handler) {
  var me = this
  if (!me._parser["on"+ev] && streamWraps.indexOf(ev) !== -1) {
    me._parser["on"+ev] = function () {
      var args = arguments.length === 1 ? [arguments[0]]
               : Array.apply(null, arguments)
      args.splice(0, 0, ev)
      me.emit.apply(me, args)
    }
  }

  return Stream.prototype.on.call(me, ev, handler)
}



// character classes and tokens
var whitespace = "\r\n\t "
  // this really needs to be replaced with character classes.
  // XML allows all manner of ridiculous numbers and digits.
  , number = "0124356789"
  , letter = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
  // (Letter | "_" | ":")
  , quote = "'\""
  , entity = number+letter+"#"
  , attribEnd = whitespace + ">"
  , CDATA = "[CDATA["
  , DOCTYPE = "DOCTYPE"
  , XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace"
  , XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/"
  , rootNS = { xml: XML_NAMESPACE, xmlns: XMLNS_NAMESPACE }

// turn all the string character sets into character class objects.
whitespace = charClass(whitespace)
number = charClass(number)
letter = charClass(letter)

// http://www.w3.org/TR/REC-xml/#NT-NameStartChar
// This implementation works on strings, a single character at a time
// as such, it cannot ever support astral-plane characters (10000-EFFFF)
// without a significant breaking change to either this  parser, or the
// JavaScript language.  Implementation of an emoji-capable xml parser
// is left as an exercise for the reader.
var nameStart = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/

var nameBody = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040\.\d-]/

quote = charClass(quote)
entity = charClass(entity)
attribEnd = charClass(attribEnd)

function charClass (str) {
  return str.split("").reduce(function (s, c) {
    s[c] = true
    return s
  }, {})
}

function isRegExp (c) {
  return Object.prototype.toString.call(c) === '[object RegExp]'
}

function is (charclass, c) {
  return isRegExp(charclass) ? !!c.match(charclass) : charclass[c]
}

function not (charclass, c) {
  return !is(charclass, c)
}

var S = 0
sax.STATE =
{ BEGIN                     : S++
, TEXT                      : S++ // general stuff
, TEXT_ENTITY               : S++ // &amp and such.
, OPEN_WAKA                 : S++ // <
, SGML_DECL                 : S++ // <!BLARG
, SGML_DECL_QUOTED          : S++ // <!BLARG foo "bar
, DOCTYPE                   : S++ // <!DOCTYPE
, DOCTYPE_QUOTED            : S++ // <!DOCTYPE "//blah
, DOCTYPE_DTD               : S++ // <!DOCTYPE "//blah" [ ...
, DOCTYPE_DTD_QUOTED        : S++ // <!DOCTYPE "//blah" [ "foo
, COMMENT_STARTING          : S++ // <!-
, COMMENT                   : S++ // <!--
, COMMENT_ENDING            : S++ // <!-- blah -
, COMMENT_ENDED             : S++ // <!-- blah --
, CDATA                     : S++ // <![CDATA[ something
, CDATA_ENDING              : S++ // ]
, CDATA_ENDING_2            : S++ // ]]
, PROC_INST                 : S++ // <?hi
, PROC_INST_BODY            : S++ // <?hi there
, PROC_INST_ENDING          : S++ // <?hi "there" ?
, OPEN_TAG                  : S++ // <strong
, OPEN_TAG_SLASH            : S++ // <strong /
, ATTRIB                    : S++ // <a
, ATTRIB_NAME               : S++ // <a foo
, ATTRIB_NAME_SAW_WHITE     : S++ // <a foo _
, ATTRIB_VALUE              : S++ // <a foo=
, ATTRIB_VALUE_QUOTED       : S++ // <a foo="bar
, ATTRIB_VALUE_CLOSED       : S++ // <a foo="bar"
, ATTRIB_VALUE_UNQUOTED     : S++ // <a foo=bar
, ATTRIB_VALUE_ENTITY_Q     : S++ // <foo bar="&quot;"
, ATTRIB_VALUE_ENTITY_U     : S++ // <foo bar=&quot;
, CLOSE_TAG                 : S++ // </a
, CLOSE_TAG_SAW_WHITE       : S++ // </a   >
, SCRIPT                    : S++ // <script> ...
, SCRIPT_ENDING             : S++ // <script> ... <
}

sax.ENTITIES =
{ "amp" : "&"
, "gt" : ">"
, "lt" : "<"
, "quot" : "\""
, "apos" : "'"
, "AElig" : 198
, "Aacute" : 193
, "Acirc" : 194
, "Agrave" : 192
, "Aring" : 197
, "Atilde" : 195
, "Auml" : 196
, "Ccedil" : 199
, "ETH" : 208
, "Eacute" : 201
, "Ecirc" : 202
, "Egrave" : 200
, "Euml" : 203
, "Iacute" : 205
, "Icirc" : 206
, "Igrave" : 204
, "Iuml" : 207
, "Ntilde" : 209
, "Oacute" : 211
, "Ocirc" : 212
, "Ograve" : 210
, "Oslash" : 216
, "Otilde" : 213
, "Ouml" : 214
, "THORN" : 222
, "Uacute" : 218
, "Ucirc" : 219
, "Ugrave" : 217
, "Uuml" : 220
, "Yacute" : 221
, "aacute" : 225
, "acirc" : 226
, "aelig" : 230
, "agrave" : 224
, "aring" : 229
, "atilde" : 227
, "auml" : 228
, "ccedil" : 231
, "eacute" : 233
, "ecirc" : 234
, "egrave" : 232
, "eth" : 240
, "euml" : 235
, "iacute" : 237
, "icirc" : 238
, "igrave" : 236
, "iuml" : 239
, "ntilde" : 241
, "oacute" : 243
, "ocirc" : 244
, "ograve" : 242
, "oslash" : 248
, "otilde" : 245
, "ouml" : 246
, "szlig" : 223
, "thorn" : 254
, "uacute" : 250
, "ucirc" : 251
, "ugrave" : 249
, "uuml" : 252
, "yacute" : 253
, "yuml" : 255
, "copy" : 169
, "reg" : 174
, "nbsp" : 160
, "iexcl" : 161
, "cent" : 162
, "pound" : 163
, "curren" : 164
, "yen" : 165
, "brvbar" : 166
, "sect" : 167
, "uml" : 168
, "ordf" : 170
, "laquo" : 171
, "not" : 172
, "shy" : 173
, "macr" : 175
, "deg" : 176
, "plusmn" : 177
, "sup1" : 185
, "sup2" : 178
, "sup3" : 179
, "acute" : 180
, "micro" : 181
, "para" : 182
, "middot" : 183
, "cedil" : 184
, "ordm" : 186
, "raquo" : 187
, "frac14" : 188
, "frac12" : 189
, "frac34" : 190
, "iquest" : 191
, "times" : 215
, "divide" : 247
, "OElig" : 338
, "oelig" : 339
, "Scaron" : 352
, "scaron" : 353
, "Yuml" : 376
, "fnof" : 402
, "circ" : 710
, "tilde" : 732
, "Alpha" : 913
, "Beta" : 914
, "Gamma" : 915
, "Delta" : 916
, "Epsilon" : 917
, "Zeta" : 918
, "Eta" : 919
, "Theta" : 920
, "Iota" : 921
, "Kappa" : 922
, "Lambda" : 923
, "Mu" : 924
, "Nu" : 925
, "Xi" : 926
, "Omicron" : 927
, "Pi" : 928
, "Rho" : 929
, "Sigma" : 931
, "Tau" : 932
, "Upsilon" : 933
, "Phi" : 934
, "Chi" : 935
, "Psi" : 936
, "Omega" : 937
, "alpha" : 945
, "beta" : 946
, "gamma" : 947
, "delta" : 948
, "epsilon" : 949
, "zeta" : 950
, "eta" : 951
, "theta" : 952
, "iota" : 953
, "kappa" : 954
, "lambda" : 955
, "mu" : 956
, "nu" : 957
, "xi" : 958
, "omicron" : 959
, "pi" : 960
, "rho" : 961
, "sigmaf" : 962
, "sigma" : 963
, "tau" : 964
, "upsilon" : 965
, "phi" : 966
, "chi" : 967
, "psi" : 968
, "omega" : 969
, "thetasym" : 977
, "upsih" : 978
, "piv" : 982
, "ensp" : 8194
, "emsp" : 8195
, "thinsp" : 8201
, "zwnj" : 8204
, "zwj" : 8205
, "lrm" : 8206
, "rlm" : 8207
, "ndash" : 8211
, "mdash" : 8212
, "lsquo" : 8216
, "rsquo" : 8217
, "sbquo" : 8218
, "ldquo" : 8220
, "rdquo" : 8221
, "bdquo" : 8222
, "dagger" : 8224
, "Dagger" : 8225
, "bull" : 8226
, "hellip" : 8230
, "permil" : 8240
, "prime" : 8242
, "Prime" : 8243
, "lsaquo" : 8249
, "rsaquo" : 8250
, "oline" : 8254
, "frasl" : 8260
, "euro" : 8364
, "image" : 8465
, "weierp" : 8472
, "real" : 8476
, "trade" : 8482
, "alefsym" : 8501
, "larr" : 8592
, "uarr" : 8593
, "rarr" : 8594
, "darr" : 8595
, "harr" : 8596
, "crarr" : 8629
, "lArr" : 8656
, "uArr" : 8657
, "rArr" : 8658
, "dArr" : 8659
, "hArr" : 8660
, "forall" : 8704
, "part" : 8706
, "exist" : 8707
, "empty" : 8709
, "nabla" : 8711
, "isin" : 8712
, "notin" : 8713
, "ni" : 8715
, "prod" : 8719
, "sum" : 8721
, "minus" : 8722
, "lowast" : 8727
, "radic" : 8730
, "prop" : 8733
, "infin" : 8734
, "ang" : 8736
, "and" : 8743
, "or" : 8744
, "cap" : 8745
, "cup" : 8746
, "int" : 8747
, "there4" : 8756
, "sim" : 8764
, "cong" : 8773
, "asymp" : 8776
, "ne" : 8800
, "equiv" : 8801
, "le" : 8804
, "ge" : 8805
, "sub" : 8834
, "sup" : 8835
, "nsub" : 8836
, "sube" : 8838
, "supe" : 8839
, "oplus" : 8853
, "otimes" : 8855
, "perp" : 8869
, "sdot" : 8901
, "lceil" : 8968
, "rceil" : 8969
, "lfloor" : 8970
, "rfloor" : 8971
, "lang" : 9001
, "rang" : 9002
, "loz" : 9674
, "spades" : 9824
, "clubs" : 9827
, "hearts" : 9829
, "diams" : 9830
}

Object.keys(sax.ENTITIES).forEach(function (key) {
    var e = sax.ENTITIES[key]
    var s = typeof e === 'number' ? String.fromCharCode(e) : e
    sax.ENTITIES[key] = s
})

for (var S in sax.STATE) sax.STATE[sax.STATE[S]] = S

// shorthand
S = sax.STATE

function emit (parser, event, data) {
  parser[event] && parser[event](data)
}

function emitNode (parser, nodeType, data) {
  if (parser.textNode) closeText(parser)
  emit(parser, nodeType, data)
}

function closeText (parser) {
  parser.textNode = textopts(parser.opt, parser.textNode)
  if (parser.textNode) emit(parser, "ontext", parser.textNode)
  parser.textNode = ""
}

function textopts (opt, text) {
  if (opt.trim) text = text.trim()
  if (opt.normalize) text = text.replace(/\s+/g, " ")
  return text
}

function error (parser, er) {
  closeText(parser)
  if (parser.trackPosition) {
    er += "\nLine: "+parser.line+
          "\nColumn: "+parser.column+
          "\nChar: "+parser.c
  }
  er = new Error(er)
  parser.error = er
  emit(parser, "onerror", er)
  return parser
}

function end (parser) {
  if (!parser.closedRoot) strictFail(parser, "Unclosed root tag")
  if ((parser.state !== S.BEGIN) && (parser.state !== S.TEXT)) error(parser, "Unexpected end")
  closeText(parser)
  parser.c = ""
  parser.closed = true
  emit(parser, "onend")
  SAXParser.call(parser, parser.strict, parser.opt)
  return parser
}

function strictFail (parser, message) {
  if (typeof parser !== 'object' || !(parser instanceof SAXParser))
    throw new Error('bad call to strictFail');
  if (parser.strict) error(parser, message)
}

function newTag (parser) {
  if (!parser.strict) parser.tagName = parser.tagName[parser.looseCase]()
  var parent = parser.tags[parser.tags.length - 1] || parser
    , tag = parser.tag = { name : parser.tagName, attributes : {} }

  // will be overridden if tag contails an xmlns="foo" or xmlns:foo="bar"
  if (parser.opt.xmlns) tag.ns = parent.ns
  parser.attribList.length = 0
}

function qname (name, attribute) {
  var i = name.indexOf(":")
    , qualName = i < 0 ? [ "", name ] : name.split(":")
    , prefix = qualName[0]
    , local = qualName[1]

  // <x "xmlns"="http://foo">
  if (attribute && name === "xmlns") {
    prefix = "xmlns"
    local = ""
  }

  return { prefix: prefix, local: local }
}

function attrib (parser) {
  if (!parser.strict) parser.attribName = parser.attribName[parser.looseCase]()

  if (parser.attribList.indexOf(parser.attribName) !== -1 ||
      parser.tag.attributes.hasOwnProperty(parser.attribName)) {
    return parser.attribName = parser.attribValue = ""
  }

  if (parser.opt.xmlns) {
    var qn = qname(parser.attribName, true)
      , prefix = qn.prefix
      , local = qn.local

    if (prefix === "xmlns") {
      // namespace binding attribute; push the binding into scope
      if (local === "xml" && parser.attribValue !== XML_NAMESPACE) {
        strictFail( parser
                  , "xml: prefix must be bound to " + XML_NAMESPACE + "\n"
                  + "Actual: " + parser.attribValue )
      } else if (local === "xmlns" && parser.attribValue !== XMLNS_NAMESPACE) {
        strictFail( parser
                  , "xmlns: prefix must be bound to " + XMLNS_NAMESPACE + "\n"
                  + "Actual: " + parser.attribValue )
      } else {
        var tag = parser.tag
          , parent = parser.tags[parser.tags.length - 1] || parser
        if (tag.ns === parent.ns) {
          tag.ns = Object.create(parent.ns)
        }
        tag.ns[local] = parser.attribValue
      }
    }

    // defer onattribute events until all attributes have been seen
    // so any new bindings can take effect; preserve attribute order
    // so deferred events can be emitted in document order
    parser.attribList.push([parser.attribName, parser.attribValue])
  } else {
    // in non-xmlns mode, we can emit the event right away
    parser.tag.attributes[parser.attribName] = parser.attribValue
    emitNode( parser
            , "onattribute"
            , { name: parser.attribName
              , value: parser.attribValue } )
  }

  parser.attribName = parser.attribValue = ""
}

function openTag (parser, selfClosing) {
  if (parser.opt.xmlns) {
    // emit namespace binding events
    var tag = parser.tag

    // add namespace info to tag
    var qn = qname(parser.tagName)
    tag.prefix = qn.prefix
    tag.local = qn.local
    tag.uri = tag.ns[qn.prefix] || ""

    if (tag.prefix && !tag.uri) {
      strictFail(parser, "Unbound namespace prefix: "
                       + JSON.stringify(parser.tagName))
      tag.uri = qn.prefix
    }

    var parent = parser.tags[parser.tags.length - 1] || parser
    if (tag.ns && parent.ns !== tag.ns) {
      Object.keys(tag.ns).forEach(function (p) {
        emitNode( parser
                , "onopennamespace"
                , { prefix: p , uri: tag.ns[p] } )
      })
    }

    // handle deferred onattribute events
    // Note: do not apply default ns to attributes:
    //   http://www.w3.org/TR/REC-xml-names/#defaulting
    for (var i = 0, l = parser.attribList.length; i < l; i ++) {
      var nv = parser.attribList[i]
      var name = nv[0]
        , value = nv[1]
        , qualName = qname(name, true)
        , prefix = qualName.prefix
        , local = qualName.local
        , uri = prefix == "" ? "" : (tag.ns[prefix] || "")
        , a = { name: name
              , value: value
              , prefix: prefix
              , local: local
              , uri: uri
              }

      // if there's any attributes with an undefined namespace,
      // then fail on them now.
      if (prefix && prefix != "xmlns" && !uri) {
        strictFail(parser, "Unbound namespace prefix: "
                         + JSON.stringify(prefix))
        a.uri = prefix
      }
      parser.tag.attributes[name] = a
      emitNode(parser, "onattribute", a)
    }
    parser.attribList.length = 0
  }

  parser.tag.isSelfClosing = !!selfClosing

  // process the tag
  parser.sawRoot = true
  parser.tags.push(parser.tag)
  emitNode(parser, "onopentag", parser.tag)
  if (!selfClosing) {
    // special case for <script> in non-strict mode.
    if (!parser.noscript && parser.tagName.toLowerCase() === "script") {
      parser.state = S.SCRIPT
    } else {
      parser.state = S.TEXT
    }
    parser.tag = null
    parser.tagName = ""
  }
  parser.attribName = parser.attribValue = ""
  parser.attribList.length = 0
}

function closeTag (parser) {
  if (!parser.tagName) {
    strictFail(parser, "Weird empty close tag.")
    parser.textNode += "</>"
    parser.state = S.TEXT
    return
  }

  if (parser.script) {
    if (parser.tagName !== "script") {
      parser.script += "</" + parser.tagName + ">"
      parser.tagName = ""
      parser.state = S.SCRIPT
      return
    }
    emitNode(parser, "onscript", parser.script)
    parser.script = ""
  }

  // first make sure that the closing tag actually exists.
  // <a><b></c></b></a> will close everything, otherwise.
  var t = parser.tags.length
  var tagName = parser.tagName
  if (!parser.strict) tagName = tagName[parser.looseCase]()
  var closeTo = tagName
  while (t --) {
    var close = parser.tags[t]
    if (close.name !== closeTo) {
      // fail the first time in strict mode
      strictFail(parser, "Unexpected close tag")
    } else break
  }

  // didn't find it.  we already failed for strict, so just abort.
  if (t < 0) {
    strictFail(parser, "Unmatched closing tag: "+parser.tagName)
    parser.textNode += "</" + parser.tagName + ">"
    parser.state = S.TEXT
    return
  }
  parser.tagName = tagName
  var s = parser.tags.length
  while (s --> t) {
    var tag = parser.tag = parser.tags.pop()
    parser.tagName = parser.tag.name
    emitNode(parser, "onclosetag", parser.tagName)

    var x = {}
    for (var i in tag.ns) x[i] = tag.ns[i]

    var parent = parser.tags[parser.tags.length - 1] || parser
    if (parser.opt.xmlns && tag.ns !== parent.ns) {
      // remove namespace bindings introduced by tag
      Object.keys(tag.ns).forEach(function (p) {
        var n = tag.ns[p]
        emitNode(parser, "onclosenamespace", { prefix: p, uri: n })
      })
    }
  }
  if (t === 0) parser.closedRoot = true
  parser.tagName = parser.attribValue = parser.attribName = ""
  parser.attribList.length = 0
  parser.state = S.TEXT
}

function parseEntity (parser) {
  var entity = parser.entity
    , entityLC = entity.toLowerCase()
    , num
    , numStr = ""
  if (parser.ENTITIES[entity])
    return parser.ENTITIES[entity]
  if (parser.ENTITIES[entityLC])
    return parser.ENTITIES[entityLC]
  entity = entityLC
  if (entity.charAt(0) === "#") {
    if (entity.charAt(1) === "x") {
      entity = entity.slice(2)
      num = parseInt(entity, 16)
      numStr = num.toString(16)
    } else {
      entity = entity.slice(1)
      num = parseInt(entity, 10)
      numStr = num.toString(10)
    }
  }
  entity = entity.replace(/^0+/, "")
  if (numStr.toLowerCase() !== entity) {
    strictFail(parser, "Invalid character entity")
    return "&"+parser.entity + ";"
  }

  return String.fromCodePoint(num)
}

function write (chunk) {
  var parser = this
  if (this.error) throw this.error
  if (parser.closed) return error(parser,
    "Cannot write after close. Assign an onready handler.")
  if (chunk === null) return end(parser)
  var i = 0, c = ""
  while (parser.c = c = chunk.charAt(i++)) {
    if (parser.trackPosition) {
      parser.position ++
      if (c === "\n") {
        parser.line ++
        parser.column = 0
      } else parser.column ++
    }
    switch (parser.state) {

      case S.BEGIN:
        if (c === "<") {
          parser.state = S.OPEN_WAKA
          parser.startTagPosition = parser.position
        } else if (not(whitespace,c)) {
          // have to process this as a text node.
          // weird, but happens.
          strictFail(parser, "Non-whitespace before first tag.")
          parser.textNode = c
          parser.state = S.TEXT
        }
      continue

      case S.TEXT:
        if (parser.sawRoot && !parser.closedRoot) {
          var starti = i-1
          while (c && c!=="<" && c!=="&") {
            c = chunk.charAt(i++)
            if (c && parser.trackPosition) {
              parser.position ++
              if (c === "\n") {
                parser.line ++
                parser.column = 0
              } else parser.column ++
            }
          }
          parser.textNode += chunk.substring(starti, i-1)
        }
        if (c === "<") {
          parser.state = S.OPEN_WAKA
          parser.startTagPosition = parser.position
        } else {
          if (not(whitespace, c) && (!parser.sawRoot || parser.closedRoot))
            strictFail(parser, "Text data outside of root node.")
          if (c === "&") parser.state = S.TEXT_ENTITY
          else parser.textNode += c
        }
      continue

      case S.SCRIPT:
        // only non-strict
        if (c === "<") {
          parser.state = S.SCRIPT_ENDING
        } else parser.script += c
      continue

      case S.SCRIPT_ENDING:
        if (c === "/") {
          parser.state = S.CLOSE_TAG
        } else {
          parser.script += "<" + c
          parser.state = S.SCRIPT
        }
      continue

      case S.OPEN_WAKA:
        // either a /, ?, !, or text is coming next.
        if (c === "!") {
          parser.state = S.SGML_DECL
          parser.sgmlDecl = ""
        } else if (is(whitespace, c)) {
          // wait for it...
        } else if (is(nameStart,c)) {
          parser.state = S.OPEN_TAG
          parser.tagName = c
        } else if (c === "/") {
          parser.state = S.CLOSE_TAG
          parser.tagName = ""
        } else if (c === "?") {
          parser.state = S.PROC_INST
          parser.procInstName = parser.procInstBody = ""
        } else {
          strictFail(parser, "Unencoded <")
          // if there was some whitespace, then add that in.
          if (parser.startTagPosition + 1 < parser.position) {
            var pad = parser.position - parser.startTagPosition
            c = new Array(pad).join(" ") + c
          }
          parser.textNode += "<" + c
          parser.state = S.TEXT
        }
      continue

      case S.SGML_DECL:
        if ((parser.sgmlDecl+c).toUpperCase() === CDATA) {
          emitNode(parser, "onopencdata")
          parser.state = S.CDATA
          parser.sgmlDecl = ""
          parser.cdata = ""
        } else if (parser.sgmlDecl+c === "--") {
          parser.state = S.COMMENT
          parser.comment = ""
          parser.sgmlDecl = ""
        } else if ((parser.sgmlDecl+c).toUpperCase() === DOCTYPE) {
          parser.state = S.DOCTYPE
          if (parser.doctype || parser.sawRoot) strictFail(parser,
            "Inappropriately located doctype declaration")
          parser.doctype = ""
          parser.sgmlDecl = ""
        } else if (c === ">") {
          emitNode(parser, "onsgmldeclaration", parser.sgmlDecl)
          parser.sgmlDecl = ""
          parser.state = S.TEXT
        } else if (is(quote, c)) {
          parser.state = S.SGML_DECL_QUOTED
          parser.sgmlDecl += c
        } else parser.sgmlDecl += c
      continue

      case S.SGML_DECL_QUOTED:
        if (c === parser.q) {
          parser.state = S.SGML_DECL
          parser.q = ""
        }
        parser.sgmlDecl += c
      continue

      case S.DOCTYPE:
        if (c === ">") {
          parser.state = S.TEXT
          emitNode(parser, "ondoctype", parser.doctype)
          parser.doctype = true // just remember that we saw it.
        } else {
          parser.doctype += c
          if (c === "[") parser.state = S.DOCTYPE_DTD
          else if (is(quote, c)) {
            parser.state = S.DOCTYPE_QUOTED
            parser.q = c
          }
        }
      continue

      case S.DOCTYPE_QUOTED:
        parser.doctype += c
        if (c === parser.q) {
          parser.q = ""
          parser.state = S.DOCTYPE
        }
      continue

      case S.DOCTYPE_DTD:
        parser.doctype += c
        if (c === "]") parser.state = S.DOCTYPE
        else if (is(quote,c)) {
          parser.state = S.DOCTYPE_DTD_QUOTED
          parser.q = c
        }
      continue

      case S.DOCTYPE_DTD_QUOTED:
        parser.doctype += c
        if (c === parser.q) {
          parser.state = S.DOCTYPE_DTD
          parser.q = ""
        }
      continue

      case S.COMMENT:
        if (c === "-") parser.state = S.COMMENT_ENDING
        else parser.comment += c
      continue

      case S.COMMENT_ENDING:
        if (c === "-") {
          parser.state = S.COMMENT_ENDED
          parser.comment = textopts(parser.opt, parser.comment)
          if (parser.comment) emitNode(parser, "oncomment", parser.comment)
          parser.comment = ""
        } else {
          parser.comment += "-" + c
          parser.state = S.COMMENT
        }
      continue

      case S.COMMENT_ENDED:
        if (c !== ">") {
          strictFail(parser, "Malformed comment")
          // allow <!-- blah -- bloo --> in non-strict mode,
          // which is a comment of " blah -- bloo "
          parser.comment += "--" + c
          parser.state = S.COMMENT
        } else parser.state = S.TEXT
      continue

      case S.CDATA:
        if (c === "]") parser.state = S.CDATA_ENDING
        else parser.cdata += c
      continue

      case S.CDATA_ENDING:
        if (c === "]") parser.state = S.CDATA_ENDING_2
        else {
          parser.cdata += "]" + c
          parser.state = S.CDATA
        }
      continue

      case S.CDATA_ENDING_2:
        if (c === ">") {
          if (parser.cdata) emitNode(parser, "oncdata", parser.cdata)
          emitNode(parser, "onclosecdata")
          parser.cdata = ""
          parser.state = S.TEXT
        } else if (c === "]") {
          parser.cdata += "]"
        } else {
          parser.cdata += "]]" + c
          parser.state = S.CDATA
        }
      continue

      case S.PROC_INST:
        if (c === "?") parser.state = S.PROC_INST_ENDING
        else if (is(whitespace, c)) parser.state = S.PROC_INST_BODY
        else parser.procInstName += c
      continue

      case S.PROC_INST_BODY:
        if (!parser.procInstBody && is(whitespace, c)) continue
        else if (c === "?") parser.state = S.PROC_INST_ENDING
        else parser.procInstBody += c
      continue

      case S.PROC_INST_ENDING:
        if (c === ">") {
          emitNode(parser, "onprocessinginstruction", {
            name : parser.procInstName,
            body : parser.procInstBody
          })
          parser.procInstName = parser.procInstBody = ""
          parser.state = S.TEXT
        } else {
          parser.procInstBody += "?" + c
          parser.state = S.PROC_INST_BODY
        }
      continue

      case S.OPEN_TAG:
        if (is(nameBody, c)) parser.tagName += c
        else {
          newTag(parser)
          if (c === ">") openTag(parser)
          else if (c === "/") parser.state = S.OPEN_TAG_SLASH
          else {
            if (not(whitespace, c)) strictFail(
              parser, "Invalid character in tag name")
            parser.state = S.ATTRIB
          }
        }
      continue

      case S.OPEN_TAG_SLASH:
        if (c === ">") {
          openTag(parser, true)
          closeTag(parser)
        } else {
          strictFail(parser, "Forward-slash in opening tag not followed by >")
          parser.state = S.ATTRIB
        }
      continue

      case S.ATTRIB:
        // haven't read the attribute name yet.
        if (is(whitespace, c)) continue
        else if (c === ">") openTag(parser)
        else if (c === "/") parser.state = S.OPEN_TAG_SLASH
        else if (is(nameStart, c)) {
          parser.attribName = c
          parser.attribValue = ""
          parser.state = S.ATTRIB_NAME
        } else strictFail(parser, "Invalid attribute name")
      continue

      case S.ATTRIB_NAME:
        if (c === "=") parser.state = S.ATTRIB_VALUE
        else if (c === ">") {
          strictFail(parser, "Attribute without value")
          parser.attribValue = parser.attribName
          attrib(parser)
          openTag(parser)
        }
        else if (is(whitespace, c)) parser.state = S.ATTRIB_NAME_SAW_WHITE
        else if (is(nameBody, c)) parser.attribName += c
        else strictFail(parser, "Invalid attribute name")
      continue

      case S.ATTRIB_NAME_SAW_WHITE:
        if (c === "=") parser.state = S.ATTRIB_VALUE
        else if (is(whitespace, c)) continue
        else {
          strictFail(parser, "Attribute without value")
          parser.tag.attributes[parser.attribName] = ""
          parser.attribValue = ""
          emitNode(parser, "onattribute",
                   { name : parser.attribName, value : "" })
          parser.attribName = ""
          if (c === ">") openTag(parser)
          else if (is(nameStart, c)) {
            parser.attribName = c
            parser.state = S.ATTRIB_NAME
          } else {
            strictFail(parser, "Invalid attribute name")
            parser.state = S.ATTRIB
          }
        }
      continue

      case S.ATTRIB_VALUE:
        if (is(whitespace, c)) continue
        else if (is(quote, c)) {
          parser.q = c
          parser.state = S.ATTRIB_VALUE_QUOTED
        } else {
          strictFail(parser, "Unquoted attribute value")
          parser.state = S.ATTRIB_VALUE_UNQUOTED
          parser.attribValue = c
        }
      continue

      case S.ATTRIB_VALUE_QUOTED:
        if (c !== parser.q) {
          if (c === "&") parser.state = S.ATTRIB_VALUE_ENTITY_Q
          else parser.attribValue += c
          continue
        }
        attrib(parser)
        parser.q = ""
        parser.state = S.ATTRIB_VALUE_CLOSED
      continue

      case S.ATTRIB_VALUE_CLOSED:
        if (is(whitespace, c)) {
          parser.state = S.ATTRIB
        } else if (c === ">") openTag(parser)
        else if (c === "/") parser.state = S.OPEN_TAG_SLASH
        else if (is(nameStart, c)) {
          strictFail(parser, "No whitespace between attributes")
          parser.attribName = c
          parser.attribValue = ""
          parser.state = S.ATTRIB_NAME
        } else strictFail(parser, "Invalid attribute name")
      continue

      case S.ATTRIB_VALUE_UNQUOTED:
        if (not(attribEnd,c)) {
          if (c === "&") parser.state = S.ATTRIB_VALUE_ENTITY_U
          else parser.attribValue += c
          continue
        }
        attrib(parser)
        if (c === ">") openTag(parser)
        else parser.state = S.ATTRIB
      continue

      case S.CLOSE_TAG:
        if (!parser.tagName) {
          if (is(whitespace, c)) continue
          else if (not(nameStart, c)) {
            if (parser.script) {
              parser.script += "</" + c
              parser.state = S.SCRIPT
            } else {
              strictFail(parser, "Invalid tagname in closing tag.")
            }
          } else parser.tagName = c
        }
        else if (c === ">") closeTag(parser)
        else if (is(nameBody, c)) parser.tagName += c
        else if (parser.script) {
          parser.script += "</" + parser.tagName
          parser.tagName = ""
          parser.state = S.SCRIPT
        } else {
          if (not(whitespace, c)) strictFail(parser,
            "Invalid tagname in closing tag")
          parser.state = S.CLOSE_TAG_SAW_WHITE
        }
      continue

      case S.CLOSE_TAG_SAW_WHITE:
        if (is(whitespace, c)) continue
        if (c === ">") closeTag(parser)
        else strictFail(parser, "Invalid characters in closing tag")
      continue

      case S.TEXT_ENTITY:
      case S.ATTRIB_VALUE_ENTITY_Q:
      case S.ATTRIB_VALUE_ENTITY_U:
        switch(parser.state) {
          case S.TEXT_ENTITY:
            var returnState = S.TEXT, buffer = "textNode"
          break

          case S.ATTRIB_VALUE_ENTITY_Q:
            var returnState = S.ATTRIB_VALUE_QUOTED, buffer = "attribValue"
          break

          case S.ATTRIB_VALUE_ENTITY_U:
            var returnState = S.ATTRIB_VALUE_UNQUOTED, buffer = "attribValue"
          break
        }
        if (c === ";") {
          parser[buffer] += parseEntity(parser)
          parser.entity = ""
          parser.state = returnState
        }
        else if (is(entity, c)) parser.entity += c
        else {
          strictFail(parser, "Invalid character entity")
          parser[buffer] += "&" + parser.entity + c
          parser.entity = ""
          parser.state = returnState
        }
      continue

      default:
        throw new Error(parser, "Unknown state: " + parser.state)
    }
  } // while
  // cdata blocks can get very big under normal conditions. emit and move on.
  // if (parser.state === S.CDATA && parser.cdata) {
  //   emitNode(parser, "oncdata", parser.cdata)
  //   parser.cdata = ""
  // }
  if (parser.position >= parser.bufferCheckPosition) checkBufferLength(parser)
  return parser
}

/*! http://mths.be/fromcodepoint v0.1.0 by @mathias */
if (!String.fromCodePoint) {
        (function() {
                var stringFromCharCode = String.fromCharCode;
                var floor = Math.floor;
                var fromCodePoint = function() {
                        var MAX_SIZE = 0x4000;
                        var codeUnits = [];
                        var highSurrogate;
                        var lowSurrogate;
                        var index = -1;
                        var length = arguments.length;
                        if (!length) {
                                return '';
                        }
                        var result = '';
                        while (++index < length) {
                                var codePoint = Number(arguments[index]);
                                if (
                                        !isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
                                        codePoint < 0 || // not a valid Unicode code point
                                        codePoint > 0x10FFFF || // not a valid Unicode code point
                                        floor(codePoint) != codePoint // not an integer
                                ) {
                                        throw RangeError('Invalid code point: ' + codePoint);
                                }
                                if (codePoint <= 0xFFFF) { // BMP code point
                                        codeUnits.push(codePoint);
                                } else { // Astral code point; split in surrogate halves
                                        // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                                        codePoint -= 0x10000;
                                        highSurrogate = (codePoint >> 10) + 0xD800;
                                        lowSurrogate = (codePoint % 0x400) + 0xDC00;
                                        codeUnits.push(highSurrogate, lowSurrogate);
                                }
                                if (index + 1 == length || codeUnits.length > MAX_SIZE) {
                                        result += stringFromCharCode.apply(null, codeUnits);
                                        codeUnits.length = 0;
                                }
                        }
                        return result;
                };
                if (Object.defineProperty) {
                        Object.defineProperty(String, 'fromCodePoint', {
                                'value': fromCodePoint,
                                'configurable': true,
                                'writable': true
                        });
                } else {
                        String.fromCodePoint = fromCodePoint;
                }
        }());
}

})(typeof exports === "undefined" ? sax = {} : exports);

}).call(this,require("buffer").Buffer)

},{"buffer":13,"stream":32,"string_decoder":33}],12:[function(require,module,exports){
/*!
 * jQuery JavaScript Library v2.1.3
 * http://jquery.com/
 *
 * Includes Sizzle.js
 * http://sizzlejs.com/
 *
 * Copyright 2005, 2014 jQuery Foundation, Inc. and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2014-12-18T15:11Z
 */

(function( global, factory ) {

	if ( typeof module === "object" && typeof module.exports === "object" ) {
		// For CommonJS and CommonJS-like environments where a proper `window`
		// is present, execute the factory and get jQuery.
		// For environments that do not have a `window` with a `document`
		// (such as Node.js), expose a factory as module.exports.
		// This accentuates the need for the creation of a real `window`.
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
}(typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Support: Firefox 18+
// Can't be in strict mode, several libs including ASP.NET trace
// the stack via arguments.caller.callee and Firefox dies if
// you try to trace through "use strict" call chains. (#13335)
//

var arr = [];

var slice = arr.slice;

var concat = arr.concat;

var push = arr.push;

var indexOf = arr.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var support = {};



var
	// Use the correct document accordingly with window argument (sandbox)
	document = window.document,

	version = "2.1.3",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {
		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android<4.1
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,

	// Matches dashed string for camelizing
	rmsPrefix = /^-ms-/,
	rdashAlpha = /-([\da-z])/gi,

	// Used by jQuery.camelCase as callback to replace()
	fcamelCase = function( all, letter ) {
		return letter.toUpperCase();
	};

jQuery.fn = jQuery.prototype = {
	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// Start with an empty selector
	selector: "",

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {
		return num != null ?

			// Return just the one element from the set
			( num < 0 ? this[ num + this.length ] : this[ num ] ) :

			// Return all the elements in a clean array
			slice.call( this );
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;
		ret.context = this.context;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	// (You can seed the arguments with an array of args, but this is
	// only used internally.)
	each: function( callback, args ) {
		return jQuery.each( this, callback, args );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map(this, function( elem, i ) {
			return callback.call( elem, i, elem );
		}));
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[j] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor(null);
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: arr.sort,
	splice: arr.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// Skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !jQuery.isFunction(target) ) {
		target = {};
	}

	// Extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)) ) ) {
					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && jQuery.isArray(src) ? src : [];

					} else {
						clone = src && jQuery.isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend({
	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	isFunction: function( obj ) {
		return jQuery.type(obj) === "function";
	},

	isArray: Array.isArray,

	isWindow: function( obj ) {
		return obj != null && obj === obj.window;
	},

	isNumeric: function( obj ) {
		// parseFloat NaNs numeric-cast false positives (null|true|false|"")
		// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
		// subtraction forces infinities to NaN
		// adding 1 corrects loss of precision from parseFloat (#15100)
		return !jQuery.isArray( obj ) && (obj - parseFloat( obj ) + 1) >= 0;
	},

	isPlainObject: function( obj ) {
		// Not plain objects:
		// - Any object or value whose internal [[Class]] property is not "[object Object]"
		// - DOM nodes
		// - window
		if ( jQuery.type( obj ) !== "object" || obj.nodeType || jQuery.isWindow( obj ) ) {
			return false;
		}

		if ( obj.constructor &&
				!hasOwn.call( obj.constructor.prototype, "isPrototypeOf" ) ) {
			return false;
		}

		// If the function hasn't returned already, we're confident that
		// |obj| is a plain object, created by {} or constructed with new Object
		return true;
	},

	isEmptyObject: function( obj ) {
		var name;
		for ( name in obj ) {
			return false;
		}
		return true;
	},

	type: function( obj ) {
		if ( obj == null ) {
			return obj + "";
		}
		// Support: Android<4.0, iOS<6 (functionish RegExp)
		return typeof obj === "object" || typeof obj === "function" ?
			class2type[ toString.call(obj) ] || "object" :
			typeof obj;
	},

	// Evaluates a script in a global context
	globalEval: function( code ) {
		var script,
			indirect = eval;

		code = jQuery.trim( code );

		if ( code ) {
			// If the code includes a valid, prologue position
			// strict mode pragma, execute code by injecting a
			// script tag into the document.
			if ( code.indexOf("use strict") === 1 ) {
				script = document.createElement("script");
				script.text = code;
				document.head.appendChild( script ).parentNode.removeChild( script );
			} else {
			// Otherwise, avoid the DOM node creation, insertion
			// and removal by using an indirect global eval
				indirect( code );
			}
		}
	},

	// Convert dashed to camelCase; used by the css and data modules
	// Support: IE9-11+
	// Microsoft forgot to hump their vendor prefix (#9572)
	camelCase: function( string ) {
		return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
	},

	nodeName: function( elem, name ) {
		return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
	},

	// args is for internal usage only
	each: function( obj, callback, args ) {
		var value,
			i = 0,
			length = obj.length,
			isArray = isArraylike( obj );

		if ( args ) {
			if ( isArray ) {
				for ( ; i < length; i++ ) {
					value = callback.apply( obj[ i ], args );

					if ( value === false ) {
						break;
					}
				}
			} else {
				for ( i in obj ) {
					value = callback.apply( obj[ i ], args );

					if ( value === false ) {
						break;
					}
				}
			}

		// A special, fast, case for the most common use of each
		} else {
			if ( isArray ) {
				for ( ; i < length; i++ ) {
					value = callback.call( obj[ i ], i, obj[ i ] );

					if ( value === false ) {
						break;
					}
				}
			} else {
				for ( i in obj ) {
					value = callback.call( obj[ i ], i, obj[ i ] );

					if ( value === false ) {
						break;
					}
				}
			}
		}

		return obj;
	},

	// Support: Android<4.1
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArraylike( Object(arr) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		return arr == null ? -1 : indexOf.call( arr, elem, i );
	},

	merge: function( first, second ) {
		var len = +second.length,
			j = 0,
			i = first.length;

		for ( ; j < len; j++ ) {
			first[ i++ ] = second[ j ];
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, invert ) {
		var callbackInverse,
			matches = [],
			i = 0,
			length = elems.length,
			callbackExpect = !invert;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( ; i < length; i++ ) {
			callbackInverse = !callback( elems[ i ], i );
			if ( callbackInverse !== callbackExpect ) {
				matches.push( elems[ i ] );
			}
		}

		return matches;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var value,
			i = 0,
			length = elems.length,
			isArray = isArraylike( elems ),
			ret = [];

		// Go through the array, translating each of the items to their new values
		if ( isArray ) {
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}

		// Go through every key on the object,
		} else {
			for ( i in elems ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}
		}

		// Flatten any nested arrays
		return concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// Bind a function to a context, optionally partially applying any
	// arguments.
	proxy: function( fn, context ) {
		var tmp, args, proxy;

		if ( typeof context === "string" ) {
			tmp = fn[ context ];
			context = fn;
			fn = tmp;
		}

		// Quick check to determine if target is callable, in the spec
		// this throws a TypeError, but we will just return undefined.
		if ( !jQuery.isFunction( fn ) ) {
			return undefined;
		}

		// Simulated bind
		args = slice.call( arguments, 2 );
		proxy = function() {
			return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
		};

		// Set the guid of unique handler to the same of original handler, so it can be removed
		proxy.guid = fn.guid = fn.guid || jQuery.guid++;

		return proxy;
	},

	now: Date.now,

	// jQuery.support is not used in Core but other projects attach their
	// properties to it so it needs to exist.
	support: support
});

// Populate the class2type map
jQuery.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
	class2type[ "[object " + name + "]" ] = name.toLowerCase();
});

function isArraylike( obj ) {
	var length = obj.length,
		type = jQuery.type( obj );

	if ( type === "function" || jQuery.isWindow( obj ) ) {
		return false;
	}

	if ( obj.nodeType === 1 && length ) {
		return true;
	}

	return type === "array" || length === 0 ||
		typeof length === "number" && length > 0 && ( length - 1 ) in obj;
}
var Sizzle =
/*!
 * Sizzle CSS Selector Engine v2.2.0-pre
 * http://sizzlejs.com/
 *
 * Copyright 2008, 2014 jQuery Foundation, Inc. and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2014-12-16
 */
(function( window ) {

var i,
	support,
	Expr,
	getText,
	isXML,
	tokenize,
	compile,
	select,
	outermostContext,
	sortInput,
	hasDuplicate,

	// Local document vars
	setDocument,
	document,
	docElem,
	documentIsHTML,
	rbuggyQSA,
	rbuggyMatches,
	matches,
	contains,

	// Instance-specific data
	expando = "sizzle" + 1 * new Date(),
	preferredDoc = window.document,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	// General-purpose constants
	MAX_NEGATIVE = 1 << 31,

	// Instance methods
	hasOwn = ({}).hasOwnProperty,
	arr = [],
	pop = arr.pop,
	push_native = arr.push,
	push = arr.push,
	slice = arr.slice,
	// Use a stripped-down indexOf as it's faster than native
	// http://jsperf.com/thor-indexof-vs-for/5
	indexOf = function( list, elem ) {
		var i = 0,
			len = list.length;
		for ( ; i < len; i++ ) {
			if ( list[i] === elem ) {
				return i;
			}
		}
		return -1;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// Whitespace characters http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",
	// http://www.w3.org/TR/css3-syntax/#characters
	characterEncoding = "(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",

	// Loosely modeled on CSS identifier characters
	// An unquoted value should be a CSS identifier http://www.w3.org/TR/css3-selectors/#attribute-selectors
	// Proper syntax: http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
	identifier = characterEncoding.replace( "w", "w#" ),

	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + characterEncoding + ")(?:" + whitespace +
		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +
		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
		"*\\]",

	pseudos = ":(" + characterEncoding + ")(?:\\((" +
		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rwhitespace = new RegExp( whitespace + "+", "g" ),
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),

	rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		"ID": new RegExp( "^#(" + characterEncoding + ")" ),
		"CLASS": new RegExp( "^\\.(" + characterEncoding + ")" ),
		"TAG": new RegExp( "^(" + characterEncoding.replace( "w", "w*" ) + ")" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		"needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
			whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	rnative = /^[^{]+\{\s*\[native \w/,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,
	rescape = /'|\\/g,

	// CSS escapes http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
	funescape = function( _, escaped, escapedWhitespace ) {
		var high = "0x" + escaped - 0x10000;
		// NaN means non-codepoint
		// Support: Firefox<24
		// Workaround erroneous numeric interpretation of +"0x"
		return high !== high || escapedWhitespace ?
			escaped :
			high < 0 ?
				// BMP codepoint
				String.fromCharCode( high + 0x10000 ) :
				// Supplemental Plane codepoint (surrogate pair)
				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	},

	// Used for iframes
	// See setDocument()
	// Removing the function wrapper causes a "Permission Denied"
	// error in IE
	unloadHandler = function() {
		setDocument();
	};

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		(arr = slice.call( preferredDoc.childNodes )),
		preferredDoc.childNodes
	);
	// Support: Android<4.0
	// Detect silently failing push.apply
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = { apply: arr.length ?

		// Leverage slice if possible
		function( target, els ) {
			push_native.apply( target, slice.call(els) );
		} :

		// Support: IE<9
		// Otherwise append directly
		function( target, els ) {
			var j = target.length,
				i = 0;
			// Can't trust NodeList.length
			while ( (target[j++] = els[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function Sizzle( selector, context, results, seed ) {
	var match, elem, m, nodeType,
		// QSA vars
		i, groups, old, nid, newContext, newSelector;

	if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
		setDocument( context );
	}

	context = context || document;
	results = results || [];
	nodeType = context.nodeType;

	if ( typeof selector !== "string" || !selector ||
		nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

		return results;
	}

	if ( !seed && documentIsHTML ) {

		// Try to shortcut find operations when possible (e.g., not under DocumentFragment)
		if ( nodeType !== 11 && (match = rquickExpr.exec( selector )) ) {
			// Speed-up: Sizzle("#ID")
			if ( (m = match[1]) ) {
				if ( nodeType === 9 ) {
					elem = context.getElementById( m );
					// Check parentNode to catch when Blackberry 4.6 returns
					// nodes that are no longer in the document (jQuery #6963)
					if ( elem && elem.parentNode ) {
						// Handle the case where IE, Opera, and Webkit return items
						// by name instead of ID
						if ( elem.id === m ) {
							results.push( elem );
							return results;
						}
					} else {
						return results;
					}
				} else {
					// Context is not a document
					if ( context.ownerDocument && (elem = context.ownerDocument.getElementById( m )) &&
						contains( context, elem ) && elem.id === m ) {
						results.push( elem );
						return results;
					}
				}

			// Speed-up: Sizzle("TAG")
			} else if ( match[2] ) {
				push.apply( results, context.getElementsByTagName( selector ) );
				return results;

			// Speed-up: Sizzle(".CLASS")
			} else if ( (m = match[3]) && support.getElementsByClassName ) {
				push.apply( results, context.getElementsByClassName( m ) );
				return results;
			}
		}

		// QSA path
		if ( support.qsa && (!rbuggyQSA || !rbuggyQSA.test( selector )) ) {
			nid = old = expando;
			newContext = context;
			newSelector = nodeType !== 1 && selector;

			// qSA works strangely on Element-rooted queries
			// We can work around this by specifying an extra ID on the root
			// and working up from there (Thanks to Andrew Dupont for the technique)
			// IE 8 doesn't work on object elements
			if ( nodeType === 1 && context.nodeName.toLowerCase() !== "object" ) {
				groups = tokenize( selector );

				if ( (old = context.getAttribute("id")) ) {
					nid = old.replace( rescape, "\\$&" );
				} else {
					context.setAttribute( "id", nid );
				}
				nid = "[id='" + nid + "'] ";

				i = groups.length;
				while ( i-- ) {
					groups[i] = nid + toSelector( groups[i] );
				}
				newContext = rsibling.test( selector ) && testContext( context.parentNode ) || context;
				newSelector = groups.join(",");
			}

			if ( newSelector ) {
				try {
					push.apply( results,
						newContext.querySelectorAll( newSelector )
					);
					return results;
				} catch(qsaError) {
				} finally {
					if ( !old ) {
						context.removeAttribute("id");
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrim, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {Function(string, Object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {
		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {
			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return (cache[ key + " " ] = value);
	}
	return cache;
}

/**
 * Mark a function for special use by Sizzle
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created div and expects a boolean result
 */
function assert( fn ) {
	var div = document.createElement("div");

	try {
		return !!fn( div );
	} catch (e) {
		return false;
	} finally {
		// Remove from its parent by default
		if ( div.parentNode ) {
			div.parentNode.removeChild( div );
		}
		// release memory in IE
		div = null;
	}
}

/**
 * Adds the same handler for all of the specified attrs
 * @param {String} attrs Pipe-separated list of attributes
 * @param {Function} handler The method that will be applied
 */
function addHandle( attrs, handler ) {
	var arr = attrs.split("|"),
		i = attrs.length;

	while ( i-- ) {
		Expr.attrHandle[ arr[i] ] = handler;
	}
}

/**
 * Checks document order of two siblings
 * @param {Element} a
 * @param {Element} b
 * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
 */
function siblingCheck( a, b ) {
	var cur = b && a,
		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
			( ~b.sourceIndex || MAX_NEGATIVE ) -
			( ~a.sourceIndex || MAX_NEGATIVE );

	// Use IE sourceIndex if available on both nodes
	if ( diff ) {
		return diff;
	}

	// Check if b follows a
	if ( cur ) {
		while ( (cur = cur.nextSibling) ) {
			if ( cur === b ) {
				return -1;
			}
		}
	}

	return a ? 1 : -1;
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return name === "input" && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return (name === "input" || name === "button") && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction(function( argument ) {
		argument = +argument;
		return markFunction(function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ (j = matchIndexes[i]) ] ) {
					seed[j] = !(matches[j] = seed[j]);
				}
			}
		});
	});
}

/**
 * Checks a node for validity as a Sizzle context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== "undefined" && context;
}

// Expose support vars for convenience
support = Sizzle.support = {};

/**
 * Detects XML nodes
 * @param {Element|Object} elem An element or a document
 * @returns {Boolean} True iff elem is a non-HTML XML node
 */
isXML = Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833)
	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [doc] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
setDocument = Sizzle.setDocument = function( node ) {
	var hasCompare, parent,
		doc = node ? node.ownerDocument || node : preferredDoc;

	// If no document and documentElement is available, return
	if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Set our document
	document = doc;
	docElem = doc.documentElement;
	parent = doc.defaultView;

	// Support: IE>8
	// If iframe document is assigned to "document" variable and if iframe has been reloaded,
	// IE will throw "permission denied" error when accessing "document" variable, see jQuery #13936
	// IE6-8 do not support the defaultView property so parent will be undefined
	if ( parent && parent !== parent.top ) {
		// IE11 does not have attachEvent, so all must suffer
		if ( parent.addEventListener ) {
			parent.addEventListener( "unload", unloadHandler, false );
		} else if ( parent.attachEvent ) {
			parent.attachEvent( "onunload", unloadHandler );
		}
	}

	/* Support tests
	---------------------------------------------------------------------- */
	documentIsHTML = !isXML( doc );

	/* Attributes
	---------------------------------------------------------------------- */

	// Support: IE<8
	// Verify that getAttribute really returns attributes and not properties
	// (excepting IE8 booleans)
	support.attributes = assert(function( div ) {
		div.className = "i";
		return !div.getAttribute("className");
	});

	/* getElement(s)By*
	---------------------------------------------------------------------- */

	// Check if getElementsByTagName("*") returns only elements
	support.getElementsByTagName = assert(function( div ) {
		div.appendChild( doc.createComment("") );
		return !div.getElementsByTagName("*").length;
	});

	// Support: IE<9
	support.getElementsByClassName = rnative.test( doc.getElementsByClassName );

	// Support: IE<10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert(function( div ) {
		docElem.appendChild( div ).id = expando;
		return !doc.getElementsByName || !doc.getElementsByName( expando ).length;
	});

	// ID find and filter
	if ( support.getById ) {
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var m = context.getElementById( id );
				// Check parentNode to catch when Blackberry 4.6 returns
				// nodes that are no longer in the document #6963
				return m && m.parentNode ? [ m ] : [];
			}
		};
		Expr.filter["ID"] = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute("id") === attrId;
			};
		};
	} else {
		// Support: IE6/7
		// getElementById is not reliable as a find shortcut
		delete Expr.find["ID"];

		Expr.filter["ID"] =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
				return node && node.value === attrId;
			};
		};
	}

	// Tag
	Expr.find["TAG"] = support.getElementsByTagName ?
		function( tag, context ) {
			if ( typeof context.getElementsByTagName !== "undefined" ) {
				return context.getElementsByTagName( tag );

			// DocumentFragment nodes don't have gEBTN
			} else if ( support.qsa ) {
				return context.querySelectorAll( tag );
			}
		} :

		function( tag, context ) {
			var elem,
				tmp = [],
				i = 0,
				// By happy coincidence, a (broken) gEBTN appears on DocumentFragment nodes too
				results = context.getElementsByTagName( tag );

			// Filter out possible comments
			if ( tag === "*" ) {
				while ( (elem = results[i++]) ) {
					if ( elem.nodeType === 1 ) {
						tmp.push( elem );
					}
				}

				return tmp;
			}
			return results;
		};

	// Class
	Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
		if ( documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
	rbuggyMatches = [];

	// qSa(:focus) reports false when true (Chrome 21)
	// We allow this because of a bug in IE8/9 that throws an error
	// whenever `document.activeElement` is accessed on an iframe
	// So, we allow :focus to pass through QSA all the time to avoid the IE error
	// See http://bugs.jquery.com/ticket/13378
	rbuggyQSA = [];

	if ( (support.qsa = rnative.test( doc.querySelectorAll )) ) {
		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( div ) {
			// Select is set to empty string on purpose
			// This is to test IE's treatment of not explicitly
			// setting a boolean content attribute,
			// since its presence should be enough
			// http://bugs.jquery.com/ticket/12359
			docElem.appendChild( div ).innerHTML = "<a id='" + expando + "'></a>" +
				"<select id='" + expando + "-\f]' msallowcapture=''>" +
				"<option selected=''></option></select>";

			// Support: IE8, Opera 11-12.16
			// Nothing should be selected when empty strings follow ^= or $= or *=
			// The test attribute must be unknown in Opera but "safe" for WinRT
			// http://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
			if ( div.querySelectorAll("[msallowcapture^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
			}

			// Support: IE8
			// Boolean attributes and "value" are not treated correctly
			if ( !div.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
			}

			// Support: Chrome<29, Android<4.2+, Safari<7.0+, iOS<7.0+, PhantomJS<1.9.7+
			if ( !div.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
				rbuggyQSA.push("~=");
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here and will not see later tests
			if ( !div.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}

			// Support: Safari 8+, iOS 8+
			// https://bugs.webkit.org/show_bug.cgi?id=136851
			// In-page `selector#id sibing-combinator selector` fails
			if ( !div.querySelectorAll( "a#" + expando + "+*" ).length ) {
				rbuggyQSA.push(".#.+[+~]");
			}
		});

		assert(function( div ) {
			// Support: Windows 8 Native Apps
			// The type and name attributes are restricted during .innerHTML assignment
			var input = doc.createElement("input");
			input.setAttribute( "type", "hidden" );
			div.appendChild( input ).setAttribute( "name", "D" );

			// Support: IE8
			// Enforce case-sensitivity of name attribute
			if ( div.querySelectorAll("[name=d]").length ) {
				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here and will not see later tests
			if ( !div.querySelectorAll(":enabled").length ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			div.querySelectorAll("*,:x");
			rbuggyQSA.push(",.*:");
		});
	}

	if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector) )) ) {

		assert(function( div ) {
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node (IE 9)
			support.disconnectedMatch = matches.call( div, "div" );

			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( div, "[s!='']:x" );
			rbuggyMatches.push( "!=", pseudos );
		});
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );

	/* Contains
	---------------------------------------------------------------------- */
	hasCompare = rnative.test( docElem.compareDocumentPosition );

	// Element contains another
	// Purposefully does not implement inclusive descendent
	// As in, an element does not contain itself
	contains = hasCompare || rnative.test( docElem.contains ) ?
		function( a, b ) {
			var adown = a.nodeType === 9 ? a.documentElement : a,
				bup = b && b.parentNode;
			return a === bup || !!( bup && bup.nodeType === 1 && (
				adown.contains ?
					adown.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			));
		} :
		function( a, b ) {
			if ( b ) {
				while ( (b = b.parentNode) ) {
					if ( b === a ) {
						return true;
					}
				}
			}
			return false;
		};

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = hasCompare ?
	function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			(!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {

			// Choose the first element that is related to our preferred document
			if ( a === doc || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
				return -1;
			}
			if ( b === doc || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	} :
	function( a, b ) {
		// Exit early if the nodes are identical
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var cur,
			i = 0,
			aup = a.parentNode,
			bup = b.parentNode,
			ap = [ a ],
			bp = [ b ];

		// Parentless nodes are either documents or disconnected
		if ( !aup || !bup ) {
			return a === doc ? -1 :
				b === doc ? 1 :
				aup ? -1 :
				bup ? 1 :
				sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;

		// If the nodes are siblings, we can do a quick check
		} else if ( aup === bup ) {
			return siblingCheck( a, b );
		}

		// Otherwise we need full lists of their ancestors for comparison
		cur = a;
		while ( (cur = cur.parentNode) ) {
			ap.unshift( cur );
		}
		cur = b;
		while ( (cur = cur.parentNode) ) {
			bp.unshift( cur );
		}

		// Walk down the tree looking for a discrepancy
		while ( ap[i] === bp[i] ) {
			i++;
		}

		return i ?
			// Do a sibling check if the nodes have a common ancestor
			siblingCheck( ap[i], bp[i] ) :

			// Otherwise nodes in our document sort first
			ap[i] === preferredDoc ? -1 :
			bp[i] === preferredDoc ? 1 :
			0;
	};

	return doc;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	// Make sure that attribute selectors are quoted
	expr = expr.replace( rattributeQuotes, "='$1']" );

	if ( support.matchesSelector && documentIsHTML &&
		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch (e) {}
	}

	return Sizzle( expr, document, null, [ elem ] ).length > 0;
};

Sizzle.contains = function( context, elem ) {
	// Set document vars if needed
	if ( ( context.ownerDocument || context ) !== document ) {
		setDocument( context );
	}
	return contains( context, elem );
};

Sizzle.attr = function( elem, name ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],
		// Don't get fooled by Object.prototype properties (jQuery #13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	return val !== undefined ?
		val :
		support.attributes || !documentIsHTML ?
			elem.getAttribute( name ) :
			(val = elem.getAttributeNode(name)) && val.specified ?
				val.value :
				null;
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
Sizzle.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	hasDuplicate = !support.detectDuplicates;
	sortInput = !support.sortStable && results.slice( 0 );
	results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			results.splice( duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( !nodeType ) {
		// If no nodeType, this is expected to be an array
		while ( (node = elem[i++]) ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		// Use textContent for elements
		// innerText usage removed for consistency of new lines (jQuery #11153)
		if ( typeof elem.textContent === "string" ) {
			return elem.textContent;
		} else {
			// Traverse its children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				ret += getText( elem );
			}
		}
	} else if ( nodeType === 3 || nodeType === 4 ) {
		return elem.nodeValue;
	}
	// Do not include comment or processing instruction nodes

	return ret;
};

Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1].slice( 0, 3 ) === "nth" ) {
				// nth-* requires argument
				if ( !match[3] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
				match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );

			// other types prohibit arguments
			} else if ( match[3] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var excess,
				unquoted = !match[6] && match[2];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[3] ) {
				match[2] = match[4] || match[5] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&
				// Get excess from tokenize (recursively)
				(excess = tokenize( unquoted, true )) &&
				// advance to the next closing parenthesis
				(excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

				// excess is a negative index
				match[0] = match[0].slice( 0, excess );
				match[2] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		"TAG": function( nodeNameSelector ) {
			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() { return true; } :
				function( elem ) {
					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
				};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				(pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
				classCache( className, function( elem ) {
					return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "" );
				});
		},

		"ATTR": function( name, operator, check ) {
			return function( elem ) {
				var result = Sizzle.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				return operator === "=" ? result === check :
					operator === "!=" ? result !== check :
					operator === "^=" ? check && result.indexOf( check ) === 0 :
					operator === "*=" ? check && result.indexOf( check ) > -1 :
					operator === "$=" ? check && result.slice( -check.length ) === check :
					operator === "~=" ? ( " " + result.replace( rwhitespace, " " ) + " " ).indexOf( check ) > -1 :
					operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
					false;
			};
		},

		"CHILD": function( type, what, argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, context, xml ) {
					var cache, outerCache, node, diff, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( (node = node[ dir ]) ) {
									if ( ofType ? node.nodeName.toLowerCase() === name : node.nodeType === 1 ) {
										return false;
									}
								}
								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {
							// Seek `elem` from a previously-cached index
							outerCache = parent[ expando ] || (parent[ expando ] = {});
							cache = outerCache[ type ] || [];
							nodeIndex = cache[0] === dirruns && cache[1];
							diff = cache[0] === dirruns && cache[2];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( (node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								(diff = nodeIndex = 0) || start.pop()) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									outerCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						// Use previously-cached element index if available
						} else if ( useCache && (cache = (elem[ expando ] || (elem[ expando ] = {}))[ type ]) && cache[0] === dirruns ) {
							diff = cache[1];

						// xml :nth-child(...) or :nth-last-child(...) or :nth(-last)?-of-type(...)
						} else {
							// Use the same loop as above to seek `elem` from the start
							while ( (node = ++nodeIndex && node && node[ dir ] ||
								(diff = nodeIndex = 0) || start.pop()) ) {

								if ( ( ofType ? node.nodeName.toLowerCase() === name : node.nodeType === 1 ) && ++diff ) {
									// Cache the index of each encountered element
									if ( useCache ) {
										(node[ expando ] || (node[ expando ] = {}))[ type ] = [ dirruns, diff ];
									}

									if ( node === elem ) {
										break;
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		"PSEUDO": function( pseudo, argument ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					Sizzle.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as Sizzle does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction(function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf( seed, matched[i] );
							seed[ idx ] = !( matches[ idx ] = matched[i] );
						}
					}) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {
		// Potentially complex pseudos
		"not": markFunction(function( selector ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrim, "$1" ) );

			return matcher[ expando ] ?
				markFunction(function( seed, matches, context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( (elem = unmatched[i]) ) {
							seed[i] = !(matches[i] = elem);
						}
					}
				}) :
				function( elem, context, xml ) {
					input[0] = elem;
					matcher( input, null, xml, results );
					// Don't keep the element (issue #299)
					input[0] = null;
					return !results.pop();
				};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"contains": markFunction(function( text ) {
			text = text.replace( runescape, funescape );
			return function( elem ) {
				return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// http://www.w3.org/TR/selectors/#lang-pseudo
		"lang": markFunction( function( lang ) {
			// lang value must be a valid identifier
			if ( !ridentifier.test(lang || "") ) {
				Sizzle.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( (elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( (elem = elem.parentNode) && elem.nodeType === 1 );
				return false;
			};
		}),

		// Miscellaneous
		"target": function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		"root": function( elem ) {
			return elem === docElem;
		},

		"focus": function( elem ) {
			return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
		},

		// Boolean properties
		"enabled": function( elem ) {
			return elem.disabled === false;
		},

		"disabled": function( elem ) {
			return elem.disabled === true;
		},

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		"empty": function( elem ) {
			// http://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		"parent": function( elem ) {
			return !Expr.pseudos["empty"]( elem );
		},

		// Element/input types
		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"text": function( elem ) {
			var attr;
			return elem.nodeName.toLowerCase() === "input" &&
				elem.type === "text" &&

				// Support: IE<8
				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		"first": createPositionalPseudo(function() {
			return [ 0 ];
		}),

		"last": createPositionalPseudo(function( matchIndexes, length ) {
			return [ length - 1 ];
		}),

		"eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		}),

		"even": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"odd": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		})
	}
};

Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || (match = rcomma.exec( soFar )) ) {
			if ( match ) {
				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[0].length ) || soFar;
			}
			groups.push( (tokens = []) );
		}

		matched = false;

		// Combinators
		if ( (match = rcombinators.exec( soFar )) ) {
			matched = match.shift();
			tokens.push({
				value: matched,
				// Cast descendant combinators to space
				type: match[0].replace( rtrim, " " )
			});
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
				(match = preFilters[ type ]( match ))) ) {
				matched = match.shift();
				tokens.push({
					value: matched,
					type: type,
					matches: match
				});
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	return parseOnly ?
		soFar.length :
		soFar ?
			Sizzle.error( selector ) :
			// Cache the tokens
			tokenCache( selector, groups ).slice( 0 );
};

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[i].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		checkNonElements = base && dir === "parentNode",
		doneName = done++;

	return combinator.first ?
		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from dir caching
			if ( xml ) {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || (elem[ expando ] = {});
						if ( (oldCache = outerCache[ dir ]) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return (newCache[ 2 ] = oldCache[ 2 ]);
						} else {
							// Reuse newcache so results back-propagate to previous elements
							outerCache[ dir ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
								return true;
							}
						}
					}
				}
			}
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[i]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[0];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( (elem = unmatched[i]) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction(function( seed, results, context, xml ) {
		var temp, i, elem,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems,

			matcherOut = matcher ?
				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

					// ...intermediate processing is necessary
					[] :

					// ...otherwise use results directly
					results :
				matcherIn;

		// Find primary matches
		if ( matcher ) {
			matcher( matcherIn, matcherOut, context, xml );
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( (elem = temp[i]) ) {
					matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {
					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( (elem = matcherOut[i]) ) {
							// Restore matcherIn since elem is not yet a final match
							temp.push( (matcherIn[i] = elem) );
						}
					}
					postFinder( null, (matcherOut = []), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( (elem = matcherOut[i]) &&
						(temp = postFinder ? indexOf( seed, elem ) : preMap[i]) > -1 ) {

						seed[temp] = !(results[temp] = elem);
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	});
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[0].type ],
		implicitRelative = leadingRelative || Expr.relative[" "],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {
			var ret = ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
				(checkContext = context).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );
			// Avoid hanging onto element (issue #299)
			checkContext = null;
			return ret;
		} ];

	for ( ; i < len; i++ ) {
		if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
			matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
		} else {
			matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {
				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[j].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(
						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
					).replace( rtrim, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,
				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
				len = elems.length;

			if ( outermost ) {
				outermostContext = context !== document && context;
			}

			// Add elements passing elementMatchers directly to results
			// Keep `i` a string if there are no elements so `matchedCount` will be "00" below
			// Support: IE<9, Safari
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
			for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;
					while ( (matcher = elementMatchers[j++]) ) {
						if ( matcher( elem, context, xml ) ) {
							results.push( elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {
					// They will have gone through all possible matchers
					if ( (elem = !matcher && elem) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// Apply set filters to unmatched elements
			matchedCount += i;
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( (matcher = setMatchers[j++]) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {
					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !(unmatched[i] || setMatched[i]) ) {
								setMatched[i] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					Sizzle.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {
		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[i] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
};

/**
 * A low-level selection function that works with Sizzle's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with Sizzle.compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
select = Sizzle.select = function( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( (selector = compiled.selector || selector) );

	results = results || [];

	// Try to minimize operations if there is no seed and only one group
	if ( match.length === 1 ) {

		// Take a shortcut and set the context if the root selector is an ID
		tokens = match[0] = match[0].slice( 0 );
		if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
				support.getById && context.nodeType === 9 && documentIsHTML &&
				Expr.relative[ tokens[1].type ] ) {

			context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[i];

			// Abort if we hit a combinator
			if ( Expr.relative[ (type = token.type) ] ) {
				break;
			}
			if ( (find = Expr.find[ type ]) ) {
				// Search, expanding context for leading sibling combinators
				if ( (seed = find(
					token.matches[0].replace( runescape, funescape ),
					rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
				)) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
};

// One-time assignments

// Sort stability
support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;

// Support: Chrome 14-35+
// Always assume duplicates if they aren't passed to the comparison function
support.detectDuplicates = !!hasDuplicate;

// Initialize against the default document
setDocument();

// Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert(function( div1 ) {
	// Should return 1, but returns 4 (following)
	return div1.compareDocumentPosition( document.createElement("div") ) & 1;
});

// Support: IE<8
// Prevent attribute/property "interpolation"
// http://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !assert(function( div ) {
	div.innerHTML = "<a href='#'></a>";
	return div.firstChild.getAttribute("href") === "#" ;
}) ) {
	addHandle( "type|href|height|width", function( elem, name, isXML ) {
		if ( !isXML ) {
			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
		}
	});
}

// Support: IE<9
// Use defaultValue in place of getAttribute("value")
if ( !support.attributes || !assert(function( div ) {
	div.innerHTML = "<input/>";
	div.firstChild.setAttribute( "value", "" );
	return div.firstChild.getAttribute( "value" ) === "";
}) ) {
	addHandle( "value", function( elem, name, isXML ) {
		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
			return elem.defaultValue;
		}
	});
}

// Support: IE<9
// Use getAttributeNode to fetch booleans when getAttribute lies
if ( !assert(function( div ) {
	return div.getAttribute("disabled") == null;
}) ) {
	addHandle( booleans, function( elem, name, isXML ) {
		var val;
		if ( !isXML ) {
			return elem[ name ] === true ? name.toLowerCase() :
					(val = elem.getAttributeNode( name )) && val.specified ?
					val.value :
				null;
		}
	});
}

return Sizzle;

})( window );



jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;
jQuery.expr[":"] = jQuery.expr.pseudos;
jQuery.unique = Sizzle.uniqueSort;
jQuery.text = Sizzle.getText;
jQuery.isXMLDoc = Sizzle.isXML;
jQuery.contains = Sizzle.contains;



var rneedsContext = jQuery.expr.match.needsContext;

var rsingleTag = (/^<(\w+)\s*\/?>(?:<\/\1>|)$/);



var risSimple = /^.[^:#\[\.,]*$/;

// Implement the identical functionality for filter and not
function winnow( elements, qualifier, not ) {
	if ( jQuery.isFunction( qualifier ) ) {
		return jQuery.grep( elements, function( elem, i ) {
			/* jshint -W018 */
			return !!qualifier.call( elem, i, elem ) !== not;
		});

	}

	if ( qualifier.nodeType ) {
		return jQuery.grep( elements, function( elem ) {
			return ( elem === qualifier ) !== not;
		});

	}

	if ( typeof qualifier === "string" ) {
		if ( risSimple.test( qualifier ) ) {
			return jQuery.filter( qualifier, elements, not );
		}

		qualifier = jQuery.filter( qualifier, elements );
	}

	return jQuery.grep( elements, function( elem ) {
		return ( indexOf.call( qualifier, elem ) >= 0 ) !== not;
	});
}

jQuery.filter = function( expr, elems, not ) {
	var elem = elems[ 0 ];

	if ( not ) {
		expr = ":not(" + expr + ")";
	}

	return elems.length === 1 && elem.nodeType === 1 ?
		jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [] :
		jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
			return elem.nodeType === 1;
		}));
};

jQuery.fn.extend({
	find: function( selector ) {
		var i,
			len = this.length,
			ret = [],
			self = this;

		if ( typeof selector !== "string" ) {
			return this.pushStack( jQuery( selector ).filter(function() {
				for ( i = 0; i < len; i++ ) {
					if ( jQuery.contains( self[ i ], this ) ) {
						return true;
					}
				}
			}) );
		}

		for ( i = 0; i < len; i++ ) {
			jQuery.find( selector, self[ i ], ret );
		}

		// Needed because $( selector, context ) becomes $( context ).find( selector )
		ret = this.pushStack( len > 1 ? jQuery.unique( ret ) : ret );
		ret.selector = this.selector ? this.selector + " " + selector : selector;
		return ret;
	},
	filter: function( selector ) {
		return this.pushStack( winnow(this, selector || [], false) );
	},
	not: function( selector ) {
		return this.pushStack( winnow(this, selector || [], true) );
	},
	is: function( selector ) {
		return !!winnow(
			this,

			// If this is a positional/relative selector, check membership in the returned set
			// so $("p:first").is("p:last") won't return true for a doc with two "p".
			typeof selector === "string" && rneedsContext.test( selector ) ?
				jQuery( selector ) :
				selector || [],
			false
		).length;
	}
});


// Initialize a jQuery object


// A central reference to the root jQuery(document)
var rootjQuery,

	// A simple way to check for HTML strings
	// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
	// Strict HTML recognition (#11290: must start with <)
	rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,

	init = jQuery.fn.init = function( selector, context ) {
		var match, elem;

		// HANDLE: $(""), $(null), $(undefined), $(false)
		if ( !selector ) {
			return this;
		}

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			if ( selector[0] === "<" && selector[ selector.length - 1 ] === ">" && selector.length >= 3 ) {
				// Assume that strings that start and end with <> are HTML and skip the regex check
				match = [ null, selector, null ];

			} else {
				match = rquickExpr.exec( selector );
			}

			// Match html or make sure no context is specified for #id
			if ( match && (match[1] || !context) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[1] ) {
					context = context instanceof jQuery ? context[0] : context;

					// Option to run scripts is true for back-compat
					// Intentionally let the error be thrown if parseHTML is not present
					jQuery.merge( this, jQuery.parseHTML(
						match[1],
						context && context.nodeType ? context.ownerDocument || context : document,
						true
					) );

					// HANDLE: $(html, props)
					if ( rsingleTag.test( match[1] ) && jQuery.isPlainObject( context ) ) {
						for ( match in context ) {
							// Properties of context are called as methods if possible
							if ( jQuery.isFunction( this[ match ] ) ) {
								this[ match ]( context[ match ] );

							// ...and otherwise set as attributes
							} else {
								this.attr( match, context[ match ] );
							}
						}
					}

					return this;

				// HANDLE: $(#id)
				} else {
					elem = document.getElementById( match[2] );

					// Support: Blackberry 4.6
					// gEBID returns nodes no longer in the document (#6963)
					if ( elem && elem.parentNode ) {
						// Inject the element directly into the jQuery object
						this.length = 1;
						this[0] = elem;
					}

					this.context = document;
					this.selector = selector;
					return this;
				}

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return ( context || rootjQuery ).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return this.constructor( context ).find( selector );
			}

		// HANDLE: $(DOMElement)
		} else if ( selector.nodeType ) {
			this.context = this[0] = selector;
			this.length = 1;
			return this;

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( jQuery.isFunction( selector ) ) {
			return typeof rootjQuery.ready !== "undefined" ?
				rootjQuery.ready( selector ) :
				// Execute immediately if ready is not present
				selector( jQuery );
		}

		if ( selector.selector !== undefined ) {
			this.selector = selector.selector;
			this.context = selector.context;
		}

		return jQuery.makeArray( selector, this );
	};

// Give the init function the jQuery prototype for later instantiation
init.prototype = jQuery.fn;

// Initialize central reference
rootjQuery = jQuery( document );


var rparentsprev = /^(?:parents|prev(?:Until|All))/,
	// Methods guaranteed to produce a unique set when starting from a unique set
	guaranteedUnique = {
		children: true,
		contents: true,
		next: true,
		prev: true
	};

jQuery.extend({
	dir: function( elem, dir, until ) {
		var matched = [],
			truncate = until !== undefined;

		while ( (elem = elem[ dir ]) && elem.nodeType !== 9 ) {
			if ( elem.nodeType === 1 ) {
				if ( truncate && jQuery( elem ).is( until ) ) {
					break;
				}
				matched.push( elem );
			}
		}
		return matched;
	},

	sibling: function( n, elem ) {
		var matched = [];

		for ( ; n; n = n.nextSibling ) {
			if ( n.nodeType === 1 && n !== elem ) {
				matched.push( n );
			}
		}

		return matched;
	}
});

jQuery.fn.extend({
	has: function( target ) {
		var targets = jQuery( target, this ),
			l = targets.length;

		return this.filter(function() {
			var i = 0;
			for ( ; i < l; i++ ) {
				if ( jQuery.contains( this, targets[i] ) ) {
					return true;
				}
			}
		});
	},

	closest: function( selectors, context ) {
		var cur,
			i = 0,
			l = this.length,
			matched = [],
			pos = rneedsContext.test( selectors ) || typeof selectors !== "string" ?
				jQuery( selectors, context || this.context ) :
				0;

		for ( ; i < l; i++ ) {
			for ( cur = this[i]; cur && cur !== context; cur = cur.parentNode ) {
				// Always skip document fragments
				if ( cur.nodeType < 11 && (pos ?
					pos.index(cur) > -1 :

					// Don't pass non-elements to Sizzle
					cur.nodeType === 1 &&
						jQuery.find.matchesSelector(cur, selectors)) ) {

					matched.push( cur );
					break;
				}
			}
		}

		return this.pushStack( matched.length > 1 ? jQuery.unique( matched ) : matched );
	},

	// Determine the position of an element within the set
	index: function( elem ) {

		// No argument, return index in parent
		if ( !elem ) {
			return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
		}

		// Index in selector
		if ( typeof elem === "string" ) {
			return indexOf.call( jQuery( elem ), this[ 0 ] );
		}

		// Locate the position of the desired element
		return indexOf.call( this,

			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[ 0 ] : elem
		);
	},

	add: function( selector, context ) {
		return this.pushStack(
			jQuery.unique(
				jQuery.merge( this.get(), jQuery( selector, context ) )
			)
		);
	},

	addBack: function( selector ) {
		return this.add( selector == null ?
			this.prevObject : this.prevObject.filter(selector)
		);
	}
});

function sibling( cur, dir ) {
	while ( (cur = cur[dir]) && cur.nodeType !== 1 ) {}
	return cur;
}

jQuery.each({
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return jQuery.dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return sibling( elem, "nextSibling" );
	},
	prev: function( elem ) {
		return sibling( elem, "previousSibling" );
	},
	nextAll: function( elem ) {
		return jQuery.dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return jQuery.dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return jQuery.sibling( ( elem.parentNode || {} ).firstChild, elem );
	},
	children: function( elem ) {
		return jQuery.sibling( elem.firstChild );
	},
	contents: function( elem ) {
		return elem.contentDocument || jQuery.merge( [], elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var matched = jQuery.map( this, fn, until );

		if ( name.slice( -5 ) !== "Until" ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			matched = jQuery.filter( selector, matched );
		}

		if ( this.length > 1 ) {
			// Remove duplicates
			if ( !guaranteedUnique[ name ] ) {
				jQuery.unique( matched );
			}

			// Reverse order for parents* and prev-derivatives
			if ( rparentsprev.test( name ) ) {
				matched.reverse();
			}
		}

		return this.pushStack( matched );
	};
});
var rnotwhite = (/\S+/g);



// String to Object options format cache
var optionsCache = {};

// Convert String-formatted options into Object-formatted ones and store in cache
function createOptions( options ) {
	var object = optionsCache[ options ] = {};
	jQuery.each( options.match( rnotwhite ) || [], function( _, flag ) {
		object[ flag ] = true;
	});
	return object;
}

/*
 * Create a callback list using the following parameters:
 *
 *	options: an optional list of space-separated options that will change how
 *			the callback list behaves or a more traditional option object
 *
 * By default a callback list will act like an event callback list and can be
 * "fired" multiple times.
 *
 * Possible options:
 *
 *	once:			will ensure the callback list can only be fired once (like a Deferred)
 *
 *	memory:			will keep track of previous values and will call any callback added
 *					after the list has been fired right away with the latest "memorized"
 *					values (like a Deferred)
 *
 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
 *
 *	stopOnFalse:	interrupt callings when a callback returns false
 *
 */
jQuery.Callbacks = function( options ) {

	// Convert options from String-formatted to Object-formatted if needed
	// (we check in cache first)
	options = typeof options === "string" ?
		( optionsCache[ options ] || createOptions( options ) ) :
		jQuery.extend( {}, options );

	var // Last fire value (for non-forgettable lists)
		memory,
		// Flag to know if list was already fired
		fired,
		// Flag to know if list is currently firing
		firing,
		// First callback to fire (used internally by add and fireWith)
		firingStart,
		// End of the loop when firing
		firingLength,
		// Index of currently firing callback (modified by remove if needed)
		firingIndex,
		// Actual callback list
		list = [],
		// Stack of fire calls for repeatable lists
		stack = !options.once && [],
		// Fire callbacks
		fire = function( data ) {
			memory = options.memory && data;
			fired = true;
			firingIndex = firingStart || 0;
			firingStart = 0;
			firingLength = list.length;
			firing = true;
			for ( ; list && firingIndex < firingLength; firingIndex++ ) {
				if ( list[ firingIndex ].apply( data[ 0 ], data[ 1 ] ) === false && options.stopOnFalse ) {
					memory = false; // To prevent further calls using add
					break;
				}
			}
			firing = false;
			if ( list ) {
				if ( stack ) {
					if ( stack.length ) {
						fire( stack.shift() );
					}
				} else if ( memory ) {
					list = [];
				} else {
					self.disable();
				}
			}
		},
		// Actual Callbacks object
		self = {
			// Add a callback or a collection of callbacks to the list
			add: function() {
				if ( list ) {
					// First, we save the current length
					var start = list.length;
					(function add( args ) {
						jQuery.each( args, function( _, arg ) {
							var type = jQuery.type( arg );
							if ( type === "function" ) {
								if ( !options.unique || !self.has( arg ) ) {
									list.push( arg );
								}
							} else if ( arg && arg.length && type !== "string" ) {
								// Inspect recursively
								add( arg );
							}
						});
					})( arguments );
					// Do we need to add the callbacks to the
					// current firing batch?
					if ( firing ) {
						firingLength = list.length;
					// With memory, if we're not firing then
					// we should call right away
					} else if ( memory ) {
						firingStart = start;
						fire( memory );
					}
				}
				return this;
			},
			// Remove a callback from the list
			remove: function() {
				if ( list ) {
					jQuery.each( arguments, function( _, arg ) {
						var index;
						while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
							list.splice( index, 1 );
							// Handle firing indexes
							if ( firing ) {
								if ( index <= firingLength ) {
									firingLength--;
								}
								if ( index <= firingIndex ) {
									firingIndex--;
								}
							}
						}
					});
				}
				return this;
			},
			// Check if a given callback is in the list.
			// If no argument is given, return whether or not list has callbacks attached.
			has: function( fn ) {
				return fn ? jQuery.inArray( fn, list ) > -1 : !!( list && list.length );
			},
			// Remove all callbacks from the list
			empty: function() {
				list = [];
				firingLength = 0;
				return this;
			},
			// Have the list do nothing anymore
			disable: function() {
				list = stack = memory = undefined;
				return this;
			},
			// Is it disabled?
			disabled: function() {
				return !list;
			},
			// Lock the list in its current state
			lock: function() {
				stack = undefined;
				if ( !memory ) {
					self.disable();
				}
				return this;
			},
			// Is it locked?
			locked: function() {
				return !stack;
			},
			// Call all callbacks with the given context and arguments
			fireWith: function( context, args ) {
				if ( list && ( !fired || stack ) ) {
					args = args || [];
					args = [ context, args.slice ? args.slice() : args ];
					if ( firing ) {
						stack.push( args );
					} else {
						fire( args );
					}
				}
				return this;
			},
			// Call all the callbacks with the given arguments
			fire: function() {
				self.fireWith( this, arguments );
				return this;
			},
			// To know if the callbacks have already been called at least once
			fired: function() {
				return !!fired;
			}
		};

	return self;
};


jQuery.extend({

	Deferred: function( func ) {
		var tuples = [
				// action, add listener, listener list, final state
				[ "resolve", "done", jQuery.Callbacks("once memory"), "resolved" ],
				[ "reject", "fail", jQuery.Callbacks("once memory"), "rejected" ],
				[ "notify", "progress", jQuery.Callbacks("memory") ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				then: function( /* fnDone, fnFail, fnProgress */ ) {
					var fns = arguments;
					return jQuery.Deferred(function( newDefer ) {
						jQuery.each( tuples, function( i, tuple ) {
							var fn = jQuery.isFunction( fns[ i ] ) && fns[ i ];
							// deferred[ done | fail | progress ] for forwarding actions to newDefer
							deferred[ tuple[1] ](function() {
								var returned = fn && fn.apply( this, arguments );
								if ( returned && jQuery.isFunction( returned.promise ) ) {
									returned.promise()
										.done( newDefer.resolve )
										.fail( newDefer.reject )
										.progress( newDefer.notify );
								} else {
									newDefer[ tuple[ 0 ] + "With" ]( this === promise ? newDefer.promise() : this, fn ? [ returned ] : arguments );
								}
							});
						});
						fns = null;
					}).promise();
				},
				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		// Keep pipe for back-compat
		promise.pipe = promise.then;

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 3 ];

			// promise[ done | fail | progress ] = list.add
			promise[ tuple[1] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(function() {
					// state = [ resolved | rejected ]
					state = stateString;

				// [ reject_list | resolve_list ].disable; progress_list.lock
				}, tuples[ i ^ 1 ][ 2 ].disable, tuples[ 2 ][ 2 ].lock );
			}

			// deferred[ resolve | reject | notify ]
			deferred[ tuple[0] ] = function() {
				deferred[ tuple[0] + "With" ]( this === deferred ? promise : this, arguments );
				return this;
			};
			deferred[ tuple[0] + "With" ] = list.fireWith;
		});

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( subordinate /* , ..., subordinateN */ ) {
		var i = 0,
			resolveValues = slice.call( arguments ),
			length = resolveValues.length,

			// the count of uncompleted subordinates
			remaining = length !== 1 || ( subordinate && jQuery.isFunction( subordinate.promise ) ) ? length : 0,

			// the master Deferred. If resolveValues consist of only a single Deferred, just use that.
			deferred = remaining === 1 ? subordinate : jQuery.Deferred(),

			// Update function for both resolve and progress values
			updateFunc = function( i, contexts, values ) {
				return function( value ) {
					contexts[ i ] = this;
					values[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
					if ( values === progressValues ) {
						deferred.notifyWith( contexts, values );
					} else if ( !( --remaining ) ) {
						deferred.resolveWith( contexts, values );
					}
				};
			},

			progressValues, progressContexts, resolveContexts;

		// Add listeners to Deferred subordinates; treat others as resolved
		if ( length > 1 ) {
			progressValues = new Array( length );
			progressContexts = new Array( length );
			resolveContexts = new Array( length );
			for ( ; i < length; i++ ) {
				if ( resolveValues[ i ] && jQuery.isFunction( resolveValues[ i ].promise ) ) {
					resolveValues[ i ].promise()
						.done( updateFunc( i, resolveContexts, resolveValues ) )
						.fail( deferred.reject )
						.progress( updateFunc( i, progressContexts, progressValues ) );
				} else {
					--remaining;
				}
			}
		}

		// If we're not waiting on anything, resolve the master
		if ( !remaining ) {
			deferred.resolveWith( resolveContexts, resolveValues );
		}

		return deferred.promise();
	}
});


// The deferred used on DOM ready
var readyList;

jQuery.fn.ready = function( fn ) {
	// Add the callback
	jQuery.ready.promise().done( fn );

	return this;
};

jQuery.extend({
	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,

	// A counter to track how many items to wait for before
	// the ready event fires. See #6781
	readyWait: 1,

	// Hold (or release) the ready event
	holdReady: function( hold ) {
		if ( hold ) {
			jQuery.readyWait++;
		} else {
			jQuery.ready( true );
		}
	},

	// Handle when the DOM is ready
	ready: function( wait ) {

		// Abort if there are pending holds or we're already ready
		if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
			return;
		}

		// Remember that the DOM is ready
		jQuery.isReady = true;

		// If a normal DOM Ready event fired, decrement, and wait if need be
		if ( wait !== true && --jQuery.readyWait > 0 ) {
			return;
		}

		// If there are functions bound, to execute
		readyList.resolveWith( document, [ jQuery ] );

		// Trigger any bound ready events
		if ( jQuery.fn.triggerHandler ) {
			jQuery( document ).triggerHandler( "ready" );
			jQuery( document ).off( "ready" );
		}
	}
});

/**
 * The ready event handler and self cleanup method
 */
function completed() {
	document.removeEventListener( "DOMContentLoaded", completed, false );
	window.removeEventListener( "load", completed, false );
	jQuery.ready();
}

jQuery.ready.promise = function( obj ) {
	if ( !readyList ) {

		readyList = jQuery.Deferred();

		// Catch cases where $(document).ready() is called after the browser event has already occurred.
		// We once tried to use readyState "interactive" here, but it caused issues like the one
		// discovered by ChrisS here: http://bugs.jquery.com/ticket/12282#comment:15
		if ( document.readyState === "complete" ) {
			// Handle it asynchronously to allow scripts the opportunity to delay ready
			setTimeout( jQuery.ready );

		} else {

			// Use the handy event callback
			document.addEventListener( "DOMContentLoaded", completed, false );

			// A fallback to window.onload, that will always work
			window.addEventListener( "load", completed, false );
		}
	}
	return readyList.promise( obj );
};

// Kick off the DOM ready check even if the user does not
jQuery.ready.promise();




// Multifunctional method to get and set values of a collection
// The value/s can optionally be executed if it's a function
var access = jQuery.access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
	var i = 0,
		len = elems.length,
		bulk = key == null;

	// Sets many values
	if ( jQuery.type( key ) === "object" ) {
		chainable = true;
		for ( i in key ) {
			jQuery.access( elems, fn, i, key[i], true, emptyGet, raw );
		}

	// Sets one value
	} else if ( value !== undefined ) {
		chainable = true;

		if ( !jQuery.isFunction( value ) ) {
			raw = true;
		}

		if ( bulk ) {
			// Bulk operations run against the entire set
			if ( raw ) {
				fn.call( elems, value );
				fn = null;

			// ...except when executing function values
			} else {
				bulk = fn;
				fn = function( elem, key, value ) {
					return bulk.call( jQuery( elem ), value );
				};
			}
		}

		if ( fn ) {
			for ( ; i < len; i++ ) {
				fn( elems[i], key, raw ? value : value.call( elems[i], i, fn( elems[i], key ) ) );
			}
		}
	}

	return chainable ?
		elems :

		// Gets
		bulk ?
			fn.call( elems ) :
			len ? fn( elems[0], key ) : emptyGet;
};


/**
 * Determines whether an object can have data
 */
jQuery.acceptData = function( owner ) {
	// Accepts only:
	//  - Node
	//    - Node.ELEMENT_NODE
	//    - Node.DOCUMENT_NODE
	//  - Object
	//    - Any
	/* jshint -W018 */
	return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
};


function Data() {
	// Support: Android<4,
	// Old WebKit does not have Object.preventExtensions/freeze method,
	// return new empty object instead with no [[set]] accessor
	Object.defineProperty( this.cache = {}, 0, {
		get: function() {
			return {};
		}
	});

	this.expando = jQuery.expando + Data.uid++;
}

Data.uid = 1;
Data.accepts = jQuery.acceptData;

Data.prototype = {
	key: function( owner ) {
		// We can accept data for non-element nodes in modern browsers,
		// but we should not, see #8335.
		// Always return the key for a frozen object.
		if ( !Data.accepts( owner ) ) {
			return 0;
		}

		var descriptor = {},
			// Check if the owner object already has a cache key
			unlock = owner[ this.expando ];

		// If not, create one
		if ( !unlock ) {
			unlock = Data.uid++;

			// Secure it in a non-enumerable, non-writable property
			try {
				descriptor[ this.expando ] = { value: unlock };
				Object.defineProperties( owner, descriptor );

			// Support: Android<4
			// Fallback to a less secure definition
			} catch ( e ) {
				descriptor[ this.expando ] = unlock;
				jQuery.extend( owner, descriptor );
			}
		}

		// Ensure the cache object
		if ( !this.cache[ unlock ] ) {
			this.cache[ unlock ] = {};
		}

		return unlock;
	},
	set: function( owner, data, value ) {
		var prop,
			// There may be an unlock assigned to this node,
			// if there is no entry for this "owner", create one inline
			// and set the unlock as though an owner entry had always existed
			unlock = this.key( owner ),
			cache = this.cache[ unlock ];

		// Handle: [ owner, key, value ] args
		if ( typeof data === "string" ) {
			cache[ data ] = value;

		// Handle: [ owner, { properties } ] args
		} else {
			// Fresh assignments by object are shallow copied
			if ( jQuery.isEmptyObject( cache ) ) {
				jQuery.extend( this.cache[ unlock ], data );
			// Otherwise, copy the properties one-by-one to the cache object
			} else {
				for ( prop in data ) {
					cache[ prop ] = data[ prop ];
				}
			}
		}
		return cache;
	},
	get: function( owner, key ) {
		// Either a valid cache is found, or will be created.
		// New caches will be created and the unlock returned,
		// allowing direct access to the newly created
		// empty data object. A valid owner object must be provided.
		var cache = this.cache[ this.key( owner ) ];

		return key === undefined ?
			cache : cache[ key ];
	},
	access: function( owner, key, value ) {
		var stored;
		// In cases where either:
		//
		//   1. No key was specified
		//   2. A string key was specified, but no value provided
		//
		// Take the "read" path and allow the get method to determine
		// which value to return, respectively either:
		//
		//   1. The entire cache object
		//   2. The data stored at the key
		//
		if ( key === undefined ||
				((key && typeof key === "string") && value === undefined) ) {

			stored = this.get( owner, key );

			return stored !== undefined ?
				stored : this.get( owner, jQuery.camelCase(key) );
		}

		// [*]When the key is not a string, or both a key and value
		// are specified, set or extend (existing objects) with either:
		//
		//   1. An object of properties
		//   2. A key and value
		//
		this.set( owner, key, value );

		// Since the "set" path can have two possible entry points
		// return the expected data based on which path was taken[*]
		return value !== undefined ? value : key;
	},
	remove: function( owner, key ) {
		var i, name, camel,
			unlock = this.key( owner ),
			cache = this.cache[ unlock ];

		if ( key === undefined ) {
			this.cache[ unlock ] = {};

		} else {
			// Support array or space separated string of keys
			if ( jQuery.isArray( key ) ) {
				// If "name" is an array of keys...
				// When data is initially created, via ("key", "val") signature,
				// keys will be converted to camelCase.
				// Since there is no way to tell _how_ a key was added, remove
				// both plain key and camelCase key. #12786
				// This will only penalize the array argument path.
				name = key.concat( key.map( jQuery.camelCase ) );
			} else {
				camel = jQuery.camelCase( key );
				// Try the string as a key before any manipulation
				if ( key in cache ) {
					name = [ key, camel ];
				} else {
					// If a key with the spaces exists, use it.
					// Otherwise, create an array by matching non-whitespace
					name = camel;
					name = name in cache ?
						[ name ] : ( name.match( rnotwhite ) || [] );
				}
			}

			i = name.length;
			while ( i-- ) {
				delete cache[ name[ i ] ];
			}
		}
	},
	hasData: function( owner ) {
		return !jQuery.isEmptyObject(
			this.cache[ owner[ this.expando ] ] || {}
		);
	},
	discard: function( owner ) {
		if ( owner[ this.expando ] ) {
			delete this.cache[ owner[ this.expando ] ];
		}
	}
};
var data_priv = new Data();

var data_user = new Data();



//	Implementation Summary
//
//	1. Enforce API surface and semantic compatibility with 1.9.x branch
//	2. Improve the module's maintainability by reducing the storage
//		paths to a single mechanism.
//	3. Use the same single mechanism to support "private" and "user" data.
//	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
//	5. Avoid exposing implementation details on user objects (eg. expando properties)
//	6. Provide a clear path for implementation upgrade to WeakMap in 2014

var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
	rmultiDash = /([A-Z])/g;

function dataAttr( elem, key, data ) {
	var name;

	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {
		name = "data-" + key.replace( rmultiDash, "-$1" ).toLowerCase();
		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = data === "true" ? true :
					data === "false" ? false :
					data === "null" ? null :
					// Only convert to a number if it doesn't change the string
					+data + "" === data ? +data :
					rbrace.test( data ) ? jQuery.parseJSON( data ) :
					data;
			} catch( e ) {}

			// Make sure we set the data so it isn't changed later
			data_user.set( elem, key, data );
		} else {
			data = undefined;
		}
	}
	return data;
}

jQuery.extend({
	hasData: function( elem ) {
		return data_user.hasData( elem ) || data_priv.hasData( elem );
	},

	data: function( elem, name, data ) {
		return data_user.access( elem, name, data );
	},

	removeData: function( elem, name ) {
		data_user.remove( elem, name );
	},

	// TODO: Now that all calls to _data and _removeData have been replaced
	// with direct calls to data_priv methods, these can be deprecated.
	_data: function( elem, name, data ) {
		return data_priv.access( elem, name, data );
	},

	_removeData: function( elem, name ) {
		data_priv.remove( elem, name );
	}
});

jQuery.fn.extend({
	data: function( key, value ) {
		var i, name, data,
			elem = this[ 0 ],
			attrs = elem && elem.attributes;

		// Gets all values
		if ( key === undefined ) {
			if ( this.length ) {
				data = data_user.get( elem );

				if ( elem.nodeType === 1 && !data_priv.get( elem, "hasDataAttrs" ) ) {
					i = attrs.length;
					while ( i-- ) {

						// Support: IE11+
						// The attrs elements can be null (#14894)
						if ( attrs[ i ] ) {
							name = attrs[ i ].name;
							if ( name.indexOf( "data-" ) === 0 ) {
								name = jQuery.camelCase( name.slice(5) );
								dataAttr( elem, name, data[ name ] );
							}
						}
					}
					data_priv.set( elem, "hasDataAttrs", true );
				}
			}

			return data;
		}

		// Sets multiple values
		if ( typeof key === "object" ) {
			return this.each(function() {
				data_user.set( this, key );
			});
		}

		return access( this, function( value ) {
			var data,
				camelKey = jQuery.camelCase( key );

			// The calling jQuery object (element matches) is not empty
			// (and therefore has an element appears at this[ 0 ]) and the
			// `value` parameter was not undefined. An empty jQuery object
			// will result in `undefined` for elem = this[ 0 ] which will
			// throw an exception if an attempt to read a data cache is made.
			if ( elem && value === undefined ) {
				// Attempt to get data from the cache
				// with the key as-is
				data = data_user.get( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to get data from the cache
				// with the key camelized
				data = data_user.get( elem, camelKey );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to "discover" the data in
				// HTML5 custom data-* attrs
				data = dataAttr( elem, camelKey, undefined );
				if ( data !== undefined ) {
					return data;
				}

				// We tried really hard, but the data doesn't exist.
				return;
			}

			// Set the data...
			this.each(function() {
				// First, attempt to store a copy or reference of any
				// data that might've been store with a camelCased key.
				var data = data_user.get( this, camelKey );

				// For HTML5 data-* attribute interop, we have to
				// store property names with dashes in a camelCase form.
				// This might not apply to all properties...*
				data_user.set( this, camelKey, value );

				// *... In the case of properties that might _actually_
				// have dashes, we need to also store a copy of that
				// unchanged property.
				if ( key.indexOf("-") !== -1 && data !== undefined ) {
					data_user.set( this, key, value );
				}
			});
		}, null, value, arguments.length > 1, null, true );
	},

	removeData: function( key ) {
		return this.each(function() {
			data_user.remove( this, key );
		});
	}
});


jQuery.extend({
	queue: function( elem, type, data ) {
		var queue;

		if ( elem ) {
			type = ( type || "fx" ) + "queue";
			queue = data_priv.get( elem, type );

			// Speed up dequeue by getting out quickly if this is just a lookup
			if ( data ) {
				if ( !queue || jQuery.isArray( data ) ) {
					queue = data_priv.access( elem, type, jQuery.makeArray(data) );
				} else {
					queue.push( data );
				}
			}
			return queue || [];
		}
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ),
			startLength = queue.length,
			fn = queue.shift(),
			hooks = jQuery._queueHooks( elem, type ),
			next = function() {
				jQuery.dequeue( elem, type );
			};

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
			startLength--;
		}

		if ( fn ) {

			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift( "inprogress" );
			}

			// Clear up the last queue stop function
			delete hooks.stop;
			fn.call( elem, next, hooks );
		}

		if ( !startLength && hooks ) {
			hooks.empty.fire();
		}
	},

	// Not public - generate a queueHooks object, or return the current one
	_queueHooks: function( elem, type ) {
		var key = type + "queueHooks";
		return data_priv.get( elem, key ) || data_priv.access( elem, key, {
			empty: jQuery.Callbacks("once memory").add(function() {
				data_priv.remove( elem, [ type + "queue", key ] );
			})
		});
	}
});

jQuery.fn.extend({
	queue: function( type, data ) {
		var setter = 2;

		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
			setter--;
		}

		if ( arguments.length < setter ) {
			return jQuery.queue( this[0], type );
		}

		return data === undefined ?
			this :
			this.each(function() {
				var queue = jQuery.queue( this, type, data );

				// Ensure a hooks for this queue
				jQuery._queueHooks( this, type );

				if ( type === "fx" && queue[0] !== "inprogress" ) {
					jQuery.dequeue( this, type );
				}
			});
	},
	dequeue: function( type ) {
		return this.each(function() {
			jQuery.dequeue( this, type );
		});
	},
	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	},
	// Get a promise resolved when queues of a certain type
	// are emptied (fx is the type by default)
	promise: function( type, obj ) {
		var tmp,
			count = 1,
			defer = jQuery.Deferred(),
			elements = this,
			i = this.length,
			resolve = function() {
				if ( !( --count ) ) {
					defer.resolveWith( elements, [ elements ] );
				}
			};

		if ( typeof type !== "string" ) {
			obj = type;
			type = undefined;
		}
		type = type || "fx";

		while ( i-- ) {
			tmp = data_priv.get( elements[ i ], type + "queueHooks" );
			if ( tmp && tmp.empty ) {
				count++;
				tmp.empty.add( resolve );
			}
		}
		resolve();
		return defer.promise( obj );
	}
});
var pnum = (/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/).source;

var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

var isHidden = function( elem, el ) {
		// isHidden might be called from jQuery#filter function;
		// in that case, element will be second argument
		elem = el || elem;
		return jQuery.css( elem, "display" ) === "none" || !jQuery.contains( elem.ownerDocument, elem );
	};

var rcheckableType = (/^(?:checkbox|radio)$/i);



(function() {
	var fragment = document.createDocumentFragment(),
		div = fragment.appendChild( document.createElement( "div" ) ),
		input = document.createElement( "input" );

	// Support: Safari<=5.1
	// Check state lost if the name is set (#11217)
	// Support: Windows Web Apps (WWA)
	// `name` and `type` must use .setAttribute for WWA (#14901)
	input.setAttribute( "type", "radio" );
	input.setAttribute( "checked", "checked" );
	input.setAttribute( "name", "t" );

	div.appendChild( input );

	// Support: Safari<=5.1, Android<4.2
	// Older WebKit doesn't clone checked state correctly in fragments
	support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

	// Support: IE<=11+
	// Make sure textarea (and checkbox) defaultValue is properly cloned
	div.innerHTML = "<textarea>x</textarea>";
	support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;
})();
var strundefined = typeof undefined;



support.focusinBubbles = "onfocusin" in window;


var
	rkeyEvent = /^key/,
	rmouseEvent = /^(?:mouse|pointer|contextmenu)|click/,
	rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
	rtypenamespace = /^([^.]*)(?:\.(.+)|)$/;

function returnTrue() {
	return true;
}

function returnFalse() {
	return false;
}

function safeActiveElement() {
	try {
		return document.activeElement;
	} catch ( err ) { }
}

/*
 * Helper functions for managing events -- not part of the public interface.
 * Props to Dean Edwards' addEvent library for many of the ideas.
 */
jQuery.event = {

	global: {},

	add: function( elem, types, handler, data, selector ) {

		var handleObjIn, eventHandle, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = data_priv.get( elem );

		// Don't attach events to noData or text/comment nodes (but allow plain objects)
		if ( !elemData ) {
			return;
		}

		// Caller can pass in an object of custom data in lieu of the handler
		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
			selector = handleObjIn.selector;
		}

		// Make sure that the handler has a unique ID, used to find/remove it later
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure and main handler, if this is the first
		if ( !(events = elemData.events) ) {
			events = elemData.events = {};
		}
		if ( !(eventHandle = elemData.handle) ) {
			eventHandle = elemData.handle = function( e ) {
				// Discard the second event of a jQuery.event.trigger() and
				// when an event is called after a page has unloaded
				return typeof jQuery !== strundefined && jQuery.event.triggered !== e.type ?
					jQuery.event.dispatch.apply( elem, arguments ) : undefined;
			};
		}

		// Handle multiple events separated by a space
		types = ( types || "" ).match( rnotwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[t] ) || [];
			type = origType = tmp[1];
			namespaces = ( tmp[2] || "" ).split( "." ).sort();

			// There *must* be a type, no attaching namespace-only handlers
			if ( !type ) {
				continue;
			}

			// If event changes its type, use the special event handlers for the changed type
			special = jQuery.event.special[ type ] || {};

			// If selector defined, determine special event api type, otherwise given type
			type = ( selector ? special.delegateType : special.bindType ) || type;

			// Update special based on newly reset type
			special = jQuery.event.special[ type ] || {};

			// handleObj is passed to all event handlers
			handleObj = jQuery.extend({
				type: type,
				origType: origType,
				data: data,
				handler: handler,
				guid: handler.guid,
				selector: selector,
				needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
				namespace: namespaces.join(".")
			}, handleObjIn );

			// Init the event handler queue if we're the first
			if ( !(handlers = events[ type ]) ) {
				handlers = events[ type ] = [];
				handlers.delegateCount = 0;

				// Only use addEventListener if the special events handler returns false
				if ( !special.setup || special.setup.call( elem, data, namespaces, eventHandle ) === false ) {
					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle, false );
					}
				}
			}

			if ( special.add ) {
				special.add.call( elem, handleObj );

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add to the element's handler list, delegates in front
			if ( selector ) {
				handlers.splice( handlers.delegateCount++, 0, handleObj );
			} else {
				handlers.push( handleObj );
			}

			// Keep track of which events have ever been used, for event optimization
			jQuery.event.global[ type ] = true;
		}

	},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, selector, mappedTypes ) {

		var j, origCount, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = data_priv.hasData( elem ) && data_priv.get( elem );

		if ( !elemData || !(events = elemData.events) ) {
			return;
		}

		// Once for each type.namespace in types; type may be omitted
		types = ( types || "" ).match( rnotwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[t] ) || [];
			type = origType = tmp[1];
			namespaces = ( tmp[2] || "" ).split( "." ).sort();

			// Unbind all events (on this namespace, if provided) for the element
			if ( !type ) {
				for ( type in events ) {
					jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
				}
				continue;
			}

			special = jQuery.event.special[ type ] || {};
			type = ( selector ? special.delegateType : special.bindType ) || type;
			handlers = events[ type ] || [];
			tmp = tmp[2] && new RegExp( "(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)" );

			// Remove matching events
			origCount = j = handlers.length;
			while ( j-- ) {
				handleObj = handlers[ j ];

				if ( ( mappedTypes || origType === handleObj.origType ) &&
					( !handler || handler.guid === handleObj.guid ) &&
					( !tmp || tmp.test( handleObj.namespace ) ) &&
					( !selector || selector === handleObj.selector || selector === "**" && handleObj.selector ) ) {
					handlers.splice( j, 1 );

					if ( handleObj.selector ) {
						handlers.delegateCount--;
					}
					if ( special.remove ) {
						special.remove.call( elem, handleObj );
					}
				}
			}

			// Remove generic event handler if we removed something and no more handlers exist
			// (avoids potential for endless recursion during removal of special event handlers)
			if ( origCount && !handlers.length ) {
				if ( !special.teardown || special.teardown.call( elem, namespaces, elemData.handle ) === false ) {
					jQuery.removeEvent( elem, type, elemData.handle );
				}

				delete events[ type ];
			}
		}

		// Remove the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			delete elemData.handle;
			data_priv.remove( elem, "events" );
		}
	},

	trigger: function( event, data, elem, onlyHandlers ) {

		var i, cur, tmp, bubbleType, ontype, handle, special,
			eventPath = [ elem || document ],
			type = hasOwn.call( event, "type" ) ? event.type : event,
			namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split(".") : [];

		cur = tmp = elem = elem || document;

		// Don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// focus/blur morphs to focusin/out; ensure we're not firing them right now
		if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
			return;
		}

		if ( type.indexOf(".") >= 0 ) {
			// Namespaced trigger; create a regexp to match event type in handle()
			namespaces = type.split(".");
			type = namespaces.shift();
			namespaces.sort();
		}
		ontype = type.indexOf(":") < 0 && "on" + type;

		// Caller can pass in a jQuery.Event object, Object, or just an event type string
		event = event[ jQuery.expando ] ?
			event :
			new jQuery.Event( type, typeof event === "object" && event );

		// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
		event.isTrigger = onlyHandlers ? 2 : 3;
		event.namespace = namespaces.join(".");
		event.namespace_re = event.namespace ?
			new RegExp( "(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)" ) :
			null;

		// Clean up the event in case it is being reused
		event.result = undefined;
		if ( !event.target ) {
			event.target = elem;
		}

		// Clone any incoming data and prepend the event, creating the handler arg list
		data = data == null ?
			[ event ] :
			jQuery.makeArray( data, [ event ] );

		// Allow special events to draw outside the lines
		special = jQuery.event.special[ type ] || {};
		if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
			return;
		}

		// Determine event propagation path in advance, per W3C events spec (#9951)
		// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
		if ( !onlyHandlers && !special.noBubble && !jQuery.isWindow( elem ) ) {

			bubbleType = special.delegateType || type;
			if ( !rfocusMorph.test( bubbleType + type ) ) {
				cur = cur.parentNode;
			}
			for ( ; cur; cur = cur.parentNode ) {
				eventPath.push( cur );
				tmp = cur;
			}

			// Only add window if we got to document (e.g., not plain obj or detached DOM)
			if ( tmp === (elem.ownerDocument || document) ) {
				eventPath.push( tmp.defaultView || tmp.parentWindow || window );
			}
		}

		// Fire handlers on the event path
		i = 0;
		while ( (cur = eventPath[i++]) && !event.isPropagationStopped() ) {

			event.type = i > 1 ?
				bubbleType :
				special.bindType || type;

			// jQuery handler
			handle = ( data_priv.get( cur, "events" ) || {} )[ event.type ] && data_priv.get( cur, "handle" );
			if ( handle ) {
				handle.apply( cur, data );
			}

			// Native handler
			handle = ontype && cur[ ontype ];
			if ( handle && handle.apply && jQuery.acceptData( cur ) ) {
				event.result = handle.apply( cur, data );
				if ( event.result === false ) {
					event.preventDefault();
				}
			}
		}
		event.type = type;

		// If nobody prevented the default action, do it now
		if ( !onlyHandlers && !event.isDefaultPrevented() ) {

			if ( (!special._default || special._default.apply( eventPath.pop(), data ) === false) &&
				jQuery.acceptData( elem ) ) {

				// Call a native DOM method on the target with the same name name as the event.
				// Don't do default actions on window, that's where global variables be (#6170)
				if ( ontype && jQuery.isFunction( elem[ type ] ) && !jQuery.isWindow( elem ) ) {

					// Don't re-trigger an onFOO event when we call its FOO() method
					tmp = elem[ ontype ];

					if ( tmp ) {
						elem[ ontype ] = null;
					}

					// Prevent re-triggering of the same event, since we already bubbled it above
					jQuery.event.triggered = type;
					elem[ type ]();
					jQuery.event.triggered = undefined;

					if ( tmp ) {
						elem[ ontype ] = tmp;
					}
				}
			}
		}

		return event.result;
	},

	dispatch: function( event ) {

		// Make a writable jQuery.Event from the native event object
		event = jQuery.event.fix( event );

		var i, j, ret, matched, handleObj,
			handlerQueue = [],
			args = slice.call( arguments ),
			handlers = ( data_priv.get( this, "events" ) || {} )[ event.type ] || [],
			special = jQuery.event.special[ event.type ] || {};

		// Use the fix-ed jQuery.Event rather than the (read-only) native event
		args[0] = event;
		event.delegateTarget = this;

		// Call the preDispatch hook for the mapped type, and let it bail if desired
		if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
			return;
		}

		// Determine handlers
		handlerQueue = jQuery.event.handlers.call( this, event, handlers );

		// Run delegates first; they may want to stop propagation beneath us
		i = 0;
		while ( (matched = handlerQueue[ i++ ]) && !event.isPropagationStopped() ) {
			event.currentTarget = matched.elem;

			j = 0;
			while ( (handleObj = matched.handlers[ j++ ]) && !event.isImmediatePropagationStopped() ) {

				// Triggered event must either 1) have no namespace, or 2) have namespace(s)
				// a subset or equal to those in the bound event (both can have no namespace).
				if ( !event.namespace_re || event.namespace_re.test( handleObj.namespace ) ) {

					event.handleObj = handleObj;
					event.data = handleObj.data;

					ret = ( (jQuery.event.special[ handleObj.origType ] || {}).handle || handleObj.handler )
							.apply( matched.elem, args );

					if ( ret !== undefined ) {
						if ( (event.result = ret) === false ) {
							event.preventDefault();
							event.stopPropagation();
						}
					}
				}
			}
		}

		// Call the postDispatch hook for the mapped type
		if ( special.postDispatch ) {
			special.postDispatch.call( this, event );
		}

		return event.result;
	},

	handlers: function( event, handlers ) {
		var i, matches, sel, handleObj,
			handlerQueue = [],
			delegateCount = handlers.delegateCount,
			cur = event.target;

		// Find delegate handlers
		// Black-hole SVG <use> instance trees (#13180)
		// Avoid non-left-click bubbling in Firefox (#3861)
		if ( delegateCount && cur.nodeType && (!event.button || event.type !== "click") ) {

			for ( ; cur !== this; cur = cur.parentNode || this ) {

				// Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
				if ( cur.disabled !== true || event.type !== "click" ) {
					matches = [];
					for ( i = 0; i < delegateCount; i++ ) {
						handleObj = handlers[ i ];

						// Don't conflict with Object.prototype properties (#13203)
						sel = handleObj.selector + " ";

						if ( matches[ sel ] === undefined ) {
							matches[ sel ] = handleObj.needsContext ?
								jQuery( sel, this ).index( cur ) >= 0 :
								jQuery.find( sel, this, null, [ cur ] ).length;
						}
						if ( matches[ sel ] ) {
							matches.push( handleObj );
						}
					}
					if ( matches.length ) {
						handlerQueue.push({ elem: cur, handlers: matches });
					}
				}
			}
		}

		// Add the remaining (directly-bound) handlers
		if ( delegateCount < handlers.length ) {
			handlerQueue.push({ elem: this, handlers: handlers.slice( delegateCount ) });
		}

		return handlerQueue;
	},

	// Includes some event props shared by KeyEvent and MouseEvent
	props: "altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),

	fixHooks: {},

	keyHooks: {
		props: "char charCode key keyCode".split(" "),
		filter: function( event, original ) {

			// Add which for key events
			if ( event.which == null ) {
				event.which = original.charCode != null ? original.charCode : original.keyCode;
			}

			return event;
		}
	},

	mouseHooks: {
		props: "button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "),
		filter: function( event, original ) {
			var eventDoc, doc, body,
				button = original.button;

			// Calculate pageX/Y if missing and clientX/Y available
			if ( event.pageX == null && original.clientX != null ) {
				eventDoc = event.target.ownerDocument || document;
				doc = eventDoc.documentElement;
				body = eventDoc.body;

				event.pageX = original.clientX + ( doc && doc.scrollLeft || body && body.scrollLeft || 0 ) - ( doc && doc.clientLeft || body && body.clientLeft || 0 );
				event.pageY = original.clientY + ( doc && doc.scrollTop  || body && body.scrollTop  || 0 ) - ( doc && doc.clientTop  || body && body.clientTop  || 0 );
			}

			// Add which for click: 1 === left; 2 === middle; 3 === right
			// Note: button is not normalized, so don't use it
			if ( !event.which && button !== undefined ) {
				event.which = ( button & 1 ? 1 : ( button & 2 ? 3 : ( button & 4 ? 2 : 0 ) ) );
			}

			return event;
		}
	},

	fix: function( event ) {
		if ( event[ jQuery.expando ] ) {
			return event;
		}

		// Create a writable copy of the event object and normalize some properties
		var i, prop, copy,
			type = event.type,
			originalEvent = event,
			fixHook = this.fixHooks[ type ];

		if ( !fixHook ) {
			this.fixHooks[ type ] = fixHook =
				rmouseEvent.test( type ) ? this.mouseHooks :
				rkeyEvent.test( type ) ? this.keyHooks :
				{};
		}
		copy = fixHook.props ? this.props.concat( fixHook.props ) : this.props;

		event = new jQuery.Event( originalEvent );

		i = copy.length;
		while ( i-- ) {
			prop = copy[ i ];
			event[ prop ] = originalEvent[ prop ];
		}

		// Support: Cordova 2.5 (WebKit) (#13255)
		// All events should have a target; Cordova deviceready doesn't
		if ( !event.target ) {
			event.target = document;
		}

		// Support: Safari 6.0+, Chrome<28
		// Target should not be a text node (#504, #13143)
		if ( event.target.nodeType === 3 ) {
			event.target = event.target.parentNode;
		}

		return fixHook.filter ? fixHook.filter( event, originalEvent ) : event;
	},

	special: {
		load: {
			// Prevent triggered image.load events from bubbling to window.load
			noBubble: true
		},
		focus: {
			// Fire native event if possible so blur/focus sequence is correct
			trigger: function() {
				if ( this !== safeActiveElement() && this.focus ) {
					this.focus();
					return false;
				}
			},
			delegateType: "focusin"
		},
		blur: {
			trigger: function() {
				if ( this === safeActiveElement() && this.blur ) {
					this.blur();
					return false;
				}
			},
			delegateType: "focusout"
		},
		click: {
			// For checkbox, fire native event so checked state will be right
			trigger: function() {
				if ( this.type === "checkbox" && this.click && jQuery.nodeName( this, "input" ) ) {
					this.click();
					return false;
				}
			},

			// For cross-browser consistency, don't fire native .click() on links
			_default: function( event ) {
				return jQuery.nodeName( event.target, "a" );
			}
		},

		beforeunload: {
			postDispatch: function( event ) {

				// Support: Firefox 20+
				// Firefox doesn't alert if the returnValue field is not set.
				if ( event.result !== undefined && event.originalEvent ) {
					event.originalEvent.returnValue = event.result;
				}
			}
		}
	},

	simulate: function( type, elem, event, bubble ) {
		// Piggyback on a donor event to simulate a different one.
		// Fake originalEvent to avoid donor's stopPropagation, but if the
		// simulated event prevents default then we do the same on the donor.
		var e = jQuery.extend(
			new jQuery.Event(),
			event,
			{
				type: type,
				isSimulated: true,
				originalEvent: {}
			}
		);
		if ( bubble ) {
			jQuery.event.trigger( e, null, elem );
		} else {
			jQuery.event.dispatch.call( elem, e );
		}
		if ( e.isDefaultPrevented() ) {
			event.preventDefault();
		}
	}
};

jQuery.removeEvent = function( elem, type, handle ) {
	if ( elem.removeEventListener ) {
		elem.removeEventListener( type, handle, false );
	}
};

jQuery.Event = function( src, props ) {
	// Allow instantiation without the 'new' keyword
	if ( !(this instanceof jQuery.Event) ) {
		return new jQuery.Event( src, props );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;

		// Events bubbling up the document may have been marked as prevented
		// by a handler lower down the tree; reflect the correct value.
		this.isDefaultPrevented = src.defaultPrevented ||
				src.defaultPrevented === undefined &&
				// Support: Android<4.0
				src.returnValue === false ?
			returnTrue :
			returnFalse;

	// Event type
	} else {
		this.type = src;
	}

	// Put explicitly provided properties onto the event object
	if ( props ) {
		jQuery.extend( this, props );
	}

	// Create a timestamp if incoming event doesn't have one
	this.timeStamp = src && src.timeStamp || jQuery.now();

	// Mark it as fixed
	this[ jQuery.expando ] = true;
};

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse,

	preventDefault: function() {
		var e = this.originalEvent;

		this.isDefaultPrevented = returnTrue;

		if ( e && e.preventDefault ) {
			e.preventDefault();
		}
	},
	stopPropagation: function() {
		var e = this.originalEvent;

		this.isPropagationStopped = returnTrue;

		if ( e && e.stopPropagation ) {
			e.stopPropagation();
		}
	},
	stopImmediatePropagation: function() {
		var e = this.originalEvent;

		this.isImmediatePropagationStopped = returnTrue;

		if ( e && e.stopImmediatePropagation ) {
			e.stopImmediatePropagation();
		}

		this.stopPropagation();
	}
};

// Create mouseenter/leave events using mouseover/out and event-time checks
// Support: Chrome 15+
jQuery.each({
	mouseenter: "mouseover",
	mouseleave: "mouseout",
	pointerenter: "pointerover",
	pointerleave: "pointerout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		delegateType: fix,
		bindType: fix,

		handle: function( event ) {
			var ret,
				target = this,
				related = event.relatedTarget,
				handleObj = event.handleObj;

			// For mousenter/leave call the handler if related is outside the target.
			// NB: No relatedTarget if the mouse left/entered the browser window
			if ( !related || (related !== target && !jQuery.contains( target, related )) ) {
				event.type = handleObj.origType;
				ret = handleObj.handler.apply( this, arguments );
				event.type = fix;
			}
			return ret;
		}
	};
});

// Support: Firefox, Chrome, Safari
// Create "bubbling" focus and blur events
if ( !support.focusinBubbles ) {
	jQuery.each({ focus: "focusin", blur: "focusout" }, function( orig, fix ) {

		// Attach a single capturing handler on the document while someone wants focusin/focusout
		var handler = function( event ) {
				jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ), true );
			};

		jQuery.event.special[ fix ] = {
			setup: function() {
				var doc = this.ownerDocument || this,
					attaches = data_priv.access( doc, fix );

				if ( !attaches ) {
					doc.addEventListener( orig, handler, true );
				}
				data_priv.access( doc, fix, ( attaches || 0 ) + 1 );
			},
			teardown: function() {
				var doc = this.ownerDocument || this,
					attaches = data_priv.access( doc, fix ) - 1;

				if ( !attaches ) {
					doc.removeEventListener( orig, handler, true );
					data_priv.remove( doc, fix );

				} else {
					data_priv.access( doc, fix, attaches );
				}
			}
		};
	});
}

jQuery.fn.extend({

	on: function( types, selector, data, fn, /*INTERNAL*/ one ) {
		var origFn, type;

		// Types can be a map of types/handlers
		if ( typeof types === "object" ) {
			// ( types-Object, selector, data )
			if ( typeof selector !== "string" ) {
				// ( types-Object, data )
				data = data || selector;
				selector = undefined;
			}
			for ( type in types ) {
				this.on( type, selector, data, types[ type ], one );
			}
			return this;
		}

		if ( data == null && fn == null ) {
			// ( types, fn )
			fn = selector;
			data = selector = undefined;
		} else if ( fn == null ) {
			if ( typeof selector === "string" ) {
				// ( types, selector, fn )
				fn = data;
				data = undefined;
			} else {
				// ( types, data, fn )
				fn = data;
				data = selector;
				selector = undefined;
			}
		}
		if ( fn === false ) {
			fn = returnFalse;
		} else if ( !fn ) {
			return this;
		}

		if ( one === 1 ) {
			origFn = fn;
			fn = function( event ) {
				// Can use an empty set, since event contains the info
				jQuery().off( event );
				return origFn.apply( this, arguments );
			};
			// Use same guid so caller can remove using origFn
			fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
		}
		return this.each( function() {
			jQuery.event.add( this, types, fn, data, selector );
		});
	},
	one: function( types, selector, data, fn ) {
		return this.on( types, selector, data, fn, 1 );
	},
	off: function( types, selector, fn ) {
		var handleObj, type;
		if ( types && types.preventDefault && types.handleObj ) {
			// ( event )  dispatched jQuery.Event
			handleObj = types.handleObj;
			jQuery( types.delegateTarget ).off(
				handleObj.namespace ? handleObj.origType + "." + handleObj.namespace : handleObj.origType,
				handleObj.selector,
				handleObj.handler
			);
			return this;
		}
		if ( typeof types === "object" ) {
			// ( types-object [, selector] )
			for ( type in types ) {
				this.off( type, selector, types[ type ] );
			}
			return this;
		}
		if ( selector === false || typeof selector === "function" ) {
			// ( types [, fn] )
			fn = selector;
			selector = undefined;
		}
		if ( fn === false ) {
			fn = returnFalse;
		}
		return this.each(function() {
			jQuery.event.remove( this, types, fn, selector );
		});
	},

	trigger: function( type, data ) {
		return this.each(function() {
			jQuery.event.trigger( type, data, this );
		});
	},
	triggerHandler: function( type, data ) {
		var elem = this[0];
		if ( elem ) {
			return jQuery.event.trigger( type, data, elem, true );
		}
	}
});


var
	rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
	rtagName = /<([\w:]+)/,
	rhtml = /<|&#?\w+;/,
	rnoInnerhtml = /<(?:script|style|link)/i,
	// checked="checked" or checked
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
	rscriptType = /^$|\/(?:java|ecma)script/i,
	rscriptTypeMasked = /^true\/(.*)/,
	rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,

	// We have to close these tags to support XHTML (#13200)
	wrapMap = {

		// Support: IE9
		option: [ 1, "<select multiple='multiple'>", "</select>" ],

		thead: [ 1, "<table>", "</table>" ],
		col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
		tr: [ 2, "<table><tbody>", "</tbody></table>" ],
		td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

		_default: [ 0, "", "" ]
	};

// Support: IE9
wrapMap.optgroup = wrapMap.option;

wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;

// Support: 1.x compatibility
// Manipulating tables requires a tbody
function manipulationTarget( elem, content ) {
	return jQuery.nodeName( elem, "table" ) &&
		jQuery.nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ?

		elem.getElementsByTagName("tbody")[0] ||
			elem.appendChild( elem.ownerDocument.createElement("tbody") ) :
		elem;
}

// Replace/restore the type attribute of script elements for safe DOM manipulation
function disableScript( elem ) {
	elem.type = (elem.getAttribute("type") !== null) + "/" + elem.type;
	return elem;
}
function restoreScript( elem ) {
	var match = rscriptTypeMasked.exec( elem.type );

	if ( match ) {
		elem.type = match[ 1 ];
	} else {
		elem.removeAttribute("type");
	}

	return elem;
}

// Mark scripts as having already been evaluated
function setGlobalEval( elems, refElements ) {
	var i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		data_priv.set(
			elems[ i ], "globalEval", !refElements || data_priv.get( refElements[ i ], "globalEval" )
		);
	}
}

function cloneCopyEvent( src, dest ) {
	var i, l, type, pdataOld, pdataCur, udataOld, udataCur, events;

	if ( dest.nodeType !== 1 ) {
		return;
	}

	// 1. Copy private data: events, handlers, etc.
	if ( data_priv.hasData( src ) ) {
		pdataOld = data_priv.access( src );
		pdataCur = data_priv.set( dest, pdataOld );
		events = pdataOld.events;

		if ( events ) {
			delete pdataCur.handle;
			pdataCur.events = {};

			for ( type in events ) {
				for ( i = 0, l = events[ type ].length; i < l; i++ ) {
					jQuery.event.add( dest, type, events[ type ][ i ] );
				}
			}
		}
	}

	// 2. Copy user data
	if ( data_user.hasData( src ) ) {
		udataOld = data_user.access( src );
		udataCur = jQuery.extend( {}, udataOld );

		data_user.set( dest, udataCur );
	}
}

function getAll( context, tag ) {
	var ret = context.getElementsByTagName ? context.getElementsByTagName( tag || "*" ) :
			context.querySelectorAll ? context.querySelectorAll( tag || "*" ) :
			[];

	return tag === undefined || tag && jQuery.nodeName( context, tag ) ?
		jQuery.merge( [ context ], ret ) :
		ret;
}

// Fix IE bugs, see support tests
function fixInput( src, dest ) {
	var nodeName = dest.nodeName.toLowerCase();

	// Fails to persist the checked state of a cloned checkbox or radio button.
	if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
		dest.checked = src.checked;

	// Fails to return the selected option to the default selected state when cloning options
	} else if ( nodeName === "input" || nodeName === "textarea" ) {
		dest.defaultValue = src.defaultValue;
	}
}

jQuery.extend({
	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
		var i, l, srcElements, destElements,
			clone = elem.cloneNode( true ),
			inPage = jQuery.contains( elem.ownerDocument, elem );

		// Fix IE cloning issues
		if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
				!jQuery.isXMLDoc( elem ) ) {

			// We eschew Sizzle here for performance reasons: http://jsperf.com/getall-vs-sizzle/2
			destElements = getAll( clone );
			srcElements = getAll( elem );

			for ( i = 0, l = srcElements.length; i < l; i++ ) {
				fixInput( srcElements[ i ], destElements[ i ] );
			}
		}

		// Copy the events from the original to the clone
		if ( dataAndEvents ) {
			if ( deepDataAndEvents ) {
				srcElements = srcElements || getAll( elem );
				destElements = destElements || getAll( clone );

				for ( i = 0, l = srcElements.length; i < l; i++ ) {
					cloneCopyEvent( srcElements[ i ], destElements[ i ] );
				}
			} else {
				cloneCopyEvent( elem, clone );
			}
		}

		// Preserve script evaluation history
		destElements = getAll( clone, "script" );
		if ( destElements.length > 0 ) {
			setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
		}

		// Return the cloned set
		return clone;
	},

	buildFragment: function( elems, context, scripts, selection ) {
		var elem, tmp, tag, wrap, contains, j,
			fragment = context.createDocumentFragment(),
			nodes = [],
			i = 0,
			l = elems.length;

		for ( ; i < l; i++ ) {
			elem = elems[ i ];

			if ( elem || elem === 0 ) {

				// Add nodes directly
				if ( jQuery.type( elem ) === "object" ) {
					// Support: QtWebKit, PhantomJS
					// push.apply(_, arraylike) throws on ancient WebKit
					jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

				// Convert non-html into a text node
				} else if ( !rhtml.test( elem ) ) {
					nodes.push( context.createTextNode( elem ) );

				// Convert html into DOM nodes
				} else {
					tmp = tmp || fragment.appendChild( context.createElement("div") );

					// Deserialize a standard representation
					tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
					wrap = wrapMap[ tag ] || wrapMap._default;
					tmp.innerHTML = wrap[ 1 ] + elem.replace( rxhtmlTag, "<$1></$2>" ) + wrap[ 2 ];

					// Descend through wrappers to the right content
					j = wrap[ 0 ];
					while ( j-- ) {
						tmp = tmp.lastChild;
					}

					// Support: QtWebKit, PhantomJS
					// push.apply(_, arraylike) throws on ancient WebKit
					jQuery.merge( nodes, tmp.childNodes );

					// Remember the top-level container
					tmp = fragment.firstChild;

					// Ensure the created nodes are orphaned (#12392)
					tmp.textContent = "";
				}
			}
		}

		// Remove wrapper from fragment
		fragment.textContent = "";

		i = 0;
		while ( (elem = nodes[ i++ ]) ) {

			// #4087 - If origin and destination elements are the same, and this is
			// that element, do not do anything
			if ( selection && jQuery.inArray( elem, selection ) !== -1 ) {
				continue;
			}

			contains = jQuery.contains( elem.ownerDocument, elem );

			// Append to fragment
			tmp = getAll( fragment.appendChild( elem ), "script" );

			// Preserve script evaluation history
			if ( contains ) {
				setGlobalEval( tmp );
			}

			// Capture executables
			if ( scripts ) {
				j = 0;
				while ( (elem = tmp[ j++ ]) ) {
					if ( rscriptType.test( elem.type || "" ) ) {
						scripts.push( elem );
					}
				}
			}
		}

		return fragment;
	},

	cleanData: function( elems ) {
		var data, elem, type, key,
			special = jQuery.event.special,
			i = 0;

		for ( ; (elem = elems[ i ]) !== undefined; i++ ) {
			if ( jQuery.acceptData( elem ) ) {
				key = elem[ data_priv.expando ];

				if ( key && (data = data_priv.cache[ key ]) ) {
					if ( data.events ) {
						for ( type in data.events ) {
							if ( special[ type ] ) {
								jQuery.event.remove( elem, type );

							// This is a shortcut to avoid jQuery.event.remove's overhead
							} else {
								jQuery.removeEvent( elem, type, data.handle );
							}
						}
					}
					if ( data_priv.cache[ key ] ) {
						// Discard any remaining `private` data
						delete data_priv.cache[ key ];
					}
				}
			}
			// Discard any remaining `user` data
			delete data_user.cache[ elem[ data_user.expando ] ];
		}
	}
});

jQuery.fn.extend({
	text: function( value ) {
		return access( this, function( value ) {
			return value === undefined ?
				jQuery.text( this ) :
				this.empty().each(function() {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						this.textContent = value;
					}
				});
		}, null, value, arguments.length );
	},

	append: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.appendChild( elem );
			}
		});
	},

	prepend: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.insertBefore( elem, target.firstChild );
			}
		});
	},

	before: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this );
			}
		});
	},

	after: function() {
		return this.domManip( arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			}
		});
	},

	remove: function( selector, keepData /* Internal Use Only */ ) {
		var elem,
			elems = selector ? jQuery.filter( selector, this ) : this,
			i = 0;

		for ( ; (elem = elems[i]) != null; i++ ) {
			if ( !keepData && elem.nodeType === 1 ) {
				jQuery.cleanData( getAll( elem ) );
			}

			if ( elem.parentNode ) {
				if ( keepData && jQuery.contains( elem.ownerDocument, elem ) ) {
					setGlobalEval( getAll( elem, "script" ) );
				}
				elem.parentNode.removeChild( elem );
			}
		}

		return this;
	},

	empty: function() {
		var elem,
			i = 0;

		for ( ; (elem = this[i]) != null; i++ ) {
			if ( elem.nodeType === 1 ) {

				// Prevent memory leaks
				jQuery.cleanData( getAll( elem, false ) );

				// Remove any remaining nodes
				elem.textContent = "";
			}
		}

		return this;
	},

	clone: function( dataAndEvents, deepDataAndEvents ) {
		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

		return this.map(function() {
			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
		});
	},

	html: function( value ) {
		return access( this, function( value ) {
			var elem = this[ 0 ] || {},
				i = 0,
				l = this.length;

			if ( value === undefined && elem.nodeType === 1 ) {
				return elem.innerHTML;
			}

			// See if we can take a shortcut and just use innerHTML
			if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
				!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

				value = value.replace( rxhtmlTag, "<$1></$2>" );

				try {
					for ( ; i < l; i++ ) {
						elem = this[ i ] || {};

						// Remove element nodes and prevent memory leaks
						if ( elem.nodeType === 1 ) {
							jQuery.cleanData( getAll( elem, false ) );
							elem.innerHTML = value;
						}
					}

					elem = 0;

				// If using innerHTML throws an exception, use the fallback method
				} catch( e ) {}
			}

			if ( elem ) {
				this.empty().append( value );
			}
		}, null, value, arguments.length );
	},

	replaceWith: function() {
		var arg = arguments[ 0 ];

		// Make the changes, replacing each context element with the new content
		this.domManip( arguments, function( elem ) {
			arg = this.parentNode;

			jQuery.cleanData( getAll( this ) );

			if ( arg ) {
				arg.replaceChild( elem, this );
			}
		});

		// Force removal if there was no new content (e.g., from empty arguments)
		return arg && (arg.length || arg.nodeType) ? this : this.remove();
	},

	detach: function( selector ) {
		return this.remove( selector, true );
	},

	domManip: function( args, callback ) {

		// Flatten any nested arrays
		args = concat.apply( [], args );

		var fragment, first, scripts, hasScripts, node, doc,
			i = 0,
			l = this.length,
			set = this,
			iNoClone = l - 1,
			value = args[ 0 ],
			isFunction = jQuery.isFunction( value );

		// We can't cloneNode fragments that contain checked, in WebKit
		if ( isFunction ||
				( l > 1 && typeof value === "string" &&
					!support.checkClone && rchecked.test( value ) ) ) {
			return this.each(function( index ) {
				var self = set.eq( index );
				if ( isFunction ) {
					args[ 0 ] = value.call( this, index, self.html() );
				}
				self.domManip( args, callback );
			});
		}

		if ( l ) {
			fragment = jQuery.buildFragment( args, this[ 0 ].ownerDocument, false, this );
			first = fragment.firstChild;

			if ( fragment.childNodes.length === 1 ) {
				fragment = first;
			}

			if ( first ) {
				scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
				hasScripts = scripts.length;

				// Use the original fragment for the last item instead of the first because it can end up
				// being emptied incorrectly in certain situations (#8070).
				for ( ; i < l; i++ ) {
					node = fragment;

					if ( i !== iNoClone ) {
						node = jQuery.clone( node, true, true );

						// Keep references to cloned scripts for later restoration
						if ( hasScripts ) {
							// Support: QtWebKit
							// jQuery.merge because push.apply(_, arraylike) throws
							jQuery.merge( scripts, getAll( node, "script" ) );
						}
					}

					callback.call( this[ i ], node, i );
				}

				if ( hasScripts ) {
					doc = scripts[ scripts.length - 1 ].ownerDocument;

					// Reenable scripts
					jQuery.map( scripts, restoreScript );

					// Evaluate executable scripts on first document insertion
					for ( i = 0; i < hasScripts; i++ ) {
						node = scripts[ i ];
						if ( rscriptType.test( node.type || "" ) &&
							!data_priv.access( node, "globalEval" ) && jQuery.contains( doc, node ) ) {

							if ( node.src ) {
								// Optional AJAX dependency, but won't run scripts if not present
								if ( jQuery._evalUrl ) {
									jQuery._evalUrl( node.src );
								}
							} else {
								jQuery.globalEval( node.textContent.replace( rcleanScript, "" ) );
							}
						}
					}
				}
			}
		}

		return this;
	}
});

jQuery.each({
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var elems,
			ret = [],
			insert = jQuery( selector ),
			last = insert.length - 1,
			i = 0;

		for ( ; i <= last; i++ ) {
			elems = i === last ? this : this.clone( true );
			jQuery( insert[ i ] )[ original ]( elems );

			// Support: QtWebKit
			// .get() because push.apply(_, arraylike) throws
			push.apply( ret, elems.get() );
		}

		return this.pushStack( ret );
	};
});


var iframe,
	elemdisplay = {};

/**
 * Retrieve the actual display of a element
 * @param {String} name nodeName of the element
 * @param {Object} doc Document object
 */
// Called only from within defaultDisplay
function actualDisplay( name, doc ) {
	var style,
		elem = jQuery( doc.createElement( name ) ).appendTo( doc.body ),

		// getDefaultComputedStyle might be reliably used only on attached element
		display = window.getDefaultComputedStyle && ( style = window.getDefaultComputedStyle( elem[ 0 ] ) ) ?

			// Use of this method is a temporary fix (more like optimization) until something better comes along,
			// since it was removed from specification and supported only in FF
			style.display : jQuery.css( elem[ 0 ], "display" );

	// We don't have any data stored on the element,
	// so use "detach" method as fast way to get rid of the element
	elem.detach();

	return display;
}

/**
 * Try to determine the default display value of an element
 * @param {String} nodeName
 */
function defaultDisplay( nodeName ) {
	var doc = document,
		display = elemdisplay[ nodeName ];

	if ( !display ) {
		display = actualDisplay( nodeName, doc );

		// If the simple way fails, read from inside an iframe
		if ( display === "none" || !display ) {

			// Use the already-created iframe if possible
			iframe = (iframe || jQuery( "<iframe frameborder='0' width='0' height='0'/>" )).appendTo( doc.documentElement );

			// Always write a new HTML skeleton so Webkit and Firefox don't choke on reuse
			doc = iframe[ 0 ].contentDocument;

			// Support: IE
			doc.write();
			doc.close();

			display = actualDisplay( nodeName, doc );
			iframe.detach();
		}

		// Store the correct default display
		elemdisplay[ nodeName ] = display;
	}

	return display;
}
var rmargin = (/^margin/);

var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

var getStyles = function( elem ) {
		// Support: IE<=11+, Firefox<=30+ (#15098, #14150)
		// IE throws on elements created in popups
		// FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
		if ( elem.ownerDocument.defaultView.opener ) {
			return elem.ownerDocument.defaultView.getComputedStyle( elem, null );
		}

		return window.getComputedStyle( elem, null );
	};



function curCSS( elem, name, computed ) {
	var width, minWidth, maxWidth, ret,
		style = elem.style;

	computed = computed || getStyles( elem );

	// Support: IE9
	// getPropertyValue is only needed for .css('filter') (#12537)
	if ( computed ) {
		ret = computed.getPropertyValue( name ) || computed[ name ];
	}

	if ( computed ) {

		if ( ret === "" && !jQuery.contains( elem.ownerDocument, elem ) ) {
			ret = jQuery.style( elem, name );
		}

		// Support: iOS < 6
		// A tribute to the "awesome hack by Dean Edwards"
		// iOS < 6 (at least) returns percentage for a larger set of values, but width seems to be reliably pixels
		// this is against the CSSOM draft spec: http://dev.w3.org/csswg/cssom/#resolved-values
		if ( rnumnonpx.test( ret ) && rmargin.test( name ) ) {

			// Remember the original values
			width = style.width;
			minWidth = style.minWidth;
			maxWidth = style.maxWidth;

			// Put in the new values to get a computed value out
			style.minWidth = style.maxWidth = style.width = ret;
			ret = computed.width;

			// Revert the changed values
			style.width = width;
			style.minWidth = minWidth;
			style.maxWidth = maxWidth;
		}
	}

	return ret !== undefined ?
		// Support: IE
		// IE returns zIndex value as an integer.
		ret + "" :
		ret;
}


function addGetHookIf( conditionFn, hookFn ) {
	// Define the hook, we'll check on the first run if it's really needed.
	return {
		get: function() {
			if ( conditionFn() ) {
				// Hook not needed (or it's not possible to use it due
				// to missing dependency), remove it.
				delete this.get;
				return;
			}

			// Hook needed; redefine it so that the support test is not executed again.
			return (this.get = hookFn).apply( this, arguments );
		}
	};
}


(function() {
	var pixelPositionVal, boxSizingReliableVal,
		docElem = document.documentElement,
		container = document.createElement( "div" ),
		div = document.createElement( "div" );

	if ( !div.style ) {
		return;
	}

	// Support: IE9-11+
	// Style of cloned element affects source element cloned (#8908)
	div.style.backgroundClip = "content-box";
	div.cloneNode( true ).style.backgroundClip = "";
	support.clearCloneStyle = div.style.backgroundClip === "content-box";

	container.style.cssText = "border:0;width:0;height:0;top:0;left:-9999px;margin-top:1px;" +
		"position:absolute";
	container.appendChild( div );

	// Executing both pixelPosition & boxSizingReliable tests require only one layout
	// so they're executed at the same time to save the second computation.
	function computePixelPositionAndBoxSizingReliable() {
		div.style.cssText =
			// Support: Firefox<29, Android 2.3
			// Vendor-prefix box-sizing
			"-webkit-box-sizing:border-box;-moz-box-sizing:border-box;" +
			"box-sizing:border-box;display:block;margin-top:1%;top:1%;" +
			"border:1px;padding:1px;width:4px;position:absolute";
		div.innerHTML = "";
		docElem.appendChild( container );

		var divStyle = window.getComputedStyle( div, null );
		pixelPositionVal = divStyle.top !== "1%";
		boxSizingReliableVal = divStyle.width === "4px";

		docElem.removeChild( container );
	}

	// Support: node.js jsdom
	// Don't assume that getComputedStyle is a property of the global object
	if ( window.getComputedStyle ) {
		jQuery.extend( support, {
			pixelPosition: function() {

				// This test is executed only once but we still do memoizing
				// since we can use the boxSizingReliable pre-computing.
				// No need to check if the test was already performed, though.
				computePixelPositionAndBoxSizingReliable();
				return pixelPositionVal;
			},
			boxSizingReliable: function() {
				if ( boxSizingReliableVal == null ) {
					computePixelPositionAndBoxSizingReliable();
				}
				return boxSizingReliableVal;
			},
			reliableMarginRight: function() {

				// Support: Android 2.3
				// Check if div with explicit width and no margin-right incorrectly
				// gets computed margin-right based on width of container. (#3333)
				// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
				// This support function is only executed once so no memoizing is needed.
				var ret,
					marginDiv = div.appendChild( document.createElement( "div" ) );

				// Reset CSS: box-sizing; display; margin; border; padding
				marginDiv.style.cssText = div.style.cssText =
					// Support: Firefox<29, Android 2.3
					// Vendor-prefix box-sizing
					"-webkit-box-sizing:content-box;-moz-box-sizing:content-box;" +
					"box-sizing:content-box;display:block;margin:0;border:0;padding:0";
				marginDiv.style.marginRight = marginDiv.style.width = "0";
				div.style.width = "1px";
				docElem.appendChild( container );

				ret = !parseFloat( window.getComputedStyle( marginDiv, null ).marginRight );

				docElem.removeChild( container );
				div.removeChild( marginDiv );

				return ret;
			}
		});
	}
})();


// A method for quickly swapping in/out CSS properties to get correct calculations.
jQuery.swap = function( elem, options, callback, args ) {
	var ret, name,
		old = {};

	// Remember the old values, and insert the new ones
	for ( name in options ) {
		old[ name ] = elem.style[ name ];
		elem.style[ name ] = options[ name ];
	}

	ret = callback.apply( elem, args || [] );

	// Revert the old values
	for ( name in options ) {
		elem.style[ name ] = old[ name ];
	}

	return ret;
};


var
	// Swappable if display is none or starts with table except "table", "table-cell", or "table-caption"
	// See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
	rdisplayswap = /^(none|table(?!-c[ea]).+)/,
	rnumsplit = new RegExp( "^(" + pnum + ")(.*)$", "i" ),
	rrelNum = new RegExp( "^([+-])=(" + pnum + ")", "i" ),

	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
	cssNormalTransform = {
		letterSpacing: "0",
		fontWeight: "400"
	},

	cssPrefixes = [ "Webkit", "O", "Moz", "ms" ];

// Return a css property mapped to a potentially vendor prefixed property
function vendorPropName( style, name ) {

	// Shortcut for names that are not vendor prefixed
	if ( name in style ) {
		return name;
	}

	// Check for vendor prefixed names
	var capName = name[0].toUpperCase() + name.slice(1),
		origName = name,
		i = cssPrefixes.length;

	while ( i-- ) {
		name = cssPrefixes[ i ] + capName;
		if ( name in style ) {
			return name;
		}
	}

	return origName;
}

function setPositiveNumber( elem, value, subtract ) {
	var matches = rnumsplit.exec( value );
	return matches ?
		// Guard against undefined "subtract", e.g., when used as in cssHooks
		Math.max( 0, matches[ 1 ] - ( subtract || 0 ) ) + ( matches[ 2 ] || "px" ) :
		value;
}

function augmentWidthOrHeight( elem, name, extra, isBorderBox, styles ) {
	var i = extra === ( isBorderBox ? "border" : "content" ) ?
		// If we already have the right measurement, avoid augmentation
		4 :
		// Otherwise initialize for horizontal or vertical properties
		name === "width" ? 1 : 0,

		val = 0;

	for ( ; i < 4; i += 2 ) {
		// Both box models exclude margin, so add it if we want it
		if ( extra === "margin" ) {
			val += jQuery.css( elem, extra + cssExpand[ i ], true, styles );
		}

		if ( isBorderBox ) {
			// border-box includes padding, so remove it if we want content
			if ( extra === "content" ) {
				val -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
			}

			// At this point, extra isn't border nor margin, so remove border
			if ( extra !== "margin" ) {
				val -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		} else {
			// At this point, extra isn't content, so add padding
			val += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

			// At this point, extra isn't content nor padding, so add border
			if ( extra !== "padding" ) {
				val += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		}
	}

	return val;
}

function getWidthOrHeight( elem, name, extra ) {

	// Start with offset property, which is equivalent to the border-box value
	var valueIsBorderBox = true,
		val = name === "width" ? elem.offsetWidth : elem.offsetHeight,
		styles = getStyles( elem ),
		isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

	// Some non-html elements return undefined for offsetWidth, so check for null/undefined
	// svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
	// MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
	if ( val <= 0 || val == null ) {
		// Fall back to computed then uncomputed css if necessary
		val = curCSS( elem, name, styles );
		if ( val < 0 || val == null ) {
			val = elem.style[ name ];
		}

		// Computed unit is not pixels. Stop here and return.
		if ( rnumnonpx.test(val) ) {
			return val;
		}

		// Check for style in case a browser which returns unreliable values
		// for getComputedStyle silently falls back to the reliable elem.style
		valueIsBorderBox = isBorderBox &&
			( support.boxSizingReliable() || val === elem.style[ name ] );

		// Normalize "", auto, and prepare for extra
		val = parseFloat( val ) || 0;
	}

	// Use the active box-sizing model to add/subtract irrelevant styles
	return ( val +
		augmentWidthOrHeight(
			elem,
			name,
			extra || ( isBorderBox ? "border" : "content" ),
			valueIsBorderBox,
			styles
		)
	) + "px";
}

function showHide( elements, show ) {
	var display, elem, hidden,
		values = [],
		index = 0,
		length = elements.length;

	for ( ; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}

		values[ index ] = data_priv.get( elem, "olddisplay" );
		display = elem.style.display;
		if ( show ) {
			// Reset the inline display of this element to learn if it is
			// being hidden by cascaded rules or not
			if ( !values[ index ] && display === "none" ) {
				elem.style.display = "";
			}

			// Set elements which have been overridden with display: none
			// in a stylesheet to whatever the default browser style is
			// for such an element
			if ( elem.style.display === "" && isHidden( elem ) ) {
				values[ index ] = data_priv.access( elem, "olddisplay", defaultDisplay(elem.nodeName) );
			}
		} else {
			hidden = isHidden( elem );

			if ( display !== "none" || !hidden ) {
				data_priv.set( elem, "olddisplay", hidden ? display : jQuery.css( elem, "display" ) );
			}
		}
	}

	// Set the display of most of the elements in a second loop
	// to avoid the constant reflow
	for ( index = 0; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}
		if ( !show || elem.style.display === "none" || elem.style.display === "" ) {
			elem.style.display = show ? values[ index ] || "" : "none";
		}
	}

	return elements;
}

jQuery.extend({

	// Add in style property hooks for overriding the default
	// behavior of getting and setting a style property
	cssHooks: {
		opacity: {
			get: function( elem, computed ) {
				if ( computed ) {

					// We should always get a number back from opacity
					var ret = curCSS( elem, "opacity" );
					return ret === "" ? "1" : ret;
				}
			}
		}
	},

	// Don't automatically add "px" to these possibly-unitless properties
	cssNumber: {
		"columnCount": true,
		"fillOpacity": true,
		"flexGrow": true,
		"flexShrink": true,
		"fontWeight": true,
		"lineHeight": true,
		"opacity": true,
		"order": true,
		"orphans": true,
		"widows": true,
		"zIndex": true,
		"zoom": true
	},

	// Add in properties whose names you wish to fix before
	// setting or getting the value
	cssProps: {
		"float": "cssFloat"
	},

	// Get and set the style property on a DOM Node
	style: function( elem, name, value, extra ) {

		// Don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
			return;
		}

		// Make sure that we're working with the right name
		var ret, type, hooks,
			origName = jQuery.camelCase( name ),
			style = elem.style;

		name = jQuery.cssProps[ origName ] || ( jQuery.cssProps[ origName ] = vendorPropName( style, origName ) );

		// Gets hook for the prefixed version, then unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// Check if we're setting a value
		if ( value !== undefined ) {
			type = typeof value;

			// Convert "+=" or "-=" to relative numbers (#7345)
			if ( type === "string" && (ret = rrelNum.exec( value )) ) {
				value = ( ret[1] + 1 ) * ret[2] + parseFloat( jQuery.css( elem, name ) );
				// Fixes bug #9237
				type = "number";
			}

			// Make sure that null and NaN values aren't set (#7116)
			if ( value == null || value !== value ) {
				return;
			}

			// If a number, add 'px' to the (except for certain CSS properties)
			if ( type === "number" && !jQuery.cssNumber[ origName ] ) {
				value += "px";
			}

			// Support: IE9-11+
			// background-* props affect original clone's values
			if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
				style[ name ] = "inherit";
			}

			// If a hook was provided, use that value, otherwise just set the specified value
			if ( !hooks || !("set" in hooks) || (value = hooks.set( elem, value, extra )) !== undefined ) {
				style[ name ] = value;
			}

		} else {
			// If a hook was provided get the non-computed value from there
			if ( hooks && "get" in hooks && (ret = hooks.get( elem, false, extra )) !== undefined ) {
				return ret;
			}

			// Otherwise just get the value from the style object
			return style[ name ];
		}
	},

	css: function( elem, name, extra, styles ) {
		var val, num, hooks,
			origName = jQuery.camelCase( name );

		// Make sure that we're working with the right name
		name = jQuery.cssProps[ origName ] || ( jQuery.cssProps[ origName ] = vendorPropName( elem.style, origName ) );

		// Try prefixed name followed by the unprefixed name
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// If a hook was provided get the computed value from there
		if ( hooks && "get" in hooks ) {
			val = hooks.get( elem, true, extra );
		}

		// Otherwise, if a way to get the computed value exists, use that
		if ( val === undefined ) {
			val = curCSS( elem, name, styles );
		}

		// Convert "normal" to computed value
		if ( val === "normal" && name in cssNormalTransform ) {
			val = cssNormalTransform[ name ];
		}

		// Make numeric if forced or a qualifier was provided and val looks numeric
		if ( extra === "" || extra ) {
			num = parseFloat( val );
			return extra === true || jQuery.isNumeric( num ) ? num || 0 : val;
		}
		return val;
	}
});

jQuery.each([ "height", "width" ], function( i, name ) {
	jQuery.cssHooks[ name ] = {
		get: function( elem, computed, extra ) {
			if ( computed ) {

				// Certain elements can have dimension info if we invisibly show them
				// but it must have a current display style that would benefit
				return rdisplayswap.test( jQuery.css( elem, "display" ) ) && elem.offsetWidth === 0 ?
					jQuery.swap( elem, cssShow, function() {
						return getWidthOrHeight( elem, name, extra );
					}) :
					getWidthOrHeight( elem, name, extra );
			}
		},

		set: function( elem, value, extra ) {
			var styles = extra && getStyles( elem );
			return setPositiveNumber( elem, value, extra ?
				augmentWidthOrHeight(
					elem,
					name,
					extra,
					jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
					styles
				) : 0
			);
		}
	};
});

// Support: Android 2.3
jQuery.cssHooks.marginRight = addGetHookIf( support.reliableMarginRight,
	function( elem, computed ) {
		if ( computed ) {
			return jQuery.swap( elem, { "display": "inline-block" },
				curCSS, [ elem, "marginRight" ] );
		}
	}
);

// These hooks are used by animate to expand properties
jQuery.each({
	margin: "",
	padding: "",
	border: "Width"
}, function( prefix, suffix ) {
	jQuery.cssHooks[ prefix + suffix ] = {
		expand: function( value ) {
			var i = 0,
				expanded = {},

				// Assumes a single number if not a string
				parts = typeof value === "string" ? value.split(" ") : [ value ];

			for ( ; i < 4; i++ ) {
				expanded[ prefix + cssExpand[ i ] + suffix ] =
					parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
			}

			return expanded;
		}
	};

	if ( !rmargin.test( prefix ) ) {
		jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
	}
});

jQuery.fn.extend({
	css: function( name, value ) {
		return access( this, function( elem, name, value ) {
			var styles, len,
				map = {},
				i = 0;

			if ( jQuery.isArray( name ) ) {
				styles = getStyles( elem );
				len = name.length;

				for ( ; i < len; i++ ) {
					map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
				}

				return map;
			}

			return value !== undefined ?
				jQuery.style( elem, name, value ) :
				jQuery.css( elem, name );
		}, name, value, arguments.length > 1 );
	},
	show: function() {
		return showHide( this, true );
	},
	hide: function() {
		return showHide( this );
	},
	toggle: function( state ) {
		if ( typeof state === "boolean" ) {
			return state ? this.show() : this.hide();
		}

		return this.each(function() {
			if ( isHidden( this ) ) {
				jQuery( this ).show();
			} else {
				jQuery( this ).hide();
			}
		});
	}
});


function Tween( elem, options, prop, end, easing ) {
	return new Tween.prototype.init( elem, options, prop, end, easing );
}
jQuery.Tween = Tween;

Tween.prototype = {
	constructor: Tween,
	init: function( elem, options, prop, end, easing, unit ) {
		this.elem = elem;
		this.prop = prop;
		this.easing = easing || "swing";
		this.options = options;
		this.start = this.now = this.cur();
		this.end = end;
		this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
	},
	cur: function() {
		var hooks = Tween.propHooks[ this.prop ];

		return hooks && hooks.get ?
			hooks.get( this ) :
			Tween.propHooks._default.get( this );
	},
	run: function( percent ) {
		var eased,
			hooks = Tween.propHooks[ this.prop ];

		if ( this.options.duration ) {
			this.pos = eased = jQuery.easing[ this.easing ](
				percent, this.options.duration * percent, 0, 1, this.options.duration
			);
		} else {
			this.pos = eased = percent;
		}
		this.now = ( this.end - this.start ) * eased + this.start;

		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		if ( hooks && hooks.set ) {
			hooks.set( this );
		} else {
			Tween.propHooks._default.set( this );
		}
		return this;
	}
};

Tween.prototype.init.prototype = Tween.prototype;

Tween.propHooks = {
	_default: {
		get: function( tween ) {
			var result;

			if ( tween.elem[ tween.prop ] != null &&
				(!tween.elem.style || tween.elem.style[ tween.prop ] == null) ) {
				return tween.elem[ tween.prop ];
			}

			// Passing an empty string as a 3rd parameter to .css will automatically
			// attempt a parseFloat and fallback to a string if the parse fails.
			// Simple values such as "10px" are parsed to Float;
			// complex values such as "rotate(1rad)" are returned as-is.
			result = jQuery.css( tween.elem, tween.prop, "" );
			// Empty strings, null, undefined and "auto" are converted to 0.
			return !result || result === "auto" ? 0 : result;
		},
		set: function( tween ) {
			// Use step hook for back compat.
			// Use cssHook if its there.
			// Use .style if available and use plain properties where available.
			if ( jQuery.fx.step[ tween.prop ] ) {
				jQuery.fx.step[ tween.prop ]( tween );
			} else if ( tween.elem.style && ( tween.elem.style[ jQuery.cssProps[ tween.prop ] ] != null || jQuery.cssHooks[ tween.prop ] ) ) {
				jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
			} else {
				tween.elem[ tween.prop ] = tween.now;
			}
		}
	}
};

// Support: IE9
// Panic based approach to setting things on disconnected nodes
Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
	set: function( tween ) {
		if ( tween.elem.nodeType && tween.elem.parentNode ) {
			tween.elem[ tween.prop ] = tween.now;
		}
	}
};

jQuery.easing = {
	linear: function( p ) {
		return p;
	},
	swing: function( p ) {
		return 0.5 - Math.cos( p * Math.PI ) / 2;
	}
};

jQuery.fx = Tween.prototype.init;

// Back Compat <1.8 extension point
jQuery.fx.step = {};




var
	fxNow, timerId,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rfxnum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" ),
	rrun = /queueHooks$/,
	animationPrefilters = [ defaultPrefilter ],
	tweeners = {
		"*": [ function( prop, value ) {
			var tween = this.createTween( prop, value ),
				target = tween.cur(),
				parts = rfxnum.exec( value ),
				unit = parts && parts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

				// Starting value computation is required for potential unit mismatches
				start = ( jQuery.cssNumber[ prop ] || unit !== "px" && +target ) &&
					rfxnum.exec( jQuery.css( tween.elem, prop ) ),
				scale = 1,
				maxIterations = 20;

			if ( start && start[ 3 ] !== unit ) {
				// Trust units reported by jQuery.css
				unit = unit || start[ 3 ];

				// Make sure we update the tween properties later on
				parts = parts || [];

				// Iteratively approximate from a nonzero starting point
				start = +target || 1;

				do {
					// If previous iteration zeroed out, double until we get *something*.
					// Use string for doubling so we don't accidentally see scale as unchanged below
					scale = scale || ".5";

					// Adjust and apply
					start = start / scale;
					jQuery.style( tween.elem, prop, start + unit );

				// Update scale, tolerating zero or NaN from tween.cur(),
				// break the loop if scale is unchanged or perfect, or if we've just had enough
				} while ( scale !== (scale = tween.cur() / target) && scale !== 1 && --maxIterations );
			}

			// Update tween properties
			if ( parts ) {
				start = tween.start = +start || +target || 0;
				tween.unit = unit;
				// If a +=/-= token was provided, we're doing a relative animation
				tween.end = parts[ 1 ] ?
					start + ( parts[ 1 ] + 1 ) * parts[ 2 ] :
					+parts[ 2 ];
			}

			return tween;
		} ]
	};

// Animations created synchronously will run synchronously
function createFxNow() {
	setTimeout(function() {
		fxNow = undefined;
	});
	return ( fxNow = jQuery.now() );
}

// Generate parameters to create a standard animation
function genFx( type, includeWidth ) {
	var which,
		i = 0,
		attrs = { height: type };

	// If we include width, step value is 1 to do all cssExpand values,
	// otherwise step value is 2 to skip over Left and Right
	includeWidth = includeWidth ? 1 : 0;
	for ( ; i < 4 ; i += 2 - includeWidth ) {
		which = cssExpand[ i ];
		attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
	}

	if ( includeWidth ) {
		attrs.opacity = attrs.width = type;
	}

	return attrs;
}

function createTween( value, prop, animation ) {
	var tween,
		collection = ( tweeners[ prop ] || [] ).concat( tweeners[ "*" ] ),
		index = 0,
		length = collection.length;
	for ( ; index < length; index++ ) {
		if ( (tween = collection[ index ].call( animation, prop, value )) ) {

			// We're done with this property
			return tween;
		}
	}
}

function defaultPrefilter( elem, props, opts ) {
	/* jshint validthis: true */
	var prop, value, toggle, tween, hooks, oldfire, display, checkDisplay,
		anim = this,
		orig = {},
		style = elem.style,
		hidden = elem.nodeType && isHidden( elem ),
		dataShow = data_priv.get( elem, "fxshow" );

	// Handle queue: false promises
	if ( !opts.queue ) {
		hooks = jQuery._queueHooks( elem, "fx" );
		if ( hooks.unqueued == null ) {
			hooks.unqueued = 0;
			oldfire = hooks.empty.fire;
			hooks.empty.fire = function() {
				if ( !hooks.unqueued ) {
					oldfire();
				}
			};
		}
		hooks.unqueued++;

		anim.always(function() {
			// Ensure the complete handler is called before this completes
			anim.always(function() {
				hooks.unqueued--;
				if ( !jQuery.queue( elem, "fx" ).length ) {
					hooks.empty.fire();
				}
			});
		});
	}

	// Height/width overflow pass
	if ( elem.nodeType === 1 && ( "height" in props || "width" in props ) ) {
		// Make sure that nothing sneaks out
		// Record all 3 overflow attributes because IE9-10 do not
		// change the overflow attribute when overflowX and
		// overflowY are set to the same value
		opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

		// Set display property to inline-block for height/width
		// animations on inline elements that are having width/height animated
		display = jQuery.css( elem, "display" );

		// Test default display if display is currently "none"
		checkDisplay = display === "none" ?
			data_priv.get( elem, "olddisplay" ) || defaultDisplay( elem.nodeName ) : display;

		if ( checkDisplay === "inline" && jQuery.css( elem, "float" ) === "none" ) {
			style.display = "inline-block";
		}
	}

	if ( opts.overflow ) {
		style.overflow = "hidden";
		anim.always(function() {
			style.overflow = opts.overflow[ 0 ];
			style.overflowX = opts.overflow[ 1 ];
			style.overflowY = opts.overflow[ 2 ];
		});
	}

	// show/hide pass
	for ( prop in props ) {
		value = props[ prop ];
		if ( rfxtypes.exec( value ) ) {
			delete props[ prop ];
			toggle = toggle || value === "toggle";
			if ( value === ( hidden ? "hide" : "show" ) ) {

				// If there is dataShow left over from a stopped hide or show and we are going to proceed with show, we should pretend to be hidden
				if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
					hidden = true;
				} else {
					continue;
				}
			}
			orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );

		// Any non-fx value stops us from restoring the original display value
		} else {
			display = undefined;
		}
	}

	if ( !jQuery.isEmptyObject( orig ) ) {
		if ( dataShow ) {
			if ( "hidden" in dataShow ) {
				hidden = dataShow.hidden;
			}
		} else {
			dataShow = data_priv.access( elem, "fxshow", {} );
		}

		// Store state if its toggle - enables .stop().toggle() to "reverse"
		if ( toggle ) {
			dataShow.hidden = !hidden;
		}
		if ( hidden ) {
			jQuery( elem ).show();
		} else {
			anim.done(function() {
				jQuery( elem ).hide();
			});
		}
		anim.done(function() {
			var prop;

			data_priv.remove( elem, "fxshow" );
			for ( prop in orig ) {
				jQuery.style( elem, prop, orig[ prop ] );
			}
		});
		for ( prop in orig ) {
			tween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );

			if ( !( prop in dataShow ) ) {
				dataShow[ prop ] = tween.start;
				if ( hidden ) {
					tween.end = tween.start;
					tween.start = prop === "width" || prop === "height" ? 1 : 0;
				}
			}
		}

	// If this is a noop like .hide().hide(), restore an overwritten display value
	} else if ( (display === "none" ? defaultDisplay( elem.nodeName ) : display) === "inline" ) {
		style.display = display;
	}
}

function propFilter( props, specialEasing ) {
	var index, name, easing, value, hooks;

	// camelCase, specialEasing and expand cssHook pass
	for ( index in props ) {
		name = jQuery.camelCase( index );
		easing = specialEasing[ name ];
		value = props[ index ];
		if ( jQuery.isArray( value ) ) {
			easing = value[ 1 ];
			value = props[ index ] = value[ 0 ];
		}

		if ( index !== name ) {
			props[ name ] = value;
			delete props[ index ];
		}

		hooks = jQuery.cssHooks[ name ];
		if ( hooks && "expand" in hooks ) {
			value = hooks.expand( value );
			delete props[ name ];

			// Not quite $.extend, this won't overwrite existing keys.
			// Reusing 'index' because we have the correct "name"
			for ( index in value ) {
				if ( !( index in props ) ) {
					props[ index ] = value[ index ];
					specialEasing[ index ] = easing;
				}
			}
		} else {
			specialEasing[ name ] = easing;
		}
	}
}

function Animation( elem, properties, options ) {
	var result,
		stopped,
		index = 0,
		length = animationPrefilters.length,
		deferred = jQuery.Deferred().always( function() {
			// Don't match elem in the :animated selector
			delete tick.elem;
		}),
		tick = function() {
			if ( stopped ) {
				return false;
			}
			var currentTime = fxNow || createFxNow(),
				remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),
				// Support: Android 2.3
				// Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (#12497)
				temp = remaining / animation.duration || 0,
				percent = 1 - temp,
				index = 0,
				length = animation.tweens.length;

			for ( ; index < length ; index++ ) {
				animation.tweens[ index ].run( percent );
			}

			deferred.notifyWith( elem, [ animation, percent, remaining ]);

			if ( percent < 1 && length ) {
				return remaining;
			} else {
				deferred.resolveWith( elem, [ animation ] );
				return false;
			}
		},
		animation = deferred.promise({
			elem: elem,
			props: jQuery.extend( {}, properties ),
			opts: jQuery.extend( true, { specialEasing: {} }, options ),
			originalProperties: properties,
			originalOptions: options,
			startTime: fxNow || createFxNow(),
			duration: options.duration,
			tweens: [],
			createTween: function( prop, end ) {
				var tween = jQuery.Tween( elem, animation.opts, prop, end,
						animation.opts.specialEasing[ prop ] || animation.opts.easing );
				animation.tweens.push( tween );
				return tween;
			},
			stop: function( gotoEnd ) {
				var index = 0,
					// If we are going to the end, we want to run all the tweens
					// otherwise we skip this part
					length = gotoEnd ? animation.tweens.length : 0;
				if ( stopped ) {
					return this;
				}
				stopped = true;
				for ( ; index < length ; index++ ) {
					animation.tweens[ index ].run( 1 );
				}

				// Resolve when we played the last frame; otherwise, reject
				if ( gotoEnd ) {
					deferred.resolveWith( elem, [ animation, gotoEnd ] );
				} else {
					deferred.rejectWith( elem, [ animation, gotoEnd ] );
				}
				return this;
			}
		}),
		props = animation.props;

	propFilter( props, animation.opts.specialEasing );

	for ( ; index < length ; index++ ) {
		result = animationPrefilters[ index ].call( animation, elem, props, animation.opts );
		if ( result ) {
			return result;
		}
	}

	jQuery.map( props, createTween, animation );

	if ( jQuery.isFunction( animation.opts.start ) ) {
		animation.opts.start.call( elem, animation );
	}

	jQuery.fx.timer(
		jQuery.extend( tick, {
			elem: elem,
			anim: animation,
			queue: animation.opts.queue
		})
	);

	// attach callbacks from options
	return animation.progress( animation.opts.progress )
		.done( animation.opts.done, animation.opts.complete )
		.fail( animation.opts.fail )
		.always( animation.opts.always );
}

jQuery.Animation = jQuery.extend( Animation, {

	tweener: function( props, callback ) {
		if ( jQuery.isFunction( props ) ) {
			callback = props;
			props = [ "*" ];
		} else {
			props = props.split(" ");
		}

		var prop,
			index = 0,
			length = props.length;

		for ( ; index < length ; index++ ) {
			prop = props[ index ];
			tweeners[ prop ] = tweeners[ prop ] || [];
			tweeners[ prop ].unshift( callback );
		}
	},

	prefilter: function( callback, prepend ) {
		if ( prepend ) {
			animationPrefilters.unshift( callback );
		} else {
			animationPrefilters.push( callback );
		}
	}
});

jQuery.speed = function( speed, easing, fn ) {
	var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
		complete: fn || !fn && easing ||
			jQuery.isFunction( speed ) && speed,
		duration: speed,
		easing: fn && easing || easing && !jQuery.isFunction( easing ) && easing
	};

	opt.duration = jQuery.fx.off ? 0 : typeof opt.duration === "number" ? opt.duration :
		opt.duration in jQuery.fx.speeds ? jQuery.fx.speeds[ opt.duration ] : jQuery.fx.speeds._default;

	// Normalize opt.queue - true/undefined/null -> "fx"
	if ( opt.queue == null || opt.queue === true ) {
		opt.queue = "fx";
	}

	// Queueing
	opt.old = opt.complete;

	opt.complete = function() {
		if ( jQuery.isFunction( opt.old ) ) {
			opt.old.call( this );
		}

		if ( opt.queue ) {
			jQuery.dequeue( this, opt.queue );
		}
	};

	return opt;
};

jQuery.fn.extend({
	fadeTo: function( speed, to, easing, callback ) {

		// Show any hidden elements after setting opacity to 0
		return this.filter( isHidden ).css( "opacity", 0 ).show()

			// Animate to the value specified
			.end().animate({ opacity: to }, speed, easing, callback );
	},
	animate: function( prop, speed, easing, callback ) {
		var empty = jQuery.isEmptyObject( prop ),
			optall = jQuery.speed( speed, easing, callback ),
			doAnimation = function() {
				// Operate on a copy of prop so per-property easing won't be lost
				var anim = Animation( this, jQuery.extend( {}, prop ), optall );

				// Empty animations, or finishing resolves immediately
				if ( empty || data_priv.get( this, "finish" ) ) {
					anim.stop( true );
				}
			};
			doAnimation.finish = doAnimation;

		return empty || optall.queue === false ?
			this.each( doAnimation ) :
			this.queue( optall.queue, doAnimation );
	},
	stop: function( type, clearQueue, gotoEnd ) {
		var stopQueue = function( hooks ) {
			var stop = hooks.stop;
			delete hooks.stop;
			stop( gotoEnd );
		};

		if ( typeof type !== "string" ) {
			gotoEnd = clearQueue;
			clearQueue = type;
			type = undefined;
		}
		if ( clearQueue && type !== false ) {
			this.queue( type || "fx", [] );
		}

		return this.each(function() {
			var dequeue = true,
				index = type != null && type + "queueHooks",
				timers = jQuery.timers,
				data = data_priv.get( this );

			if ( index ) {
				if ( data[ index ] && data[ index ].stop ) {
					stopQueue( data[ index ] );
				}
			} else {
				for ( index in data ) {
					if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
						stopQueue( data[ index ] );
					}
				}
			}

			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && (type == null || timers[ index ].queue === type) ) {
					timers[ index ].anim.stop( gotoEnd );
					dequeue = false;
					timers.splice( index, 1 );
				}
			}

			// Start the next in the queue if the last step wasn't forced.
			// Timers currently will call their complete callbacks, which
			// will dequeue but only if they were gotoEnd.
			if ( dequeue || !gotoEnd ) {
				jQuery.dequeue( this, type );
			}
		});
	},
	finish: function( type ) {
		if ( type !== false ) {
			type = type || "fx";
		}
		return this.each(function() {
			var index,
				data = data_priv.get( this ),
				queue = data[ type + "queue" ],
				hooks = data[ type + "queueHooks" ],
				timers = jQuery.timers,
				length = queue ? queue.length : 0;

			// Enable finishing flag on private data
			data.finish = true;

			// Empty the queue first
			jQuery.queue( this, type, [] );

			if ( hooks && hooks.stop ) {
				hooks.stop.call( this, true );
			}

			// Look for any active animations, and finish them
			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
					timers[ index ].anim.stop( true );
					timers.splice( index, 1 );
				}
			}

			// Look for any animations in the old queue and finish them
			for ( index = 0; index < length; index++ ) {
				if ( queue[ index ] && queue[ index ].finish ) {
					queue[ index ].finish.call( this );
				}
			}

			// Turn off finishing flag
			delete data.finish;
		});
	}
});

jQuery.each([ "toggle", "show", "hide" ], function( i, name ) {
	var cssFn = jQuery.fn[ name ];
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return speed == null || typeof speed === "boolean" ?
			cssFn.apply( this, arguments ) :
			this.animate( genFx( name, true ), speed, easing, callback );
	};
});

// Generate shortcuts for custom animations
jQuery.each({
	slideDown: genFx("show"),
	slideUp: genFx("hide"),
	slideToggle: genFx("toggle"),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" },
	fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return this.animate( props, speed, easing, callback );
	};
});

jQuery.timers = [];
jQuery.fx.tick = function() {
	var timer,
		i = 0,
		timers = jQuery.timers;

	fxNow = jQuery.now();

	for ( ; i < timers.length; i++ ) {
		timer = timers[ i ];
		// Checks the timer has not already been removed
		if ( !timer() && timers[ i ] === timer ) {
			timers.splice( i--, 1 );
		}
	}

	if ( !timers.length ) {
		jQuery.fx.stop();
	}
	fxNow = undefined;
};

jQuery.fx.timer = function( timer ) {
	jQuery.timers.push( timer );
	if ( timer() ) {
		jQuery.fx.start();
	} else {
		jQuery.timers.pop();
	}
};

jQuery.fx.interval = 13;

jQuery.fx.start = function() {
	if ( !timerId ) {
		timerId = setInterval( jQuery.fx.tick, jQuery.fx.interval );
	}
};

jQuery.fx.stop = function() {
	clearInterval( timerId );
	timerId = null;
};

jQuery.fx.speeds = {
	slow: 600,
	fast: 200,
	// Default speed
	_default: 400
};


// Based off of the plugin by Clint Helfers, with permission.
// http://blindsignals.com/index.php/2009/07/jquery-delay/
jQuery.fn.delay = function( time, type ) {
	time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
	type = type || "fx";

	return this.queue( type, function( next, hooks ) {
		var timeout = setTimeout( next, time );
		hooks.stop = function() {
			clearTimeout( timeout );
		};
	});
};


(function() {
	var input = document.createElement( "input" ),
		select = document.createElement( "select" ),
		opt = select.appendChild( document.createElement( "option" ) );

	input.type = "checkbox";

	// Support: iOS<=5.1, Android<=4.2+
	// Default value for a checkbox should be "on"
	support.checkOn = input.value !== "";

	// Support: IE<=11+
	// Must access selectedIndex to make default options select
	support.optSelected = opt.selected;

	// Support: Android<=2.3
	// Options inside disabled selects are incorrectly marked as disabled
	select.disabled = true;
	support.optDisabled = !opt.disabled;

	// Support: IE<=11+
	// An input loses its value after becoming a radio
	input = document.createElement( "input" );
	input.value = "t";
	input.type = "radio";
	support.radioValue = input.value === "t";
})();


var nodeHook, boolHook,
	attrHandle = jQuery.expr.attrHandle;

jQuery.fn.extend({
	attr: function( name, value ) {
		return access( this, jQuery.attr, name, value, arguments.length > 1 );
	},

	removeAttr: function( name ) {
		return this.each(function() {
			jQuery.removeAttr( this, name );
		});
	}
});

jQuery.extend({
	attr: function( elem, name, value ) {
		var hooks, ret,
			nType = elem.nodeType;

		// don't get/set attributes on text, comment and attribute nodes
		if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		// Fallback to prop when attributes are not supported
		if ( typeof elem.getAttribute === strundefined ) {
			return jQuery.prop( elem, name, value );
		}

		// All attributes are lowercase
		// Grab necessary hook if one is defined
		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
			name = name.toLowerCase();
			hooks = jQuery.attrHooks[ name ] ||
				( jQuery.expr.match.bool.test( name ) ? boolHook : nodeHook );
		}

		if ( value !== undefined ) {

			if ( value === null ) {
				jQuery.removeAttr( elem, name );

			} else if ( hooks && "set" in hooks && (ret = hooks.set( elem, value, name )) !== undefined ) {
				return ret;

			} else {
				elem.setAttribute( name, value + "" );
				return value;
			}

		} else if ( hooks && "get" in hooks && (ret = hooks.get( elem, name )) !== null ) {
			return ret;

		} else {
			ret = jQuery.find.attr( elem, name );

			// Non-existent attributes return null, we normalize to undefined
			return ret == null ?
				undefined :
				ret;
		}
	},

	removeAttr: function( elem, value ) {
		var name, propName,
			i = 0,
			attrNames = value && value.match( rnotwhite );

		if ( attrNames && elem.nodeType === 1 ) {
			while ( (name = attrNames[i++]) ) {
				propName = jQuery.propFix[ name ] || name;

				// Boolean attributes get special treatment (#10870)
				if ( jQuery.expr.match.bool.test( name ) ) {
					// Set corresponding property to false
					elem[ propName ] = false;
				}

				elem.removeAttribute( name );
			}
		}
	},

	attrHooks: {
		type: {
			set: function( elem, value ) {
				if ( !support.radioValue && value === "radio" &&
					jQuery.nodeName( elem, "input" ) ) {
					var val = elem.value;
					elem.setAttribute( "type", value );
					if ( val ) {
						elem.value = val;
					}
					return value;
				}
			}
		}
	}
});

// Hooks for boolean attributes
boolHook = {
	set: function( elem, value, name ) {
		if ( value === false ) {
			// Remove boolean attributes when set to false
			jQuery.removeAttr( elem, name );
		} else {
			elem.setAttribute( name, name );
		}
		return name;
	}
};
jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( i, name ) {
	var getter = attrHandle[ name ] || jQuery.find.attr;

	attrHandle[ name ] = function( elem, name, isXML ) {
		var ret, handle;
		if ( !isXML ) {
			// Avoid an infinite loop by temporarily removing this function from the getter
			handle = attrHandle[ name ];
			attrHandle[ name ] = ret;
			ret = getter( elem, name, isXML ) != null ?
				name.toLowerCase() :
				null;
			attrHandle[ name ] = handle;
		}
		return ret;
	};
});




var rfocusable = /^(?:input|select|textarea|button)$/i;

jQuery.fn.extend({
	prop: function( name, value ) {
		return access( this, jQuery.prop, name, value, arguments.length > 1 );
	},

	removeProp: function( name ) {
		return this.each(function() {
			delete this[ jQuery.propFix[ name ] || name ];
		});
	}
});

jQuery.extend({
	propFix: {
		"for": "htmlFor",
		"class": "className"
	},

	prop: function( elem, name, value ) {
		var ret, hooks, notxml,
			nType = elem.nodeType;

		// Don't get/set properties on text, comment and attribute nodes
		if ( !elem || nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		notxml = nType !== 1 || !jQuery.isXMLDoc( elem );

		if ( notxml ) {
			// Fix name and attach hooks
			name = jQuery.propFix[ name ] || name;
			hooks = jQuery.propHooks[ name ];
		}

		if ( value !== undefined ) {
			return hooks && "set" in hooks && (ret = hooks.set( elem, value, name )) !== undefined ?
				ret :
				( elem[ name ] = value );

		} else {
			return hooks && "get" in hooks && (ret = hooks.get( elem, name )) !== null ?
				ret :
				elem[ name ];
		}
	},

	propHooks: {
		tabIndex: {
			get: function( elem ) {
				return elem.hasAttribute( "tabindex" ) || rfocusable.test( elem.nodeName ) || elem.href ?
					elem.tabIndex :
					-1;
			}
		}
	}
});

if ( !support.optSelected ) {
	jQuery.propHooks.selected = {
		get: function( elem ) {
			var parent = elem.parentNode;
			if ( parent && parent.parentNode ) {
				parent.parentNode.selectedIndex;
			}
			return null;
		}
	};
}

jQuery.each([
	"tabIndex",
	"readOnly",
	"maxLength",
	"cellSpacing",
	"cellPadding",
	"rowSpan",
	"colSpan",
	"useMap",
	"frameBorder",
	"contentEditable"
], function() {
	jQuery.propFix[ this.toLowerCase() ] = this;
});




var rclass = /[\t\r\n\f]/g;

jQuery.fn.extend({
	addClass: function( value ) {
		var classes, elem, cur, clazz, j, finalValue,
			proceed = typeof value === "string" && value,
			i = 0,
			len = this.length;

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( j ) {
				jQuery( this ).addClass( value.call( this, j, this.className ) );
			});
		}

		if ( proceed ) {
			// The disjunction here is for better compressibility (see removeClass)
			classes = ( value || "" ).match( rnotwhite ) || [];

			for ( ; i < len; i++ ) {
				elem = this[ i ];
				cur = elem.nodeType === 1 && ( elem.className ?
					( " " + elem.className + " " ).replace( rclass, " " ) :
					" "
				);

				if ( cur ) {
					j = 0;
					while ( (clazz = classes[j++]) ) {
						if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
							cur += clazz + " ";
						}
					}

					// only assign if different to avoid unneeded rendering.
					finalValue = jQuery.trim( cur );
					if ( elem.className !== finalValue ) {
						elem.className = finalValue;
					}
				}
			}
		}

		return this;
	},

	removeClass: function( value ) {
		var classes, elem, cur, clazz, j, finalValue,
			proceed = arguments.length === 0 || typeof value === "string" && value,
			i = 0,
			len = this.length;

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( j ) {
				jQuery( this ).removeClass( value.call( this, j, this.className ) );
			});
		}
		if ( proceed ) {
			classes = ( value || "" ).match( rnotwhite ) || [];

			for ( ; i < len; i++ ) {
				elem = this[ i ];
				// This expression is here for better compressibility (see addClass)
				cur = elem.nodeType === 1 && ( elem.className ?
					( " " + elem.className + " " ).replace( rclass, " " ) :
					""
				);

				if ( cur ) {
					j = 0;
					while ( (clazz = classes[j++]) ) {
						// Remove *all* instances
						while ( cur.indexOf( " " + clazz + " " ) >= 0 ) {
							cur = cur.replace( " " + clazz + " ", " " );
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = value ? jQuery.trim( cur ) : "";
					if ( elem.className !== finalValue ) {
						elem.className = finalValue;
					}
				}
			}
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var type = typeof value;

		if ( typeof stateVal === "boolean" && type === "string" ) {
			return stateVal ? this.addClass( value ) : this.removeClass( value );
		}

		if ( jQuery.isFunction( value ) ) {
			return this.each(function( i ) {
				jQuery( this ).toggleClass( value.call(this, i, this.className, stateVal), stateVal );
			});
		}

		return this.each(function() {
			if ( type === "string" ) {
				// Toggle individual class names
				var className,
					i = 0,
					self = jQuery( this ),
					classNames = value.match( rnotwhite ) || [];

				while ( (className = classNames[ i++ ]) ) {
					// Check each className given, space separated list
					if ( self.hasClass( className ) ) {
						self.removeClass( className );
					} else {
						self.addClass( className );
					}
				}

			// Toggle whole class name
			} else if ( type === strundefined || type === "boolean" ) {
				if ( this.className ) {
					// store className if set
					data_priv.set( this, "__className__", this.className );
				}

				// If the element has a class name or if we're passed `false`,
				// then remove the whole classname (if there was one, the above saved it).
				// Otherwise bring back whatever was previously saved (if anything),
				// falling back to the empty string if nothing was stored.
				this.className = this.className || value === false ? "" : data_priv.get( this, "__className__" ) || "";
			}
		});
	},

	hasClass: function( selector ) {
		var className = " " + selector + " ",
			i = 0,
			l = this.length;
		for ( ; i < l; i++ ) {
			if ( this[i].nodeType === 1 && (" " + this[i].className + " ").replace(rclass, " ").indexOf( className ) >= 0 ) {
				return true;
			}
		}

		return false;
	}
});




var rreturn = /\r/g;

jQuery.fn.extend({
	val: function( value ) {
		var hooks, ret, isFunction,
			elem = this[0];

		if ( !arguments.length ) {
			if ( elem ) {
				hooks = jQuery.valHooks[ elem.type ] || jQuery.valHooks[ elem.nodeName.toLowerCase() ];

				if ( hooks && "get" in hooks && (ret = hooks.get( elem, "value" )) !== undefined ) {
					return ret;
				}

				ret = elem.value;

				return typeof ret === "string" ?
					// Handle most common string cases
					ret.replace(rreturn, "") :
					// Handle cases where value is null/undef or number
					ret == null ? "" : ret;
			}

			return;
		}

		isFunction = jQuery.isFunction( value );

		return this.each(function( i ) {
			var val;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( isFunction ) {
				val = value.call( this, i, jQuery( this ).val() );
			} else {
				val = value;
			}

			// Treat null/undefined as ""; convert numbers to string
			if ( val == null ) {
				val = "";

			} else if ( typeof val === "number" ) {
				val += "";

			} else if ( jQuery.isArray( val ) ) {
				val = jQuery.map( val, function( value ) {
					return value == null ? "" : value + "";
				});
			}

			hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

			// If set returns undefined, fall back to normal setting
			if ( !hooks || !("set" in hooks) || hooks.set( this, val, "value" ) === undefined ) {
				this.value = val;
			}
		});
	}
});

jQuery.extend({
	valHooks: {
		option: {
			get: function( elem ) {
				var val = jQuery.find.attr( elem, "value" );
				return val != null ?
					val :
					// Support: IE10-11+
					// option.text throws exceptions (#14686, #14858)
					jQuery.trim( jQuery.text( elem ) );
			}
		},
		select: {
			get: function( elem ) {
				var value, option,
					options = elem.options,
					index = elem.selectedIndex,
					one = elem.type === "select-one" || index < 0,
					values = one ? null : [],
					max = one ? index + 1 : options.length,
					i = index < 0 ?
						max :
						one ? index : 0;

				// Loop through all the selected options
				for ( ; i < max; i++ ) {
					option = options[ i ];

					// IE6-9 doesn't update selected after form reset (#2551)
					if ( ( option.selected || i === index ) &&
							// Don't return options that are disabled or in a disabled optgroup
							( support.optDisabled ? !option.disabled : option.getAttribute( "disabled" ) === null ) &&
							( !option.parentNode.disabled || !jQuery.nodeName( option.parentNode, "optgroup" ) ) ) {

						// Get the specific value for the option
						value = jQuery( option ).val();

						// We don't need an array for one selects
						if ( one ) {
							return value;
						}

						// Multi-Selects return an array
						values.push( value );
					}
				}

				return values;
			},

			set: function( elem, value ) {
				var optionSet, option,
					options = elem.options,
					values = jQuery.makeArray( value ),
					i = options.length;

				while ( i-- ) {
					option = options[ i ];
					if ( (option.selected = jQuery.inArray( option.value, values ) >= 0) ) {
						optionSet = true;
					}
				}

				// Force browsers to behave consistently when non-matching value is set
				if ( !optionSet ) {
					elem.selectedIndex = -1;
				}
				return values;
			}
		}
	}
});

// Radios and checkboxes getter/setter
jQuery.each([ "radio", "checkbox" ], function() {
	jQuery.valHooks[ this ] = {
		set: function( elem, value ) {
			if ( jQuery.isArray( value ) ) {
				return ( elem.checked = jQuery.inArray( jQuery(elem).val(), value ) >= 0 );
			}
		}
	};
	if ( !support.checkOn ) {
		jQuery.valHooks[ this ].get = function( elem ) {
			return elem.getAttribute("value") === null ? "on" : elem.value;
		};
	}
});




// Return jQuery for attributes-only inclusion


jQuery.each( ("blur focus focusin focusout load resize scroll unload click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup error contextmenu").split(" "), function( i, name ) {

	// Handle event binding
	jQuery.fn[ name ] = function( data, fn ) {
		return arguments.length > 0 ?
			this.on( name, null, data, fn ) :
			this.trigger( name );
	};
});

jQuery.fn.extend({
	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	},

	bind: function( types, data, fn ) {
		return this.on( types, null, data, fn );
	},
	unbind: function( types, fn ) {
		return this.off( types, null, fn );
	},

	delegate: function( selector, types, data, fn ) {
		return this.on( types, selector, data, fn );
	},
	undelegate: function( selector, types, fn ) {
		// ( namespace ) or ( selector, types [, fn] )
		return arguments.length === 1 ? this.off( selector, "**" ) : this.off( types, selector || "**", fn );
	}
});


var nonce = jQuery.now();

var rquery = (/\?/);



// Support: Android 2.3
// Workaround failure to string-cast null input
jQuery.parseJSON = function( data ) {
	return JSON.parse( data + "" );
};


// Cross-browser xml parsing
jQuery.parseXML = function( data ) {
	var xml, tmp;
	if ( !data || typeof data !== "string" ) {
		return null;
	}

	// Support: IE9
	try {
		tmp = new DOMParser();
		xml = tmp.parseFromString( data, "text/xml" );
	} catch ( e ) {
		xml = undefined;
	}

	if ( !xml || xml.getElementsByTagName( "parsererror" ).length ) {
		jQuery.error( "Invalid XML: " + data );
	}
	return xml;
};


var
	rhash = /#.*$/,
	rts = /([?&])_=[^&]*/,
	rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,
	// #7653, #8125, #8152: local protocol detection
	rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
	rnoContent = /^(?:GET|HEAD)$/,
	rprotocol = /^\/\//,
	rurl = /^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
	prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
	transports = {},

	// Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
	allTypes = "*/".concat( "*" ),

	// Document location
	ajaxLocation = window.location.href,

	// Segment location into parts
	ajaxLocParts = rurl.exec( ajaxLocation.toLowerCase() ) || [];

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

	// dataTypeExpression is optional and defaults to "*"
	return function( dataTypeExpression, func ) {

		if ( typeof dataTypeExpression !== "string" ) {
			func = dataTypeExpression;
			dataTypeExpression = "*";
		}

		var dataType,
			i = 0,
			dataTypes = dataTypeExpression.toLowerCase().match( rnotwhite ) || [];

		if ( jQuery.isFunction( func ) ) {
			// For each dataType in the dataTypeExpression
			while ( (dataType = dataTypes[i++]) ) {
				// Prepend if requested
				if ( dataType[0] === "+" ) {
					dataType = dataType.slice( 1 ) || "*";
					(structure[ dataType ] = structure[ dataType ] || []).unshift( func );

				// Otherwise append
				} else {
					(structure[ dataType ] = structure[ dataType ] || []).push( func );
				}
			}
		}
	};
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

	var inspected = {},
		seekingTransport = ( structure === transports );

	function inspect( dataType ) {
		var selected;
		inspected[ dataType ] = true;
		jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
			var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
			if ( typeof dataTypeOrTransport === "string" && !seekingTransport && !inspected[ dataTypeOrTransport ] ) {
				options.dataTypes.unshift( dataTypeOrTransport );
				inspect( dataTypeOrTransport );
				return false;
			} else if ( seekingTransport ) {
				return !( selected = dataTypeOrTransport );
			}
		});
		return selected;
	}

	return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes #9887
function ajaxExtend( target, src ) {
	var key, deep,
		flatOptions = jQuery.ajaxSettings.flatOptions || {};

	for ( key in src ) {
		if ( src[ key ] !== undefined ) {
			( flatOptions[ key ] ? target : ( deep || (deep = {}) ) )[ key ] = src[ key ];
		}
	}
	if ( deep ) {
		jQuery.extend( true, target, deep );
	}

	return target;
}

/* Handles responses to an ajax request:
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {

	var ct, type, finalDataType, firstDataType,
		contents = s.contents,
		dataTypes = s.dataTypes;

	// Remove auto dataType and get content-type in the process
	while ( dataTypes[ 0 ] === "*" ) {
		dataTypes.shift();
		if ( ct === undefined ) {
			ct = s.mimeType || jqXHR.getResponseHeader("Content-Type");
		}
	}

	// Check if we're dealing with a known content-type
	if ( ct ) {
		for ( type in contents ) {
			if ( contents[ type ] && contents[ type ].test( ct ) ) {
				dataTypes.unshift( type );
				break;
			}
		}
	}

	// Check to see if we have a response for the expected dataType
	if ( dataTypes[ 0 ] in responses ) {
		finalDataType = dataTypes[ 0 ];
	} else {
		// Try convertible dataTypes
		for ( type in responses ) {
			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[0] ] ) {
				finalDataType = type;
				break;
			}
			if ( !firstDataType ) {
				firstDataType = type;
			}
		}
		// Or just use first one
		finalDataType = finalDataType || firstDataType;
	}

	// If we found a dataType
	// We add the dataType to the list if needed
	// and return the corresponding response
	if ( finalDataType ) {
		if ( finalDataType !== dataTypes[ 0 ] ) {
			dataTypes.unshift( finalDataType );
		}
		return responses[ finalDataType ];
	}
}

/* Chain conversions given the request and the original response
 * Also sets the responseXXX fields on the jqXHR instance
 */
function ajaxConvert( s, response, jqXHR, isSuccess ) {
	var conv2, current, conv, tmp, prev,
		converters = {},
		// Work with a copy of dataTypes in case we need to modify it for conversion
		dataTypes = s.dataTypes.slice();

	// Create converters map with lowercased keys
	if ( dataTypes[ 1 ] ) {
		for ( conv in s.converters ) {
			converters[ conv.toLowerCase() ] = s.converters[ conv ];
		}
	}

	current = dataTypes.shift();

	// Convert to each sequential dataType
	while ( current ) {

		if ( s.responseFields[ current ] ) {
			jqXHR[ s.responseFields[ current ] ] = response;
		}

		// Apply the dataFilter if provided
		if ( !prev && isSuccess && s.dataFilter ) {
			response = s.dataFilter( response, s.dataType );
		}

		prev = current;
		current = dataTypes.shift();

		if ( current ) {

		// There's only work to do if current dataType is non-auto
			if ( current === "*" ) {

				current = prev;

			// Convert response if prev dataType is non-auto and differs from current
			} else if ( prev !== "*" && prev !== current ) {

				// Seek a direct converter
				conv = converters[ prev + " " + current ] || converters[ "* " + current ];

				// If none found, seek a pair
				if ( !conv ) {
					for ( conv2 in converters ) {

						// If conv2 outputs current
						tmp = conv2.split( " " );
						if ( tmp[ 1 ] === current ) {

							// If prev can be converted to accepted input
							conv = converters[ prev + " " + tmp[ 0 ] ] ||
								converters[ "* " + tmp[ 0 ] ];
							if ( conv ) {
								// Condense equivalence converters
								if ( conv === true ) {
									conv = converters[ conv2 ];

								// Otherwise, insert the intermediate dataType
								} else if ( converters[ conv2 ] !== true ) {
									current = tmp[ 0 ];
									dataTypes.unshift( tmp[ 1 ] );
								}
								break;
							}
						}
					}
				}

				// Apply converter (if not an equivalence)
				if ( conv !== true ) {

					// Unless errors are allowed to bubble, catch and return them
					if ( conv && s[ "throws" ] ) {
						response = conv( response );
					} else {
						try {
							response = conv( response );
						} catch ( e ) {
							return { state: "parsererror", error: conv ? e : "No conversion from " + prev + " to " + current };
						}
					}
				}
			}
		}
	}

	return { state: "success", data: response };
}

jQuery.extend({

	// Counter for holding the number of active queries
	active: 0,

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {},

	ajaxSettings: {
		url: ajaxLocation,
		type: "GET",
		isLocal: rlocalProtocol.test( ajaxLocParts[ 1 ] ),
		global: true,
		processData: true,
		async: true,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",
		/*
		timeout: 0,
		data: null,
		dataType: null,
		username: null,
		password: null,
		cache: null,
		throws: false,
		traditional: false,
		headers: {},
		*/

		accepts: {
			"*": allTypes,
			text: "text/plain",
			html: "text/html",
			xml: "application/xml, text/xml",
			json: "application/json, text/javascript"
		},

		contents: {
			xml: /xml/,
			html: /html/,
			json: /json/
		},

		responseFields: {
			xml: "responseXML",
			text: "responseText",
			json: "responseJSON"
		},

		// Data converters
		// Keys separate source (or catchall "*") and destination types with a single space
		converters: {

			// Convert anything to text
			"* text": String,

			// Text to html (true = no transformation)
			"text html": true,

			// Evaluate text as a json expression
			"text json": jQuery.parseJSON,

			// Parse text as xml
			"text xml": jQuery.parseXML
		},

		// For options that shouldn't be deep extended:
		// you can add your own custom options here if
		// and when you create one that shouldn't be
		// deep extended (see ajaxExtend)
		flatOptions: {
			url: true,
			context: true
		}
	},

	// Creates a full fledged settings object into target
	// with both ajaxSettings and settings fields.
	// If target is omitted, writes into ajaxSettings.
	ajaxSetup: function( target, settings ) {
		return settings ?

			// Building a settings object
			ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

			// Extending ajaxSettings
			ajaxExtend( jQuery.ajaxSettings, target );
	},

	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
	ajaxTransport: addToPrefiltersOrTransports( transports ),

	// Main method
	ajax: function( url, options ) {

		// If url is an object, simulate pre-1.5 signature
		if ( typeof url === "object" ) {
			options = url;
			url = undefined;
		}

		// Force options to be an object
		options = options || {};

		var transport,
			// URL without anti-cache param
			cacheURL,
			// Response headers
			responseHeadersString,
			responseHeaders,
			// timeout handle
			timeoutTimer,
			// Cross-domain detection vars
			parts,
			// To know if global events are to be dispatched
			fireGlobals,
			// Loop variable
			i,
			// Create the final options object
			s = jQuery.ajaxSetup( {}, options ),
			// Callbacks context
			callbackContext = s.context || s,
			// Context for global events is callbackContext if it is a DOM node or jQuery collection
			globalEventContext = s.context && ( callbackContext.nodeType || callbackContext.jquery ) ?
				jQuery( callbackContext ) :
				jQuery.event,
			// Deferreds
			deferred = jQuery.Deferred(),
			completeDeferred = jQuery.Callbacks("once memory"),
			// Status-dependent callbacks
			statusCode = s.statusCode || {},
			// Headers (they are sent all at once)
			requestHeaders = {},
			requestHeadersNames = {},
			// The jqXHR state
			state = 0,
			// Default abort message
			strAbort = "canceled",
			// Fake xhr
			jqXHR = {
				readyState: 0,

				// Builds headers hashtable if needed
				getResponseHeader: function( key ) {
					var match;
					if ( state === 2 ) {
						if ( !responseHeaders ) {
							responseHeaders = {};
							while ( (match = rheaders.exec( responseHeadersString )) ) {
								responseHeaders[ match[1].toLowerCase() ] = match[ 2 ];
							}
						}
						match = responseHeaders[ key.toLowerCase() ];
					}
					return match == null ? null : match;
				},

				// Raw string
				getAllResponseHeaders: function() {
					return state === 2 ? responseHeadersString : null;
				},

				// Caches the header
				setRequestHeader: function( name, value ) {
					var lname = name.toLowerCase();
					if ( !state ) {
						name = requestHeadersNames[ lname ] = requestHeadersNames[ lname ] || name;
						requestHeaders[ name ] = value;
					}
					return this;
				},

				// Overrides response content-type header
				overrideMimeType: function( type ) {
					if ( !state ) {
						s.mimeType = type;
					}
					return this;
				},

				// Status-dependent callbacks
				statusCode: function( map ) {
					var code;
					if ( map ) {
						if ( state < 2 ) {
							for ( code in map ) {
								// Lazy-add the new callback in a way that preserves old ones
								statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
							}
						} else {
							// Execute the appropriate callbacks
							jqXHR.always( map[ jqXHR.status ] );
						}
					}
					return this;
				},

				// Cancel the request
				abort: function( statusText ) {
					var finalText = statusText || strAbort;
					if ( transport ) {
						transport.abort( finalText );
					}
					done( 0, finalText );
					return this;
				}
			};

		// Attach deferreds
		deferred.promise( jqXHR ).complete = completeDeferred.add;
		jqXHR.success = jqXHR.done;
		jqXHR.error = jqXHR.fail;

		// Remove hash character (#7531: and string promotion)
		// Add protocol if not provided (prefilters might expect it)
		// Handle falsy url in the settings object (#10093: consistency with old signature)
		// We also use the url parameter if available
		s.url = ( ( url || s.url || ajaxLocation ) + "" ).replace( rhash, "" )
			.replace( rprotocol, ajaxLocParts[ 1 ] + "//" );

		// Alias method option to type as per ticket #12004
		s.type = options.method || options.type || s.method || s.type;

		// Extract dataTypes list
		s.dataTypes = jQuery.trim( s.dataType || "*" ).toLowerCase().match( rnotwhite ) || [ "" ];

		// A cross-domain request is in order when we have a protocol:host:port mismatch
		if ( s.crossDomain == null ) {
			parts = rurl.exec( s.url.toLowerCase() );
			s.crossDomain = !!( parts &&
				( parts[ 1 ] !== ajaxLocParts[ 1 ] || parts[ 2 ] !== ajaxLocParts[ 2 ] ||
					( parts[ 3 ] || ( parts[ 1 ] === "http:" ? "80" : "443" ) ) !==
						( ajaxLocParts[ 3 ] || ( ajaxLocParts[ 1 ] === "http:" ? "80" : "443" ) ) )
			);
		}

		// Convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Apply prefilters
		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

		// If request was aborted inside a prefilter, stop there
		if ( state === 2 ) {
			return jqXHR;
		}

		// We can fire global events as of now if asked to
		// Don't fire events if jQuery.event is undefined in an AMD-usage scenario (#15118)
		fireGlobals = jQuery.event && s.global;

		// Watch for a new set of requests
		if ( fireGlobals && jQuery.active++ === 0 ) {
			jQuery.event.trigger("ajaxStart");
		}

		// Uppercase the type
		s.type = s.type.toUpperCase();

		// Determine if request has content
		s.hasContent = !rnoContent.test( s.type );

		// Save the URL in case we're toying with the If-Modified-Since
		// and/or If-None-Match header later on
		cacheURL = s.url;

		// More options handling for requests with no content
		if ( !s.hasContent ) {

			// If data is available, append data to url
			if ( s.data ) {
				cacheURL = ( s.url += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data );
				// #9682: remove data so that it's not used in an eventual retry
				delete s.data;
			}

			// Add anti-cache in url if needed
			if ( s.cache === false ) {
				s.url = rts.test( cacheURL ) ?

					// If there is already a '_' parameter, set its value
					cacheURL.replace( rts, "$1_=" + nonce++ ) :

					// Otherwise add one to the end
					cacheURL + ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + nonce++;
			}
		}

		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
		if ( s.ifModified ) {
			if ( jQuery.lastModified[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
			}
			if ( jQuery.etag[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
			}
		}

		// Set the correct header, if data is being sent
		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
			jqXHR.setRequestHeader( "Content-Type", s.contentType );
		}

		// Set the Accepts header for the server, depending on the dataType
		jqXHR.setRequestHeader(
			"Accept",
			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[0] ] ?
				s.accepts[ s.dataTypes[0] ] + ( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
				s.accepts[ "*" ]
		);

		// Check for headers option
		for ( i in s.headers ) {
			jqXHR.setRequestHeader( i, s.headers[ i ] );
		}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend && ( s.beforeSend.call( callbackContext, jqXHR, s ) === false || state === 2 ) ) {
			// Abort if not done already and return
			return jqXHR.abort();
		}

		// Aborting is no longer a cancellation
		strAbort = "abort";

		// Install callbacks on deferreds
		for ( i in { success: 1, error: 1, complete: 1 } ) {
			jqXHR[ i ]( s[ i ] );
		}

		// Get transport
		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

		// If no transport, we auto-abort
		if ( !transport ) {
			done( -1, "No Transport" );
		} else {
			jqXHR.readyState = 1;

			// Send global event
			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
			}
			// Timeout
			if ( s.async && s.timeout > 0 ) {
				timeoutTimer = setTimeout(function() {
					jqXHR.abort("timeout");
				}, s.timeout );
			}

			try {
				state = 1;
				transport.send( requestHeaders, done );
			} catch ( e ) {
				// Propagate exception as error if not done
				if ( state < 2 ) {
					done( -1, e );
				// Simply rethrow otherwise
				} else {
					throw e;
				}
			}
		}

		// Callback for when everything is done
		function done( status, nativeStatusText, responses, headers ) {
			var isSuccess, success, error, response, modified,
				statusText = nativeStatusText;

			// Called once
			if ( state === 2 ) {
				return;
			}

			// State is "done" now
			state = 2;

			// Clear timeout if it exists
			if ( timeoutTimer ) {
				clearTimeout( timeoutTimer );
			}

			// Dereference transport for early garbage collection
			// (no matter how long the jqXHR object will be used)
			transport = undefined;

			// Cache response headers
			responseHeadersString = headers || "";

			// Set readyState
			jqXHR.readyState = status > 0 ? 4 : 0;

			// Determine if successful
			isSuccess = status >= 200 && status < 300 || status === 304;

			// Get response data
			if ( responses ) {
				response = ajaxHandleResponses( s, jqXHR, responses );
			}

			// Convert no matter what (that way responseXXX fields are always set)
			response = ajaxConvert( s, response, jqXHR, isSuccess );

			// If successful, handle type chaining
			if ( isSuccess ) {

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					modified = jqXHR.getResponseHeader("Last-Modified");
					if ( modified ) {
						jQuery.lastModified[ cacheURL ] = modified;
					}
					modified = jqXHR.getResponseHeader("etag");
					if ( modified ) {
						jQuery.etag[ cacheURL ] = modified;
					}
				}

				// if no content
				if ( status === 204 || s.type === "HEAD" ) {
					statusText = "nocontent";

				// if not modified
				} else if ( status === 304 ) {
					statusText = "notmodified";

				// If we have data, let's convert it
				} else {
					statusText = response.state;
					success = response.data;
					error = response.error;
					isSuccess = !error;
				}
			} else {
				// Extract error from statusText and normalize for non-aborts
				error = statusText;
				if ( status || !statusText ) {
					statusText = "error";
					if ( status < 0 ) {
						status = 0;
					}
				}
			}

			// Set data for the fake xhr object
			jqXHR.status = status;
			jqXHR.statusText = ( nativeStatusText || statusText ) + "";

			// Success/Error
			if ( isSuccess ) {
				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
			} else {
				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
			}

			// Status-dependent callbacks
			jqXHR.statusCode( statusCode );
			statusCode = undefined;

			if ( fireGlobals ) {
				globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
					[ jqXHR, s, isSuccess ? success : error ] );
			}

			// Complete
			completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );
				// Handle the global AJAX counter
				if ( !( --jQuery.active ) ) {
					jQuery.event.trigger("ajaxStop");
				}
			}
		}

		return jqXHR;
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get( url, data, callback, "json" );
	},

	getScript: function( url, callback ) {
		return jQuery.get( url, undefined, callback, "script" );
	}
});

jQuery.each( [ "get", "post" ], function( i, method ) {
	jQuery[ method ] = function( url, data, callback, type ) {
		// Shift arguments if data argument was omitted
		if ( jQuery.isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = undefined;
		}

		return jQuery.ajax({
			url: url,
			type: method,
			dataType: type,
			data: data,
			success: callback
		});
	};
});


jQuery._evalUrl = function( url ) {
	return jQuery.ajax({
		url: url,
		type: "GET",
		dataType: "script",
		async: false,
		global: false,
		"throws": true
	});
};


jQuery.fn.extend({
	wrapAll: function( html ) {
		var wrap;

		if ( jQuery.isFunction( html ) ) {
			return this.each(function( i ) {
				jQuery( this ).wrapAll( html.call(this, i) );
			});
		}

		if ( this[ 0 ] ) {

			// The elements to wrap the target around
			wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

			if ( this[ 0 ].parentNode ) {
				wrap.insertBefore( this[ 0 ] );
			}

			wrap.map(function() {
				var elem = this;

				while ( elem.firstElementChild ) {
					elem = elem.firstElementChild;
				}

				return elem;
			}).append( this );
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( jQuery.isFunction( html ) ) {
			return this.each(function( i ) {
				jQuery( this ).wrapInner( html.call(this, i) );
			});
		}

		return this.each(function() {
			var self = jQuery( this ),
				contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		});
	},

	wrap: function( html ) {
		var isFunction = jQuery.isFunction( html );

		return this.each(function( i ) {
			jQuery( this ).wrapAll( isFunction ? html.call(this, i) : html );
		});
	},

	unwrap: function() {
		return this.parent().each(function() {
			if ( !jQuery.nodeName( this, "body" ) ) {
				jQuery( this ).replaceWith( this.childNodes );
			}
		}).end();
	}
});


jQuery.expr.filters.hidden = function( elem ) {
	// Support: Opera <= 12.12
	// Opera reports offsetWidths and offsetHeights less than zero on some elements
	return elem.offsetWidth <= 0 && elem.offsetHeight <= 0;
};
jQuery.expr.filters.visible = function( elem ) {
	return !jQuery.expr.filters.hidden( elem );
};




var r20 = /%20/g,
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
	rsubmittable = /^(?:input|select|textarea|keygen)/i;

function buildParams( prefix, obj, traditional, add ) {
	var name;

	if ( jQuery.isArray( obj ) ) {
		// Serialize array item.
		jQuery.each( obj, function( i, v ) {
			if ( traditional || rbracket.test( prefix ) ) {
				// Treat each array item as a scalar.
				add( prefix, v );

			} else {
				// Item is non-scalar (array or object), encode its numeric index.
				buildParams( prefix + "[" + ( typeof v === "object" ? i : "" ) + "]", v, traditional, add );
			}
		});

	} else if ( !traditional && jQuery.type( obj ) === "object" ) {
		// Serialize object item.
		for ( name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {
		// Serialize scalar item.
		add( prefix, obj );
	}
}

// Serialize an array of form elements or a set of
// key/values into a query string
jQuery.param = function( a, traditional ) {
	var prefix,
		s = [],
		add = function( key, value ) {
			// If value is a function, invoke it and return its value
			value = jQuery.isFunction( value ) ? value() : ( value == null ? "" : value );
			s[ s.length ] = encodeURIComponent( key ) + "=" + encodeURIComponent( value );
		};

	// Set traditional to true for jQuery <= 1.3.2 behavior.
	if ( traditional === undefined ) {
		traditional = jQuery.ajaxSettings && jQuery.ajaxSettings.traditional;
	}

	// If an array was passed in, assume that it is an array of form elements.
	if ( jQuery.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {
		// Serialize the form elements
		jQuery.each( a, function() {
			add( this.name, this.value );
		});

	} else {
		// If traditional, encode the "old" way (the way 1.3.2 or older
		// did it), otherwise encode params recursively.
		for ( prefix in a ) {
			buildParams( prefix, a[ prefix ], traditional, add );
		}
	}

	// Return the resulting serialization
	return s.join( "&" ).replace( r20, "+" );
};

jQuery.fn.extend({
	serialize: function() {
		return jQuery.param( this.serializeArray() );
	},
	serializeArray: function() {
		return this.map(function() {
			// Can add propHook for "elements" to filter or add form elements
			var elements = jQuery.prop( this, "elements" );
			return elements ? jQuery.makeArray( elements ) : this;
		})
		.filter(function() {
			var type = this.type;

			// Use .is( ":disabled" ) so that fieldset[disabled] works
			return this.name && !jQuery( this ).is( ":disabled" ) &&
				rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
				( this.checked || !rcheckableType.test( type ) );
		})
		.map(function( i, elem ) {
			var val = jQuery( this ).val();

			return val == null ?
				null :
				jQuery.isArray( val ) ?
					jQuery.map( val, function( val ) {
						return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
					}) :
					{ name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
		}).get();
	}
});


jQuery.ajaxSettings.xhr = function() {
	try {
		return new XMLHttpRequest();
	} catch( e ) {}
};

var xhrId = 0,
	xhrCallbacks = {},
	xhrSuccessStatus = {
		// file protocol always yields status code 0, assume 200
		0: 200,
		// Support: IE9
		// #1450: sometimes IE returns 1223 when it should be 204
		1223: 204
	},
	xhrSupported = jQuery.ajaxSettings.xhr();

// Support: IE9
// Open requests must be manually aborted on unload (#5280)
// See https://support.microsoft.com/kb/2856746 for more info
if ( window.attachEvent ) {
	window.attachEvent( "onunload", function() {
		for ( var key in xhrCallbacks ) {
			xhrCallbacks[ key ]();
		}
	});
}

support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
support.ajax = xhrSupported = !!xhrSupported;

jQuery.ajaxTransport(function( options ) {
	var callback;

	// Cross domain only allowed if supported through XMLHttpRequest
	if ( support.cors || xhrSupported && !options.crossDomain ) {
		return {
			send: function( headers, complete ) {
				var i,
					xhr = options.xhr(),
					id = ++xhrId;

				xhr.open( options.type, options.url, options.async, options.username, options.password );

				// Apply custom fields if provided
				if ( options.xhrFields ) {
					for ( i in options.xhrFields ) {
						xhr[ i ] = options.xhrFields[ i ];
					}
				}

				// Override mime type if needed
				if ( options.mimeType && xhr.overrideMimeType ) {
					xhr.overrideMimeType( options.mimeType );
				}

				// X-Requested-With header
				// For cross-domain requests, seeing as conditions for a preflight are
				// akin to a jigsaw puzzle, we simply never set it to be sure.
				// (it can always be set on a per-request basis or even using ajaxSetup)
				// For same-domain requests, won't change header if already provided.
				if ( !options.crossDomain && !headers["X-Requested-With"] ) {
					headers["X-Requested-With"] = "XMLHttpRequest";
				}

				// Set headers
				for ( i in headers ) {
					xhr.setRequestHeader( i, headers[ i ] );
				}

				// Callback
				callback = function( type ) {
					return function() {
						if ( callback ) {
							delete xhrCallbacks[ id ];
							callback = xhr.onload = xhr.onerror = null;

							if ( type === "abort" ) {
								xhr.abort();
							} else if ( type === "error" ) {
								complete(
									// file: protocol always yields status 0; see #8605, #14207
									xhr.status,
									xhr.statusText
								);
							} else {
								complete(
									xhrSuccessStatus[ xhr.status ] || xhr.status,
									xhr.statusText,
									// Support: IE9
									// Accessing binary-data responseText throws an exception
									// (#11426)
									typeof xhr.responseText === "string" ? {
										text: xhr.responseText
									} : undefined,
									xhr.getAllResponseHeaders()
								);
							}
						}
					};
				};

				// Listen to events
				xhr.onload = callback();
				xhr.onerror = callback("error");

				// Create the abort callback
				callback = xhrCallbacks[ id ] = callback("abort");

				try {
					// Do send the request (this may raise an exception)
					xhr.send( options.hasContent && options.data || null );
				} catch ( e ) {
					// #14683: Only rethrow if this hasn't been notified as an error yet
					if ( callback ) {
						throw e;
					}
				}
			},

			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
});




// Install script dataType
jQuery.ajaxSetup({
	accepts: {
		script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"
	},
	contents: {
		script: /(?:java|ecma)script/
	},
	converters: {
		"text script": function( text ) {
			jQuery.globalEval( text );
			return text;
		}
	}
});

// Handle cache's special case and crossDomain
jQuery.ajaxPrefilter( "script", function( s ) {
	if ( s.cache === undefined ) {
		s.cache = false;
	}
	if ( s.crossDomain ) {
		s.type = "GET";
	}
});

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function( s ) {
	// This transport only deals with cross domain requests
	if ( s.crossDomain ) {
		var script, callback;
		return {
			send: function( _, complete ) {
				script = jQuery("<script>").prop({
					async: true,
					charset: s.scriptCharset,
					src: s.url
				}).on(
					"load error",
					callback = function( evt ) {
						script.remove();
						callback = null;
						if ( evt ) {
							complete( evt.type === "error" ? 404 : 200, evt.type );
						}
					}
				);
				document.head.appendChild( script[ 0 ] );
			},
			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
});




var oldCallbacks = [],
	rjsonp = /(=)\?(?=&|$)|\?\?/;

// Default jsonp settings
jQuery.ajaxSetup({
	jsonp: "callback",
	jsonpCallback: function() {
		var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce++ ) );
		this[ callback ] = true;
		return callback;
	}
});

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

	var callbackName, overwritten, responseContainer,
		jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
			"url" :
			typeof s.data === "string" && !( s.contentType || "" ).indexOf("application/x-www-form-urlencoded") && rjsonp.test( s.data ) && "data"
		);

	// Handle iff the expected data type is "jsonp" or we have a parameter to set
	if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

		// Get callback name, remembering preexisting value associated with it
		callbackName = s.jsonpCallback = jQuery.isFunction( s.jsonpCallback ) ?
			s.jsonpCallback() :
			s.jsonpCallback;

		// Insert callback into url or form data
		if ( jsonProp ) {
			s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
		} else if ( s.jsonp !== false ) {
			s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
		}

		// Use data converter to retrieve json after script execution
		s.converters["script json"] = function() {
			if ( !responseContainer ) {
				jQuery.error( callbackName + " was not called" );
			}
			return responseContainer[ 0 ];
		};

		// force json dataType
		s.dataTypes[ 0 ] = "json";

		// Install callback
		overwritten = window[ callbackName ];
		window[ callbackName ] = function() {
			responseContainer = arguments;
		};

		// Clean-up function (fires after converters)
		jqXHR.always(function() {
			// Restore preexisting value
			window[ callbackName ] = overwritten;

			// Save back as free
			if ( s[ callbackName ] ) {
				// make sure that re-using the options doesn't screw things around
				s.jsonpCallback = originalSettings.jsonpCallback;

				// save the callback name for future use
				oldCallbacks.push( callbackName );
			}

			// Call if it was a function and we have a response
			if ( responseContainer && jQuery.isFunction( overwritten ) ) {
				overwritten( responseContainer[ 0 ] );
			}

			responseContainer = overwritten = undefined;
		});

		// Delegate to script
		return "script";
	}
});




// data: string of html
// context (optional): If specified, the fragment will be created in this context, defaults to document
// keepScripts (optional): If true, will include scripts passed in the html string
jQuery.parseHTML = function( data, context, keepScripts ) {
	if ( !data || typeof data !== "string" ) {
		return null;
	}
	if ( typeof context === "boolean" ) {
		keepScripts = context;
		context = false;
	}
	context = context || document;

	var parsed = rsingleTag.exec( data ),
		scripts = !keepScripts && [];

	// Single tag
	if ( parsed ) {
		return [ context.createElement( parsed[1] ) ];
	}

	parsed = jQuery.buildFragment( [ data ], context, scripts );

	if ( scripts && scripts.length ) {
		jQuery( scripts ).remove();
	}

	return jQuery.merge( [], parsed.childNodes );
};


// Keep a copy of the old load method
var _load = jQuery.fn.load;

/**
 * Load a url into a page
 */
jQuery.fn.load = function( url, params, callback ) {
	if ( typeof url !== "string" && _load ) {
		return _load.apply( this, arguments );
	}

	var selector, type, response,
		self = this,
		off = url.indexOf(" ");

	if ( off >= 0 ) {
		selector = jQuery.trim( url.slice( off ) );
		url = url.slice( 0, off );
	}

	// If it's a function
	if ( jQuery.isFunction( params ) ) {

		// We assume that it's the callback
		callback = params;
		params = undefined;

	// Otherwise, build a param string
	} else if ( params && typeof params === "object" ) {
		type = "POST";
	}

	// If we have elements to modify, make the request
	if ( self.length > 0 ) {
		jQuery.ajax({
			url: url,

			// if "type" variable is undefined, then "GET" method will be used
			type: type,
			dataType: "html",
			data: params
		}).done(function( responseText ) {

			// Save response for use in complete callback
			response = arguments;

			self.html( selector ?

				// If a selector was specified, locate the right elements in a dummy div
				// Exclude scripts to avoid IE 'Permission Denied' errors
				jQuery("<div>").append( jQuery.parseHTML( responseText ) ).find( selector ) :

				// Otherwise use the full result
				responseText );

		}).complete( callback && function( jqXHR, status ) {
			self.each( callback, response || [ jqXHR.responseText, status, jqXHR ] );
		});
	}

	return this;
};




// Attach a bunch of functions for handling common AJAX events
jQuery.each( [ "ajaxStart", "ajaxStop", "ajaxComplete", "ajaxError", "ajaxSuccess", "ajaxSend" ], function( i, type ) {
	jQuery.fn[ type ] = function( fn ) {
		return this.on( type, fn );
	};
});




jQuery.expr.filters.animated = function( elem ) {
	return jQuery.grep(jQuery.timers, function( fn ) {
		return elem === fn.elem;
	}).length;
};




var docElem = window.document.documentElement;

/**
 * Gets a window from an element
 */
function getWindow( elem ) {
	return jQuery.isWindow( elem ) ? elem : elem.nodeType === 9 && elem.defaultView;
}

jQuery.offset = {
	setOffset: function( elem, options, i ) {
		var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
			position = jQuery.css( elem, "position" ),
			curElem = jQuery( elem ),
			props = {};

		// Set position first, in-case top/left are set even on static elem
		if ( position === "static" ) {
			elem.style.position = "relative";
		}

		curOffset = curElem.offset();
		curCSSTop = jQuery.css( elem, "top" );
		curCSSLeft = jQuery.css( elem, "left" );
		calculatePosition = ( position === "absolute" || position === "fixed" ) &&
			( curCSSTop + curCSSLeft ).indexOf("auto") > -1;

		// Need to be able to calculate position if either
		// top or left is auto and position is either absolute or fixed
		if ( calculatePosition ) {
			curPosition = curElem.position();
			curTop = curPosition.top;
			curLeft = curPosition.left;

		} else {
			curTop = parseFloat( curCSSTop ) || 0;
			curLeft = parseFloat( curCSSLeft ) || 0;
		}

		if ( jQuery.isFunction( options ) ) {
			options = options.call( elem, i, curOffset );
		}

		if ( options.top != null ) {
			props.top = ( options.top - curOffset.top ) + curTop;
		}
		if ( options.left != null ) {
			props.left = ( options.left - curOffset.left ) + curLeft;
		}

		if ( "using" in options ) {
			options.using.call( elem, props );

		} else {
			curElem.css( props );
		}
	}
};

jQuery.fn.extend({
	offset: function( options ) {
		if ( arguments.length ) {
			return options === undefined ?
				this :
				this.each(function( i ) {
					jQuery.offset.setOffset( this, options, i );
				});
		}

		var docElem, win,
			elem = this[ 0 ],
			box = { top: 0, left: 0 },
			doc = elem && elem.ownerDocument;

		if ( !doc ) {
			return;
		}

		docElem = doc.documentElement;

		// Make sure it's not a disconnected DOM node
		if ( !jQuery.contains( docElem, elem ) ) {
			return box;
		}

		// Support: BlackBerry 5, iOS 3 (original iPhone)
		// If we don't have gBCR, just use 0,0 rather than error
		if ( typeof elem.getBoundingClientRect !== strundefined ) {
			box = elem.getBoundingClientRect();
		}
		win = getWindow( doc );
		return {
			top: box.top + win.pageYOffset - docElem.clientTop,
			left: box.left + win.pageXOffset - docElem.clientLeft
		};
	},

	position: function() {
		if ( !this[ 0 ] ) {
			return;
		}

		var offsetParent, offset,
			elem = this[ 0 ],
			parentOffset = { top: 0, left: 0 };

		// Fixed elements are offset from window (parentOffset = {top:0, left: 0}, because it is its only offset parent
		if ( jQuery.css( elem, "position" ) === "fixed" ) {
			// Assume getBoundingClientRect is there when computed position is fixed
			offset = elem.getBoundingClientRect();

		} else {
			// Get *real* offsetParent
			offsetParent = this.offsetParent();

			// Get correct offsets
			offset = this.offset();
			if ( !jQuery.nodeName( offsetParent[ 0 ], "html" ) ) {
				parentOffset = offsetParent.offset();
			}

			// Add offsetParent borders
			parentOffset.top += jQuery.css( offsetParent[ 0 ], "borderTopWidth", true );
			parentOffset.left += jQuery.css( offsetParent[ 0 ], "borderLeftWidth", true );
		}

		// Subtract parent offsets and element margins
		return {
			top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
			left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
		};
	},

	offsetParent: function() {
		return this.map(function() {
			var offsetParent = this.offsetParent || docElem;

			while ( offsetParent && ( !jQuery.nodeName( offsetParent, "html" ) && jQuery.css( offsetParent, "position" ) === "static" ) ) {
				offsetParent = offsetParent.offsetParent;
			}

			return offsetParent || docElem;
		});
	}
});

// Create scrollLeft and scrollTop methods
jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
	var top = "pageYOffset" === prop;

	jQuery.fn[ method ] = function( val ) {
		return access( this, function( elem, method, val ) {
			var win = getWindow( elem );

			if ( val === undefined ) {
				return win ? win[ prop ] : elem[ method ];
			}

			if ( win ) {
				win.scrollTo(
					!top ? val : window.pageXOffset,
					top ? val : window.pageYOffset
				);

			} else {
				elem[ method ] = val;
			}
		}, method, val, arguments.length, null );
	};
});

// Support: Safari<7+, Chrome<37+
// Add the top/left cssHooks using jQuery.fn.position
// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
// Blink bug: https://code.google.com/p/chromium/issues/detail?id=229280
// getComputedStyle returns percent when specified for top/left/bottom/right;
// rather than make the css module depend on the offset module, just check for it here
jQuery.each( [ "top", "left" ], function( i, prop ) {
	jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
		function( elem, computed ) {
			if ( computed ) {
				computed = curCSS( elem, prop );
				// If curCSS returns percentage, fallback to offset
				return rnumnonpx.test( computed ) ?
					jQuery( elem ).position()[ prop ] + "px" :
					computed;
			}
		}
	);
});


// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
	jQuery.each( { padding: "inner" + name, content: type, "": "outer" + name }, function( defaultExtra, funcName ) {
		// Margin is only for outerHeight, outerWidth
		jQuery.fn[ funcName ] = function( margin, value ) {
			var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
				extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

			return access( this, function( elem, type, value ) {
				var doc;

				if ( jQuery.isWindow( elem ) ) {
					// As of 5/8/2012 this will yield incorrect results for Mobile Safari, but there
					// isn't a whole lot we can do. See pull request at this URL for discussion:
					// https://github.com/jquery/jquery/pull/764
					return elem.document.documentElement[ "client" + name ];
				}

				// Get document width or height
				if ( elem.nodeType === 9 ) {
					doc = elem.documentElement;

					// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
					// whichever is greatest
					return Math.max(
						elem.body[ "scroll" + name ], doc[ "scroll" + name ],
						elem.body[ "offset" + name ], doc[ "offset" + name ],
						doc[ "client" + name ]
					);
				}

				return value === undefined ?
					// Get width or height on the element, requesting but not forcing parseFloat
					jQuery.css( elem, type, extra ) :

					// Set width or height on the element
					jQuery.style( elem, type, value, extra );
			}, type, chainable ? margin : undefined, chainable, null );
		};
	});
});


// The number of elements contained in the matched element set
jQuery.fn.size = function() {
	return this.length;
};

jQuery.fn.andSelf = jQuery.fn.addBack;




// Register as a named AMD module, since jQuery can be concatenated with other
// files that may use define, but not via a proper concatenation script that
// understands anonymous AMD modules. A named AMD is safest and most robust
// way to register. Lowercase jquery is used because AMD module names are
// derived from file names, and jQuery is normally delivered in a lowercase
// file name. Do this after creating the global so that if an AMD module wants
// to call noConflict to hide this version of jQuery, it will work.

// Note that for maximum portability, libraries that are not jQuery should
// declare themselves as anonymous modules, and avoid setting a global if an
// AMD loader is present. jQuery is a special case. For more information, see
// https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon

if ( typeof define === "function" && define.amd ) {
	define( "jquery", [], function() {
		return jQuery;
	});
}




var
	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$;

jQuery.noConflict = function( deep ) {
	if ( window.$ === jQuery ) {
		window.$ = _$;
	}

	if ( deep && window.jQuery === jQuery ) {
		window.jQuery = _jQuery;
	}

	return jQuery;
};

// Expose jQuery and $ identifiers, even in AMD
// (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
// and CommonJS for browser emulators (#13566)
if ( typeof noGlobal === strundefined ) {
	window.jQuery = window.$ = jQuery;
}




return jQuery;

}));

},{}],13:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff
var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  if (length > 0 && length <= Buffer.poolSize)
    buf.parent = rootParent

  return buf
}

function SlowBuffer(subject, encoding, noZero) {
  if (!(this instanceof SlowBuffer))
    return new SlowBuffer(subject, encoding, noZero)

  var buf = new Buffer(subject, encoding, noZero)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length, 2)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0

  if (length < 0 || offset < 0 || offset > this.length)
    throw new RangeError('attempt to write outside buffer bounds');

  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length)
    newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100))
    val += this[offset + i] * mul

  return val
}

Buffer.prototype.readUIntBE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100))
    val += this[offset + --byteLength] * mul;

  return val
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readIntLE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100))
    val += this[offset + i] * mul
  mul *= 0x80

  if (val >= mul)
    val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100))
    val += this[offset + --i] * mul
  mul *= 0x80

  if (val >= mul)
    val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100))
    this[offset + i] = (value / mul) >>> 0 & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100))
    this[offset + i] = (value / mul) >>> 0 & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeIntLE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkInt(this,
             value,
             offset,
             byteLength,
             Math.pow(2, 8 * byteLength - 1) - 1,
             -Math.pow(2, 8 * byteLength - 1))
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100))
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkInt(this,
             value,
             offset,
             byteLength,
             Math.pow(2, 8 * byteLength - 1) - 1,
             -Math.pow(2, 8 * byteLength - 1))
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100))
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (target_start >= target.length) target_start = target.length
  if (!target_start) target_start = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || source.length === 0) return 0

  // Fatal error conditions
  if (target_start < 0)
    throw new RangeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z\-]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes(string, units) {
  var codePoint, length = string.length
  var leadSurrogate = null
  units = units || Infinity
  var bytes = []
  var i = 0

  for (; i<length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {

      // last char was a lead
      if (leadSurrogate) {

        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          leadSurrogate = codePoint
          continue
        }

        // valid surrogate pair
        else {
          codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
          leadSurrogate = null
        }
      }

      // no lead yet
      else {

        // unexpected trail
        if (codePoint > 0xDBFF) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // unpaired lead
        else if (i + 1 === length) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        else {
          leadSurrogate = codePoint
          continue
        }
      }
    }

    // valid bmp char, but last char was a lead
    else if (leadSurrogate) {
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
      leadSurrogate = null
    }

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    }
    else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      );
    }
    else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    }
    else if (codePoint < 0x200000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    }
    else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {

    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length, unitSize) {
  if (unitSize) length -= length % unitSize;
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":14,"ieee754":15,"is-array":16}],14:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],15:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],16:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],17:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],18:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],19:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],20:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],21:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":22}],22:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

module.exports = Duplex;

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

forEach(objectKeys(Writable.prototype), function(method) {
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
});

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  process.nextTick(this.end.bind(this));
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

}).call(this,require('_process'))

},{"./_stream_readable":24,"./_stream_writable":26,"_process":20,"core-util-is":27,"inherits":18}],23:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":25,"core-util-is":27,"inherits":18}],24:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;

/*<replacement>*/
if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

var Stream = require('stream');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = false;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // In streams that never have any data, and do push(null) right away,
  // the consumer can miss the 'end' event if they do some I/O before
  // consuming the stream.  So, we don't emit('end') until some reading
  // happens.
  this.calledRead = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (typeof chunk === 'string' && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null || chunk === undefined) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      // update the buffer info.
      state.length += state.objectMode ? 1 : chunk.length;
      if (addToFront) {
        state.buffer.unshift(chunk);
      } else {
        state.reading = false;
        state.buffer.push(chunk);
      }

      if (state.needReadable)
        emitReadable(stream);

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  var state = this._readableState;
  state.calledRead = true;
  var nOrig = n;
  var ret;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    ret = null;

    // In cases where the decoder did not receive enough data
    // to produce a full chunk, then immediately received an
    // EOF, state.buffer will contain [<Buffer >, <Buffer 00 ...>].
    // howMuchToRead will see this and coerce the amount to
    // read to zero (because it's looking at the length of the
    // first <Buffer > in state.buffer), and we'll end up here.
    //
    // This can only happen via state.decoder -- no other venue
    // exists for pushing a zero-length chunk into state.buffer
    // and triggering this behavior. In this case, we return our
    // remaining data and end the stream, if appropriate.
    if (state.length > 0 && state.decoder) {
      ret = fromList(n, state);
      state.length -= ret.length;
    }

    if (state.length === 0)
      endReadable(this);

    return ret;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;

  // if we currently have less than the highWaterMark, then also read some
  if (state.length - n <= state.highWaterMark)
    doRead = true;

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading)
    doRead = false;

  if (doRead) {
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read called its callback synchronously, then `reading`
  // will be false, and we need to re-evaluate how much data we
  // can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we happened to read() exactly the remaining amount in the
  // buffer, and the EOF has been seen at this point, then make sure
  // that we emit 'end' on the very next tick.
  if (state.ended && !state.endEmitted && state.length === 0)
    endReadable(this);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // if we've ended and we have some data left, then emit
  // 'readable' now to make sure it gets picked up.
  if (state.length > 0)
    emitReadable(stream);
  else
    endReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (state.emittedReadable)
    return;

  state.emittedReadable = true;
  if (state.sync)
    process.nextTick(function() {
      emitReadable_(stream);
    });
  else
    emitReadable_(stream);
}

function emitReadable_(stream) {
  stream.emit('readable');
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    process.nextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    if (readable !== src) return;
    cleanup();
  }

  function onend() {
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (!dest._writableState || dest._writableState.needDrain)
      ondrain();
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    unpipe();
    dest.removeListener('error', onerror);
    if (EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];



  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    // the handler that waits for readable events after all
    // the data gets sucked out in flow.
    // This would be easier to follow with a .once() handler
    // in flow(), but that is too slow.
    this.on('readable', pipeOnReadable);

    state.flowing = true;
    process.nextTick(function() {
      flow(src);
    });
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var dest = this;
    var state = src._readableState;
    state.awaitDrain--;
    if (state.awaitDrain === 0)
      flow(src);
  };
}

function flow(src) {
  var state = src._readableState;
  var chunk;
  state.awaitDrain = 0;

  function write(dest, i, list) {
    var written = dest.write(chunk);
    if (false === written) {
      state.awaitDrain++;
    }
  }

  while (state.pipesCount && null !== (chunk = src.read())) {

    if (state.pipesCount === 1)
      write(state.pipes, 0, null);
    else
      forEach(state.pipes, write);

    src.emit('data', chunk);

    // if anyone needs a drain, then we have to wait for that.
    if (state.awaitDrain > 0)
      return;
  }

  // if every destination was unpiped, either before entering this
  // function, or in the while loop, then stop flowing.
  //
  // NB: This is a pretty rare edge case.
  if (state.pipesCount === 0) {
    state.flowing = false;

    // if there were data event listeners added, then switch to old mode.
    if (EE.listenerCount(src, 'data') > 0)
      emitDataEvents(src);
    return;
  }

  // at this point, no one needed a drain, so we just ran out of data
  // on the next readable event, start it over again.
  state.ranOut = true;
}

function pipeOnReadable() {
  if (this._readableState.ranOut) {
    this._readableState.ranOut = false;
    flow(this);
  }
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data' && !this._readableState.flowing)
    emitDataEvents(this);

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        this.read(0);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  emitDataEvents(this);
  this.read(0);
  this.emit('resume');
};

Readable.prototype.pause = function() {
  emitDataEvents(this, true);
  this.emit('pause');
};

function emitDataEvents(stream, startPaused) {
  var state = stream._readableState;

  if (state.flowing) {
    // https://github.com/isaacs/readable-stream/issues/16
    throw new Error('Cannot switch to old mode now.');
  }

  var paused = startPaused || false;
  var readable = false;

  // convert to an old-style stream.
  stream.readable = true;
  stream.pipe = Stream.prototype.pipe;
  stream.on = stream.addListener = Stream.prototype.on;

  stream.on('readable', function() {
    readable = true;

    var c;
    while (!paused && (null !== (c = stream.read())))
      stream.emit('data', c);

    if (c === null) {
      readable = false;
      stream._readableState.needReadable = true;
    }
  });

  stream.pause = function() {
    paused = true;
    this.emit('pause');
  };

  stream.resume = function() {
    paused = false;
    if (readable)
      process.nextTick(function() {
        stream.emit('readable');
      });
    else
      this.read(0);
    this.emit('resume');
  };

  // now make it start, just in case it hadn't already.
  stream.emit('readable');
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    if (state.decoder)
      chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    //if (state.objectMode && util.isNullOrUndefined(chunk))
    if (state.objectMode && (chunk === null || chunk === undefined))
      return;
    else if (!state.objectMode && (!chunk || !chunk.length))
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (typeof stream[i] === 'function' &&
        typeof this[i] === 'undefined') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted && state.calledRead) {
    state.ended = true;
    process.nextTick(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))

},{"_process":20,"buffer":13,"core-util-is":27,"events":17,"inherits":18,"isarray":19,"stream":32,"string_decoder/":33}],25:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  var ts = this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('finish', function() {
    if ('function' === typeof this._flush)
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var rs = stream._readableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":22,"core-util-is":27,"inherits":18}],26:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;

/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Stream = require('stream');

util.inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  process.nextTick(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    process.nextTick(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb))
    ret = writeOrBuffer(this, state, chunk, encoding, cb);

  return ret;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    process.nextTick(function() {
      cb(er);
    });
  else
    cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished && !state.bufferProcessing && state.buffer.length)
      clearBuffer(stream, state);

    if (sync) {
      process.nextTick(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  cb();
  if (finished)
    finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  for (var c = 0; c < state.buffer.length; c++) {
    var entry = state.buffer[c];
    var chunk = entry.chunk;
    var encoding = entry.encoding;
    var cb = entry.callback;
    var len = state.objectMode ? 1 : chunk.length;

    doWrite(stream, state, len, chunk, encoding, cb);

    // if we didn't call the onwrite immediately, then
    // it means that we need to wait until it does.
    // also, that means that the chunk and cb are currently
    // being processed, so move the buffer counter past them.
    if (state.writing) {
      c++;
      break;
    }
  }

  state.bufferProcessing = false;
  if (c < state.buffer.length)
    state.buffer = state.buffer.slice(c);
  else
    state.buffer.length = 0;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (typeof chunk !== 'undefined' && chunk !== null)
    this.write(chunk, encoding);

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    state.finished = true;
    stream.emit('finish');
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      process.nextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

}).call(this,require('_process'))

},{"./_stream_duplex":22,"_process":20,"buffer":13,"core-util-is":27,"inherits":18,"stream":32}],27:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

function isBuffer(arg) {
  return Buffer.isBuffer(arg);
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}
}).call(this,require("buffer").Buffer)

},{"buffer":13}],28:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":23}],29:[function(require,module,exports){
var Stream = require('stream'); // hack to fix a circular dependency issue when used with browserify
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = Stream;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":22,"./lib/_stream_passthrough.js":23,"./lib/_stream_readable.js":24,"./lib/_stream_transform.js":25,"./lib/_stream_writable.js":26,"stream":32}],30:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":25}],31:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":26}],32:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":17,"inherits":18,"readable-stream/duplex.js":21,"readable-stream/passthrough.js":28,"readable-stream/readable.js":29,"readable-stream/transform.js":30,"readable-stream/writable.js":31}],33:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":13}]},{},[1])