import AudioViewer from './audioviewer';

let audioViewer;

let app = document.createElement('div');
document.body.appendChild(app);

let btnTool = document.createElement('div');
app.appendChild(btnTool);

let inputFile = document.createElement('input');
inputFile.setAttribute('type', 'file');
btnTool.appendChild(inputFile);

let btnLoad = document.createElement('button');
btnLoad.innerHTML = 'load';
btnLoad.onclick = () => {
	if(inputFile.files.length > 0) {
		let file = inputFile.files[0];
		audioViewer.loadFile(file);
	}
};
btnTool.appendChild(btnLoad);

let container = document.createElement('canvas');
app.appendChild(container);

window.addEventListener('load', () => {
	audioViewer = new AudioViewer({
		canvas: container
	});
});
