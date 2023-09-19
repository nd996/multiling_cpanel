This folder contains three data statistics files. An explanation of each file is given below:

1. coverage_statistics.csv
This file shows a breakdown of the input text according to the selected frequency bands. For each frequency band, you can find information on how many words it contains (word count), how many word families it contains (family count), and the counts as a percentage of the whole.

2. word_family_statistics.csv
This file shows a breakdown of the input text according to the word family headwords that appear in the text. For each headword, you can find information on how many times it appears (number of occurrences), its frequency band (frequency band) and the family members appearing in the text, with their raw counts appearing in parenthesis. 

3. mwu_statistics.csv
This file shows a breakdown of the input text according to the multiword units (MWUs) headwords that appear in the text. For each MWU headword, you can find information on the source information (chosen list or extended list), the frequency band level of the MWU if available (either in the chosen list or specified in the extended list), how many times the MWU appears (number of occurrences), and the MWU family members appearing in the text, with their raw counts appearing in parenthesis.

In the case of multiword units (MWUs) and short phrases, the frequency_band_statistics.csv and word_family_statistics.csv files will reflect counts that treat each component independently and occur as part of a respective word family (if available). For example, "fais des courses" will be treated as "faire", "de" and "cours" and counted accordingly. However, these multiword unit (MWUs) and short phrases will be counted as complete units in the own right in the mwu-statistics.csv file. For example, "fais des courses" will be counted as one occurrence of that phrase.  This method of counting is not reflected in the word statistics and word family statistics tabs in the profiler interface (see FAQ).

To open any of these files in Excel, please import them via the Data menu=>Get Data option, follow by choosing the "From File"=>"From Text/CSV" selection.