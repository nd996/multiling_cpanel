// selection.js:294 addRange(): The given range isn't in document.

'use strict';
var dictionary_data;

var memberToHead = new Map(); // stores item to headword mapping
var memberToLevel = new Map(); // stores item to level mapping

var mwuToHead = new Map(); // stores mwu to mwu headword mapping
var mwuToLevel = new Map(); // stores mwu to level mapping

var extendedMemberToHead = new Map();
var extendedMWUToHead = new Map();
var extendedMWUTToLevel = new Map(); // stores item to level mapping

var mappingDataDirty = false

var wf_type = "wf2"
var wf_type_current = ""

var delta_color_map = []

// try {
//     var isFileSaverSupported = !!new Blob();
//     console.log("File saving is supported on the browser");
// } catch (e) {
//     console.log("File saving is not supported on the browser");
// }

function fixIOS() {
    // used to detect os type
    let ua = window.navigator.userAgent.toLowerCase();
    let isIE = !!ua.match(/msie|trident\/7|edge/);
    let isWinPhone = ua.indexOf("windows phone") !== -1;
    let isIOS = !isWinPhone && !!ua.match(/ipad|iphone|ipod/);

    if (isIOS) {
        // iOS adds 3px of (unremovable) padding to the left and right of a textarea, so adjust highlights div to match
        $highlights.css({
            "padding-left": "+=3px",
            "padding-right": "+=3px",
        });
    }
}

function isNewerVersion(oldVer, newVer) {
    const oldParts = oldVer.split(".");
    const newParts = newVer.split(".");
    for (let i = 0; i < newParts.length; i++) {
        const a = ~~newParts[i]; // parse int
        const b = ~~oldParts[i]; // parse int
        if (a > b) return true;
        if (a < b) return false;
    }
    return false;
}

function createHeadWordAndMembersListForDictTab(txtFile, dictList) {
    let rows = txtFile.split(/[\r\n]+/);
    let id = 0;
    rows.forEach(function (row) {
        id += 1;
        if (row != "") {
            //get the items
            let filtered_values = []
            let values = row.split("\t");
            values.forEach(x => {
                // remove all entries of the following type
                if (!x.match(/V.*Z/)) {
                    filtered_values.push(x)
                }
            })
            values = filtered_values

            //get the POS for the headword
            let headword_pos = values[1].split(/_/)[1]

            //remove any tags
            values = values.map((x) => x.replace(/_.+/g, ""));

            //remove any blank entries
            let cleaned_values = [];
            values.forEach(function (value) {
                if (value != "") {
                    cleaned_values.push(value);
                }
            });
            values = cleaned_values
            values = [...new Set(values)];

            // get the rowid
            let rowid = parseInt(values.shift());
            // var rowid = id

            //get the head
            let head = values.shift();

            // get the members
            let members = "";
            if (values.length == 0) {
                members = "";
            } else {
                members = values.join(", ");
            }

            dictList.push([rowid, head, headword_pos, members]);
        }
    });
}

function processExtendedEntries() {

    let word_pattern;
    let languageChoice = $("#languageChoice").val();
    if (languageChoice === 'de' || languageChoice === 'es') {
        word_pattern = XRegExp("^[\\p{L}]+$");
    }
    else {
        word_pattern = XRegExp("^[\\p{L}-]+$");
    }

    let extendedEntries = $("#ignore_list_input").val();
    if (extendedEntries === undefined) {
        extendedEntries = ''
    }
    extendedEntries = extendedEntries.toLowerCase()
    let rows = extendedEntries.split(/[\r\n]+/);
    // reverse the rows for dictionary lists and extended lists (to set member to highest freq headword)
    if ($("#listChoice").val() == "dictionary_lists" || $("#listChoice").val() == "gcse_lists" || $("#listChoice").val() == "edexcel" || $("#listChoice").val() == "aqa" || $("#listChoice").val() == "custom") {
        rows.reverse()
    }

    let inflections_to_remove = getInflectionsToRemove()
    let derivations_to_remove = getDerivationsToRemove()

    // these are notes about the extended list
    // that appear below the stats tables in the profiler interface
    // clear the notes
    $("#list_notes").text("");

    // update the notes
    let list_notes = [];

    // filter rows to include those that only contain entries
    rows.filter(v => v != "").forEach(function (row) {
        // remove extra tabs from end of row
        row = row.replace(/\t+$/)
        // split row into values by colon, comma, or tab
        let values = row.split(/[:,\t]/);
        // trim all whitespace around entried
        values = values.map((x) => x.trim());
        // remove all blank entries (create if tabs are inside entries)
        values = values.filter(function (el) {
            return el != '';
        });

        //get the id (if any)
        let id = null
        if (values[0].match(/^[\d\.]+/) != null) {
            id = values.shift()
        }

        //remove any POS values
        // console.log(values)
        // values = values.map((x) => x.replace(/_.+/g, ""));
        // console.log(values)

        //get headword
        if (values.length == 0) {
            return // eqivalent of continue in a foreach loop
        }
        let headword = values[0].split('_')[0];

        // add values that are not in inflections to remove
        values.forEach(function (value) {
            let [word, postag] = value.split('_')

            if (keep_entry(word, postag, inflections_to_remove) === true && keep_derivation_entry(word, postag, derivations_to_remove) === true) {
                if (memberToHead.has(headword)) {
                    memberToHead.set(word, memberToHead.get(headword));
                    list_notes.push('Added "' + word + '" to chosen list member "' + memberToHead.get(headword) + '"');
                }
                else if (mwuToHead.has(headword)) {
                    mwuToHead.set(word, headword);
                    list_notes.push('Added "' + word + '" to chosen list member "' + mwuToHead.get(headword) + '"');
                } else {
                    // decide which extended list to use
                    // contains mwu

                    if (XRegExp.match(word, word_pattern)) {
                        extendedMemberToHead.set(word, headword);
                    }
                    else {
                        extendedMWUToHead.set(word, headword);
                        extendedMWUTToLevel.set(word, id)
                    }
                }

            }
        });
    });

    $("#list_notes").html(list_notes.join("<br />"));
}

function keep_entry(word, postag, inflections_to_remove) {

    if (word === "") {
        return false
    }

    let checkKeep = true
    if (postag != undefined) {
        inflections_to_remove.every((pos_regex) => {
            let searchPattern = new RegExp('^' + pos_regex);
            if (postag.match(searchPattern) != null) {
                checkKeep = false
                // console.log('REMOVE', word, postag, pos_regex)
                return false
            }
            // console.log('KEEP')
            return true
        })
    }
    return checkKeep
}

function keep_derivation_entry(word, postag, derivations_to_remove) {

    if (word === "") {
        return false
    }

    let checkKeep = true
    if (postag != undefined) {
        derivations_to_remove.every((pos_regex) => {
            let searchPattern = new RegExp('^' + pos_regex);
            if (postag.match(searchPattern) != null) {
                checkKeep = false
                // console.log('REMOVE', word, postag, pos_regex)
                return false
            }
            // console.log('KEEP')
            return true
        })
    }

    // if (word === "incertain") {
    //     console.log(word, checkKeep)
    // }

    return checkKeep
}

function getAllIndexes(arr, val) {
    var indexes = [], i;
    for (i = 0; i < arr.length; i++)
        if (arr[i] === val)
            indexes.push(i);
    return indexes;
}

function process_apostrophe_no_split_words(content_tokens) {
    // aujourd'hui d'accord chat chat

    // all tokens in the following list are counted as one word (and not split)

    // completely ignore for german and spanish
    let languageChoice = $("#languageChoice").val();
    if (languageChoice === 'de' || languageChoice === 'es') {
        return content_tokens
    }

    let apostrophe_words = [
        "aujourd'hui",
        "d'abord",
        "c'est-à-dire",
        "d'ailleurs",
        "d'après",
        "d'accord",
        "quelqu'un",
        "quelques-uns",
        "quelques-unes",
        "d'autant",
        "main-d'œuvre",
        "mains-d'œuvre",
        "main-d'oeuvre",
        "mains-d'oeuvre"
    ]

    let content_tokens_apostrophe_procesed = []
    content_tokens.forEach(token => {
        if (token.includes("'")) {
            let split_word = true
            apostrophe_words.every(apostrophe_word => {
                if (token == apostrophe_word) {
                    split_word = false
                    return false
                }
                return true
            })

            if (split_word == true) {
                const token_parts = token.split(/(')/)
                token_parts.forEach(part => {
                    content_tokens_apostrophe_procesed.push(part)
                })
            }
            else {
                content_tokens_apostrophe_procesed.push(token)
            }

        } else {
            content_tokens_apostrophe_procesed.push(token)
        }
    })
    // console.log(content_tokens_apostrophe_procesed)
    return content_tokens_apostrophe_procesed
}

function process_hyphen_words(content_tokens) {

    // completely ignore for german and spanish
    let languageChoice = $("#languageChoice").val();
    if (languageChoice === 'de' || languageChoice === 'es') {
        return content_tokens
    }

    // all tokens ending in the following string are counted as two words
    let hyphen_words = [
        "-t-il",
        "-t-elle",
        "-t-on",
        "-le",
        "-en",
        "-ce",
        "-ils",
        "-il",
        "-elle",
        "-elles",
        "-je",
        "-on",
        "-nous",
        "-leur",
        "-y",
        "-vous",
        "-m",
        "-lui",
        "-là",
        "-tu",
        "-moi",
        "-toi",
        "-t"
    ]

    let content_tokens_hyphen_processed = []
    content_tokens.forEach(token => {
        if (token == "rendez-vous") {
            content_tokens_hyphen_processed.push(token)
        }
        else if (token.includes("-")) {
            let split_word = false
            let hyphen_word_item = ''
            hyphen_words.every(hyphen_word => {
                if (token.endsWith(hyphen_word)) {
                    split_word = true
                    hyphen_word_item = hyphen_word
                    return false
                }
                return true
            })
            if (split_word) {
                let regexWordPart = XRegExp(`(${hyphen_word_item})`);
                const token_parts = XRegExp.split(token, regexWordPart);

                token_parts.forEach(part => {
                    content_tokens_hyphen_processed.push(part)
                })
            }
            else {
                content_tokens_hyphen_processed.push(token)
            }

        } else {
            content_tokens_hyphen_processed.push(token)
        }
    })

    return content_tokens_hyphen_processed
}

function highlightStandardWordsAndMWUS(mwu_index) {
    let quill_instance = Quill.find(document.getElementById('editor'));
    let totalText = quill_instance.getText().toString();
    let match_pairs = []

    // console.log(totalText)

    // convert to lowercase
    totalText = totalText.toLowerCase()

    // highlight/de-highlight any built in MWU lists

    for (let [mwu, mwu_headword] of mwuToHead) {
        if (mwu == '') {
            return;
        }
        // process dictionary list mwus
        if (mwu_index == '') {
            let match;
            mwu = escapeRegExp(mwu)
            let regexp = XRegExp(`(?<=^|\\P{L})${mwu}(?=\\P{L}|$)`, "gi")
            // var regexp = new RegExp(`\\b${mwu}\\b`, "gi");
            while ((match = regexp.exec(totalText)) != null) {
                var hit_offset_end = regexp.lastIndex;
                var hit_offset_start = hit_offset_end - match[0].length;
                match_pairs.push([hit_offset_start, hit_offset_start + match[0].length])
                // quill_instance.formatText(hit_offset_start, match[0].length, { color: "#000000" });
            }
        } else {
            for (let [mwu, mwu_headword] of mwuToHead) {
                let mwu_level = mwuToLevel.get(mwu_headword)
                // process NCELP list mwus
                let match;
                if (isNewerVersion(mwu_index, mwu_level) == false) {
                    mwu = escapeRegExp(mwu)
                    let regexp = XRegExp(`(?<=^|\\P{L})${mwu}(?=\\P{L}|$)`, "gi")
                    // var regexp = new RegExp(`\\b${mwu}\\b`, "gi");
                    while ((match = regexp.exec(totalText)) != null) {
                        let hit_offset_end = regexp.lastIndex;
                        let hit_offset_start = hit_offset_end - match[0].length;
                        match_pairs.push([hit_offset_start, hit_offset_start + match[0].length])
                        // quill_instance.formatText(hit_offset_start, match[0].length, { color: "#000000" });
                    }
                }

            }
        }
    };


    // highlight/de-highlight any extended MWU lists
    for (var [mwu, value] of extendedMWUToHead.entries()) {
        mwu = escapeRegExp(mwu)
        var regexp = XRegExp(`(?<=^|\\P{L})${mwu}(?=\\P{L}|$)`, "gi")
        // var regexp = new RegExp(`\\b${mwu}\\b`, "gi");
        var match;
        while ((match = regexp.exec(totalText)) != null) {
            // while ((match = regexp.exec(totalText))) {
            var hit_offset_end = regexp.lastIndex;
            var hit_offset_start = hit_offset_end - match[0].length;
            if (mwu_index == '') {
                // console.log(hit_offset_start, match[0].length)
                match_pairs.push([hit_offset_start, hit_offset_start + match[0].length])
                // quill_instance.formatText(hit_offset_start, match[0].length, { color: "#000000" });
            }
            else {
                var mwu_level = extendedMWUTToLevel.get(mwu)
                if (mwu_level == null) {
                    match_pairs.push([hit_offset_start, hit_offset_start + match[0].length])
                    // quill_instance.formatText(hit_offset_start, match[0].length, { color: "#000000" });
                }
                else if (mwu_level != null && isNewerVersion(mwu_index, mwu_level) == false) {
                    match_pairs.push([hit_offset_start, hit_offset_start + match[0].length])
                    // quill_instance.formatText(hit_offset_start, match[0].length, { color: "#000000" });
                }
            }
        }
    }

    return match_pairs
    // quill_instance.setContents(global_delta);
    // quill_instance.setSelection(global_offset, 0);

}

function createProfile(offset, match_pairs) {
    addSpinner($('#addSpinnerWP'))

    // console.log('starting profile...')
    let words_from_list_in_text = 0;
    let words_from_extended_list_in_text = 0;
    let words_in_text = 0;
    let types_in_text = new Set();
    let word_families_from_list_in_text_set = new Set();
    let word_families_from_extended_list_in_text = new Set();
    let word_families_outside_of_lists = new Set();
    let languageChoice = $("#languageChoice").val();
    let regexSplitWords
    let regexWord
    let quill_instance = Quill.find(document.getElementById('editor'));
    let content = quill_instance.getText();
    let Delta = Quill.import("delta");
    let delta = new Delta();
    delta_color_map = []

    if (languageChoice === 'de' || languageChoice === 'es') {
        regexSplitWords = XRegExp("([\\p{L}]+)", "gui");
        regexWord = XRegExp("^[\\p{L}]+$");

    }
    else {
        // regexSplitWords = XRegExp("([\\p{L}-]+)", "gui");
        regexSplitWords = XRegExp("([\\p{L}-']+)", "gui");
        // regexWord = XRegExp("^[\\p{L}-]+$");
        regexWord = XRegExp("^[\\p{L}-']+$");
    }

    // normalize content
    content = content.replace("’", "'")
    let content_tokens = XRegExp.split(content, regexSplitWords);
    // console.log('completed XRegExp.split')

    //apply hyphen nonword exception (ignored for german and spanish)
    content_tokens = process_apostrophe_no_split_words(content_tokens)
    // console.log('completed process_apostrophe_no_split_words')

    let content_tokens_hyphen_processed = process_hyphen_words(content_tokens)
    // console.log('completed process_hyphen_words')

    // console.log('>', content_tokens_hyphen_processed)

    let offset_start = 0
    let offset_end = 0
    content_tokens_hyphen_processed.forEach(function (item, index) {
        offset_start = offset_end
        offset_end = offset_start + item.length
        let is_mwu = false
        match_pairs.forEach(pair => {
            if (offset_start >= pair[0] && offset_end <= pair[1]) {
                // console.log(pair[0], pair[1])
                is_mwu = true
                return false
            }
        })
        // console.log(item, offset_start, offset_end, match_pairs[0][0], match_pairs[0][1], is_mwu)

        // console.log(index + ' ' + item)
        // check for single item apostrophes
        if (item == "'") {
            delta.insert(item);
        }
        // check if item is a word
        else if (regexWord.test(item)) {
            const lowercase_item = item.toLowerCase()
            // record token and type counts
            words_in_text += 1;
            types_in_text.add(lowercase_item);
            //check if word in main list
            if (memberToHead.has(lowercase_item)) {
                words_from_list_in_text += 1;
                word_families_from_list_in_text_set.add(memberToHead.get(lowercase_item));
                delta.insert(item);
            }
            //check if in extended list
            else if (extendedMemberToHead.has(lowercase_item)) {
                words_from_extended_list_in_text += 1;
                word_families_from_extended_list_in_text.add(extendedMemberToHead.get(lowercase_item));
                delta.insert(item);

            } else {
                // word is outside the list
                word_families_outside_of_lists.add(lowercase_item);
                if (is_mwu == true) {
                    delta.insert(item);
                }
                else {
                    delta.insert(item, { color: "#e6851e" });
                    delta_color_map.push([item, "#e6851e"])

                }

            }
        } else {
            // just insert word and do nothing else
            if (is_mwu == true) {
                delta.insert(item);
            }
            else {
                delta.insert(item, { color: "#e6851e" });
            }
        }
    });

    // console.log(delta_color_map)
    // console.log(words_from_list_in_text)

    // create word stats
    let wordDist = $("#wordDist").DataTable();
    let in_percent = (((words_from_list_in_text) / words_in_text) * 100).toFixed(1)
    let ex_percent = (((words_from_extended_list_in_text) / words_in_text) * 100).toFixed(1)
    let tot_percent = (((words_from_list_in_text + words_from_extended_list_in_text) / words_in_text) * 100).toFixed(1)
    let ratio = (types_in_text.size / words_in_text).toFixed(1)

    wordDist.cell({ row: 0, column: 1 }).data(words_from_list_in_text);
    wordDist.cell({ row: 0, column: 2 }).data(in_percent + "%");

    wordDist.cell({ row: 1, column: 1 }).data(words_from_extended_list_in_text);
    wordDist.cell({ row: 1, column: 2 }).data(ex_percent + "%");

    wordDist.cell({ row: 2, column: 1 }).data(words_from_list_in_text + words_from_extended_list_in_text);
    wordDist.cell({ row: 2, column: 2 }).data(tot_percent + "%");

    wordDist.cell({ row: 3, column: 1 }).data(words_in_text);
    wordDist.cell({ row: 4, column: 1 }).data(ratio);


    if (isNaN(in_percent)) {
        wordDist.cell({ row: 0, column: 2 }).data(0 + "%");
    }
    if (isNaN(ex_percent)) {
        wordDist.cell({ row: 1, column: 2 }).data(0 + "%");
    }
    if (isNaN(tot_percent)) {
        wordDist.cell({ row: 2, column: 2 }).data(0 + "%");
    }
    if (isNaN(words_in_text)) {
        wordDist.cell({ row: 3, column: 1 }).data(0);
    }
    if (isNaN(ratio)) {
        wordDist.cell({ row: 4, column: 1 }).data(0);
    }


    // create family stats
    let in_families_size = word_families_from_list_in_text_set.size
    let ex_families_size = word_families_from_extended_list_in_text.size
    let in_ex_families_size = in_families_size + ex_families_size
    let tot_families_size = in_ex_families_size + word_families_outside_of_lists.size;

    let wordFamilyDist = $("#wordFamilyDist").DataTable();
    let in_fam_percent = ((in_families_size / tot_families_size) * 100).toFixed(1)
    let ex_fam_percent = ((ex_families_size / tot_families_size) * 100).toFixed(1)
    let in_ex_fam_percent = ((in_ex_families_size / tot_families_size) * 100).toFixed(1)

    wordFamilyDist.cell({ row: 0, column: 1 }).data(in_families_size);
    wordFamilyDist.cell({ row: 0, column: 2 }).data(in_fam_percent + "%");

    wordFamilyDist.cell({ row: 1, column: 1 }).data(ex_families_size);
    wordFamilyDist.cell({ row: 1, column: 2 }).data(ex_fam_percent + "%");

    wordFamilyDist.cell({ row: 2, column: 1 }).data(in_ex_families_size);
    wordFamilyDist.cell({ row: 2, column: 2 }).data(in_ex_fam_percent + "%");

    wordFamilyDist.cell({ row: 3, column: 1 }).data(tot_families_size);

    if (isNaN(in_fam_percent)) {
        wordFamilyDist.cell({ row: 0, column: 2 }).data(0 + "%");
    }
    if (isNaN(ex_fam_percent)) {
        wordFamilyDist.cell({ row: 1, column: 2 }).data(0 + "%");
    }
    if (isNaN(in_ex_fam_percent)) {
        wordFamilyDist.cell({ row: 2, column: 2 }).data(0 + "%");
    }

    if (document.getElementById('disable_colors').checked == true) {
        // console.log('no colors')
        // console.log(content)
        quill_instance.setText(content);
        quill_instance.setSelection(offset, 0);
        removeSpinner($('#addSpinnerWP'))

    }
    else {
        quill_instance.setContents(delta);
        quill_instance.setSelection(offset, 0);
        removeSpinner($('#addSpinnerWP'))

    }


}

function createWordLevelList(txtFile, inflections_to_remove, derivations_to_remove, level) {
    // let levelList = new Map(); //stores item and color mapping

    let rows = txtFile.split(/[\r\n]+/);

    // reverse the rows for dictionary lists and extended lists (to set member to highest freq headword)
    if ($("#listChoice").val() == "dictionary_lists" || $("#listChoice").val() == "gcse_lists" || $("#listChoice").val() == "edexcel" || $("#listChoice").val() == "aqa" || $("#listChoice").val() == "custom") {
        rows.reverse()
    }
    // console.log('>', memberToHead)
    // console.log('>rows count', rows.length)

    let current_list_choice = $("#listChoice").val()
    // console.log('current_list_choice:', current_list_choice)


    // filter rows to include those that only contain entries
    rows.filter(v => v != "").forEach(function (row) {

        if (current_list_choice === "gcse_lists" || current_list_choice === "edexcel" || current_list_choice === "aqa") {
            // console.log('A')
            let values = row.split("\t");
            //remove id (not included yet)
            values.shift()

            //get headword
            let headword = values[0].split('_')[0];
            // remove colon (currently necessary)
            // headword = headword.replace(/\:$/, '')

            //remove headeword from values (currently necessary)
            values.shift()

            // add values that are not in inflections to remove
            values.forEach(function (value) {

                let [word, postag] = value.split('_')
                memberToHead.set(word, headword);
                memberToLevel.set(word, level);

                // if (keep_entry(word, postag, inflections_to_remove) === true) {
                //     // levelList.set(word, { color: "red", bold: false });
                //     memberToHead.set(word, headword);
                //     memberToLevel.set(word, level);
                // }
            });
        }

        else if (current_list_choice === "dictionary_lists") {
            // console.log('B')
            //split into values (OLD METHOD)
            let values = row.split("\t");

            // remove extra tabs from end of row (NEW METHOD)
            // row = row.replace(/\t+$/)
            // // split row into values by colon, comma, or tab
            // var values = row.split(/[:,\t]/);
            // // trim all whitespace around entry
            // values = values.map((x) => x.trim());
            // // remove all blank entries (create if tabs are inside entries)
            // values = values.filter(function (el) {
            //     return el != '';
            // });

            //remove id (OLD METHOD)
            values.shift()

            //get the id (if any) (NEW METHOD)
            // var id = null
            // if (values[0].match(/^[\d\.]+/) != null) {
            //     var id = values.shift()
            // }

            //get headword
            // values = values.map((x) => x.replace(/_.+/g, ""));
            let headword = values[0].split('_')[0];

            // add values that are not in inflections to remove
            values.forEach(function (value) {
                let [word, postag] = value.split('_')
                if (word === 'entrare' || word === 'entráremos') {
                    console.log(word, postag)
                }
                if (keep_entry(word, postag, inflections_to_remove) === true && keep_derivation_entry(word, postag, derivations_to_remove) === true) {
                    // levelList.set(word, { color: "red", bold: false });
                    memberToHead.set(word, headword);
                    memberToLevel.set(word, level);
                }
            });
        } else {
            // console.log('C')
            let values = row.split("\t");
            values = values.map((x) => x.replace(/[\d\._]/g, ""));
            let headword = values[0];
            values.forEach(function (value) {
                if (value != "") {
                    // levelList.set(value, { color: "red", bold: false });
                    memberToHead.set(value, headword);
                }
            });
        }
    });

    // console.log('>>', memberToHead)
    // console.log('>values count', count)

    // console.log(memberToLevel)
    // console.log('>>', memberToHead.get('national'))
    // console.log(memberToLevel.get('national'))

}

function escapeRegExp(string) {
    string = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    return string
}

function openAccordian(lang) {

    let accordianID
    let dictionaryID

    if (lang == 'fr') {
        accordianID = 'AccordianFrench'
        dictionaryID = '#wordListDictFrench'
    }
    else if (lang == 'de') {
        accordianID = 'AccordianGerman'
        dictionaryID = '#wordListDictGerman'
    }
    else if (lang == 'es') {
        accordianID = 'AccordianSpanish'
        dictionaryID = '#wordListDictSpanish'
    }

    let indicator = document.getElementById(`triangle_state_${lang}`);
    if (indicator.innerText === '▸') {
        indicator.innerText = '▾'
    }
    else {
        indicator.innerText = '▸'
    }

    if (dictionary_data === undefined || wf_type_current != wf_type) {

        addSpinner($('#addSpinnerHere'))

        wf_type_current = wf_type
        // console.log('load dict data')
        let dictionary_list_path
        if (wf_type === "wf2") {
            dictionary_list_path = 'data/dictionary_lists/dictionary_wf2.json'
        }
        else {
            dictionary_list_path = 'data/dictionary_lists/dictionary_wf3.json'
        }

        // console.log('>>>', dictionary_list_path)

        $.get(dictionary_list_path).then(function (data) {
            dictionary_data = data
        })
            .then(function () {

                if (!$.fn.DataTable.isDataTable(dictionaryID)) {
                    // console.log('redefine dict')
                    defineDictTable(dictionaryID, dictionary_data[lang]);
                    showOrHideDictTable(accordianID, dictionaryID)
                }
                else {
                    // console.log('clear and redraw defined')
                    var myTable = $(dictionaryID).DataTable().clear().rows.add(dictionary_data[lang]).draw();
                    showOrHideDictTable(accordianID, dictionaryID)
                }

                removeSpinner($('#addSpinnerHere'))


            })
    }
    else {
        // console.log('use current dict data')
        if (!$.fn.DataTable.isDataTable(dictionaryID)) {
            // console.log('redefine dict')
            defineDictTable(dictionaryID, dictionary_data[lang]);
            showOrHideDictTable(accordianID, dictionaryID)
        }
        else {
            // console.log('clear and redraw defined')
            var myTable = $(dictionaryID).DataTable().clear().rows.add(dictionary_data[lang]).draw();
            showOrHideDictTable(accordianID, dictionaryID)
        }
    }


}

function showOrHideDictTable(id, dictID) {
    let x = document.getElementById(id);
    if (x.className.indexOf("w3-show") == -1) {
        x.className += " w3-show";
    } else {
        x.className = x.className.replace(" w3-show", "");
    }

    let table = $(dictID).DataTable();
    table.columns.adjust().draw();
}

function loadDropDowns(comboBoxID, data, id) {
    $(comboBoxID).empty()
    //to deal with ancient IE problems
    id = typeof id !== "undefined" ? id : 1;
    //
    let count = 0;
    $.each(data, function (key, val) {
        count++;
        $(comboBoxID).append(
            $("<option>", {
                id: count,
                text: key,
                value: val,
            })
        );
    });
    $(comboBoxID)
        .find("option[id='" + id + "']")
        .prop("selected", true);

    // $(comboBoxID).disable("Present": "V.IP.*")

    // to disable particular values
    $('select option:contains("Present")').attr('selected', true).each(function (id, item) {
        if (item.text === "Present") {
            $(item).prop("disabled", true)
        }
    });
}

// function saveProfile() {
//     let colorArray = [
//         ["color_level_1", "#99e699"],
//         ["color_level_2", "#b1d5e5"],
//         ["color_level_3", "#9999ff"],
//         ["color_level_4", "#C0C0C0"],
//     ];
//     colorArray.forEach(function (element) {
//         // console.log(element[0], element[1]);
//         var x = document.getElementsByClassName(element[0]);
//         var i;
//         for (i = 0; i < x.length; i++) {
//             x[i].style.backgroundColor = element[1];
//         }
//     });
//     let contents = document.getElementById("highlighted_text").innerHTML;
//     let filename = "test.html";
//     let pom = document.createElement("a");
//     pom.setAttribute("href", "data:text/html;charset=utf-8," + encodeURIComponent(contents));
//     pom.setAttribute("download", filename);

//     if (document.createEvent) {
//         var event = document.createEvent("MouseEvents");
//         event.initEvent("click", true, true);
//         pom.dispatchEvent(event);
//     } else {
//         pom.click();
//     }
// }

function getPaths() {
    let level_list_paths = []
    let listChoice = $("#listChoice").val();
    let languageChoice = $("#languageChoice").val();
    let levelChoice = $("#levelChoice").val();
    let tierChoice = $("#tierChoice").val();
    let modalityChoice = $("#modalityChoice").val();
    let yearChoice = $("#yearChoice").val();
    let termChoice = $("#termChoice").val();
    let weekChoice = $("#weekChoice").val();

    if (listChoice == "dictionary_lists") {
        level_list_paths = getFrequencyBandPaths(levelChoice, languageChoice)
    }
    else if (listChoice == "gcse_lists") {
        let path_to_file = `data/gcse_lists/${languageChoice}/${tierChoice}.${modalityChoice}.txt`
        level_list_paths.push(path_to_file)
    }
    else if (listChoice == "edexcel") {
        let path_to_file = `data/edexcel_lists/${languageChoice}/${tierChoice}.${modalityChoice}.txt`
        level_list_paths.push(path_to_file)
    }
    else if (listChoice == "aqa") {
        let path_to_file = `data/aqa_lists/${languageChoice}/${tierChoice}.${modalityChoice}.txt`
        level_list_paths.push(path_to_file)
    }
    else if (listChoice == "ncelp_lists_ks3") {
        let path_to_file = `data/ncelp_lists_ks3/${languageChoice}/${languageChoice}.${yearChoice}.${termChoice}.${weekChoice}.txt`
        level_list_paths.push(path_to_file)
    }
    else if (listChoice == "ncelp_lists_ks4") {
        let path_to_file = `data/ncelp_lists_ks4/${languageChoice}/${languageChoice}.${yearChoice}.${termChoice}.${weekChoice}.txt`
        level_list_paths.push(path_to_file)
    }
    else if (listChoice == "custom") {
        let path_to_file = "custom.txt"; // this is a blank file
        level_list_paths.push(path_to_file)
    }

    console.log()

    return level_list_paths;
}

function getMWUPathAndIndex() {
    let level_list_paths = []
    let mwu_index = ''
    let listChoice = $("#listChoice").val();
    let languageChoice = $("#languageChoice").val();
    let levelChoice = $("#levelChoice").val();
    let tierChoice = $("#tierChoice").val();
    let modalityChoice = $("#modalityChoice").val();
    let yearChoice = $("#yearChoice").val();
    let termChoice = $("#termChoice").val();
    let weekChoice = $("#weekChoice").val();

    if (listChoice == "dictionary_lists") {
        level_list_paths = getFrequencyBandPaths(levelChoice, languageChoice)
        level_list_paths.forEach((x, y) => {
            level_list_paths[y] = x.replace(`${languageChoice}/`, `${languageChoice}/mwu_`);
        });
        mwu_index = '';
    }
    else if (listChoice == "gcse_lists") {
        let path_to_file = `data/gcse_lists/${languageChoice}/mwu.${tierChoice}.${modalityChoice}.txt`;
        level_list_paths.push(path_to_file)
        mwu_index = '';
    }
    else if (listChoice == "edexcel") {
        let path_to_file = `data/edexcel_lists/${languageChoice}/mwu.${tierChoice}.${modalityChoice}.txt`;
        level_list_paths.push(path_to_file)
        mwu_index = '';
    }
    else if (listChoice == "aqa") {
        let path_to_file = `data/aqa_lists/${languageChoice}/mwu.${tierChoice}.${modalityChoice}.txt`;
        level_list_paths.push(path_to_file)
        mwu_index = '';
    }
    else if (listChoice == "ncelp_lists_ks3") {
        let path_to_file = `data/ncelp_lists_ks3/${languageChoice}/${languageChoice}.mwu.txt`;
        level_list_paths.push(path_to_file)
        mwu_index = yearChoice + "." + termChoice + "." + weekChoice;
    }
    else if (listChoice == "ncelp_lists_ks4") {
        let path_to_file = `data/ncelp_lists_ks4/${languageChoice}/${languageChoice}.mwu.txt`;
        level_list_paths.push(path_to_file)
        mwu_index = yearChoice + "." + termChoice + "." + weekChoice;
    }

    else if (listChoice == "custom") {
        let path_to_file = "custom.txt"; // this is a blank file
        mwu_index = '';
    }
    return [level_list_paths, mwu_index];
}

function getFrequencyBandPaths(levelChoice, languageChoice) {
    let level_list_paths = []
    let base_path_to_file = `data/dictionary_lists/${languageChoice}/`
    let path_to_file

    if (levelChoice == "dictionary_1000") {
        path_to_file = base_path_to_file + "1-1000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
    }
    else if (levelChoice == "dictionary_2000") {
        path_to_file = base_path_to_file + "1-1000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
        path_to_file = base_path_to_file + "1001-2000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
    }
    else if (levelChoice == "dictionary_3000") {
        path_to_file = base_path_to_file + "1-1000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
        path_to_file = base_path_to_file + "1001-2000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
        path_to_file = base_path_to_file + "2001-3000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
    }
    else if (levelChoice == "dictionary_4000") {
        path_to_file = base_path_to_file + "1-1000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
        path_to_file = base_path_to_file + "1001-2000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
        path_to_file = base_path_to_file + "2001-3000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
        path_to_file = base_path_to_file + "3001-4000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
    }
    else if (levelChoice == "dictionary_5000") {
        path_to_file = base_path_to_file + "1-1000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
        path_to_file = base_path_to_file + "1001-2000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
        path_to_file = base_path_to_file + "2001-3000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
        path_to_file = base_path_to_file + "3001-4000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
        path_to_file = base_path_to_file + "4001-5000_" + languageChoice + ".txt";
        level_list_paths.push(path_to_file)
    }

    return level_list_paths
}

// function map_word_to_headword_and_level(word_to_headword, word_to_freq_band, level_list, freq_band) {
//     var rows = level_list.split(/[\r\n]+/);
//     rows.forEach(function (row) {
//         if (row != "") {
//             var values = row.split("\t");
//             values = values.map((x) => x.replace(/[\d\._]/g, "").toLowerCase());
//             var headword = values[0];
//             values.forEach(function (value) {
//                 if (value != "") {
//                     word_to_headword.set(value, headword);
//                     word_to_freq_band.set(value, freq_band);
//                 }
//             });
//         }
//     });
// }

// function mapMemberToLevel(level) {
//     memberToHead.forEach(member => {
//         memberToLevel.set(member, level);
//     })
// }

function saveProfileStats() {
    let quill_instance = Quill.find(document.getElementById('editor'));
    let content = quill_instance.getText()

    // check that there is something in the text editor
    content = content.toLowerCase()
    if (content == "\n") {
        // console.log("No text has been entered into the profile window.")
        alert("No text has been entered into the profile window."); // or whatever
        return
    }

    let level_list_paths = getPaths()
    let profile_table = {}
    let total_words = 0
    let number_of_levels = level_list_paths.length
    let readme_text = ''
    let save_deffereds = []

    save_deffereds.push($.Deferred())

    // choose the correct readme file
    let chosen_readme_file = ''
    if ($("#listChoice").val() == 'gcse_lists') {
        chosen_readme_file = '/data/readme_gcse.txt'
    }
    else if ($("#listChoice").val() == 'edexcel') {
        chosen_readme_file = '/data/readme_gcse.txt'
    }
    else if ($("#listChoice").val() == 'aqa') {
        chosen_readme_file = '/data/readme_gcse.txt'
    }
    else {
        chosen_readme_file = '/data/readme.txt'
    }
    $.get(chosen_readme_file, function (data) {
        readme_text = data
        save_deffereds[0].resolve()
    })


    $.when(...save_deffereds
    ).then(function () {

        let regexSplitWords
        let regexWord

        let languageChoice = $("#languageChoice").val();
        if (languageChoice === 'de' || languageChoice === 'es') {
            regexSplitWords = XRegExp("([\\p{L}]+)", "gui");
            regexWord = XRegExp("^[\\p{L}]+$");

        }
        else {
            // regexSplitWords = XRegExp("([\\p{L}-]+)", "gui");
            regexSplitWords = XRegExp("([\\p{L}-']+)", "gui");
            regexWord = XRegExp("^[\\p{L}-]+$");

        }

        let content_tokens = XRegExp.split(content, regexSplitWords);

        //apply hyphen nonword exception (ignored for german)
        content_tokens = process_apostrophe_no_split_words(content_tokens)
        let content_tokens_hyphen_processed = process_hyphen_words(content_tokens)
        let notInListMemberToHead = new Map()

        content_tokens_hyphen_processed.forEach(function (item, index) {
            // check for not single item apostrophes and word
            if (item != "'" && regexWord.test(item)) {
                // create headword entry
                if (typeof memberToHead.get(item) != 'undefined') {

                    let headword = memberToHead.get(item)
                    let freq_band = memberToLevel.get(item)

                    if (profile_table.hasOwnProperty(headword)) {
                        profile_table[headword]['freq'] += 1
                        if (profile_table[headword]['family_members'].hasOwnProperty(item)) {
                            profile_table[headword]['family_members'][item] += 1
                        }
                        else {
                            profile_table[headword]['family_members'][item] = 1
                        }
                    }
                    else {
                        profile_table[headword] = {
                            'headword': headword,
                            'freq': 1,
                            'freq_band': freq_band + 1,
                            'family_members': {}
                        }
                        profile_table[headword]['family_members'][item] = 1

                    }
                }
                else if (typeof extendedMemberToHead.get(item) != 'undefined') {
                    let headword = extendedMemberToHead.get(item)
                    if (profile_table.hasOwnProperty(headword)) {
                        profile_table[headword]['freq'] += 1
                        if (profile_table[headword]['family_members'].hasOwnProperty(item)) {
                            profile_table[headword]['family_members'][item] += 1
                        }
                        else {
                            profile_table[headword]['family_members'][item] = 1
                        }
                    }
                    else {
                        profile_table[headword] = {
                            'headword': headword,
                            'freq': 1,
                            'freq_band': number_of_levels + 1,
                            'family_members': {}
                        }
                        profile_table[headword]['family_members'][item] = 1

                    }
                }
                else if (typeof notInListMemberToHead.get(item) != 'undefined') {
                    let headword = notInListMemberToHead.get(item)
                    if (profile_table.hasOwnProperty(headword)) {
                        profile_table[headword]['freq'] += 1
                        if (profile_table[headword]['family_members'].hasOwnProperty(item)) {
                            profile_table[headword]['family_members'][item] += 1
                        }
                        else {
                            profile_table[headword]['family_members'][item] = 1
                        }
                    }
                    else {
                        profile_table[headword] = {
                            'headword': headword,
                            'freq': 1,
                            'freq_band': number_of_levels + 1,
                            'family_members': {}
                        }
                        profile_table[headword]['family_members'][item] = 1

                    }
                }
                else {
                    notInListMemberToHead.set(item, item)
                    profile_table[item] = {
                        'headword': item,
                        'freq': 1,
                        'freq_band': number_of_levels + 1,
                        'family_members': {}
                    }
                    profile_table[item]['family_members'][item] = 1
                }
                total_words += 1
            }
        });

        // create family keys
        let percent_breakdown = {}
        // var word_band_percent = new Map()
        // var family_band_percent = new Map()

        // initialize the map
        for (const headword in profile_table) {
            let freq_band = profile_table[headword]['freq_band']
            let word_freq = profile_table[headword]['freq']

            if (percent_breakdown.hasOwnProperty(freq_band)) {
                percent_breakdown[freq_band]['word_count'] += word_freq
                percent_breakdown[freq_band]['family_count'] += 1
            }
            else {
                percent_breakdown[freq_band] = {}
                if (freq_band === -1) {
                    // percent_breakdown[freq_band]['freq_band'] = 0
                    // percent_breakdown[freq_band]['freq_band'] = `> ${ number_of_levels }`
                    percent_breakdown[freq_band]['freq_band'] = number_of_levels + 1
                }
                else {
                    percent_breakdown[freq_band]['freq_band'] = freq_band
                }
                percent_breakdown[freq_band]['word_count'] = word_freq
                percent_breakdown[freq_band]['family_count'] = 1
            }

        }
        // calculate stats
        let total_family_members = Object.keys(profile_table).length
        for (let freq_band in percent_breakdown) {
            percent_breakdown[freq_band]['word_count_percent'] = parseFloat((percent_breakdown[freq_band]['word_count'] / total_words).toFixed(3))
            percent_breakdown[freq_band]['family_count_percent'] = parseFloat((percent_breakdown[freq_band]['family_count'] / total_family_members).toFixed(3))
        }
        let percent_breakdown_csv = "\uFEFF" + convert_to_csv(percent_breakdown, false)

        for (var headword in profile_table) {
            let family_members = profile_table[headword]['family_members']
            let new_entry = []
            for (let [key, value] of Object.entries(family_members)) {
                new_entry.push(`${key}(${value})`)
            }
            new_entry = new_entry.sort()
            new_entry = new_entry.join(', ')
            profile_table[headword]['family_members'] = new_entry
        }

        let profile_table_csv = "\uFEFF" + convert_to_csv(profile_table)

        //calcuate mwu stats
        let mwu_table = {}

        // check inbuilt mwu
        for (let [mwu, mwu_headword] of mwuToHead) {
            let mwu_level = mwuToLevel.get(mwu_headword)
            if (mwu === '' || mwu === undefined) {
                continue
            }
            mwu = escapeRegExp(mwu)
            let regexp = XRegExp(`(?<=^|\\P{L})${mwu}(?=\\P{L}|$)`, "gi")
            // var regexp = new RegExp(`\\b${mwu}\\b`, "gi");
            // regexp = new RegExp(mwu, "gi");
            // let mwu_count = 0
            while (regexp.exec(content) != null) {
                if (mwu_table.hasOwnProperty(mwu_headword)) {
                    mwu_table[mwu_headword]['freq'] += 1
                    if (mwu_table[mwu_headword]['members'].has(mwu)) {
                        mwu_table[mwu_headword]['members'].set(mwu, mwu_table[mwu_headword]['members'].get(mwu) + 1)
                    }
                    else {
                        mwu_table[mwu_headword]['members'].set(mwu, 1)
                    }
                }
                else {
                    mwu_table[mwu_headword] = {
                        headword: mwu_headword,
                        source: 'inbuilt',
                        level: mwu_level + 1,
                        freq: 1,
                        members: new Map()
                    }
                    mwu_table[mwu_headword]['members'].set(mwu, 1)

                }
            }
        }

        // check extended mwu
        for (let [mwu, mwu_headword] of extendedMWUToHead) {
            let mwu_level = mwuToLevel.get(mwu_headword)
            if (mwu === '' || mwu === undefined) {
                continue
            }
            mwu = escapeRegExp(mwu)
            let regexp = XRegExp(`(?<=^|\\P{L})${mwu}(?=\\P{L}|$)`, "gi")
            // var regexp = new RegExp(`\\b${mwu}\\b`, "gi");
            // regexp = new RegExp(mwu, "gi");
            // let mwu_count = 0
            while (regexp.exec(content) != null) {
                if (mwu_table.hasOwnProperty(mwu_headword)) {
                    mwu_table[mwu_headword]['freq'] += 1
                    if (mwu_table[mwu_headword]['members'].has(mwu)) {
                        mwu_table[mwu_headword]['members'].set(mwu, mwu_table[mwu_headword]['members'].get(mwu) + 1)
                    }
                    else {
                        mwu_table[mwu_headword]['members'].set(mwu, 1)
                    }
                }
                else {
                    mwu_table[mwu_headword] = {
                        headword: mwu_headword,
                        source: 'extended',
                        level: mwu_level + 1,
                        freq: 1,
                        members: new Map()
                    }
                    mwu_table[mwu_headword]['members'].set(mwu, 1)

                }
            }
        }

        var output_array = Object.values(mwu_table);
        output_array.forEach(value => {
            let breakdown = []
            value.members.forEach((freq, mwu) => breakdown.push(`${mwu} (${freq})`));
            value.members = breakdown.join(' ')
        })
        let mwu_table_csv = "\uFEFF" + convert_to_csv(output_array)

        let zip = new JSZip();
        zip.file("word_family_statistics.csv", profile_table_csv);
        zip.file("coverage_statistics.csv", percent_breakdown_csv);
        zip.file("mwu_statistics.csv", mwu_table_csv);
        zip.file("readme.txt", readme_text);
        zip.generateAsync({ type: "blob" })
            .then(function (content) {
                // see FileSaver.js
                saveAs(content, "word_family_data.zip");
            });
    })

}

function compare(a, b) {
    if (a.freq_band < b.freq_band) {
        return -1;
    }
    if (a.freq_band > b.freq_band) {
        return 1;
    }
    return 0;
}

function convert_to_csv(json_data, sort = true) {
    if (json_data.length === 0) {
        return ''
    }

    let number_of_levels = getPaths().length

    let output_array = Object.values(json_data);
    output_array = output_array.sort(compare)
    output_array.forEach(value => {

        if ($("#listChoice").val() == 'gcse_lists' || $("#listChoice").val() == 'edexcel' || $("#listChoice").val() == 'aqa') {
            if (value.freq_band === number_of_levels + 1) {
                value.freq_band = 'N'
            }
            else {
                value.freq_band = 'Y'
            }
        }
        else {
            if (value.freq_band === number_of_levels + 1) {
                value.freq_band = `> ${number_of_levels}`
            }
        }
    })

    // export profile to csv
    // var output_array = []
    // var keys = Object.keys(json_data)
    // if (sort === true) {
    //     keys = keys.sort()
    // }
    // keys.forEach((key, index) => {
    //     // console.log(key, json_data[key])
    //     output_array.push(json_data[key])
    // })

    let items = output_array
    let replacer = (key, value) => value === null ? '' : value // specify how you want to handle null values here
    let header = Object.keys(items[0])
    let csv_header = header.map((x) => x.replace(/^freq$/, "number of occurrences"));

    if ($("#listChoice").val() == 'gcse_lists' || $("#listChoice").val() == 'edexcel' || $("#listChoice").val() == 'aqa') {
        csv_header = csv_header.map((x) => x.replace(/^freq_band$/, "on list"));
    }
    else {
        csv_header = csv_header.map((x) => x.replace(/^freq_band$/, "frequency band"));
    }

    csv_header = csv_header.map((x) => x.replace(/^family_members$/, "family members (occurrences)"));
    csv_header = csv_header.map((x) => x.replace(/^word_count$/, "word count"));
    csv_header = csv_header.map((x) => x.replace(/^family_count$/, "family count"));
    csv_header = csv_header.map((x) => x.replace(/^word_count_percent$/, "word count (%)"));
    csv_header = csv_header.map((x) => x.replace(/^family_count_percent$/, "family count (%)"));

    let csv = [
        csv_header.join(','), // header row first
        ...items.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
    ].join('\r\n')
    return csv
}

// function copyToClip(str) {
//     let quill_instance = Quill.find(document.getElementById('editor'));
//     var offset = getOffset();
//     quill_instance.setSelection(0, quill_instance.getLength());
//     document.execCommand("copy");
//     quill_instance.setSelection(offset, 0);
// }

// function setupSearches(tableName) {
//     $(tableName + " tfoot th").each(function () {
//         var title = $(this).text();
//         $(this).html('<input type="text" placeholder="Search ' + "" + '" />');
//     });

//     let table = $(tableName).DataTable();
//     // Apply the search
//     table.columns().every(function () {
//         var that = this;
//         $("input", this.footer()).on("keyup change", function () {
//             if (that.search() !== this.value) {
//                 that.search(this.value).draw();
//             }
//         });
//     });
// }

function showTopBottom(templateName) {
    $.get(
        "templates/".concat(templateName, ".html"),
        function (source) {
            let template = Handlebars.compile(source);
            let html = template();
            $("#".concat(templateName)).html(html);
        },
        "html"
    );
}

function openTab(tab) {
    $(".tablink").each(function () {
        //to fix stupid IE bugs
        $(this).removeClass("w3-orange");
        $(this).addClass("w3-white");
    });
    //to fix stupid IE bugs
    tab.removeClass("w3-white");
    tab.addClass("w3-orange");

    //get the name of the tool
    let toolName = tab.attr("id").slice(3);
    showTool(toolName);
    // gtag("event", "open_tab", {
    //     tabName: toolName,
    // });
}

function defineDictTable(tableName, mydata) {
    let tempTable = $(tableName).DataTable({
        pagingType: "simple",
        pageLength: 5,
        lengthChange: false,
        drawCallback: function (settings) {
            if ($(this).find("tbody tr").length <= 0) {
                $("#Atable_paginate").hide();
            }
        },
        paging: true,
        lengthMenu: [[1], [1]],
        data: mydata,
        "columnDefs": [
            // { "width": "10px", "targets": 0 },
            // { "width": "40px", "targets": 1 },
            // { "width": "40px", "targets": 2 },
            { "width": "100%", "targets": 3 },
        ],
        // fixedHeader: {
        //     header: false,
        //     footer: false,
        // },
        // columnDefs: [{ targets: [0], width: 100 }],
        // fixedColumns: false
    });
    // setupSearches(tableName);
    return tempTable;
}

function showTool(toolName) {
    let template_html
    $.get(
        "templates/".concat(toolName, ".html"),
        function (source) {
            let template = Handlebars.compile(source);
            template_html = template();
        },
        "html"
    ).then(function () {
        if (toolName === "Home") {
            $("#Tool").html(template_html);
            setupHomeTool()
        }

        else if (toolName === "WordProfiler") {
            $("#Tool").html(template_html);
            setupProfilerTool()
        }

        else if (toolName === "Dictionaries") {
            $("#Tool").html(template_html);
            setupDictTool()
        }
        else {
            $("#Tool").html(template_html);
            setupDictTool()
        }

        // to make sure the page shows from the top
        document.body.scrollTop = 0; // For Safari
        document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    });

}

function getDeferreds(level_list_paths, mwu_level_list_paths, inflections_to_remove, derivations_to_remove) {
    // console.log('getDeferreds')
    // create the defers
    let deferreds = []
    let file_count = 0

    level_list_paths.forEach(function (level_list_path, level) {
        file_count += 1
        deferreds.push($.Deferred())
        $.get(level_list_path).fail(function () {
            // console.log('failed to get the file')
            // console.log("A list does not exist for these settings.")
            alert("A list does not exist for these settings."); // or whatever
        }).then(function (data) {
            // console.log('success to get the file',)
            data = data.toLowerCase()
            createWordLevelList(data, inflections_to_remove, derivations_to_remove, level);
            deferreds[level].resolve()
        })
    })

    mwu_level_list_paths.forEach(function (mwu_level_list_path, level) {
        deferreds.push($.Deferred())
        $.get(mwu_level_list_path, function (data) {

            //convert to lowercase
            data = data.toLowerCase()

            let rows = data.split(/[\r\n]+/);
            rows.forEach(row => {
                if (row != "") {

                    //split into values
                    let values = row.split("\t");

                    //remove id
                    let id = values.shift()

                    // remove POS information
                    // values = values.map((x) => x.replace(/_.+/g, ""));

                    //get headword
                    let headword = values[0].split('_')[0];

                    // add values that are not in inflections to remove
                    values.forEach(function (value) {
                        let [word, postag] = value.split('_')
                        if (keep_entry(word, postag, inflections_to_remove) === true && keep_derivation_entry(word, postag, derivations_to_remove) === true) {
                            mwuToHead.set(word, headword);
                            if ($("#listChoice").val() === 'ncelp_lists_ks3' || $("#listChoice").val() === 'ncelp_lists_ks4') {
                                mwuToLevel.set(value, id);
                            }
                            else {
                                mwuToLevel.set(value, level);
                            }
                        }
                    });

                    // values.forEach(function (value) {
                    //     if (value != '') {
                    //         mwuToHead.set(value, headword);

                    //         // this is used to deal with stupid format differences
                    //         if ($("#listChoice").val() === 'ncelp') {
                    //             mwuToLevel.set(value, id);
                    //         }
                    //         else {
                    //             mwuToLevel.set(value, level);
                    //         }

                    //     }
                    // })



                }
            })
            deferreds[file_count + level].resolve()
        })
    })
    return deferreds
}

// function updateHighlight(checked, words, color, index) {
// if (checked === true) {
// handleInput(words, color, index, checked);
// }
// else {
// handleInput(words, 'color_level_0', index, checked);
// }
// }

// function CopyClipboard() {
//     // creating new textarea element and giveing it id 't'
//     let t = document.createElement("textarea");
//     t.id = "t";
//     // Optional step to make less noise in the page, if any!
//     t.style.height = 0;
//     // You have to append it to your page somewhere, I chose <body>
//     document.body.appendChild(t);
//     // Copy whatever is in your div to our new textarea
//     t.value = document.getElementById("highlighted_text").innerHTML;
//     // Now copy whatever inside the textarea to clipboard
//     let selector = document.querySelector("#t");
//     selector.select();
//     document.execCommand("copy");
//     // Remove the textarea
//     document.body.removeChild(t);

//     // console.log(t.value);
// }



///////////////////////////////////////////////////////////
// wordprofiler functions

function sidebar_toggle() {
    if ($("#ignore_list").css("display") == "none") {
        $('#ignore_list').css("width", "30%")
        $('#paste_area').css("width", "70%")
        $('#ignore_list').show(300)
        $('#openNav').html('Hide <span class="extended_list_label">Extended</span> List <img class="popup_extend" src="images/help-icon-11-16.png" width="16px" height="16px" alt="Add To List help"></span>')
    } else {
        $('#paste_area').css("width", "100%")
        $('#ignore_list').hide()
        $('#openNav').html('Add To List <img class="popup_extend" src="images/help-icon-11-16.png" width="16px" height="16px" alt="Add To List help"></span>')
    }
}

function sidebar_open() {
    $('#ignore_list').css("width", "30%")
    $('#paste_area').css("width", "70%")
    $('#ignore_list').show(300)
    $('#openNav').html('Hide <span class="extended_list_label">Extended</span> List <img class="popup_extend" src="images/help-icon-11-16.png" width="16px" height="16px" alt="Add To List help"></span>')
}

function getOffset() {
    let quill_instance = Quill.find(document.getElementById('editor'));
    let range = quill_instance.getSelection();
    let offset = 0
    if (range) {
        offset = range.index;
    } else {
        offset = 0;
    }
    return offset;
}

function setGAProfileEvent() {
    gtag("event", "create_profile", {
        languageChoice: $("#languageChoice").val(),
        listType: $("#listChoice").val(),
        listValues:
            $("#languageChoice").val() +
            "_" +
            $("#listChoice").val() +
            "_" +
            $("#yearChoice").val() +
            "_" +
            $("#termChoice").val() +
            "_" +
            $("#weekChoice").val(),
    });
}

function setComboBoxOptions(recreate_infChoose = true, recreate_devChoose = true, init = true) {

    const file_tree_path = 'data/file_tree.json';
    let file_tree_data;

    let current_list_type = $("#listChoice").val();
    let current_lang = $("#languageChoice").val();
    let current_level = $("#levelChoice").val();
    let current_year = $("#yearChoice").val()
    let current_term = $("#termChoice").val()
    let current_week = $("#weekChoice").val()
    let current_tier = $("#tierChoice").val()
    let current_modality = $("#modalityChoice").val()

    // console.log(current_list_type)
    // console.log(current_lang)
    // console.log(current_level)
    // console.log(current_year)
    // console.log(current_term)
    // console.log(current_week)
    // console.log(current_modality)

    $.get(file_tree_path).then(function (data) {
        file_tree_data = data
    }).then(function () {

        if (current_list_type === null) {
            current_list_type = 'dictionary_lists'
        }


        if (current_lang === null) {
            current_lang = 'fr'
        }


        if (current_level === null) {
            current_level = 'dictionary_1000'
        }


        if (current_year === null) {
            current_year = '7'
        }

        if (current_term === null) {
            current_term = '1.1'
        }

        if (current_week === null) {
            current_week = '1'
        }


        let current_list_type_list = file_tree_data.children.find((mylist) => mylist.name == current_list_type);
        let current_lists = []

        let languages = {}
        let language_names = []
        let names = []

        if (current_list_type_list === undefined) {
            language_names = ["fr", "de", "es"]
        }
        else {
            current_list_type_list.children.forEach(function (list, index, arr) {
                if (list.name.includes('mwu')) {
                    return
                }
                language_names.push(list.name)
            })
            current_lists = current_list_type_list.children.find((mylist) => mylist.name == current_lang);

            current_lists.children.forEach(function (list, index, arr) {
                if (list.name.includes('mwu')) {
                    return
                }
                names.push(list.name)
            })
            names = names.sort()
        }

        language_names = language_names.sort()

        language_names.forEach(function (name, index, arr) {
            if (name === 'fr') {
                Object.assign(languages, { French: "fr" })
            }
            if (name === 'de') {
                Object.assign(languages, { German: "de" })
            }
            if (name === 'es') {
                Object.assign(languages, { Spanish: "es" })
            }
        })
        loadDropDowns("#languageChoice", languages);
        if (language_names.includes(current_lang)) {
            $("#languageChoice").val(current_lang)
        }
        else {
            $("#languageChoice").val(language_names[0])
        }
        current_lang = $("#languageChoice").val()



        // set level
        if (current_list_type == 'dictionary_lists') {
            let levels = {}
            let level_names = []

            names.forEach(function (name, index, arr) {
                if (name.includes('1-1000')) {
                    Object.assign(levels, { "Top 1000 words": "dictionary_1000" })
                }
                if (name.includes('1001-2000')) {
                    Object.assign(levels, { "Top 2000 words": "dictionary_2000" })
                }
                if (name.includes('2001-3000')) {
                    Object.assign(levels, { "Top 3000 words": "dictionary_3000" })
                }
                if (name.includes('3001-4000')) {
                    Object.assign(levels, { "Top 4000 words": "dictionary_4000" })
                }
                if (name.includes('4001-5000')) {
                    Object.assign(levels, { "Top 5000 words": "dictionary_5000" })
                }
            })
            loadDropDowns("#levelChoice", levels);

            // console.log(current_level)
            // console.log(level_names)

            // if (level_names.includes(current_level)) {
            //     $("#levelChoice").val(current_level)
            // }
            // else {
            //     $("#levelChoice").val(level_names[0])
            // }

            $("#levelChoice").val(current_level)
            current_level = $("#levelChoice").val()

        }

        // set year, term, week
        else if (current_list_type == 'ncelp_lists_ks3' || current_list_type == 'ncelp_lists_ks4') {
            let years = {}
            let terms = {}
            let weeks = {}

            let year_names = []
            let term_names = []
            let week_names = []

            names.forEach(function (name) {
                let values = name.split('.')

                // years
                if (values[1] != undefined) {
                    Object.assign(years, { [`Year ${values[1]}`]: values[1] })
                    year_names.push(values[1])
                }

                // terms
                if (values[2] != undefined && values[3] != undefined) {
                    Object.assign(terms, { [`Term ${values[2]}.${values[3]}`]: `${values[2]}.${values[3]}` })
                    term_names.push(`${values[2]}.${values[3]}`)
                }

                // weeks
                if (values[4] != undefined) {
                    if (current_list_type == 'ncelp_lists_ks4') {
                        Object.assign(weeks, { [`Week ${values[4]}(${values[5]})`]: `${values[4]}.${values[5]}` })
                        week_names.push(`${values[4]}.${values[5]}`)
                    }
                    else {
                        Object.assign(weeks, { [`Week ${values[4]}`]: values[4] })
                        week_names.push(values[4])
                    }
                }
            })

            loadDropDowns("#yearChoice", years);
            loadDropDowns("#termChoice", terms);
            loadDropDowns("#weekChoice", weeks);

            if (year_names.includes(current_year)) {
                $("#yearChoice").val(current_year)
            }
            else {
                $("#yearChoice").val(year_names[0])
            }

            if (term_names.includes(current_term)) {
                $("#termChoice").val(current_term)
            }
            else {
                $("#termChoice").val(term_names[0])
            }

            if (week_names.includes(current_week)) {
                $("#weekChoice").val(current_week)
            }
            else {
                $("#weekChoice").val(week_names[0])
            }

            current_year = $("#yearChoice").val()
            current_term = $("#termChoice").val()
            current_week = $("#weekChoice").val()

        }


        // set tier, modality
        else if (current_list_type.includes('gcse')) {

            let tiers = {}
            let tier_names = []

            let modalities = {}
            let modality_names = []

            names.forEach(function (name, index, arr) {
                let values = name.split('.')
                if (values[0] != undefined) {
                    if (values[0] === 'f') {
                        Object.assign(tiers, { "Foundation": values[0] })
                    }
                    else {
                        Object.assign(tiers, { "Higher": values[0] })
                    }
                    tier_names.push(values[0])

                    if (values[1] === 'l') {
                        Object.assign(modalities, { "Listening": values[1] })
                    }
                    else {
                        Object.assign(modalities, { "Reading": values[1] })
                    }
                    modality_names.push(values[1])
                }
            })

            loadDropDowns("#tierChoice", tiers);
            loadDropDowns("#modalityChoice", modalities);

            if (tier_names.includes(current_tier)) {
                $("#tierChoice").val(current_tier)
            }
            else {
                $("#tierChoice").val(tier_names[0])
            }

            if (modality_names.includes(current_modality)) {
                $("#modalityChoice").val(current_modality)
            }
            else {
                $("#modalityChoice").val(modality_names[0])
            }

            current_tier = $("#tierChoice").val()
            current_modality = $("#modalityChoice").val()
        }

        // define inflections
        let fr_inflections = {
            "Present": "V.IP.*",
            "Imperfect": "V.II.*",
            "Past historic": "V.IS.*",
            "Inflectional future": "V.IF.*",
            "Past participle": "V.P.*",
            "Conditional": "V.IC.*",
            "Present subjunctive": "V.SP.*",
            "Imperfect subjunctive": "V.SI.*",
            "Present participle": "V.G.*",
            "Imperative": "V.M.*"
        }
        let de_inflections = {
            "Present": "V.IP.*",
            "Simple past": "V.IS.*",
            "Past participle": "V.P.*",
            "Present participle ": "d_V.P.*",
            "Genitive nouns": "N.G.*",
            "Imperative": "V.M.*",
            "Subjunctive": "V.SP.*||V.SS.*||VA0.*"
            // "Present subjunctive": "V.SP.*, VA0.*",
            // "Imperfect subjunctive": "V.SS.*, VA0.*"
        }
        let es_inflections = {
            "Present": "V.IP.*",
            "Preterite": "V.IS.*",
            "Imperfect": "V.II.*",
            "Inflectional future": "V.IF.*",
            "Conditional": "V.IC.*",
            "Present subjunctive": "V.SP.*",
            "Imperfect subjunctive": "V.SI.*",
            "Future subjunctive": "V.SF.*",
            "Present participle": "V.G.*",
            "Past participle": "V.P.*",
            "Imperative": "V.M.*",
            "Verbs with two pronoun suffixes (see FAQ)": "V.*ZZ",
        }

        // define derivations
        var fr_derivations = {
            "in-/im- (+adj, +adv, +n)": "DM1",
            "-(e)able (adj⇄v)": "DM2",
            "-(at)ion (v⇄n)": "DM3",
            "-ment, -amment, -emment (adj⇄adv)": "DM4",
            "ordinal numbers": "DM5",
            "-(at)eur (v⇄n)": "DM6"
            // "-ième (+num)": "DMIEME0",
        }
        var de_derivations = {
            "un- (adj⇄adj)": "DM1",
            " Haupt- (n⇄n)": "DM2",
            "Lieblings- (n⇄n)": "DM3",
            "-ung (v⇄n)": "DM4",
            "-er (v⇄n)": "DM5",
            "ordinal numbers": "DM6",
            "-heit (adj/adv⇄n)": "DM7",
            "-keit (adj/adv⇄n)": "DM8",
            "-los (n⇄adj)": "DM9",
            "-chen (n⇄n)": "DM0",
            "-lein (n⇄n)": "DMA"
        }

        var es_derivations = {
            "-(a)mente (adj⇄adv)": "DM1",
            "-idad (adj⇄n)": "DM2",
            "-ísimo (adj⇄adj)": "DM3",
            "-able (v⇄adj)": "DM4",
            "-ito (n⇄n)": "DM5"
        }

        // set inflections
        if (recreate_infChoose === true) {
            if (current_lang == 'fr') {
                loadDropDowns("#infChoose", fr_inflections);
            }
            else if (current_lang == 'de') {
                loadDropDowns("#infChoose", de_inflections);
            }
            else if (current_lang == 'es') {
                loadDropDowns("#infChoose", es_inflections);
            }
            let infSelectBox = new vanillaSelectBox("#infChoose", {
                "disableSelectAll": true,
                "maxHeight": 500,
                "search": false,
                "translations": { "all": "All forms selected", "items": "forms", "selectAll": "[Select All]", "clearAll": "Clear All" }
            });

            infSelectBox.setValue('all')
        }

        // set derivations
        if (recreate_devChoose === true) {
            if (current_lang == 'fr') {
                loadDropDowns("#devChoose", fr_derivations);
            }
            else if (current_lang == 'de') {
                loadDropDowns("#devChoose", de_derivations);
            }
            else if (current_lang == 'es') {
                loadDropDowns("#devChoose", es_derivations);
            }
            let devSelectBox = new vanillaSelectBox("#devChoose", {
                "placeHolder": "No forms selected",
                "useReverse": true,
                "disableSelectAll": false,
                "maxHeight": 500,
                "search": false,
                "translations": { "all": "All forms selected", "items": "feature", "selectAll": "[Select All]", "clearAll": "[Clear All]" }
            });

            devSelectBox.setValue('none')
        }
    }).then(function () {
        if (init === true) {
            // set the default list
            let default_list = "dictionary_lists"
            // var default_list = "gcse_lists"
            // var default_list = "ncelp_lists_ks3"
            $("#listChoice").val(default_list);
            showHideListTypeOptions(default_list);

            // inititate profiler
            let level_list_paths = getPaths()
            let [mwu_level_list_paths, mwu_index] = getMWUPathAndIndex()

            $(".selector").change(function (obj) {
                optionsChanged()
            });

            $("#create").click(function () {
                loadFilesAndCreateProfile(false)
            });

            document.getElementById("infChoose").addEventListener("change", function (e) {
                mappingDataDirty = true
                // optionsChanged(false, false)
            });

            document.getElementById("devChoose").addEventListener("change", function (e) {
                // console.log('devChoose changed')
                mappingDataDirty = true
                // optionsChanged(false)
            });

            document.getElementById("ignore_list_input").addEventListener("input", function (e) {
                // console.log('ignore_list_input changed')
                mappingDataDirty = true
            });

            if ($("#listChoice").val() != undefined) {
                mappingDataDirty = true
                loadFilesAndCreateProfile(false)
            }
        }
        else {
            // if (recreate_inf_choose_options === true) {
            //     recreateInfChoose()
            // }
            // recreateDevChoose()

            loadFilesAndCreateProfile(true)

            let languageChoice = $("#languageChoice").val();
            if (languageChoice === 'fr') {
                $('#other_notes').html()
            }

            setGrammarTooltips()
            setDerivedFormsTooltips()

        }

    })


    // dictionary_lists => listChoice, languageChoice, levelChoice, infChoose, devChoose
    // gcse_lists => listChoice, languageChoice, tierChoice, modalityChoice
    // ncelp_lists_ks3 => listChoice, languageChoice, yearChoice, termChoice, weekChoice
    // ncelp_lists_ks4 => listChoice, languageChoice, yearChoice, termChoice, weekChoice
    // custom => listChoice, languageChoice, infChoose

    // let listType = $("#listChoice").val();
    // let current_lang = $("#languageChoice").val()
    // let current_level = $("#levelChoice").val()
    // let current_year = $("#yearChoice").val()
    // let current_term = $("#termChoice").val()
    // let current_week = $("#weekChoice").val()
    // let current_tier = $("#tierChoice").val()
    // let current_modality = $("#modalityChoice").val()

    // // define language
    // let languages = {
    //     French: "fr",
    //     German: "de",
    //     Spanish: "es",
    // };

    // let languages_ks4 = {
    //     French: "fr",
    //     German: "de",
    // };

    // // define level
    // let frequency_lists = {
    //     "Top 1000 words": "dictionary_1000",
    //     "Top 2000 words": "dictionary_2000",
    //     "Top 3000 words": "dictionary_3000",
    //     "Top 4000 words": "dictionary_4000",
    //     "Top 5000 words": "dictionary_5000",
    // }


    // // define tier
    // let tier_f = {
    //     "Foundation": "f",
    // }

    // let tier_fh = {
    //     "Foundation": "f",
    //     "Higher": "h",
    // }

    // // define modality
    // let modality_l = {
    //     "Listening": "l",
    // }

    // let modality_r = {
    //     "Reading": "r",
    // }

    // let modality = {
    //     "Listening": "l",
    //     "Reading": "r",
    // }

    // // define year
    // let years_7_to_9 = {
    //     "Year 7": "7",
    //     "Year 8": "8",
    //     "Year 9": "9",
    // };

    // let years_10 = {
    //     "Year 10": "10",
    //     "Year 11": "11",
    // };


    // let years_10_to_11 = {
    //     "Year 10": "10",
    //     "Year 11": "11",
    // };

    // // define term
    // let terms = {
    //     "Term 1.1": "1.1",
    //     "Term 1.2": "1.2",
    //     "Term 2.1": "2.1",
    //     "Term 2.2": "2.2",
    //     "Term 3.1": "3.1",
    //     "Term 3.2": "3.2",
    // };

    // let terms_ks4_fr = {
    //     "Term 1.1": "1.1",
    //     "Term 1.2": "1.2",
    // };

    // let terms_ks4_de = {
    //     "Term 1.1": "1.1",
    //     "Term 1.2": "1.2",
    //     "Term 2.1": "2.1",
    //     "Term 2.2": "2.2",
    //     "Term 3.1": "3.1",
    // };

    // let terms_ks4_es = {
    // };


    // // define week
    // let weeks_5 = {
    //     "Week 1": "1",
    //     "Week 2": "2",
    //     "Week 3": "3",
    //     "Week 4": "4",
    //     "Week 5": "5",
    // }

    // let weeks_6 = {
    //     "Week 1": "1",
    //     "Week 2": "2",
    //     "Week 3": "3",
    //     "Week 4": "4",
    //     "Week 5": "5",
    //     "Week 6": "6",
    // }

    // let weeks_7 = {
    //     "Week 1": "1",
    //     "Week 2": "2",
    //     "Week 3": "3",
    //     "Week 4": "4",
    //     "Week 5": "5",
    //     "Week 6": "6",
    //     "Week 7": "7",
    // }

    // let weeks_fh_2 = {
    //     "Week 1(F)": "1.F",
    //     "Week 1(H)": "1.H",
    //     "Week 2(F)": "2.F",
    //     "Week 2(H)": "2.H",
    // };

    // let weeks_fh_5 = {
    //     "Week 1(F)": "1.F",
    //     "Week 1(H)": "1.H",
    //     "Week 2(F)": "2.F",
    //     "Week 2(H)": "2.H",
    //     "Week 3(F)": "3.F",
    //     "Week 3(H)": "3.H",
    //     "Week 4(F)": "4.F",
    //     "Week 4(H)": "4.H",
    //     "Week 5(F)": "5.F",
    //     "Week 5(H)": "5.H",
    // };

    // let weeks_fh_6 = {
    //     "Week 1(F)": "1.F",
    //     "Week 1(H)": "1.H",
    //     "Week 2(F)": "2.F",
    //     "Week 2(H)": "2.H",
    //     "Week 3(F)": "3.F",
    //     "Week 3(H)": "3.H",
    //     "Week 4(F)": "4.F",
    //     "Week 4(H)": "4.H",
    //     "Week 5(F)": "5.F",
    //     "Week 5(H)": "5.H",
    //     "Week 6(F)": "6.F",
    //     "Week 6(H)": "6.H",

    // };


    // let weeks_fh_7 = {
    //     "Week 1(F)": "1.F",
    //     "Week 1(H)": "1.H",
    //     "Week 2(F)": "2.F",
    //     "Week 2(H)": "2.H",
    //     "Week 3(F)": "3.F",
    //     "Week 3(H)": "3.H",
    //     "Week 4(F)": "4.F",
    //     "Week 4(H)": "4.H",
    //     "Week 5(F)": "5.F",
    //     "Week 5(H)": "5.H",
    //     "Week 6(F)": "6.F",
    //     "Week 6(H)": "6.H",
    //     "Week 7(F)": "7.F",
    //     "Week 7(H)": "7.H",
    // };

    // // set language
    // $('#languageChoice').empty();
    // if (listType == 'ncelp_lists_ks4') {
    //     loadDropDowns("#languageChoice", languages_ks4);
    // }
    // else {
    //     loadDropDowns("#languageChoice", languages);
    // }

    // $("#languageChoice option").each(function () {
    //     if ($(this).val() == current_lang) {
    //         $("#languageChoice").val(current_lang);
    //         return false;
    //     }
    // });
    // current_lang = $("#languageChoice").val()

    // // set level
    // loadDropDowns("#levelChoice", frequency_lists);

    // $("#levelChoice option").each(function () {
    //     if ($(this).val() == current_level) {
    //         $("#levelChoice").val(current_level);
    //         return false;
    //     }
    // });
    // current_level = $("#levelChoice").val()


    // // set tier
    // if (current_lang == 'fr') {
    //     loadDropDowns("#tierChoice", tier_fh);
    //     loadDropDowns("#modalityChoice", modality);
    // }
    // else if (current_lang == 'de') {
    //     loadDropDowns("#tierChoice", tier_fh);
    //     loadDropDowns("#modalityChoice", modality);
    // }
    // else if (current_lang == 'es') {
    //     loadDropDowns("#tierChoice", tier_fh);
    //     loadDropDowns("#modalityChoice", modality);
    // }
    // $("#tierChoice option").each(function () {
    //     if ($(this).val() == current_tier) {
    //         $("#tierChoice").val(current_tier);
    //         return false;
    //     }
    // });
    // current_tier = $("#tierChoice").val()

    // // set modality
    // if (current_lang == 'fr') {
    //     loadDropDowns("#modalityChoice", modality);
    // }
    // else if (current_lang == 'de') {
    //     loadDropDowns("#modalityChoice", modality);
    // }
    // else if (current_lang == 'es') {
    //     loadDropDowns("#modalityChoice", modality);
    // }
    // $("#modalityChoice option").each(function () {
    //     if ($(this).val() == current_modality) {
    //         $("#modalityChoice").val(current_modality);
    //         return false;
    //     }
    // });
    // current_modality = $("#modalityChoice").val()

    // // sets year
    // if (listType == 'ncelp_lists_ks3') {
    //     loadDropDowns("#yearChoice", years_7_to_9);
    // }
    // else {
    //     loadDropDowns("#yearChoice", years_10_to_11);
    // }

    // $("#yearChoice option").each(function () {
    //     if ($(this).val() == current_year) {
    //         $("#yearChoice").val(current_year);
    //         return false;
    //     }
    // });
    // current_year = $("#yearChoice").val()

    // // set term
    // if (listType == 'ncelp_lists_ks3') {
    //     loadDropDowns("#termChoice", terms);
    // }
    // else {
    //     loadDropDowns("#yearChoice", years_10_to_11);
    //     if (current_lang == 'de') {
    //         loadDropDowns("#termChoice", terms_ks4_de);
    //     }
    //     else if (current_lang == 'es') {
    //         loadDropDowns("#termChoice", terms_ks4_es);
    //     }
    //     else if (current_lang == 'fr') {
    //         loadDropDowns("#termChoice", terms_ks4_fr);
    //     }
    // }

    // $("#termChoice option").each(function () {
    //     if ($(this).val() == current_term) {
    //         $("#termChoice").val(current_term);
    //         return false;
    //     }
    // });
    // current_term = $("#termChoice").val()

    // // set week
    // if (current_year == '10') {
    //     if (current_lang == 'de') {

    //         if (current_term == '1.1' || current_term == '1.2') {
    //             loadDropDowns("#weekChoice", weeks_fh_7);
    //         }

    //         else if (current_term == '2.1') {
    //             loadDropDowns("#weekChoice", weeks_fh_6);
    //         }
    //         else if (current_term == '2.2') {
    //             loadDropDowns("#weekChoice", weeks_fh_5);
    //         }
    //         else if (current_term == '3.1') {
    //             loadDropDowns("#weekChoice", weeks_fh_2);
    //         }

    //     }
    //     else if (current_lang == 'es') {
    //         loadDropDowns("#weekChoice", weeks_fh_7);
    //     }
    //     else if (current_lang == 'fr') {
    //         loadDropDowns("#weekChoice", weeks_fh_7);
    //     }
    // }
    // else if (current_term == '1.1' || current_term == '1.2') {
    //     loadDropDowns("#weekChoice", weeks_7);
    // }
    // else if (current_term == '2.1') {
    //     loadDropDowns("#weekChoice", weeks_6);
    // }
    // else if (current_term == '2.2') {
    //     loadDropDowns("#weekChoice", weeks_5);
    // }
    // else if (current_term == '3.1') {
    //     loadDropDowns("#weekChoice", weeks_6);
    // }
    // else if (current_term == '3.2') {
    //     loadDropDowns("#weekChoice", weeks_7);
    // }

    // // 
    // $("#weekChoice option").each(function () {
    //     if ($(this).val() == current_week) {
    //         $("#weekChoice").val(current_week);
    //         return false;
    //     }
    // });
    // current_week = $("#weekChoice").val()

    // // set inflections
    // if (recreate_infChoose === true) {
    //     if (current_lang == 'fr') {
    //         loadDropDowns("#infChoose", fr_inflections);
    //     }
    //     else if (current_lang == 'de') {
    //         loadDropDowns("#infChoose", de_inflections);
    //     }
    //     else if (current_lang == 'es') {
    //         loadDropDowns("#infChoose", es_inflections);
    //     }
    //     let infSelectBox = new vanillaSelectBox("#infChoose", {
    //         "disableSelectAll": true,
    //         "maxHeight": 500,
    //         "search": false,
    //         "translations": { "all": "All forms selected", "items": "forms", "selectAll": "[Select All]", "clearAll": "Clear All" }
    //     });

    //     infSelectBox.setValue('all')
    // }

    // // set derivations
    // if (recreate_devChoose === true) {
    //     if (current_lang == 'fr') {
    //         loadDropDowns("#devChoose", fr_derivations);
    //     }
    //     else if (current_lang == 'de') {
    //         loadDropDowns("#devChoose", de_derivations);
    //     }
    //     else if (current_lang == 'es') {
    //         loadDropDowns("#devChoose", es_derivations);
    //     }
    //     let devSelectBox = new vanillaSelectBox("#devChoose", {
    //         "placeHolder": "No forms selected",
    //         "useReverse": true,
    //         "disableSelectAll": false,
    //         "maxHeight": 500,
    //         "search": false,
    //         "translations": { "all": "All forms selected", "items": "feature", "selectAll": "[Select All]", "clearAll": "[Clear All]" }
    //     });

    //     devSelectBox.setValue('none')
    // }


}

function getInflectionsToRemove() {
    let inflections = [];
    let collection = document.querySelectorAll("#infChoose" + " option");
    collection.forEach(function (x, y) {
        if (!x.selected) {
            let values = x.value.split('||')
            values.forEach(function (key, index) {
                inflections.push(key.toLowerCase());
            })
        }
    });
    // console.log(inflections)
    return inflections
}

function getDerivationsToRemove() {
    let derivations = [];
    let collection = document.querySelectorAll("#devChoose" + " option");
    collection.forEach(function (x, y) {
        if (!x.selected) {
            derivations.push(x.value.toLowerCase());
        }
    });
    // console.log(derivations)
    return derivations
}

function loadFilesAndCreateProfile(init) {
    let level_list_paths = getPaths()
    let [mwu_level_list_paths, mwu_index] = getMWUPathAndIndex()
    let offset = getOffset()
    let inflections_to_remove = getInflectionsToRemove()
    let derivations_to_remove = getDerivationsToRemove()

    // console.log(level_list_paths)
    // console.log(inflections_to_remove)
    // console.log(derivations_to_remove)

    if (mappingDataDirty === true) {
        init = true
        mappingDataDirty = false
    }

    if (init === true) {
        resetMappings()

        // console.log(level_list_paths)

        let deferreds = getDeferreds(level_list_paths, mwu_level_list_paths, inflections_to_remove, derivations_to_remove)

        $.when(...deferreds
        )
            .fail(function () {
            })
            .then(function () {
                processExtendedEntries();
                let match_pairs = highlightStandardWordsAndMWUS(mwu_index)
                createProfile(offset, match_pairs);
                setGAProfileEvent()
                showOutOfListCount()
            })
    }
    else {
        processExtendedEntries();
        let match_pairs = highlightStandardWordsAndMWUS(mwu_index)
        createProfile(offset, match_pairs);
        setGAProfileEvent()
        showOutOfListCount()

    }
}

function getOutOfListWordCount() {
    var out_of_list_count = 0
    let quill_instance = Quill.find(document.getElementById('editor'));
    // var delta = quill_instance.getContents();
    // delta.forEach(value => {
    //     console.log(value)
    //     if (value.attributes != undefined) {
    //         if (value.attributes.color == '#e6851e') {
    //             out_of_list_count += 1
    //         }
    //     }
    // })

    delta_color_map.forEach(value => {
        if (value[0] != undefined) {
            if (value[1] == '#e6851e') {
                out_of_list_count += 1
            }
        }
    })
    return out_of_list_count
}

function showOutOfListCount() {

    let wordDist = $("#wordDist").DataTable();
    let total_words = wordDist.cell({ row: 3, column: 1 }).data()

    let globalDist = $("#globalDist").DataTable();

    let outOfListWordCount = getOutOfListWordCount()
    // console.log(outOfListWordCount)
    globalDist.cell({ row: 0, column: 1 }).data(total_words - outOfListWordCount);

    let percent = (total_words - outOfListWordCount) / total_words
    // console.log(percent)
    if (isNaN(percent)) {
        globalDist.cell({ row: 0, column: 2 }).data(0 + "%");
    }
    else {
        globalDist.cell({ row: 0, column: 2 }).data((((total_words - outOfListWordCount) / total_words) * 100).toFixed(1) + "%");
    }

}

function resetMappings() {
    memberToHead = new Map();
    memberToLevel = new Map();

    mwuToHead = new Map();
    mwuToLevel = new Map();

    extendedMemberToHead = new Map();
    extendedMWUToHead = new Map();
    extendedMWUTToLevel = new Map();
}

function showHideListTypeOptions(listChoice) {
    if (listChoice == "dictionary_lists") {
        $(".language_selector").show();
        $(".level_selector").show();
        $(".gcse_level_selector").hide();
        $(".modality_selector").hide();
        $(".ncelp_selector").hide();
        $(".inf_selector").show();

        if ($("#levelChoice").val() === "dictionary_1000" || $("#levelChoice").val() === "dictionary_2000") {
            $(".dev_selector").show();
        }
        else {
            $(".dev_selector").hide();
        }
        $(".save_stats").show();

    } else if (listChoice === "gcse_lists" || listChoice === "edexcel" || listChoice === "aqa") {
        $(".language_selector").show();
        $(".level_selector").hide();
        $(".gcse_level_selector").show();
        $(".modality_selector").show();
        $(".ncelp_selector").hide();
        $(".inf_selector").hide();
        $(".dev_selector").hide();
        $(".save_stats").show();

    } else if (listChoice == "ncelp_lists_ks3" || listChoice == "ncelp_lists_ks4") {
        $(".language_selector").show();
        $(".level_selector").hide();
        $(".gcse_level_selector").hide();
        $(".modality_selector").hide();
        $(".ncelp_selector").show();
        $(".inf_selector").hide();
        $(".dev_selector").hide();
        $(".save_stats").hide();
    } else { // custom chosen
        if ($("#listChoice").val() == "custom") {
            $(".language_selector").show();
            $(".level_selector").hide();
            $(".gcse_level_selector").hide();
            $(".modality_selector").hide();
            $(".ncelp_selector").hide();
            $(".inf_selector").show();
            $(".dev_selector").hide();
            $(".save_stats").hide();
            sidebar_open()
        }
    }
}

function setupHomeTool() {
    // $(".showAbout").on("click", function () {
    //     openTab($("#tabAbout"));
    // });
    // let dictionaryToolLink = document.getElementsByClassName("dictionaryToolLink");
    // dictionaryToolLink.onclick = function () {
    //     openTab($("#tabDictionaries"));
    //     return false;
    // };

    let multilingProfilerToolLinks = document.getElementsByClassName("multilingProfilerToolLink");
    for (const multilingProfilerToolLink of multilingProfilerToolLinks) {
        multilingProfilerToolLink.onclick = function () {
            openTab($("#tabWordProfiler"));
            return false;
        };
    }
    let aboutLinks = document.getElementsByClassName("aboutToolLink");
    for (const aboutLink of aboutLinks) {
        aboutLink.onclick = function () {
            openTab($("#tabAbout"));
            return false;
        };
    }
}

function switchDictionary() {
    if ($("#switch_wf2").hasClass('wf-on')) {
        wf_type = "wf2"
    }
    else {
        wf_type = "wf3"
    }

    let dict_ids = [['AccordianFrench', 'fr'], ['AccordianGerman', 'de'], ['AccordianSpanish', 'es']]
    dict_ids.forEach(id => {
        let x = document.getElementById(id[0]);
        x.className = x.className.replace(" w3-show", "");
        let indicator = document.getElementById(`triangle_state_${id[1]}`);
        if (indicator.innerText === '▾') {
            indicator.innerText = '▸'
        }


    })

    // console.log(wf_type)

}

function setupDictTool() {
    $("#switch_wf2").on("click", function () {
        $("#switch_wf2").toggleClass('wf-on');
        $("#switch_wf3").removeClass('wf-on');
        switchDictionary()
    });

    $("#switch_wf3").on("click", function () {
        $("#switch_wf2").removeClass('wf-on');
        $("#switch_wf3").addClass('wf-on');
        switchDictionary()
    });
    // $(".download_lists").on("click", function () {
    //     saveLists();
    // });
}

// function add_popup_action() {
//     $('.tooltips').hover(function (e) { // Hover event
//         var titleText = $(this).attr('title');
//         $('.tooltip').remove();
//         $(this).data('tiptext', titleText).removeAttr('title');
//         $('<p class="tooltip"></p>').html(titleText).appendTo("body").css('top', (e.pageY - 10) + 'px').css('left', (e.pageX + 20) + 'px').fadeIn('slow');
//     }, function () { // Hover off event
//         $(this).attr('title', $(this).data('tiptext'));
//         $('.tooltip').remove();
//     }).mousemove(function (e) { // Mouse move event
//         $('.tooltip').css('top', (e.pageY - 10) + 'px').css('left', (e.pageX + 20) + 'px');
//     });
// }

function setupProfilerTool() {
    let popup_extend_instructions = "Add single words or phrases to your list by typing or copy-pasting them on separate lines. &#010; Add word families to your list by typing word forms on a single line after a headword and colon (e.g., dog: dog, dogs).<br /> Then click the \'profile text\' button.<br /> You may want to extend your list if you think your students might know the word (e.g., it\'s a cognate or proper noun) or you are planning to provide a gloss."
    let download_stats_instructions = "Download detailed data about the word families in your text, including a flemma-based frequency list and statistical information about the frequency bands into which these word families fall."

    var lists = {
        "Frequency list": "dictionary_lists",
        "Eduqas/LDP GCSE list": "gcse_lists",
        // "EdExcel GCSE list": "edexcel",
        // "AQA GCSE list": "aqa",
        "NCELP KS3 list": "ncelp_lists_ks3",
        "NCELP KS4 list": "ncelp_lists_ks4",
        "Custom list": "custom",
    }

    let dataSetGlobalCoverage = [
        ["Total number of words covered by all lists (including multi-word units)", 0, 0 + "%"],
        // ["Percentage of words covered by all lists (including multi-word units)", 0 + "%"],
    ];

    let dataSetWords = [
        ["Total number of words in the text from your chosen list", 0, 0 + "%"],
        ["Total number of words in the text from your extended list", 0, 0 + "%"],
        ["Total number of words in the text from your chosen list plus extended list", 0, 0 + "%"],
        ["Total number of words in the text", 0, ''],
        // ["Percentage of words from your chosen plus extended lists in the text", 0 + "%", 0 + "%"],
        ["Type/Token Ratio", 0, ''],
    ];

    let dataSetWordFamilies = [
        ["Total number of word families in the text from your chosen list", 0, 0 + "%"],
        ["Total number of word families in the text from your extended list", 0, 0 + "%"],
        ["Total number of words families in the text from your chosen list plus extended list", 0, 0 + "%"],
        ["Total number of word families in the text", 0, ''],
        // ["Percentage of word families from your chosen plus extended lists in the text", 0 + "%", ''],
    ];

    let quill_instance = new Quill("#editor", {
        theme: "snow",
        placeholder: "Paste in text to profile",
        readOnly: false,
        modules: {
            toolbar: false,
        },
    });

    // quill_instance.setText("Il fit assoir Cendrillon, et approchant ")
    // quill_instance.setText("faire Peu de jours après, le fils du roi fit publier à son de trompe qu'il épouserait celle dont le pied serait bien juste à la pantoufle. On commença à l'essayer aux princesses, ensuite aux duchesses, et à toute la Cour ; mais inutilement. On la porta chez les deux soeurs, qui firent tout leur possible pour faire entrer leur pied dans la pantoufle, mais elles ne purent en venir à bout. Cendrillon reconnut sa pantoufle, dit en riant : « Que je voie si elle ne me serait pas bonne ! » Ses deux soeurs se mirent à rire et à se moquer d'elle. Le gentilhomme, qui faisait l'essai de la pantoufle, dit qu'il avait ordre de l'essayer à toutes les filles. Il fit assoir Cendrillon, et approchant la pantoufle de son petit pied, il vit qu'elle y entrait sans peine. L'étonnement des deux soeurs fut grand, mais plus encore quand Cendrillon tira de sa poche l'autre petite pantoufle qu'elle mit à son pied.")
    // quill_instance.setText("incertain national nationalement améliorer amélioration améliorable")
    // quill_instance.setText("Pays de Galles\nparce que\nnational nationalement\ncréer création\naméliorer amélioration améliorable\nnager nageur\ntélécharger téléchargeable")
    // quill_instance.setText("aujourd'hui d'accord chat d'ad chat")
    // quill_instance.setText("aujourd'hui d'accord chat d'at chat")
    //   quill_instance.on('text-change', function(delta, oldDelta, source) {
    //   if (source == 'api') {
    //   } else if (source == 'user') {
    //   }
    // });

    // quill_instance.setText("En esta oportunidad tenemos nuevamente un sensacional juego online gratis en el cual el protagonista es tu personaje favorito: Super Mario.	")

    // $("#ignore_list_input").val(`tenemos
    // un sensacional`)

    //   quill_instance.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
    //     delta.ops = delta.ops.map(op => {
    //       return {
    //         insert: op.insert
    //       }
    //     })
    //     return delta
    // })

    // $("#editor").keyup(function (e) {
    //     if (e.keyCode == 32) {
    //         createProfile(getPaths(), getOffset());
    //         // setGAProfileEvent()
    //     }
    // });

    loadDropDowns("#listChoice", lists);
    setGrammarTooltips()
    setDerivedFormsTooltips()

    $('.popup_extend').attr("title", popup_extend_instructions);
    $('.download_stats_but').attr("title", download_stats_instructions);

    let inflections_to_remove = getInflectionsToRemove()
    let derivations_to_remove = getDerivationsToRemove()

    let toolbarOptions = [
        ["bold", "italic", "underline", "strike"], // toggled buttons
        // ["blockquote", "code-block"],
        // [{ header: 1 }, { header: 2 }], // custom button values
        // [{ list: "ordered" }, { list: "bullet" }],
        // [{ script: "sub" }, { script: "super" }], // superscript/subscript
        // [{ indent: "-1" }, { indent: "+1" }], // outdent/indent
        // [{ direction: "rtl" }], // text direction
        [{ size: ["small", "normal", "large", "huge"] }], // custom dropdown
        // [{ header: [1, 2, 3, 4, 5, 6, false] }],
        // [{ color: [] }, { background: [] }], // dropdown with defaults from theme
        // [{ font: [] }],
        [{ align: [] }],
        ["clean"], // remove formatting button
    ];

    $("#editor").bind("paste", function (e) {
        // console.log('data pasted')
        // access the clipboard using the api
        // var pastedData = e.originalEvent.clipboardData.getData('text');

        // this timeout is set to ensure that the paste is finished before
        // the highlight is updated
        setTimeout(function () {
            loadFilesAndCreateProfile(false)
        }, 0);
    });



    // $(".level_selector").hide();
    // $(".ncelp_selector").hide();

    // $(".save_profile").on("click", function () {
    //     saveProfile();
    // });
    // $(".copy_profile").on("click", function () {
    //     copyToClip();
    // });

    $(".save_stats").on("click", function () {
        saveProfileStats();
    });

    // fixIOS();

    $("#globalDist").DataTable({
        paging: false,
        ordering: false,
        info: false,
        searching: false,
        data: dataSetGlobalCoverage,
        columnDefs: [
            {
                targets: 0,
                className: "dt-left",
            },
            {
                targets: 1,
                className: "dt-right",
                width: 40
            },
            {
                targets: 2,
                className: "dt-right",
                width: 40
            },
        ],
        columns: [{ title: "Global Coverage" }, { title: "" }, { title: "" }],

        dom: "frtipB",
        // l - length changing input control
        // f - filtering input
        // t - The table! 
        // i - Table information summary
        // p - pagination control
        // r - processing display element
        buttons: [],
    });

    $("#wordDist").DataTable({
        paging: false,
        ordering: false,
        info: false,
        searching: false,
        data: dataSetWords,
        columnDefs: [
            {
                targets: 0,
                className: "dt-left",
            },
            {
                targets: 1,
                className: "dt-right",
                width: 40
            },
            {
                targets: 2,
                className: "dt-right",
                width: 40

            },
        ],
        columns: [{ title: "Word Statistics" }, { title: "" }, { title: "" }],

        dom: "frtipB",
        // l - length changing input control
        // f - filtering input
        // t - The table! 
        // i - Table information summary
        // p - pagination control
        // r - processing display element
        buttons: ["copy", "csv", "excel"],
    });

    $("#wordFamilyDist").DataTable({
        paging: false,
        ordering: false,
        info: false,
        searching: false,
        data: dataSetWordFamilies,
        columnDefs: [
            {
                targets: 0,
                className: "dt-left",
            },
            {
                targets: 1,
                className: "dt-right",
                width: 40
            },
            {
                targets: 2,
                className: "dt-right",
                width: 40
            },
        ],
        columns: [
            {
                title: 'Word Family Statistics <a id="myWordFamlink" href="#" class="w3-text-orange">(More Information)</a></span>',
            },
            { title: "" },
            { title: "" },
        ],
        dom: "frtipB",
        // l - length changing input control
        // f - filtering input
        // t - The table! 
        // i - Table information summary
        // p - pagination control
        // r - processing display element
        buttons: ["copy", "csv", "excel"],

    });

    // Set the button labels
    $('.buttons-csv').text('Export CSV')
    $('.buttons-excel').text('Export Excel')

    let myWordFamlink = document.getElementById("myWordFamlink");
    //Set code to run when the link is clicked
    // by assigning a function to "onclick"
    myWordFamlink.onclick = function () {
        openTab($("#tabDictionaries"));
        return false;
    };

    let myFAQlink = document.getElementById("myFAQlink");
    //Set code to run when the link is clicked
    // by assigning a function to "onclick"
    myFAQlink.onclick = function () {
        openTab($("#tabFaq"));
        return false;
    };

    // $("#item1").on("change", function () {
    //   handleInput();
    //   // updateHighlight($('#item1').prop('checked'),auto_eng_words,'color_level_1', 1);
    // });
    // $("#item2").on("change", function () {
    //   handleInput();
    // });
    // $("#item3").on("change", function () {
    //   handleInput();
    // });
    // $("#item4").on("change", function () {
    //   handleInput();
    // });
    // $("#languageChoice").on("change", function () {
    //   handleInput();
    // });

    // $container = $(".container");
    // $backdrop = $(".backdrop");
    // $highlights = $(".highlights");
    // $textarea = $("textarea");
    // $toggle = $("button");
    // bindEvents($container, $backdrop, $highlights, $textarea, $toggle);
    // handleInput();

    setComboBoxOptions()


}

function optionsChanged(recreate_infChoose = true, recreate_devChoose = true, init = false) {
    // console.log('inf', recreate_infChoose)
    // console.log('dev', recreate_devChoose)

    let sidebarLabel
    if ($("#listChoice").val() === 'custom') {
        sidebarLabel = 'Custom'
    }
    else {
        sidebarLabel = 'Extended'
    }

    setGrammarTooltips()

    showHideListTypeOptions($("#listChoice").val())
    $('.extended_list_label').text(sidebarLabel)

    setComboBoxOptions(recreate_infChoose, recreate_devChoose, init)


}

function setGrammarTooltips() {
    let german_special_note = " For accurate results, split compounds in your texts by adding a space between the words of which they consist (e.g., <em>Sommerferien → Sommer Ferien</em>)."
    let grammar_instruction_freq_list_old = "The grammar features selected will be included as part of the output (i.e., all selected forms will appear in black) a) for all frequency band lists, and b) for extended lists only if these are fully morphosyntactically tagged using TreeTagger tags. If your extended list contains word forms that are not morphosyntactically tagged, these will be incompatible with the grammar feature function (i.e., will appear in black regardless of the grammar features selected)."
    let grammar_instruction_freq_list = "Deselecting grammar features will exclude the corresponding forms of words on the frequency list from the profiling output (i.e., these forms will appear in orange).<br>Words added to the extended list are not compatible with this feature (unless they have been morphosyntactically tagged using TreeTagger tags)."
    let grammar_instruction_custom_list_old = "The grammar features selected will be included as part of the output (i.e., all selected forms will appear in black) for custom lists only if these are fully morphosyntactically tagged using TreeTagger tags. If your custom list contains word forms that are not morphosyntactically tagged, these will be incompatible with the grammar feature function (i.e., will appear in black regardless of the grammar features selected)."
    let grammar_instruction_custom_list = "Deselecting grammar features will exclude the corresponding forms of words on the frequency list from the profiling output (i.e., these forms will appear in orange).<br>Words added to the extended list are not compatible with this feature (unless they have been morphosyntactically tagged using TreeTagger tags)."

    if ($("#listChoice").val() === 'custom') {
        $(".tooltips-grammar").attr('title', grammar_instruction_custom_list)
    }
    else {
        $(".tooltips-grammar").attr('title', grammar_instruction_freq_list)
    }

    // german_special_note
    const note_language = $("#languageChoice").val();
    if (note_language == "de") {
        $("#de-special-note").html(german_special_note);
    }
    else {
        $("#de-special-note").html('');
    }
    // else {
    //     $('#other_notes').html(list_note_for_spanish)      
    // }
}

function setDerivedFormsTooltips() {
    let derivation_instruction = "You can add derived forms of words on the frequency list to your profile by selecting the patterns here. These frequent, productive, predictable, and regular derived forms (i.e., level 3 word families) align with the patterns specified in the subject content for GCSE reading exams in England. This feature is currently only available for words at the 1,000 and 2,000 levels.<br>Words added to the extended list are not compatible with this feature."

    if ($("#listChoice").val() === 'custom') {
        $(".tooltips-derived-forms").attr('title', derivation_instruction)
    }
    else {
        $(".tooltips-derived-forms").attr('title', derivation_instruction)
    }

}

function addSpinner(el) {
    el.length || (el = $(el));

    el.addClass('spinner');
}

function removeSpinner(el) {
    el.length || (el = $(el));
    el.length || (el = $('body'));

    el.removeClass('spinner');
}

$(document).ready(function () {

    //tooltip
    $(document).tooltip({
        tooltipClass: "uitooltip",
        content: function () {
            return $(this).prop("title");
        },
    });

    $(".tablink").click(function () {
        openTab($(this));
    });

    showTopBottom("Header");
    showTopBottom("Footer");
    openTab($("#tabHome"));
    // openTab($("#tabWordProfiler"));
    // openTab($("#tabDictionaries"));
    // openTab($("#tabFaq"));
    // openTab($("#tabAbout"));
    // openTab($("#tabContact"));
});

