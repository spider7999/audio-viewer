import {
	formatTime,
	colorHexToRgba
} from './util.js';

const BASIC_SCALE = 1.1;


export class Drawer {

	canvas = null;
	canvasContext = null;
	style = {
		waveColor: 'rgba(3, 138, 255, 1)',
		waveBarWidth: 0.3,
		waveBarGap: 0,
		waveBarCap: 'butt', //'butt','round','square'
		// regionColor: 'rgba(255, 100, 100, 0.1)',
		// curRegionColor: 'rgba(255, 100, 100, 0.3)',
		// regionBorderColor: 'rgba(255, 100, 100, 1)',
		regionColor: 'rgba(0, 191, 165, 0.1)',
		curRegionColor: 'rgba(0, 191, 165, 0.3)',
		regionBorderColor: 'rgba(0, 191, 165, 1)',
		playOverlayColor: 'rgba(3, 138, 255, 0.1)'
	}

	constructor(params) {
		this.canvas = params.canvas;
		this.canvasContext = params.canvas.getContext('2d');
		this.set(params);
	}

	set(parameters) {
		this.style.waveColor = parameters.waveColor || this.style.waveColor;
		this.style.waveBarWidth = parameters.waveBarWidth || this.style.waveBarWidth;
		this.style.waveBarGap = parameters.waveBarGap || this.style.waveBarGap;
		this.style.waveBarCap = parameters.waveBarCap || this.style.waveBarCap;
		this.style.regionColor = parameters.regionColor || this.style.regionColor;
		this.style.curRegionColor = parameters.curRegionColor || this.style.curRegionColor;
		this.style.regionBorderColor = parameters.regionBorderColor || this.style.regionBorderColor;
		this.style.playOverlayColor = parameters.playOverlayColor || this.style.playOverlayColor;
	}

	clearCanvas(viewWidth, viewHeight) {
		this.canvasContext.clearRect(0, 0, viewWidth || this.canvas.width, viewHeight || this.canvas.height);
	}

	drawWave(dataArr, waveRect) {
		let bufferLength = dataArr.length;
		this.canvasContext.clearRect(waveRect.x, waveRect.y, waveRect.width, waveRect.height);
		this.canvasContext.lineWidth = this.style.waveBarWidth;
		this.canvasContext.strokeStyle = this.style.waveColor;
		this.canvasContext.beginPath();
		if (this.style.waveBarGap) {
			this.canvasContext.lineCap = this.style.waveBarCap;
			var x = waveRect.x;
			for (var i = 0; i < bufferLength; i++) {
				var v = dataArr[i] * waveRect.height / 2;
				let y_s = waveRect.y + waveRect.height / 2 - v;
				var y = waveRect.y + waveRect.height / 2 + v;
				this.canvasContext.moveTo(x, y_s);
				this.canvasContext.lineTo(x, y);
				x += this.style.waveBarWidth + this.style.waveBarGap;
			}
		} else {
			var sliceWidth = waveRect.width * 1.0 / bufferLength;
			var x = waveRect.x;
			for (var i = 0; i < bufferLength; i++) {
				var v = dataArr[i] * waveRect.height / 2;
				var y = waveRect.y + waveRect.height / 2 + v;
				if (i === 0) {
					this.canvasContext.moveTo(x, y);
				} else {
					this.canvasContext.lineTo(x, y);
				}
				x += sliceWidth;
			}
		}
		this.canvasContext.stroke();
	}

	drawTimeLine(timeLineRect, audioDuration, process, selectedTimeInTimeLine, waveGain, currentStartTime) {
		this.canvasContext.clearRect(timeLineRect.x, timeLineRect.y, timeLineRect.width, timeLineRect.height)
		let w = timeLineRect.width * process / audioDuration;
		let processTime = formatTime(process) + "/" + formatTime(audioDuration);
		let textW = processTime.length * 5 + 10;
		if (w + textW > timeLineRect.width) {
			w = timeLineRect.width - textW;
		}
		this.canvasContext.clearRect(timeLineRect.x, timeLineRect.y, timeLineRect.width, timeLineRect.height);
		this.canvasContext.beginPath();
		this.canvasContext.fillStyle = '#999';
		this.canvasContext.fillRect(timeLineRect.x, timeLineRect.y + 9, timeLineRect.width - textW, 2);
		this.canvasContext.fillStyle = 'orange';
		this.canvasContext.fillRect(timeLineRect.x, timeLineRect.y + 9, w, 2);
		this.canvasContext.fillText(processTime, timeLineRect.width - textW + 5, timeLineRect.y + 14);

		if (selectedTimeInTimeLine && selectedTimeInTimeLine > 0) {
			let processTime = formatTime(selectedTimeInTimeLine) + "/" + formatTime(audioDuration);
			let textW = processTime.length * 5 + 10;
			let x = timeLineRect.width * (selectedTimeInTimeLine / audioDuration) - (textW / 2);
			if (x <= 0) {
				x = 0;
			}
			this.canvasContext.fillText(processTime, x, timeLineRect.y + 8);
		}

		if (waveGain && waveGain > 0) {
			let rtScale = Math.pow(BASIC_SCALE, waveGain);
			let startPosition = timeLineRect.width * currentStartTime / audioDuration;
			let ribbonWidth = timeLineRect.width / rtScale;
			if (ribbonWidth < 5) ribbonWidth = 5;
			this.canvasContext.fillStyle = 'rgba(100, 100, 100, 0.15)';
			this.canvasContext.fillRect(startPosition, timeLineRect.y + 2, ribbonWidth, 16);
		}
	}

	/**
	 * 绘制播放遮罩层
	 * @param {{x: number, y:number, width: number, height: number}} rect
	 */
	drawerPlayOverlay(rect) {
		this.canvasContext.fillStyle = this.style.playOverlayColor;
		this.canvasContext.fillRect(rect.x, rect.y, rect.width, rect.height);
		this.canvasContext.lineWidth = 1;
		this.canvasContext.strokeStyle = this.style.waveColor;
		this.canvasContext.beginPath();
		this.canvasContext.moveTo(rect.x + rect.width, rect.y);
		this.canvasContext.lineTo(rect.x + rect.width, rect.y + rect.height);
		this.canvasContext.stroke();
	}

	drawRegions(waveRect, audioDuration, waveGain, viewerStartTime, regions, currentRegion) {
		if (!this.canvas) {
			return;
		}
		let rtScale = Math.pow(BASIC_SCALE, waveGain);
		let _that = this;
		regions.forEach(region => {
			if (currentRegion && region.startTime == currentRegion.startTime &&
				region.endTime == currentRegion.endTime) {
				_that.canvasContext.fillStyle = _that.style.curRegionColor;
				if (region.color) {
					_that.canvasContext.fillStyle = colorHexToRgba(region.color, 0.3);
				}
			} else {
				_that.canvasContext.fillStyle = _that.style.regionColor;
				if (region.color) {
					_that.canvasContext.fillStyle = colorHexToRgba(region.color, 0.1);
				}
			}
			let sr = region.startTime;
			let startX = (sr - viewerStartTime) * rtScale * waveRect.width /
				audioDuration;
			let er = region.endTime;
			let endX = (er - viewerStartTime) * rtScale * waveRect.width / audioDuration;
			_that.canvasContext.fillRect(startX, 0, endX - startX, waveRect.height);
			_that.canvasContext.lineWidth = 1;
			_that.canvasContext.strokeStyle = _that.style.regionBorderColor;
			if (region.color) {
				_that.canvasContext.strokeStyle = colorHexToRgba(region.color, 1);
			}
			_that.canvasContext.beginPath();
			_that.canvasContext.moveTo(startX, 0);
			_that.canvasContext.lineTo(startX, waveRect.height);
			_that.canvasContext.moveTo(endX, 0);
			_that.canvasContext.lineTo(endX, waveRect.height);
			_that.canvasContext.stroke();
		})
	}

	drawLoadProgress(viewWidth, viewHeight, tipText, loadProgress) {
		this.canvasContext.clearRect(0, 0, viewWidth, viewHeight);
		this.canvasContext.fillText(tipText, viewWidth / 2 - 25, viewHeight / 2 - 3 - 6);
		this.canvasContext.beginPath();
		this.canvasContext.lineWidth = 4;
		this.canvasContext.lineCap = 'round';
		this.canvasContext.strokeStyle = '#ddd';
		this.canvasContext.moveTo(viewWidth / 3, viewHeight / 2 - 2);
		this.canvasContext.lineTo(2 * viewWidth / 3, viewHeight / 2 - 2);
		this.canvasContext.stroke();
		this.canvasContext.beginPath();
		this.canvasContext.strokeStyle = 'rgba(3, 138, 255, 1)';
		this.canvasContext.moveTo(viewWidth / 3, viewHeight / 2 - 2);
		this.canvasContext.lineTo(viewWidth / 3 * (1 + loadProgress), viewHeight / 2 - 2);
		this.canvasContext.stroke();
	}

}
