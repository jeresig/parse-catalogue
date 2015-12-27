"use strict";

const headingRegex = /^\d+(?:-\d+)?\.\s+\S/;

module.exports = {
    getPages: (doc) =>
        doc.find("//div[starts-with(@id, 'page')]").slice(4),
    getPageNum: (page) => parseFloat(/\d+/.exec(page.attr("id"))[0]),
    getHeadings: (page) => page.find(".//p")
        .filter((elem) => headingRegex.test(elem.text())),
    getPageImages: (page, images) => images
        .filter((img) => img.indexOf(`simple-${page.num}_`) === 0),
    validateHeading: (prev, cur) => (parseFloat(/\d+/.exec(prev)[0]) <
        parseFloat(/\d+/.exec(cur)[0])),
    headingAtStart: (page) => {
        const elem = page.get(".//p[2]");
        return !elem || headingRegex.test(elem.text());
    },
};
