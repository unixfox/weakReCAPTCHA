const Rekognition = require('node-rekognition');
const fs = require('fs').promises;

const AWSParameters = {
    "accessKeyId": "XXX",
    "secretAccessKey": "XXX",
    "region": "eu-central-1",
}

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array)
    }
}

const rekognition = new Rekognition(AWSParameters)

module.exports = {
    scanPictures: async function (filePathArray) {
        try {
            let picturesInfo = [];

            await asyncForEach(filePathArray, async (filePath) => {
                const imageBuffer = await fs.readFile(filePath);
                const imageLabels = (await rekognition.detectLabels(imageBuffer)).Labels;
				picturesInfo.push(imageLabels);
			});
			return (picturesInfo);
        } catch (error) {
            console.log(error);
        }
    }
}