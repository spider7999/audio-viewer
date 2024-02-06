# audio-viewer.js

#### 介绍
一个音频展示组件，用来展示音频的波形图等


#### 安装教程

1.  npm install audioviewer

#### 快速开始

1. 安装audioviewer

   ```shell
   npm install audioviewer
   ```

2. 引入`AudioViewer` ，创建`AudioViewer`实例。

   ```javascript
   import {AudioViewer} from 'audioviewer'
   ...
   // 如果需要在页面上展示波形图，则需要指定canvas
   let audioviewer = new AudioViewer({canvas: document.getElementById('canvas')});
   ```

3. 加载音频

   ```javascript
   audioviewer.loadFile(file);
   // 也可以加载远程音频资源
   audioviewer.loadUrl('http://demo.scottwang.work/resource/audio/test.mp3');
   ```

4. 效果

   ![logo](https://gitee.com/scott-whimsy/audio-viewer.js/raw/master/doc/image/%E6%95%88%E6%9E%9C.png)

