let formatTime = (time) => {
	let positiveTime = Math.round(time);
	let second = positiveTime % 60;
	let result = addZero(second);
	if (positiveTime / 60 >= 1) {
		let minute = Math.floor(positiveTime / 60) % 60;
		result = "" + addZero(minute) + ":" + result;
		if (positiveTime / 60 / 60 >= 1) {
			let hour = Math.floor(positiveTime / 60 / 60) % 60;
			result = "" + addZero(hour) + ":" + result;
		}
	} else {
		result = "00:" + result;
	}
	return result;

	function addZero(subTime) {
		if (subTime < 10) {
			return "0" + subTime;
		}
		return "" + subTime;
	}
}

let audioBufferToBlob = (audioBuffer, sampleLength) => {
	sampleLength = Math.floor(sampleLength)
	var numOfChan = audioBuffer.numberOfChannels,
		length = sampleLength * numOfChan * 2 + 44,
		buffer = new ArrayBuffer(length),
		dataView = new DataView(buffer),
		channels = [],
		i, sample,
		offset = 0,
		pos = 0;

	// write WAVE header https://blog.csdn.net/hjx5200/article/details/107025477/
	setUint32(0x46464952); // "RIFF"  4bit
	setUint32(length - 8); // file length - 8  4bit
	setUint32(0x45564157); // "WAVE"  4bit
	setUint32(0x20746d66); // "fmt " chunk 4bit
	setUint32(16); // length = 16  4bit
	setUint16(1); // PCM (uncompressed) 2bit
	setUint16(numOfChan); // 2bit
	setUint32(audioBuffer.sampleRate); // 4bit
	setUint32(audioBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec 4bit
	setUint16(numOfChan * 2); // block-align 2bit
	setUint16(16); // 16-bit (hardcoded in this demo) 2bit
	setUint32(0x61746164); // "data" - chunk 4bit
	setUint32(length - pos - 4); // chunk length 4bit
	// write interleaved data
	for (i = 0; i < audioBuffer.numberOfChannels; i++)
		channels.push(audioBuffer.getChannelData(i));

	while (pos < length) {
		for (i = 0; i < numOfChan; i++) {
			// clamp
			sample = Math.max(-1, Math.min(1, channels[i][offset]));
			// scale to 16-bit signed int
			sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
			// write 16-bit sample
			dataView.setInt16(pos, sample, true);
			pos += 2;
		}
		offset++
	}
	// create Blob
	return new Blob([buffer], {
		type: "audio/wav"
	});

	function setUint16(data) {
		dataView.setUint16(pos, data, true);
		pos += 2;
	}

	function setUint32(data) {
		dataView.setUint32(pos, data, true);
		pos += 4;
	}
};

let colorHexToRgba = (colorHex, alpha) => {
	var reg = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
	if (!reg.test(colorHex)) {
		return undefined;
	}
	let newStr = (colorHex.toLowerCase()).replace(/\#/g, '')
	let len = newStr.length;
	if (len == 3) {
		let t = ''
		for (var i = 0; i < len; i++) {
			t += newStr.slice(i, i + 1).concat(newStr.slice(i, i + 1))
		}
		newStr = t
	}
	let arr = [];
	for (var i = 0; i < 6; i = i + 2) {
		let s = newStr.slice(i, i + 2)
		arr.push(parseInt("0x" + s))
	}
	arr.push(alpha);
	return 'rgba(' + arr.join(",") + ')';
}

/**
 * @param {ArrayBuffer} audioData 音频数据
 * @param {number} defaultValue 缺省值，默认<code>16000</code>
 * @return {number} 音频的采样率，如果没有从音频数据中获取到，则返回缺省值
 */
let getAudioSampleRate = (audioData, defaultValue = 16000) => {
	let audioDataView = new DataView(audioData);
	let format = audioDataView.getUint32(0, true);
	let audioSampleRate = defaultValue;
	if (format == 0x46464952) { // RIFF
		console.debug("wave format");
		audioSampleRate = audioDataView.getUint32(24, true);
	}
	// let flag_mp31 = audioDataView.getUint16(audioData-128-1, false);
	// let flag_mp32 = audioDataView.getUint8(audioData-128-1+2, false);
	// if(flag_mp31==0x5441 && flag_mp32==0x47) // TAG   ID3 0x49 0x44 0x33
	return audioSampleRate;
}

export {
	formatTime,
	audioBufferToBlob,
	colorHexToRgba,
	getAudioSampleRate
};
