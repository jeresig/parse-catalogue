"use strict";

const exec = require("child_process").exec;
const path = require("path");
const fs = require("fs");

const async = require("async");
const libxml = require("libxmljs");

const args = process.argv.slice(2);
const parserName = args[0];
const inputPDF = args[1];
const outputDir = args[2];

const parserPath = path.resolve("parsers/", `${parserName}.js`);
const complexHTML = path.resolve(outputDir, "complex.html");
const simpleHTML = path.resolve(outputDir, "simple.html");

const parser = require(parserPath);

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

    const pages = parser.getPages(doc).map((page) => ({
        num: parser.getPageNum(page),
        headings: parser.getHeadings(page),
        headingAtStart: parser.headingAtStart(page),
    }));

    const findEndPage = (i) => (pages[i].headingAtStart ?
        pages[i - 1].num :
        (pages[i].headings.length > 0 ?
            pages[i].num :
            findEndPage(i + 1)));

    const sections = [];
    let lastValidHeading;

    pages.forEach((page, pagePos) => {
        const nextPage = pages[pagePos + 1];
        const pageImages = parser.getPageImages(page, images);

        page.headings = page.headings.filter((heading) => {
            if (!lastValidHeading ||
                    parser.validateHeading(
                        lastValidHeading.text(), heading.text())) {
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
                    page.num : findEndPage(pagePos + 1)),
            });
        });

        if (page.headings.length < pageImages.length) {
            const section = sections[sections.length - 1];
            section.images = section.images.concat(
                pageImages.slice(page.headings.length));
        }

        if (page.headings.length > pageImages.length) {
            console.log("ERROR: Image mismatch. Page", page.num);
        }
    });

    console.log(JSON.stringify(sections, null, "    "));

    console.log("DONE");
});
