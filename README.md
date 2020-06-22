## Description
The lowest difficulty of Google reCAPTCHA allows to load a version of Google reCAPTCHA without the JavaScript implementation.    
This means that the automation is easy because all of what's needed is to send the images of the reCAPTCHA to an image rekognition and then solve the reCAPTCHA based on the results.
This program is just the exploit on top of a clone of the existing API of anti-captcha.

## What makes this exploit special?
It simply doesn't require to run a full fat browser like the hundred others exploits about Google Recaptcha.   
If you are adventurous, you may even reimplement it using curl (really).

## Does it work on www.google.com?
Unfortunately at the time of writing the README, the exploit stopped working on www.google.com sorry page a week ago. It's still working on websites that use the lowest difficulty of Google Recaptcha though.

## Disclaimer
This source code is incomplete and the code is more like a proof of concept than a properly crafted exploit   
The part where the program sends the images to the image rekognition (scanPictures.js) is not completed yet because I used another service which I don't want to disclose here and I don't have the time to work on the example with AWS Rekognition.

## How to run it
1. Set the environment variable `mongo_uri` to a mongodb server. Example URI: `mongodb://mongodb0.example.com:27017/recaptcha`
2. Complete the `scanPictures.js` with your own implementation that is using another image rekognition or complete the AWS rekognition example. Feel free to open a PR if you completed the example with AWS Rekognition.
3. `node server.js`
4. Send the requests to the server `http://localhost:3000` just like you would with the anti-captcha API: https://anti-captcha.com/apidoc/recaptcha