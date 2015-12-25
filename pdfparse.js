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
    const htmlFile = fs.readFileSync(complexHTML);
    const doc = libxml.parseHtmlString(htmlFile);
    console.log(doc.find("//p")
        .filter((elem) => /^\d+(?:-\d+)?\.\s/.test(elem.text()))
        .map((elem) => elem.text().slice(0, 20)));
    console.log("DONE");
});


