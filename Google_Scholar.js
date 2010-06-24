{
    "translatorID"   : "fe6cf126-ced0-422b-b05f-b51a00726849",
    "translatorType" : 4,
    "label"          : "Google Scholar",
    "creator"        : "Simon Kornblith",
    "target"         : "http://scholar\\.google\\.(?:com|com?\\.[a-z]{2}|[a-z]{2})/scholar",
    "minVersion"     : "1.0.0b3.r1",
    "maxVersion"     : "",
    "priority"       : 100,
    "inRepository"   : true,
    "lastUpdated"    : "2010-05-02 15:55:00"
}

/* Generic code */
function Base (init) {
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
}

function Scraper (init) {
    for (x in init) {
        this[x] = init[x];
    }

    this.makeItems = function (doc, url) {
        var item = new Zotero.Item(this.itemType);
        item.url = url;
        var fields = new Array("title", "publicationTitle", "date", "volume", "issue");
        for (var i in fields) {
            var field = fields[i];
            var fieldVal = this._evaluate(this[field], doc, url);
            if (fieldVal instanceof Array) {
                item[field] = fieldVal[0];
            } else {
                item[field] = fieldVal;
            }
        }
        item.attachments = this._evaluate(this.attachments, doc, url);
        var creators = this._evaluate(this.creators, doc, url);
        if (creators) {
            for (i in creators) {
                item.creators.push(creators[i]);
            }
        }
        return [item];
    };
}

Scraper.prototype = new Base;

function MultiScraper (init) {
    for (x in init) {
        this[x] = init[x];
    }

    this._mkSelectItems = function(titles, urls) {
        var items = new Object;
        for (var i in titles) {
            items[urls[i]] = titles[i];
        }
        return items;
    };

    this._selectItems = function(titles, urls) {
        var items = new Array();
        for (var j in Zotero.selectItems(this._mkSelectItems(titles, urls))) {
            items.push(j);
        }
        return items;
    };

    this._mkAttachments = function(doc, url, urls) {
        var attachmentsArray = this._evaluate(this.attachments, doc, url);
        var attachmentsDict = new Object();
        for (var i in urls) {
            attachmentsDict[urls[i]] = attachmentsArray[i];
        }
        return attachmentsDict;
    };

    this.makeItems = function(doc, url) {
        Zotero.debug("Entering MultiScraper.makeItems");
        if (this.beforeFilter) {
            var newurl = this.beforeFilter(doc, url);
            if (newurl != url) {
                return this.makeItems(Zotero.Utilities.retrieveDocument(url), newurl);
            }
        }
        var titles = this._evaluate(this.titles, doc, url);
        var urls = this._evaluate(this.urls, doc, url);
        var itemsToUse = this._selectItems(titles, urls);
        var attachments = this._mkAttachments(doc, url, urls);
        if(!itemsToUse) {
	    Zotero.done(true);
	    return [];
	} else {
            var itemTrans = this.itemTrans;
            var madeItems = new Array();
            for (var i in itemsToUse) {
                var url1 = itemsToUse[i];
                var doc1 = Zotero.Utilities.retrieveDocument(url1);
                var items = itemTrans.makeItems(doc1, url1, attachments[url1]);
                madeItems.push(items[0]);
            }
            return madeItems;
        }
    };
}

MultiScraper.prototype = new Base;

function DelegateTranslator (init) {
    for (x in init) {
        this[x] = init[x];
    }
    
    this._translator = Zotero.loadTranslator(this.translatorType);
    this._translator.setTranslator(this.translatorId);
    
    this.makeItems = function(doc, url, attachments) {
        Zotero.debug("Entering DelegateTranslator.makeItems");
        var tmpItem;
        var text = Zotero.Utilities.retrieveSource(url);
        this._translator.setHandler("itemDone", function(obj, item) { 
                                        //tmpItem = item;
                                        if (attachments) { Zotero.debug("ARRRR"); Zotero.debug(attachments); item.attachments = attachments; }
                                        item.complete();
                                    });
	this._translator.setString(text);
        this._translator.translate();
        Zotero.debug("Leaving DelegateTranslator.makeItems");
        return [tmpItem];
    };
}

DelegateTranslator.prototype = new Scraper;

function StringMagic() {
    this._filters = new Array();

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

    this.prepend = function(prefix) {
        return this.replace(/^/, prefix);
    };

    this.append = function(postfix) {
        return this.replace(/$/, postfix);
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

    this.key = function(field) {
        this.addFilter(function(n) { return n[field]; });
        return this;
    };

    this.makeAttachment = function(type, title) {
        var filter = function(url) {
            if (url) {
                return [{ url   : url,
                          type  : type,
                          title : title }];
            } else {
                return [];
            }
        };
        this.addFilter(filter);
        return this;
    };

    this._applyFilters = function(a, doc1) {
        Zotero.debug("Entering StringMagic._applyFilters");
        for (i in this._filters) {
            for (var j = 0 ; j < a.length ; j++) {
                try {
                    if (typeof a[j] === 'undefined') { continue; }
                    else { a[j] = this._filters[i](a[j], doc1); }
                } catch (x) {
                    a[j] = undefined;
                    Zotero.debug("Caught exception on filter: " + this._filters[i]);
                }
            }
        }
        return a;
    };
};

function Xpath(_xpath) {
    this._xpath = _xpath;
    this._filters = new Array();

    this.text = function() {
        var filter = function(n) {
            if (typeof n === 'object' && n.textContent) { return n.textContent; }
            else { return n; }
        };
        this.addFilter(filter);
        return this;
    };

    this.sub = function(xpath) {
        var filter = function(n, doc) {
            var result = doc.evaluate(xpath, n, null, XPathResult.ANY_TYPE, null);
            if (result) {
                return result.iterateNext();
            } else {
                return undefined;               
            }
        };
        this.addFilter(filter);
        return this;
    };

    this.evaluate = function (doc) {
        var it = doc.evaluate(this._xpath, doc, null, XPathResult.ANY_TYPE, null);
        var a = new Array();
        var x;
        while (x = it.iterateNext()) { a.push(x); }
        a = this._applyFilters(a, doc);
        if (a.length == 0) { return false; }
        else { return a; }
    };
}

Xpath.prototype = new StringMagic();

function doWeb(doc, url) {
    Zotero.debug("Entering doWeb");
    var scraper = mkScraper(detectWeb(doc, url));
    var items = scraper.makeItems(doc, url);
    for (var i in items) {
        Zotero.debug("Completing: " + items[i]);
        try {
            items[i].complete();   
        } catch (x) {
        }
    }
    Zotero.debug("Leaving doWeb");
}
/* End generic code */

function mkScraper(itemType) {
    if (itemType == "multiple") {
        return new MultiScraper(
            {   itemTrans    : new DelegateTranslator({translatorType : "import",
                                                       translatorId   : "9cb70025-a888-4a29-a210-93ec52da40d4"}),
                titles       : new Xpath('//div[@class="gs_r"]//h3').text(),
                urls         : new Xpath('//a[contains(@href, "scholar.bib")]').key('href').text(),
                attachments  : new Xpath('//div[@class="gs_r"]//h3').sub('.//a').key('href').text().makeAttachment("text/html", "Google Scholar Linked Page"),
                beforeFilter : function (doc, url) {
                    var haveBibTeXLinks = new Xpath('//a[contains(@href, "scholar.bib")]').evaluate(doc);
	            if(!haveBibTeXLinks) {
	                url = url.replace (/hl\=[^&]*&?/, "");
	                url = url.replace("scholar?", "scholar_setprefs?hl=en&scis=yes&scisf=4&submit=Save+Preferences&");
                    }
                    return url;
                }
            });
    } else {
        return undefined;
    }
}

function detectWeb(doc, url) {
    return "multiple";
}
