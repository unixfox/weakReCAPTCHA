const Koa = require("koa");
const Router = require("koa-router");
const bodyParser = require("koa-bodyparser");
const fork = require("child_process").fork;
const Mongolass = require("mongolass");
const mongolass = new Mongolass();
const Schema = Mongolass.Schema;
mongolass.connect(process.env.mongo_uri);

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

const app = new Koa();
app.use(bodyParser({
    detectJSON: function (ctx) {
        return true;
    }
}));

const router = new Router();

function getRandomArbitrary(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

(async () => {
    router.post("/createTask", async (ctx, next) => {
        const randomNumber = getRandomArbitrary(0, 999999);
        if (ctx.request.body.task.websiteKey && ctx.request.body.task.websiteURL) {
            await fork("./main.js", {
                env: {
                    taskId: Number(randomNumber),
                    siteKey: ctx.request.body.task.websiteKey,
                    refererURL: ctx.request.body.task.websiteURL,
                    mongo_uri: process.env.mongo_uri
                }
            });
            await Task
                .insertOne({
                    taskId: Number(randomNumber),
                    solution: {
                        gRecaptchaResponse: ""
                    }
                })
                .exec();
            ctx.body = {
                "errorId": 0,
                "taskId": Number(randomNumber)
            };
        }
        else {
            ctx.response.status = 400;
            ctx.body = {
                "errorId": 1,
                "error": "websiteKey and/or websiteURL missing"
            };
        }
    });

    router.post("/getTaskResult", async (ctx, next) => {
        if (ctx.request.body.taskId) {
            ctx.body = await Task
                .findOne({ taskId: ctx.request.body.taskId })
                .exec()
            // ctx.body = {
            //     "errorId": 0,
            //     "status": "ready",
            //     "solution": {
            //         "gRecaptchaResponse": await fsPromises.readFile("/tmp/" + ctx.request.body.taskId, "utf8")
            //     }
            // };
        }
        else {
            ctx.body = {
                "errorId": 1,
                "error": "taskId missing"
            };
        }
    });

    app
        .use(router.routes())
        .use(router.allowedMethods());

    app.listen(process.env.PORT || 3000);
    console.log("Server started on port " + (process.env.app_port || 3000) + "!");
})();