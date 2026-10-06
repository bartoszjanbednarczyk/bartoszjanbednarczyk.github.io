var order = ["D", "T", "B", "4", "5"];

$(document).on('change', '.js-logic', function () {
    imply();
    var name = getName();
    setName(name);
    fillTable(name);
});

$(document).on('click', '.js-reset', function () {
    reset();
    setName('');
    fillTable('');
});

$(function () {
    for (let key in implies) {
        implies[key.split(",").sort(sortFrames).toString()] = implies[key];
    }

    for (let key in names) {
        names[key.split(",").sort(sortFrames).toString()] = names[key];
    }
});

function getName() {
    var frames = getFrames().toString();
    var extension = $('input[name=extension]:checked').val();
    if (typeof names[frames] !== 'undefined') {
        if (typeof names[frames][extension] !== 'undefined') {
            return names[frames][extension];
        }
    }
    return '';
}

function fillTable(name) {
    $(".js-local-complex").text("");
    $(".js-global-complex").text("");
    $(".js-local-comment").text("");
    $(".js-global-comment").text("");

    var found = typeof results[name] !== 'undefined';
    if (found) {
        $(".js-local-complex").append(results[name]['local-complex']);
        $(".js-global-complex").append(results[name]['global-complex']);
        $(".js-local-comment").append(results[name]['local-comment']);
        $(".js-global-comment").append(results[name]['global-comment']);
    }
    $(".js-local-complex").attr("data-c", found ? complexityClass(results[name]['local-complex']) : null);
    $(".js-global-complex").attr("data-c", found ? complexityClass(results[name]['global-complex']) : null);
    $(".nv-result").toggleClass("is-empty", !found);
}

function complexityClass(text) {
    var s = String(text).toLowerCase();
    if (s.indexOf('undecidable') > -1) return 'undec';
    if (s.indexOf('tower') > -1) return 'tower';
    if (s.indexOf('nexptime') > -1) return 'nexp';
    if (s.indexOf('exptime') > -1) return 'exp';
    if (s.indexOf('pspace') > -1) return 'ps';
    if (s.indexOf('np') > -1) return 'np';
    return null;
}

function setName(name) {
    $(".logicName").text(name);
}

function reset() {
    $(":checkbox").prop('checked', false);
    $(":radio").prop('checked', false);
}

function imply() {
    var frames = getFrames().toString();
    for(var index in implies) {
        if(frames.match(index)) {
            implies[index].forEach(function (value) {
                $(":checkbox[value=" + value + "]").prop('checked', true);
            });
        }
    }
}

function getFrames() {
    var values = [];
    $('.js-frame-checkbox:checkbox:checked').each(function () {
        values.push($(this).val());
    });
    return values.sort(sortFrames);
}

function sortFrames(a, b) {
    return $.inArray(a, order) - $.inArray(b, order);
}
