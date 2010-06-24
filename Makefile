FILES=Digital_Humanities_Quarterly.js Atlantic.js Google_Scholar.js
INSTALL_DIR=/home/egh/.mozilla/firefox/6ii8512r.dev/zotero/translators/
%.js : %.js.in
	sed -e '/@framework@/{r framework.js' -e 'd;}' $< > $@

all: $(FILES)

clean:
	rm $(FILES)

install: all
	cp $(FILES) $(INSTALL_DIR)
