import os
import json
from pathlib import Path
from collections import defaultdict
import regex

data_folder = "data_2023_05_12"
languages = ["fr", "de", "es"]
dictionary_list_names = ["1-1000", "1001-2000", "2001-3000", "3001-4000", "4001-5000"]


def create_json_tree(path, ignore_patterns=None):
    
    # Create a dictionary for the current directory
    directory = {
        "name": os.path.basename(path),
        "type": "folder",
        "children": []
    }

    # Iterate over the directory contents
    for entry in os.scandir(path):
        # Check if the entry matches any ignore patterns
        if ignore_patterns and any(pattern in entry.name for pattern in ignore_patterns):
            continue
        if 'mwu' in [entry]:
            continue
        # If the entry is a file, add it to the dictionary
        if entry.is_file():
            file = {
                "name": entry.name,
                "type": "file"
            }
            directory["children"].append(file)
        # If the entry is a directory, recursively call the function
        elif entry.is_dir():
            subdir = create_json_tree(entry.path, ignore_patterns)
            directory["children"].append(subdir)

    return directory

def create_dictionary_json():
    for wf_type in ["wf2", "wf3"]:
        dictionary = defaultdict(list)
        output_file = Path(data_folder).joinpath('dictionary_lists', f"dictionary_{wf_type}.json")

        for language in languages:
            for dictionary_list_name in dictionary_list_names:
                dictionary_path = Path().joinpath(data_folder, 'dictionary_lists', language, dictionary_list_name)
                dictionary_path = f"{dictionary_path}_{language}.txt"
                print(dictionary_path)

                with open(dictionary_path, mode="r", encoding="utf8") as fh:
                    for row_id, row in enumerate(fh.readlines()):
                        # clean endings
                        row = row.strip("[\r\n]+")

                        # get columns
                        try:
                            row_entries = row.split("\t")
                        except:
                            print(f"Row {row_id}: Incorrect layout. Cannot split.")
                            quit()

                        if len(row_entries) < 2:
                            print(f"Row {row_id}: Incorrect layout. Not enough entries")
                            quit()

                        # get entries
                        id = row_entries.pop(0)
                        headword = row_entries.pop(0)
                        (headword, headword_wordclass) = headword.split("_")
                        members = row_entries
                        filtered_members = []

                        if len(members) > 0:
                            members = [x.split("_") for x in members]

                            # remove words with a 'V.*Z' tag (not sure why) and blanks
                            for member in members:
                                try:
                                    if regex.match(r"V.*Z", member[1]):
                                        continue
                                    # ignore wf3 derivations
                                    elif wf_type == "wf2" and regex.match(
                                        r"^DM[1234567890A]", member[1]
                                    ):
                                        continue
                                    elif member[0] == "":
                                        continue
                                    else:
                                        filtered_members.append(member[0])
                                except IndexError as e:
                                    print("INDEX ERROR", e)
                                    print("ROW ID", row_id)
                                    print("HEADWORD", headword)
                                    print(member)
                                    quit()

                            filtered_members = list(dict.fromkeys(filtered_members))
                            filtered_members = ", ".join(filtered_members)
                        else:
                            filtered_members = ""

                        # print(id, headword, headword_wordclass, members)
                        dictionary[language].append(
                            [id, headword, headword_wordclass, filtered_members]
                        )

        with open(output_file, mode="w", encoding="utf8") as fh:
            print('>>>>>>')
            print(output_file)
            print('>>>>>>')

            json.dump(dictionary, fh)

        # with open(output_file, mode="r", encoding="utf8") as fh:
        #     dictionary = json.load(fh)
        #     print(dictionary["fr"][0])


if __name__ == "__main__":
    json_tree = create_json_tree(data_folder, ignore_patterns = [".DS_Store", ".json"])
    output_file = Path(data_folder).joinpath("file_tree.json")
    with open(output_file, "w") as file:
        json.dump(json_tree, file, indent=4)

    create_dictionary_json()