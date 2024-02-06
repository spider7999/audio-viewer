import {
	Plugin
} from './plugin.js';
import {
	FFT
} from './fft.js';

let __drawSpectrogram = (instance) => {
	let bufferSize = instance.fftParams.fftSize;
	let bufArr = instance.audio.audioData.getChannelData(0);
	let signal = new Float32Array(bufferSize);
	let pixelIndex = 0;
	let step = Math.floor(bufArr.length / instance.view.width);
	let readIndex = 0,
		count = 0;
	while (count++ < instance.view.width) {
		if (bufArr.length < readIndex + bufferSize) {
			break;
		}
		instance.audio.audioData.copyFromChannel(signal, 0, readIndex);
		readIndex += step;
		const spectrum = instance.fft.calculateSpectrum(signal);
		const array = new Uint8Array(bufferSize / 2);
		let j = 0,
			m = 0,
			s = spectrum.length / instance.view.height < 1 ? 1 : spectrum.length / instance.view.height;
		while (j < spectrum.length) {
			array[m] = Math.max(-255, Math.log10(spectrum[Math.floor(j)]) * 45);
			let value = array[m];
			let color = 'rgb(' + Math.floor(instance.style.colorRFunc(value)) + ',' + Math.floor(instance
					.style.colorGFunc(value)) + ',' +
				Math.floor(instance.style.colorBFunc(value)) + ')';
			instance.canvasCtx.fillStyle = color;
			instance.canvasCtx.fillRect(pixelIndex, instance.view.height - m, 1, 1);
			j += s;
			m++;
		}
		pixelIndex++;
	}
}

export class Spectrogram extends Plugin {

	canvas = null;
	canvasCtx = null;
	audioContext = new AudioContext();
	fft = null;
	audio = {
		file: null,
		fileUrl: null,
		audioData: null,
		sampleRate: 16000
	};
	fftParams = {
		fftSize: 512,
		dynamicFftSize: false,
		windowFunc: 'hann' // 'bartlett', 'bartlettHann', 'blackman', 'cosine', 'gauss', 'hamming', 'hann', 'lanczoz', 'rectangular', 'triangular'
	}
	view = {
		width: 0,
		height: 0
	}
	style = {
		// r: 245,
		// g: 0,
		// b: 87
		colorRFunc: (v) => {
			// return 255 - v;
			return 245 / 255 * v;
		},
		colorGFunc: (v) => {
			// return 255 - v;
			return 0;
		},
		colorBFunc: (v) => {
			// return 255 - v;
			return 87 / 255 * v;
		}
	}

	constructor(params) {
		super();
		params = params || {};
		this.canvas = params.canvas;
		this.audio.file = params.file;
		this.audio.fileUrl = params.fileUrl;
		this.fftParams.fftSize = params.fftSize || this.fftParams.fftSize;
		this.fftParams.windowFunc = params.windowFunc || this.fftParams.windowFunc;
		if (typeof(params.dynamicFftSize) != "undefined") {
			this.fftParams.dynamicFftSize = params.dynamicFftSize;
		}
		if (this.canvas) {
			this.canvasCtx = this.canvas.getContext('2d');
			this.view.width = this.canvas.clientWidth;
			this.view.height = this.canvas.clientHeight;
			if (this.fftParams.dynamicFftSize && this.view.height > 256) {
				this.fftParams.fftSize = 1024;
			}
			// 自适应高宽
			this.canvas.setAttribute("width", this.view.width);
			this.canvas.setAttribute("height", this.view.height);
		}
		if (this.audio.file) {
			this.loadFile(this.audio.file);
		} else if (this.audio.fileUrl) {
			this.loadUrl(this.audio.fileUrl);
		}
	}

	loadFile(file, loadCompleted) {
		this.audio.file = file;
		let _that = this;
		file.arrayBuffer().then(arrBuffer => {
			let audioDataView = new DataView(arrBuffer);
			let format = audioDataView.getUint32(0, true);
			let audioSampleRate = 16000;
			if (format == 0x46464952) {
				audioSampleRate = audioDataView.getUint32(24, true);
			}
			_that.loadArrayBuffer(arrBuffer, audioSampleRate, loadCompleted);
		});
	}

	loadUrl(audioUrl, loadCompleted) {
		this.audio.fileUrl = audioUrl;
		let _that = this;
		let ajax = new XMLHttpRequest();
		ajax.responseType = "arraybuffer";
		ajax.open("GET", audioUrl);
		ajax.send();
		ajax.onreadystatechange = function() {
			if (ajax.readyState == 4 && ajax.status == 200) {
				let arrBuffer = ajax.response;
				let audioDataView = new DataView(arrBuffer);
				let format = audioDataView.getUint32(0, true);
				let audioSampleRate = 16000;
				if (format == 0x46464952) {
					console.log("wave format");
					audioSampleRate = audioDataView.getUint32(24, true);
				}
				_that.loadArrayBuffer(ajax.response, audioSampleRate, loadCompleted);
			}
		}
		// ajax.onprogress = function(event) {
		// 	if (_that.canvas && _that.view.displayLoadProgress) {
		// 		let loadProgress = event.loaded/event.total;
		// 		Util.drawLoadProgress(_that.canvasCtx, _that.view.width, _that.view.height, loadProgress);
		// 	}
		// 	if(progressCallback) {
		// 		try{
		// 			progressCallback(event);
		// 		}catch(e){
		// 			throw new Error(e.message);
		// 		}
		// 	}
		// };
	}

	loadArrayBuffer(arrBuffer, audioSampleRate, loadCompleted) {
		this.audioContext = new AudioContext({
			sampleRate: audioSampleRate
		});
		let _that = this;
		this.audioContext.decodeAudioData(arrBuffer).then(audioData => {
			_that.loadAudioBuffer(audioData)
			if (loadCompleted) {
				loadCompleted();
			}
		});
	}

	loadAudioBuffer(audioBuffer) {
		this.audio.audioData = audioBuffer;
		this.audio.sampleRate = audioBuffer.sampleRate;
		this.fft = new FFT(this.fftParams.fftSize, audioBuffer.sampleRate, this.fftParams.windowFunc)
		__drawSpectrogram(this);
	}

	reset() {
		this.canvasCtx.clearRect(0, 0, this.view.width, this.view.height);
	}

}
