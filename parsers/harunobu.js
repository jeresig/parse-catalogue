"use strict";

const headingRegex = /^(\d+)(?:-\d+)?\.\s+(\S)/;

module.exports = {
    getPages: (doc) =>
        doc.find("//div[starts-with(@id, 'page')]").slice(4),
    getPageNum: (page) => parseFloat(/\d+/.exec(page.attr("id"))[0]),
    getHeadings: (page) => (page.find(".//p")
        .map((elem) => elem.text())
        .filter((heading) => headingRegex.test(heading))),
    validateHeading: (prev, cur) => (parseFloat(headingRegex.exec(prev)[1]) <
        parseFloat(headingRegex.exec(cur)[1])),
    sectionKey: (heading) => heading.replace(headingRegex, "$2")
        .replace(/.*?series(.*)$/i, "$1")
        .replace(/[^a-zA-Z]/g, ""),
    headingAtStart: (page) => {
        const elem = page.get(".//p[2]");
        return !elem || headingRegex.test(elem.text());
    },
};
