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

    if (typeof results[name] !== 'undefined') {
        $(".js-local-complex").append(results[name]['local-complex']);
        $(".js-global-complex").append(results[name]['global-complex']);
        $(".js-local-comment").append(results[name]['local-comment']);
        $(".js-global-comment").append(results[name]['global-comment']);
    }
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
