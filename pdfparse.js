"use strict";

const exec = require("child_process").exec;
const path = require("path");
const fs = require("fs");

const async = require("async");
const libxml = require("libxmljs");
const request = require("request");

const args = process.argv.slice(2);
const parserName = args[0];
const inputPDF = args[1];
const outputDir = args[2];
const jsonResultsFile = args[3];

const parserPath = path.resolve("parsers/", `${parserName}.js`);
const complexHTML = path.resolve(outputDir, "complex.html");
const simpleHTML = path.resolve(outputDir, "simple.html");
const pdfPageDir = path.resolve(outputDir, "pdf-pages/");
const jsonDir = path.resolve(outputDir, "json/");

const parser = require(parserPath);

const uploadEndpoint = "http://ukiyo-e.org/upload";
const imageResults = {};

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
        fs.stat(jsonDir, (err) => {
            if (!err) {
                return callback();
            }

            console.log("Creating JSON directory...");
            fs.mkdir(jsonDir, callback);
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
    (callback) => {
        fs.stat(pdfPageDir, (err) => {
            if (!err) {
                return callback();
            }

            console.log("Generating PDF page images...");
            fs.mkdir(pdfPageDir, () =>
                exec(`convert ${inputPDF} ${pdfPageDir}/page-%d.jpg`,
                    callback));
        });
    },
    (callback) => {
        console.log("Getting image list...");

        fs.readdir(outputDir, (err, files) => {
            files = files.filter((file) => /\.(?:jpg|png|jpeg)$/.test(file));

            files.forEach((file) => {
                imageResults[file] = true;
            });

            callback();
        });
    },
    (callback) => {
        async.eachLimit(Object.keys(imageResults), 1, (file, callback) => {
            const imgFile = path.resolve(outputDir, file);
            const jsonFile = path.resolve(jsonDir, `${file}.json`);

            fs.stat(jsonFile, (err) => {
                if (!err) {
                    return callback();
                }

                console.log(`Getting similarity for ${file}...`);

                request.post({
                    url: uploadEndpoint,
                    followRedirect: false,
                    formData: {
                        file: fs.createReadStream(imgFile),
                    },
                }, (err, res, body) => {
                    if (err || !res) {
                        console.error("Upload error.", err);
                        return callback(err);
                    }

                    const url = `${res.headers.location}?type=json`;

                    request(url)
                        .pipe(fs.createWriteStream(jsonFile))
                        .on("close", callback)
                        .on("end", callback);
                });
            });
        }, callback);
    },
    (callback) => {
        console.log("Loading image results...");

        fs.readdir(jsonDir, (err, files) => {
            files = files.filter((file) => /\.(?:json)$/.test(file));

            async.eachLimit(files, 1, (file, callback) => {
                const jsonPath = path.resolve(jsonDir, file);

                fs.readFile(jsonPath, {encoding: "utf8"}, (err, data) => {
                    try {
                        const imgFile = file.replace(/\.json$/, "");
                        imageResults[imgFile] = JSON.parse(data);
                    } catch (e) {
                        // Ignore any files that can't be parsed
                        delete imageResults[file];
                    }

                    callback();
                });
            }, callback);
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

    const getPageImages = (page, images) => images
        .filter((img) => img.indexOf(`-${page.num}_`) >= 0);

    let lastValidHeading;
    const sections = [];
    const matchDist = [];
    const printCount = {};
    const printCountType = {};
    const sectionClusters = {};
    const matchClusters = {};

    pages.forEach((page, pagePos) => {
        const nextPage = pages[pagePos + 1];
        const pageImages = getPageImages(page, images);

        page.headings = page.headings.filter((heading) => {
            if (!lastValidHeading ||
                    parser.validateHeading(
                        lastValidHeading, heading)) {
                lastValidHeading = heading;
                return true;
            }
            return false;
        });

        page.headings.forEach((heading, i) => {
            sections.push({
                heading: heading,
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

    sections.forEach((section) => {
        section.related = section.images.map((imageName) => {
            if (!(imageName in imageResults)) {
                return [];
            }

            const results = (imageResults[imageName].results || []);

            matchDist[results.length] = (matchDist[results.length] || 0) + 1;

            return results.map((result) => ({
                id: result.image_id,
                source: result.source.id,
                url: `http://ukiyo-e.org${result.localURL}`,
                thumb: result.thumb,
                scaled: result.scaled,
                image: result.file,
            }));
        }).reduce((all, item) => all.concat(item), []);

        let key = parser.sectionKey(section.heading);

        section.related.forEach((match) => {
            if (match.id in matchClusters) {
                key = matchClusters[match.id];
            }
        });

        if (!(key in sectionClusters)) {
            sectionClusters[key] = {
                matches: [],
                sections: [],
                pages: [],
            };
        }

        sectionClusters[key].sections.push(section);

        section.related.forEach((match) => {
            printCount[match.id] = (printCount[match.id] || 0) + 1;

            if (!printCountType[match.source]) {
                printCountType[match.source] = {};
            }

            printCountType[match.source][match.id] =
                (printCountType[match.source][match.id] || 0) + 1;

            matchClusters[match.id] = key;

            const matches = sectionClusters[key].matches;
            const pages = sectionClusters[key].pages;

            if (!matches.some((m) => m.id === match.id)) {
                sectionClusters[key].matches.push(match);
            }

            for (let page = section.startPage; page <= section.endPage;
                    page++) {
                if (pages.indexOf(page) < 0) {
                    pages.push(page);
                }
            }

            sectionClusters[key].pages = pages.sort((a, b) => a - b);
        });
    });

    fs.writeFileSync(jsonResultsFile, JSON.stringify({
        images: sectionClusters,
    }));

    //console.log(JSON.stringify(sectionClusters, null, "    "));

    console.log("Total prints found:", Object.keys(printCount).length);
    console.log("Total prints found, by type:");
    for (const type in printCountType) {
        console.log(`${type}: ${Object.keys(printCountType[type]).length}`);
    }
    console.log("Match Dist:", matchDist);
    console.log("# of Clusters:", Object.keys(sectionClusters)
        .filter((name) => sectionClusters[name].matches.length > 0).length);

    console.log("DONE");
});
