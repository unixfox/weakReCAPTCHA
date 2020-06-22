const Clipper = require("image-clipper");
const getPicturesInfo = require("./scanPictures.js");
const challenge = require("./challenge.js");
const pluralize = require("pluralize");
const Mongolass = require("mongolass");
const del = require("del");

const mongolass = new Mongolass();
const Schema = Mongolass.Schema;
mongolass.connect(process.env.mongo_uri);

Clipper.configure({
    canvas: require("canvas")
});

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array)
    }
}

const captchaSchema = new Schema("captchaSchema", {
    errorId: { type: "number", default: 0 },
    status: { type: "string", default: "processing" },
    error: { type: "string", require: false },
    taskId: { type: "number", required: true },
    solution: {
        gRecaptchaResponse: { type: "string", default: "", required: false }
    },
    createdAt: { type: Mongolass.Types.Date, default: Date.now }
});

const Task = mongolass.model("captcha", captchaSchema);

async function computeChallenge() {
    try {
        //const refererURL = "https://www.google.com/sorry/index";
        //const siteKey = "6LfwuyUTAAAAAOAmoS0fdqijC2PbbdH4kjq62Y1b";
        const fetchChallenge = await challenge.fetchChallenge(process.env.siteKey, process.env.refererURL);
        if (fetchChallenge.error) {
            return (fetchChallenge);
        }
        const challengeNumber = fetchChallenge.challengeID.substring(0, 10);
        const regexRemoveArticle = /(?:(the|a|an) +)/g;
        let challengeText = pluralize.singular(fetchChallenge.challengeText.replace(regexRemoveArticle, ""));
        if (challengeText.includes(" or ")) {
            challengeText = challengeText.replace(/or /gi, "").split(" ");
        }
        //console.log(fetchChallenge);
        //console.log(challengeText);
        let filesToScan = [];
        let i = 0;
        await asyncForEach([0, 1, 2], async (row) => {
            await asyncForEach([0, 1, 2], async (column) => {
                await Clipper("/tmp/" + challengeNumber + "-payload.jpg", function () {
                    this.crop(100 * column, 100 * row, 100, 100)
                        .resize(500, 500)
                        .toFile("/tmp/" + challengeNumber + "-result" + i + ".jpg", function () { });
                });
                filesToScan.push("/tmp/" + challengeNumber + "-result" + i + ".jpg");
                i++;
            });
        });
        delete i;
        const results = await getPicturesInfo.scanPictures(filesToScan);
        const matchedResults = await challenge.solveChallenge(results, challengeText);
        await del(["/tmp/" + challengeNumber + "*"], { force: true });
        return (await challenge.submitChallenge(matchedResults, fetchChallenge.challengeID, process.env.siteKey, process.env.refererURL));
    } catch (error) {
        return ({ status: "error" });
    }
};

(async () => {
    let startComputeChallenge = await computeChallenge();
    while (startComputeChallenge.status == "processing") {
        startComputeChallenge = await computeChallenge().catch(error => {
            startComputeChallenge = "error";
        });
    }
    if (startComputeChallenge.status == "error") {
        await Task
            .findOneAndUpdate(
                { taskId: Number(process.env.taskId) },
                {
                    $set: {
                        errorId: 1,
                        status: "error",
                        error: startComputeChallenge.error
                    }
                }
            )
            .exec()
    }
    else {
        await Task
            .findOneAndUpdate(
                { taskId: Number(process.env.taskId) },
                {
                    $set: {
                        status: "ready",
                        solution: {
                            gRecaptchaResponse: startComputeChallenge.gRecaptchaResponse
                        }
                    }
                }
            )
            .exec()
    }
})();