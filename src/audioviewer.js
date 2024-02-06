import {
	audioBufferToBlob,
	getAudioSampleRate
} from './util.js';
import {
	Drawer
} from './drawer.js';
import {
	Plugin
} from './plugin/plugin.js';

const BASIC_SCALE = 1.1;
const DENSITY = 50;
const SUB_DOWNSAMPLING_LIMIT = 20;

const MODE_NAN = 0;
const MODE_READY = 1;
const MODE_VIEW_MOVE = 11;
const MODE_REGION_ADD = 12;
const MODE_REGION_MOVE = 13;
const MODE_REGION_RESIZE_LEFT = 14;
const MODE_REGION_RESIZE_RIGHT = 15;

const HEIGHT_TOOL_TIMELINE = 20;

const TEXT_LOADING = "loading ...";
const TEXT_DRAWING = "drawing ...";

let FLAG_FLUSH = 1;

let __initListener = (self) => {
	if (!self.drawer) {
		return;
	}
	self.drawer.canvas.onmousedown = function(event) {
		__handleMouseDown(event, self);
	};
	self.drawer.canvas.onmousemove = function(event) {
		__handleMouseMove(event, self);
	};
	self.drawer.canvas.onmouseup = function(event) {
		__handleMouseUp(event, self);
	}
	self.drawer.canvas.onwheel = function(event) {
		__handleWheel(event, self);
	}
	self.drawer.canvas.onmouseenter = function(event) {
		self.viewer.current.mouseOver = true;
	}
	self.drawer.canvas.onmouseleave = function(event) {
		self.viewer.current.mouseOver = false;
	}
	document.addEventListener("keydown", (event) => {
		__handleKeyDown(event, self);
	});
	document.addEventListener("keyup", function(event) {
		__handleKeyUp(event, self);
	});
}

let __handleMouseDown = (event, self) => {
	if (event.offsetY > self.viewer.height) {
		if (event.offsetY > self.viewer.height + 5 && event.offsetY < self.viewer.height + 15) {
			let currentTime = self.audio.duration * event.offsetX / self.viewer.width;
			self.seekTo(currentTime);
		}
	} else {
		if (self.viewer.current.mode == MODE_READY) {
			let scalingRatio = Math.pow(BASIC_SCALE, self.viewer.waveGain);
			let currentTime = self.viewer.current.startTime + event.offsetX * self.audio
				.duration / self.viewer.width / scalingRatio;
			self.viewer.current.region = __getRegionByTime(self.regions, currentTime, self.audio.duration / self
				.viewer.width / scalingRatio * 2);
			if (self.viewer.current.region) {
				if (self.viewer.current.region.startTime + (self.audio.duration / self.viewer
						.width / scalingRatio * 2) > currentTime) {
					self.viewer.current.mode = MODE_REGION_RESIZE_LEFT;
				} else if (self.viewer.current.region.endTime - (self.audio.duration / self
						.viewer.width / scalingRatio * 2) < currentTime) {
					self.viewer.current.mode = MODE_REGION_RESIZE_RIGHT;
				} else {
					self.viewer.current.mode = MODE_REGION_MOVE;
					self.viewer.current.regionTime = currentTime;
				}
			} else {
				self.viewer.current.mode = MODE_REGION_ADD;
				self.viewer.current.region = new Object();
				self.viewer.current.region.startTime = currentTime;
				self.viewer.current.region.temporary = true;
			}
		}
	}
}

let __handleMouseMove = (event, self) => {
	if (event.offsetY > self.viewer.height) {
		if (self.viewer.current.mode == MODE_READY)
			self.drawer.canvas.style.cursor = 'default';
		if (event.offsetY > self.viewer.height + 5 && event.offsetY < self.viewer.height + 15)
			self.viewer.current.selectedTimeInTimeLine = self.audio.duration * event.offsetX / self
			.viewer.width;
		else
			self.viewer.current.selectedTimeInTimeLine = -1;
	} else {
		if (self.viewer.current.mode == MODE_NAN) {
			return;
		}
		let scalingRatio = Math.pow(BASIC_SCALE, self.viewer.waveGain);
		let currentTime = self.viewer.current.startTime + event.offsetX * self.audio
			.duration / self.viewer.width / scalingRatio;
		self.viewer.current.selectedTimeInTimeLine = -1;
		if (self.viewer.current.mode == MODE_REGION_ADD) {
			self.viewer.current.region.endTime = currentTime;
			if (self.regions.length == 0 || self.regions[self.regions.length - 1] != self.viewer.current
				.region) {
				self.regions.push(self.viewer.current.region);
			}
		}
		if (self.viewer.current.mode == MODE_REGION_MOVE) {
			let diffT = currentTime - self.viewer.current.regionTime;
			self.viewer.current.regionTime = currentTime;
			if (self.viewer.current.region.startTime + diffT < 0) {
				self.viewer.current.region.endTime -= self.viewer.current.region.startTime;
				self.viewer.current.region.startTime = 0
			} else if (self.viewer.current.region.endTime + diffT > self.audio.duration) {
				self.viewer.current.region.startTime += self.audio.duration - self.viewer.current.region
					.endTime;
				self.viewer.current.region.endTime = self.audio.duration;
			} else {
				self.viewer.current.region.startTime += diffT;
				self.viewer.current.region.endTime += diffT;
			}
		}
		if (self.viewer.current.mode == MODE_REGION_RESIZE_LEFT ||
			self.viewer.current.mode == MODE_REGION_RESIZE_RIGHT) {
			if (self.viewer.current.mode == MODE_REGION_RESIZE_LEFT) {
				self.viewer.current.region.startTime = currentTime;
			} else if (self.viewer.current.mode == MODE_REGION_RESIZE_RIGHT) {
				self.viewer.current.region.endTime = currentTime;
			}
		}
		if (self.viewer.current.mode == MODE_READY) {
			let cr = __getRegionByTime(self.regions, currentTime, (self.audio.duration / self.viewer.width /
				scalingRatio * 2));
			if (cr) {
				if (cr.startTime + (self.audio.duration / self.viewer.width / scalingRatio * 2) >
					currentTime) {
					self.drawer.canvas.style.cursor = 'col-resize';
				} else if (cr.endTime - (self.audio.duration / self.viewer.width / scalingRatio *
						2) <
					currentTime) {
					self.drawer.canvas.style.cursor = 'col-resize';
				} else {
					self.drawer.canvas.style.cursor = 'move';
				}
			} else {
				self.drawer.canvas.style.cursor = 'default';
			}
		}
	}
}

let __handleMouseUp = (event, self) => {
	let scalingRatio = Math.pow(BASIC_SCALE, self.viewer.waveGain);
	if (self.viewer.current.mode == MODE_REGION_ADD) {
		if (self.regions.length > 0 && self.regions[self.regions.length - 1].temporary) self.regions.pop();
		let endTime = self.viewer.current.startTime + event.offsetX * self.audio
			.duration / self.viewer.width / scalingRatio;
		if (self.viewer.current.region.startTime > endTime) {
			self.viewer.current.region.endTime = self.viewer.current.region.startTime;
			self.viewer.current.region.startTime = endTime;
		} else {
			self.viewer.current.region.endTime = endTime;
		}
		// region startTime和endTime之间的间隔小于1E-4时不会添加，没有意义
		if (self.viewer.current.region.endTime - self.viewer.current.region.startTime > 1E-4) {
			let newRegion = {
				startTime: self.viewer.current.region.startTime,
				endTime: self.viewer.current.region.endTime
			}
			self.viewer.current.region = newRegion;
			self.regions.push(newRegion);
		}
	}
	if (self.viewer.current.mode == MODE_REGION_RESIZE_LEFT ||
		self.viewer.current.mode == MODE_REGION_RESIZE_RIGHT) {
		if (self.viewer.current.region.startTime > self.viewer.current.region.endTime) {
			let endTime = self.viewer.current.region.endTime;
			self.viewer.current.region.endTime = self.viewer.current.region.startTime;
			self.viewer.current.region.startTime = endTime;
		}
	}
	if (self.viewer.current.mode == MODE_REGION_ADD ||
		self.viewer.current.mode == MODE_REGION_MOVE ||
		self.viewer.current.mode == MODE_REGION_RESIZE_LEFT ||
		self.viewer.current.mode == MODE_REGION_RESIZE_RIGHT) {
		self.viewer.current.mode = MODE_READY;
	}
}

let __handleWheel = (event, self) => {
	if (self.viewer.current.mode == MODE_VIEW_MOVE) {
		let scalingRatio = Math.pow(BASIC_SCALE, self.viewer.waveGain);
		let moveWeight = 30;
		if (event.wheelDelta > 0) {
			// 鼠标滚轮上滑
			self.viewer.current.startTime -= self.audio.duration / self.viewer.width /
				scalingRatio * moveWeight;
		} else {
			self.viewer.current.startTime += self.audio.duration / self.viewer.width /
				scalingRatio * moveWeight;
		}
		self.viewer.current.startTime = self.viewer.current.startTime < 0 ? 0 : self
			.viewer.current.startTime;
		let endTime = self.viewer.current.startTime + (self.viewer.width / scalingRatio * self
			.audio.duration / self.viewer.width);
		if (endTime > self.audio.duration) {
			self.viewer.current.startTime = self.audio.duration - (self.viewer.width /
				scalingRatio * self.audio.duration / self.viewer.width);
		}
	} else if (self.viewer.current.mode == MODE_READY) {
		__resize(self, event);
	}
}

let __handleKeyDown = (event, self) => {
	if (event.keyCode == 16) {
		if (self.viewer.current.mode == MODE_READY) {
			self.viewer.current.mode = MODE_VIEW_MOVE;
		}
	} else if (event.keyCode == 46) {
		if (self.viewer.current.mode == MODE_READY) {
			self.deleteCurrentRegion();
		}
	}
}

let __handleKeyUp = (event, self) => {
	if (event.keyCode == 16) {
		if (self.viewer.current.mode == MODE_VIEW_MOVE) {
			self.viewer.current.mode = MODE_READY;
		}
	}
}

let __resize = (self, event) => {
	if (!self.drawer) {
		return;
	}
	if (event.wheelDelta > 0) {
		self.viewer.waveGain++;
		let scalingRatio = Math.pow(BASIC_SCALE, self.viewer.waveGain);
		self.viewer.current.startTime = self.viewer.current.startTime + (event.offsetX * (BASIC_SCALE - 1) /
			scalingRatio *
			self.audio.duration / self.viewer.width)
	} else {
		if (self.viewer.waveGain > 0) {
			self.viewer.waveGain--;
			let scalingRatio = Math.pow(BASIC_SCALE, self.viewer.waveGain);
			self.viewer.current.startTime = self.viewer.current.startTime - (event.offsetX * (1 - 1 / BASIC_SCALE) /
				scalingRatio * self.audio.duration / self.viewer.width)
			self.viewer.current.startTime = self.viewer.current.startTime < 0 ? 0 : self.viewer.current
				.startTime;
			let endTime = self.viewer.current.startTime + (self.viewer.width / scalingRatio * self.audio
				.duration / self.viewer.width);
			if (endTime > self.audio.duration) {
				self.viewer.current.startTime = self.audio.duration - (self.viewer.width / scalingRatio *
					self.audio.duration / self.viewer.width);
			}
		}
	}
}

let __autoRefresh = (self) => {
	function _refresh() {
		if (FLAG_FLUSH) {
			if (self.viewer.displayTimeLine && self.viewer.height > self.drawer.canvas.clientHeight -
				HEIGHT_TOOL_TIMELINE) {
				self.viewer.height -= 1;
			}
			if (!self.viewer.displayTimeLine && self.viewer.height < self.drawer.canvas.clientHeight) {
				self.viewer.height += 1;
			}
			__drawTimeLine(self);
			__drawWave(self);
			__drawOverlayer(self);
		}
		FLAG_FLUSH *= -1;
		window.requestAnimationFrame(_refresh);
	}
	window.requestAnimationFrame(_refresh);
}

let __drawWave = (self) => {
	let channelDataArr = __reSample(self);
	if (channelDataArr) {
		let peerHeight = self.viewer.height / channelDataArr.length;
		for (let i = 0; i < channelDataArr.length; i++) {
			self.drawer.drawWave(channelDataArr[i], {
				x: 0,
				y: peerHeight * i,
				width: self.viewer.width,
				height: peerHeight
			});
		}
		self.drawer.drawRegions({
				width: self.viewer.width,
				height: self.viewer.height
			}, self.audio.duration, self.viewer.waveGain, self.viewer.current.startTime, self.regions, self
			.viewer
			.current.region);
	}
}

let __drawTimeLine = (self) => {
	if (!self.drawer) {
		return;
	}
	let process = __getActualPlayTime(self);
	let selectedTimeInTimeLine = self.viewer.current.mouseOver ? self.viewer.current
		.selectedTimeInTimeLine : 0;
	self.drawer.drawTimeLine({
			x: 0,
			y: self.viewer.height,
			width: self.viewer.width,
			height: HEIGHT_TOOL_TIMELINE
		}, self.audio.duration, process, selectedTimeInTimeLine, self.viewer.waveGain, self.viewer
		.current.startTime);
}

let __drawOverlayer = (self) => {
	if (!self.drawer) {
		return;
	}
	let process = __getActualPlayTime(self);
	let scalingRatio = Math.pow(BASIC_SCALE, self.viewer.waveGain);
	let viewerDuration = self.audio.duration / scalingRatio * self.viewer.width;
	if (self.viewer.displayPlayOverlay && process > self.viewer.current.startTime &&
		process < self.viewer.current.startTime + viewerDuration) {
		let width = (process - self.viewer.current.startTime) / (self.audio.duration / scalingRatio) * self
			.viewer.width;
		self.drawer.drawerPlayOverlay({
			x: 0,
			y: 0,
			width: width,
			height: self.viewer.height
		});
	}
}

/**
 * @return {Array<Float32Array>} 多个channel重采样之后的数据
 */
let __reSample = (self) => {
	if (!self.drawer || !self.audio.audioData) {
		return;
	}
	// scalingRatio 就是实际的放大比例，这里用指数函数，旨在让放大效果更加平滑，如果用线性比例放大，可能会在放大到一定倍数的时候，再放大就感受不到原有的比例了
	// 其中 self.viewer.waveGain 初始值为 0，这也提供了一个好处，任何数的0次方为1，就是不放大，可以做统一处理
	// self.viewer.waveGain 在鼠标滚轮上滑时 +1 下滑时 -1，控制下边界为 0
	let scalingRatio = Math.pow(BASIC_SCALE, self.viewer.waveGain);
	let sampleLen = self.viewer.width * DENSITY;
	// aScale为降采样比例：sampleTotal/sampleLen/scalingRatio，当没有放大时self.viewer.waveGain为0，scalingRatio就是1，降采样比例就是sampleTotal/smapleLen，这就很好理解了
	let baseArr = self.audio.audioData.getChannelData(0);
	let aScale = baseArr.length / sampleLen / scalingRatio;
	// sampleLen 为绘制当前显示窗口需要的采样点数，如果不设置波形间隔，那么这个值为 self.viewer.width * DENSITY 即窗口宽度（px）* 固定值（DENSITY）
	if (self.drawer.style.waveBarGap) {
		sampleLen = self.viewer.width / (self.drawer.style.waveBarGap + self.drawer.style.waveBarWidth);
		aScale = baseArr.length / sampleLen / scalingRatio
	}
	let displayChannels = self.viewer.displayAllChannel ? self.audio.numberOfChannels : 1;
	let channelDataArr = new Array(displayChannels);
	// 这里三层循环的作用为降采样，其中第一层为 多个通道（音轨）的循环，第二为降采样，
	// 第三层为单个降采样点的取极值，会让波形更具代表性，在降采样比例大于20时触发
	for (let channelNo = 0; channelNo < displayChannels; channelNo++) {
		let channelData = self.audio.audioData.getChannelData(channelNo);
		channelDataArr[channelNo] = new Float32Array(sampleLen);
		let newArr = channelDataArr[channelNo];
		let pos = self.viewer.current.startTime * self.audio.sampleRate;
		let needDeextreme = aScale > 2;
		let sub_offset = aScale > SUB_DOWNSAMPLING_LIMIT ? Math.floor(aScale / SUB_DOWNSAMPLING_LIMIT) : 1;
		let sub_limit = aScale > SUB_DOWNSAMPLING_LIMIT ? SUB_DOWNSAMPLING_LIMIT : Math.floor(aScale);
		for (let i = 0; i < newArr.length; i++) {
			let position = Math.round(pos);
			if (needDeextreme) {
				let anchor = channelData[position];
				let increment;
				for (let subi = 1; subi < sub_limit; subi++) {
					increment = Math.floor(sub_offset * subi);
					if (anchor * channelData[position + increment] > 0 &&
						Math.abs(channelData[position + increment]) > Math.abs(anchor)) {
						anchor = channelData[position + increment];
					}
				}
				newArr[i] = anchor;
			} else {
				newArr[i] = channelData[position];
			}
			pos += aScale;
		}
	}
	return channelDataArr;
}

let __getRegionByTime = (regions, time, offset) => {
	for (let i = 0; i < regions.length; i++) {
		let region = regions[i];
		if (time > region.startTime - offset && time < region.endTime + offset) {
			return region;
		}
	}
	return undefined;
}

let __getActualPlayTime = (self) => {
	let process = self.player.playTime;
	if (self.player.play) {
		let diffTime = self.audioContext.currentTime - self.player.previousLogTime;
		process = self.player.playTime + diffTime;
		if (process > self.audio.duration) {
			let multiple = ~~(process / self.audio.duration);
			process -= self.audio.duration * multiple;
		}
	}
	return process;
}

/**
 * @typedef {Object} AudioViewerInitParams
 * @property {File} file
 * @property {string} fileUrl audio file url 
 */

/**
 * 注意不能在使用AudioViewer实例的页面覆盖 document.onkeydown 、document.onkeyup 和 window.onresize 三个事件，
 * 如需监听键盘事件可用：document.addEventListener('keydown', () => {...}) 方式
 */
export class AudioViewer {
	audioContext = new AudioContext();
	/**
	 * @property {{audioData: ArrayBuffer}}
	 */
	audio = {
		file: null,
		fileUrl: null,
		audioData: null,
		bufferSource: null,
		gainNode: null,

		sampleRate: 0,
		duration: 0,
		numberOfChannels: 0
	};
	player = {
		playTime: 0,
		previousLogTime: 0,
		play: false,
		forceStop: false,
		autoLoop: false,
		seekToStartOnEnd: true,
		volume: 1
	}
	viewer = {
		width: 0,
		height: 0,
		displayTimeLine: true,
		displayLoadProgress: true,
		displayAllChannel: true,
		displayPlayOverlay: true,
		playOnly: false,
		waveGain: 0,

		current: {
			mode: MODE_NAN,
			mouseOver: false,

			startTime: 0,
			region: null, //{startTime = 0, endTime=0}
			regionTime: 0,
			selectedTimeInTimeLine: -1
		}
	};
	regions = [];
	drawer = null;
	globalEndListener = null;
	pauseListeners = [];
	endListeners = [];

	plugins = [];
	filters = [];

	/**
	 * @param {{file: File, fileUrl: string, autoLoop: boolean, seekToStartOnEnd: boolean, volume: number,
	 regions: Array<{start: number, end: number}>, canvas: HTMLCanvasElement, waveColor: string, 
	 waveBarWidth: number, waveBarGap: number, waveBarCap: 'butt'|'round'|'square', regionColor: string,
	 curRegionColor: string, regionBorderColor: string, displayTimeLine: boolean, 
	 displayLoadProgress: boolean, displayAllChannel: boolean, displayPlayOverlay: boolean, playOnly: boolean}} 
	 * params 构造参数，可以设置播放参数及用于显示波形的canvas元素等
	 */
	constructor(params) {
		params = params || {};
		this.audio.file = params.file;
		this.audio.fileUrl = params.fileUrl;
		this.player.autoLoop = typeof(params.autoLoop) != "undefined" && params.autoLoop;
		if (typeof(params.seekToStartOnEnd) != "undefined") {
			this.player.seekToStartOnEnd = params.seekToStartOnEnd;
		}
		if (typeof(params.volume) == "number") {
			this.setVolume(params.volume);
		}
		this.regions = params.regions || [];
		if (params.canvas) {
			this.drawer = new Drawer({
				canvas: params.canvas,
				waveColor: params.waveColor,
				waveBarWidth: params.waveBarWidth,
				waveBarGap: params.waveBarGap,
				waveBarCap: params.waveBarCap,
				regionColor: params.regionColor,
				curRegionColor: params.curRegionColor,
				regionBorderColor: params.regionBorderColor,
				playOverlayColor: params.playOverlayColor
			});
			if (typeof(params.displayTimeLine) != "undefined") {
				this.viewer.displayTimeLine = params.displayTimeLine;
			}
			if (typeof(params.displayLoadProgress) != "undefined") {
				this.viewer.displayLoadProgress = params.displayLoadProgress;
			}
			if (typeof(params.displayAllChannel) != "undefined") {
				this.viewer.displayAllChannel = params.displayAllChannel;
			}
			if (typeof(params.displayPlayOverlay) != "undefined") {
				this.viewer.displayPlayOverlay = params.displayPlayOverlay;
			}
			this.viewer.width = this.drawer.canvas.clientWidth;
			if (this.viewer.displayTimeLine) {
				this.viewer.height = this.drawer.canvas.clientHeight - HEIGHT_TOOL_TIMELINE;
				__autoRefresh(this);
			} else {
				this.viewer.height = this.drawer.canvas.clientHeight;
			}
			// 自适应高宽
			this.drawer.canvas.setAttribute("width", this.viewer.width);
			this.drawer.canvas.setAttribute("height", this.drawer.canvas.clientHeight);
			let _that = this;
			window.addEventListener('resize', () => {
				_that.viewer.width = _that.drawer.canvas.clientWidth;
				_that.drawer.canvas.setAttribute("width", _that.viewer.width);
				_that.viewer.height = _that.drawer.canvas.clientHeight - HEIGHT_TOOL_TIMELINE;
				_that.drawer.canvas.setAttribute("height", _that.drawer.canvas.clientHeight);
				if (_that.audio.audioData) {
					let audioArr = _that.audio.audioData.getChannelData(0);
				}
			});
			if (typeof(params.playOnly) != "undefined") {
				this.viewer.playOnly = params.playOnly;
			}
		} else {
			if (params.canvas === null) {
				console.warn("canvas为空，可能与预期不符。");
			}
		}
		__initListener(this);
		if (this.audio.file) {
			this.loadFile(this.audio.file);
		} else if (this.audio.fileUrl) {
			this.loadUrl(this.audio.fileUrl);
		}
		this.plugins = params.plugins;
	}

	/**
	 * 设置播放及展示相关的参数，但是不能设置音量，设置音量使用 <code>setVolume(volume)</code> 方法，
	 * 在操作<code>Region</code>的时候不能设置<code>playOnly</code>参数
	 * @param {{autoLoop: boolean, seekToStartOnEnd: boolean, waveColor: string, 
	 waveBarWidth: number, waveBarGap: number, waveBarCap: 'butt'|'round'|'square', regionColor: string,
	 curRegionColor: string, regionBorderColor: string, displayTimeLine: boolean, 
	 displayLoadProgress: boolean, displayAllChannel: boolean, displayPlayOverlay: boolean, playOnly: boolean}} 
	 * parameters 参数
	 */
	set(parameters) {
		parameters = Object.assign({
			autoLoop: this.player.autoLoop,
			seekToStartOnEnd: this.player.seekToStartOnEnd,
			displayTimeLine: this.viewer.displayTimeLine,
			displayLoadProgress: this.viewer.displayLoadProgress,
			displayAllChannel: this.viewer.displayAllChannel,
			displayPlayOverlay: this.viewer.displayPlayOverlay,
		}, parameters);
		this.player.autoLoop = parameters.autoLoop;
		this.player.seekToStartOnEnd = parameters.seekToStartOnEnd;
		this.viewer.displayTimeLine = parameters.displayTimeLine;
		this.viewer.displayLoadProgress = parameters.displayLoadProgress;
		this.viewer.displayAllChannel = parameters.displayAllChannel;
		this.viewer.displayPlayOverlay = parameters.displayPlayOverlay;
		if (typeof(parameters.playOnly) != "undefined") {
			this.viewer.playOnly = parameters.playOnly;
			if (this.viewer.playOnly) {
				this.viewer.waveGain = 0;
				this.viewer.current.startTime = 0;
				this.viewer.current.mode = MODE_NAN;
			} else {
				this.viewer.current.mode = MODE_READY;
			}
		}
		if (this.drawer) {
			this.drawer.set(parameters);
		}
	}

	/**
	 * @param {number} volume 音量（0~1之间的数）
	 */
	setVolume(volume) {
		volume = Math.max(0, Math.min(1, volume));
		this.player.volume = volume;
		if (this.audioContext && this.audio.gainNode)
			this.audio.gainNode.gain.setValueAtTime(this.player.volume, 0);
	}

	/**
	 * @param {(time: number) => boolean} filter
	 */
	setFilters(filter) {
		this.filters.push(filter);
	}

	/**
	 * 异步加载文件
	 * @param {File} file 要加载的文件
	 * @param {(arrBuffer: ArrayBuffer, audioSampleRate: number) => void} onLoadCompleted 加载完成之后的回调函数
	 * @param {() => void} onLoadError 加载出错的回调函数
	 */
	loadFile(file, onLoadCompleted, onLoadError) {
		this.audio.file = file;
		let fr = new FileReader();
		fr.readAsArrayBuffer(file);
		fr.addEventListener("progress", e => {
			if (_that.drawer && _that.viewer.displayLoadProgress)
				this.drawer.drawLoadProgress(this.viewer.width, this.viewer.height, TEXT_LOADING, e.loaded /
					e.total);
		});
		let _that = this;
		fr.addEventListener('load', loadEvent => {
			let arrBuffer = loadEvent.target.result;
			let audioSampleRate = getAudioSampleRate(arrBuffer);
			_that.loadArrayBuffer(arrBuffer, audioSampleRate, onLoadCompleted, onLoadError);
		});
	}

	/**
	 * 异步加载指定URL的文件资源
	 * @param {string} audioUrl 音频资源url，例如：http://www.scottwang.work/resources/audio/test.wav
	 * @param {(arrBuffer: ArrayBuffer, audioSampleRate: number) => void} onLoadCompleted 加载完成之后的回调函数
	 * @param {() => void} onLoadError 加载出错的回调函数
	 * @param {(event: ProgressEvent<EventTarget>) => void} onProgress
	 */
	loadUrl(audioUrl, onLoadCompleted, onLoadError, onProgress) {
		this.audio.fileUrl = audioUrl;
		let _that = this;
		let ajax = new XMLHttpRequest();
		ajax.responseType = "arraybuffer";
		ajax.open("GET", audioUrl);
		ajax.send();
		ajax.onreadystatechange = function(e) {
			if (ajax.readyState == 4 && ajax.status == 200) {
				let arrBuffer = ajax.response;
				let audioSampleRate = getAudioSampleRate(arrBuffer);
				_that.loadArrayBuffer(ajax.response, audioSampleRate, onLoadCompleted, onLoadError)
			}
		}
		ajax.onprogress = function(event) {
			if (_that.drawer && _that.viewer.displayLoadProgress) {
				let loadProgress = event.loaded / event.total;
				if (loadProgress > 0.99) {
					_that.drawer.drawLoadProgress(_that.viewer.width, _that.viewer.height, TEXT_DRAWING,
						loadProgress);
				} else {
					_that.drawer.drawLoadProgress(_that.viewer.width, _that.viewer.height, TEXT_LOADING,
						loadProgress);
				}
			}
			if (onProgress) {
				try {
					onProgress(event);
				} catch (e) {
					console.debug("Failed to invoke the progress Callback.")
					throw new Error(e.message);
				}
			}
		};
	}

	/**
	 * 异步加载二进制数据
	 * @param {ArrayBuffer} arrBuffer 要加载的音频数据
	 * @param {number} audioSampleRate 音频采样率
	 * @param {(arrBuffer: ArrayBuffer, audioSampleRate: number) => void} onLoadCompleted 加载完成之后的回调函数
	 * @param {() => void} onLoadError 加载出错的回调函数
	 */
	loadArrayBuffer(arrBuffer, audioSampleRate, onLoadCompleted, onLoadError) {
		this.reset();
		if (!this.viewer.playOnly) {
			this.viewer.current.mode = MODE_READY;
		}
		this.audioContext = new AudioContext({
			sampleRate: audioSampleRate
		});
		this.audio.gainNode = this.audioContext.createGain();
		this.audio.gainNode.gain.setValueAtTime(this.player.volume, 0);
		if (this.drawer && this.viewer.displayLoadProgress) {
			this.drawer.drawLoadProgress(this.viewer.width, this.viewer.height, TEXT_DRAWING, 1);
		}
		let _that = this;
		this.audioContext.decodeAudioData(arrBuffer, audioBuffer => {
			_that.audio.audioData = audioBuffer;
			_that.audio.sampleRate = audioBuffer.sampleRate;
			_that.audio.duration = audioBuffer.duration;
			_that.audio.numberOfChannels = audioBuffer.numberOfChannels;

			let audioBuf = audioBuffer.getChannelData(0);
			if (onLoadCompleted) {
				onLoadCompleted(arrBuffer, audioSampleRate);
			}
			if (_that.plugins) {
				/** @todo plugin 调试 */
				for (let plugin of _that.plugins) {
					console.log(plugin)
					console.log(plugin instanceof Plugin)
					if (plugin instanceof Plugin && plugin.loadAudioBuffer) {
						try {
							plugin.loadAudioBuffer(audioBuffer);
						} catch (e) {
							console.error('Failed to invoke the method loadAudioBuffer of plugin', plugin
								.constructor.name);
							console.log(e);
						}
					}
				}
			}
		}, error => {
			if (onLoadError) onLoadError();
		})
	}

	/**
	 * 设置区域
	 * @param {Array<{startTime: number, endTime: number}>} regions 区域数组
	 */
	initRegions(regions = []) {
		this.regions = regions;
	}

	/**
	 * 添加区域
	 * @param {Array<{startTime: number, endTime: number}>} regions 区域数组
	 */
	addRegions(regions = []) {
		this.regions = this.regions.concat(regions);
	}

	/**
	 * @param {(number) => void} pauseListener 播放暂停监听器
	 */
	registerPauseListener(pauseListener) {
		this.pauseListeners.push(pauseListener);
	}

	/**
	 * @param {() => void} endListener 播放结束监听器
	 */
	registerEndListener(endListener) {
		this.endListeners.push(endListener);
	}

	/**
	 * 播放音频，可以指定播放的起始及结束时间
	 * @param {{start: number, end: number, onpaused: () => void, onend: () => void}} 
	 * playParams {start: 起始时间, end: 结束时间, onpaused: 暂停的回调, onend: 播放结束的回调}
	 */
	play(playParams) {
		playParams = playParams || {};
		let start = playParams.start;
		let end = playParams.end;
		let onpaused = playParams.onpaused;
		let onend = playParams.onend;
		if (this.audio.audioData && (!this.player.play || typeof(start) != "undefined")) {
			this.player.play = true;
			if (this.audio.bufferSource) {
				this.audio.bufferSource.removeEventListener('ended', this.globalEndListener);
				this.audio.bufferSource.stop();
				this.audio.bufferSource.disconnect();
				this.audio.bufferSource = null;
				this.audio.gainNode.disconnect();
			}
			this.audio.bufferSource = this.audioContext.createBufferSource();
			this.audio.bufferSource.buffer = this.audio.audioData;
			this.audio.bufferSource.loop = this.player.autoLoop;
			let _that = this;
			this.globalEndListener = function(e) {
				_that.player.play = false;
				let diffTime = _that.audioContext.currentTime - _that.player.previousLogTime;
				_that.player.playTime += diffTime;
				let ended = _that.player.playTime % _that.audio.duration < 0.02;
				let seekToStartOnEnd = _that.player.autoLoop || _that.player.seekToStartOnEnd;
				while (seekToStartOnEnd & _that.player.playTime >= _that.audio.duration) {
					_that.player.playTime -= _that.audio.duration;
				}
				if (onpaused) {
					onpaused(_that.player.playTime);
				}
				_that.pauseListeners.forEach(item => item(_that.player.playTime));
				if (ended) {
					if (seekToStartOnEnd) {
						_that.player.playTime = 0;
					}
					if (onend) {
						onend();
					}
					_that.endListeners.forEach(item => item());
				}
			};
			this.audio.bufferSource.addEventListener('ended', this.globalEndListener);
			this.audio.bufferSource.connect(this.audio.gainNode);
			this.audio.gainNode.connect(this.audioContext.destination);
			if (typeof(start) != "undefined") {
				this.player.playTime = start;
				if (typeof(start) != "undefined" && end > start) {
					this.audio.bufferSource.start(0, start, end - start);
				} else {
					this.audio.bufferSource.start(0, start);
				}
			} else {
				this.audio.bufferSource.start(0, this.player.playTime);
			}
			this.player.previousLogTime = this.audioContext.currentTime;
		}
	}

	/**
	 * 切换播放状态
	 */
	toggle(onend) {
		if (this.audio.audioData) {
			if (this.player.play) {
				this.pause();
			} else {
				this.play({
					onend: onend
				});
			}
		}
	}

	/**
	 * 播放当前选中的区域
	 */
	playCurrentRegion() {
		if (this.viewer.current.region) {
			this.play({
				start: this.viewer.current.region.startTime,
				end: this.viewer.current.region.endTime
			});
		}
	}

	/**
	 * 播放指定区域
	 * @param {{regions: Array<{startTime: number, endTime: number}>, filter: (region) => boolean, 
	 onend: () => void}} regions 区域数组
	 * @param {() => void} onend 播放完所有区域后的回调
	 */
	playRegions(parameters) {
		parameters = parameters || {};
		let playRegions = parameters.regions || this.regions;
		this.player.forceStop = false;
		playRegions.sort((l, r) => l.startTime - r.startTime);
		let regionsBak = JSON.parse(JSON.stringify(playRegions));
		if (parameters.filter) {
			regionsBak = regionsBak.filter(parameters.filter);
		}

		function playRegion(viewerContext, regionArr) {
			let region = regionArr.shift();
			if (!viewerContext.player.forceStop) {
				if (region) {
					viewerContext.play({
						start: region.startTime,
						end: region.endTime,
						onpaused: () => {
							playRegion(viewerContext, regionArr);
						}
					})
				} else {
					if (parameters.onend) {
						parameters.onend();
					}
				}
			}
		}
		playRegion(this, regionsBak);
	}

	/**
	 * 暂停播放
	 */
	pause() {
		if (this.audio.bufferSource && this.player.play) {
			this.audio.bufferSource.stop();
			this.player.play = false;
			this.player.forceStop = true;
		}
	}

	/**
	 * 跳转到指定时间
	 * @param {number} seekTime
	 */
	seekTo(seekTime) {
		if (this.player.play) {
			this.play({
				start: seekTime
			});
		} else {
			this.player.playTime = seekTime;
		}
	}

	/**
	 * 重置
	 */
	reset() {
		if (this.audio.bufferSource) {
			if (this.globalEndListener) {
				this.audio.bufferSource.removeEventListener('ended', this.globalEndListener);
			}
			this.audio.bufferSource.stop();
			this.audio.bufferSource.disconnect();
			this.audio.bufferSource = null;
		}
		this.audio.audioData = null;
		this.audio.sampleRate = 0;
		this.audio.duration = 0;
		this.audio.numberOfChannels = 0;
		this.player.playTime = 0;
		this.player.previousLogTime = 0;
		this.player.play = false;
		this.player.forceStop = false;
		this.viewer.waveGain = 0;
		this.viewer.current = {
			mode: MODE_NAN,
			mouseOver: false,
			startTime: 0,
			region: null, //{startTime = 0, endTime=0}
			regionTime: 0,
			selectedTimeInTimeLine: -1
		};
		this.regions = [];
		if (this.drawer) {
			this.drawer.clearCanvas();
		}
		if (this.plugins) {
			for (let plugin of this.plugins) {
				if (plugin.reset) {
					try {
						plugin.reset();
					} catch (e) {
						console.error('Failed to invoke the method reset of plugin', plugin.constructor.name);
						console.log(e);
					}
				}
			}
		}
	}

	/**
	 * @returns {boolean} 当前的播放状态 
	 */
	getPlayStatus() {
		return this.player.play;
	}

	/**
	 * 获取当前选中的区域
	 * @returns {{startTime: number, endTime: number}}
	 */
	getCurrentRegion() {
		return this.viewer.current.region;
	}

	/**
	 * 获取所有区域
	 * @returns {Array<{startTime: number, endTime: number}>}
	 */
	getRegions() {
		return this.regions;
	}

	/**
	 * @return {{sampleRate: number, duration: number, numberOfChannels: number}} 返回加载的音频的信息，包含采样率，时长以及通道数
	 */
	getAudioInfo() {
		return {
			sampleRate: this.audio.sampleRate,
			duration: this.audio.duration,
			numberOfChannels: this.audio.numberOfChannels
		};
	}

	/**
	 * @param {number} channel 通道号
	 * @returns {Blob} 返回指定音轨的数据
	 */
	getChannelData(channel) {
		channel = channel | 0;
		if (this.audio.audioData && channel < this.audio.audioData.numberOfChannels) {
			let frameCount = this.audio.duration * this.audio.sampleRate;
			let newAudioBuffer = this.audioContext.createBuffer(1, frameCount, this.audio.sampleRate);
			let tmpStore = new Float32Array(frameCount);
			this.audio.audioData.copyFromChannel(tmpStore, channel, 0);
			newAudioBuffer.copyToChannel(tmpStore, channel, 0);
			return audioBufferToBlob(newAudioBuffer, frameCount);
		}
		return undefined;
	}

	/**
	 * 删除当前选中的区域
	 */
	deleteCurrentRegion() {
		if (this.viewer.current.region) {
			this.deleteRegion(this.viewer.current.region);
			this.viewer.current.region = null;
		}
	}

	/**
	 * 删除指定区域，将其从区域数组中删除
	 * @param {{startTime: number, endTime: number}} delRegion
	 */
	deleteRegion(delRegion) {
		for (let i = 0; i < this.regions.length; i++) {
			if (this.regions[i].startTime == delRegion.startTime && this.regions[i].endTime == delRegion.endTime) {
				this.regions.splice(i, 1);
				break;
			}
		}
	}

	/**
	 * 将多个区域剪切出来
	 * @param {Array<{startTime: number, endTime: number}>} regions 需要剪切出来的区域，如果不传值，则剪切所有region
	 * @param {(region) => boolean} filter 
	 * @returns {Blob} blob
	 */
	editRegions(parameters) {
		parameters = parameters || {};
		let targetRegions = parameters.regions || this.regions;
		if (parameters.filter) {
			targetRegions = targetRegions.filter(parameters.filter);
		}
		if (this.audio.audioData) {
			targetRegions.sort((l, r) => l.startTime - r.startTime);
			let totalDuration = 0;
			for (let region of targetRegions) {
				totalDuration += (region.endTime - region.startTime);
			}
			let newAudioBuffer = this.audioContext.createBuffer(this.audio.numberOfChannels,
				totalDuration * this.audio.sampleRate, this.audio.sampleRate);
			let targetBufOffset = 0;
			let tmpStore = null;
			for (let region of targetRegions) {
				var startOffset = this.audio.sampleRate * region.startTime;
				var endOffset = this.audio.sampleRate * region.endTime;
				var frameCount = endOffset - startOffset;
				tmpStore = new Float32Array(frameCount);
				for (let channelNo = 0; channelNo < this.audio.numberOfChannels; channelNo++) {
					this.audio.audioData.copyFromChannel(tmpStore, channelNo, startOffset);
					newAudioBuffer.copyToChannel(tmpStore, channelNo, targetBufOffset);
				}
				targetBufOffset += frameCount;
			}
			return audioBufferToBlob(newAudioBuffer, totalDuration * this.audio.sampleRate);
		}
	}

}
