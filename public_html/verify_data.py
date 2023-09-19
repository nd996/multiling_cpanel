from pathlib import Path
import regex

data_folder = "data_2023_09_17"

# verify de
p = Path(data_folder)
file_list = list(p.glob("**/*.txt"))
# for filename in file_list:
#     print(filename)


def check_path(name):
    for type in ["", "mwu_"]:
        for lang in ["de", "es", "fr"]:
            # if '_' in file_path.name:
            # print(f"{type}1-1000_{lang}")
            # print(name)
            # print(f"{type}1-1000_{lang}")
            if f"{type}1-1000_{lang}" in name:
                return True
            elif f"{type}1001-2000_{lang}" in file_path.name:
                return True
            elif f"{type}2001-3000_{lang}" in file_path.name:
                return True
            elif f"{type}3001-4000_{lang}" in file_path.name:
                return True
            elif f"{type}4001-5000_{lang}" in file_path.name:
                return True
    return False


# check file names
for file_path in file_list:
    if "dictionary_lists" in str(file_path):
        if check_path(file_path.name) is True:
            continue
        else:
            print(f"{file_path} => error in file name")
            quit()


# check file content
for file_path in file_list:
    # print(file_path)
    with open(file_path, mode="r", encoding="utf8") as fh:
        # print(file_path)
        for row_id, row in enumerate(fh):
            row_string = row.strip()
            if row_string == "":
                print(f"{file_path} {row_id} blank row")
            # if "mwus" not in file_path.name and "mwu" not in file_path.name and " " in row_string:
            #     print(f"{file_path} {row_id} space in row")
            # check for weird spaces
            for value in ["1000", "2000", "3000", "4000", "5000"]:
                if value in file_path.name and "mwu" not in file_path.name:
                    pass
                    # if ' ' in row:
                    #     print(f'{file_path.name} row_id: {row_id} => space error in file content')
                    #     quit()
                if value in file_path.name and "mwu" not in file_path.name:
                    if "," in row:
                        print(
                            f"{file_path.name} row_id: {row_id+1} => comma error in file content"
                        )
                        quit()
                if (
                    value not in file_path.name
                    and "mwu" not in file_path.name
                    and "ncelp_lists" not in str(file_path)
                ):
                    if "\t" not in row:
                        print(
                            f"{file_path.name} row_id: {row_id+1} => tab error in mwu file content"
                        )
                        quit()
