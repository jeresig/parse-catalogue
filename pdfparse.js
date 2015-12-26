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

const getPages = (doc) =>
    doc.find("//div[starts-with(@id, 'page')]").slice(4);
const getPageNum = (page) => /\d+/.exec(page.attr("id"))[0];
const getHeadings = (page) => page.find(".//p")
    .filter((elem) => /^\d+(?:-\d+)?\.\s+\S/.test(elem.text()));
const getPageImages = (page, images) => images
    .filter((img) => img.indexOf(`simple-${page.num}_`) === 0);
const validateHeading = (prev, cur) => (parseFloat(/\d+/.exec(prev)[0]) <
    parseFloat(/\d+/.exec(cur)[0]));

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
    }));

    let lastValidHeading;

    pages.forEach((page, i) => {
        const pageImages = getPageImages(page, images);

        page.headings = page.headings.filter((heading) => {
            if (!lastValidHeading ||
                    validateHeading(lastValidHeading.text(), heading.text())) {
                lastValidHeading = heading;
                return true;
            }
            return false;
        });

        console.log("Page:", page.num);
        console.log("Headings:", page.headings
            .map((elem) => elem.text().slice(0, 20)));
        console.log("Images:", pageImages);
        if (page.headings.length !== pageImages.length) {
            console.log("ERROR: Image mismatch.");
        }
    });

    console.log("DONE");
});


