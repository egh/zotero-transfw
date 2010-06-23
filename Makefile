FILES=Digital_Humanities_Quarterly.js Atlantic.js

%.js : %.js.in
	sed -e '/@framework@/{r framework.js' -e 'd;}' $< > $@

all: $(FILES)

clean:
	rm $(FILES)
