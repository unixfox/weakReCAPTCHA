const got = require("got");
const cheerio = require("cheerio");
const fs = require("fs");
const levenshtein = require("js-levenshtein");
const FormData = require("form-data");

const instance = got.extend({
    prefixUrl: "https://www.google.com",
    headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
        "accept-language": "en,en-US;q=0.9,fr;q=0.8,en-US;q=0.7",
        "accept-encoding": "gzip, deflate, br",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3"
    }
});

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array)
    }
}

module.exports = {
    fetchChallenge: async function (siteKey, refererURL) {
        try {
            const response = await instance("recaptcha/api/fallback?k=" + siteKey, {
                headers: {
                    "Referer": refererURL
                }
            });
            if (response.statusCode == 400) {
                return ({
                    status: "error",
                    error: "Invalid referer/websiteURL or the captcha doesn't support the fallback mechanism."
                });
            }
            const htmlParsed = await cheerio.load(response.body);
            const challengeToSolveID = await htmlParsed("input[type=hidden]").attr("value");
            const challengeToSolve = await htmlParsed("strong").text();
            const imageChallengeURL = await htmlParsed(".fbc-imageselect-payload").attr("src");
            const imageChallengeDownload = await instance(imageChallengeURL, { responseType: "buffer" });
            await fs.writeFileSync("/tmp/" + challengeToSolveID.substring(0, 10) + "-payload.jpg", imageChallengeDownload.body);
            return ({
                status: "processing",
                challengeID: challengeToSolveID,
                challengeText: challengeToSolve
            });
        } catch (error) {
            if (error) {
                return ({
                    status: "error",
                    error: "Invalid referer/websiteURL or the captcha doesn't support the fallback mechanism."
                });
            }
        }
    },
    solveChallenge: async function (results, challengeText) {
        let matchedResults = new Set();
        let i = 0;
        await asyncForEach(results, async (result) => {
            //console.log(i);
            if (result.length != "undefined") {
                await asyncForEach(result.Tags, async (element) => {
                    if (Array.isArray(challengeText)) {
                        challengeText.forEach(challengeTextSliced => {
                            if (levenshtein(challengeTextSliced, element.name) >= 0 && levenshtein(challengeTextSliced, element.name) <= 1) {
                                matchedResults.add(i);
                            }
                        });
                    }
                    else if (levenshtein(challengeText, element.name) >= 0 && levenshtein(challengeText, element.name) <= 1) {
                        matchedResults.add(i);
                    }
                    //console.log(element.name);
                });
            }

            i++;
        });
        return (matchedResults);
    },
    submitChallenge: async function (matchedResults, challengeID, siteKey, refererURL) {
        const form = new FormData();
        await form.append("c", challengeID);
        await matchedResults.forEach(number => {
            form.append("response", number);
        });
        //console.log(matchedResults);
        try {
            const response = await instance.post("recaptcha/api/fallback?k=" + siteKey, {
                body: form,
                headers: {
                    "Referer": refererURL
                }
            });
            //console.log(response.body);
            //console.log(response.statusCode);
            const htmlParsed = await cheerio.load(response.body);
            const gRecaptchaResponse = await htmlParsed("textarea").text();
            if (gRecaptchaResponse != "")
                return ({
                    status: "ready",
                    gRecaptchaResponse: gRecaptchaResponse
                });
            else
                return ({
                    status: "processing"
                });
        } catch (error) {
            //console.log(error.response.body);
        }
    }
};