Lottie to SVG Converter
Convert a frame of a Lottie animation into an SVG. You may also be interested in the Gatsby Remark plugin that uses this project.

Convert this animation to a standard SVG:

Animation	Static SVG
animation	SVG
This SVG is converted from this animation from Lottie Files.

Note that this README shows the animation as a GIF since I can't load the lottie scripts in a README.

Wait, just one frame?
Yes, just one frame. This can be useful to show a preview of your animation as an SVG before the lottie animation script has fully loaded.

If you found this project because you wanted to convert your full lottie animation to an animated SVG, sorry, I can't help you. I would even go so far as to argue that you shouldn't want to do that. There is debate out there on whether CSS animations (which an animated SVG would use) is better/faster/stronger than JS animations. JS animations win. Keep using lottie. Be happy.

If you still aren't convinced, there are other projects out there to convert your full lottie animation into other file types:

lottie-node
puppeteer-lottie
Usage
npm install lottie-to-svg
const fs = require("fs");
const renderSvg = require("lottie-to-svg");

const animationData = JSON.parse(fs.readFileSync(`myanim.json`, "utf8"));

renderSvg(animationData).then(svg => {
  fs.writeFileSync(`myanim.svg`, svg, "utf8");
});
Render Settings
You can pass render settings for lottie-web (which does the actual rendering of the animation) as the second argument to renderSvg. See full list of available options.

Frame Number
You can pass a frame number (to render a specific frame) as the third argument to renderSvg. By default it will render the first frame.




How It Works
lottie-web only supports rendering in a browser environment. This project uses jsdom to fool lottie-web into rendering in a node environment.

It uses lottie's SVG renderer to render one frame of the animation and then pulls the outputted SVG out of jsdom and then gives it to you, dear user, to do what you will with it.


const { JSDOM } = require("jsdom");

module.exports = async (animationData, opts, frameNumber) => {
	const { window } = new JSDOM("<!DOCTYPE html><body></body>", {
		pretendToBeVisual: true
	});

	const { document, navigator } = window;

	// have to trick lottie into thinking it's running in a browser
	global.window = window;
	global.navigator = navigator;
	global.document = document;

	// load the lottie renderer late after globals are set
	const renderToDom = require("./render");

	const result = await renderToDom(
		document,
		animationData,
		opts || {},
		frameNumber || 0
	);
	return result;
};
const lottie = require("lottie-web");

module.exports = (document, animationData, opts, frameNumber) =>
	new Promise((resolve, reject) => {
		try {
			const container = document.createElement("div");
			document.body.append(container);

			var instance = lottie.loadAnimation({
				container: container,
				renderer: "svg",
				loop: false,
				autoplay: false,
				animationData,
				rendererSettings: opts
			});

			instance.addEventListener("DOMLoaded", () => {
				instance.goToAndStop(frameNumber, true);
				resolve(container.innerHTML);
			});
		} catch (err) {
			reject(err);
		}
	});