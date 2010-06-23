/* Generic code */
function Scraper (init) {
    for (x in init) {
        this[x] = init[x];
    }

    this._evaluate = function (val, doc, url) {
        var valtype = typeof val;
        if (valtype === 'string') {
            return val;
        } else if (valtype === 'object') {
            return val.evaluate(doc, url);
        } else if (valtype === 'function') {
            return val(doc, url);
        } else {
            return undefined;
        }
    };

    this.makeItems = function (doc, url) {
        var item = new Zotero.Item(this.itemType);
        item.url = url;
        var fields = new Array("title", "publicationTitle", "date", "volume", "issue", "attachments");
        for (var i in fields) {
            var field = fields[i];
            item[field] = this._evaluate(this[field], doc, url);
        }
        var creators = this._evaluate(this.creators, doc, url);
        if (creators) {
            for (i in creators) {
                item.creators.push(creators[i]);
            }
        }
        item.complete();
    };
}

function MultiScraper (init) {
    for (x in init) {
        this[x] = init[x];
    }

    this.makeItems = function(doc, url) {
        var items = new Object;
        var itemDocs = this.items.evaluate(doc, url);
        for (var i in itemDocs) {
            items[itemDocs[i].href] = Zotero.Utilities.trim(itemDocs[i].textContent);
        }
        var itemsToUse = new Array();
        for (var j in Zotero.selectItems(items)) {
            itemsToUse.push(j);
        }
        var itemTrans = this.itemTrans;
        var f = function (doc1) { itemTrans.makeItems(doc1, doc1.location.href); };
        var df = function() { Zotero.done(); };
        Zotero.Utilities.processDocuments(itemsToUse, f, df);
        Zotero.wait();
    };
}

function StringMagic() {
    this.addFilter = function(filter) {
        this._filters.push(filter);
        return this;
    };

    this.replace = function(s1, s2) {
        this.addFilter(function(s) {
            return s.replace(s1, s2);
        });
        return this;
    };

    this.remove = function(toStrip) {
        this.replace(toStrip, '');
        return this;
    };

    this.trim = function() {
        this.addFilter(function(s) { return Zotero.Utilities.trim(s); });
        return this;
    };

    this.trimInternal = function() {
        this.addFilter(function(s) { return Zotero.Utilities.trimInternal(s); });
        return this;
    };

    this.match = function(re) {
        this.addFilter(function(s) { return s.match(re)[1]; });
        return this;
    };

    this.cleanAuthor = function(type) {
        this.addFilter(function(s) { return Zotero.Utilities.cleanAuthor(s, type); });
        return this;
    };

    this._applyFilters = function(a) {
        for (i in this._filters) {
            for (var j = 0 ; j < a.length ; j++) {
                a[j] = this._filters[i](a[j]);
            }
        }
        return a;
    };
};

function Xpath(_xpath) {
    this._xpath = _xpath;
    this._filters = new Array();

    this.first = function() {
        this._first = true;
        return this;
    };

    this.raw = function() {
        this._raw = true;
        return this;
    };

    this.evaluate = function (doc) {
        var it = doc.evaluate(this._xpath, doc, null, XPathResult.ANY_TYPE, null);
        var a = new Array();
        var x;
        while (x = it.iterateNext()) {
            if (this._raw) {
                a.push(x);
            } else {
                a.push(x.textContent);
            }
        }
        a = this._applyFilters(a);
        if (a.length == 0) { return false; }
        else if (this._first) { return a[0]; }
        else { return a; }
    };
}

Xpath.prototype = new StringMagic();

function doWeb(doc, url) {
    mkScraper(detectWeb(doc, url)).makeItems(doc, url);
}
/* End generic code */
