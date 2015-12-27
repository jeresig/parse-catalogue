"use strict";

const exec = require("child_process").exec;
const path = require("path");
const fs = require("fs");

const async = require("async");
const libxml = require("libxmljs");

const args = process.argv.slice(2);
const inputPDF = args[0];
const outputDir = args[1];

const complexHTML = path.resolve(outputDir, "complex.html");
const simpleHTML = path.resolve(outputDir, "simple.html");

const headingRegex = /^\d+(?:-\d+)?\.\s+\S/;
const getPages = (doc) =>
    doc.find("//div[starts-with(@id, 'page')]").slice(4);
const getPageNum = (page) => parseFloat(/\d+/.exec(page.attr("id"))[0]);
const getHeadings = (page) => page.find(".//p")
    .filter((elem) => headingRegex.test(elem.text()));
const getPageImages = (page, images) => images
    .filter((img) => img.indexOf(`simple-${page.num}_`) === 0);
const validateHeading = (prev, cur) => (parseFloat(/\d+/.exec(prev)[0]) <
    parseFloat(/\d+/.exec(cur)[0]));
const headingAtStart = (page) => {
    const elem = page.get(".//p[2]");
    return !elem || headingRegex.test(elem.text());
};

async.series([
    (callback) => {
        fs.stat(outputDir, (err) => {
            if (!err) {
                return callback();
            }

            console.log("Creating output directory...");
            fs.mkdir(outputDir, callback);
        });
    },
    (callback) => {
        fs.stat(complexHTML, (err) => {
            if (!err) {
                return callback();
            }

            console.log("Generating HTML document...");
            exec(`pdftohtml -noframes -c -i ${inputPDF} ${complexHTML}`,
                callback);
        });
    },
    (callback) => {
        fs.stat(simpleHTML, (err) => {
            if (!err) {
                return callback();
            }

            console.log("Extracting images...");
            exec(`pdftohtml -noframes ${inputPDF} ${simpleHTML}`, callback);
        });
    },
], (err) => {
    const images = fs.readdirSync(outputDir)
        .filter((file) => !/\.html$/.test(file));
    const htmlFile = fs.readFileSync(complexHTML);
    const doc = libxml.parseHtmlString(htmlFile);

    const pages = getPages(doc).map((page) => ({
        num: getPageNum(page),
        headings: getHeadings(page),
        headingAtStart: headingAtStart(page),
    }));

    const findEndPage = (i) => (pages[i].headingAtStart ?
        pages[i - 1].num :
        (pages[i].headings.length > 0 ?
            pages[i].num :
            findEndPage(i + 1)));

    const sections = [];
    let lastValidHeading;

    pages.forEach((page, i) => {
        const nextPage = pages[i + 1];
        const pageImages = getPageImages(page, images);

        page.headings = page.headings.filter((heading) => {
            if (!lastValidHeading ||
                    validateHeading(lastValidHeading.text(), heading.text())) {
                lastValidHeading = heading;
                return true;
            }
            return false;
        });

        page.headings.forEach((heading, i) => {
            sections.push({
                heading: heading.text(),
                images: pageImages.slice(i, i + 1),
                startPage: page.num,
                endPage: (i + 1 < page.headings.length || !nextPage ?
                    page.num : findEndPage(i + 1)),
            });
        });

        // add image(s) to heading
        // push heading into a master list
        // set startPage
        // set noPrevPageOverflow
        // then look back through and calculate:
        // endPage

        //console.log("Page:", page.num);
        //console.log("Headings:", page.headings
        //    .map((elem) => elem.text().slice(0, 20)));
        //console.log("Images:", pageImages);
        if (page.headings.length !== pageImages.length) {
            console.log("ERROR: Image mismatch.");
        }
    });

    console.log(JSON.stringify(sections, null, "    "));

    console.log("DONE");
});


